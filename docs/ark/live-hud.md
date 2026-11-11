# The live HUD: population bars and the on-screen log (branch `ark-hud-live`)

Owner, 2026-11-11: "the hud, instead of showing only counts, can we show them as bars in relation to other
animals so we can see them increasing / decreasing in size in real time. also maybe a log on-screen to show
what's happening e.g. any animals getting eaten, any mating happening etc."

## Bars (/ark's "Aboard" column, and the embed)
- Each species: a bar under its name, against the biggest species of its region (`lib/ark-live-bars.ts`). Log scale
  with a round ceiling (5, 10, 20, 50, ...), so 1 and 300 are both readable and one more animal does not rescale
  every bar. Colour = pair status (needs a mate, a pair, more than a pair, crowded); a tick marks the pair line.
- Each region: a thin bar along its heading, against the biggest region.
- A change glides the bar (700 ms, none with reduced motion) and shows "▲+2" / "▼−1" by the count for 3.5 s.
- The numbers and the rows' accessible labels are unchanged (the bars are `aria-hidden`); the log is the
  screen reader's account of changes.
- Hooks: `ark-population-hud.tsx` (4 lines), components in `ark-live-bars.tsx`.

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
- The apps do not pass `hud` yet: showing it in the app panel is one query item (`hud=1` or `hud=log`) in
  `ArkPanelViews.swift` `ArkEmbed.url` and its Android twin, an owner decision.

## Mating (web ready; server lane adds the event)
The coordinator's call (2026-11-11): the server lane adds one `kind: "mated"` event per pair that breeds, in
`breeding()` (`_shared/ark-ecology/tick.ts`), written before its litter's `birth` rows or its clutch's `laid` row,
with `parents: [id, id]` in the payload, plus the kind in the `voyage_events` kind check. The web reads it now:
`"mated"` is in `ARK_EVENT_KINDS` (`lib/ark-life.ts`; the replay ignores it), the log says "Two Plains Zebras mated"
(record style, `ark.live.matedOne` / `matedOther` in all 45 languages) just before the young or eggs line, the
tap goes to the first parent, and the dev feed writes a `mated` row before every litter and clutch. A server that
sends only the species and the parents' ids still gets its line. A gap between mating and birth (gestation) would
be an ecology change.

## The arrival notice
The page's "new arrival" notice fires for arrivals only (`arkNewArrivals`), never for the young born aboard (they
were announced as arrivals on refresh before).
