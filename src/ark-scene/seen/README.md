# Seen: hunting and mating you can see (V1)

AnimalDex `docs/ark/audits/ecosystem-audit-2026-11-18.md` §2.4 and §5 (P1-3); owner decision 389 (also 393–395).
Built on V2's replay (`../replay/README.md`): its stand-ins, pins and clear-view camera.

What a viewer of the live Ark gets:

| | Before | Now |
|---|---|---|
| A hunt | The record came minutes after the chase: only the feeding was seen. | The chase is **held** until the record is out, then acted for everyone at the same moment. |
| An escape | The same: only the limp. | Held the same way: the stalk, the rush, the miss. |
| A death | A body appeared; the 1.2 s fall was seen by nobody. | A **dying act**: it weakens on its feet, goes over onto its side, lies still, fades. No wound. |
| The two of an act | Acted only if both happened to be drawn; a mate or hunter gone since: not at all. | Everyone a record names is **brought in**: pinned, a stand-in for whoever has left the read. |
| A tap on its line | Flew to one animal (a mating: both, while near). | **Watches** the act: everyone it names held in one picture, a clear view, the night lifted. |
| An animal leaving | Vanished on the next read. | **Fades** where it stood. |
| The last of a kind | A log line. | Its ring, and the extinction's shot: its body, the camera drawing back over its home range. |
| Lone founders, crises | Nothing in the world. | "Lone" on its card and box; an open crisis's animals pinned, the last one ringed and named so. |

Nothing here is loaded by `/ark`'s first JavaScript. The live log (`../live/controller.ts`) loads `seen/` the first time
it has something for it: a record that is acted, a lone founder in the read, an open crisis.

## Rules

1. **The record decides.** Every act is a row of the public log. Nothing here decides an outcome or picks a partner.
2. **No look-ahead** (decision 389). Only rows the drip has released are ever given to `seen/`; a row dated after now is
   refused (`planArkEventReplay`). Acts are only ever *later* than their record, never earlier. The marks read only
   released fields (`lone`, the crises read's `band` and `last_animal_ids`); nothing predicts.
3. **One clock for every viewer.** An act's start is a pure function of its row (`arkActStart`). A watch never pins,
   cuts or speeds the clock: everyone watching sees the same moment.
4. **Species only** in the words, as Ark Lite.

## The hold (`src/lib/ark-act-hold.ts`)

`arkActStart(recordAt, step?)` = the row's own time (`at`: the moment the server released it) + `ARK_ACT_HOLD_SECONDS`
(75 s: a page's 45 s refresh and the public read's 30 s cache), never before the encounter's step. Used by:

| Act | Where |
|---|---|
| A meal's chase | `live-meals.ts` (`set`, `add`), `replay/event-replay.ts` |
| An escape's chase | `live/escape-lines.ts` `escapeActs`, `replay/event-replay.ts` |
| A dying act | `live/controller.ts` `died`, `replay/event-replay.ts` |

Matings and live births start at their row's time, as before: a mating's walk is up to 30 s and the pair stay together
two minutes; a birth takes 24 s.

Until its act begins, an animal the record has already taken from the read (the eaten one, the dead one) goes on with
its day as a stand-in. In the last 14 s before a chase each of the two walks from where its day has it to where the
record's encounter starts them (`approachPose`), when that is near enough to walk; else it is there at the start, as
before. Meals are handed to the scene as their rows are read (`addMeals`): the hunting read's set (`setMeals`) comes up
to a refresh later and does not double them.

A line whose act can still be watched from its start stays on the log until it has begun (`ArkLiveItem.stay`): 15 s was
shorter than the hold.

## Files

| File | What |
|---|---|
| `live-cast.ts` | Who is in the cast, until when, how many at once. Pure, tested in Node. |
| `watch.ts` | A tapped line's act watched: V2's shot run live (`createArkReplayShot({live: true})`). |
| `index.ts` | `attachArkSeen`: the cast on a scene, the rows remembered, the watch and its caption, the marks' labels. |
| `hooks.ts` | What E5 and E6 will publish, and what already takes it. No fakes. |
| `harness-entry.ts` | Development's page for `scripts/ark-seen-shots.mjs`. |

In the scene (`../index.ts`), only hooks:

| `ArkSceneHandle` | What |
|---|---|
| `addMeals(acts)` | Meals from the log, added (never replacing the hunting read's). |
| `setWounded(list)` | E5's hook: the wounded limp (`live-escapes.ts`). |
| `setCast(cast)` | V2's. `ArkCastLayer.label(id)`: one short line in the selected animal's box. |

And in the scene itself: the departure fade (`departing`: 0.9 s as it stood, then 2.6 s into the haze; only for one that
left the Ark, not the live set, and never when its act has taken it up), the dying act (`live-deaths.ts`
`deathBodyPose`: `DEATH_WEAKEN_SECONDS` 6.4, `DEATH_FALL_SECONDS` 2.6; a flyer comes down first), and `lone` decoded
from the read (`snapshot.ts`).

## The live cast

```ts
const seen = attachArkSeen({handle, host, aspect});
seen.note(rows, snapshot);     // before the layers are fed: the rows' casts are brought in, one layout
seen.watch(eventId, text);     // a line's tap: true when its act is being watched
seen.tick();                   // twice a second: the groups whose act is over are let go
```

| Row | Group | Kept |
|---|---|---|
| `mated` | the pair | 90 s (the layer's own pins then hold them); with a stand-in, the whole 20 min |
| `birth` | parents and litter | 90 s; with a stand-in parent 5 min |
| `death_old`, `starved` | the animal (a stand-in, alive, until its act) | until 4 s into the dying act (its body is the act's own) |
| `meal` | hunter and prey | until 20 s into the chase; with a stand-in hunter 15 min |
| `escaped` | prey and hunter | 70 s from the chase's start |
| `extinction` | the group of the row that ended the kind, with the ring | as that row |

At most 48 animals pinned by act groups at once (16 on the low tier and the lighter view); the group nearest its end
goes first, the watched one never. A pin costs one more animal drawn one by one; a stand-in also its model, only when
it comes into view.

## Watching

`watch(eventId, text)` plans the event as V2 does and runs the shot with `live: true`:

- the clock is the Ark's (`cut` does nothing, an extinction's fade is not run fast: the camera draws back instead);
- the layers are the live log's (nothing is fed again, nothing let go);
- the cast is the shared one (the shot's group is brought into it and released from it);
- two that share the picture are **held** in it (`holdIn`): each frame the camera is at once at least as far back as
  holds both, whatever the target's easing is doing. A sprint and a stoop no longer leave the frame (V2's escapes
  scored 3 of 5 for that), and a chase's still is the frame at which both were in the picture and nearest each other;
- a chase is told in three pictures: the **stalk** on the hunter alone, large, while it is more than 9 m from its
  quarry (from far enough back for both, neither reads); the **lunge** on the quarry with room, then the two of them in
  the picture's middle (its aim follows fast) once the hunter is within 11 m; then the meal where the prey fell, or
  the one that got away;
- on the low tier the lines of sight are not asked (each search is a burst of rays): the cheap clear bearing instead.

It ends when the act is over and the camera has lingered 6 s, when the viewer touches the view, or at another tap.
Then the line's own focus (the selection and its card), as a tap always gave. With reduced motion there is no watch.

A line can be watched from `ARK_SEEN_WATCH_BEFORE` before its act until: a meal 12 min after its start (the feeding),
an escape 45 s, a mating 20 min, a birth 4 min, a death or an extinction 18 min (the body).

## The marks

- **Lone** (`animal.lone`, E3's read: sent only when true and only while `voyage_config.last_animal` is on): its card
  and its selection box say so; Ark Lite's list tags it. No ring, no crisis (decision 389).
- **Crises** (`/api/ark/crises`, E4; the contract is `docs/ark/audits/ecosystem/crises-api-contract.md`): the log asks
  12 s after it starts and every 3 minutes; while the read is not there (404), every 30. An open crisis's
  `last_animal_ids` are pinned; a `last` band's animal has the soft amber ring (`marks.ts`) and "Last one" in its box,
  a `critical` band's "Critical". Words: `ark.endangered.last` and `.critical` (45 languages); "Lone" is English until
  `ark.seen` carries it.

## Ark Lite

Lite has no world; everything here reads in its text:

- every act's line names its animals ("The African Lion ate a Plains Zebra", "Two Wild Turkeys mated"); escapes are
  now in Lite's feed too ("A Plains Zebra got away from an African Lion"), as the 3D log says them;
- a lone founder is tagged in a kind's list;
- a replayed event's card is V2's (`../replay/text.ts`).

## Hooks left for the engine

| Needs | Hook | Today |
|---|---|---|
| **E6** searching, stalking, chasing, wary, mate-seeking | `hooks.ts` `arkSeenStates` (proposed field `animal.state`), `ArkSeen.snapshot` | read, pinned (with the target), worded for the box and Lite; the acting needs the read's own geometry, then `live-meals.ts` `approachPose` is where a stalk goes |
| **E5** wounded | the same state; `ArkSceneHandle.setWounded`; `live-deaths.ts` `cause: "wounds"` | the limp and the collapse's look are built and tested; nothing is drawn until the read says so |
| **E4** crises | `ArkSeen.setCrises` | reads the contract's shape; the route is not on this branch |
| Words | `ark.seen.*` | English (`ARK_SEEN_ENGLISH`) |

## Limits (flagged, not hidden)

- **The hold delays an act, never a line.** A line says "ate" up to 75 s before the chase is acted. Ark Lite and the
  counts are the server's and move at once.
- **A viewer who arrives late** sees what is still going on (the feeding, the body, the pair together), as before.
- **The walk to the start** is the client's (continuity only): a hunter far from its record's waypoint is simply there.
  E6's real searching replaces it.
- **What the layers do not act, a watch cannot either** (a pair in a tank or on two islands, an insect at its
  microhabitat): the watch holds on the cast where they are, then gives way to the line's own focus.
- **The dying act is poses** (head down, a sway, over onto its side): there is no dying clip (P2-4).
- **A swoop's rush** is seen from where the quarry is; the raptor is in the picture for its last strides only.

## Testing

```
npx tsx --test src/lib/ark-seen.test.ts src/lib/ark-replay.test.ts src/ark-scene/live-deaths.test.ts
node scripts/ark-seen-shots.mjs --data <dir with voyage.json + events.json> --out <dir> --count 20
```

The harness films **live lines**: the record arrives at the live log's own controller 20 s after its release, the line
is tapped, the act is watched on a running clock at the event's own time. `meal` and `escaped` lines are made from
animals really aboard while production has none. Per line: a clip, a strip, the still at the watch's telling moment;
per kind a contact sheet (`sheet-<kind>-<n>.jpg`); `summary.json` has each watch's own account and the line in words.
