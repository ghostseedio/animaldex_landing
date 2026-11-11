# Ark behaviour audit (owner's 7 problems): Step 1, IN PROGRESS (handover 2026-11-11)

Branch `ark-audit` = `origin/ark-release` (e99a6bf4) + this harness. Live = landing main 76a4f5d1.

## Harness
- `scripts/ark-behaviour-audit.mts` + `src/lib/ark-audit/*`: synthetic Ark of every catalogue species
  (`data/ark/behaviour-profiles.json`, 2,555 kept; 1 solitary / 2 pair / 4 social = 5,271 animals),
  predators arriving next to their prey (`data/ark/audit-predator-prey.json`, the ecology's food links,
  vertebrate plans, 412 predators). Headless, worker threads, the tree's own modules:
  `model-schedule.ts` (behaviour schedule trees) or `model-legacy.ts` (live main's rules, ported from
  index.ts@76a4f5d1). Pass A: 3 island days every 20 s; pass B: flyers every 1 s for 12 h.
  Output `<label>.json` + `.md`; `--compare live.json release.json` gives the before/after table.
- Live run: copy `scripts/ark-behaviour-audit*.{mts,mjs}` + `src/lib/ark-audit/` into a 76a4f5d1 worktree
  (uncommitted overlay), run there with `--profiles/--prey` pointing at this branch's data files.
- `scripts/ark-behaviour-audit-record.mjs`: clips of the 7 problems on `/ark?fixture=1` (v2 fixture:
  zebras, roe deer + eurasian wolves, mallards, eagles/hawk/owl/puffins), CDP screencast + ffmpeg.

## The model on the merged scene (2026-11-11, release integration)
On a tree with behaviour v2 (`spaceHomes` exported) `model-schedule.ts` mirrors that scene, not e99a6bf4's:
- `wireSchedules`: group members keep to their leader through the schedule (`ScheduleGroup`, no pose replay);
  predators' homes spaced from their prey's (`spaceHomes` with the tree's food links and the map's `mapHabitatAt`);
  `wireThreats` (shared-layer wariness) and `wireRecipes`; the spawn check reads the spaced homes.
- `makeSched`: species held off the water are not scheduled (`schedule-water.ts`; they stay aloft).
- In the water a water species is drawn in its depth band (`inDepthBand`/`scheduledWater`), unless a recipe act of
  its own keeps its height; a hole-dweller stays at its place.
- Clips: the beat's own clip (`rig-player.ts` `beatClip`): head down = the graze clip; wings open wherever the tree's
  rig rules let a flight clip play (flap, glide, soar, hover, banks, the take-off held). With the local v1 rig set no
  flight clip and no graze clip passes, so problems 1 and 3 stay at 0 until rig v2.
- Pass C (`cameraPass`, new): the local reactive layer (`reactive.ts`, near the camera only) at 10 fps, medium tier,
  round a camera 12 m from the prey at up to 40 of pass A's encounters (hunter within 15 m, one per prey species):
  head turns (weight > 0.15), prey reacting to a hunter within 25 m (alert, freeze, flee, startle, threat display,
  shelter, shielding young, or looking at it) and fleeing, timed from the stop's first frame, and group variety.
  The rig lane's "a watching grazer lifts its head" lives here too (it needs the reactive layer).
- Not modelled: liveliness's shared pose (young at heel, shelter from rain, off the tide), the tide's water level.
- New rows: pass C's heads, reactions and variety; variety counting only moments a whole group is awake.

## Numbers so far
Only a trial on ark-release (150 species, 1 day): `docs/ark/audit/release-trial.md`. Full runs (live and
release) were in progress at handover; outputs land in the session scratchpad `ark/audit-out/`.

## Root causes found so far (from code + trial)
1. Flight: no bird has a wing shader (only 13 rays have "flap"); rig flight clips are never played
   (`rig-clips.ts` FLIGHT_CLIPS, held for the wing cards) and the rig is dropped in the air. Live: only the
   7 ARK_FLYERS species fly at all. Trial: 100% of airborne time wings closed. Owner: rigging + rig player.
2. Roaming: live flyers circle (r 6-12 m) over their spot and a cluster follower flies on its leader's circle;
   release: fly/soar = circling (2 or 1.2 turns a slot), group followers replay the leader's pose
   (index.ts schedulePose). Trial: 44% of air time circling, 1.5 turns/min, 20 non-flocking followers. Behaviour lane.
3. Grazing: no graze pose/clip anywhere; release labels "graze" at a grass point but stands (trial 25% labelled,
   0% head-down, 53% standing). Live: grazers never move. Rigging (graze clip) + behaviour.
4. Land/water: live ducks never move; release walks straight across the shore (no entry/exit clip); also
   release's schedule pose wins over sea-depth's waterPose for every scheduled water animal (merge overlap).
5. Heads: rigs have neck/head bones (trial 113/123) but nothing turns them; only whole-body yaw glances. Intelligence lane.
6. Predators: placement is arrival order only (no separation); trial: nearest prey at spawn min 1.2 m, 16/44
   within 10 m. Release reaction = body glance only within 6 m of a moving predator, near the camera; no flee
   (`flee` weight forced to 0). Trial: 3.5% of encounters get a look, 0 flee. Behaviour + intelligence.
7. Variety: live state = activity vs sun only (whole species in step); release followers copy the leader's
   trip; liveliness' per-animal variation (ark-clock) is not wired into the scene. Trial: 99% of moments a
   species' animals share one state.
