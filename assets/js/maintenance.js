/*
 * Maintenance guard.
 *
 * This site is hosted on GitHub Pages, which is static: there is no server-side
 * code that could return a real HTTP 503 or take the site down by itself. This
 * script is therefore the whole mechanism. It is loaded in <head> WITHOUT defer,
 * so it runs before the page body is parsed and a visitor who should be blocked
 * is sent to the maintenance page before any content is painted.
 *
 * Two independent things can trigger it:
 *   1. the weekly window configured below, and
 *   2. window.SITE_MAINTENANCE, the manual switch written by admin.html and
 *      loaded from assets/js/maintenance-state.js -- that file must be included
 *      BEFORE this one, so the flag is already defined.
 *
 * Known limitations, by design:
 *   - Visitors with JavaScript disabled are not redirected.
 *   - Crawlers that do not execute JavaScript still see the normal pages.
 *   - A page already in the browser cache may still be served from cache, and
 *     GitHub Pages caches assets for a few minutes, so flipping the manual
 *     switch is not instantaneous for everyone.
 *
 * To reschedule the weekly window, edit the constants below. Hours are UTC+8.
 */
(function (global) {
  "use strict";

  var WINDOW_WEEKDAY = 4; // 0 = Sunday, 1 = Monday, ... 4 = Thursday
  var WINDOW_START_HOUR = 8; // 08:00 UTC+8
  var WINDOW_END_HOUR = 9; // 09:00 UTC+8 (exclusive)
  var WINDOW_UTC_OFFSET = 8; // UTC+8, i.e. Asia/Shanghai
  var MAINTENANCE_PAGE = "nope.html";
  // Pages that stay reachable while the site is in maintenance, so that an
  // admin can always switch it back off and the maintenance page cannot
  // redirect to itself.
  var EXEMPT_PAGES = /^(nope|admin)\.html$/i;

  /**
   * True when `date` falls inside the weekly maintenance window.
   * The window is always evaluated in UTC+8, whatever time zone the visitor is in.
   *
   * @param {Date} date
   * @param {number} [utcOffsetHours] offset to evaluate in; defaults to UTC+8
   * @returns {boolean}
   */
  function isMaintenanceWindow(date, utcOffsetHours) {
    var offset = utcOffsetHours === undefined ? WINDOW_UTC_OFFSET : utcOffsetHours;

    // Re-base the instant so its local getters report UTC+offset wall-clock time.
    var wall = new Date(
      date.getTime() + date.getTimezoneOffset() * 60000 + offset * 3600000
    );

    return (
      wall.getDay() === WINDOW_WEEKDAY &&
      wall.getHours() >= WINDOW_START_HOUR &&
      wall.getHours() < WINDOW_END_HOUR
    );
  }

  /**
   * The instant the current weekly window closes -- that same day at
   * WINDOW_END_HOUR in UTC+offset -- so the maintenance page can count down to it.
   * Only meaningful while isMaintenanceWindow() is true.
   *
   * @param {Date} date
   * @param {number} [utcOffsetHours] offset to evaluate in; defaults to UTC+8
   * @returns {Date}
   */
  function weeklyWindowEnd(date, utcOffsetHours) {
    var offset = utcOffsetHours === undefined ? WINDOW_UTC_OFFSET : utcOffsetHours;
    var tzMs = date.getTimezoneOffset() * 60000;

    // Re-base so local getters report UTC+offset wall time, take that day's
    // closing hour as a wall-clock Date, then shift back to a real instant.
    var wall = new Date(date.getTime() + tzMs + offset * 3600000);
    var endWall = new Date(
      wall.getFullYear(),
      wall.getMonth(),
      wall.getDate(),
      WINDOW_END_HOUR,
      0,
      0,
      0
    );

    return new Date(endWall.getTime() - tzMs - offset * 3600000);
  }

  /**
   * True when the manual switch is on and has not expired yet.
   * Expiry needs no scheduler: it is simply compared against the clock on load.
   *
   * @param {object} state contents of assets/js/maintenance-state.js
   * @param {Date} date
   * @returns {boolean}
   */
  function isOverrideActive(state, date) {
    if (!state || state.active !== true) {
      return false;
    }
    if (!state.until) {
      return true; // no end time: stays on until an admin switches it off
    }

    var until = Date.parse(state.until);
    // A malformed end time is treated as "still on". Silently cancelling
    // maintenance that an admin deliberately switched on would be worse.
    if (isNaN(until)) {
      return true;
    }

    return date.getTime() < until;
  }

  /**
   * True when visitors should be sent to the maintenance page, for either reason.
   */
  function shouldShowMaintenance(state, date, utcOffsetHours) {
    return (
      isMaintenanceWindow(date, utcOffsetHours) ||
      isOverrideActive(state, date)
    );
  }

  function basename(pathname) {
    var parts = String(pathname || "").split("/");
    return parts[parts.length - 1] || "";
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      isMaintenanceWindow: isMaintenanceWindow,
      isOverrideActive: isOverrideActive,
      shouldShowMaintenance: shouldShowMaintenance,
      weeklyWindowEnd: weeklyWindowEnd,
      WINDOW_WEEKDAY: WINDOW_WEEKDAY,
      WINDOW_START_HOUR: WINDOW_START_HOUR,
      WINDOW_END_HOUR: WINDOW_END_HOUR,
      WINDOW_UTC_OFFSET: WINDOW_UTC_OFFSET,
    };
  }

  // Nothing below this point applies outside a browser.
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  if (EXEMPT_PAGES.test(basename(window.location.pathname))) {
    return;
  }

  var now = new Date();
  if (!shouldShowMaintenance(global.SITE_MAINTENANCE, now)) {
    return;
  }
  var overrideOn = isOverrideActive(global.SITE_MAINTENANCE, now);

  // Resolve the maintenance page against the site root, so this single file works
  // from the root, from /pages/ and /blog/, and if the site ever moves to a subpath.
  var self = document.currentScript;
  if (!self) {
    var scripts = document.getElementsByTagName("script");
    self = scripts[scripts.length - 1];
  }

  var base = "";
  if (self && self.src) {
    base = self.src.replace(/assets\/js\/maintenance\.js.*$/, "");
  }

  // Tell the maintenance page why it is being shown and when the site should be
  // back, so it can render an accurate countdown. Display-only: the page accepts
  // only a fixed set of reason values and escapes everything it renders.
  var until = "";
  if (overrideOn) {
    until = (global.SITE_MAINTENANCE && global.SITE_MAINTENANCE.until) || "";
  } else {
    until = weeklyWindowEnd(now).toISOString();
  }

  var query =
    "?reason=" +
    (overrideOn ? "override" : "weekly") +
    (until ? "&until=" + encodeURIComponent(until) : "");

  window.location.replace(base + MAINTENANCE_PAGE + query);
})(typeof globalThis !== "undefined" ? globalThis : this);
