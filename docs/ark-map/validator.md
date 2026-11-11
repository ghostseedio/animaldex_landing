# Ark map: the spawn validator's report (generated)

`scripts/ark-map-validate.mts` on terrain `world-stub-1`, 2026-11-11. CI runs the same checks (`src/lib/ark-map.test.ts`, workflow `ark-map-validator`).

- **Species placed:** 2615 (every catalogue species with an Ark model, and the breeds as their kind), 5230 animals (each its own cluster, a lone one and a cluster's third member, all aboard at once), in 22291 ms.
- **Failures:** 0 (0 species).
  - `floats_or_sinks`: 0
  - `inside_scenery`: 0
  - `wrong_medium`: 0
  - `wrong_depth_band`: 0
  - `wrong_water`: 0
  - `invalid_surface`: 0
  - `wrong_facing`: 0
  - `small_not_on_attach_point`: 0
  - `roost_invalid`: 0
- **Grip check** (hangers, climbers, perchers on branches, trunks, ledges, walls, with the rig's foot bones): 877 rigs checked, 6 with too few feet down in some frame (reviewed: 6).

| Area | Animals placed there |
|---|---:|
| open_water | 302 |
| reef | 178 |
| shallows | 138 |
| rocky_shore | 82 |
| beach | 26 |
| estuary | 76 |
| cold_cove | 62 |
| river | 198 |
| lake_marsh | 348 |
| grassland | 436 |
| scrub | 222 |
| canopy | 1084 |
| forest_floor | 456 |
| underground | 122 |
| desert | 196 |
| mountain | 520 |
| homestead | 576 |

| Where | Animals |
|---|---:|
| on the ground | 1610 |
| in the sea | 642 |
| attach point: branch | 474 |
| attach point: rock_face | 314 |
| canopy limb (climb) | 296 |
| attach point: burrow_entrance | 264 |
| attach point: worm_hole | 249 |
| attach point: leaf | 247 |
| canopy limb (perch) | 236 |
| in fresh water | 232 |
| attach point: house_wall | 198 |
| attach point: flower_head | 104 |
| attach point: tide_pool | 32 |
| attach point: bark | 30 |
| burrow at an attach point | 23 |
| burrow | 16 |
| on its host (beside) | 12 |
| canopy limb (leap) | 12 |
| on its host (parasite) | 12 |
| attach point: porch_light | 11 |
| on its host (rider) | 4 |
| canopy limb (hang) | 4 |

Partners on a host aboard: 28. Species with a roost of their own (from `sleep_pattern`) resolved within reach: 326.

## Failures by species

None.

## Reviewed holds (not placed; they wait at the landing)

| Species | Why |
|---|---|
| louse | A group entry that lives only on its hosts' skin ("Hair, fur, feathers, and skin surface of birds or mammals"); the scenery has no attach point on an animal, so a small animal cannot sit anywhere true. Held until hosts carry attach points (graphics lane) or the parasite rule shows it on a host. |
| caddisfly | No field-guide text (zone fallback: river_lake, tag lake) and no lake attach point (reed leaf) on the current terrain fits it. Held until Part 5 gives it text or the graphics lane's reeds carry attach points. |
| macaroni-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| king-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| gentoo-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| adelie-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| snowy-sheathbill | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| southern-rockhopper-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| emperor-penguin | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| weddell-seal | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| leopard-seal | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| crocodile-icefish | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| antarctic-petrel | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| snow-petrel | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| head-louse | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| hocr | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| asian-painted-frog | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |
| checkered-swallowtail | decision 2 (Antarctic, for a future southern island) or host absent (head louse) |

## Grip check by species

- **blue-crowned-motmot** (idle): only 1 of 2 grip bones on the surface in a frame (needs 2) (reviewed)
- **cuckoo-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **mexican-paper-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **parasitic-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **red-lory** (idle): only 1 of 2 grip bones on the surface in a frame (needs 2) (reviewed)
- **black-and-yellow-garden-spider** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
