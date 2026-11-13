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

MEASUREMENTS

## 4. Gates

GATES

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
