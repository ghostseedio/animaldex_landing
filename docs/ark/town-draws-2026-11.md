# The town's draw calls on phones (2026-11)

The mobile performance lane (`perf-audit-mobile-2026-11.md` §7.1) left the town's draw calls as the largest cost on
every phone: about 300 of the ~440 calls a frame on the low tier, ~10 ms a frame on the low phone profile (6× CPU), all
of them paid while the town stands across the strait. This lane (branch `ark-town-draws`, landing, from
`ark-perf-mobile` 87ddc3e9) cuts them, and defers the town's heavy downloads until the camera comes near it. Rendering
only: the same triangles, culled, streamed and lit per chunk as before; nothing the server, the shared world or the
collision and behaviour audits see changes.

## 1. Where the town's calls went (before)

One frame on the low tier, the dev embed on the real Ark (`--population-file`, 3,145 animals), counted by the object that
drew them (every mesh's `onBeforeRender` wrapped for a few frames; `renderer.info` for the totals):

| | Default view (the wild island, the town across the strait) | The town's own view (`openOn: town`) |
|---|---|---|
| All calls (`renderer.info`) | 445 | 240 |
| The town's objects drawn | 319, and 45 empty instanced sets | 201, and 45 empty sets |
| Chunk layers: ground / paving / solids / panes / foliage / glass | 75 / 49 / 38 / 32 / 24 / 5 = 223 | 39 / 26 / 27 / 21 / 12 / 5 = 130 |
| The zoo: nets (two passes) / solids / decals / houses / life, pet homes | 20 / 10 / 10 / 6 / 6 | 8 / 5 / 4 / 6 / 6 |
| Trees and plants (an instanced set per asset and level) | 30 | 30 |
| Empty instanced sets (three still sets up their program and uniforms) | 38 car sets, 5 close-up kinds, 3 props | the same |

And before the first frame, the town's tree and plant library (122 files, **4.56 MB**: every level of every asset) and
the cars' models (`vehicles.bin`, 0.3 MB), read at once with the town's build, beside the wild island's first models.

## 2. What changed

1. **The chunk layers in band batches** (`islands/town/render/batches.ts`). Each band of three chunk rows (27 chunks) draws
   each layer (ground, paving, solids, glass, foliage, panes) as one `BatchedMesh` with a chunk an instance: one
   multi-draw a band and layer, ≤ 18 for the whole town instead of ~220.
   - *The same picture*: three's own per-object frustum test (each chunk's bounding sphere, the shadow camera's too) and
     opaque front-to-back order, per chunk inside the batch; the layer's own material (copied: its patches and program
     key chained, so its other users never switch programs), with the batching transform replaced by the identity
     (every chunk is already in the town's frame: no per-vertex texture reads; the batching textures are never bound or
     uploaded); a depth material of the batches' own for the shadow pass.
   - *Streaming, the near detail, window lighting*: a chunk the streamer does not draw is an invisible instance; each
     chunk keeps its group for its buildings' near detail, drawn with its own copy of the solid material (the same
     program) made right after the walls' batch material: its trim is drawn after the walls it lies on (before, sorted by
     depth with its chunk's walls, coplanar trim such as a shop's striped awning lost to them in some views), still
     before the glass and panes; each chunk's windows are lit in its band's panes batch at its own vertices (a test
     compares every band's lit array with the chunks' own); the walk surfaces read the same paving triangles in the same
     order (the batches keep the layer's mesh name, "decal"; a test compares them).
   - *Phones without `WEBGL_multi_draw`*: three loops the ranges inside the one object; the per-object work (the cost
     here) is still saved.
   - *Memory*: a band's arrays are exactly its chunks' (16-bit indices for the ground: 27 tiles are 64,827 vertices), the
     chunks' own copies let go once batched; the foliage's still let go once on the GPU, as before.
   - *Uploads spread*: a band's layer is uploaded the first frame it is drawn (≤ ~3.6 MB). While the town joins (decision
     153, three chunks a frame) the town lets the batches in one a reveal step (`setRevealed`), never two first uploads in
     one frame.
2. **The zoo's** decals, solids, glass and foliage batched the same way (an instance a chunk); its nets as two batches,
   their back faces then their front faces, sharing one geometry (as three's two passes and `runtime/two-sided.ts` draw
   a two-sided transparent mesh): 20 calls with the whole zoo in view become 2.
3. **Empty instanced sets not drawn**: the cars' sets (38 at a distance) and the close-up detail's empty kinds (the
   leaves keep the camera hook). Three sets up an empty instanced mesh's program and uniforms every frame.
4. **The town's heavy downloads deferred until it is near**:
   - *trees and plants*: only each asset's farthest level (the crossed card; a plant's lightest level) is read at once,
     0.17 MB for the whole town; a nearer level is read once an instance comes within its hand-over + 100 m
     (`LEVEL_LEAD`); until then its instances draw the next level out. From the wild island, none is read.
   - *the cars' models*: read once the camera is within 230 m of the town's square (the highest tier's middle distance,
     80 m, where the first car leaves its proxy, plus a lead). Every car beyond the middle distance is its proxy, made
     from the same boxes before and after.
   - The workbench's shots (`scripts/ark-town.mts`) wait for the levels their view asks for.
5. **The harness** (`scripts/ark-runtime-measure.mjs`): `--view town` (the embed opens on the town, as for a reader whose
   animals live there) and `--view town-close --select <id>` (and, once the town has joined, a close-up of one of its
   animals).

## 3. Before and after

Every pair ran back to back, the base (`ark-perf-mobile` 87ddc3e9) then the branch, on the production embed with the real
Ark read in place (`scripts/ark-runtime-measure.mjs --page embed --population-file <real snapshot> --production --perf
--interact`), steady play from 60–70 s after the first frame. *Views*: the default (the wild island, the town across the
strait), the town's own view (`--view town`), and a close-up of one of its animals (`--view town-close --select`, a house
cat, from 10 s after the town joined). The Mac ran other agents' work throughout (load average 5–925): the intervals and
fps swing with it, and the pacing's 30 fps lock caught a few of the loaded runs (repeated when the load dropped); read the
frame work, the render section and the calls first. *Calls* count every pass (`renderer.info`); with `WEBGL_multi_draw` a
batch is one.

**The town's own draws** (§1's count, the dev embed, low tier): default view 319 objects + 45 empty sets → **77**; the
town's view 201 + 45 → ~75. All calls a frame: 445 → 203 (default view).

| Profile | Build | Tier at end | fps | Interval p50 / p95 / p99 ms | > 33 ms | Frame work p50 / p95 ms | Calls (all passes) | Triangles | Render ms | KB before 1st frame |
|---|---|---|---|---|---|---|---|---|---|---|
| Low phone 6×, default view (run 1, load 85–460) | base | low | 51.7 | 16.7 / 33.4 / 33.4 | 0.1% | 15.2 / 19 | 433 | 1.08 M | 11.66 | 21,453 |
|  | after | low | 58.4 | 16.7 / 16.8 / 33.3 | 0.2% | 11.5 / 14.9 | 206 | 1.08 M | 8.32 | 14,777 |
| Low phone 6×, default view (run 2, load ~5) | base | low | 59.7 | 16.7 / 16.7 / 16.8 | 0.1% | 10.6 / 14.1 | 423 | 1.06 M | 8.18 | 18,804 |
|  | after | low | 59.9 | 16.7 / 16.7 / 16.8 | 0% | 7.5 / 10.8 | 196 | 1.01 M | 5.53 | 14,477 |
| Phone 4×, low tier pinned, default view | base | low | 42.8 | 16.7 / 33.4 / 33.4 | 0% | 13.5 / 16.1 | 446 | 1.10 M | 10.33 | 18,768 |
|  | after | low | 60 | 16.7 / 16.8 / 16.8 | 0% | 7.6 / 9.8 | 196 | 1.09 M | 5.35 | 16,025 |
| Phone 4×, medium tier pinned, default view | base | medium | 59.7 | 16.7 / 16.8 / 16.8 | 0.1% | 15 / 17.8 | 485 | 1.22 M | 11.18 | 21,537 |
|  | after | medium | 51.3 | 16.7 / 33.4 / 33.4 | 0.4% | 10.9 / 14 | 300 | 1.31 M | 7.41 | 14,396 |
| Phone 4×, auto tier, default view (run 1) | base | low | 60 | 16.7 / 16.7 / 16.8 | 0% | 10.2 / 12.7 | 430 | 1.07 M | 7.73 | 18,767 |
|  | after | medium | 43.9 | 16.7 / 33.4 / 50 | 1.5% | 12.9 / 19 | 213 | 1.10 M | 8.66 | 14,396 |
| Phone 4×, auto tier, default view (run 2) | base | low | 60 | 16.7 / 16.7 / 16.8 | 0% | 8.3 / 11.8 | 435 | 1.08 M | 6.32 | 18,784 |
|  | after | medium | 60 | 16.7 / 16.7 / 16.8 | 0% | 8 / 10.7 | 215 | 1.09 M | 5.4 | 14,396 |
| Low phone 6×, town view (run 1, load to 420) | base | low | 58.9 | 16.7 / 16.8 / 33.3 | 0% | 11.8 / 15.4 | 244 | 0.53 M | 8.71 | 18,768 |
|  | after | low | 47.9 | 16.7 / 33.4 / 33.4 | 0.2% | 10.4 / 16.7 | 116 | 0.76 M | 7.45 | 14,530 |
| Low phone 6×, town view (run 2) | base | low | 59.8 | 16.7 / 16.8 / 16.8 | 0% | 10.7 / 13.9 | 240 | 0.53 M | 7.8 | 18,768 |
|  | after | low | 59.9 | 16.7 / 16.7 / 16.8 | 0% | 9.3 / 12.7 | 116 | 0.77 M | 6.24 | 17,058 |
| Phone 4×, low pinned, town view | base | low | 60 | 16.7 / 16.8 / 16.8 | 0% | 8.9 / 10.4 | 327 | 0.76 M | 6.66 | 18,767 |
|  | after | low | 60 | 16.7 / 16.7 / 16.8 | 0% | 6.9 / 8.8 | 116 | 0.76 M | 4.58 | 15,701 |
| Phone 4×, medium pinned, town view | base | medium | 56.7 | 16.7 / 33.3 / 33.4 | 0% | 11.8 / 14.3 | 335 | 0.76 M | 8.56 | 18,768 |
|  | after | medium | 59.4 | 16.7 / 16.8 / 16.8 | 0.1% | 8.4 / 11.1 | 124 | 0.76 M | 5.42 | 14,396 |
| Phone 4×, auto, town view | base | medium | 60 | 16.7 / 16.7 / 16.8 | 0% | 11.2 / 15.2 | 423 | 1.02 M | 7.86 | 18,768 |
|  | after | medium | 60 | 16.7 / 16.7 / 16.8 | 0% | 6.6 / 9.2 | 147 | 1.02 M | 4.23 | 14,396 |
| Low phone 6×, town close-up (run 1, loaded Mac) | base | low | 34.3 | 33.3 / 33.4 / 49.9 | 1.1% | 16.9 / 21 | 293 | 0.86 M | 9.6 | 18,805 |
|  | after | low | 30.4 | 33.3 / 33.4 / 50 | 1.8% | 19.9 / 26.7 | 228 | 0.86 M | 10.09 | 14,510 |
| Low phone 6×, town close-up (run 2, load ~5) | base | low | 47.3 | 16.7 / 33.4 / 33.4 | 0.3% | 15.6 / 19.4 | 296 | 0.86 M | 9 | 19,182 |
|  | after | low | 55.8 | 16.7 / 33.3 / 33.4 | 0.1% | 12.9 / 16.6 | 226 | 0.86 M | 7.15 | 14,396 |
| Phone 4×, auto, town close-up | base | low | 55.6 | 16.7 / 33.3 / 33.4 | 0.6% | 11.3 / 14 | 292 | 0.86 M | 6.45 | 18,768 |
|  | after | low | 59.3 | 16.7 / 16.8 / 33.3 | 0% | 10 / 12.6 | 227 | 0.86 M | 5.36 | 14,396 |

| Low phone 6×, forced collections | Build | Heap after GC, first frame MB | Heap after GC, steady play (120 s) MB |
|---|---|---|---|
| Default view | base | 300.5 | 280.3 |
|  | after | 267.5 | 275.9 |
| Town view | base | 301.6 | 283.1 |
|  | after | 267.7 | 282.7 |

- *The phone on the auto tier* ends on the medium tier after the change, the low tier before: with the town's draws gone the
  pacing keeps the medium tier (its scenery and shadows) at 60 fps with less frame work than the base's low tier (run 2:
  8.0 / 10.7 ms against 8.3 / 11.8). Run 1 caught a loaded minute (44 fps, the medium tier's work 12.9 / 19 ms).
- *The town view on the low phone* draws more triangles after (0.76 M against 0.53 M): the base's streamer pulled its
  render distance in under memory pressure (render scale 0.61–0.72: about 20 of the town's chunks not drawn), the branch's
  lower heap (below) leaves the whole town drawn. Still less render time and frame work.
- *Bytes before the first frame*: 4.4–6.7 MB fewer (the town's tree levels and the cars' models no longer read at the
  start; the wild island reads its own copies of the species it shares).
- *The join*: the worst task after the first frame is unchanged (0.9–1.8 s both, the behaviour world's build).

## 4. Gates

| Gate | Result |
|---|---|
| Types (`npx tsc --noEmit -p tsconfig.json`) | clean |
| Lint (`npm run lint`) | exit 0 (only the known `<img>` warnings, none in the changed files) |
| Unit and integration (`npx tsx --test 'src/lib/**/*.test.ts'`) | 2,640 tests: 2,638 pass, 0 fail, 2 skipped. The lane's own, `src/lib/ark-town-draws.test.ts` (7): one batch per band and layer with every chunk's geometry once (the same triangles per layer as the build data, each chunk's own bounds, 16-bit ground indices, no slack); the walk surfaces' triangles as before, in order; streaming hides instances and the join lets one batch in a step; every band's lit window array equal to the chunks' own at night; the batch material's identity transform with the material's patches and key; empty car sets not drawn and the models read only near; the trees' farthest level only, the nearer ones within reach |
| The town suites (`ark-town-*`, `ark-islands`, `ark-collide-town`, `ark-perf-mobile`) | all pass (included above) |
| Collision audit, three modes (CI's commands: islands v2, islands v1, today's) | base and branch **identical** (every report the same but `wallSeconds` and `workerMs`); all three checks pass |
| Motion: the default view ×2 (`ark-rig-scenes.mjs --island --seconds 60`) | base pace ratio median 0.93 / 0.97, over 1 s backwards 0 / 0; branch 0.93 / 0.95, 0 / 0 (that page is the wild island alone: none of this lane's code runs there); the motion-metrics hook green on GitHub |
| Visual CI on GitHub (accept run 43496333697 on f5dfc30a, the code as at the head) | **green**: the 19 golden shots within the limits against the baselines (worst 0.27%, the river pond; the page is the wild island alone), no page errors; **the town's set (hooks job, SwiftShader): island_far, old_town, zoo, homes_night all pass at 0% changed** (mean 0.54–0.78) |
| The town's visual shots here (Mac SwiftShader, base against branch) | island_far, old_town, zoo the same as the base's own pictures, homes_night 0.08% (the near detail's trim now drawn over its walls, lit windows the same) |
| Town stills (the town page, metal), base against branch | low tier on the phone: all 9 (day: island_far, old_town, zoo, high_street, homes; night: homes_night, town_night, street_shops_night, square_night) **pixel-identical**; high tier on the desktop: ≤ 0.05% changed, inside the base's own run-to-run spread (0.02–0.75%: the near detail is built a few buildings a frame, the finish's grain). Close-ups (street_level, pavement_close, street_night, park, canal_bridge) and the zoo's (zoo_aviary, aviary_close, zoo_savanna, zoo_penguins, zoo_enclosure) on the low tier pixel-identical |
| Heap (low phone, `--gc-points`, post-GC ≤ 384 MB, not above the base) | default view 267.5 / 275.9 MB (base 300.5 / 280.3); town view 267.7 / 282.7 MB (base 301.6 / 283.1) |
| Rendering only | the audits identical; the walk surfaces' triangles identical (test); streaming, near detail and window lighting per chunk (tests and stills) |

## 5. Left for later

1. **The trees' 25 card sets** (one instanced mesh per asset at the far level): the largest town item left at a
   distance (~25 calls). A batched version needs the wind shader's own patch (it reads `instanceMatrix`) and per-instance
   matrices (texture reads), in the asset system the wild island shares.
2. **The zoo's houses, the pet homes, the zoo's day, the props** (~20 calls), and the three empty prop sets (the join's
   reveal toggles their visibility, so they are left drawn).
3. **The chunks' CPU copies** (~25 MB of the heap: ground, paving, solids, panes) could be let go once on the GPU, as the
   foliage's are; kept here (memory-neutral rule; the walk surfaces read the paving's; raycasts and a lost context would
   need them).
4. **The paving texture and its transcoder** (1.1 MB, read when the town is first drawn) tint the town even from across
   the strait: deferring them would change the far picture, so they were left.
5. **The streamer's memory pull-in** draws a different share of the town from run to run on the low phone (its render
   scale 0.61-0.85 in the same view): the town view's numbers swing with it.

## 6. Decisions

| Question | Options | Choice | Why |
|---|---|---|---|
| How to merge the chunk layers | the audit's plan (shared attributes, a view per chunk, whole-range meshes while every town chunk is past the render distance); merged meshes per region; three's `BatchedMesh`, a chunk an instance | `BatchedMesh` per band and layer | One draw a band and layer in every view, the town's own view too (there every town chunk is within the phones' render distance, so the audit's plan saves nothing), with three's per-chunk culling and front-to-back order inside: the same triangles drawn. Regions would draw whole regions. |
| How big a batch | one per layer (6); a band of 3 rows (≤ 18); a row (≤ 54) | 3 bands of 27 chunks | 16-bit ground indices (64,827 vertices), first uploads ≤ 3.6 MB spread over the join, a coarse band-level cull first; ≤ 18 calls. |
| The batching transform | three's (5 texture reads a vertex, its textures uploaded each pass) | the identity in the shader | The chunks are in the town's frame already: the same picture, no added GPU work, nothing bound or uploaded a frame. |
| The batches' material | the layer's own; a copy | a copy, patches and key chained | A material shared by batched and plain objects costs a program look-up at each switch (what the mobile lane removed for two-sided meshes). |
| The near detail's order | the solid material (before the walls' batch); a copy after it | a copy after | Before, coplanar trim lost to its walls in some views (depth order); after them always: the zoo shot as before, homes_night 0.08% (trim shown). |
| The join (decision 153) | let the batches in when the town is whole; with their first chunk; one a reveal step | one a reveal step, band by band | At most one first upload a frame; the chunks still show three a frame, their layers within the band's first six steps. |
| The zoo's nets | per chunk (two passes each); one two-sided batch (two passes, two look-ups a frame); a back-faces and a front-faces batch sharing one geometry | the pair | As three's two passes, 20 calls to 2, no look-ups; the zoo stills on the low tier pixel-identical. |
| Empty instanced sets | leave; hide when empty | hide the cars' and the close-up kinds'; not the props' | Three sets up an empty instanced mesh every frame; the props' visibility is the join's. |
| What to defer | the town's whole build; its downloads | the trees' nearer levels (4.3 MB) and the cars' models (0.3 MB) | Neither shows from across the strait (cards; proxies beyond the middle distance). The town is in the phones' default view (its upper part), so its build is not deferred; the paving texture tints the far town, so it stays. |
| When the camera is "near" | in view; within a distance | trees: each level's hand-over + 100 m; cars: 230 m from the square | Read before needed on the way in; from the wild island, never. |
| The chunks' CPU copies | keep; let go once uploaded (~25 MB less heap) | keep (the foliage's let go, as before) | The memory rule is neutral; the walk surfaces read the paving's; raycasts and a lost context need them. A later choice. |
| How to measure the town | the measurement page's islands mode; the embed opened on the town; the host's select | the embed with `--view town` (`openOn`) and `--view town-close` (`ark:select` of a house cat, close up) | The apps' page and mount (the town in its worker); no product change. |
