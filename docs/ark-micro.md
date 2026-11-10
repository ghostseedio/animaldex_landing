# Small animals and microhabitats in the web Ark

Date: 2026-11-10. Branch `ark-micro` (from `origin/ark-stats`). Builds the owner's addendum on small animals (`docs/ark-next.md` in the AnimalDex repo, stats addendum, size: the 0.18 m floor and the marker).

## 1. The classifier

`scripts/ark-microhabitats.mts` reads a read-only export of the live catalogue (`voyage_species` + `species_profiles.canonical_game_stats.size` + `species_field_guide.typical_habitat` / `where_to_look` + `species_taxonomy` class, order, family; the query is in the script's header) and writes `src/ark-scene/microhabitats.json`. It is deterministic: regular expressions over stored text and a few taxonomy gates, no model, and the exact stored phrase is kept as each species' reason.

**Small = size stat ≤ 15.** On the catalogue's own mass anchors (`stats.ts`, from `observed-size-scale.ts`) 13 is 0.4 kg and 17 is 1 kg, so 15 is about 0.6 kg: a brown rat. It is also where the scene's drawn length `1.2 · L^0.6` reaches twice the true length (L 0.28 m drawn 0.56 m). From there down, drawing an animal true to size against a wall, a trunk or a flower makes a visible difference.

**Spots, in order:**
1. **house** (the cottage at Home).
   - Domestic animals live **around** it whatever their size: domestic cat, dog, canary, ferret, pigeon, house sparrow, house finch, house wren, house mouse.
   - A small Home-zone species whose text names a building anywhere (walls, roofs, eaves, porches, houses, buildings, cellars, lit windows, lights at night...) lives **on** it. A species of another zone only when a building is the *first* place its text names (the cottage is at Home, not in its zone).
   - On the house: mammals (bats excepted) and frogs on the ground **around** it, birds on the **roof**, everything else on the **walls**.
2. Otherwise the spot whose phrase comes **first** in `typical_habitat` (range keys dropped), then in `where_to_look`: **bark**, **flowers**, **rocks**, **leaf_litter**, **pond_surface**. Each spot only takes classes that live on it:
   - no bird on leaf litter or rocks;
   - birds on bark only for woodpeckers, nuthatches, treecreepers and woodcreepers;
   - flowers: insects, spiders, hummingbirds and sunbirds;
   - the pond's surface: insects (not moths or bees), frogs and newts, snails, and only the fishing spiders (Pisauridae).
3. **none**: it stands in its zone as before. Everything of the reef and the open ocean stays at sea.

Flags per species: `m` a moth (Lepidoptera outside the butterfly families: to the porch light at night), `c` a clinger (crawls on its surface), `r` its rig passed (`~/animaldex-talking-models/rig/manifest.json`), `a` around the house, `o` on its roof.

### Report (live catalogue, 2026-11-10: 2,465 aboard-able species)

1,222 small or domestic species (1,219 at size ≤ 15, plus the domestic cat, dog and pigeon).

| Spot | Species |
|---|---|
| house | **126** (82 of the Home zone; 44 of other zones whose text names a building first, most of them moths whose `where_to_look` says "lit windows" or "porch lights") |
| bark | **55** |
| flowers | **66** |
| rocks | **68** |
| leaf_litter | **136** |
| pond_surface | **43** |
| none, at sea (reef, open ocean) | 121 |
| none, text names no spot | 583 (207 birds, 108 mammals, 102 insects, 61 with no taxonomy class, 24 turtles...) |
| **no usable habitat text** | **24** |

**Five examples per spot, with their phrases:**

- **house**
  - Silverfish: habitat "Silverfish belongs in homes and forests…"
  - House Centipede: habitat "Basements, bathrooms, cellars, wall voids,…"
  - Wall Spider: habitat "Walls, stones, window frames and outdoor…"
  - Mediterranean House Gecko: habitat "…above all the walls and outbuildings of towns and…"
  - Eupterote Fabia Moth (rainforest): look "…walls near lights for broad brown…"
- **bark**
  - Mossy Leaf-tailed Gecko: habitat "…clinging to tree trunks and branches crusted with bark,…"
  - Peanut-headed Lanternfly: look "Check the trunks of large forest trees at head…"
  - White Underwing Moth: habitat "…adults rest cryptically against bark during daylight."
  - Underwing Moth: habitat "…daylight hours resting against trunks, branches and other surfaces…"
  - Mourning Cloak: look "…scan sunlit trunks, woodland tracks and fallen…"
- **flowers**
  - Spiny Flower Mantis: habitat "…on shrubs and flowering plants at low to moderate height."
  - Sunset Moth: look "…adults come to the blossoms…"
  - Zebra Longwing: habitat "…they need host plants, nectar, pollen…"
  - Giant Redeye: look "…stand near flowering shrubs close to palms…"
  - Giant Honey Bee: habitat "…hollow trees, managed hives, and flower-rich edges…"
- **rocks**
  - Senkaku Skink: habitat "Rocky coastal ground and low vegetation…"
  - Flat Porcelain Crab: habitat "Rocky shores of the Pacific coast…"
  - Two-tailed Pasha: habitat "…sunny rocky slopes and hilltops."
  - Scarlet Tiger Moth: habitat "…coastal cliffs and undercliffs, wherever comfrey…"
  - European Stick Insect: habitat "…on calcareous or rocky soils…"
- **leaf_litter**
  - European Hedgehog: habitat "…parks, farmland margins, and leaf litter."
  - Swamp Forest Crab: look "…look along the leaf litter at the water edge."
  - Vampire Crab: habitat "…forest floors, stream banks, leaf litter…"
  - St Mark's Fly: habitat "…damp soil with plenty of decaying plant…"
  - European Crane Fly: habitat "…especially on damp ground. Larvae live in the top few…"
- **pond_surface**
  - Pool Frog: habitat "Pool Frogs live around ponds, marshes…"
  - Spanish Ribbed Newt: habitat "Ponds, slow streams, reservoirs, ditches,…"
  - Scarlet Skimmer: habitat "…ponds, marshes, ditches, flooded rice…"
  - Pied Paddy Skimmer: habitat "…drains, marsh edges and shallow ponds…"
  - Water Strider: habitat "Gerridae occupy ponds, lakes, streams…"

**No usable habitat text (24):** american-green-tree-frog, australasian-pipit, caddisfly, common-soil-centipede, common-toad, false-widow-spider, giant-house-spider, great-spangled-fritillary, greater-antillean-grackle, hairy-rove-beetle, javanese-mud-dauber, lace-bug, mediterranean-sand-smelt, peaceful-dove, pennsylvania-ground-beetle, poplar-gall-aphid, red-cotton-stainer-bug, ruby-pyrausta-moth, sand-lizard, song-thrush, stone-centipede, swimming-crab, vapourer-moth, western-fence-lizard. They stand in their zones, drawn at the floor with the marker.

**Rigs:** the manifest marks 37 of 76 pilot species as passed, among them the Mediterranean and tropical house geckos and the black ant. Their clips (`*.skinned.glb`) live only in `~/animaldex-talking-models/rig/`: they aren't published to the model bucket, and the scene has no skinned or VAT loader yet. **So every small animal uses the glide.** The `r` flag is in the table for when the clips ship.

## 2. The scene

- **The cottage** (`micro-decor.ts` COTTAGE, drawn by `micro-scene.ts`) sits at Home, 17 m south of the farm's animals, facing the default camera.
  - It has limewashed walls on a stone plinth, a tiled gable roof with a ridge cap and a chimney, a door, five glazed windows that glow warm at night, and a porch (deck, posts, lean-to roof) with a porch light: a lamp, an emissive bulb and an additive glow sprite, lit from dusk.
  - Beside it are a garden pond (water disc, ring of stones), a rockery, a flower bed either side of the porch, and a tree with fallen leaves under it.
  - Five draw calls in all.
- **Every other land zone** gets a micro corner just past its clearing, toward the camera: a flower patch, a leaf-litter patch and a stone cluster. Its own climbable trees nearby are its bark (broadleaf, rainforest, orchard and cactus trunks; conifers, palms and acacias have no clear trunk).
  - Flowers and leaves are new instanced decor kinds in `vegetation.ts` (3 flower shapes, 2 leaves).
  - The cottage and the pond are obstacles, so the animals' grid keeps clear of them. That shifts some Home spots once, with this change.
- **Placement** (`placement.ts` → `micro.ts`). A small animal still takes the server's slot. Slot k of zone Z takes point `k·12 + Z` of its spot's surfaces, a 2D low-discrepancy (R2) sequence, so no two slots of any zone share a point. Its rank is a small spiral a few body lengths about it.
  - Round the cottage, the way round comes from the slot alone (a golden-ratio sequence), so pets the size of a dog stand a metre or more apart.
  - The house is at Home for every zone's house-dwellers.
  - The pond's surface is the lake's lily margin for the fresh-water zones (the wetland's ground never dips under the water at its animals), and the garden pond for the rest.
  - Points lie exactly on the drawn geometry:
    - walls and roof from the cottage's own numbers;
    - trunks as the prism the shape draws (its sides, taper, lean, the instance's turn and scale), below the canopy;
    - the stones' top found on their own triangles;
    - flower heads from the flower shapes.
  - Nobody moves: the existing tests pass with small animals in the v2 fixture, and a new test adds and removes small ones.
- **True size up close** (`micro.ts` `microDrawnLength`). Drawn length = `clamp(max(L, 16 px at this distance), L, D)`:
  - L is the size plan's true length, without the floor;
  - D is the usual drawn length, with the 0.18 m floor.
  - Close by it is true to size against the wall or the flower. Drawing back, it never drops under 16 px on screen. When that reaches D (about 13 m for a ladybird, 30 m for a sparrow), the floor and the marker take over.
  - The length is continuous in the distance, so it never pops; the marker shows only when zoomed out.
- **Movement:**
  - Clingers glide to and fro along their surface's own frame (back to the normal, head along the crawl), pausing and turning round in the pauses. Reach is 5 body lengths (3–35 cm); asleep they keep still.
  - Pets and roof birds sit. Pond-skaters glide 20 cm.
  - Moths at the cottage, awake at night (`lighting.daylight.night` > 0.35), take off and circle the porch light in loose, wobbling loops, each on its own radius and pace. By day, or once selected, they rest on the wall.
- **Owners:** "My animals" and `?focus=` call `select`. For a small animal it flies to its surface point:
  - from out along the surface's normal (in front of the wall, beside the trunk, above the flower);
  - at `clamp(6·L, 0.12, 3)` m, so it fills about a fifth of the view;
  - the flight's destination keeps up with the crawl, and the camera follows it up and down a wall.
  - Close to a small animal, the camera may come within 8 cm (`controls.minDistance`). The near plane follows the distance (0.01–0.4 m), the floor above the ground drops to 3 cm, and the target may sit above the ground.
- **Performance:**
  - A small animal's model isn't drawn beyond 42 m unless it's the reader's own or selected; only its marker is. Its far model isn't loaded until the camera comes that close.
  - Small ones skip the idle director and the contact shadow; rings are drawn only for level surfaces.

### Performance (`scratchpad/ark/pw/perf.cjs`, as `perf-micro.cjs` on port 3127; 390×844 @3x, 4× CPU throttle, M3 Max, tier settles at medium)

| Scenario | `?fixture=1` (130 animals) | `?fixture=micro` (+33 small) |
|---|---|---|
| overview orbit | p50 16.7 / p95 16.8 ms; 136 draws, 624k tris; 3.66 ms CPU | p50 16.7 / p95 16.8; 142 draws, 630k tris; 4.74 ms |
| open land, idle motion | 16.7 / 16.7; 66 draws; 2.88 ms | 16.7 / 16.7; 67 draws; 3.33 ms |
| selected zebra, near | 16.7 / 16.8; 40 draws; 2.78 ms | 16.7 / 16.7; 40 draws; 3.17 ms |
| selected zebra, orbit | 16.7 / 16.8; 40 draws; 2.39 ms | 16.7 / 16.7; 40 draws; 3.07 ms |
| fresh water orbit | 16.7 / 16.7; 76 draws; 3.09 ms | 16.7 / 16.7; 82 draws; 3.66 ms |

The cottage, flowers, litter and stones cost about +6 draw calls in the overview. The small animals cost about +0.4–1 ms CPU a frame under 4× throttle (per-frame surface points and drawn lengths). There are no dropped frames.

### Screenshots

In `scratchpad/ark/web-shots/micro/` (`?fixture=micro`; `?hour=11` day, `?hour=22` night):
- the house by day and night (geckos, spiders and ants on the walls, windows lit, moths at the porch light): `house-day.png`, `house-night.png`, `porch-light-night.png`;
- `gecko-day.png` (asleep), `gecko-night.png` (above the lit window);
- `ants-wall.png` (three black ants of one slot);
- `moth-night-select.png` (an emerald moth settled on the wall once selected);
- `bark-anole.png`, `bark-bee.png`, `flowers-hoverfly.png`, `flowers-bumblebee.png`, `pond-strider.png`, `pond-strider-wide.png`, `litter-millipede.png`, `rocks-lizard.png`;
- `zoomed-out-home.png` (the cottage from 55 m, with markers);
- contact sheets `sheetA`–`sheetD.png`.

## 3. What's weak

- **No rigged clips:** every crawl is a glide, legs still. The passing gecko and ant rigs aren't published or loadable yet.
- **The `where_to_look` text is advice to people, not habitat.** 44 species of other zones go to the cottage, most of them moths because "check lit windows and porch lights" names a building first. For moths that matches the owner's porch-light rule; for a rainforest moth it means leaving its zone for Home.
  - The pond's surface sends non-fresh-water species (a rainforest tree frog) to the garden pond at Home.
  - Some phrases misfire: a desert locust's "moist sandy soil" is leaf litter, a woodlouse is classed Gastropoda in `species_taxonomy`, and the downy woodpecker's `where_to_look` ("rocky banks") is wrong in the data.
- **583 small species name no spot,** mostly birds and mammals; they stand in their zones as before. The 24 with no text are listed above.
- **Sea zones stay at sea:** nothing reef-sized lives at a microhabitat (rock pools would be the next spot).
- **Spacing has no guarantee:** the point sequences keep slots apart in practice (tested to 60 slots on the walls and the fixture's pets), but a small flower patch can put two slots on one flower head.
- **The porch light's glow sprite is faint after tone mapping;** the bulb and the lit windows carry the night look.
- **The near plane drops to 1 cm close up,** so depth precision far away is lower while zoomed in. Nothing visible was seen, but there is no logarithmic depth.
- **The Home grid changed once** because the cottage and the pond are new obstacles: the farm's animals shifted to new spots with this release (not when others arrive or leave).
