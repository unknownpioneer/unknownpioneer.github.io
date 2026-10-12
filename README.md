# unknownpioneer.github.io

The personal website of **BEUFK**, published with GitHub Pages at
<https://unknownpioneer.github.io>.

Static HTML with a thin Jekyll layer on top. There is no build step to run and no
dependencies to install: edit a file, push to `main`, and GitHub Pages republishes
the site.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Landing page |
| `pages/` | `about.html`, `blog.html`, `downloads.html` |
| `record.html` | The archive / daily record, listed in the nav as "Archive" |
| `blog/` | Standalone copies of the older articles (`article_*.html`) |
| `_posts/` | Markdown posts, rendered through `_layouts/post.html` |
| `admin.html` + `assets/js/admin.js` | Maintenance admin tool (unlisted) |
| `nope.html` | The maintenance page visitors are sent to |
| `assets/css/site.css` | Current stylesheet |
| `assets/js/` | `site.js`, plus the maintenance guard and switch |
| `style.css` | Legacy stylesheet, still used by the older pages |
| `image/`, `font/`, `disk/` | Media and downloadable files |
| `403.html`, `acknowledgement.html`, `personality.html`, `statistics.html` | Older pages, not in the nav |

Two stylesheets coexist. Pages in the nav and in `blog/` use `assets/css/site.css`;
the older pages still use `style.css`. Migrating the remainder is ongoing.

`sitemap.xml` is hand-maintained and its `lastmod` dates are stale.

## Writing posts

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
automatically. The `blog/` directory holds separately maintained HTML copies of
older articles and is not generated from `_posts/`.

## Maintenance mode

The site can make itself unavailable in two independent ways:

1. **Weekly window** — every Thursday, 08:00–09:00 UTC+8, configured by the
   constants at the top of `assets/js/maintenance.js`.
2. **Manual override** — switched on through the admin tool, with a duration
   after which it lapses by itself.

Both send visitors to `nope.html`.

Guarded pages load two scripts **in this order**, and both must stay in `<head>`
without `defer` so nothing paints before the check runs:

```html
<script src="assets/js/maintenance-state.js"></script>
<script src="assets/js/maintenance.js"></script>
```

`maintenance-state.js` is the switch itself; `maintenance.js` reads it and applies
the weekly window. Expiry needs no scheduler — the guard compares `until` against
the clock on each page load.

`admin.html` and `nope.html` are deliberately exempt, so an admin can always reach
the tool to switch the site back on, and the maintenance page cannot redirect to
itself.

### Using the admin tool

1. Create a **fine-grained personal access token** scoped to this repository only,
   with **Contents: Read and write**.
2. Open `/admin.html`, paste the token, and press **Check access**. The token is
   kept in that browser's `localStorage`, is sent only to `api.github.com`, and is
   never written into the repository.
3. Choose a duration, optionally add a message and your name, then press
   **Enable maintenance**. The page commits `assets/js/maintenance-state.js`
   straight through the GitHub Contents API; **End maintenance now** reverses it.

The tool commits to `main`, so the maintenance guard must be deployed there for the
switch to have any effect.

### Limitations

Maintenance mode is a **courtesy curtain, not a security control**:

- GitHub Pages is static, so there is no server-side enforcement and the
  maintenance page is served with **HTTP 200**, not 503.
- Visitors with JavaScript disabled, and crawlers that do not execute JavaScript,
  are not redirected at all.
- Nothing is hidden. The repository and the site stay public; anyone can read the
  files directly or simply disable JavaScript.
- Propagation is not instant: a commit needs about a minute to build, and GitHub
  Pages caches assets, so allow roughly ten minutes to reach everyone.

## Deployment

Push to `main`. GitHub Pages builds and publishes automatically. To preview Jekyll
output locally you need a Ruby toolchain with the `github-pages` gem; plain HTML
edits need nothing.

## Security

See [SECURITY.md](SECURITY.md).

## Licence

Content is licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
