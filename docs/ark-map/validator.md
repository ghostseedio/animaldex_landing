# Ark map: the spawn validator's report (generated)

`scripts/ark-map-validate.mts` on terrain `world-stub-1`, 2026-11-11. CI runs the same checks (`src/lib/ark-map.test.ts`, workflow `ark-map-validator`).

- **Species placed:** 2615 (every catalogue species with an Ark model, and the breeds as their kind), 5230 animals (each its own cluster, a lone one and a cluster's third member, all aboard at once), in 4257 ms.
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
  - `off_walk_grid`: 0
  - `inside_rock`: 0
- **Grip check** (hangers, climbers, perchers on branches, trunks, ledges, walls, with the rig's foot bones): 987 rigs checked, 7 with too few feet down in some frame (reviewed: 8).

| Area | Animals placed there |
|---|---:|
| open_water | 282 |
| reef | 204 |
| shallows | 214 |
| rocky_shore | 48 |
| beach | 44 |
| estuary | 34 |
| cold_cove | 38 |
| river | 128 |
| lake_marsh | 614 |
| grassland | 468 |
| scrub | 194 |
| canopy | 1136 |
| forest_floor | 538 |
| underground | 84 |
| desert | 182 |
| mountain | 328 |
| homestead | 688 |

| Where | Animals |
|---|---:|
| on the ground | 3248 |
| attach point: leaf | 259 |
| in the water by its depth band (lake) | 250 |
| in the water by its depth band (reef) | 196 |
| attach point: branch | 177 |
| in the water by its depth band (seabed) | 132 |
| in fresh water (no band) | 118 |
| in the water by its depth band (mid) | 90 |
| in the water by its depth band (upper) | 88 |
| in the sea (no band) | 58 |
| attach point: flower_head | 57 |
| attach point: worm_hole | 57 |
| attach point: rock_face | 56 |
| in the water by its depth band (coast) | 56 |
| attach point: burrow_entrance | 52 |
| in the water by its depth band (deep) | 48 |
| attach point: house_wall | 46 |
| attach point: roof_edge | 34 |
| attach point: bark | 30 |
| in the water by its depth band (surface) | 26 |
| attach point: tide_pool | 24 |
| burrow at an attach point | 22 |
| attach point: fence_post | 22 |
| canopy limb (climb) | 16 |
| burrow | 14 |
| attach point: porch_light | 13 |
| on its host (beside) | 12 |
| on its host (parasite) | 12 |
| on its host (rider) | 4 |
| attach point: house_eave | 3 |
| attach point: tree_hollow | 2 |
| attach point: ledge | 2 |

Partners on a host aboard: 28. Species with a roost of their own (from `sleep_pattern`) resolved within reach: 333.

## Failures by species

None.

## Reviewed holds (not placed; they wait at the landing)

| Species | Why |
|---|---|
| louse | A group entry that lives only on its hosts' skin ("Hair, fur, feathers, and skin surface of birds or mammals"); the scenery has no attach point on an animal, so a small animal cannot sit anywhere true. Held until hosts carry attach points (graphics lane) or the parasite rule shows it on a host. |
| caddisfly | No field-guide text (zone fallback: river_lake, tag lake) and no lake attach point (reed leaf) on the current terrain fits it. Held until Part 5 gives it text or the graphics lane's reeds carry attach points. |
| macaroni-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| king-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| gentoo-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| adelie-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| snowy-sheathbill | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| southern-rockhopper-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| emperor-penguin | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| weddell-seal | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| leopard-seal | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| crocodile-icefish | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| antarctic-petrel | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| snow-petrel | decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island |
| head-louse | host absent: its only host is a human (A11) |
| hocr | no field-guide text and no voyage zone (decision 5: held until Part 5 fills the gap) |
| asian-painted-frog | no field-guide text and no voyage zone (decision 5: held until Part 5 fills the gap) |
| checkered-swallowtail | no field-guide text and no voyage zone (decision 5: held until Part 5 fills the gap) |

## Grip check by species

- **wasp-spider** (idle): only 2 of 8 grip bones on the surface in a frame (needs 4) (reviewed)
- **blue-crowned-motmot** (idle): only 1 of 2 grip bones on the surface in a frame (needs 2) (reviewed)
- **cuckoo-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **mexican-paper-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **parasitic-wasp** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
- **red-lory** (idle): only 1 of 2 grip bones on the surface in a frame (needs 2) (reviewed)
- **black-and-yellow-garden-spider** (idle): only 2 of 6 grip bones on the surface in a frame (needs 3) (reviewed)
