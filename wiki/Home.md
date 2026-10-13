# BEUFK's website

The personal website of **BEUFK**, published with GitHub Pages at
<https://unknownpioneer.github.io>.

It is plain HTML with a thin Jekyll layer on top — no build step to run, no
dependencies to install. Edit a file, push to `main`, and GitHub Pages republishes
the site.

---

| | |
| --- | --- |
| **Published at** | <https://unknownpioneer.github.io> |
| **Source** | <https://github.com/unknownpioneer/unknownpioneer.github.io> |
| **Hosting** | GitHub Pages, published from `main` |
| **Build** | None locally — Jekyll runs on GitHub |
| **Stylesheet** | `assets/css/site.css`, one sheet for every page |
| **Contact** | scratchwiki@outlook.com |
| **Licence** | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |

> **Status note:** the maintenance system and admin tool described below are on the
> `szu-intranet-link` branch and are **not merged into `main` yet**, so they are not
> live. Delete this note once they are.

---

## Repository map

| Path | What it is |
| --- | --- |
| `index.html` | Landing page |
| `pages/` | `about.html`, `blog.html`, `downloads.html` |
| `record.html` | The archive / daily record, shown in the nav as "Archive" |
| `blog/` | Standalone copies of the older articles (`article_*.html`) |
| `_posts/` | Markdown posts, rendered through `_layouts/post.html` |
| `_layouts/` | The Jekyll post layout |
| `assets/css/site.css` | The one stylesheet |
| `assets/js/` | `site.js`, plus the maintenance guard, switch and admin tool |
| `image/`, `disk/` | Media and downloadable files |
| `admin.html` | Maintenance admin tool (unlisted) |
| `nope.html` | The maintenance page visitors get sent to |
| `403.html` | "JavaScript is switched off" explainer (unlisted) |
| `acknowledgement.html`, `personality.html`, `statistics.html` | Older pages, not in the nav |
| `download.html` | Redirect stub to `pages/downloads.html` |
| `robots.txt`, `sitemap.xml`, `BingSiteAuth.xml` | Crawler and verification files |
| `README.md`, `SECURITY.md` | The two documents this wiki summarises |

## Pages

**In the navigation:** Home (`index.html`), About, Blog, Downloads, Archive.

**Articles** come in two forms, and they are maintained separately:

- `_posts/*.md` — Markdown with front matter, rendered by Jekyll. `pages/blog.html`
  lists them automatically from `site.posts`.
- `blog/article_*.html` — hand-maintained HTML copies of the older articles. These
  are **not** generated from `_posts/`.

**Unlisted but public:** `admin.html` (the admin tool), `nope.html` (maintenance),
`download.html` (a redirect kept for old links).

## How a page is put together

Every content page has the same skeleton:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="assets/css/site.css" />
  <script src="assets/js/maintenance-state.js"></script>
  <script src="assets/js/maintenance.js"></script>
  <script src="assets/js/site.js" defer></script>
</head>
<body>
  <noscript>…the JavaScript notice…</noscript>
  <header class="site-header">…brand + top-nav…</header>
  <main class="container page-main">
    <section class="page-card">…page content…</section>
  </main>
  <footer class="site-footer">…links…</footer>
</body>
```

The two maintenance scripts sit in `<head>` **without `defer`** on purpose: they must
run before the body is parsed so a visitor who should be blocked is redirected before
anything is painted. `maintenance-state.js` must come first — it defines the flag that
`maintenance.js` reads.

## Maintenance mode

Two independent things can take the site offline, and `assets/js/maintenance.js` is
the whole mechanism for both:

1. **The weekly window** — every Thursday, 08:00–09:00 UTC+8. The constants are at the
   top of `maintenance.js`. Evaluated in UTC+8 whatever time zone the visitor is in.
2. **The manual override** — switched on through the admin tool with a duration, after
   which it lapses by itself. No scheduler is involved; the guard compares the end time
   against the clock on each page load.

Both send visitors to `nope.html`, which shows a countdown and, for a manual override,
the message and name saved by the admin.

**Two pages are deliberately exempt:** `admin.html`, so an admin can always reach the
tool to switch the site back on, and `nope.html`, so the maintenance page cannot
redirect to itself.

### Limitations — please read before relying on this

Maintenance mode is a **courtesy curtain, not a security control**:

- GitHub Pages is static, so there is no server-side enforcement, and the maintenance
  page returns **HTTP 200**, not 503.
- Visitors with JavaScript disabled, and crawlers that do not execute JavaScript, are
  **not** redirected.
- **Nothing is hidden.** The repository and the site stay public regardless.
- Propagation is not instant: a commit needs about a minute to build, and GitHub Pages
  caches assets, so allow roughly ten minutes to reach everyone.

## Using the admin tool

1. Create a **fine-grained personal access token** scoped to this repository only, with
   **Contents: Read and write**. Short expiry.
2. Open `/admin.html`, paste the token, press **Check access**. It reports your login
   and confirms write access.
3. Choose a duration, optionally add a message and your name, then press
   **Enable maintenance**. **End maintenance now** reverses it.

The tool commits `assets/js/maintenance-state.js` straight to `main` through the GitHub
Contents API, so **the maintenance guard must be deployed on `main`** for the switch to
have any effect.

### How the token is handled

- Kept in `sessionStorage`, so it dies with the tab — `localStorage` only on explicit
  opt-in, and discarded after 12 hours even then.
- Never prefilled back into the input, and cleared the moment it is submitted.
- Shape-validated before anything is stored.
- Sent only to `api.github.com`, and never written into the repository.
- **Forget token** wipes it from both stores.

The page is additionally served with a strict `Content-Security-Policy`
(`default-src 'none'; connect-src 'self' https://api.github.com`), a `no-referrer`
policy, and refuses to run inside a frame. See
[SECURITY.md](https://github.com/unknownpioneer/unknownpioneer.github.io/blob/main/SECURITY.md)
for the full model and its limits.

### Read-only checks

Below the controls is a panel that reads without writing anything:

- whether the maintenance guard and `nope.html` are **reachable** from the origin
  serving the tool — enabling maintenance is **refused** when `nope.html` is missing,
  since that would send every visitor to a 404;
- whether the switch served to visitors **matches the branch**, which answers "has my
  change gone live yet?" instead of guessing at the propagation delay;
- the **next weekly window**, computed in UTC+8 and shown in your own time zone;
- the **recent commits** touching the switch file, which is the audit trail.

The tool also cross-checks the window constants against the guard it actually
fetches, so the copy in this page drifting out of step with `maintenance.js` is
reported rather than silently believed.

## The JavaScript policy

**The site works without JavaScript.** A collapsible notice appears on 19 pages telling
visitors that scripting is off and that everything still reads fine.

Exactly two things need it: the countdown on the maintenance page, and the admin tool.

This was not always so. Visitors were once refused access, and the announcement
`blog/article_enable_javascript.html` sold that policy; it now carries a dated update
note saying the requirement was dropped.

## Writing a post

Add a Markdown file to `_posts/` named `YYYY-MM-DD-slug.md`:

```yaml
---
layout: post
title: "Post title"
date: 2026-10-11
author: "BEUFK"
category: "Article"
---
```

`pages/blog.html` builds its list from `site.posts`, so new posts appear there
automatically and inherit the shared layout.

## Deploying

Push to `main`. GitHub Pages builds and publishes automatically.

To preview locally, serve the folder over HTTP — opening the files directly is not
enough for anything that calls the GitHub API:

```powershell
python -m http.server 8000
# then browse http://127.0.0.1:8000/
```

## Security

The short version:

- No credentials are stored in the repository or in any page.
- Authorization for the admin tool is enforced by GitHub, not by the page.
- Maintenance mode protects nothing — see the limitations above.
- Several standard defences (HSTS, `X-Frame-Options`, `nosniff`, COOP) are delivered as
  HTTP headers, which GitHub Pages cannot set.

Full details, including how to report a vulnerability, are in
[SECURITY.md](https://github.com/unknownpioneer/unknownpioneer.github.io/blob/main/SECURITY.md).

## Keeping this wiki honest

The repository is the source of truth. `README.md` and `SECURITY.md` live alongside the
code and are updated with it — if a change contradicts something written here, trust
those files and fix this page.
