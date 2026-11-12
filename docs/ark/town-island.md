# Ark Part C: the town, countryside and zoo island

Branch `ark-town-island` (landing), lane T2. The plan it builds is AnimalDex `docs/ark/islands-plan.md` (`ark-islands-plan` 353dc2b1, §3–§7), with decisions 15–28 in AnimalDex `docs/ark/DECISIONS.md` and this lane's own rows after them. The code is in `src/ark-scene/islands/`; the tests are in `src/lib/ark-town-island.test.ts`.

**The one rule, as on the wild island:** every position is a pure function of the plan and the island clock. The plan reads no clock and no randomness (seeded hashes only), so every viewer, the server's slot atlas, player control and the nav lane see the same town. Chunking (Part B) only decides what is drawn.

## 1. What is built

| | |
|---|---|
| Land | **12.4 ha** (measured at 1 m) on a 9 × 9 square of Part B chunks (475.2 m, 48 segments of 1.1 m a chunk). Bounded by the sea all round; the town flat at 2.6 m, the farmland rising to a low hill in the north, a beach in the south-east, a grassy shore elsewhere. |
| Canal | 7 m wide with stone walls, coping and gravel towpaths, from the millpond in the park south through the old town to a lock at the harbour (water held at 1.15 m). Four bridges: High Street, Mill Lane, Harbour Road and the Church Walk footbridge, with parapets and arch faces. Narrowboats moored along it. |
| Old town | The market square (setts, fountain, war memorial, benches, phone box, post box; market stalls on Wednesdays and Saturdays), the town hall with a clock cupola, the church (nave, porch, 22 m tower with spire and four clock faces whose hands turn with the island clock), the mill with its 30 m chimney, shops with awnings on Mill Lane, terraces with shopfronts on the high street and the square. |
| Homes | **119 buildings, 360 households**, all built from launch: **72 houses** (semi-detached pairs, front and back gardens, drives), **22 terrace rows** of 4 (back yards), **25 blocks** of 8 flats (balconies, courtyard gardens or gardens behind). Streets with carriageways, pavements and kerbs, centre lines, double yellow lines on the high street. |
| Parks and green | The town park round the millpond (bandstand, benches), the churchyard (yews, limes, oaks), allotments with sheds, a wild corner, a small wood on the west coast, street trees, garden trees and shrubs: ~370 trees. |
| Harbour | A tidal basin with quay walls and bollards, two breakwaters with a lighthouse, the harbour office, the fish shed, moored boats (out fishing on weekday mornings), the beach to its east. |
| Farmland | **10 farms**: 8 smallholdings (25 × 25 m, the D10 template) and 2 farmsteads (40 × 30 m) in two rows along the country lane and the farm road, each with a farmhouse, barn (and stable), coop and run, paddock, yard, hay bales, a trough, a tractor at the farmsteads. Fields (cereal, maize, cabbage, pasture, tilled…) with crop rows, an orchard, hedgerows with oaks, a farm pond. |
| Zoo | **35 plots of all 13 types and 2 spares**, the plan's 26 open at launch, on three paths and a spine off an entrance plaza by the park (§3). Plots with nothing open on them are landscaped (lawn, trees, a bench). Glass-fronted houses the camera sees into (aquarium, reptile house, insect house, nocturnal house, primate house with a glazed hall and an outdoor climbing frame), netted aviaries, paddocks (savanna with acacias and a termite mound, hoofstock, bears and wolves, big cats with a high platform, small mammals, the children's farm), the penguin and seal pool, raised pools, rocks, logs, shelters, a keepers' hatch on every back fence. |
| People implied | Lit windows by household on the island clock, parked cars, bins out, washing on the line, market stalls, boats in and out, street lamps, the church clock (§4). No people meshes, no voices. |

The plan picture: `npx tsx scripts/ark-town-plan.mts` writes `.ark-golden/town/plan.png` (1 px = 0.5 m).

### Against the islands plan

| | Islands plan | Built | Why |
|---|---|---|---|
| Land | ~8 ha | **12.4 ha** | True scale (lane L4). The 120 homes with gardens and their streets need ~4.3 ha, not 2.4; the zoo at the plan's footprints ~2.3 ha; the 10 farm plots alone 0.74 ha before fields. Still one island in Part B's grid. |
| Homes | 72 houses, 24 terraces, 24 flats (120, 360 households) | 72, 22, 25 (119, **360 households**) | What the old town's frontage allows; the households are exact. |
| Zoo plots | ~40 (26 at launch) | **35 + 2 spares** (26 at launch) | The plan's footprints per type on the land the zoo has. The server opens up to 40 in all and 32 at launch (decision 39): an enclosure past its type's plots takes a spare, past the spares it shares its type's last plot (decision 23). The validator lists the five types past their room at a year. |
| Outdoor spots for pets | ~1,000 | 1,008 | |

## 2. Files

| File | What |
|---|---|
| `islands/index.ts` | **The island-switch hook.** `ARK_ISLANDS` (each island's square, chunks, land, its place in the archipelago frame, its opening view), `toArchipelago`, `bearingBetween`, `islandOfAnimal` (the server's `island`, else `area`), `openingIsland` (decision 26), `loadIsland("town")` (a dynamic import, so the wild island's page does not carry the town until a crossing asks). |
| `islands/town/plan.ts` | The plan: coast, canal, streets, blocks, parcels, buildings, farms, zoo slots, greens, water, boundaries, trees, moorings. `townPlan()`, `townPlanMisses()`. |
| `islands/town/zoo-types.ts` | The 13 enclosure types, **with the server's ids** (`ark-islands-server` `20261117100000`): capacity, footprint, plots, launch openings, residents (today, 3×, a year), form, feeding times, enrichment; `enclosuresOpen`, `breedingFits`. |
| `islands/town/ground.ts` | Height and surface at any point (`sampleTownGround`, `townHeight`). |
| `islands/town/areas.ts` | **Placement areas** (§3): spots for houses, farms, garden wildlife, urban wildlife and the zoo; households and `householdOf`, `farmOf`, `zooLayout` / `zooEnclosures` / `zooSpotsFor` (by the open enclosures' names), `enclosuresIn`, `launchEnclosures`, `openZooSlots`, `binSpots`, `drainSpots`, `carSpots`, `TOWN_HABITATS_BY_ZONE`, `urbanNiche`. |
| `islands/town/people.ts` | People implied (§4): `townClockAt`, `windowLit`, `carAt`, `binsOut`, `washingOut`, `marketDay`, `boatIn`, `clockHands`, `lampsOn`. |
| `islands/town/obstacles.ts` | **Nav footprints for L5** (§6): `townObstacles`, `townObstaclesJSON`. |
| `islands/town/chunks.ts` | The town on Part B's grid: `TOWN_GRID` (structurally Part B's `ChunkGrid`), `townChunkOf`, `townChunkDistance`. |
| `islands/town/validate.ts` | The validator (§7). |
| `islands/town/render/*` | three.js: `index.ts` (`buildTownIsland`: per-chunk groups, materials, instanced sets, `update`, `setDrawn`, `setZooOpen`), `buildings.ts`, `scenery.ts`, `instanced.ts`, `water.ts`, `kit.ts`. |
| `islands/town/entry.ts` | The town's own page (the workbench for stills, flythrough, visual check and perf). |
| `scripts/ark-town.mts` | `stills`, `fly`, `perf`, `visual`. |
| `scripts/ark-town-plan.mts` | The plan picture, `--validate [--real <snapshot>]`, `--obstacles`. |

Nothing outside `islands/` was changed: the town reuses `ArkLighting`, `ArkPost` and the shared light uniforms (`glsl.ts`) as they are, so both islands sit under one sky.

## 3. Placement areas

All spots are fixed by the plan; the town is complete from launch, so a spot never moves (D10).

| Area | Spots | Protected |
|---|---|---|
| `house` | Each household's outdoor spots (a house's garden 6, a terrace home's yard 2, a flat's balcony 1, its block's courtyard 8): **1,008**; indoor by a window (tanks, cages): 360. `householdOf(id, keptIndoors)` is a rendezvous hash: dogs, cats and rabbits go to houses and terraces, fish, caged birds and small reptiles may go to flats; adding animals never moves anyone. | yes (D11) |
| `farm` | Each farm's paddock, yard and run (12/6/6 a smallholding, 26/12/12 a farmstead): **292**. `farmOf(id)` weights farmsteads double. | yes |
| `garden_wildlife` | Gardens, the park, allotments, churchyard, wood, wild corner, hedgerows, field margins, the canal (both banks and the water), the millpond, the farm pond, the beach: **1,123**. | no |
| `urban_wildlife` | Roof ridges, eaves, flat-roof ledges, **tall tops for peregrines** (church tower 31 m, mill chimney 30 m, lighthouse 18 m, town hall cupola 16 m), the belfry (bats), **bins and drains for rats** (260 bins, storm drains every 24 m and the canal's outfalls), the quay (gulls), the square (pigeons), lamp-lit walls by front doors (house geckos): **1,095**. | no |
| `zoo` | Each open enclosure's spots inside its mask: outdoor, the pool's surface, indoors behind the glass (**700** for the 26 at launch). | yes |

**Urban niches** by species (the plan's Appendix A list): `urbanNiche(slug, zone)` — peregrine → tall, ledge; kestrel, hawk, sparrowhawk, vulture → tall, roof, park; owls → churchyard, belfry, wood; rats and mice → bin, drain, canal; bats and pipistrelles → belfry, eave; gulls → roof, quay; pigeons and doves → square, roof, ledge; sparrows, swallows, swifts, hornero, wren, phoebe, kiskadee, sunbird → eave, garden, roof; magpie, crows, raven, jackdaw, rook → roof, tall, park; geckos, lizards, skinks → lamp_wall, garden; ducks, geese, wagtail, water tyrant, heron, the water monitor → canal, millpond; squirrels, raccoon, civet, macaque, fox → park, garden, bin; deer, cottontail, groundhog → park, field margin, garden; galah and cockatoo → park, roof; moths, hornets, wasps, spiders, snails, flies → lamp wall, eave, garden. Anything else by its zone (`TOWN_HABITATS_BY_ZONE`, the plan's §7.1 mapping for encounter hunting's per-island atlas).

**The zoo** (`zooLayout(open)`): the open enclosures are the server's names (`voyage_animals.enclosure`, `<type>-<n>` from 1; `enclosuresIn(animals)` reads them from a snapshot; before the server sends any, `launchEnclosures()`, the plan's 26). Enclosure `<type>-<n>` is drawn on the plot of that name; one past its type's plots takes a spare (the lowest numbers first, then the types in order, so an enclosure keeps its spare as others open); past the spares it shares its type's last plot. Every other plot is landscaped. Each open enclosure has its mask (its fence, 0.4 m in: the hard bound for placement, behaviour, the walk grid and player control), capacity, pool, indoor or not, the feeding hatch, enrichment spots and feeding times. `TownIsland.setZooOpen(names)` rebuilds only the zoo's meshes.

## 4. People implied, never shown

Pure functions of the island clock `{hours, day}` (`townClockAt(ms, offset)`; the weekday is `day % 7`, Sunday 0) and ids, so a recording on a pinned clock is the same every run.

| | Rule |
|---|---|
| Lit windows (2,827 windows) | Each household has its own evening (from 17:12–19:30 after dusk to a bedtime 22:00–23:50, a few past 1:00), living rooms first, bedrooms later; dark mornings before work; now and then a household is away for the day. Shops light their displays in opening hours (closed Sundays) and a few in the evening; the pub until 23:20; the church on Sunday morning and for evensong; farms early and in the evening; the lighthouse's lantern all night; zoo houses 9–18. |
| Parked cars (~450 spots) | Drives full at night, about a third full in weekday working hours; kerbs busier in the evening; which kerb spots are taken changes from day to day; colours by spot and day (kerbs) or month (drives). |
| Bins (260) | Out at the kerb from the evening before the street's collection day (19:00–21:30), back by late morning; a few stay out. |
| Washing | Dry days (62%), 8:30–17:30, about a third of households. |
| Market | Stalls on the square on Wednesdays and Saturdays, 7:00–16:00. |
| Boats | Canal boats come and go every few days; harbour boats out fishing on weekday mornings. |
| Lamps, clocks | Street lamps from dusk to dawn; the church's and town hall's clock hands. |

## 5. Built for Part B's streaming

- **The grid is Part B's**: 48 of the ground's 1.1 m segments a chunk (52.8 m), the town 9 × 9 chunks. `TOWN_GRID` has the shape of Part B's `ChunkGrid`; `spans` and `content` are Part B's `ChunkSpan[]` and content mask.
- **Everything belongs to a chunk**: each chunk is its own group (its ground tile of 49 × 49 vertices, and one merged mesh each for decals, solids, window glass and nets); trees and props are instanced per kind and keep each instance's chunk, writing only drawn chunks' instances to the GPU buffer, in built order (as Part B's `ChunkedInstances`).
- **The hook**: `town.setDrawn((chunk) => streamer.drawn(chunk))` on the streamer's `onChange`, and `town.update(clock)` every frame. Until Part B lands, the town's page applies Part B's render distances and hysteresis itself (960/40, 640/32, 440/26 m; the map view from 150 m).
- **Per-tier shares** (`TOWN_TIERS`): trees 1 / 1 / 0.6, small props 1 / 1 / 0.5, shadows 2048 / 1024 / 0, pixel ratio 2 / 1.5 / 1.

## 6. Nav footprints (for L5)

`npx tsx scripts/ark-town-plan.mts --obstacles` writes `.ark-golden/town/town-obstacles.json` (~130 KB): the town's own frame (x east, z south, y up), metres.

- `building`: four corners, floor and top.
- `barrier`: a line with height, thickness, kind and `passable` (`small` under a fence, through a hedge or railings; `climber` over a garden wall or fence; `flyer` over anything but a net). Zoo fences and aviary nets are `hard` for the zoo's residents.
- `water`: the canal, millpond, farm pond, harbour and the zoo's pools; walkers cross only at `bridges` (4).
- `tree`: trunk radius.
- `enclosure`: each open zoo enclosure's mask (closed plots are lawn: `townObstacles(plan, open)`).
- `gates`: each front garden's gate on the pavement.

## 7. Validator and tests

`npx tsx scripts/ark-town-plan.mts --validate --real <snapshot>` (the real snapshot read in place, only its house and farm counts) and the unit tests (`npx tsx --test src/lib/ark-town-island.test.ts`, 11 tests). The validator checks:

- the plan is whole (nothing it asked for left out);
- counts (about 120 homes, 360 households, 10 farms with 2 farmsteads, land 8–14 ha);
- no overlaps between buildings, enclosures and farms; nothing on a street, in the water or past the coast;
- the zoo's 13 types, plots as declared and named the server's way, launch openings that hold today's residents, every spot inside its mask, the spares taking overflow enclosures;
- capacity at today, 3× and a year (house outdoor spots for 20% outdoors at once, farms, garden and urban wildlife spots) and against the real snapshot's 1,047 house and 145 farm residents (2.91 per household);
- at least 3 tall perches.

Today: **0 errors, 5 warnings**. The warnings are aviary, savanna, children's farm, small mammals, and bears and wolves past their room at a year (decision 23).

## 8. Visual check

`npx tsx scripts/ark-town.mts visual [--update]`: four shots (`island_far`, `old_town`, `zoo`, `homes_night`) at 800 × 500 on the medium tier, on SwiftShader, the island clock frozen per shot, without the photographed sky (nothing loads after mount), compared with `tests/ark-visual/town/*.webp` with the Ark visual CI's measures and default limits. Accepted after two identical renders. Hooked into the Ark visual CI's `hooks.json`.

## 9. Performance per tier

`npx tsx scripts/ark-town.mts perf`: the town's page flying the flythrough's route (the harbour, the canal, the high street, the zoo, the farmland, the homes, morning to night) in real time, 20 s a run, headless Chromium on the Mac's GPU (Metal). The phone runs are 360 × 800 at 2×, touch, with the CPU throttled 4×. **The shared Mac was under a load average of 136–245 throughout**, so these are pessimistic. Emulation is not a real phone.

| Device, tier | Frame rate | Median / p95 / p99 frame (ms) | Peak JS heap | Draw calls | Triangles drawn | Chunks drawn | Trees |
|---|---:|---|---:|---:|---:|---:|---:|
| Desktop, high (shadows 2048, ×2) | 57.5 (vsync) | 16.7 / 17.7 / 18.3 | 128 MB | 419 | 1.10 M | 76 / 76 | 345 |
| Desktop, medium (shadows 1024) | 59.5 (vsync) | 16.7 / 18.2 / 18.6 | 159 MB | 203 | 550 k | 76 / 76 | 345 |
| Desktop, low (no shadows) | 57.1 (vsync) | 16.7 / 18.4 / 18.6 | 156 MB | 152 | 340 k | 76 / 76 | 224 |
| Phone, medium | 50.0 | 21.1 / 29.3 / 35.2 | 157 MB | 132 | 401 k | 76 / 76 | 345 |
| Phone, low | 48.7 | 20.0 / 30.8 / 37.1 | 155 MB | 79 | 185 k | 76 / 76 | 224 |

- **Memory against Part B's budgets** (heap 512 / 320 / 200 MB): every tier is under, the low tier at 155 MB of 200. The town's geometry and instance buffers are ~26 MB (the GPU estimate counts buffers, not the shadow map or the sky's light).
- **Mount**: 1.5–2.3 s to build the whole island on the page's main thread (the ground's 187,000 samples, the scenery, 161 buildings). A worker prebuild like the wild island's (`runtime/prebuild.ts`) is the next step if a phone needs it.
- **Render distance**: every chunk with content is within every tier's distance (440 m on low) from every view on this route, so Part B's haze never shows on the town. The low tier cuts trees to 60% and small props to half instead.
- **Draw calls**: per chunk, the ground tile and one mesh each for decals, solids, glass and nets; the zoo's meshes; one instanced set per tree kind and per prop. Shadows double the solids' calls on high and medium.

## 10. Not in this lane

- The crossing and the horizon silhouette; `?island=` and `?focus=`; My animals and the population panel across islands; the director (the islands-on-the-web lane). It builds on `islands/index.ts`.
- The server's island, area and enclosure fields and the routing (`ark-islands-server`). This lane reads `island: wild | town`, `area: house | farm | zoo` and `enclosure: <type>-<n>` with the server's 13 type ids.
- Animals on the town island: placement reads `areas.ts`; the behaviour and nav lanes read the spots, masks and footprints.
