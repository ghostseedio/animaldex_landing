# Grounding and perching (motion 100x pass, lane L3)

Owner: "animals float or sink; tree animals aren't properly on branches." Brief §2. Branch `ark-grounding`.

## What was wrong (measured, not guessed)
1. **The drawn ground is not the ground the animals were put on.** The terrain is drawn as one mesh of 1.1 m
   triangles (`terrain.ts`, 240 × 240 cells), but placement and the schedule read the analytic height (and a 0.5 m
   bilinear lattice of it). On a ridge the triangles cut under the analytic surface (animals float), in a hollow they
   bridge over it (animals sink), and at a cliff band they differ by metres (a bat's den and two vipers stood 1 to
   2 m inside the drawn ground).
2. **No lean to the slope far off, and only along the body close by**: a big animal on a cross slope had its uphill
   feet in the ground; past the near level it stood level on any slope.
3. **Perched animals on the schedule were drawn upright.** `fromSchedule` dropped the schedule's surface normal, so a
   woodpecker "on" bark, a gecko on a wall, a lizard on a rock face stood upright with half its body through the
   surface; a percher on a branch stood still while its branch swayed away under it in the wind.
4. **Most perches are inside the crown.** 61% of the asset trees' branch points and 57% of their limb points have
   every sight line blocked by their own tree (measured with tree-attach's own openness test): a bird or monkey
   placed there is hidden in the leaves.
5. **Gripping rigs put their bone pivots on the branch**, not their soles: the toes sank into the wood by the foot's
   depth (a barn owl's grip bones sit 6.8% of its height above its soles).
6. **Bounding-box floors**: every model stood on the bounding box's lowest point of whichever level loaded first;
   a tail or a wingtip below the feet lifts the feet off the ground, and the near and far meshes differ.

## What grounding does
- `scripts/ark-grounding-bases.mjs` reads every live model (bucket `v1/ark` near and far, `ark-rig/v2` else `v1`;
  read-only downloads, cached) and writes `src/ark-scene/grounding/model-base.json`: per model and level the true
  base (the lowest level whose contacts surround the surface's middle seen from above), the footprint there, the
  mesh size and plan; per rig the rest sole, the grip bones' pivot-to-sole drop and each standing clip's mean sole
  offset. Model units: they scale with whatever size the scene draws (lane L4's true sizes change the scale only).
- `grounding/drawn-ground.ts`: the drawn mesh's own triangle height and normal anywhere (tested vertex for vertex
  and inside triangles against `groundArrays()`).
- `grounding/stand.ts`: `standOnGround` (the footprint on the drawn ground, pitch along and roll across the slope,
  lifted until the highest-standing contact touches: nothing sinks), `scheduleSurface` (a surface frame: back along
  the normal, up a trunk on anything steeper than 60°).
- `grounding/hook.ts`: the scene's small named calls (`groundedStand`, `groundedLevelBase`, `scheduledPerch`,
  `gripSoleDrop`, `standsOnGround`), the runtime check (`?grounding=1`; `window.__arkGrounding`), and the
  before/after switch (`?grounding=legacy`, development only).
- `grounding/audit.ts` + `scripts/ark-grounding-audit.mts`: every animal of a snapshot through an Ark day, legacy
  and grounded rules side by side: floating, sinking and inside-scenery counts.
- `map/validate-grounding.ts` + `src/lib/ark-grounding.test.ts`: the same on every catalogue species in CI.
- `scripts/ark-grounding-shots.mjs`: before/after stills and videos on the real snapshot, and the runtime check
  over a tour of the island.

## Perches on real branches
- tree-attach generator 7 (`scripts/ark-tree-attach.mjs`): every branch, limb and hang point's `open` (the share of
  sight lines out of its tree), and up to 10 outer-crown perches a tree (thin wood tops of 0.6 to 5 cm radius, half the
  sight lines open, 30 cm clear above), written as `branch` rows with their radius and room. 210 perches added; visible
  branch points 390 of 696, limbs 109 of 268, hang points 156 of 187.
- `grounding/perch.ts` + `sampler.ts`: a point hidden in its crown (open under 0.25) keeps to bodies of 6 cm and
  under (20 cm under a limb: roosting bats); the visible ones come first under each tree's cap.
- On the schedule a percher, climber or clinger is drawn on its point's surface (`scheduledPerch`), moving with its
  branch in the wind, its gripping feet's soles on the wood.

## Numbers (2026-11-12; 24 samples through an Ark day; legacy → grounded on the same poses)
- Real snapshot (3,137 animals, near level): floating 145 → 0, sinking 280 → 0, inside scenery 298 → 175 (all at
  rest on the ground beside a trunk or at a rock's foot: the schedule's rest and roost spots, lane L5's colliders).
- Every catalogue species (the validator's 5,230 animals): floating 422 → 0, sinking 1,070 → 0, inside 881 → 556
  (the same kind). CI (`src/lib/ark-grounding.test.ts`): floating and sinking 0, nothing off the ground inside
  scenery, at rest inside no more than `GROUNDING_INSIDE_AT_REST` (556; lower it as L5 lands).
- Hidden in a crown: 412 samples over 23 species with the old perch choice → 0. Upright through a trunk, wall or rock
  face: ~2,400 samples over 81 species → 0.
- Runtime check (drawn matrices, 6 views of the real snapshot): sinking 73 of 163 drawn → 5 of 187.
- Reproduce: `npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-grounding-audit.mts public/ark-local/real.json`
  (`--validator` for every species, `--level far`); `node scripts/ark-grounding-shots.mjs --snapshot <file> --out <dir>`.

## Also changed
- `behaviour-schedule.ts` placeNear: a goal no longer falls back to a tree perch that does not suit the body (a
  pelican on a twig, a crane in a crown); it takes another goal.

## For the other lanes
- **L1 (foot IK):** `setLocoGround(drawnGround)` (from `grounding/drawn-ground.ts`; it already returns
  `{height, nx, ny, nz}`) so feet plant on the drawn triangles, not the analytic surface (they differ by metres at
  cliff bands). The body's origin comes from `groundedStand` before the IK; `model-base.json` rigs give the soles.
- **L4 (true sizing):** nothing to recompute: bases are model units, scaled by `display / bodyAxisExtent`.
- **L6 (scenery):** perch openness and the outer-crown perches go on top of tree-attach generator 6.
