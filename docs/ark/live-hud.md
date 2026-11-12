# The live HUD: who is aboard and the on-screen log

Owner, 2026-11-11: "the hud, instead of showing only counts, can we show them as bars in relation to other
animals so we can see them increasing / decreasing in size in real time. also maybe a log on-screen to show
what's happening e.g. any animals getting eaten, any mating happening etc."

## Who is aboard: the population overlay (decision 239, 2026-11-12; /ark and the embed)
Owner, 2026-11-12: "much more minimal - and maybe overlaying the ark instead of a sidebar, it should represent
populations only in order of biggest first", "show population % changes in red and green ... like past 24 hours",
"the ark needs to be as fullscreen as possible", "make things compact".

- /ark: the world fills the screen under the site header (`h-[calc(100svh-4.0625rem)]`); the headline and the counts
  line are screen-reader only. Over the world, one grid (`ark-view.tsx`): the toolbar at the top start (the island
  switch, then Lighter view and Sound as icon switches with tooltips, `ark-world-tools.tsx`), the notices under it
  ("While you were away", a new arrival, sound credits, the age question, as glass toasts), and who is aboard
  (`ark-population-hud.tsx`) at the top end on a desktop, under the toolbar on a phone. The grid keeps 4 rem clear
  at the foot (the live log's chip, the reset button) plus the open card's height (`--ark-card-h`, set from the
  band's height in the band effect), so nothing over the world meets the card, the log or the reset button.
- The panel: "3,152 aboard" with the Ark's 24-hour change, "953 species · 647 founders", the island filter (the
  island shown | both islands) and "My animals" (signed in, with animals aboard), then every species biggest first
  (`arkRankedSpecies`, ties by name, breeds in their kind's row): icon, name, a thin bar against the biggest
  (log scale, `arkBarShare`, gliding as it changes), the 24-hour change, the count. About 12 rows in view
  (28 rem on a desktop, 46svh on a phone), the rest scroll inside. A row flies to one of its animals (a herd's
  card for a herd), as before; on a phone the panel folds when it does. With "My animals" on, the rows are the
  reader's own and say no change.
- Folded to a chip ("3,152 aboard ▲ +2% ▾"): folded at first on a phone, open on a desktop (CSS, so no flash), then
  as the reader leaves it (`ark.hud.open`, try/catch). `#ark-aboard` (the skip link, About's "See them over the
  Ark") opens it and focuses its heading.
- No region groups, pair statuses, "needs a mate" rows, pair ticks or region bars any more. `ark-live-bars.tsx` and
  `ark-my-animals.tsx` are gone; `lib/ark-live-bars.ts` keeps the scale.
- About: the long list by region is a folded "All 953 species aboard" (`<details>`), biggest first in columns,
  each linked to its species page (search, readers without WebGL), with a link up to the overlay.
- The embed (`?hud=1`, both apps pass it): the same panel in plain DOM (`live/bars-view.ts`) at the top start, under
  `--ark-inset-top`; always starts as the chip (nothing remembered in the apps' panel); the whole Ark (both
  islands, no island filter: the apps' panel is small); a row folds it and flies.

### The 24-hour change (`lib/ark-population-change.ts`)
- From the event log only (`/api/ark/events?since=`, `voyage_events_since_v1`; no table of its own): the count 24 h
  ago = the count now − animals that came aboard (`arrival`, `birth`) + animals that left (`eaten`, `death_old`,
  `starved`, and a `meal`'s `other`), each animal counted once (a meal and its `eaten` row are one departure), one
  that came and left inside the window counted as neither. Per species key and island (`[wild, town]`), so the
  island filter's rows get their own change; a departed breed counts in its kind's row when a look of it is aboard.
- Said as a percentage from 3 animals then ("+12%", "−25%", a tenth under 10%: "+0.4%", never "+0%"), as a count
  below 3 ("+1", "−2", a new species "+3"), nothing when the same. Green ▲ / red ▼, "{change} in the last 24 hours"
  as the tooltip and for a screen reader.
- Read once per page load, 1.5 s after the world is up (or 8 s after the page opened on a slow device), the window's
  start rounded down to 5 minutes; kept 5 minutes per device (`ark.hud.change`, try/catch; the page and the embed
  share it). The route pages up to 5 pages itself; with `more` the client reads once more from the last row. A
  window it cannot read whole (a burst of more rows in one minute than the route pages through, e.g. the 2026-11-11
  backfill's ~3,200 arrivals in 20:42-20:44 UTC) says no change at all, and that answer is kept for the 5 minutes.
- Cost (2026-11-12): a steady day is ~130 rows, ~100 KB, 0.3 s. A window holding the backfill: 1 MB per read,
  2-5 s, `more`, so nothing is said until it leaves the window (about 20:44 UTC on 2026-11-12).
- Tests: `src/lib/ark-population-change.test.ts`.

## Page weight and speed (decision 246, 2026-11-12)
The SEO audit (landing `seo-audit` 80ec7308, §3.9): mobile Lighthouse 49, LCP 4.7 s, TBT 1,061 ms; 5.2 MB of HTML, 4 MB
of it the whole live snapshot as RSC props; 1.9 MB of JS; TTFB 2-3 s (`force-dynamic`, a per-visitor read per request).

- **The Ark is read by the client** once the page has loaded (the poster painted) and the browser is idle
  (`/api/ark/voyage`, as the visitor, `mine` marked; public answers cached 30 s), never passed as props: its parse
  (~4 MB, thousands of animals) never holds up the first paint. The server hands `ArkView` only `lib/ark-page-summary.ts` (the counts
  and the islands' sizes) so the chip and the island switch paint at their real sizes. Development's modes
  (`?fixture=`, `?snapshot=`, `?record=1`) still hand the snapshot over.
- **No `force-dynamic`**: it also switched off Next's data cache. The server renders from `readPublicArk(60)`
  (anonymous, data cache with stale-while-revalidate, plus the in-process memo) for the metadata, About and the
  summary. The page stays dynamic for its query (`?focus=` share cards, `?lang=`), but its render is cheap. True ISR
  would need the page to stop reading its query.
- **The scene is out of the page's first JavaScript.** `ark-view.tsx`'s static imports pulled in three.js (through
  `placeholder.ts`), the species map and layers (`herds.ts`), the stats catalogue (`snapshot.ts` → `stats.ts`) and the
  sea's depth bands and the assets manifest (`behaviour-state.ts`): 1.47 MB minified. Now 0.12 MB: the light halves
  live in `placeholder-icon.ts`, `stat-keys.ts` and `behaviour-card.ts` (the heavy modules re-export them), and
  `herds.ts` is imported with the scene. Guarded by `src/lib/ark-page-weight.test.ts` (no three.js, no scene tables,
  under 200 KB).
- **A poster frame** (`public/ark/poster/wild-wide.webp` 1600×900, `wild-tall.webp` 780×1558, ~60 KB each, in the
  server's HTML, `fetchpriority=high`): a real render of the opening view, shown until the scene is up, then faded.
  The scene's code is fetched once the Ark is read and the browser is idle (`requestIdleCallback`, 1.5 s timeout).
  Re-render: dev server, `/ark?snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json&hour=10.5`, reduced
  motion, the world up plus 30 s, `__arkScene.setEnvironment({rain: 0, fog: 0, storm: 0, cloud: 0.18, wetness: 0,
  snow: 0, wind: 0.15})`, every overlay and scene label hidden, a screenshot of `section[aria-label="The Ark"]` at
  1600×965 (dpr 1) and 390×844 (dpr 2), then `cwebp -q 70 -m 6 -sharp_yuv` (66 for the tall one).
- **No long lists hydrated**: the overlay renders 40 rows at a time (more as its end scrolls in), the embed builds its
  rows only when first opened (48 at a time); About's list is server HTML in a folded `<details>`.

### Measured (2026-11-12)
Lighthouse 12.6.1, default simulated throttling, median of 3, on local production builds (`npm run build`,
`next start`) of the base (main 970b0461) and this branch, run back to back. Each Ark was the live one.

| `/ark` | Perf | FCP | LCP | TBT | Speed Index | TTFB | HTML (transfer / raw) |
|---|---|---|---|---|---|---|---|
| mobile, before | 46 (46-47) | 3.5 s | 5.5 s | 1,070 ms | 4.6 s | 1,990 ms | 528 KB / 5.24 MB |
| mobile, after | **68** (66-68) | **1.2 s** | 4.7 s | **610 ms** | **1.2 s** | **35 ms** | **70 KB / 0.34 MB** |
| desktop, before | 95 | 0.7 s | 1.4 s | 80 ms | 1.2 s | 1,408 ms | 528 KB |
| desktop, after | **99** | 0.3 s | 1.0 s | 42 ms | 0.4 s | 33 ms | 70 KB |

- The route's first-load JS (Next's build table) went from 528 kB to 143 kB.
- Accessibility, best practices and SEO were 100 locally. The audit's 82 for best practices on production comes from
  third parties.
- Phone width: the layout viewport went from 592 px to 360 and 390 px at those widths. Targets under 24 px went from
  942 and 1,049 to 4: the two skip links, the inline link and a short species name.
- What remains on mobile:
  - **LCP.** 4.7 s is Lighthouse's simulated figure; the observed LCP is the poster at 136 ms. Under the simulated
    1.6 Mbps link, the poster's request queues behind the site's JS and gtag (192 KB, on every page; audit §3.9).
  - **TBT.** It is mostly the live read's parse (one 543 ms task at 4x CPU) and the scene's start.
  - **Total weight is higher** (2.7 to 5.3 MB) because the live read (2.9 MB) and the scene now load inside
    Lighthouse's window instead of inline.
- Next steps: parse and decode the Ark in a worker, and load gtag after `load` (site-wide).

## The log (`src/ark-scene/live/`, the same DOM on /ark and in the embed)
- **The Ark's record** (solid lines, coloured dot): arrivals, births, hatchings, clutches laid, meals ("The African
  Lion ate a Plains Zebra"), deaths of old age, starvation, a kind gone. Read from `voyage_events_since_v1`
  (`/api/ark/events?since=`) only when a refreshed snapshot differs (animals or nests), so a quiet Ark costs no
  extra request. If that read is unavailable, the snapshot's newcomers stand in (arrivals and births only).
- **Seen** (lighter, dashed, eye icon, "Seen" tag, present tense): what the shared layers show in view within
  90 m of the camera right now: courtship displays and dances, rival contests (clash, fight, box), fishing catches
  of the ambient fish, nest building, alarm calls (the reactive layer). From `ArkSceneHandle.seen()`. Never a
  server fact, never a change in who is aboard.
- Rate: 4 lines at most, record lines 15 s, seen 9 s; repeats within 10 s fold ("3 House Sparrows came aboard",
  "×2"); a burst bigger than 6 keeps the rare kinds and ends in "+N more"; seen lines at most every 3.5 s, alarm
  lines at most every 20 s, a seen line that waited 7 s is dropped.
- Tap a line: its animal (`select`), else one of its kind (or its herd), else its region. The chip folds the log
  (remembered in `ark.live.folded`). While a card covers the foot of the world the log steps aside.
- Privacy: species names only. No bringer label, no person, no place.
- Words: `ark.live` (22 keys) in all 45 languages; the meal, deaths and clutches reuse `ark.replay`.

## Development
- `/ark?fixture=1&feed=1` (or `?fixture=live`): a made-up feed over the fixture, a beat every 8 s (arrival, birth,
  meal, clutch, group arrival, death, new kind, hatch, starved...), as `voyage_events_since_v1` rows
  (`lib/ark-live-fixture.ts`). `?fixture=grow` runs it by default (its arrivals from the rest of the fixture;
  `&feed=0` for the old growth). Never in production.
- Embed: `?hud=1` (log and bars), `?hud=log`, `?hud=bars`; default off, on with `?fixture=`. `?feed=1` runs the feed
  in a development bundle (`node scripts/build-ark-bundle.mjs --dev`), on by default with `?fixture=`:
  `/ark/embed.html?fixture=1`, `/ark/embed.html?snapshot=/ark-scale/population-1x.json&hud=1&feed=1`
  (copy `population-1x.json` from `scripts/ark-scale-fixture.mts` into `public/ark-scale/`, not committed).
- `?insetTop=<px>` / `?insetBottom=<px>` (whole px, 0 to 400): what the host draws over the world's top and foot (the
  iOS panel's close button and title: `insetTop=52`). The embed sets `--ark-inset-top` / `--ark-inset-bottom`; the
  sound button and the bars panel keep clear of the top one plus `env(safe-area-inset-top)`, the log and the reset
  button of the bottom one plus `env(safe-area-inset-bottom)` (both 0 on /ark). Test: `src/lib/ark-embed-insets.test.ts`.
- Both apps pass `hud=1` (iOS `ArkPanelViews.swift` `ArkEmbed.url` with `insetTop`, Android `ArkEmbed.kt`).

## Mating
The server writes one `kind: "mated"` event per pair that breeds (AnimalDex `ark-captures-thrive` 568af01b,
`docs/ark/captures-thrive-design.md` §0), just before its litter's `birth` rows or its clutch's `laid` row:
`animal` = the first parent, `other` = the second (each with `zone`, `thrive`, `area`), `parents: [uuid, uuid]`,
`bringers` (never said in the log), `species_profile_id`, `species`; the zone is `animal.zone`. The web reads it:
`"mated"` is in `ARK_EVENT_KINDS` (`lib/ark-life.ts`; the replay ignores it), the log says "Two Plains Zebras mated"
(record style, `ark.live.matedOne` / `matedOther` in all 45 languages) just before the young or eggs line, the
tap goes to the first parent, and the dev feed writes a `mated` row before every litter and clutch. A server that
sends only the species and the parents' ids still gets its line. A gap between mating and birth (gestation) would
be an ecology change.

## The arrival notice
The page's "new arrival" notice fires for arrivals only (`arkNewArrivals`), never for the young born aboard (they
were announced as arrivals on refresh before).
