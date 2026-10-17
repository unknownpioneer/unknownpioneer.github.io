/*
 * Shared site script, loaded with `defer` by every page.
 *
 * It does two small things:
 *   1. fills in the footer year and greets a returning visitor, and
 *   2. during July, shows a one-off seasonal popout with image/July.webp.
 *
 * The popout is deliberately not a separate file: this script is already on
 * every page, so one place controls the greeting and the page markup stays tidy.
 */
(function () {
  "use strict";

  var JULY_MONTH = 6; // Date#getMonth() is zero-based, so 6 is July.
  var JULY_IMAGE = "image/July.webp";
  var JULY_TEXT = "A special month for special you";
  var JULY_STORAGE_KEY = "july-popout-dismissed";
  var JULY_OPEN_DELAY = 600;
  // Utility pages where a greeting would only get in the way: nope.html is the
  // maintenance screen and admin.html is the maintenance switch. Same list as
  // maintenance.js uses to keep those pages reachable.
  var JULY_EXEMPT_PAGES = /^(nope|admin)\.html$/i;

  // Deferred scripts still have document.currentScript set while they execute.
  // Capture it now, because the popout is built later from DOMContentLoaded.
  var currentScript =
    document.currentScript ||
    document.querySelector('script[src$="assets/js/site.js"]');

  /**
   * Everything the popout needs lives next to assets/. Resolving it from this
   * script's own URL keeps the image path correct on the root pages, in
   * /pages/ and /blog/, and if the site ever moves to a subpath.
   *
   * @returns {string} URL prefix ending in a slash, or "" if it cannot be found
   */
  function siteBase() {
    var marker = "assets/js/site.js";
    var src = currentScript && currentScript.src;
    var index = src ? src.indexOf(marker) : -1;
    return index === -1 ? "" : src.slice(0, index);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  }

  function wasDismissed() {
    try {
      return window.sessionStorage.getItem(JULY_STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function rememberDismissed() {
    try {
      window.sessionStorage.setItem(JULY_STORAGE_KEY, "1");
    } catch (error) {
      // Storage can be unavailable (private mode, disabled cookies). The popout
      // still works, it just reappears on the next page.
    }
  }

  function isJuly(date) {
    return date.getMonth() === JULY_MONTH;
  }

  function pageName(pathname) {
    var parts = String(pathname || "").split("/");
    return parts[parts.length - 1] || "";
  }

  /**
   * Builds the dialog DOM and returns it together with a `show` function.
   * The text is set with textContent, never innerHTML, so it cannot inject markup.
   *
   * @returns {{ root: HTMLElement, show: Function }}
   */
  function buildJulyPopout() {
    var root = element("div", "july-popout");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "july-popout-title");

    var scrim = element("div", "july-popout-scrim");
    scrim.addEventListener("click", dismiss);

    var card = element("div", "july-popout-card");

    var close = element("button", "july-popout-close", "\u00d7");
    close.type = "button";
    close.setAttribute("aria-label", "Close the July greeting");
    close.addEventListener("click", dismiss);

    var figure = element("figure", "july-popout-figure");
    var image = element("img", "july-popout-image");
    image.src = siteBase() + JULY_IMAGE;
    image.alt =
      "Characters hugging under a sparkling rainbow while waving pride flags";
    image.width = 1000;
    image.height = 563;
    image.decoding = "async";
    figure.appendChild(image);

    var body = element("div", "july-popout-body");
    var title = element("h2", "july-popout-title", JULY_TEXT);
    title.id = "july-popout-title";
    body.appendChild(title);

    card.appendChild(close);
    card.appendChild(figure);
    card.appendChild(body);
    root.appendChild(scrim);
    root.appendChild(card);

    var isOpen = false;
    var hideTimer = 0;
    var lastFocused = document.activeElement;
    var previousOverflow = document.body.style.overflow;
    var previousPaddingRight = document.body.style.paddingRight;

    function focusableItems() {
      return Array.prototype.slice.call(
        card.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    }

    function onKeydown(event) {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      // Keep keyboard focus inside the dialog while it is open.
      var items = focusableItems();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function dismiss() {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      rememberDismissed();
      document.removeEventListener("keydown", onKeydown, true);
      root.classList.remove("is-open");
      root.classList.add("is-closing");
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;

      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function () {
        root.hidden = true;
        root.classList.remove("is-closing");
        if (lastFocused && lastFocused.focus && document.contains(lastFocused)) {
          lastFocused.focus();
        }
      }, 340);
    }

    function show() {
      if (isOpen) {
        return;
      }
      isOpen = true;
      lastFocused = document.activeElement;
      root.hidden = false;

      // Lock the page behind the dialog. Hiding the scrollbar would otherwise
      // shift the layout sideways, so make up the difference with padding.
      var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = scrollbarWidth + "px";
      }

      document.addEventListener("keydown", onKeydown, true);
      root.classList.add("is-open");
      close.focus();
    }

    return { root: root, show: show };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var yearNode = document.getElementById("year");
    if (yearNode) {
      yearNode.textContent = new Date().getFullYear();
    }

    var usernameCookie = document.cookie
      .split(";")
      .map(function (entry) {
        return entry.trim();
      })
      .find(function (entry) {
        return entry.startsWith("username=");
      });

    if (usernameCookie) {
      var username = decodeURIComponent(usernameCookie.split("=")[1]);
      var heroPanel = document.querySelector(".hero-panel");
      if (heroPanel && !heroPanel.querySelector(".welcome-tag")) {
        var badge = document.createElement("div");
        badge.className = "status-pill welcome-tag";
        badge.textContent = "Welcome back, " + username;
        heroPanel.prepend(badge);
      }
    }

    // The seasonal popout: July only, at most once per browser session so that
    // moving between pages does not reopen it, and never over a utility page.
    if (
      !isJuly(new Date()) ||
      wasDismissed() ||
      JULY_EXEMPT_PAGES.test(pageName(window.location.pathname))
    ) {
      return;
    }
    var popout = buildJulyPopout();
    document.body.appendChild(popout.root);
    window.setTimeout(popout.show, JULY_OPEN_DELAY);
  });
})();
