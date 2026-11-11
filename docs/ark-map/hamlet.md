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

## Numbers
From the dry run's population, `scripts/ark-map-scale.mts`:

| | 1× (3,140 animals) | 3× (9,420) |
|---|---:|---:|
| Residents | 1,198 | 3,594 |
| Plots used | 7 houses + 3 smallholdings | 7 + 4 (the cap) |
| Out at once, at most | 98 | 116 |
| Out on average | 5.9% of residents | 2.3% |
| Most cat-sized animals in a 1 m cube | **3** (the dry run had 57) | **9** (the dry run had 175) |
| 1 m cubes over 4, counting midday and midnight | 0 | 24 |
| Plot overlaps, plot capacity, reserved land | 0 | 0 |

**The island's land holds 7 houses and 4 smallholdings in all.**
- The reserved slots are only those clear of every tree, rock, crop row, river and slope. No scenery is moved, because moving it would shift the scenery's ids.
- 1× wants 9 houses and 3 smallholdings; 3× wants 16 and 6. Past the slots, residents share the plots there are, and fewer of each are out at once.
- **Owner decision:** more plots need land. The options are to grow the home petal as a wedge (the graphics lane's terrain) or to clear trees there (the graphics lane's decor, which shifts decor ids once).

**3× crowding** is in wild zones (the forests, the river and lake), which hold far more clusters than their own land at 3×. That is the dry run's rule E: a zone's visible capacity, with the rest resting out of sight. It is the runtime lane's `arkOutside`, and the map can feed it each cluster's lap (`map.level`).

## Other lanes
- **Graphics:**
  - Draw a cottage at each house plot and a barn at each smallholding (`barn: true`), in the plot's frame.
  - Draw lit windows at night (`plotSpots(plot).window`).
  - Thin the grass, flowers and crop rows under reserved plots (`reservedAt`).
- **Props:** the gardens, paddocks, coops and fences come through `setHomePlots`, which is already wired.
- **Behaviour:** the nav grid's `blocked()` does not yet know the new houses and barns. Residents are off the schedule, but a wild walker's path could cross a new house.
- **Runtime:** pass `arkOutside` as `hamletState`'s `outside` argument, and apply rule E to wild zones at 3×.
- **Server:** `voyage_animals.area` (`house` | `farm` | null) in the public read.
