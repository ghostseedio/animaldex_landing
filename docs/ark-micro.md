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
| house | **82** (Home zone only, since the fix pass) |
| lamp | **25** (insects and spiders of other zones whose text names lights at night: their own zone's lamp post) |
| bark | **58** |
| flowers | **69** |
| rocks | **70** |
| leaf_litter | **137** |
| pond_surface | **43** |
| none, at sea (reef, open ocean) | 121 |
| none, text names no spot | 593 (mostly birds, mammals and insects) |
| **no usable habitat text** | **24** |

**Five examples per spot, with their phrases:**

- **house**
  - Silverfish: habitat "Silverfish belongs in homes and forests…"
  - House Centipede: habitat "Basements, bathrooms, cellars, wall voids,…"
  - Wall Spider: habitat "Walls, stones, window frames and outdoor…"
  - Mediterranean House Gecko: habitat "…above all the walls and outbuildings of towns and…"
  - House Fly: habitat "Homes, farms, compost, refuse, animal…"
- **lamp** (fix pass; examples)
  - Eupterote Fabia Moth (rainforest): look "…walls near lights for broad brown…"
  - Emerald Moth (woodland): habitat "…foliage by day and come to lights at night."
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
- **The `where_to_look` text is advice to people, not habitat.** "Check lit windows and porch lights" puts 25 insects of other zones at their own zone's lamp post (since the fix pass, never at the Home cottage). Their stated habitat may not mention lights at all.
  - The pond's surface sends non-fresh-water species (a rainforest tree frog) to the garden pond at Home.
  - Some phrases misfire: a desert locust's "moist sandy soil" is leaf litter, a woodlouse is classed Gastropoda in `species_taxonomy`, and the downy woodpecker's `where_to_look` ("rocky banks") is wrong in the data.
- **583 small species name no spot,** mostly birds and mammals; they stand in their zones as before. The 24 with no text are listed above.
- **Sea zones stay at sea:** nothing reef-sized lives at a microhabitat (rock pools would be the next spot).
- **Spacing has no guarantee:** the point sequences keep slots apart in practice (tested to 60 slots on the walls and the fixture's pets), but a small flower patch can put two slots on one flower head.
- **The porch light's glow sprite is faint after tone mapping;** the bulb and the lit windows carry the night look.
- **The near plane drops to 1 cm close up,** so depth precision far away is lower while zoomed in. Nothing visible was seen, but there is no logarithmic depth.
- **The Home grid changed once** because the cottage and the pond are new obstacles: the farm's animals shifted to new spots with this release (not when others arrive or leave).

---

# Layers: canopy, ground, underground, sea

The owner's vertical-layers addendum, on the same branch, after the microhabitats. The island doesn't grow: the layers stack on it, and each zone can take more trees, burrows and feeding grounds later.

## 1. Which layer: `scripts/ark-layers.mts` → `src/ark-scene/layers.json`

The script is deterministic and uses stored data only, keeping the deciding phrase:
- `voyage_species.zone`;
- the traits lane's `realm` (`scratchpad/ark/traits.json`);
- the rig pipeline's body plans (`~/animaldex-talking-models/rig/plans.json`);
- `typical_habitat` / `where_to_look` / `sleep_pattern`;
- taxonomy.

It runs over the live catalogue export of 2026-11-10 (2,465 species).

| Layer | Species | How placed with confidence |
|---|---|---|
| **canopy** | **203** (perch 124, climb 70, leap 6, hang 3) | Birds that fly, with a tree phrase (canopy, treetops, branches, perches) before any ground phrase. Mammals, reptiles and frogs need a plain "arboreal / canopy / treetops / lives in trees" in `typical_habitat`. Sloths by family (hang), gibbons and lemurs leap, bats hang. 37 are primates (flag `p`). |
| **ground** | **1,833**, plus **89** with a burrow drawn by them (flag `b`) | The rest. A burrow when the text says burrows, digs or warrens. |
| **underground** | **15** (fix pass: only when the text says the animal itself lives underground) | Moles, mole-rats, golden moles, zokors and the like by family, or "underground / subterranean / fossorial / tunnels" in the habitat text. |
| **reef** (coral_reef zone) | **132** (swim 91, floor 39, filter 2) | Floor: crabs, stars, urchins, molluscs, octopus. Filter: mantas. |
| **open_sea** (open_ocean zone) | **133** (swim 108, floor 16, filter 9) | Filter: whale shark, basking shark, the baleen whales. |
| **deep** | **30** (2 glow at night; fix pass: from `typical_habitat` only) | "Deep sea / abyssal / midwater / twilight zone / bathypelagic / hydrothermal vents / continental slopes / seamounts" in the text. **Glow** only where the text says so: the stoplight loosejaw ("bioluminescent zones") and the Australian pineapplefish ("two small glowing points"). The firefly squid and the lanternfish say it only in Power-voice names ("Blueglow", "Glowmigration"), which don't count. |
| **no usable text** (on the ground by default) | **30** | american-green-tree-frog, australasian-pipit, buru-babirusa, caddisfly, common-soil-centipede, common-toad, coopers-hawk, false-widow-spider, giant-house-spider, great-spangled-fritillary, greater-antillean-grackle, grey-heron, hairy-rove-beetle, javanese-mud-dauber, lace-bug, masked-lapwing, mediterranean-sand-smelt, northern-white-cheeked-gibbon, peaceful-dove, pennsylvania-ground-beetle, poplar-gall-aphid, red-cotton-stainer-bug, ruby-pyrausta-moth, sand-lizard, silver-gull, song-thrush, stone-centipede, swimming-crab, vapourer-moth, western-fence-lizard |

**Examples:**
- **canopy**
  - Harpy Eagle: "Tall rainforest canopy fits…"
  - Black Giant Squirrel: "…keeping to the upper canopy…"
  - Blue-naped Parrot: look "…perch high in exposed crowns…"
  - Siamang: "…Sumatran and Malay rainforest canopies." (leap)
  - Brown-throated Sloth: taxonomy, Bradypodidae (hang)
- **underground**
  - Star-nosed Mole: taxonomy, Talpidae
  - Cape Golden Mole: taxonomy, Chrysochloridae
  - Hieroglyphic Cicada: "…nymphs develop underground on plant roots…"
  - Ball Python: "…is spent underground in abandoned mammal burrows."
- **deep**
  - Blobfish: "Deep continental slopes, cold seafloor…"
  - Vampire Squid: "…deep midwater, cold dark depths…"
  - Black Swallower: "…the dark mid-water zone…"
- **burrow**
  - Burrowing Owl: "…burrow-rich ground."
  - Crest-tailed Mulgara: "It digs burrows in firm sand…"

Canopy species are placed in their zone. The canopy trees stand in the rainforest (134 canopy species), woodland (30), grassland (12), wetland (9), river and lake (7) and mountains (1). Zones without them borrow the nearest zone's trees: 8 at Home, 1 in the desert, 1 on the shore.

The ecology is unchanged: the server's realm filter already keeps land, water and air apart, and the layers decide nothing that happens.

## 2. The scene

**Canopy** (`micro-decor.ts` `canopyTree`, drawn by `vegetation.ts`, placed by `layers.ts`):
- **The trees:** 16 canopy trees stand beside the zones' ground: 4 each in the rainforest and woodland, 2 each by the lake, in the wetland, on the grassland and in the mountains. Each is a 6–7 m trunk with five long limbs under pads of leaves, and a crown.
- **Placement:** a canopy animal takes its slot's point on its zone's limbs, by the same low-discrepancy scheme as the microhabitats, so nobody moves. A troop spreads over the next limbs round.
- **Perchers** sit toward the limb tips, and one in four on the crown. A bird of the air (`ARK_FLYERS`) still circles and comes back to its perch to rest.
- **Climbers** crawl to and fro along their limb, or (one in three) up and down the trunk, turning round in the pauses.
- **Leapers** leap to the next limb on an arc now and then, and back.
- **Hangers** hang under a limb, back down, swaying slowly.
- **Procedural only:** the rig manifest has no climbing, leaping or hanging clips marked pass, and no rig clips are loadable in the scene.
- **Camera:** looking at a canopy animal, the camera comes from where the leaves don't hide it. That is from above for one on the crown, from below for a hanger, from below and square to the limb for one on it, and level with one on the trunk.

**Underground** (`layers.ts` `burrowAt` / `tunnelPoint`, `layers-scene.ts`):
- **On the surface:** each underground animal has a burrow mouth at its spot (a dark mouth with two mounds of dug earth), and moles get molehills along their tunnel. The 89 ground diggers get a burrow mouth beside them.
- **In the tunnel:** the animal spends most of its time in its chamber, 0.6–0.9 m down at the end of a 2.2 m tunnel. Now and then it runs up the tunnel and peeks out of the mouth for a few seconds. Asleep it stays down.
- **The cutaway** opens when an underground animal is looked at (or with `setCutaway(true)`):
  - clipping planes remove the ground, the grass and the plants in a box in front of it;
  - a pit of soil with strata (topsoil, clay, a band of stones) shows the tunnels and chambers, drawn hollow so whoever is in them can be seen;
  - it is rebuilt only when the target moves or the camera turns.

**The sea** (`layers-scene.ts`, `terrain.ts`, `index.ts`):
- **Underwater mode:** with the camera below the surface (looking at a swimmer dives the camera to it, level with it), the scene switches over:
  - a blue-green haze (darker at night) replaces the sky;
  - the surface is seen from below;
  - shafts of light come down from it by day;
  - the caustics already play on the sea floor; the ground shader's are stronger underwater.
- **On the floor:** reef and sea bottom-dwellers (crabs, octopus, stars) sit there and sway a little.
- **Filter feeders** loop round the nearest of three drifting plankton clouds (two in the open water, one on the reef).
- **The deep** swim 4–9 m down over deep water.
- **Glow:** at night the two glowing species glow, a soft pulsing light seen from above and below.

**Only the active layer in full** (decided per frame):
- under the sea, nothing of the land is drawn: animals, grass and the cottage;
- above it, the deep isn't drawn;
- the underground is drawn only in the cutaway (or peeking out).

The reader's own animals and the selected one are always drawn.

**Cross-layer moments** (`moments.ts`, the scene's `moment(kind, id?)`):
- **seabird_dive:** out over the nearest sea, a plunge with a splash, afloat a moment, back.
- **whale_surface:** a whale or dolphin (not a whale shark) rises, its back breaks the surface, it blows, it goes down.
- **owl_swoop:** off its branch (an owl on the ground first flies up), a long low swoop to the ground ahead, and back.
- **primate_drop:** a canopy primate drops to the ground, sits, turns round, leaps back up.

All four are cosmetic: no other animal takes part, nothing is caught, and the animal ends where it began (tested).

They are **shot options for the livestream director**: `ARK_SHOTS` gains `seabird_dive`, `whale_surface`, `owl_swoop` and `primate_drop` (`lib/ark-clips/shots.ts`, merged from `origin/ark-marketing-clips`).
- The planner picks a subject that can act it out. Its captions are the live count, the zone and the general rule; there is never a meal word.
- The director (`ark-scene/director.ts`) holds the camera on the animal and calls `handle.moment` as the lead ends.
- The v2 fixture has a puffin, a humpback and a barn owl, but no canopy primate, so `primate_drop` is unavailable there (tested).

**Fixtures:** `?fixture=layers` is the micro fixture plus an animal of every layer and mode.

## 3. Screenshots (`scratchpad/ark/web-shots/layers/`)

- **Canopy:**
  - `canopy-capuchin.png`: a capuchin on a limb, a sloth hanging under one;
  - `canopy-spider-monkeys.png`: spider monkeys climbing the trunk and on a limb;
  - `canopy-siamang.png`, `canopy-sloth.png`, `canopy-toucan.png`: these three are cluttered by leaf pads.
- **Underground cutaway:**
  - `underground-mole.png`: the pit, the tunnel, the molehills, the mole peeking out;
  - `underground-mole-rats.png` (earlier pass): a naked mole-rat peeking out on the desert.
- **Underwater:**
  - `reef-octopus.png`: a wonderpus on the reef floor, coral, kelp, turtles;
  - `open-sea-whale-shark.png`: the open water, caustics on the floor;
  - `deep-night-loosejaw.png`: the deep at night, the loosejaw glowing;
  - `reef-night-pineapplefish.png`: the reef at night, the pineapplefish glowing.
- **Moments:**
  - `moment-whale-surface.png`: a humpback blowing at the surface, with a splash ring;
  - `moment-seabird-dive.png`: a gull afloat after its dive, with a splash ring;
  - `moment-primate-drop.png`: an orangutan down on the ground under its tree;
  - `moment-owl-swoop.png`: the owl is out of frame (weak).
- **Contact sheets:** `sheet1`–`sheet7.png`.

## 4. Performance (390×844 @3x, 4× CPU throttle, M3 Max, tier settles at medium; all p50 16.7 ms, p95 ≤ 16.8 ms)

| Scenario | Draw calls | Triangles | CPU ms/frame |
|---|---|---|---|
| `?fixture=1` overview orbit (with canopy trees and corners) | 142 | 664k | 4.28 |
| `?fixture=layers` (+55 animals) overview orbit | 179 | 694k | 5.94 |
| `?fixture=layers` open land idle | 73 | 497k | 3.80 |
| underwater, whale shark | **39** | 212k | 3.80 |
| underwater, reef octopus | **56** | 385k | 3.75 |
| cutaway, mole | 55 | 556k | 3.62 |
| canopy, capuchin | 58 | 580k | 3.71 |

Underwater, the land layer is skipped: 39–56 draw calls against 142–179 above the water. The canopy trees add about 6 draw calls and 40k triangles to the overview.

## 5. What's weak

- **Procedural motion only.** No climbing, leaping, hanging or burrowing clips are marked pass, and the scene can't load rig clips: limbs glide, leaps are arcs, hangers sway rigidly.
- **Canopy close-ups are often cluttered** by the limbs' leaf pads (the sloth, the toucan, the siamang). The camera picks a side by the animal's mode but doesn't ray-test for leaves.
- **Classification errors from the text:**
  - (Fixed in the fix pass: the false killer whale is no longer "deep".)
  - (Fixed in the fix pass: the common treeshrew is no longer "underground".)
  - Meerkats and fennec foxes were taken out of underground: "burrow systems" now means a burrow by a ground animal.
  - 1,833 species have no layer phrase and stay on the ground, including many forest birds whose text names the forest but not the trees.
- **Glow:** the stored data supports glow for only 2 species.
- **The wetland's ground never dips below the water** where its animals are, so its pond dwellers use the lake.
- **The cutaway** is a box in front of the target, not a true section, and toggling it recompiles the clipped materials once (a short hitch).
- **Underwater from the surface:** the water surface is drawn single-sided from below by a separate plane, so from just under it the far surface reads flat.
- **No changes to the server or the ecology** (as asked): layers are visual only.


---

# Fix pass (2026-11-11)

The coordinator's six points, on `ark-micro`. Before and after shots are in `scratchpad/ark/web-shots/fixpass/` (`before/`, `after/`, `compare-canopy.png`, `compare-light.png`, `list-after.png`, `after/owl-strip.jpg`).

1. **Leaves in the way of canopy close-ups** (`index.ts`):
   - **Clear-view search:** looking at a canopy animal, the camera raycasts from each candidate position to it, both ways, because the leaves are single-sided and a camera inside a pad sees it only from inside. It tries the mode's own angle, then turned either side, higher and lower, and nearer, and takes the first with nothing in between (the animal's own perch excepted).
   - **Folding:** forest trees still in the way while it is looked at (checked four times a second) fold away, their instance shrunk to nothing, and stand again after. The canopy trees themselves never fold, since the animal may be on one.
   - **Result:** the sloth (hanging), the toucan, the siamang and the capuchin are all in view (`compare-canopy.png`).
2. **Each zone's own spot:**
   - **The cottage is for the Home zone only** (and the domestic list): 82 species. An insect or spider of another zone whose text names lights at night (porch lights, lit windows, moth traps, light traps) now lives at its own zone's **lamp post**: 25 species, 22 of them moths.
   - **Lamp posts:** one stands at each other land zone's micro corner, lit at night, and its moths circle it.
   - **False killer whale:** "deep" is read from `typical_habitat` only (never from a watcher's "boats crossing deep water"), so it is now open sea.
   - **Common treeshrew:** "underground" needs the animal itself to live there ("lives underground", "fossorial", "subterranean", "digs tunnels"), not "wet tunnels" in a list of places. A burrow needs the animal to dig or to live, rest, sleep or nest in burrows, read from the habitat and sleep text, not the watcher's. So the treeshrew is now on the ground.
   - **Recounts:** underground 15, deep 30, ground diggers with a burrow 89.
3. **The owl swoop in frame:** the director follows a moment's subject closely (0.35 a frame), from across its path, wide enough for the whole swoop. `after/owl-strip.jpg` shows six frames of a real director run (`/ark?record=1`), the owl in frame throughout, airborne then down.
4. **The porch light's glow:**
   - The halo is an additive sprite with an HDR colour (3.2, 2.5, 1.5) and no fog, so it survives the tone mapping and feeds the bloom. The bulb's emissive is twice as strong.
   - From close by the halo scales down with the distance, so it never floods a close-up of something on the lamp.
   - See `compare-light.png`.
5. **Broken icons:** `ark-species-icon.tsx` falls back to the placeholder art (`/images/placeholders/species-no-image.svg`) on any failed or missing icon, in the side list and the selection card. The Yellow-spotted Millipede row now shows the placeholder (`list-after.png`), and so does the sloth's card.
6. **Cutaway shader:** the clipped materials keep their four clipping planes for good, parked out of the way while the cutaway is closed, so opening it only moves the planes and no shader is compiled again. Measured at 4× CPU throttle:

   | Step | Worst frame | Frames over 50 ms |
   |---|---|---|
   | Open | 33 ms (the pit's geometry being built) | none |
   | Close | 17 ms | none |
   | Open again | 17 ms | none |

**Rigged clips:** left out (not published; flight waits on the owner). `ark-scene/rig-clips.ts` `rigClip(manifest, slug, clip)` returns a clip only for a rig marked `passed` that lists the clip with its frames. A fallback rig, a missing clip or no manifest gives null. The scene's manifest is null until the rig output is published, so every animal keeps its procedural motion (tested).
