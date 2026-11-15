# Its day: the embed contract (lane ark-its-day, 2026-11-15)

"Its day" is the selected animal's activity log over a whole day: what the card would have said it was doing at every
moment, as bands, with its record lines on it. The web card has it (the clock button, `ark-its-day.tsx`). This is how
the native apps ask the embed (`public/ark/embed.html`) for it. Nothing new is stored or read from the server: a day is
worked out in the page from the same behaviour schedule and status function the card uses (`animal-status.ts`
`dayCursor`, built on `scheduleStatus`'s own pieces), which is a pure function of the shared clock and the animals' ids.

## Ask

```
{type: "ark:day", id, from, to, request?}
```

- `id`: the animal (usually the one `ark:selected` named).
- `from`, `to`: epoch milliseconds. The window is clamped to at most 24 hours, ending no later than now, and starting no
  more than 7 days and 24 hours back. Page a day at a time: `to = now - n * 86_400_000`, `from = to - 86_400_000`, n = 0…6.
- `request`: anything (a number, a string); echoed back so the host can match answers.
- A newer `ark:day` replaces one still being worked out (the older one gets no more answers).
- Sent before the scene is up, it is ignored: ask after `ark:ready`.

## Answer

```
{type: "ark:day", request, id, from, to, done, day}
```

`day` is `ArkAnimalDay` (`src/lib/ark-animal-status.ts`) plus `text`, or `null` when the animal is not in the scene or
not on the behaviour schedule (a micro or underground animal, a replay's stand-in):

```
{
  id, from, to,            // the clamped window (epoch ms)
  since,                   // worked out from here to `to`: the latest hours come first
  done,                    // true once the whole window is there
  segments: [{from, to, activity}],   // oldest first, back to back, each run of one activity key (ARK_ACTIVITIES)
  events:   [{id, source: "record", at, day, kind, other?, count?, via?}],  // its record lines in the window
  text: {
    activities: {<activity key>: "Grazing", ...},   // each key used, in the app's language (the card's words)
    events: [{id, at, kind, stamp, text}]           // each record line in words, stamped on the island clock
  }
}
```

- Answers come as it is worked out (`done: false`, about twice a second), then once with `done: true`. Draw what has
  come: `segments` cover `[since, to)`; `[from, since)` is still being worked out.
- `activity` keys and words are the card's (`ark.activity.*`); colour them as you like (the web groups: asleep,
  eating, drinking, moving, at rest, with others, on guard: see `TONE` in `ark-its-day.tsx`).
- Event kinds: `arrived`, `born`, `hatched`, `meal`, `young`, `laid`, `mated`: the record lines the scene was told of
  (the page's life story and the live log's events; at most the newest dozen an animal), and its arrival or birth.
- A segment's edges are on a 2-second grid of its slots; a day is typically several hundred to two thousand segments.
  Merge stretches shorter than a pixel when drawing.
- Island times: the island clock is UTC (`arkIslandTime`), as the card's.

## What it is (and is not)

- Truthful: every 2-second cell says what the card says at that moment (`scheduleStatus` with the trip the scene draws
  then): its slot's goal, a flight only while it is in the air, pair meetings (courting, sparring, grooming each other),
  what its pose plays (a preen, a call, a bathe, its nest), on its way to water, a zoo resident's feeding time, asleep.
  The tests check this at over a thousand sampled moments (`src/lib/ark-its-day.test.ts`).
- Not in it: encounter hunting's forays (the server's next hunt, known for now only); its meals are on its record.
- Cost: about 1 ms a slot on a desktop (a slot's trip is a placed, path-searched plan), 1,080 slots a day; the scene
  works it a few milliseconds a frame (4 ms while the view moves, 8 ms at rest), so a whole day is a second or two on a
  desktop and several on a phone, its latest hours first. A re-wiring of the schedules (a new snapshot) starts it again.

## Words

New `ark.card` keys in every Ark locale: `itsDay`, `dayLast`, `dayEarlier`, `dayLater`, `dayNow`, `dayWorking`,
`dayRecord`, `dayNone`, `dayClose`, `dayHint` (English in `ARK_CARD_ENGLISH`).
