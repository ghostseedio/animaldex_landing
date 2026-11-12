# Ark true scale (motion pass §3, lane L4)

Owner: "sizes aren't realistic." Every animal is now drawn at its true size, in the same metres as the trees, rocks, fences and the cottage. The compressed on-screen curve (`D = clamp(1.2 · L^0.6, 0.18, 9)`), its floor, its 9 m cap and the "drawn a little larger from far" exaggeration are gone. Branch: landing `ark-true-scale` (from `origin/main` 7764fe12).

## 1. Where a size comes from

`scripts/ark-species-stats.mts` writes `src/ark-scene/species-stats.json` → `lengths[slug] = [drawn m, body length m, source]` for all 2,630 species with an Ark model. Best first:

| Source | Species | What |
|---|---|---|
| **stored** | 1,006 | The catalogue's own measurement: the traits lane's `voyage_species_traits.length_m` (its range's middle, with its phrase), else the size clause of `species_profiles.generation_metadata.stats_basis`. Kept only when it agrees with the data-gap value within 2.5× (or, with none, the size stat's estimate within 4×). |
| **data-gap** | 1,624 | A typical adult length generated the data-gap work's way (AnimalDex `ark-data-gaps`: kept apart from stored values, labelled, with a phrase and a confidence: high 729, medium 707, low 188). Written by Claude Code agents from their own knowledge, no API and no spend. `scripts/ark-true-scale/generated-lengths.json`. |
| **estimate** | 0 at build time | The size stat through the catalogue's mass anchors (`observed-size-scale.ts`), `L = 0.33 · mass^(1/3)`. Used at run time only for a species the table lacks but the snapshot sends stats for. |
| **plan** | run time only | The body plan's typical length, for a visitor the catalogue lacks. |

- **Read-only production query**: `scripts/ark-true-scale/catalogue.sql` (`BEGIN TRANSACTION READ ONLY`, 60 s statement timeout), run with `supabase db query --linked -f`. It reads `voyage_species`, `species_profiles` (stats, `stats_basis`, `size_scale_score`), `voyage_species_traits` (`length_m`, `length_phrase`) and `species_field_guide`. Nothing in the database stores a mass or a height as a column; the masses in `stats_basis` are prose about the animal and its relatives, so they are not parsed (only used by hand to check).
- **The data-gap values are checked against what is stored**: of the 904 species with both, the median difference is 5.5%, 88% agree within 25% and 97% within 50%.
- **Stored values not used** (11, each a phrase that is not this animal's body length): a ray's disc width (giant oceanic manta), horn or claw or bill lengths (beira, klipspringer, giant armadillo, saddle-billed stork), an altitude (Tibetan fox "3,500-5,200 m"), a wingspan (little wood satyr), tentacles (box jellyfish), a mantle only (giant squid), a disc only (brittle star), a larva (antlion).

**Snapshot override**: a `length_m` the server sends wins, drawn in the table's proportion for that species (its tail).

## 2. Which length the model is drawn by

The models are all one unit along their body axis (`bodyAxisExtent`: +z head to tail, y for upright bodies). So the table stores the **drawn length along that axis**, not just the body length:

- **Mammals** are measured head and body (no tail). Where the rig found a tail (`ark.json` `behaviour.tail`), the model is scaled so nose-to-tail-base matches; otherwise by head and body (a horse's or a cow's tail hangs; the whole length drew them 1.2–1.8× too tall).
- **Birds, fish, snakes, eels, cetaceans, insects**: the whole length (bill to tail, snout to tail fin).
- **Lizards and crocodiles**: snout to vent where the rig found a tail, else total.
- **Rays**: total length with the tail (a stored disc width is not used along the body).
- **Height check** (mammals and birds): a second data-gap value, the standing height (`scripts/ark-true-scale/generated-heights.json`, 1,378 species), against the model's own height. The scale is the geometric mean of the two when they agree within 2×, so a trunk, a raised head or a long neck held up doesn't misjudge the model. After it, 40 reference animals stand within about ±10% of their real height (elephant 3.7 m, giraffe 5.1, horse 2.1, cow 1.5, lion 1.3, cat 0.33, mouse 5 cm); the zebra (1.29×) and the flamingo (1.31×) are the widest.
- **Butterflies and moths** (95 of 103 with a wingspan in their phrase): by the wings, which is what their model is: spread (as wide as long) the model's width is the wingspan; folded over the back its length is a forewing's, about half the wingspan. By the body alone a 6 cm red admiral was drawn 2 cm.
- **One hand correction**: the bootlace worm (5–10 m stretched) lies coiled, so its model is drawn 1.5 m.
- How each species was fitted is in the table's `drawn_by` column: total 1,104, total + height 676, head-and-body + height 427, to the tail's base + height 254, wingspan 95, to the tail's base 62, head-and-body 11, the override 1.

## 3. What changes (every species: `docs/ark/true-scale-sizes.tsv`)

- **1,283 of 2,630 species change by more than 2×**: 1,266 smaller (everything the curve and the 0.18 m floor blew up: insects up to 1,000× smaller, a house mouse 0.28 → 0.15 m with its tail, a ladybird 0.18 m → 7.5 mm) and 17 larger (the whales the cap and the compressed size stat held down, the giant and bigfin squid, three snakes, the orca, false killer whale, basking shark).
- **The humpback**: 3.5 m → 14 m. Blue whale 6.7 → 25 m, fin whale 6.3 → 20 m, sperm whale 6.3 → 16 m, sei whale 3.4 → 16.5 m. African elephant 3.5 → 5.1 m long (3.7 m tall), giraffe 2.5 → 4.0 m (5.1 m tall).
- **On today's Ark** (the real snapshot, 3,137 animals): 542 of its species (1,348 animals) change by more than 2×.

## 4. In the scene (`stats.ts`, `sizes.ts`, `runtime/camera.ts`, small wiring in `index.ts`)

- `arkBody().display` is the true drawn length; `floor` is always false. No exaggeration from far (`exaggerate = 1`).
- **Small animals**: true size at every distance. Any animal drawn under `MARKER_BELOW_PIXELS` (5 px) gets its soft find-dot; past the model cap one under 10 px is its dot instead of an icon, and an icon is the animal's own size (no 1.6 m floor). Icons and dots are picked within 20 px. "My animals" and `?focus=` select fly the camera to `meetDistance(length)` and lower the closest distance first, so a beetle is met from 12 cm, a mouse from about a metre.
- **Models by size on screen**: the 150 model slots go to the largest on screen (`screenWeight` = drawn length / distance), so a whale far off keeps its model before a beetle near by; and an animal 220 px or more across gets its near model (and is asked for it) however far off it is (`nearBySize`: a 14 m humpback across the bay is not drawn with 600 triangles), the near slots also going largest on screen first.
- **Camera** (`runtime/camera.ts`): `CAMERA_RANGE` {near 4, close 0.08, far 340} and `meetDistance(length, aspect)`: small ones about a fifth of the view, mid-sized in their surroundings (`10 + 4 L`, as before), a whale or an elephant far enough back to be seen whole across the narrower side (`fitWhole`: a 25 m blue whale on an upright phone from about 115 m). A swimmer is met from far enough to see it whole.
- **Chase speed** (`moveSpeed`): by dynamic similarity, `(0.25 + 0.75 · speed/100) · √(g · L)`, 0.03–12 m/s, so a cheetah (3.7 m/s) outruns a lion (3.5) and a whale (8.9) is not 25 antelopes' pace. Visual only.
- **Swim pace** (`behaviour-schedule.ts` `swimPaceLength`): a swimmer's trip pace counts its length up to 2 m (a seal, a dolphin), then grows as √L (in body lengths a second a 14 m humpback cruised at 16.6 m/s; now about 6). A breath swims about 12 s at its own pace, any way round (it was ±4 m, so a whale reached its breath in a second and floated through it). Predators' safe distance from their prey: six body lengths, at most 40 m (`SAFE_MOST`; a true-size humpback's 84 m was more sea than the island has).

## 4b. Room (decision 35)

- **Sea** (`map/water.ts`): a swimmer drawn 6 m or longer takes a reserved cell in deep open water (at least 9 m deep, nearest its zone's site, 30 m apart, up to 4 a zone); every other sea cell within 14 m of a reserved one is left out of the other swimmers' lists. Static (the terrain alone), so no arrival or departure moves anyone.
- **Measured on the real snapshot** (773 animals on the ground or in the water, bodies as discs a third of their length; `overlap.mts` in the handover folder):

| | Overlapping pairs | of them with an animal of 3 m or more | Open ocean |
|---|---|---|---|
| Before (release 1323a70d, the old curve) | 96 | 15 | 1 |
| True scale, no spacing change | 64 | 23 | 1 (the 16 m sperm whale 2.5 m from the sawfish) |
| True scale with the reserve | 63 | 22 | **0** (the sperm whale in 10 m of water off the south coast) |

- **Land: not done here** (decision 54). The remaining pairs are big land animals beside another species' home (a saltwater crocodile 0.5 m from an egret, a rhinoceros 1.8 m from an elephant). Placement never depends on who else is aboard, and every land spot is within about 2 m of some slot's cell, so only a land reservation (every zone's lists rewritten) keeps a 5 m elephant's home clear: L5's runtime separation now, reserved ground for big animals in Part C's map.

## 5. Scenery in real metres (`scripts/ark-scale-audit.mts`)

| Thing | As drawn | Real | Verdict |
|---|---|---|---|
| Oak | 8.3 m (p50) | 15–25 m | **0.42×** |
| Beech | 12.6 m | 20–35 m | **0.46×** |
| Pine / spruce | 11.5 / 11.4 m | 15–35 / 20–40 m | **0.46× / 0.38×** |
| Willow | 7.2 m | 10–20 m | **0.48×** |
| Rainforest emergent | 15.4 m (max 32.5) | 40–60 m | **0.31×** |
| Birch, acacia, apple, snag | 10.5, 5.6, 4.2, 5.9 m | 12–22, 5–12, 3–8, 6–20 m | real |
| Rocks | 0.67 m tall (p50), to 2.1 m | boulders | real (boulders) |
| Cottage | 5.2 × 4 m, eaves 2.6, ridge 4.3 m | small cottage 6–10 × 5–7 m, ridge 5–7 m | a little small (~0.8×) |
| Picket fence | 0.95 m posts | 0.9–1.2 m | real |
| Paddock fence | 1.075 m posts | 1.2–1.4 m for horses | a little low (a 2.1 m horse looks over it easily) |

The trees are about half their real height: an elephant (3.7 m) now reaches half-way up an oak. **Not changed here** (scenery is lane L6's, and tree size moves attach points, perches and the camera's obstacles): passed to the coordinator.

## 5b. Size rules that encoded the old floor (decision 55)

- Attach points take bodies down to 0.1 mm (`map/world-sampler.ts`; 1 mm was the old drawn floor): a fairyfly (0.16 mm) and a mite fit.
- The validator's small-animal attach rule also needs a true length of 0.12 m or less (`map/validate.ts`): the map's "small" flag is the size stat (≤ 15), and a 1.4 m ladder snake of size 15 lives on the ground.
- `micro.ts` `microDrawnLength` (the 16 px growth) is retired.

## 5c. Open (for other lanes)

- `ark-behaviour-schedule.test.ts` "walking goes at its walk clip's own pace" (L1): the African clawed frog walks at a median 1.44 of its clip's pace (at 9 cm its walking now passes the test's fixed 5 cm/s filter; at 0.33 m it was filtered out). The only failing test on this branch (2,260 of 2,261 pass).
- Floors from the old drawn sizes still in the behaviour code (L1, L7): `behaviour-recipes.ts` `pace()` walks at least 8 cm/s and counts at least 5 cm of body, and `behaviour-schedule.ts` counts at least 5 cm (`Math.max(animal.length, 0.05)`) in its paces and reach: at true size an ant (5 mm) or a mite then moves 10 or more times its clip's pace. `behaviour-recipes.ts` `speedOf` swims at the whole length (the schedule counts √L past 2 m: `swimPaceLength`).
- Scenery to real metres (L6, decision 34), big land animals' room (L5 now, Part C's map), drawing and keeping by size on screen (Part B).

## 6. Shots

- `node scripts/ark-true-scale-shots.mjs --out <dir>`: five lineups (giants, large, human-sized, small, insects), before (the old curve) and after, with a 1.75 m person, the picket fence, the cottage and an oak. In the handover folder: `ark/motion/L4/shots/`.
- In the island (the golden harness, `--gpu metal`, before on the release tree, after on this branch): the humpback, the elephant, the lion, the zebra, the rabbit, the sparrow, the cricket, and the island, the house and the coast on desktop and phone: `ark/motion/L4/in-world/{before,after}/`; side by side in `ark/motion/L4/compare/`.

## 7. Performance per tier

The golden places with the tier pinned, on the Mac's GPU (`--gpu metal`), desktop (1440×900) and the phone profile (360×800, DPR 2, 4× CPU throttle), before (release 1323a70d) and after (this branch), the v2 fixture. The render distance is today's whole island on both (Part B's tiers are on `ark-streaming`, not here). Measured under a load average of about 110 from the other lanes, so the CPU and frame columns are noisy; draw calls and triangles are not.

| Tier | Device | Place | Draw calls before → after | Triangles before → after | Scene CPU ms before → after | Frame p50 / p95 ms after |
|---|---|---|---|---|---|---|
| high | desktop | coast_rocks | 356 → 360 | 3.85M → 3.86M | 6.26 → 6.09 | 16.7 / 16.8 |
| high | desktop | house_fields | 436 → 424 | 4.60M → 4.60M | 7.6 → 5.91 | 16.7 / 16.7 |
| high | desktop | island_far | 409 → 409 | 3.16M → 3.15M | 5.67 → 5.5 | 16.7 / 33.3 |
| high | desktop | river_pond | 526 → 502 | 7.38M → 7.26M | 8.99 → 8.84 | 16.7 / 33.4 |
| high | phone | coast_rocks | 284 → 282 | 3.66M → 3.66M | 25.74 → 28.95 | 33.3 / 33.4 |
| high | phone | house_fields | 382 → 390 | 4.53M → 4.51M | 28.62 → 34.54 | 33.3 / 50.0 |
| high | phone | island_far | 333 → 333 | 2.90M → 2.90M | 25.66 → 21.92 | 16.7 / 33.3 |
| high | phone | river_pond | 458 → 436 | 7.20M → 7.12M | 38.21 → 28.91 | 33.3 / 50.0 |
| medium | desktop | coast_rocks | 129 → 133 | 0.92M → 0.94M | 4.42 → 3.82 | 16.7 / 16.7 |
| medium | desktop | house_fields | 170 → 168 | 1.05M → 1.05M | 4.74 → 4.51 | 16.7 / 16.7 |
| medium | desktop | island_far | 195 → 191 | 0.96M → 0.96M | 4.7 → 4.52 | 16.7 / 16.8 |
| medium | desktop | river_pond | 219 → 215 | 1.56M → 1.54M | 5.59 → 5.46 | 16.7 / 16.7 |
| medium | phone | coast_rocks | 90 → 94 | 0.83M → 0.84M | 16.1 → 11.65 | 16.7 / 16.8 |
| medium | phone | house_fields | 154 → 154 | 1.03M → 1.03M | 21.98 → 22.99 | 16.7 / 33.4 |
| medium | phone | island_far | 158 → 162 | 0.89M → 0.90M | 15.85 → 16.24 | 16.7 / 16.8 |
| medium | phone | river_pond | 186 → 180 | 1.51M → 1.47M | 27.63 → 15.07 | 16.7 / 16.7 |
| low | desktop | coast_rocks | 97 → 98 | 0.37M → 0.37M | 3.46 → 3.43 | 16.7 / 16.8 |
| low | desktop | house_fields | 113 → 113 | 0.42M → 0.41M | 3.87 → 3.92 | 16.7 / 16.7 |
| low | desktop | island_far | 113 → 111 | 0.36M → 0.37M | 3.11 → 2.9 | 16.7 / 16.8 |
| low | desktop | river_pond | 126 → 121 | 0.52M → 0.49M | 4.21 → 3.4 | 16.7 / 16.8 |
| low | phone | coast_rocks | 65 → 67 | 0.30M → 0.30M | 13.54 → 11.46 | 16.7 / 16.7 |
| low | phone | house_fields | 99 → 98 | 0.40M → 0.40M | 14.86 → 15.59 | 16.7 / 16.8 |
| low | phone | island_far | 107 → 106 | 0.36M → 0.36M | 13.04 → 12.55 | 16.7 / 16.7 |
| low | phone | river_pond | 109 → 106 | 0.48M → 0.46M | 14.92 → 15.46 | 16.7 / 16.8 |

- **True scale costs nothing measurable**: draw calls within about 5% (a few fewer where small animals became dots), triangles within 3% (the scenery is 95%+ of them), scene CPU within the noise.
- The phone profile on the high tier is at 30 fps before and after (that tier is not meant for phones). Medium and low hold 60.
- The timed runtime measurements on the real snapshot (`scripts/ark-runtime-measure.mjs --population-file`) could not reach a first frame on the phone profile under this load (20 s main-thread tasks), before or after; they are for the integrator's quieter run.
