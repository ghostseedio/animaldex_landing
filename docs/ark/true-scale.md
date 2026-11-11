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
- **One hand correction**: the bootlace worm (5–10 m stretched) lies coiled, so its model is drawn 1.5 m.

## 3. What changes (every species: `docs/ark/true-scale-sizes.tsv`)

- **1,283 of 2,630 species change by more than 2×**: 1,266 smaller (everything the curve and the 0.18 m floor blew up: insects up to 1,000× smaller, a house mouse 0.28 → 0.15 m with its tail, a ladybird 0.18 m → 7.5 mm) and 17 larger (the whales the cap and the compressed size stat held down, the giant and bigfin squid, three snakes, the orca, false killer whale, basking shark).
- **The humpback**: 3.5 m → 14 m. Blue whale 6.7 → 25 m, fin whale 6.3 → 20 m, sperm whale 6.3 → 16 m, sei whale 3.4 → 16.5 m. African elephant 3.5 → 5.1 m long (3.7 m tall), giraffe 2.5 → 4.0 m (5.1 m tall).
- **On today's Ark** (the real snapshot, 3,137 animals): 542 of its species (1,348 animals) change by more than 2×.

## 4. In the scene (`stats.ts`, `sizes.ts`, `runtime/camera.ts`, small wiring in `index.ts`)

- `arkBody().display` is the true drawn length; `floor` is always false. No exaggeration from far (`exaggerate = 1`).
- **Small animals**: true size at every distance. Any animal drawn under `MARKER_BELOW_PIXELS` (5 px) gets its soft find-dot; past the model cap one under 10 px is its dot instead of an icon, and an icon is the animal's own size (no 1.6 m floor). Icons and dots are picked within 20 px. "My animals" and `?focus=` select fly the camera to `meetDistance(length)` and lower the closest distance first, so a beetle is met from 12 cm, a mouse from about a metre.
- **Models by size on screen**: the 150 model slots go to the largest on screen (`screenWeight` = drawn length / distance), so a whale far off keeps its model before a beetle near by.
- **Camera** (`runtime/camera.ts`): `CAMERA_RANGE` {near 4, close 0.08, far 340} and `meetDistance(length, aspect)`: small ones about a fifth of the view, mid-sized in their surroundings (`10 + 4 L`, as before), a whale or an elephant far enough back to be seen whole across the narrower side (`fitWhole`: a 25 m blue whale on an upright phone from about 115 m). A swimmer is met from far enough to see it whole.
- **Chase speed** (`moveSpeed`): by dynamic similarity, `(0.25 + 0.75 · speed/100) · √(g · L)`, 0.03–12 m/s, so a cheetah (3.7 m/s) outruns a lion (3.5) and a whale (8.9) is not 25 antelopes' pace. Visual only.

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

## 6. Shots

`node scripts/ark-true-scale-shots.mjs --out <dir>`: five lineups (giants, large, human-sized, small, insects), before (the old curve) and after, with a 1.75 m person, the picket fence, the cottage and an oak. In the handover folder: `ark/motion/L4/shots/`.
