# Ark Part C: the two islands in one world (lane T3)

Branch `ark-islands-scene` (landing). This lane covers the town's animals, the camera and frame across both islands, the page, the zoo's day and the director. It builds on the town lane's island (`docs/ark/town-island.md`), the server's island fields (AnimalDex `docs/ark/islands-server.md`) and Part B's streaming (`docs/ark/streaming.md`).

**The owner's design (decision 141):** "the second island should be pannable from the first island, they should be visibly next to each other." So there is **one world with both islands in it**. The first cut loaded one island at a time and remounted the scene across a hazed crossing; decision T3-5 is reversed.

**Islands off is byte-identical.** Without the server's `island` fields there is one island, and every path below is skipped: `mountArk` has no `island`, the wild sea's island patch is off, the nav grid uses the wild terrain's extent, and the colliders are the wild set.

## 1. The frame

- **The wild island** sits at the world origin, as always.
- **The town's local origin** is at `townWorldOrigin()` = (508.6, −210.7) (`islands/index.ts`).
  - It lies along atan2(dz, dx) = −22.5° (east-north-east), at a distance of the wild island's land reach toward the town (90.25 m), plus a **250 m strait of sea**, plus the town's land reach back (210.25 m).
  - The reaches are measured at 0.25 m by `scripts/ark-islands-reach.mts`.
  - W1's bigger wild island passes its own `wildReachToward(θ)`, which moves the town out with the same strait.
- Each island keeps its own local frame. `islands/scene.ts` answers everything in the world frame (local + origin).

## 2. The scene (`mountArk` with `island`)

- **The world:** the wild world is built exactly as before. The town's meshes (the town lane's `buildTownIsland`) are placed at the town's origin.
- **One sea (decision 143).** The wild island's 4 km sea plane reads the town's sea floor over the town's square through new uniforms in its shader (`islandDepth`, `islandPatch`). The town's own sea plane is hidden.
  - **Fail-safe:** the patch applies only under the town's drawn chunks (`islandDrawn`, one texel a chunk, from the town's `drawnMask`).
  - A chunk that is not drawn, for any reason, shows the open sea, never the town's shallows. Before this, those read as a white shape with the canal and the harbour as lines.
- **The ground:** `heightAt` composes the two. Inside the town's square it is the town's ground; elsewhere the wild island's. The runtime camera's floor uses the same.
- **Animals:** both islands' animals are in the snapshot and go through the one pipeline.
  - **Placement** (`placeAll`): the wild island's by its map, as before; the town's by `islands/town/placement.ts`, in the world frame.
  - **Behaviour:** each animal's schedule reads its own island's behaviour world (`worldOf`).
    - The town's world is its sampler (`islands/town/sampler.ts`) in the world frame: places from its spots and trees, and its obstacles on a 1 m raster.
    - Its walk grid covers its own square, centred on the town (`ArkWorldSampler.half` and `centre`), with L5's clearance against the town's own colliders.
    - It is built after the wild island's world, and both are ready together.
  - **Colliders** (L5's `collide/`, per island): the town's set (`islands/town/colliders.ts`, from the town lane's obstacle footprints) answers inside its square (`setIslandColliders`). Zoo fences and nets are hard.
  - **Live budget:** the town's animals are left out of the wild island's per-zone visible capacity.
- **Camera:**
  - The target is kept in a capsule over both islands and the strait. The furthest view is 900 m with two islands.
  - `flyToIsland(id)` flies to an island's whole view (`islandView`).
  - `onIslandNear` reports the island nearer the target along the strait.
- **Default view** (decision 142): on desktop the wild island's view is turned 45% of the way toward the town, moved 45 m toward it, and lifted to polar 1.15, so the town stands across the strait in the upper right. Upright phones keep the wild island's own framing, and the town is a pan away. `openIsland: "town"` opens on the town's view instead (decision 26).
- **Part B:** `streamer.registerIsland({id: "town", offset, grid, spans, content, apply})` is called when the multi-island streamer is there. Until then, the town's square counts as drawn in full.
  - The island the camera is not over is map style everywhere, never out (`chunkStates` with `capMap`). The other island stays in the picture whatever the map distance.
  - Why: on v2 at the low tier with the render scale at 0.6, the map distance (960 m) left 57 of the town's 81 chunks out from the two-island view.
- **v2 on upright phones (decision 234):** the view is from 900 m at polar 1.0, and the clear fog is pushed from 520 m of reach (`fogFrom` in `islands/views.ts`).
  - The town's near quarter and middle are under 20 % fog (15 %; it was 41 %). The wild island's middle is clear (it was 6 %).
  - The check is in `src/lib/ark-wild-frame.test.ts`. v1 and islands off are unchanged.

## 2b. The town's join (decision 153, then the town-join cut)

The wild island draws its first frame exactly as with one island. The town joins the live scene after that frame. The work before the join runs off the frame:

1. **Worker start.** The town's worker (`islands/town/prebuild-worker.ts`, built as `ark-town-worker.js`) starts beside the wild island's prebuild (`archipelago.ts` `startTownWork`). It works out:
   - the plan and areas;
   - the ground grid;
   - the scenery and buildings;
   - the zoo;
   - the places;
   - the behaviour raster and colliders.

   It keeps the answer and says `ready` (`prebuild.ts` `startTown`, the request's `hold`).
2. **Early collect.** If the answer is ready while the main thread only waits for the wild island's workers, the page takes it then (`collect`). It also makes the town's meshes, colliders and behaviour world then (`makeTown`, in idle slices of about 8 ms).
3. **Late collect.** If the answer is not ready by then, all of this waits for the first frame. After the first frame the slices run as user-blocking tasks (`islands/scene.ts` `nextTask`). Idle callbacks and plain tasks ran 0.9 to 1.2 s late there on the phone profile, because the live scene's frames and the page's loading leave no idle time.
4. **Attach.** The attach is a task of its own, right after the first frame.

**The worker's arithmetic.** The geometry's nearest-point searches skip polyline segments by their bounds (`geom.ts` `polylineNearest`, `polylineDistance`, `polylineWithin`). FNV-1a's shared prefixes are hashed once (`hashTextPrefix`, `hashTextOn`). Each surface's colour is parsed once.
- The answers are exact. `src/lib/ark-town-prebuild-speed.test.ts` checks the searches against the plain scan at more than 300,000 points on every town line, and on odd lines (single points, repeats, NaN). It checks the hashes on edge texts.
- The same test checks the town's prebuild against the digests recorded before the change (plan, areas, ground, scenery and buildings, zoo, places, on the fixture).
- On the real snapshot, all nine parts digest as before, including the raster and colliders.
- When the town is changed on purpose, update `TOWN_DIGESTS` with the change.

**Measured (production bundles of the embed, the real snapshot and T1's routing, interleaved runs, this Mac at load 21–30).**
- The phone profile is 360x800 at DPR 2 with 4x CPU. Chrome's CPU throttle does not reach dedicated workers, so the worker's own times below are unthrottled on both profiles. A real phone's worker would take about 4x.

| | Worker (ms) | First frame | Town joined | After the first frame |
|---|---|---|---|---|
| Before, desktop | 1,630–2,001 (answer 1.8–2.4 s after asking) | 3.7–3.9 s | 6.0–7.7 s | 2.3–3.8 s |
| After, desktop | 312–345 | 3.7–3.8 s | 3.75–3.84 s | 0.04–0.05 s |
| Before, phone profile | 1,196–1,334 (answer 2.5–2.8 s after asking) | 6.5–7.1 s | 10.8–11.8 s | 4.0–4.9 s |
| After, phone profile | 306–345 | 6.6–7.1 s | 6.7–7.3 s | 0.13–0.15 s |
| After, phone profile, answer after the wild prebuild (late path) | 316–323 | 6.9–7.3 s | 8.6–8.8 s | 1.3–1.9 s |

- **The worker's steps** (ms, desktop, before → after):

  | Step | Before | After |
  |---|---|---|
  | plan | 290 | 53–57 |
  | areas | 29 | 10 |
  | ground grid | 798 | 86–91 |
  | scenery | 218 | 37–41 |
  | buildings | 55 | 30–35 |
  | zoo | 31 | 17–20 |
  | places | 215 | 63–69 |
  | behaviour raster | 48 | 10 |
  | colliders | 12 | 2 |

- **First frame and long tasks:** the first frame and the long tasks before it are unchanged. After the first frame the town adds only the attach (about 100 ms on the phone profile, about 30 ms on desktop).
- **The 35–102 s join on the dev page under load** is not seen with production bundles: the worker answered in 1.8–2.8 s. The rest is likely the dev server and the load: `next dev` compiles chunks on demand, including the imports made after the worker's answer, and the Mac was at load 40 or more.
- **Commands:**
  - `scripts/ark-town-prebuild-bench.mts`: each step in Node, with digests (`ARK_DIGEST=1`).
  - `scripts/ark-town-join-probe.mts`: the embed's timeline from the `ark:town:joined` mark, which a production bundle sets too, plus the long tasks.

## 3. The town's animals (`islands/town/placement.ts`)

| Area | Where | Range |
|---|---|---|
| House (pets) | its household (`householdOf`, rendezvous hash): an outdoor spot of that home (garden, yard, balcony, courtyard), or its window if kept indoors (fish, caged birds, small reptiles and rodents, invertebrates: kept still) | garden 5 m, yard 2.5 m, balcony 0.6 m |
| Farm | its farm (`farmOf`): paddock for grazers, run for poultry, else the yard | paddock 9 m, run 3 m, yard 5 m |
| Zoo | its enclosure (`voyage_animals.enclosure`; past every plot, its type's last plot): a spot inside the mask, the pool for swimmers (floating at the raised pool's water) | the enclosure's inner radius; the pose is held inside the mask (`bound`) |
| Town wildlife | its kind's niche (`urbanNiche`), else its zone; a cluster per the server's zone slot | 8 m, 1.5 m on roofs, eaves and ledges |

Every spot is chosen by a hash of the animal's id (or of its cluster's key), so it is the same for every viewer, and nobody moves when others arrive or leave. Swimmers in the town float at their spot's surface, because the scene's water pose is the sea's.

## 4. The zoo's day (`islands/town/zoo-life.ts`, `render/zoo-life.ts`)

- **Feeding times** run on the island clock, half an hour each, at the type's hours (`zoo-types.ts`). The reptile house is fed once a week (Wednesday) and the big cats fast on Sunday.
- While fed, the food (fish, hay, meat, fruit, seed, insects, pellets) is down at the station and eaten away over the window. The residents' schedules take the station as their home (`feedingAnimal`: one variant object per animal, decided at the slot's start). A feeding's first and last slots start where the slot before ended, for every viewer alike.
- **Enrichment:** every open enclosure's props are one merged mesh (puzzle feeders, hay nets, balls, hammocks, climbing frames, scent posts, salt licks, burrow boxes, heat lamps, perches, bathing pools, fruit skewers, feeders, hollow logs, scatter feed). An ice block in the bears', penguins' and big cats' enclosures melts through the day. The zoo's day costs two draw calls.
- A pinned hour (`?hour=`) pins the town's day too.

## 5. The page

- `/ark` mounts `islands/archipelago.ts`, a thin wrapper.
  - With two islands it builds the town first, then the one scene.
  - It opens on `?island=`, else the focused animal's island, else the island with most of the viewer's animals (decision 26).
- **Toolbar:** "Wild island N | Town and zoo N", as camera flights.
- **`?focus=`** takes an animal's id as well as a species. Selecting an animal anywhere flies there, across the strait if need be.
- **"My animals"** (with its switch on): the viewer's animals grouped by place across both islands. Each one flies to its animal.
- **The population panel:** "this island" (the one the view is over) or "Both islands".
  - On the town it lists by place (decision T3-6): Homes, Farms, the zoo by enclosure type, then town wildlife by niche (gardens and parks, canal and ponds, roofs and towers, walls and eaves, streets and harbour).
- **Data:** the page keeps reading the whole read (`voyage_public_v2` carries `island`, `area` and `enclosure` once the switch is on) and slices it on the client (`lib/ark-islands.ts`). `voyage_public_v3` is for lighter reads.
- **Words:** `ark.islands.*` in `en.json`; other languages fall back to English.
- **Development preview:** `/ark?snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json` merges T1's routing (from a rolled-back switch-on) by id at read time. Both files live in the gitignored `public/ark-local/` and are never committed.

## 5b. The apps' embed (`public/ark/embed.html`)

- **Mount:** the embed mounts `mountArchipelago` (from the bundle's `window.AnimalDexArk`) with the same options as before, plus `openOn` (decision 26) and its own worker files (`./ark-prebuild-worker.js`, `./ark-prebuild-places-worker.js`, `./ark-town-worker.js`).
  - With one island it is `mountArk` exactly as before.
  - With two islands the wild island draws first without the hamlet (the Meadow labels, `wildIslandRegions`), and the town is built in its worker and joins across the strait. The phone's default view looks over the strait (decision 154).
- **The apps' messages:**
  - `ark:visible` and `ark:power` that arrive before the scene is up are held, then replayed (as before).
  - `ark:select` (focus links), `ark:mine`, `ark:region`, `ark:herd`, `ark:lite` and `ark:reset` go to the world's handle while it mounts, which passes them on once the scene is up.
  - A focus link sent before the first read is held for the mount.
  - A focus link to a town animal waits until the town's animals have all joined (`attachIsland`'s `joined`), then flies across.
  - `?lang=` and `?regions=1` are unchanged.
- **Development preview:** `/ark/embed.html?snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json` (a dev bundle only; production ignores `?islands=`).
- **Check:** `scripts/ark-islands-embed-check.mts` runs the embed at 390x844 with the Android bridge. It checks the held power message, visible/hidden, a launch focus link to a zoo animal, a select back to the wild island, reset, and that there are no page errors. Pass `ARK_IDS="<zoo id> <wild id>"`.

## 6. The director

- **Recorder:** the clip recorder builds the town across the strait when the Ark has two islands.
- **The `islands` shot:** the wild island's view, up over the strait, then down onto the town, with captions from the two islands' counts. On one island it is the same flight over the one island.
- **Other shots:** every other shot finds its subject on either island, because both are in the one scene.

## 7. Tests

`src/lib/ark-islands.test.ts` covers:
- islands off unchanged;
- v3's shape decoded;
- `where` and `?focus=<animal>`;
- decision 26;
- My animals by place;
- town placement: households, farms, zoo masks, determinism, and nobody moving;
- the routing merge;
- the real Ark with T1's routing read in place: wild 707, town 2,438, zoo 499, 32 enclosures, every zoo animal inside its mask;
- the panel by place;
- the town's schedule world at its origin, with zoo trips inside the enclosure;
- the zoo's feeding times;
- the director's shot.

The town lane's test, the clip tests, collide, behaviour-build and recipes also run on this branch.
