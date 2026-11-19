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
| A live birth | `live/controller.ts` `born`, `replay/event-replay.ts`; the young (in the read already) are out of sight until born (`live-births.ts`) |

Matings start at their row's time, as before: the walk is up to 30 s (a housed pair's coming together at least 22 s)
and the pair stay together two minutes (a housed pair 40 s). A hatching
is not held either: its young are in the read at once, and a tap on its line shows the clutch hatch again (the scene's
own replay act, as "while you were away" plays it, on the viewer's own time).

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
| `hooks.ts` | What an animal is doing now, as the read says it (E6's `animal.state`), and the marks' words. No fakes. |
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

## Births and matings you can read (step 2)

20 live lines of each kind were filmed again (`scripts/ark-seen-shots.mjs`): births read 18 of 20 (they were 8), matings
17 or 18 of 20 over two runs, counting the pairs the layer used to skip (14 of the 20 it acted before), the extinctions
2 of 2 (1). What did not read, and what now does:

| Line | Was | Now |
|---|---|---|
| A den birth (a rat, a rabbit, a prairie dog) | the young tucked at her belly, under her own body | each crawls out clear of her flank and lies there while she licks it, then goes back to suckle (`live-births.ts` `out`); the picture closes on them once one is out |
| A fish's brood, any young far smaller than its mother | a speck a metre from her | the brood stays by her while it is acted, each drawn larger for its first moments (`newbornScale`) |
| A birth in a tank, a cage or a room (the mother has no day to settle from) | not acted: the young were simply there | the same act where the scene draws her, on her own floor or in her own water (`housed`), filmed from above through its top; then each young comes in where it lives |
| A hatching | the nest, and the young wherever their day had them (a roost's hole at night) | the young are in the nest as the eggs split and stay in it while it is shown (6 s), the nest with them; the picture stays on the clutch |
| A mating of a housed pair (a zoo house's, two tanks', two vivariums') | not acted | acted where she is. One enclosure: the two come together between their places, slowly, a courtship in place, one mount, the two together, all at close spacing (`live-matings.ts` `housed`). Two enclosures: he is brought to her side and the two lie side by side, he displaying, then both at rest (`brought`: no walk, no mount). Filmed from above, the cut through the roof over them |
| A mating of a pair more than 160 m apart | not acted | he starts 60 m from her, on the line from where his day had him, and walks to her (`far`) |
| The last of a kind that is a speck (a water flea, an aphid) | the camera drew back 45 m: nothing of it in the picture; a water flea's body was never in it at all | the picture stays on it and its ring, which is its own size. A speck in the water dies where it drifts (on the bed it lay under the bed as drawn); the camera goes under a pool's surface however shallow, keeps over the drawn bed, and its near plane stops short of the body |

And one fault found on the way (`index.ts` `placeAll`): placing a stand-in (an eaten prey's, a dead one's, the cast's)
gave the town's planner the stand-ins alone, so the town's plan was of nobody until the next read (no tank, no room,
no schedule made, the zoo's enclosures closed). A stand-in of the wild island now leaves the town alone; one of the
town is planned with everyone who lives there.

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
| `birth` (live) | parents and litter | 90 s from the birth's start; with a stand-in parent 5 min |
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
  quarry (from far enough back for both, neither reads); the **lunge** on the quarry, near and side on, where it stays
  while the hunter comes into the picture (a picture that holds both from the start is too far back to read, and one
  that zooms as they close pumps); then the meal where the prey fell, or the one that got away;
- a hatching's line plays the scene's own hatching act (`play`), which flies to the clutch itself; once it has landed
  the shot takes the camera for its clear view of the young;
- on the low tier the lines of sight are not asked (each search is a burst of rays): the cheap clear bearing instead.

It ends when the act is over and the camera has lingered 6 s, when the viewer touches the view, or at another tap.
Then the line's own focus (the selection and its card), as a tap always gave. With reduced motion there is no watch.

A line can be watched from `ARK_SEEN_WATCH_BEFORE` before its act until: a meal 12 min after its start (the feeding),
an escape 45 s, a mating 20 min, a birth 4 min, a death or an extinction 18 min (the body).

## The marks

- **Lone** (`animal.lone`, E3's read: sent only when true and only while `voyage_config.last_animal` is on): its card
  and its selection box say so; Ark Lite's list tags it. No ring, no crisis (decision 389).
- **Crises** (`/api/ark/crises`, E4; the contract is `docs/ark/audits/ecosystem/crises-api-contract.md`): the log asks
  12 s after it starts and every 3 minutes; while the read fails, every 30. An open crisis's
  `last_animal_ids` are pinned; a `last` band's animal has the soft amber ring (`marks.ts`) and "Last one" in its box,
  a `critical` band's "Critical". Words: `ark.endangered.last` and `.critical`, and the lone mark's `ark.life.lone` (45 languages:
  "the only one", a noun phrase that agrees with no animal's sex; English says "Lone founder").

## Ark Lite

Lite has no world; everything here reads in its text:

- every act's line names its animals ("The African Lion ate a Plains Zebra", "Two Wild Turkeys mated"); escapes are
  now in Lite's feed too ("A Plains Zebra got away from an African Lion"), as the 3D log says them;
- a lone founder is tagged in a kind's list;
- a replayed event's card is V2's (`../replay/text.ts`).

## What the engine publishes

| From | What | Here |
|---|---|---|
| **E6** `animal.state` (AnimalDex `docs/ark/audits/ecosystem/seen-states-api-contract.md`; behind `visible_searching`, off today) | `searching`, `mate_seeking`; with `hunt_styles` also `stalking` and `wounded` (`target`, `since`) | `snapshot.ts` passes it through; `hooks.ts` `arkSeenStates` (an unknown kind is dropped); `attachArkSeen` keeps the wounded, the stalking and the searching drawn (40 at most, 12 on the low tier; never the few hundred mate-seeking), words the selection box, and Ark Lite's list says the same. A searching hunter's walk is its foray, which the scene computes already. No read with a state: the Ark exactly as it was. |
| **E5** wounded | the same state; `ArkSceneHandle.setWounded`; `live-deaths.ts` `cause: "wounds"` | the limp and the collapse's look are built and tested; nothing is drawn until the read says so |
| **E4** crises | `ArkSeen.setCrises` | reads `/api/ark/crises` (E4's read, `voyage_crises_v1`; empty while `voyage_config.crises` is off) |
| Words | `ark.seen.*` (the states), `ark.life.lone` | in all 45 languages; `ARK_SEEN_ENGLISH` is the fallback. `{aPrey}` is filled with `ark.replay.a` / `.an`, as the log's lines |

Never sent, so never said: a chase in progress (the chase is the record's act, held and acted above) and wariness.

## Limits (flagged, not hidden)

- **The hold delays an act, never a line.** A line says "ate" up to 75 s before the chase is acted. Ark Lite and the
  counts are the server's and move at once.
- **A viewer who arrives late** sees what is still going on (the feeding, the body, the pair together), as before.
- **The walk to the start** is the client's (continuity only): a hunter far from its record's waypoint is simply there.
  (E6 publishes that a hunter is searching, never its quarry: the engine finds and attempts in one step.)
- **What the layers do not act, a watch cannot either** (a pair on two islands, one of the two on the wing): the watch
  holds on the cast where they are, then gives way to the line's own focus.
- **A marsupial's birth shows no young**: the newborn goes straight into the pouch (`live-births.ts`), so its line's
  picture is the mother resting (the 2 births of 20 that do not read). Nothing is drawn that is not so.
- **Two matings of 20 do not read**: a pair of iguanas under a bridge's dark water, and a corn snake's: a snake longer
  than its vivarium is wide lies across it, through the glass, as the town already draws it unacted, and its mate
  beside it does the same. A third reads in one run and not in the other: two parrots at a trunk's foot at night,
  one behind the other from the bearing the camera found.
- **A newborn is drawn larger than it is for its first moments** when it is far smaller than its mother (up to two
  fifths of her length, three times its size at most), then eases to its own size: a visibility aid, as the scene's own
  for small animals seen from afar. A housed pair's or a far pair's coming together is the client's (continuity only).
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
