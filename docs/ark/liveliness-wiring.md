# Ark liveliness wiring (landing branch `ark-liveliness-wiring`)

The liveliness pass (`ark-liveliness`: `ark-clock.ts`, `ark-age.ts`, `ark-care.ts`, `ark-sound.ts`) decided the weather, tides, ages, care and sound. This lane carries those decisions into what the Ark draws and plays. Visual and audio only: nothing here decides an arrival, a meal, a birth, a death or a score, and the server is untouched.

Everything that varies is shared and deterministic: a pure function of the world's moment (the island clock, `worldMs`), the clock's weather and tide (pure functions of the moment), and ids. Which traces or sounds a viewer gets depends on where their camera is (level of detail), never on randomness.

## Files

| File | What |
|---|---|
| `src/lib/ark-liveliness.ts` | Pure decisions: weather flips on a fixed grid (`WeatherFlips`), shelter kind / delay / walk (`shelterAt`), cover spots, young at heel (`heelPose`, `pickParent`), the tide-aware water fit (`tideFit`), off flooded ground (`aboveTide`), worn paths (`wornPatches`). |
| `src/lib/ark-audio-plan.ts` | Pure sound planning: loudness and pan for the listener, the calls to schedule in a window (the tier's voice cap, `scheduledCalls`), alarm calls, beds to keep. |
| `src/ark-scene/ark-audio.ts` | The WebAudio player: one AudioContext made on the tap only, master gain, per-call gain and stereo pan, voice cap (alarms take the quietest calm voice's place), suspended when off or hidden, credits for the Sounds panel. Nothing is fetched before the tap; held banks and banks without credits never play. Beds (the ambient lane's `selectAmbientBeds`): looped from `loopStart` to `loopStart + loopSeconds`, started at the shared `offset`, `blendLoopSeam` once per decoded buffer, gains ramped over `ramp` (time constant ramp / 3), a bed off the list fades out, WebM Opus with the M4A fallback where WebM can't be read, `lowpassHz` under water. One-shots (`shot`) for thunder. |
| `src/ark-scene/weather-fx.ts` | Rain streaks (a fixed screen width, so they read on a phone), rain rings on the water, rain haze and fog, a duller exposure in rain, the storm's lightning flash, leaves on a strong wind. All moved in shaders from `ARK_TIME`. |
| `src/ark-scene/traces.ts` | Footprints by surface (sand, wet sand, mud, snow, soil, forest floor; paw/hoof or bird), rings where an animal wades or goes in, dust off dry bare ground at a run, worn-path patches. (Grass bending under walkers is the scene's own `setGrassPress`, from behaviour.) One ring buffer of instances each, near the camera only. |
| `src/ark-scene/ark-variation.ts` | Each animal's seeded size, hue, saturation, brightness and mottling (`arkVary` per instance), from `animalVariation(id)`. |
| `src/ark-scene/liveliness-scene.ts` | The controller `index.ts` holds: clock and pins, young and parents, the shared pose (heel, shelter, tide), per drawn animal (traces, sound, the call's head lift), per frame (weather, beds, thunder, worn paths), stats. `waterNear` measures the sea, river, white water (the river's shallow stretches, where the terrain draws rapids), lake and garden pond from the scene's map for the beds; the island has no waterfall. |
| `scripts/ark-liveliness-clips.mjs` | Look-at-it harness: rain, tide, young, prints and sound scenarios on the golden entry, frames + contact sheets + clips. |

## Hooks in other lanes' files (kept small)

- `index.ts`: the controller is made after the fog; `applyEnvironment` asks it for the environment (and uses the world's clock, so a fast-clock recording shows the tide turn); `stepSchedule` passes the schedule's pose through `sharedPose`; entries' lengths through `ownSize`; `instancedFor`/`instancedRigFor` attach `arkVary`; each drawn animal calls `drawn`; each frame calls `step`; tier, reduced motion, pixel ratio, visibility, dispose; the handle's `setSound`, `sound`, `setSoundVolume`; `stats().liveliness`. Water animals' bases go through `tideFit` (two places in `waterPose`, one re-fit).
- `animal-material.ts`: one `varyShader(shader, height)` call at the end of `onBeforeCompile`.
- `types.ts`: `soundBase`, `onSoundCredits`; `setEnvironment` takes `rain` and `fog`; the sound methods; `ArkSceneStats.liveliness`.
- `golden-entry.ts`: exposes `handle` (for the clip harness).
- `ark-view.tsx`: the Sound switch and the Sounds credits list; a remembered "on" returns with the first tap (pointerup) on the world.
- `public/ark/embed.html`: a small in-panel sound button (a host message can't start audio; `{type: "ark:sound", value: false}` turns it off; `{type: "ark:sound", on}` is told to the host).
- Locales: `ark.sound.{label, hint, credits, empty}` in all 45 Ark languages.

## Behaviour

**Shelter.** `shelterKind` from the behaviour profile and body plan: big herd grazers and anything over 2.6 m hunker where they are, back to the wind; animals whose roost is cover (tree, burrow, den, reeds…) go to their roost; the rest go to one of the three nearest trunks within 22 m of home (seeded), on its outward side; water animals, frogs and the like stay out. Each reacts after a seeded 4–44 s delay and walks at its own pace; the rig player's walk follows the movement. "Seek cover" is the clock's `hints.seekCover`, asked on an absolute 30 s grid and narrowed to 250 ms, so every viewer's animals go at the same moments. A pinned environment (`setEnvironment({rain, storm})`) starts the walk when the pin changes; a first pin settles at once (golden shots stay still).

**Young.** The snapshot carries no parents, so `pickParent` chooses one adult of its kind in its server cluster (seeded). While dependent (`ark-age.ts`), a `follow` young keeps 0.7–1.5 parent lengths behind its shoulder, trailing it by 0.6 s; a `carry` young rides on its back; play bursts (more the younger) loop round the parent with small hops. Young are drawn at `age.scale` of the adult (at least 0.7 at the size floor).

**Tide.** The water plane already follows `seaLevelAt`. Water animals' depth fit now uses the surface where it is (`tideFit`): floaters ride the tide, swimmers stay under it, seabed animals stay on the bed. A land animal the tide has covered walks up the beach (`aboveTide`). Tide pools show as the water drops (the plane), consistent with sea-depth's bands.

**Ambient.** The ambient lane's beds replace `ambientMix`'s habitat banks entirely (no double playback): the zone weights round the camera's target, the clock's weather (or the pin), the hour, the tide, the camera's heading for pan, the eye distance, the device's format, the tier's bed cap (high 5, medium 3, low 2). Thunder: `thunderClaps` in back-to-back 1.5 s windows, each clap at its flash plus the sound's travel time (the flashes are `lightningAt`'s, the same the weather effects draw); the claps are fetched once a storm is in.

**Calls and alarms.** With sound on, near animals call at the scheduler's shared moments in their mood (`callMood`: asleep silent, the dawn chorus for birds, frogs and mammals with voices, quieter resting or in rain). When the reactive layer (`reactive.ts`, intelligence lane) says an animal `called`, its alarm call plays at once and takes the quietest calm voice's place if the cap is full; the reaction of its kin is the reactive layer's (its young keep to the same parent as the shared heel). While an animal is heard calling, its head comes up for the call's length (`callLift`), so sight follows sound.

**Drawing note.** The scene renders into a target with an alpha channel that the output pass composites over the page, so every transparent decal and particle here blends colour normally but leaves the frame's alpha alone (`keepFrameAlpha` in `traces.ts`); with plain normal blending, footprints on sand let the page's beige through and vanished. Other lanes' transparent materials may want the same.

## Known gaps and notes

See the lane report. Cross-lane items: the lake shares the sea's water plane, so it is tidal (graphics); `arkLook` is declared by both the intelligence lane (vec3 head look) and the animal-look lane (vec2 wet/dust): the merged shader won't compile until one is renamed.
