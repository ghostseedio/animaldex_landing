# Replay: a recorded event at its own time (V2)

AnimalDex `docs/ark/audits/ecosystem-audit-2026-11-18.md` §2.4 and §5 P0-7; owner decision 389.

The recorder can film one event of the Ark's record at the moment it happened:

```
npm run ark:clip -- --replay list            # the newest replayable events (id, kind, time, species)
npm run ark:clip -- --replay 17873           # that event: /ark?record=1&replay=17873
npm run ark:clip -- --replay 17873 --mount show --night-gain 3
```

It pins the Ark's clock to the event's time, brings in everyone the event names (a stand-in for whoever is gone now),
pins them so they are always drawn, feeds the scene's own live layers the record, and keeps the camera on them.

Nothing here is loaded by `/ark` or the apps' embed. The scene (`index.ts`) has only a hook (`setCast`); everything in
this folder is loaded by whoever asks for it (the recording page, the harness, later V1's live acts).

## Rules

1. **The record decides.** A replay is an event row of `/api/ark/events`. Nothing here decides an outcome, picks a
   partner or moves a time.
2. **No look-ahead** (decision 389). Only an event already in the public log is replayed, and never one dated after
   now (`ArkReplayUnavailable: not_released`). Records of the animals come from rows at or before the event.
3. **No parallel acting.** The acts are the live layers' (`live-matings`, `live-births`, `live-deaths`, `live-meals`,
   `live-escapes`), the scene's own replay (`play`: a hatching) and entrance (`arrive`: a release), fed with the keys
   the live log gives them. The same record, key and act as a viewer watching then had.
4. **Species only** in the words: no bringer, no Voyager label, no user (as Ark Lite).

## Files

| File | What |
|---|---|
| `cast.ts` | Stand-ins and pins (the reusable part). Pure, tested in Node. |
| `event-replay.ts` | An event id + the log + the read → the replay's plan (time, cast, what the layers are fed). Pure. |
| `shot.ts` | The recorder's shot: the clock's pin and cuts, the cast, the feed, the framing. |
| `text.ts` | The replay in words (Ark Lite's fallback, the clip's captions) and its DOM card. |
| `event-log.ts` | Reads the public log through to now (a single read stops about a thousand rows in). |
| `harness-entry.ts` | Development's page for `scripts/ark-replay-shots.mjs`. |

Elsewhere: `director.ts` (runs a shot's frames), `src/lib/ark-clips/replay-shots.ts` (the clip's plan and captions),
`shared-clock.ts` (`pinArkClock`, `arkPinnedMs`), and the scene's hooks in `index.ts`:

| `ArkSceneHandle` | What |
|---|---|
| `setCast(cast \| null)` | The cast handed in or taken away; the roster is laid out again. |
| `liveActs()` | The live layers' acts and their times (their own `debug()`): when a pair meets, when a chase ends. |
| `clearLiveActs()` | Every live act let go: before a replay and after it. |
| `clearView(focus, distance, polar, azimuth, places)` | The scene's own rule for a view clear of hills and trunks (its replay's). |
| `setExposure(gain)` | The recorder's exposure. Nothing of the world changes. |
| `near-fade.ts` `setNearFadeReach(times)` | The near-camera fade reaching further (a module function, not on the handle). |
| `locate(id)` | Now also where an act poses an animal that is out of the picture, and an acted stand-in first; `shown`: drawn this frame. |

The scene's world clock (`worldMs`: schedules, the live layers, the island's light, the weather) follows `pinArkClock`.

## The cast: stand-ins and pins (for V1)

```ts
import {attachArkCast} from "@/ark-scene/replay/cast";   // a dynamic import() from the page

const cast = attachArkCast(handle);                       // one per scene; handle = ArkSceneHandle
cast.bring("mated:17873", [a, b]).apply();                // a, b: the event row's animals (ArkCastRecord)
// ... the act plays (handle.addMatings / addEscapes / setMeals / addBirths / addDeaths as usual) ...
cast.release("mated:17873").apply();                      // its stand-ins and pins go
cast.detach();                                            // the cast out of the scene altogether
```

- `bring(key, records, {marks?})` — everyone in `records` is **pinned**; whoever is not in the Ark's read gets a
  **stand-in** made from the record (`standInAnimal`: species, model, zone, slot, area, island, enclosure). The key is
  yours (use the act's key); the same key again replaces the group. `marks`: ids that get the soft "last of its kind"
  ring (`marks.ts` GroundRings, amber).
- `release(key)`, `clear()`, `detach()` — an id two groups name stays until both are released.
- `setAsOf(epochSeconds, arkDay?)` — a replay only: animals that came aboard after that moment are left out (unless
  the cast names them) and the roster's Ark day is the event's (the young are young). V1's live acts do not need it.
- `apply()` — hands the cast to the scene, which lays the roster out again. **Batch your changes and call it once**:
  a layout re-places only the stand-ins, but it re-runs herds, the live budget and the schedules' wiring.
- `report()` — `{pins, standIns, dropped}` for the roster last laid out.
- An `ArkCastRecord` is an `ArkEventAnimal` plus the public read's `island` and `enclosure`.
  `planArkEventReplay(...).cast[i].record` gives them decoded; `recordOfAboard` (in `event-replay.ts`) is the same for a
  living animal.

What a stand-in is: a normal roster animal. It is placed from its record (as a replay's departed are:
`placeAll(list, true)`), has its own day (its schedule is a pure function of the clock and its id), and is found by
every live layer through `entryById`, so a mating of a pair one of which has since died is acted like any other. It is
never counted (the counts are the server's), never "mine", shows no bringer.

What a pin does: the id is in `selectionPins` (never folded into a herd's figure, always in the live budget's
"outside" set: 200 on the low tier) and in the frame's `pinnedNow` (never skipped past the render distance: 440 m on
the low tier). It does not override the layer rules (a burrowed animal under ground, the deep seen from above).

What is not done for you: an animal whose place was given to another since stands at the same spot as the newcomer
(they have different days, and the collisions pass keeps them apart); a pair on two islands, or in a tank, is still
skipped by `live-matings` itself.

## The plan

```ts
const replay = planArkEventReplay(eventId, rawEvents, snapshot, {now: Date.now()});
// {kind, t0, at, arkDay, species, cast: [{role, record, aboard}], marks, feed, provisional, causeEventId, notes}
```

| Event row | Replay | Cast | Fed to |
|---|---|---|---|
| `mated` | `mated` | the pair | `addMatings` (`mated:<id>`) |
| `birth` (live) | `birth` | parents, the whole litter | `addBirths` (`birth:<at>:<parents>`) |
| `birth` (`from_egg`) | `birth` | parents, the clutch's young | `play` (the hatching act) |
| `death_old`, `starved` | `death` | the animal | `addDeaths` (`death:<id>`) |
| `extinction` | `extinct` | the last animal (and its hunter) from the death or meal that ended the kind | that row's feed |
| `meal` | `meal` | hunter, prey | `setMeals` (time: the encounter's step) |
| `escaped` | `escaped` | prey, hunter | `addEscapes` (`escaped:<id>`) |
| `last_stand` | `last_stand` | the last one, a hunter when the row names one | nothing (their own day) |
| `released` | `released` | the animal at its wild home | `hold` + `arrive` |

`last_stand` and `released` are **not written by the server yet** (the audit's P0-4 and P1-8). Their rows here are
provisional (`replay.provisional`): `{kind: "last_stand", animal, other?}` and `{kind: "released", animal, payload:
{from: <its zoo record>}}`. When the server writes them, match `KIND_OF` and these two cases to its shape.

A parent with no record in the log given and not aboard is left out and said in `notes`, never invented.

## The shot

`createArkReplayShot({handle, replay, aspect, lead, mount?, asOf?})` → `begin()`, `settle()`, `step(t, dt)`,
`doneAt()`, `actAt()`, `report()`, `end()`. The director calls them; `report()` says who stood in, the cuts, whether
the scene's layer acted it (and why not), the clip second of the act's telling moment (`keyAt`: a still's frame), and
how many of the act's frames each of the cast was drawn in.

- **The clock.** `pinArkClock(t0 - lead)`: the scene's world time (schedules, the layers, the island's light) follows
  the pin. A cut is the pin moved on. Before the first frame the scene settles for a few seconds of frames nobody
  sees, all before the shot's start (`REPLAY_SETTLE_SECONDS`).
- **The light** is the island's at that moment. Half the record happens at night, and a forest floor at night is
  nearly black: `--night-gain 3` raises the camera's exposure with the night (only the camera: the hour and what the
  animals do stay the event's). `--hour` pins the hour instead (then the animals' day is that hour's too).
- **The frame.** The two farthest of the cast that are drawn, together, nearer than a tap's meeting distance, from
  as far back as holds them from where the camera is now (the selection's pair fit, `pair-frame.ts`, taken to any
  bearing). An upright picture (a phone's clip) holds two along its tall side, one nearer and one farther; a wide one,
  or two close together, side on. While two are still coming together and more than 14 m apart, one of them alone:
  the first of a pair, the hunter of a chase. The bearing is the scene's own clear one (`clearView`), kept until a
  tree has stood between for a few frames, then eased round to the nearest clear one; with none, the camera goes
  higher. A small animal and a body on the ground are filmed from well above (the plants round them are as tall as
  the camera is far).
- **Cuts.** A long walk to a mate and a long stalk are cut to their last seconds; a contest before a mating to its
  last bouts. An extinction's shot runs the body's last three minutes in four seconds while the camera pulls back.
- **The mount** is not filmed by default (the audit's editorial judgement): the camera pulls up and away, then the two
  resting together. `--mount show` films it.
- **Reads `handle.liveActs()`** (the layers' own `debug()`): when a pair meets, when a chase ends.
- **When the layer does not act it** (a pair in a tank or on two islands, a mother on the wing, a pair the scene cuts
  away from) the shot holds on the cast where they are and `report().acted` is false with the reason.

## Ark Lite

Devices with 2 GB or less have no 3D world. `arkReplayText(replay, words, locale)` gives the replay in words: the live
log's own sentence for the event (already translated), its time and Ark day, and a line for whoever is no longer
aboard. `renderArkReplayCard` draws it as plain DOM. `/ark?record=1&replay=<id>&lite=1` shows it. The few new words
(`ARK_REPLAY_ENGLISH`: "Replay", "The last {animal} in the wild", …) are English until `ark.replayEvent` carries them
in the Ark's 44 languages.

## Limits (flagged, not hidden)

- **Positions.** The event log stores no positions except a meal's or an escape's encounter. Everyone else is where
  their schedule has them at that moment, which is where a viewer saw them.
- **The world then.** `setAsOf` leaves out later arrivals; it does not bring back every animal that has died since
  (only the cast). Homes are spaced from predators as today's roster has them.
- **A dying act** does not exist yet (P1-3): a death is the fall onto its side (1.2 s), then the body.
- **What the layers do not act, a replay cannot either.** `live-matings` and `live-births` skip an animal with no day
  to walk from: an insect at its microhabitat, a flyer on the wing, a fish in a tank, a zoo animal held in its house.
  On 2026-11-18 every recorded event that names an animal gone since (375 deaths, 143 matings, 317 births) is an
  insect of 10 cm or less: their stand-ins stand, but the mating is not walked. (`__replay.gone` in the harness
  films a mating the layer does act with one of the two taken out of the read: the stand-in is walked and mounted.)
- **Water.** The camera does not go under the surface for a fish: an aquatic birth or mating is a picture of water.
- **Leaves and rocks.** `clearView` knows hills and tree trunks, not bushes or boulders. A shot stretches the scene's
  near-camera fade (`near-fade.ts` `setNearFadeReach`), so a crown the camera is in and the leaves before it dissolve;
  a bush the animal stands in still hides it.
- **An escape is a quarter of a second.** The lunge and the miss read in the clip more than in any one still, and
  least of all in the woods.
- **Night.** A forest floor at night stays dark at any exposure; `--hour` films the event by day.
- **A release** films the zoo, then the entrance at its wild home. The keeper's gate and the shore crate are P1-8.
- **The recorder's world.** The recording page now mounts the live wild island (v2), as `/ark` does. Before this, every
  recorder shot filmed the old island, and read only the oldest thousand rows of the last 30 days' log.

Found on the way, not fixed here (the scene's, for whoever builds on this):
- An animal kept across two reads keeps the day of its old home when its place changes (`setSnapshot` reuses the
  entry and its schedule): a released animal would go on living its zoo day until the page is loaded again (P1-8).
- `live-meals` hides the living animal behind its stand-in and never shows it again; a prey that a heart brought back
  stays hidden after its meal is acted. A replay's end calls `clearLiveActs`, which shows the cast again.
- The scene looks at its clock for the light every five seconds, and not at all during its own replay (`play`); a
  shot sets the light itself after each move of the clock.

## Testing

```
npx tsx --test src/lib/ark-replay.test.ts
node scripts/ark-replay-shots.mjs --data <dir with voyage.json + events.json> --out <dir>
```

The harness films recorded events from a saved read of the real Ark and its real public log (both hold usernames:
keep them out of the repository). `meal`, `escaped`, `last_stand` and `released` events are made by the page from
animals really aboard while production has none. Per event it saves a clip, a strip of eight frames, the still at the
shot's telling moment and, in `summary.json`, the shot's own account and the layer's. `--quality low` runs the low
tier (the 200-animal live budget, the 440 m render distance): the cast must still be drawn.
