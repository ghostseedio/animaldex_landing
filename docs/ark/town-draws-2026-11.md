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
     chunk keeps its group for its buildings' near detail (which keeps the solid material itself, so it is drawn before
     the walls' batch: measured closest to before); each chunk's windows are lit in its band's panes batch at its own
     vertices (a test compares every band's lit array with the chunks' own).
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

LEFT

## 6. Decisions

DECISIONS
