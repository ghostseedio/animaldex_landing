# The hamlet (owner decision D10, 2026-11-11)

The approved proposal is AnimalDex `docs/ark/captures-backfill-dry-run.md` §5.5–5.6 (branch `ark-captures-dryrun`). The code is `src/ark-scene/map/hamlet.ts`, the checks are `map/validate-hamlet.ts`, and the tests are `src/lib/ark-hamlet.test.ts`.

## What it does
- **Plots.** `homePlots(houseResidents, farmResidents)` gives `clamp(ceil(house / 130), 1, 16)` houses and `clamp(ceil(farm / 50), 1, 6)` smallholdings, in the props lane's `HomePlot` shape.
  - The first two plots are today's cottage and barn (`defaultHomePlots`).
  - The rest are reserved slots in a fixed order (`hamlet-slots.json`, written by `scripts/ark-map-hamlet.mts`). The list is append-only: adding a plot never moves another.
- **Reserved land.** Every slot's ground is kept off the map's spawn cells and attach points, so no wild animal stands there and nobody wild moves when a plot opens.
- **Templates** (`plotSpots`):
  - A house has a door, a window, and 6 lawn spots inside its picket fence.
  - A smallholding has the barn's and the coop's doors, 12 spots inside the props' paddock, 6 in the yard and 6 round the coop, each by body size.
- **Residents.** A resident is an animal whose `area` is `house` or `farm`. This is the server's `voyage_animals.area`; the decoder already reads it.
  - Pets go to houses; livestock and poultry go to smallholdings. A farm kind kept as a pet goes to a house.
  - The plot is chosen by a rendezvous hash of the animal's id, so a new plot takes only its own share (about 1 in n).
  - A resident is placed at its door and stays off the behaviour schedule.
- **Indoors and out** (`hamletState`). Who is out depends on kind and island hour:
  - dogs by day; cats at dusk and night; poultry and livestock by day; pigeons by day;
  - aquarium fish, caged birds and reptiles are always in.
  - Each plot has its share out, never more than its spots. The share rotates on the shared clock every 300 s, following the runtime lane's `arkOutside` contract (`ringOutside` stands in until that lane is merged).
  - For the first 20 s of each step, door beats walk an animal from its door to its spot, or back in.
- **Scene** (`index.ts`):
  - `setSnapshot` sets the plots before anything reads the attach points (`setAttachHomePlots`, and props' `setHomePlots`).
  - Residents are posed on their spot or in their door beat.
  - Residents who are indoors aren't drawn, unless they are the reader's own, or selected or followed.

## The home district (home growth, 2026-11-11)

The owner decided to grow the home area before launch, while scenery ids may still shift, so the full cap has land: 16 houses and 6 smallholdings (today's cottage and barn, and 20 reserved plots).

- **Land** (`world.ts` `homeLobe`): the coast's south lobe reaches up to 32 m further out (filling the old bay in front of Home; zero west of the river's mouth, so the reef, the river and the rainforest keep their coast), and an east shoulder takes the east coast up to 30 m out (zero north of the grassland's shore and the cave). Dry land 14,846 → 20,947 m²; Home's zone 1,802 → 8,850 m². Zone areas after: rainforest 2,248, woodland 1,816, mountains 2,113, river and lake 1,033, wetland 647, polar 1,163, grassland 1,603, desert 1,286 m² (before: 2,260, 1,816, 2,113, 1,017, 846, 1,066, 2,154, 1,322). The desert moved onto the new east shore, the grassland's animals gather further north-west, the open water stands 18 m off its new coast.
- **Scenery budget**: decor items 1,018 → 985, forest fill 407 → 411 (the tiers' shares 130/261/407 → 127/261/411). Outside the forests nothing grows on a lane or within 2 m of a plot (`decor.ts` `inVillage`, from the baked footprints); trees stand between the plots and along the fields. The forests' fill is unchanged (rainforest 76, woodland 65); the open country's moved with the zones (grassland 77 → 27, Home 37 → 113).
- **Lanes** (`world.ts` `HAMLET_LANES`): the village street past the cottage's gate and east between the two rows of the east end; the shore lane down to the beach and west along it to the river's mouth; the upper street 38 m behind the village street (back gardens meet between them), its farms on the grassland's edge; a farm track north. The ground paints them (earth, ruts, a grass crown; `fields.ts` `lanesGlsl`) and no crop grows on them.
- **Plots** (`hamlet.ts` `HAMLET_PLAN`): each plot set on its lane (a cottage's gate on the verge; a smallholding's yard or paddock on the lane), slid and stood back a little where it must be to fit: on dry, gentle, open land, off every lane, clear of every plot before it, of every zone's clearing, of trees and of the rocks as drawn (`map/rocks.ts` `inRock`). The order is append-only and starts round today's cottage: at 1× (9 houses, 3 smallholdings) the hamlet is the west end and the middle.
- **Footprints**: a house's covers what the props draw on it (the beds west of the cottage, the compost behind): 13.2 × 14.8 m. A smallholding's: the barn, the props' paddock and coop, and its yard.
- **The orchard** moved from east of the farm's clearing (where the streets run now) to behind the barn.
- **The village's fields**: a field whose middle is within 16 m of a lane is grass whole (the greens round the gardens), so no crop strip runs up to a picket fence; crops beyond.
- `scripts/ark-map-hamlet.mts` writes `hamlet-slots.json` and the props' `hamlet-footprints.json`.

## Numbers
From the dry run's population, `scripts/ark-map-scale.mts`; pets out by day measured through the day on the shared clock:

| | 1× (3,140 animals) | 3× (9,420) |
|---|---:|---:|
| Residents | 1,198 (1,053 pets, 145 farm) | 3,594 |
| Plots used | 9 houses + 3 smallholdings | 16 + 6 (the cap) |
| Outdoor spots | 252 | 464 |
| Pets out by day (7–19 h), on average | 125 = **11.9%** | 316 = **10.0%** |
| Farm animals out by day | 37% | 25% |
| Out at once, at most | 212 | 429 |
| Most cat-sized animals in a 1 m cube | 4 | 7 |
| 1 m cubes over 4 (midday and midnight) | **0** | 8, none at Home (the woods' canopy; was 50, most 18) |
| Plot overlaps, plot capacity, reserved land | 0 | 0 |

- **Spots**: a house has 20 (12 on the front lawn, 4 in the passages beside it, 4 in the back garden), a smallholding 24 (12 paddock, 6 yard, 6 round the coop). Every spot is off the props' keep-outs (`onHomeKeepOut`: beds, compost, water butt, hay shelter, hay, troughs, the coop's house), off crops, off lanes and out of water (the garden pond and its stones with a body's half-length clear, the river, the sea); spares stand in. A house's door and window follow its cottage's size; a barn's door its size.
- **Ids that moved** (attach points against the pre-growth island): 902 unchanged, 3,707 moved, 3,962 new ids, 3,275 gone; nearly all on decor hosts (`decor<n>` indices shift with the bigger island: leaves, branches, limbs, bark, rock faces, canopy hangs), plus the cottage's walls, eaves and ridge (its floor sits on the village's gentler ground), the lamps (the desert's and the grassland's sites moved), the garden pond, ledges and tide pools. `tree-attach.json` is unchanged.
- **Reserved land works now**: `reservedAt` was always false (its corners wind the other way); no wild animal, perch, burrow or anchor is on or within 1.2 m of a reserved plot, and a wild partner never takes a resident as its host.
- **Herds** (`herds.ts` `herdless`): a resident is never massed into a herd (the backfill view's "307" cats at the old cottage were the herd of every captured cat, standing at one door), nor is a tiny animal (`herdMicro`: the map's micro animals, insects, spiders and small invertebrates under 12 cm; the "48" house flies by the cottage). They live on their attach points, seen up close as their swarm or cluster; their counts stay in the panel's bars.
- **Attach points are one tag's** (`points.ts` `ownerOf`): a point that stands for two tags (a desert shrub's top for the sand and the scrub) is in one of their lists only, by a hash of its id, so two kinds' clusters never take the same point (a fennec and a meerkat did); a tag that owns no point its body fits takes the shared ones.
- **Rule E** (`map/capacity.ts`): `zoneCapacity(zone)`, each zone's own cells plus its attach points (Home also its hamlet spots), in the runtime's `setArkZoneCapacity` shape; `wireZoneCapacity(liveBudget)` hands it over when the runtime lane is in. The crowding check applies it first. At 1× every zone is under its capacity; at 3× the wetland is over it (121 rest out of sight).
- **Scarce lists**: a zone with none or a stray few (under 12) of a tag's cells borrows the nearest roomy zone's list, and past every tag's first lap a cluster takes the least lapped tag. That took the 1× crowding (magpies four deep on one borrowed farm cell) to 0.

## Other lanes
- **Graphics (batch 6 and on):** `terrain.ts` has one new block (the lanes' paint, after the farm block) and reads `arkLaneDistance` from `fieldsGlsl()`. The island is bigger: the overview (`index.ts` homeView) fits a wider circle centred south-east of the lake; check `groundArrays` and any per-zone tuning against the new coast. `decor.ts`: `inVillage` keeps the decor and the fill off lanes and plots outside the forests; the orchard is a turned grid behind the barn (`fields.ts` `ORCHARD`); the village's own fields are grass (`fields.ts` `VILLAGE_GREEN`).
- **Props:** the gardens, paddocks, coops and fences come through `setHomePlots`, which is already wired.
- **Behaviour:** the nav grid's `blocked()` does not yet know the new houses and barns. Residents are off the schedule, but a wild walker's path could cross a new house (wild animals no longer spawn on reserved land).
- **Runtime:** pass `arkOutside` as `hamletState`'s `outside` argument; call `wireZoneCapacity(liveBudget)` (or `setArkZoneCapacity(zoneCapacity)`) once at mount. Residents are live entries now (not herds): the hamlet hides those indoors.
- **Scale fixture** (`scripts/ark-scale-fixture.mts`, on ark-release): it writes no `area`, so the backfill view has no residents (every pet a farm animal of the map, massed in herds). Add `area: s.area === "house" || s.area === "farm" ? s.area : null` to each animal.
- **Server:** `voyage_animals.area` (`house` | `farm` | null) in the public read.
