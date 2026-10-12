/*
 * Scheduled maintenance window.
 *
 * This site is hosted on GitHub Pages, which is static: there is no server-side
 * code that could return a real HTTP 503 or take the site down by itself. This
 * script is therefore the whole mechanism. It is loaded in <head> WITHOUT defer,
 * so it runs before the page body is parsed and a visitor inside the window is
 * sent to the maintenance page before any content is painted.
 *
 * Known limitations, by design:
 *   - Visitors with JavaScript disabled are not redirected.
 *   - Crawlers that do not execute JavaScript still see the normal pages.
 *   - A page already in the browser cache may still be served from cache.
 *
 * To reschedule, edit the four constants below. Hours are UTC+8.
 */
(function (global) {
  "use strict";

  var WINDOW_WEEKDAY = 4; // 0 = Sunday, 1 = Monday, ... 4 = Thursday
  var WINDOW_START_HOUR = 8; // 08:00 UTC+8
  var WINDOW_END_HOUR = 9; // 09:00 UTC+8 (exclusive)
  var WINDOW_UTC_OFFSET = 8; // UTC+8, i.e. Asia/Shanghai
  var MAINTENANCE_PAGE = "nope.html";

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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      isMaintenanceWindow: isMaintenanceWindow,
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

  // Never bounce the maintenance page onto itself.
  if (/nope\.html$/i.test(window.location.pathname)) {
    return;
  }

  if (!isMaintenanceWindow(new Date())) {
    return;
  }

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

  window.location.replace(base + MAINTENANCE_PAGE);
})(typeof globalThis !== "undefined" ? globalThis : this);
