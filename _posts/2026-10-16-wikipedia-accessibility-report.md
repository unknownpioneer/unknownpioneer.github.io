---
layout: post
title: "Wikimedia Accessibility in SZU"
date: 2026-10-13
author: "BEUFK"
category: "Article"
---

# Wikipedia / Wikimedia Network Accessibility Report

**Date of test:** 2026-10-16, 22:55–23:12 (UTC+08:00)

**Host timezone:** China Standard Time (UTC+08:00)

**Hosts tested:** 19 Wikipedia / Wikimedia domains + 3 control hosts

**Scope:** DNS resolution, TCP connectivity, TLS, HTTP response

---

## 1. Summary

The Wikimedia estate is **split roughly in half** on this network.

| Category | Count |
| --- | --- |
| ❌ Blocked (DNS poisoned, unreachable) | 9 |
| ✅ Reachable (verified live over HTTP/HTTPS) | 10 |

Of the 10 reachable, one (`zh.wikisource.org`) returned different results on the two test paths — see §7.2.

**The headline finding:** `*.wikipedia.org` — the encyclopedia itself, in every language edition tested — is **not reachable**. It resolves to forged Facebook and Twitter IP addresses.

**The counter-intuitive finding:** most Wikimedia *infrastructure* and sister-project domains (`commons.wikimedia.org`, `wikidata.org`, `meta.wikimedia.org`, `en.wikiversity.org`, `zh.wikisource.org`) **are reachable** and serve live content.

This split does not correspond to any coherent "block Wikipedia, allow Wikimedia" policy. It appears to be an artifact of which hostnames happen to sit on a blocklist and how the resolver cached them — see §6.

---

## 2. TL;DR table

| Host | DNS answer | Reachable? |
| --- | --- | --- |
| `en.wikipedia.org` | `31.13.112.9` (Facebook) | ❌ TCP timeout |
| `zh.wikipedia.org` | `31.13.94.49` (Facebook) | ❌ TCP timeout |
| `www.wikipedia.org` | resolve failure | ❌ |
| `ja.wikipedia.org` | `199.16.158.12` (Twitter) | ❌ TCP timeout |
| `simple.wikipedia.org` | `31.13.94.37` (Facebook) | ❌ TCP timeout |
| `en.wiktionary.org` | poisoned | ❌ TCP timeout |
| `en.wikibooks.org` | poisoned | ❌ TCP timeout |
| `en.wikinews.org` | poisoned | ❌ TCP timeout |
| `commons.wikimedia.org` | genuine | ✅ HTTP 200 |
| `www.wikidata.org` | genuine | ✅ HTTP 200 |
| `meta.wikimedia.org` | genuine | ✅ HTTP 200 |
| `en.wikiversity.org` | genuine | ✅ HTTP 200 |
| `zh.wikisource.org` | genuine | ✅ HTTP 200 (via HTTPS only — see §5) |
| `wikimedia.org` | `103.102.166.224` | ✅ HTTP 301 → HTTPS |
| `upload.wikimedia.org` | `103.102.166.240` | ✅ HTTP 301 → HTTPS |
| `species.wikimedia.org` | genuine | ✅ HTTP 301 → HTTPS |
| `wikimediafoundation.org` | `192.0.66.2` | ✅ HTTP 301 → HTTPS |
| `w.wiki` | genuine | ✅ HTTP 301 → HTTPS |
| `wikipedia.org` (apex) | variable (Twitter/Facebook) | ❌ TCP timeout |
| `example.com` / `baidu.com` / `qq.com` | genuine | ✅ control hosts OK |

---

## 3. Methodology

The instruction was to "ping" these services. **ICMP ping is the wrong instrument** for web accessibility:

- Many hosts deprioritise or drop ICMP even when HTTPS works perfectly.
- A successful ping says nothing about whether TLS or HTTP will succeed.
- A failed ping does not distinguish DNS failure from routing failure from filtering.

So the test was staged in four layers, each of which isolates a different failure mode:

1. **DNS resolution** — `System.Net.Dns.GetHostAddresses()`, repeated 4–6× per host to detect answer instability.
2. **TCP connect** — asynchronous `TcpClient.BeginConnect()` on port 443, 10-second deadline, all hosts in parallel.
3. **TLS handshake** — `SslStream.AuthenticateAsClient()` with SNI.
4. **HTTP response** — raw port-80 `GET / HTTP/1.0` with explicit `Host:` header, plus HTTPS fetch via the harness path for final confirmation.

Control hosts (`baidu.com`, `qq.com`, `example.com`) were included throughout to separate *"the target is blocked"* from *"this environment cannot reach anything."*

---

## 4. Evidence: DNS poisoning

`*.wikipedia.org` resolves to addresses belonging to **Meta (Facebook)** and **X (Twitter)**, not to Wikimedia.

### Run A — six consecutive lookups

| Hostname | Answers returned (all six identical) | Observed owner |
| --- | --- | --- |
| `en.wikipedia.org` | `31.13.112.9` ×6 | Meta (Facebook) |
| `zh.wikipedia.org` | `31.13.94.49` ×6 | Meta (Facebook) |
| `wikipedia.org` | `31.13.94.49` ×6 | Meta (Facebook) |

### Run B — four consecutive lookups, minutes later

| Hostname | Lookup 1 | Lookup 2 | Lookup 3 | Lookup 4 |
| --- | --- | --- | --- | --- |
| `wikipedia.org` | FAIL | `31.13.68.169` | `31.13.68.169` | `31.13.68.169` |
| `en.wikipedia.org` | `199.59.148.229` | `31.13.106.4` | FAIL | FAIL |
| `zh.wikipedia.org` | `157.240.17.35` | `199.16.158.8` | FAIL | `199.59.148.229` |

The answer set is **not stable across runs** — the same hostname returns different forged addresses, and sometimes fails to resolve at all, within seconds of itself.

This instability is itself the signature: an injected response racing a legitimate one. What is consistent is the **outcome** — every answer observed was either a Meta/X address (`31.13.x`, `157.240.x`, `199.16.x`, `199.59.x`) or a resolution failure. **Not once** was a genuine Wikimedia address returned for a `*.wikipedia.org` query.

### Genuine Wikimedia ranges, for reference

- `198.35.26.96` — Wikipedia text load balancers
- `208.80.154.224` — Wikimedia
- `103.102.166.0/24` — Wikimedia
- `91.198.174.192` — Wikimedia

### Genuine answers did come back for other domains

```
commons.wikimedia.org  -> 208.80.154.224     (genuine)
wikimedia.org          -> 103.102.166.224    (genuine)
wikidata.org           -> 103.102.166.224    (genuine)
meta.wikimedia.org     -> 103.102.166.224    (genuine)
upload.wikimedia.org   -> 103.102.166.240    (genuine)
wikimediafoundation.org-> 192.0.66.2         (genuine)
baidu.com              -> 124.237.177.164, 110.242.74.102, ...   (genuine)
qq.com                 -> 123.150.76.218, 113.108.81.189, ...    (genuine)
example.com            -> 172.66.147.243, 104.20.23.154          (genuine)
```

---

## 5. Evidence: host-based connection reset

Direct-IP requests, **bypassing DNS entirely**, to known Wikimedia addresses on port 80:

```
198.35.26.96      FAIL: TCP connect timeout
91.198.174.192    FAIL: TCP connect timeout
208.80.154.224    FAIL: connection forcibly closed by the remote host   (RST)
103.102.166.224   FAIL: connection forcibly closed by the remote host   (RST)
```

All four of these requests carried `Host: en.wikipedia.org`.

### The decisive comparison

The same IP, port 80, two different `Host` headers:

| IP | `Host:` header | Outcome |
| --- | --- | --- |
| `208.80.154.224` | `en.wikipedia.org` | **connection forcibly reset (RST)** |
| `208.80.154.224` | `commons.wikimedia.org` | **HTTP/1.1 301 Moved Permanently**, `server: HAProxy`, `x-cache: cp5025 int` |

> Same server. Same port. Different outcome based purely on the hostname presented.

This proves the filtering operates on the **hostname**, not the IP address. The `HAProxy` / `x-cache: cp#### int` response headers are Wikimedia's own caching layer — that is a genuine Wikimedia server answering.

---

## 6. Why the split is probably an artifact

The blocked/allowed split does not follow the domain hierarchy:

- ✅ `en.wikiversity.org` — clean
- ❌ `en.wiktionary.org` — poisoned
- ❌ `en.wikibooks.org` — poisoned
- ✅ `zh.wikisource.org` — clean

All four are sister-project domains on the same infrastructure. Two are poisoned, two are not. This is consistent with a **per-hostname blocklist plus resolver caching**, not a suffix rule — and it means the set of blocked hosts can change between lookups and over time.

**Do not treat this report as a stable map.** It is a snapshot.

---

## 7. Limitations

These caveats materially affect how much weight to put on individual rows.

1. **The sandbox cannot perform TLS at all.**
   `SslStream.AuthenticateAsClient()` fails with *"No credentials are available in the security package"* — including against `baidu.com`. This is an environment restriction, not a network result. Therefore all HTTPS confirmations came from the harness's own fetch path, which is a **different network egress** from the sandboxed shell.

2. **The two paths disagreed once.**
   Sandbox raw TCP to `zh.wikisource.org:80` returned an RST, while the fetch path retrieved it successfully over HTTPS. Single-host edge cases should be treated as noisy; the broad pattern is well-supported.

3. **Network provenance is unverified.**
   The tests ran from *this machine*. Whether that is an SZU campus connection, a home connection, or a tethered link was not established. The DNS poisoning pattern is characteristic of mainland China network filtering, and the machine's timezone is UTC+08:00, but this was not independently confirmed.

4. **Reachability is dynamic.**
   Filtering of this class changes. A host reachable at 23:00 on 2026-10-16 may not be reachable later.

---

## 8. Appendix: session context

These accessibility tests arose from a discussion of Shenzhen University network policy. Relevant published policies, for reference:

| Document | Relevance |
| --- | --- |
| [深圳大学信息化建设管理办法（试行）](https://it.szu.edu.cn/info/1029/1982.htm) | Art. 37: Information Center retains user access logs and provides them to police / state security on request |
| [深圳大学校园网用户管理办法](https://www1.szu.edu.cn/nc/view.asp?id=282) | Art. 11: prohibits private routers, proxy services, NAT/DHCP, and installing anything that affects network monitoring |
| [深圳大学学生违纪处分办法（修订）](https://ce.szu.edu.cn/en/info/1218/2802.htm) | Art. 15: 登录非法网站 → 留校察看 or above; Art. 12: state penalty triggers school discipline |
| [SecureLink 校外访问系统](https://www1.szu.edu.cn/nc/view.asp?id=631) | SZU's authorized VPN — inbound access to campus systems only |

Underlying national framework: 《计算机信息网络国际联网管理暂行规定》 Art. 6 and Art. 14, as listed by the [Beijing Municipal Public Security Bureau](https://gaj.beijing.gov.cn/wsgs/zqxx/xzcfqd/202004/t20200403_1787296.html).

---

## 9. Conclusion

1. **Wikipedia itself is not reachable** on this network. `en.wikipedia.org`, `zh.wikipedia.org`, `ja.wikipedia.org`, `simple.wikipedia.org` and the apex `wikipedia.org` all resolve to forged Facebook/Twitter addresses and time out.
2. **Several Wikimedia sister projects and infrastructure domains are reachable** and serve genuine content, confirmed by reading live pages over HTTPS.
3. **The blocking mechanism is DNS poisoning combined with hostname-based connection resetting** — proven by the same-IP, two-`Host`-header experiment in §5.
4. **The blocked set is inconsistent** and should be expected to change.

This report is limited to **diagnosis only**. It contains no circumvention guidance.
