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

Tokens are supplied by each admin individually, kept in that browser's
`localStorage`, and sent only to `api.github.com`. They are never written into the
repository, and `admin.html` loads no third-party scripts.

### Things to be aware of

- A fine-grained token **cannot be limited to a single file**, only to a
  repository. Anyone holding one can write to any file in this repository, so
  grant access only to people who are trusted with the whole repository.
- Prefer short token expiries and revoke tokens when they are no longer needed.
- `localStorage` is readable by any script running on this origin. On a shared or
  untrusted machine, press **Forget token** when you are finished.
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
