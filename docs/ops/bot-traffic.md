# Bot traffic on animaldex.app (Nov 2026)

GA4 (30 days to 16 Nov 2026): 8,695 Direct sessions with one second of
engagement, 6,200 users from China and Singapore, `/account` (and `/id/account`)
the top landing page with no referrer. The signature, from the code:

- `/app/*` is protected: an anonymous hit is 307'd by `src/middleware.ts`
  (`redirectToAccount`) to `/account?next=/app/...`. A crawler that walks every
  link lands on `/account` with no Referer. `robots.txt` disallows `/app` but
  not `/account`, and `/account` is `Cache-Control: private, no-store`, so each
  hit is rendered on the origin.
- The sessions are "Direct" and one second long: a headless browser that loads
  the page (so GA fires) and leaves. The user agents in that bucket are
  headless/automation strings, empty strings, and Android WebView strings
  (`; wv)` in the UA) landing cold on `/account`.
- The sources are datacenter ranges in CN and SG (Alibaba, Tencent, Huawei
  Cloud, DigitalOcean SG, OVH SG), not residential ISPs.

Three layers, cheapest first.

## 1. In the code (done in this change set)

`src/lib/analytics-bot-gate.ts` + `src/components/analytics/google-analytics-loader.tsx`:
the GA tag is no longer loaded when, in the browser,

- `navigator.webdriver` is true (Selenium, Puppeteer, Playwright, ChromeDriver), or
- the user agent is empty, or
- the user agent names an automation tool or HTTP library (`HeadlessChrome`,
  `PhantomJS`, `Puppeteer`, `Playwright`, `Selenium`, `WebDriver`,
  `Chrome-Lighthouse`, `python-requests`, `aiohttp`, `Scrapy`, `curl/`, `Wget/`,
  `Go-http-client`, `okhttp`, `Java/`, `libwww-perl`, `Apache-HttpClient`,
  `node-fetch`, `undici`, `axios/`, or the standalone word `bot`/`crawler`/`spider`), or
- an Android WebView (`; wv)`) lands on `/account` or `/id/account` with an
  empty `document.referrer` and no Supabase session cookie.

Why this is conservative: every rule is something a real phone or desktop
browser never says about itself. There is no generic "bot" substring (it would
catch phone brands such as Cubot and the search engines GA already filters),
no geography, no ASN, no engagement heuristic. A person who opens the sign-in
page from one of our pages (Referer) or who already has a session is always
measured, and so is Chrome on Android (not a WebView). The test
`src/lib/analytics-bot-gate.test.ts` holds real iPhone, Android, desktop and
Cubot user agents as "always measured". The gate only decides whether GA
loads; it blocks nothing (that is the WAF's job below), and it cannot see
headless Chrome that spoofs a normal UA and hides `webdriver`, which is why the
network rules matter more.

## 2. Cloudflare WAF (for the founder to apply: Security → WAF → Custom rules)

Rule 1, "Challenge cold sign-in landings from datacenter countries" (action:
**Managed Challenge**):

```
(http.request.uri.path in {"/account" "/id/account" "/en/account"}
 and ip.geoip.country in {"CN" "SG" "HK"}
 and not http.referer contains "animaldex.app"
 and not http.cookie contains "-auth-token")
```

Rule 2, "Challenge automation user agents everywhere" (action: **Managed
Challenge**; Block if the challenge pass rate turns out to be ~0):

```
(http.user_agent eq ""
 or http.user_agent contains "HeadlessChrome"
 or http.user_agent contains "PhantomJS"
 or http.user_agent contains "python-requests"
 or http.user_agent contains "Go-http-client"
 or http.user_agent contains "okhttp"
 or http.user_agent contains "Scrapy"
 or http.user_agent contains "node-fetch"
 or http.user_agent contains "undici"
 or http.user_agent contains "axios/")
and not http.request.uri.path contains "/api/cron/"
and not http.request.uri.path contains "/api/webhooks/"
```

Rule 3, "Challenge WebView landings on sign-in" (action: **Managed Challenge**):

```
(http.request.uri.path in {"/account" "/id/account"}
 and http.user_agent contains "; wv)"
 and not http.referer contains "animaldex.app"
 and not http.cookie contains "-auth-token")
```

Rule 4, optional, datacenter ASNs on the sign-in page (action: Managed
Challenge). Fill the list from the WAF analytics "Top ASNs" for `/account`
over the last 7 days; the usual suspects are Alibaba 45102/37963, Tencent
132203/45090, Huawei Cloud 136907, DigitalOcean 14061, OVH 16276, Linode 63949,
Hetzner 24940:

```
(http.request.uri.path in {"/account" "/id/account"}
 and ip.geoip.asnum in {45102 37963 132203 45090 136907 14061 16276 63949 24940})
```

Also:

- Security → Bots → turn on **Bot Fight Mode** (free; challenges known
  headless signatures) if it is not already on. Super Bot Fight Mode's
  "Definitely automated → Block, Likely automated → Managed Challenge" is the
  Pro-plan version and would cover most of this without custom rules.
- Security → WAF → Rate limiting: `/account*` at 30 requests / 10 s per IP →
  Managed Challenge for 1 hour (the same path is `no-store`, so every hit is an
  origin render on the 2-vCPU VM).
- Never challenge `/api/cron/*` (the VM timers hit 127.0.0.1:3001 directly, but
  keep the exclusion), `/api/webhooks/*` (Zernio, Resend) or the OAuth
  callbacks under `/api/admin/social/callback/*`.
- Watch the "Managed Challenge solved" rate in WAF analytics for a week. A
  solve rate near 0 means the rule can become Block; a solve rate above ~20%
  means it is catching people and should be narrowed.

## 3. nginx equivalent on the VM (if Cloudflare is bypassed or as a second line)

The site's server block lives on the VM only (`scripts/install-nginx-zero-downtime.sh`
rewrites `proxy_pass` in it). Add to `/etc/nginx/conf.d/05-animaldex-bots.conf`
(the `http` context) and a `location` to the server block. Real client IPs:
Cloudflare's are restored from `CF-Connecting-IP`; without that, `$remote_addr`
is Cloudflare's edge and the rate limit would be useless.

```nginx
# http context ---------------------------------------------------------------
# Restore the visitor IP behind Cloudflare (list: https://www.cloudflare.com/ips/).
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

# 1 = automation or empty UA
map $http_user_agent $adx_automation_ua {
    default 0;
    "" 1;
    "~*HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|WebDriver|python-requests|python-urllib|aiohttp|Scrapy|^curl/|^Wget/|Go-http-client|okhttp|Java/[0-9]|libwww-perl|Apache-HttpClient|node-fetch|undici|axios/" 1;
}
# 1 = Android WebView
map $http_user_agent $adx_webview { default 0; "~;\s*wv\)" 1; }
# 1 = no referer from our own site
map $http_referer $adx_foreign_referer { default 1; "~animaldex\.app" 0; }
# 1 = a Supabase session cookie is present
map $http_cookie $adx_has_session { default 0; "~sb-[a-z0-9-]+-auth-token" 1; }
# Cloudflare's country header (set only when the request came through Cloudflare)
map $http_cf_ipcountry $adx_dc_country { default 0; CN 1; SG 1; HK 1; }

# A cold sign-in landing: WebView or datacenter country, no referer, no session.
map "$adx_webview$adx_dc_country$adx_foreign_referer$adx_has_session" $adx_cold_signin {
    default 0;
    "~^(1.|.1)10$" 1;
}

limit_req_zone $binary_remote_addr zone=adx_account:10m rate=3r/s;
```

```nginx
# inside the animaldex server block --------------------------------------------
location ~ ^/(?:id/|en/)?account/?$ {
    if ($adx_automation_ua) { return 403; }
    if ($adx_cold_signin)   { return 429; }   # or add a static interstitial; nginx has no challenge
    limit_req zone=adx_account burst=10 nodelay;
    proxy_pass http://animaldex_app;            # the upstream the zero-downtime installer wrote
    include /etc/nginx/snippets/animaldex-proxy-headers.conf;  # whatever the block already uses
}
```

Keep the existing `proxy_set_header` lines in that location (copy them from
the main `location /`); `nginx -t && systemctl reload nginx` after editing.
Log the hits before enforcing by swapping `return 403` for
`access_log /var/log/nginx/adx-bots.log combined;` for a day.

## 4. GA4 settings (Admin → Data streams → web → Configure tag settings)

Internal traffic (then Admin → Data settings → Data filters → set the
"Internal traffic" filter from Testing to **Active**):

- `traffic_type = internal`, IP equals: the production VM's external IP (the
  cron timers call 127.0.0.1, so they never reach GA, but the deploy warm-up
  curl does render pages), the founder's home/office IPs, and the GitHub
  Actions smoke test is UA-only so it needs no rule.
- A second internal rule for the Claude Chrome extension / local dev
  (`localhost` never reaches the prod property, but a `*.ngrok*` host does if
  one is ever used).

Unwanted referrals (Configure tag settings → List unwanted referrals), so an
OAuth or checkout round-trip does not start a new "referral" session:

- `accounts.google.com`
- `appleid.apple.com`
- `*.supabase.co`
- `*.paddle.com` and `checkout.paddle.com` (and `sandbox-*` while sandbox billing is on)
- `animaldex.app` and `www.animaldex.app` (self-referrals from the legacy `/en` redirects)
- `m.facebook.com`, `l.facebook.com`, `lm.facebook.com` only if FB login is ever added (not today)

Data filters → Developer traffic: Active (the dev server sets `debug_mode`
when `NEXT_PUBLIC_GA_DEBUG` is on; if it does not, skip this).

Reporting hygiene for the next comparison:

- Explore → segment "Country not in (CN, SG, HK) and Session default channel
  group != Direct with engagement time < 2 s" to read the real numbers until
  the WAF rules bite.
- Admin → Reporting identity: keep "Blended"; bot sessions have no user ID
  and inflate "Observed" users most.
- Admin → Data settings → Data collection → Granular location and device data
  collection: leave on; it is what showed the problem.

## What to expect

GA4's own known-bot filtering (IAB list) is already on by default and did not
catch this traffic, because it looks like a real browser. The client gate
removes the honest headless strings and the WebView landings (the WebView ones
are the bulk of the one-second `/account` sessions); the Cloudflare challenge
stops the rest at the edge and takes the origin renders off the VM. Numbers to
re-check a week after the rules: Direct sessions with <2 s engagement, users by
country, `/account` as landing page share, and the VM's `/account` request
rate in the nginx access log.
