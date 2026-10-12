/*
 * Logic for admin.html -- the manual maintenance switch.
 *
 * Access control is GitHub's, not this page's. The user supplies a fine-grained
 * personal access token that must grant "Contents: Read and write" on this
 * repository. The token is kept in this browser's localStorage only, is sent to
 * api.github.com and nowhere else, and is never written into the repository.
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
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function storeToken(value) {
    try {
      if (value) {
        localStorage.setItem(TOKEN_KEY, value);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      /* storage unavailable (private mode): the token just will not persist */
    }
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
    var by = $("byInput").value.trim() || "admin";
    if (!isActive) {
      return { active: false, until: null, message: "", by: by, updated: now };
    }
    var minutes = selectedMinutes();
    var until = new Date(Date.now() + minutes * 60000).toISOString();
    return {
      active: true,
      until: until,
      message: $("messageInput").value.trim(),
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

  // -------------------------------------------------------------- behaviour
  function withButtonsDisabled(disabled) {
    ["enableBtn", "disableBtn", "tokenCheck", "stateRefresh"].forEach(function (id) {
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

    setOutput(out, "Committing " + STATE_PATH + " to " + BRANCH + "...");

    writeStateFile(state, commitMessage)
      .then(function (data) {
        var sha = data.commit && data.commit.sha ? data.commit.sha.slice(0, 7) : "?";
        setOutput(
          out,
          "Committed " +
            sha +
            " to " +
            BRANCH +
            ".\n" +
            (isActive
              ? "Maintenance is ON until " + formatInstant(state.until) + ".\n"
              : "Maintenance is OFF.\n") +
            "GitHub Pages rebuilds in about a minute, and browsers may hold the old\n" +
            "file for a few more minutes, so allow ~10 minutes to reach everyone.",
          "ok"
        );
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
    storeToken($("tokenInput").value.trim());
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
    $("scheduleText").textContent =
      "Every " +
      WEEKDAY_NAMES[4] +
      ", 08:00-09:00 UTC+8 (always on, independent of this switch).";

    $("tokenInput").value = getToken();
    if (getToken()) {
      setOutput($("tokenOut"), "A token is stored in this browser. Press 'Check access' to validate it.");
    }

    $("tokenSave").addEventListener("click", function () {
      storeToken($("tokenInput").value.trim());
      setOutput($("tokenOut"), "Token saved in this browser's localStorage.", "ok");
    });

    $("tokenClear").addEventListener("click", function () {
      storeToken("");
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

    updatePreview();
    refreshStatus(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
