/*
 * Manual maintenance switch.
 *
 * Written by admin.html through the GitHub Contents API, and read synchronously
 * by assets/js/maintenance.js in the <head> of every page. Do not rename it.
 *
 *   active  true = send visitors to the maintenance page
 *   until   ISO 8601 instant when maintenance ends, or null for no end
 *   message optional text shown on the maintenance page
 *   by      who switched it on
 *   updated when this file was last written
 */
window.SITE_MAINTENANCE = {
  active: false,
  until: null,
  message: "",
  by: "",
  updated: null
};
