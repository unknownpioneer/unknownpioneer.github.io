# Security Policy

## Scope

This is a static website published with GitHub Pages. There is no server, no
database, and no user accounts, so most of the usual attack surface does not
exist here.

The single privileged component is the **maintenance admin tool**
(`admin.html` + `assets/js/admin.js`). It is described in detail below.

## Reporting a vulnerability

Email **scratchwiki@outlook.com**. Please do not open a public issue for anything
exploitable.

Include what you found, where, and the steps to reproduce it. You can expect an
initial acknowledgement within a few days; if the report is accepted I will say
what changed, and if it is declined I will explain why.

The correction of errors in the site's own content is welcome through the normal
issue tracker rather than this address.

## Supported versions

Not applicable. The site is deployed continuously from `main`; there are no
released versions and no back-porting. Whatever is on `main` is what is live.

## The admin tool

### How authorization works

Authorization is enforced by **GitHub**, not by the page. Operating the tool
requires a fine-grained personal access token that grants **Contents: Read and
write** on this repository, which only people with repository access can create.

There is deliberately **no password or shared secret anywhere in this
repository**, including in `admin.html` itself. A credential checked in
client-side JavaScript would be readable by anyone and would provide only the
appearance of access control.

Tokens are supplied by each admin individually and sent only to `api.github.com`.
They are never written into the repository. `admin.html` loads no third-party
scripts and is served with a strict `Content-Security-Policy`
(`default-src 'none'; script-src 'self'; connect-src https://api.github.com`), so
even a compromised page has no route to send a token anywhere except GitHub.

Storage is deliberately minimal:

- A token lives in `sessionStorage`, so it dies with the tab.
- Writing it to `localStorage` requires an explicit opt-in, and it is discarded
  after 12 hours even then, whether or not the tab is still open.
- It is never prefilled back into the input field, and the field is cleared the
  moment the token is submitted.
- The token's shape is validated before anything is stored, so a mistyped value is
  rejected rather than saved.
- The message and name fields are stripped of control characters and Unicode line
  separators before being written into the switch file.

### Things to be aware of

- A fine-grained token **cannot be limited to a single file**, only to a
  repository. Anyone holding one can write to any file in this repository, so
  grant access only to people who are trusted with the whole repository.
- Any script running on this origin can read `sessionStorage` and `localStorage`.
  Ticking the opt-in lengthens that window, so leave it off on a shared or
  untrusted machine and press **Forget token** when you are finished.
- Prefer short token expiries and revoke tokens when they are no longer needed.
- `frame-ancestors` cannot be applied on GitHub Pages (it is ignored in a meta
  policy), so `admin.js` refuses to run whenever the page is embedded in a frame.
  That blocks clickjacking the maintenance toggle.
- `admin.html` is publicly reachable. That is intentional and harmless — without a
  valid token it can do nothing — but it is excluded from search engines via a
  `noindex` meta tag and `robots.txt`.

### If a token leaks

Revoke it immediately under GitHub → *Settings → Developer settings → Personal
access tokens*, then review the repository's commit history and Actions log for
anything you did not make.

## Maintenance mode is not a security control

The maintenance guard is a **courtesy curtain**. It must not be relied on to
protect anything:

- It is client-side JavaScript. Anyone can bypass it by disabling JavaScript.
- GitHub Pages is static, so there is no server-side enforcement, and the
  maintenance page is returned with **HTTP 200**, not 503.
- Visitors with JavaScript disabled, and crawlers that do not execute JavaScript,
  are never redirected.
- **Nothing is hidden.** The repository and the published site remain public.
  Anyone can read the underlying files directly regardless of maintenance mode.

Two pages are exempt from the guard by design: `admin.html`, so an admin can
always switch the site back on, and `nope.html`, so the maintenance page cannot
redirect to itself.

## Protections GitHub Pages cannot provide

Several standard defences are delivered as HTTP response headers, and GitHub Pages
gives you no way to set them. They are listed here so that nobody assumes they are
in place:

| Header | Status |
| --- | --- |
| `Content-Security-Policy` | Applied to `admin.html` only, and via a `<meta>` tag. Not site-wide: the older pages use inline scripts and inline style attributes that a strict policy would break. |
| `X-Frame-Options` / `frame-ancestors` | Unavailable. Framing is refused in JavaScript, on the admin page only. |
| `Strict-Transport-Security` | Unavailable. HTTPS is still enforced for the domain by GitHub. |
| `X-Content-Type-Options: nosniff` | Unavailable. |
| `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` | Unavailable. |
| `Permissions-Policy` | Unavailable. |

If any of those become necessary, they require a host or proxy that can set
response headers — Cloudflare, Netlify, or similar — in front of the site.
