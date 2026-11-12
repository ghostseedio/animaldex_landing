# Ark chases (motion 100x pass, lane L7)

The owner's complaint: "no chases between predators and prey" (brief section 6). Branch `ark-chases` (landing), from
`origin/main` 7764fe12. Visual only: the server and the ecology are unchanged.

## What is built

### 1. Visual hunts of ambient prey (`recipe-hunt.ts`, `behaviour-recipes.ts`, `recipe-templates.ts`, `recipe-scene.ts`)

Every recipe catch of a fish or an insect now has a **quarry**: the one ambient creature the predator goes after.

| Hunt | Recipe | Quarry | What you see |
|---|---|---|---|
| Cats and foxes stalk and pounce | `pounce` (56 species) | a grasshopper | stalk, freeze, watch; a short rush (`fast` run) as it hops off ahead; the pounce lands on it in a puff of dust, or it hops aside and away |
| Kestrels, kites, buzzards drop | `hover_drop` | a grasshopper | hover; the drop as it hops |
| Raptors dive for fish | `talon_grab` (osprey, fish eagles), `perch_plunge`, `air_plunge` | a fish | the fish cruises under the surface below the hover; it bolts 0.3 s before the feet or bill hit |
| Herons strike | `wade_spear`, `river_fish`, `pouch_scoop` | a fish | the fish swims in under the bill during the ambush; the strike, or it flicks away |
| Dolphins, seals, penguins, otters chase fish | `chase_fish` | a fish from the school | the swim at the prey is a burst; the fish flees ahead, darting, and is run down at the strike |
| Swallows, martins, swifts hawk | `aerial_hawk` (new, 9 species) | a moth or fly | long sweeps and fast dashes on the wing, never from a perch; the insect jinks |
| Flycatchers, bee-eaters, bats sally | `hawk_insects`, `bat_hawk` | a moth or fly | the sally is a dash |

How the quarry moves (pure in the episode's keys and id, the same for every viewer):
- While the predator watches (its stalk, freeze, ambush, hover: up to 14 s), it waits on the predator's way ahead. A watcher's fish swims in to it.
- From the attack on, it flees along the predator's own future path: at a time t it is where the predator's mouth will be `lead(t)` seconds later. The lead shrinks to nothing at the catch, so it flees at a little over half the predator's pace and is run down exactly where the recipe's catch is.
- It darts: a fish zigzags, a moth flutters, and a grasshopper hops in arcs with a puff of dust where it lands.
- A miss jinks aside over the last moment and gets away, then fades as it hides in the grass or swims off. Misses come at the templates' own rates (a pounce 35% caught, a heron 45%, an osprey 60%).
- The carried catch shows only from the moment it is made. A carried insect is drawn at its own size, not scaled to the hunter.
- Ambient only: fish and insects (`PreyKind`), never a catalogue animal. The test checks it.

Template changes:
- `pounce` gains a short rush before the leap.
- `chase_fish` swims at the prey are `fast` (a burst).
- The hawking sally is a dash.
- `aerial_hawk` is new.

Pace and paths:
- A step's `fast` speeds it by the provisional bursts `SWIM_BURST` (2×, at least a body length a second: `swimBurst`), `FLY_BURST` (1.6×) and `RUN_SPRINT` (1.3×). L2's `swimPaces(...).burst` and `flightSpec(...).burst` and L1's sprint replace these.
- Leaps no longer cross fences or rocks.
- Every ground leg's way is also checked segment by segment against L5's colliders, once wired (`setRecipeColliders`).
- A hawking flyer's air spots and sweeps keep to open air (`openAir`: no trunk, rock, shrub or building within 2.4 m), so a swallow or a bat no longer flies through a crown. This also applies to the bats' beat goal.

Generator: `scripts/ark-behaviour-compose.mts` gives Hirundinidae, Apodidae and Hemiprocnidae `aerial_hawk` (by phrase or rule) instead of `hawk_insects`, and no `pouch_scoop` from a swallow's "scoop water". Regenerated from the saved exports: everything else is byte-identical.
```
npx tsx scripts/ark-behaviour-recipes.mts <behaviour/inputs/species.json> <recipes/extra.json> <intel-web/export.json>
```

### 2. Real meal events as full chases (`acts.ts`)

`mealStage(kind, predator, prey, options)` is sampled once at 60 Hz: pure in the two bodies and the seed (the prey's id and the event time).
- **On land** (glide, bound):
  1. it turns to its prey and stalks it, low (`stalk`);
  2. the prey looks up (`scan`) and bolts;
  3. the hunter sprints (`run`), aiming where the prey is going so it cuts the corners of its darts;
  4. the lunge or pounce (`leap`) lands where the prey will be; the catch;
  5. it stands over it (`eat`), and the prey sinks and fades.
- **Darts by size** (L1's classes): small prey cut sharply every 0.35–0.65 s; mid-sized prey zigzag; big prey (2.2 m and over) swerve now and then.
- **Obstacles:** both go round blocked ground (`clear`) or stay in the water (`water`), and a lunge needs a clear line.
- **The prey always loses:** the server says it was eaten. It runs at most at 72% of the hunter's pace and tires after 3.5 s.
- **Snakes** creep and strike.
- **In the water** (dart): a burst (`swim`, `strike`).
- **Raptors** (swoop): over, high, then the stoop (`plunge`, then `strike_feet`) onto where the prey will be; the prey bolts or takes off 0.6–0.85 s before. A small prey is carried off, a big one mantled.
- **Cut-aways** are unchanged.
- **Paces** (`chasePace`): the locomotion lanes' where wired (`setChasePaces`), otherwise provisional: (0.3 + 14.5·(stat/100)^1.2)·L^0.25 m/s. A cheetah runs at about 16 m/s, a lion 13, a fox 8.5. Today's rig clips do not cap it: a lion's fastest clip is its walk (1.1 m/s), and L1's gait engine gives it a gallop.
- **Steps:** each runner steps on its heading where that is clear. Where it is blocked, it swerves to the nearest clear way within a right angle (`stepOn`). Boxed in, it goes on anyway, so a chase always ends. Past 14 s it lunges whatever lies between, and the catch follows (`maxT`; the first scene chase never ended without this).
- **Camera:** side on, turned to the nearest bearing with no tree in the lines to where the two start and to the catch, and none close under the camera (`clearBearing`). A long chase is framed a little tighter past its first 10 m.
- **Encounter positions:** `mealEncounter(act)` reads `act.encounter` or `payload.encounter` `{t, predator{x,z}, prey{x,z,r}}`. `encounterBodies` uses the scene's pose of the hunter when it is within `ENCOUNTER_AGREE` (5 m) of the waypoint, else the waypoint; the prey where the scene has it when that is inside its disc, else the disc's nearest point. With `exact` the hunter starts there (up to 40 m), closing the gap in its stalk.
- **Act poses carry:**
  - `state`: the recipe state names `ARK_RECIPE_STATES`, so the rig contract (70 states) is unchanged;
  - `speed` (m/s, for the gait);
  - `role` (`hunter`, `quarry`);
  - `with`: the partner's id, for L5's separation.

### 3. Prey nearby react and scatter (`reactive.ts`)

The acting hunter's reactive input is `chasing` (index wiring: `act.role === "hunter"` and running). Then:
- everything it could eat, and anything up to 1.5× its length within 7 lengths (at least 8 m), sees it as a threat;
- they notice at once (0.08 s + 0.02 s a metre) and are woken if asleep;
- the flight distance grows by 1.6×;
- each flees at its own seeded angle up to `SCATTER` (0.85 rad) either side of straight away, so a herd splits and fans out.
A sleeping, non-chasing hunter sends nobody running (tested).

## Wiring for the integrator (one line each, `index.ts`)

```ts
setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)}); // L5
setChasePaces({sprint: (b) => sprintPace({plan: planOf(b.slug), slug: b.slug, length: b.length, speedStat: b.speedStat}), flee: (b) => fleePace({...}), burst: (b) => (b.slug ? swimPaces(b.length, locoStyle(b.slug).swim).burst : null), dive: (b) => (b.slug ? flightSpec(b.slug, b.length)?.dive ?? null : null)}); // L1, L2
```
Also:
- The meal's `chaseGround` in `index.ts` should add `!collideBlocked(x, z, 0.3)`.
- `SWIM_BURST`, `FLY_BURST` and `swimBurst` in `behaviour-recipes.ts` are the recipe bursts to point at L2's paces.

## Tests

`src/lib/ark-chases.test.ts` (9): the five hunts (caught at the mouth or got away, closing, where each quarry is), purity and the carried catch, blocked ground, swallows on the wing, the meal chase (phases, darts, paces, determinism, every kind), a wall and the water, encounter positions, flee styles and pace injection, scatter. Changed: the seal's clip-pace test (bursts allowed up to `swimBurst`), the chase line in `ark-stats.test.ts`.

## Recordings

`node scripts/ark-recipe-clips.mjs --out <dir> --clips pounce,heron_strike,osprey_dive,dolphin_chase,swallow_hawk,meal_chase --width 1280 --height 720`. Frames, videos and contact sheets go to the handover folder `ark/motion/L7/` (not committed).
