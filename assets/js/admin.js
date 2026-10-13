/*
 * Logic for admin.html -- the manual maintenance switch.
 *
 * Access control is GitHub's, not this page's. The user supplies a fine-grained
 * personal access token that must grant "Contents: Read and write" on this
 * repository. The token is held in sessionStorage for the life of the tab, and in
 * localStorage only if the admin explicitly opts in (and even then for no longer
 * than MAX_TOKEN_AGE_MS). It is sent only to api.github.com, never written into the
 * repository, and never left sitting in the DOM longer than it takes to submit it.
 *
 * This page deliberately does NOT load assets/js/maintenance.js, and that guard
 * exempts admin.html, so an admin can always reach the tool to switch the site
 * back on.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- config
  var OWNER = "unknownpioneer";
  var REPO = "unknownpioneer.github.io";
  var BRANCH = "main";
  var STATE_PATH = "assets/js/maintenance-state.js";
  var API = "https://api.github.com";
  var TOKEN_KEY = "beufk_admin_token";
  var TOKEN_STAMP_KEY = "beufk_admin_token_stamp";
  // An opted-in token on disk is discarded after this long, so a forgotten one
  // does not linger in the browser indefinitely.
  var MAX_TOKEN_AGE_MS = 12 * 3600 * 1000;

  // The weekly window lives in assets/js/maintenance.js. It is repeated here only so
  // the status panel can work out the next occurrence; runChecks() fetches the
  // deployed guard and compares the two, so drift is reported rather than silently
  // misleading.
  var WINDOW = { weekday: 4, startHour: 8, endHour: 9, utcOffset: 8 };

  // Keep byte-identical to the header of assets/js/maintenance-state.js: the
  // whole file is rewritten on every switch, so this text is what lands in it.
  var FILE_HEADER = [
    "/*",
    " * Manual maintenance switch.",
    " *",
    " * Written by admin.html through the GitHub Contents API, and read synchronously",
    " * by assets/js/maintenance.js in the <head> of every page. Do not rename it.",
    " *",
    " *   active  true = send visitors to the maintenance page",
    " *   until   ISO 8601 instant when maintenance ends, or null for no end",
    " *   message optional text shown on the maintenance page",
    " *   by      who switched it on",
    " *   updated when this file was last written",
    " */",
  ].join("\n");

  var WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // ------------------------------------------------------------------ dom
  function $(id) {
    return document.getElementById(id);
  }

  function setOutput(node, text, kind) {
    node.textContent = text;
    node.className = "admin-out" + (kind ? " is-" + kind : "");
    node.hidden = false;
  }

  function clearOutput(node) {
    node.textContent = "";
    node.hidden = true;
  }

  function setBadge(node, label, on) {
    node.textContent = label;
    node.className = "status-pill " + (on ? "is-on" : "is-off");
  }

  // ---------------------------------------------------------------- token
  // Storage policy: sessionStorage always (dies with the tab), localStorage only
  // on explicit opt-in and never beyond MAX_TOKEN_AGE_MS.
  function readStore(store, key) {
    try {
      return store.getItem(key) || "";
    } catch (e) {
      return "";
    }
  }

  function writeStore(store, key, value) {
    try {
      if (value) {
        store.setItem(key, value);
      } else {
        store.removeItem(key);
      }
    } catch (e) {
      /* storage unavailable (private mode): the token simply will not persist */
    }
  }

  function clearStoredToken() {
    writeStore(sessionStorage, TOKEN_KEY, "");
    writeStore(localStorage, TOKEN_KEY, "");
    writeStore(localStorage, TOKEN_STAMP_KEY, "");
  }

  function getToken() {
    var session = readStore(sessionStorage, TOKEN_KEY);
    if (session) {
      return session;
    }

    var persistent = readStore(localStorage, TOKEN_KEY);
    if (!persistent) {
      return "";
    }

    var stamp = parseInt(readStore(localStorage, TOKEN_STAMP_KEY), 10);
    if (!isNaN(stamp) && Date.now() - stamp < MAX_TOKEN_AGE_MS) {
      return persistent;
    }

    // Expired: drop it rather than leave a stale credential on disk.
    writeStore(localStorage, TOKEN_KEY, "");
    writeStore(localStorage, TOKEN_STAMP_KEY, "");
    return "";
  }

  function storeToken(value, keepOnDevice) {
    if (!value) {
      clearStoredToken();
      return;
    }
    writeStore(sessionStorage, TOKEN_KEY, value);
    if (keepOnDevice) {
      writeStore(localStorage, TOKEN_KEY, value);
      writeStore(localStorage, TOKEN_STAMP_KEY, String(Date.now()));
    } else {
      writeStore(localStorage, TOKEN_KEY, "");
      writeStore(localStorage, TOKEN_STAMP_KEY, "");
    }
  }

  /**
   * Returns "" when the value looks like a GitHub token, otherwise a message
   * explaining why it does not. These are GitHub's current prefixes; add new ones
   * here if another format appears.
   */
  function tokenProblem(value) {
    if (!value) {
      return "Enter a token first.";
    }
    if (value.length < 20 || !/^(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]+$/.test(value)) {
      return (
        "That does not look like a GitHub token. Expected a github_pat_ fine-grained " +
        "token (or ghp_/gho_/ghu_/ghs_). Nothing was saved."
      );
    }
    return "";
  }

  /**
   * Strips control characters and the Unicode line separators that would break the
   * line-oriented format of the switch file, collapses whitespace, caps the length.
   */
  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  // ------------------------------------------------------------ github api
  function api(method, path, body) {
    var headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    var token = getToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    var init = { method: method, headers: headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    return fetch(API + path, init).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  function describeError(result) {
    var message =
      result.data && result.data.message ? result.data.message : "HTTP " + result.status;
    var hints = {
      401: "the token is wrong, expired, or revoked",
      403: "the token lacks 'Contents: Read and write', or the API rate limit was hit",
      404: "the token cannot see " + OWNER + "/" + REPO,
      409: "someone edited the file at the same time -- reload and retry",
      422: "GitHub rejected the commit",
    };
    var hint = hints[result.status];
    return result.status + (hint ? " (" + hint + ")" : "") + " -- " + message;
  }

  // -------------------------------------------------------------- base64
  function encodeBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function decodeBase64(value) {
    var binary = atob(String(value).replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  // --------------------------------------------------------- state file io
  function renderStateFile(state) {
    return (
      FILE_HEADER +
      "\n" +
      "window.SITE_MAINTENANCE = {\n" +
      "  active: " + JSON.stringify(state.active === true) + ",\n" +
      "  until: " + JSON.stringify(state.until || null) + ",\n" +
      "  message: " + JSON.stringify(state.message || "") + ",\n" +
      "  by: " + JSON.stringify(state.by || "") + ",\n" +
      "  updated: " + JSON.stringify(state.updated || null) + "\n" +
      "};\n"
    );
  }

  // Values sit on their own line, so line-anchored matching survives commas
  // inside the message string.
  function pickField(text, field) {
    var match = new RegExp("^\\s*" + field + "\\s*:\\s*(.+?),?\\s*$", "m").exec(text);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return null;
    }
  }

  function readStateFile() {
    return api(
      "GET",
      "/repos/" + OWNER + "/" + REPO + "/contents/" + STATE_PATH + "?ref=" + BRANCH
    ).then(function (result) {
      if (!result.ok) {
        throw new Error(describeError(result));
      }
      return { sha: result.data.sha, text: decodeBase64(result.data.content) };
    });
  }

  function writeStateFile(state, commitMessage) {
    var body = {
      message: commitMessage,
      content: encodeBase64(renderStateFile(state)),
      branch: BRANCH,
    };

    function attempt(retriesLeft) {
      return readStateFile().then(function (current) {
        body.sha = current.sha;
        return api(
          "PUT",
          "/repos/" + OWNER + "/" + REPO + "/contents/" + STATE_PATH,
          body
        ).then(function (result) {
          if (!result.ok && result.status === 409 && retriesLeft > 0) {
            return attempt(retriesLeft - 1);
          }
          if (!result.ok) {
            throw new Error(describeError(result));
          }
          return result.data;
        });
      });
    }

    return attempt(1);
  }

  // ------------------------------------------------------------- formatting
  function formatInstant(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return String(iso) + " (unparseable)";
    }
    var utc8 = new Date(date.getTime() + 8 * 3600000);
    return (
      date.toLocaleString() +
      "  |  UTC+8: " +
      utc8.toISOString().slice(0, 16).replace("T", " ") +
      "  |  UTC: " +
      date.toISOString().slice(0, 16).replace("T", " ")
    );
  }

  function isExpired(state) {
    if (!state || state.active !== true) {
      return false;
    }
    if (!state.until) {
      return false;
    }
    var until = Date.parse(state.until);
    return !isNaN(until) && Date.now() >= until;
  }

  // ------------------------------------------------------------------ views
  function renderStatus(state) {
    var badge = $("stateBadge");
    var overrideActive = state.active === true && !isExpired(state);

    if (state.active === true && isExpired(state)) {
      setBadge(badge, "Override expired (site is up)", false);
    } else if (overrideActive) {
      setBadge(badge, "Maintenance ON (manual override)", true);
    } else {
      setBadge(badge, "No manual override (site is up)", false);
    }

    $("stateUntil").textContent = state.until ? formatInstant(state.until) : "--";
    $("stateBy").textContent = state.by || "--";
    $("stateUpdated").textContent = state.updated ? formatInstant(state.updated) : "--";
    $("stateMessage").textContent = state.message || "--";
    $("stateRaw").textContent = renderStateFile(state);
    $("stateRawWrap").hidden = true;
  }

  function refreshStatus(announce) {
    var out = $("stateError");
    clearOutput(out);
    if (!getToken()) {
      $("stateBadge").className = "status-pill is-off";
      $("stateBadge").textContent = "Add a token to read the switch";
      $("stateUntil").textContent = "--";
      $("stateBy").textContent = "--";
      $("stateUpdated").textContent = "--";
      $("stateMessage").textContent = "--";
      return Promise.resolve();
    }

    return readStateFile()
      .then(function (current) {
        renderStatus({
          active: pickField(current.text, "active") === true,
          until: pickField(current.text, "until"),
          message: pickField(current.text, "message") || "",
          by: pickField(current.text, "by") || "",
          updated: pickField(current.text, "updated"),
        });
        if (announce) {
          setOutput($("actionOut"), "Reloaded the switch from " + BRANCH + ".", "ok");
        }
      })
      .catch(function (error) {
        setOutput(out, String(error.message || error), "error");
      });
  }

  function currentFormState(isActive) {
    var now = new Date().toISOString();
    var by = cleanText($("byInput").value, 60) || "admin";
    if (!isActive) {
      return { active: false, until: null, message: "", by: by, updated: now };
    }
    var minutes = selectedMinutes();
    var until = new Date(Date.now() + minutes * 60000).toISOString();
    return {
      active: true,
      until: until,
      message: cleanText($("messageInput").value, 200),
      by: by,
      updated: now,
    };
  }

  function selectedMinutes() {
    var select = $("durationSelect");
    var minutes =
      select.value === "custom"
        ? parseInt($("customMinutes").value, 10)
        : parseInt(select.value, 10);
    // Never return NaN: that would produce an invalid Date and throw on use.
    return isNaN(minutes) || minutes < 1 ? 60 : minutes;
  }

  function updatePreview() {
    var minutes = selectedMinutes();
    var until = new Date(Date.now() + minutes * 60000);
    $("untilPreview").textContent = formatInstant(until.toISOString());
    $("previewOut").textContent = renderStateFile(currentFormState(true));
    $("previewOut").hidden = false;
  }

  // ------------------------------------------------------- read-only checks
  // Every check below only reads: the guard and the maintenance page are fetched
  // same-origin, and the audit trail is a read from the GitHub API. None of it
  // widens what the tool can write.
  function stamp(url) {
    return url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now();
  }

  function fetchGuard() {
    return fetch(stamp("assets/js/maintenance.js"), { cache: "no-store" }).then(function (res) {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return res.text();
    });
  }

  function headOk(path) {
    return fetch(stamp(path), { method: "HEAD", cache: "no-store" }).then(
      function (res) {
        return res.ok;
      },
      function () {
        return false;
      }
    );
  }

  function fetchLiveState() {
    return fetch(stamp("assets/js/maintenance-state.js"), { cache: "no-store" }).then(
      function (res) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.text();
      }
    );
  }

  /**
   * Pulls the window constants out of a copy of maintenance.js. Returns null when
   * they cannot be found, rather than guessing.
   */
  function parseGuardWindow(source) {
    function value(name) {
      var match = new RegExp("WINDOW_" + name + "\\s*=\\s*(-?\\d+)").exec(source);
      return match ? parseInt(match[1], 10) : null;
    }
    var weekday = value("WEEKDAY");
    var start = value("START_HOUR");
    var end = value("END_HOUR");
    var offset = value("UTC_OFFSET");
    if (weekday === null || start === null || end === null || offset === null) {
      return null;
    }
    return { weekday: weekday, startHour: start, endHour: end, utcOffset: offset };
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function describeWindow(win) {
    return (
      WEEKDAY_NAMES[win.weekday] +
      "s, " +
      pad2(win.startHour) +
      ":00-" +
      pad2(win.endHour) +
      ":00 UTC+" +
      win.utcOffset
    );
  }

  /**
   * The next instant the weekly window opens. Computed in the window's own offset
   * using UTC arithmetic only, so the visitor's time zone and DST cannot shift it.
   */
  function nextWindowStart(now) {
    var offsetMs = WINDOW.utcOffset * 3600000;
    var wallMs = now.getTime() + offsetMs;
    var wall = new Date(wallMs);
    var delta = (WINDOW.weekday - wall.getUTCDay() + 7) % 7;
    var startWallMs = Date.UTC(
      wall.getUTCFullYear(),
      wall.getUTCMonth(),
      wall.getUTCDate() + delta,
      WINDOW.startHour,
      0,
      0,
      0
    );
    if (startWallMs <= wallMs) {
      startWallMs += 7 * 86400000;
    }
    return new Date(startWallMs - offsetMs);
  }

  /** Names of the switch fields whose values differ between two copies of the file. */
  function stateDifferences(liveText, repoText) {
    var differing = [];
    ["active", "until", "by", "message", "updated"].forEach(function (field) {
      if (String(pickField(liveText, field)) !== String(pickField(repoText, field))) {
        differing.push(field);
      }
    });
    return differing;
  }

  /** Are the guard and the maintenance page reachable from wherever this is served? */
  function runPreflight() {
    return Promise.all([
      fetchGuard().then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      ),
      headOk("nope.html"),
    ]).then(function (results) {
      return { guardOk: results[0], pageOk: results[1] };
    });
  }

  function runChecks() {
    var guardNode = $("checkGuard");
    var pageNode = $("checkPage");
    var liveNode = $("checkLive");
    var out = $("checksOut");

    clearOutput(out);
    guardNode.textContent = "checking...";
    pageNode.textContent = "checking...";
    liveNode.textContent = "checking...";
    withButtonsDisabled(true);

    var guardText = "";
    var liveText = "";
    var guardOk = false;
    var pageOk = false;

    return fetchGuard()
      .then(
        function (text) {
          guardText = text;
          guardOk = true;
        },
        function () {
          guardOk = false;
        }
      )
      .then(function () {
        return headOk("nope.html");
      })
      .then(function (ok) {
        pageOk = ok;
      })
      .then(function () {
        return fetchLiveState().then(
          function (text) {
            liveText = text;
          },
          function () {
            liveText = "";
          }
        );
      })
      .then(function () {
        return readStateFile().then(
          function (current) {
            return current.text;
          },
          function () {
            return "";
          }
        );
      })
      .then(function (repoText) {
        guardNode.textContent = guardOk ? "reachable" : "NOT reachable";
        pageNode.textContent = pageOk ? "reachable" : "NOT reachable";

        var lines = [];
        if (!guardOk) {
          lines.push("The maintenance guard is not reachable from this origin, so enabling");
          lines.push("maintenance would have no effect until it is deployed here.");
        }
        if (!pageOk) {
          lines.push("nope.html is not reachable. Enabling maintenance would send every visitor");
          lines.push("to a missing page, which is why the tool refuses to do it.");
        }

        if (liveText && repoText) {
          var differing = stateDifferences(liveText, repoText);
          if (differing.length) {
            liveNode.textContent = "NOT live yet (differs: " + differing.join(", ") + ")";
            lines.push("The switch served here does not match " + BRANCH + " yet, so a change made");
            lines.push("now will take a few minutes to appear for visitors.");
          } else {
            liveNode.textContent = "live (matches " + BRANCH + ")";
          }
        } else if (!liveText) {
          liveNode.textContent = "could not read the served switch";
        } else {
          liveNode.textContent = "could not read " + BRANCH + " to compare";
        }

        var deployed = parseGuardWindow(guardText);
        if (deployed) {
          var same =
            deployed.weekday === WINDOW.weekday &&
            deployed.startHour === WINDOW.startHour &&
            deployed.endHour === WINDOW.endHour &&
            deployed.utcOffset === WINDOW.utcOffset;
          if (!same) {
            lines.push("WARNING: the deployed guard uses a different weekly window from this page:");
            lines.push("  deployed  " + describeWindow(deployed));
            lines.push("  this page " + describeWindow(WINDOW));
          }
        } else if (guardOk) {
          lines.push("Could not read the window constants from the deployed guard, so they were");
          lines.push("not cross-checked against this page.");
        }

        if (lines.length) {
          setOutput(out, lines.join("\n"), pageOk && guardOk ? "ok" : "error");
        } else {
          setOutput(
            out,
            "All checks passed: the guard and the maintenance page are both reachable, and the " +
              "switch matches " +
              BRANCH +
              ".",
            "ok"
          );
        }

        return loadAudit();
      })
      .catch(function (error) {
        setOutput(out, "Checks failed: " + String(error.message || error), "error");
      })
      .then(function () {
        withButtonsDisabled(false);
      });
  }

  /** Read-only: the most recent commits that touched the switch file. */
  function loadAudit() {
    var list = $("auditList");
    var out = $("auditOut");
    clearOutput(out);

    return api(
      "GET",
      "/repos/" +
        OWNER +
        "/" +
        REPO +
        "/commits?path=" +
        encodeURIComponent(STATE_PATH) +
        "&per_page=5"
    )
      .then(function (result) {
        if (!result.ok) {
          throw new Error(describeError(result));
        }
        var commits = result.data || [];
        list.textContent = "";
        if (!commits.length) {
          var empty = document.createElement("li");
          empty.textContent = "No commits touch this file yet.";
          list.appendChild(empty);
          return;
        }
        // Built with textContent throughout: commit messages are not trusted markup.
        commits.forEach(function (entry) {
          var item = document.createElement("li");
          var title = document.createElement("strong");
          title.textContent =
            entry.commit && entry.commit.message
              ? entry.commit.message.split("\n")[0]
              : "(no message)";
          var meta = document.createElement("div");
          meta.className = "admin-note";
          var date = entry.commit && entry.commit.author ? entry.commit.author.date : "";
          var who = entry.author && entry.author.login ? entry.author.login : "unknown";
          meta.textContent =
            (entry.sha || "").slice(0, 7) +
            " by " +
            who +
            (date ? " - " + new Date(date).toLocaleString() : "");
          item.appendChild(title);
          item.appendChild(meta);
          list.appendChild(item);
        });
      })
      .catch(function (error) {
        setOutput(out, "Could not load the audit trail: " + String(error.message || error), "error");
      });
  }

  // -------------------------------------------------------------- behaviour
  function withButtonsDisabled(disabled) {
    ["enableBtn", "disableBtn", "tokenCheck", "stateRefresh", "checksRun"].forEach(function (id) {
      $(id).disabled = disabled;
    });
  }

  function runAction(isActive) {
    var out = $("actionOut");
    clearOutput(out);
    withButtonsDisabled(true);

    var state = currentFormState(isActive);
    var commitMessage = isActive
      ? "Enable maintenance mode until " + state.until + (state.by ? " (by " + state.by + ")" : "")
      : "End maintenance mode" + (state.by ? " (by " + state.by + ")" : "");

    var notes = [];

    // Pre-flight only when switching maintenance ON. Sending every visitor to a page
    // that does not exist is the one failure worth refusing outright; a guard that is
    // simply not deployed yet only deserves a warning, since an admin may be about to
    // deploy it.
    var ready = isActive
      ? runPreflight().then(function (pre) {
          if (!pre.pageOk) {
            throw new Error(
              "nope.html is not reachable from this origin, so visitors would be sent to a " +
                "missing page. Nothing was committed."
            );
          }
          if (!pre.guardOk) {
            notes.push(
              "Note: the maintenance guard is not reachable from this origin, so this may have " +
                "no effect until it is deployed."
            );
          }
        })
      : Promise.resolve();

    setOutput(out, "Committing " + STATE_PATH + " to " + BRANCH + "...");

    ready
      .then(function () {
        return writeStateFile(state, commitMessage);
      })
      .then(function (data) {
        var sha = data.commit && data.commit.sha ? data.commit.sha.slice(0, 7) : "?";
        var lines = [];
        lines.push("Committed " + sha + " to " + BRANCH + ".");
        lines.push(
          isActive
            ? "Maintenance is ON until " + formatInstant(state.until) + "."
            : "Maintenance is OFF."
        );
        lines.push(
          "GitHub Pages rebuilds in about a minute, and browsers may hold the old file a"
        );
        lines.push('little longer. Press "Run checks" to see when it goes live.');
        setOutput(out, notes.concat(lines).join("\n"), "ok");
        return refreshStatus(false);
      })
      .catch(function (error) {
        setOutput(out, "Failed: " + String(error.message || error), "error");
      })
      .then(function () {
        withButtonsDisabled(false);
      });
  }

  function checkToken() {
    var out = $("tokenOut");
    clearOutput(out);

    var typed = $("tokenInput").value.trim();
    if (typed) {
      var problem = tokenProblem(typed);
      if (problem) {
        setOutput(out, problem, "error");
        return;
      }
      storeToken(typed, $("tokenKeep").checked);
      // Do not leave the secret sitting in the DOM.
      $("tokenInput").value = "";
    }

    if (!getToken()) {
      setOutput(out, "No token is stored. Paste one above, then press 'Check access'.", "error");
      return;
    }

    withButtonsDisabled(true);
    setOutput(out, "Checking the token against api.github.com...");

    api("GET", "/user")
      .then(function (user) {
        if (!user.ok) {
          throw new Error(describeError(user));
        }
        return api("GET", "/repos/" + OWNER + "/" + REPO).then(function (repo) {
          if (!repo.ok) {
            throw new Error(describeError(repo));
          }
          var canPush = !!(repo.data.permissions && repo.data.permissions.push);
          var lines = [
            "Signed in as " + user.data.login + ".",
            "Repository: " + repo.data.full_name + " (default branch " + repo.data.default_branch + ").",
            canPush
              ? "Write access confirmed -- you can switch maintenance."
              : "WARNING: no write access on this repository, so commits will fail.",
          ];
          if (repo.data.default_branch !== BRANCH) {
            lines.push(
              "NOTE: this tool commits to '" + BRANCH + "', which is not the default branch."
            );
          }
          setOutput(out, lines.join("\n"), canPush ? "ok" : "error");
          if (!$("byInput").value.trim()) {
            $("byInput").value = user.data.login;
          }
          return refreshStatus(false);
        });
      })
      .catch(function (error) {
        setOutput(out, String(error.message || error), "error");
      })
      .then(function () {
        withButtonsDisabled(false);
      });
  }

  // ------------------------------------------------------------------- init
  function init() {
    // GitHub Pages cannot send a frame-ancestors header and meta CSP ignores it,
    // so refuse to operate inside a frame. This blocks clickjacking the toggle.
    if (window.top !== window.self) {
      document.body.textContent = "This administration page cannot be embedded in a frame.";
      return;
    }

    $("scheduleText").textContent =
      "Every " +
      WEEKDAY_NAMES[4] +
      ", 08:00-09:00 UTC+8 (always on, independent of this switch).";

    // Never prefill the field: that would place the secret in the DOM on every load.
    if (getToken()) {
      setOutput(
        $("tokenOut"),
        "A token is stored for this origin. Press 'Check access' to validate it."
      );
    }

    $("tokenSave").addEventListener("click", function () {
      var typed = $("tokenInput").value.trim();
      var problem = tokenProblem(typed);
      if (problem) {
        setOutput($("tokenOut"), problem, "error");
        return;
      }
      storeToken(typed, $("tokenKeep").checked);
      $("tokenInput").value = "";
      setOutput(
        $("tokenOut"),
        $("tokenKeep").checked
          ? "Token saved on this device; it will be discarded automatically after " +
              Math.round(MAX_TOKEN_AGE_MS / 3600000) +
              " hours."
          : "Token saved for this tab only; it is discarded when the tab closes.",
        "ok"
      );
    });

    $("tokenClear").addEventListener("click", function () {
      clearStoredToken();
      $("tokenInput").value = "";
      setOutput($("tokenOut"), "Token removed from this browser.", "ok");
      refreshStatus(false);
    });

    $("tokenCheck").addEventListener("click", checkToken);
    $("stateRefresh").addEventListener("click", function () {
      refreshStatus(true);
    });
    $("stateToggleRaw").addEventListener("click", function () {
      var wrap = $("stateRawWrap");
      wrap.hidden = !wrap.hidden;
      $("stateToggleRaw").textContent = wrap.hidden ? "Show raw file" : "Hide raw file";
    });

    $("durationSelect").addEventListener("change", function () {
      $("customMinutesWrap").hidden = $("durationSelect").value !== "custom";
      updatePreview();
    });
    ["customMinutes", "messageInput"].forEach(function (id) {
      $(id).addEventListener("input", updatePreview);
    });

    $("enableBtn").addEventListener("click", function () {
      runAction(true);
    });
    $("disableBtn").addEventListener("click", function () {
      runAction(false);
    });

    $("checkWindow").textContent =
      describeWindow(WINDOW) + " - next: " + nextWindowStart(new Date()).toLocaleString();
    $("checkOrigin").textContent =
      "Reachability checks run against " +
      window.location.origin +
      ", so they describe wherever this page is being served from.";
    $("checksRun").addEventListener("click", function () {
      runChecks();
    });

    updatePreview();
    refreshStatus(false);
    runChecks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
