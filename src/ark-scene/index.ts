/**
 * The shared Ark, drawn: `mountArk(el, options)` (Ark v1 contract, section 5).
 *
 * Framework-free: TypeScript and three.js only, so the website's /ark page
 * imports it and `scripts/build-ark-bundle.mjs` packs it for the apps'
 * WebView (`public/ark/embed.html`).
 *
 * A miniature world at golden hour: a physically based sky that also lights
 * every surface (`lighting.ts`), a low sun with soft shadows, one terrain
 * and one water shader (`terrain.ts`), instanced vegetation and props that
 * sway in the wind (`vegetation.ts`), drifting cloud shadows and pollen
 * (`life.ts`), and a finish in three tiers (`post.ts`), picked for the
 * device and dropped a tier if frames run long.
 *
 * Each species is one InstancedMesh per level of detail: the near model
 * (~3,000 triangles, moving on its own) within about 25 m of the camera and
 * the far one (~600) beyond, at every distance — seen from far they are
 * drawn a little larger, like figures on a model. Only past ~150 animals in
 * view do the farthest become icons (`icons.ts`). Birds of the air circle
 * above their zone, sea animals swim slow loops; a tapped one comes to rest
 * and lifts a little in a ring of light.
 *
 * Life v2: the light follows the viewer's clock (`lib/ark-daylight.ts`) and
 * animals sleep by their species' activity (still, the head lowered); near
 * ones look round, startle, shake, bob and doze now and then (the talking
 * models' idles, as root motion); a herd or a school keeps together; the
 * camera can follow one animal; and `play` acts out the server's events
 * since the last visit (`acts.ts`). The scene decides nothing that happens.
 *
 * The species' stats (`stats.ts`) shape looks and behaviour only: size sets
 * how big it is drawn (an animal at the size floor, or a few pixels across
 * from far, gets a soft dot so it can be found, and its icon once tapped),
 * speed its pace, dominance and rarity where it stands in its zone
 * (`placement.ts`), intelligence how varied its idles are and how often it
 * glances at a camera close by.
 *
 * Small animals live at microhabitats (`micro.ts`, docs/ark-micro.md): on
 * the cottage at Home, on trunks, flowers, stones, leaf litter and the
 * pond's surface. Close by they are drawn true to size against them (the
 * floor and the marker only from afar), crawl on their surface, and moths
 * circle the porch light at night.
 */

import {
    ACESFilmicToneMapping,
    Color,
    DynamicDrawUsage,
    Fog,
    FogExp2,
    Frustum,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Raycaster,
    Vector2,
    Sphere,
    Spherical,
    Vector3,
    WebGLRenderer,
    type WebGLRenderTarget,
    Euler,
    BoxGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    type Object3D,
    MeshStandardMaterial,
    type Material,
    type ShaderMaterial,
    type BufferGeometry
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {DEATH_SECONDS, ARRIVAL_SECONDS, BIRTH_SECONDS, EXTINCTION_SECONDS, REVIVE_SECONDS, chaseKind, clearBearing, deathPose, emergePose, encounterBodies, mealEncounter, mealStage, preyFleeStyle, setChasePaces, type ActBody, type ActPose, type MealStage} from "@/ark-scene/acts";
import {animalMaterial, ARK_CLOCK, droopOf} from "@/ark-scene/animal-material";
import {WaterReflections} from "@/ark-scene/water-reflect-render"; // p3 (reflect)
import {headLimits} from "@/ark-scene/head-look";
import {bellyOfGeometry, clipDrawsSleep, goesIntoRoost, LEGLESS_BELLY, lyingBody, lyingDrop, lyingTorso, packSleep, restStatus, sleepPostureClips, sleepDraw, sleepStages, sleepStyle, sleepsOnFeet, stepSleepNow, type ArkRestStatus, type SleepNow, type SleepPosture} from "@/ark-scene/sleep";
import {AnimalLook, attachLook, groundContact, SHADOW_SURFACE_TAGS, speciesLook, type LookWeather} from "@/ark-scene/animal-look";
import {DustPuffs} from "@/ark-scene/dust";
import {RecipeScene, type RecipeActor, type RecipeNest} from "@/ark-scene/recipe-scene";
import {applyRecipeCoat, seasonMonthAt, setRecipeArkDay, fallbackNests, microMurmuration, microRoost, molehillsOf, nestSourceFromProps, nestSourceOf, nestStageAt, setFishSource, setNestSource, setRecipeColliders, seasonFactor, setRecordedSexes, sexDim, sexLook, speciesRecipes, swarmFlock, wireRecipes, type Flock, type RecipeAct, type RecipeCoat, type RecipeMark, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {nestSites, nestStage} from "@/ark-scene/props/nest-growth";
import {fishSchoolsNear} from "@/ark-scene/fish-schools";
import {setFishChasers} from "@/ark-scene/fish-render";
import {arkDayNow} from "@/ark-scene/props";
import {HerdSpecks, textureColour, type SpeckShape} from "@/ark-scene/herd-specks";
import {ARK_HERD_LIVE, ARK_HERD_LIVE_LITE, arkRepresentatives, HERD_FIGURE_BUDGET, HERD_SPECK_BELOW_PIXELS, type ArkHerd} from "@/ark-scene/herds";
import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder";
import {ARK_TIME} from "@/ark-scene/glsl";
import {IconTokens, type TokenInstance} from "@/ark-scene/icons";
import {buildMotes} from "@/ark-scene/life";
import {ArkLighting} from "@/ark-scene/lighting";
import {ContactShadows, FindDots, GroundRings, type FindDot, type Ring, type Shadow} from "@/ark-scene/marks";
import {ModelLibrary, type SpeciesModel} from "@/ark-scene/models";
import {skipEmptyDraws} from "@/ark-scene/runtime/empty-draws";
import {microSpecies, nightLight, surfacePoint, viewFrom, type MicroSpecies, type SurfacePoint} from "@/ark-scene/micro";
import {buildMicroScene} from "@/ark-scene/micro-scene";
import {climbClipName, rigBasesFrom, rigSetVersion} from "@/ark-scene/rig-clips";
import {ASLEEP_CLIPS, baseStep, beatClip, clipBase, clipRows, halfToFloat, cyclesFor, flightClip, gaitMoving, gaitPose, newRigState, OPEN_WINGS_HOLD, paceClip, PATH_CARRIED_CLIPS, reactiveClip, recipeClip, rigLivePose, stepGait, stepReverses, turnSteps, type Gait, RIG_CAPS, RIG_CAPS_LITE, RIG_FADE_SECONDS, RigLibrary, rigFlies, rigSwitch, rootOffset, type RigClipData, type RigModel, type RigState} from "@/ark-scene/rig-player";
import {canopyPoint, leapTarget, speciesLayer, tunnelPoint, type SpeciesLayer} from "@/ark-scene/layers";
import {buildLayersScene, planktonClouds} from "@/ark-scene/layers-scene";
import {waterLevelAt} from "@/ark-scene/water-level";
import {floatOver} from "@/ark-scene/water-float"; // p3 (zoofix)
import {breathAt, depthSeed, fitInWater, floatPitch, heldOffWater, safeLoopRadius, schoolFile, schoolOffset, speciesDepth, swimBodyPitch, swimDepth, swimPitch, waterLoopRadius, waterMotion, waterPace, waterSpec, waterSurfaceAt, type SpeciesDepth, type WaterSpec} from "@/ark-scene/sea-depth";
import {tripBreath} from "@/ark-scene/breath-trip";
import {canMoment, momentBeats, momentPose, MOMENT_SECONDS, type ArkMomentKind, type MomentBeat, type MomentFrom} from "@/ark-scene/moments";
import {ARK_CAUSTICS} from "@/ark-scene/terrain";
import {ArkNests, nestKind} from "@/ark-scene/nests";
import {ARK_SCENE_MODULES, type ArkSceneModule} from "@/ark-scene/scene-modules";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {gripPoint} from "@/ark-scene/map/grip";
import {hamletHash, hamletPlotsFor, hamletState, plotSpots, type HamletResident} from "@/ark-scene/map/hamlet";
import type {HomePlot} from "@/ark-scene/props/home-layout";
import {mapHabitatAt, onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {ArkPost, arkCpuScoreMs, lowerTier, tierFor, tierTrialFailed, tierTrialOn, tierTrialState, type QualityTier} from "@/ark-scene/post";
import {ArkPerf, arkPerfAsked} from "@/ark-scene/runtime/perf";
import {ArkFramePacer, SLOW_CPU_MS} from "@/ark-scene/runtime/pace";
import {displayLength, iconSize, MARKER_BELOW_PIXELS, markerNotIcon, nearBySize, screenWeight, SWIMMING_PLANS} from "@/ark-scene/sizes";
import {CAMERA_RANGE, closeUpViews, fitAboveCard, fitWhole, meetDistance, type CloseView} from "@/ark-scene/runtime/camera";
import {easeLift, tinyLift} from "@/ark-scene/tiny-lift";
import {Sight} from "@/ark-scene/runtime/sight";
import {flightHeading, newFlightHeading, type FlightHeadingState} from "@/ark-scene/flight-heading";
import {newHopState, stepHop, type HopState} from "@/ark-scene/hop-gait";
import {arkBody, arkIdleBehaviour, bodyAxisExtent, arkStats, glance, loopPace, moveSpeed, type ArkStats} from "@/ark-scene/stats";
import {ARK_GROUND_LITE, buildLandscape, GROUND_SEGMENTS} from "@/ark-scene/terrain";
import {ArkStreamer, spansFromHeights, STATE_IN, STATE_MAP, STATE_OUT} from "@/ark-scene/streaming";
import {CHUNK_HEADROOM, chunkCount, chunkGridFor} from "@/ark-scene/streaming/chunks";
import {hazeFog} from "@/ark-scene/streaming/haze";
import {keepsModelBeyond} from "@/ark-scene/streaming/tiers";
import {StreamCull} from "@/ark-scene/streaming/cull";
import {sceneMemory} from "@/ark-scene/runtime/memory";
import {loadGroundTextures} from "@/ark-scene/ground-textures";
import {NearDetail} from "@/ark-scene/near-detail";
import {setNearCone} from "@/ark-scene/near-fade";
import {BugGround, bugClearPoints, bugCoverAt, setBugGrazing} from "@/ark-scene/bug-ground";
// p3 (trees): small ground insects climb a grass blade now and then.
import {ClimbStems, climbAt, climbPoint, climbStem, climbsBlades, mixClimb, type ClimbPoint, type ClimbStem} from "@/ark-scene/bug-climb";
import type {SpiderWebs} from "@/ark-scene/spider-webs-draw";
import {AssetTrees} from "@/ark-scene/asset-trees";
import {AssetFloor, AssetRocks} from "@/ark-scene/asset-rocks";
import {ASSET_TREE_KINDS} from "@/ark-scene/tree-assets";
import {buildVegetation} from "@/ark-scene/vegetation";
import {decodeVegetation, grassKey, type ArkVegetation} from "@/ark-scene/grass-grazed";
import {seaEpochSeconds} from "@/ark-scene/fish-schools";
// 3.3 batch (E): the sea's own look from under the surface (the water by depth, marine snow).
import {seaClockSeconds} from "@/ark-scene/fish-schools";
import {openWaterClarity, underwaterLook, type UnderwaterLook} from "@/ark-scene/sea-look";
import {SeaLookView} from "@/ark-scene/sea-look-render";
import {TalkingActor, talkingSource, TextMouth, type TalkingModelSource} from "@/ark-scene/talking";
import {isAwake} from "@/lib/ark-daylight";
import {arkAwakeAtHour, arkSleepOf, type Sleep} from "@/ark-scene/sleep-hours";
import {ARK_DAY_MS, hash32, islandHours, unit} from "@/lib/ark-clock";
import {ArkLiveliness, type LiveAnimal, type LivePin} from "@/ark-scene/liveliness-scene";
import {attachVary, setVary, setVaryPower} from "@/ark-scene/ark-variation";
import type {ArkPowerCandidate, ArkPowerFrame, ArkPowerShow} from "@/ark-scene/power-show";
import type {ArkPower} from "@/ark-scene/power-table";
import {tideFit} from "@/lib/ark-liveliness";
import {ARK_ENV as ARK_ENVIRONMENT, ARK_WIND as ARK_WIND_VECTOR} from "@/ark-scene/glsl";
import {WATER_WIND} from "@/ark-scene/terrain";
import {allAttachPoints, attachSway, groundNormal, setAttachHomePlots, type ArkEnvironment, type AttachPoint} from "@/ark-scene/sampler";
import {arkHatchNest, type ArkAct, type ArkEventAnimal} from "@/lib/ark-life";
import {BehaviourDirector, BehaviourRandom} from "@/lib/talking-models/behaviour";
import {
    ARK_REGIONS,
    type ArkAnimal,
    type ArkCameraView,
    type ArkHappening,
    type ArkHerdInfo,
    type ArkLiveHunt,
    type ArkReplayRun,
    type ArkRegion,
    type ArkCastLayer,
    type ArkSceneHandle,
    type GrassKey,
    type ArkSceneOptions,
    type ArkSelectionExtras,
    type ArkSceneStats,
    type ArkSnapshot,
    type ArkTalking,
    type ArkThrive,
    type ArkVisitor
} from "@/ark-scene/types";
import {arkThriveOf} from "@/ark-scene/thrive";
import {ARK_FLYERS} from "@/ark-scene/flyers";
import {animationTargets, behaviourState, sameBehaviour, type ArkBehaviourState} from "@/ark-scene/behaviour-state";
import {behaviourProfile, bodyLengthsPerSecond, runFactor, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {attachedOn, tripPhase} from "@/ark-scene/collide/attach";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {backProfile, chooseHost, excursionAt, nearestVertex, profileSpot, skinVertex, type BackProfile, groundHop, hopArc, hopFlight, hops, hostSurface, hostTier, nightNow, riderOf, spotOf, type GroundHop, type HostFrame, type RiderSpec, type Surface as RideSurface} from "@/ark-scene/riders";
import {bodyOf as mapBodyOf} from "@/ark-scene/map/species";
import {CollideLayer} from "@/ark-scene/collide/layer";
import {doorWalkAt} from "@/ark-scene/collide/routes";
import type {ResolvePose} from "@/ark-scene/collide/resolve";
import * as behaviourSchedule from "@/ark-scene/behaviour-schedule";
import {awakeAt as scheduleAwakeAt, forgetSchedules, slotOffset, SLOT_SECONDS, groupSpread, homeRadius, maxSlopeOf, rangeReach, poseOnTrip, recipeCoat, recipeMarks, roostOf, recipeNest, ScheduleWorldBuild, tripAt, waterEdgeAt, wireThreats, withLazyRoost, type ArkDoing, type HoursAt, type ScheduleAnimal, type ScheduleWorld, type Trip, type TripPose, spaceHomesTasks, type ScheduleGroup, type SpacedHome} from "@/ark-scene/behaviour-schedule";
import {eats} from "@/ark-scene/food-links";
import {dayCursor, MOMENT_WINDOW_SECONDS, pickMoment, scheduleFed, scheduleStatus, type DayCursor, type MomentSubject, type ScheduleSubject} from "@/ark-scene/animal-status";
import {scheduleRhythm, type ArkRhythmStatus} from "@/ark-scene/rhythm-status";
import {ArkSelectionBars} from "@/ark-scene/selection-bars";
import {arkActivityKey, arkDayWindow, arkEnergy, arkOriginEntry, arkStatusBars, arkStatusLog, arkStatusSignature, type ArkAnimalDay, type ArkAnimalStatus, type ArkRecordNote, type ArkStatusLogEntry} from "@/lib/ark-animal-status";
import {setGrassPress} from "@/ark-scene/grass-press";
import {prepareAttachPoints} from "@/ark-scene/sampler";
// Grounding (motion 100x pass, lane L3): true bases, the drawn ground, perches on real branches, the runtime check.
import {benthicCreep, edgeBase, inPlaceLift, livesUnderWater, shadowFootprint, wadeBase} from "@/ark-scene/grounding/contact";
import {placedTrunk} from "@/ark-scene/tree-climb";
import {attachPoint, drawnContactGap, gripSoleDrop, groundedLevelBase, groundedStand, groundingCheck, groundingRules, hangPointAt, scheduledPerch, standsOnGround, surfaceContactGap} from "@/ark-scene/grounding/hook";
import {SeatPass, seatKind, type SeatState} from "@/ark-scene/seat";
import {HANG_EASE, hangPivot, hangPose} from "@/ark-scene/grounding/hang";
import {drawnGround, drawnGroundHeight, setDrawnGroundStride} from "@/ark-scene/grounding/drawn-ground";
import {lowestPoints, seatDrop} from "@/ark-scene/grounding/tips";
import {feetCarryClip, modelBase, uprightBody} from "@/ark-scene/grounding/base";
import {brachiates, canopyFrame} from "@/ark-scene/canopy-scene"; // p5 (monkeys)
import type {LocoCanopy} from "@/ark-scene/locomotion/brachiate"; // ARK-CANOPY
import {ledgeFrame} from "@/ark-scene/rock-ledge"; // ARK-JUNGLE
import {keepCarriedWithMothers} from "@/ark-scene/carry-cull"; // ARK-JUNGLE
import {setLocoGround} from "@/ark-scene/locomotion/ground";
import {fleePace, sprintPace} from "@/ark-scene/locomotion/flee";
import {flightSpec} from "@/ark-scene/locomotion/flight";
import {locoStyle} from "@/ark-scene/locomotion/styles";
import {swimPaces} from "@/ark-scene/locomotion/swim";
import {collideBlocked, collideSegmentClear, setIslandColliders, unionColliders, type ColliderSet} from "@/ark-scene/collide";
import type {Collider} from "@/ark-scene/collide/colliders";
import type {Stand} from "@/ark-scene/grounding/stand";
import {lieOnGround} from "@/ark-scene/grounding/stand"; // p2 (contact): a sleeper lying on the drawn ground
import {setBehaviourHomePlots} from "@/ark-scene/world-sampler";
import {composedSampler, type ArkIslandScene} from "@/ark-scene/islands/scene";
import {noHamlet, noHamletFor, setNoHamlet} from "@/ark-scene/no-hamlet";
import {arkTwoIslands} from "@/lib/ark-islands";
import {SlicedBuild} from "@/ark-scene/behaviour-build";
import {inDepthBand, onBehaviourSchedule, scheduledWater} from "@/ark-scene/schedule-water";
import * as worldSampling from "@/ark-scene/world-sampler";
import {worldSampler} from "@/ark-scene/world-sampler";
import {ReactiveLayer, offsetShare, type ReactiveInput, type ReactiveOut, type ReactiveTier} from "@/ark-scene/reactive";
import {reactiveWorldQueries, type ReactiveWorldQueries} from "@/ark-scene/reactive-world";
import {canEat, intelProfile} from "@/ark-scene/intelligence-profile";
import {heightAt as wildHeightAt, regionCentre, regionLabelAnchor, TERRAIN_HALF, VISITOR_LANDING, WORLD_RADIUS, ZONE_SITES} from "@/ark-scene/world";
import {wildFrame, wildHomeView} from "@/ark-scene/islands/views";
import {townWorldOrigin} from "@/ark-scene/islands";
import {ARK_ISLANDS} from "@/ark-scene/islands"; // p2 (ocean)
import {arkWorld} from "@/ark-scene/world"; // p2 (ocean)
import {OCEAN_COLUMN, OCEAN_VIEW_MARGIN, oceanFix, roamsOpenOcean} from "@/ark-scene/open-ocean"; // p2 (ocean)
import type {OceanTrafficView} from "@/ark-scene/ocean-traffic-render"; // p2 (ocean)
import {PeopleFigures} from "@/ark-scene/humans/people-figures"; // p6 (people): the rigged bodies
import {BeachProps} from "@/ark-scene/humans/beach-props"; // p5 (humans, quality pass)
import {chosenHuman, isHumanAnimal, TownHumans, type ChosenHuman} from "@/ark-scene/humans/town-humans"; // p5 (humans)
import {carersAt, type CarerPost, type DrawnCarer} from "@/ark-scene/humans/carers"; // decision 418 (carers)
import {humanRoomHost} from "@/ark-scene/humans/home-rooms-host"; // humans visible
import {HumanTVs} from "@/ark-scene/humans/tvs"; // humans visible
import {SleepCovers} from "@/ark-scene/humans/sleep-covers"; // humans polish
import {towerApartments} from "@/ark-scene/islands/town/home-rooms"; // humans visible
import {townPlan} from "@/ark-scene/islands/town/plan"; // humans visible
import {decodeHumanBonds} from "@/ark-scene/humans/couples"; // p5 (humans, couples)
import {DogWalks, dogWalkPlaces, isHouseDog, townWalkers} from "@/ark-scene/humans/dog-walks"; // p5 (humans, dogs)
import {DogLeads} from "@/ark-scene/humans/leads"; // p5 (humans, dogs)
import {roadHeight as townRoadHeight} from "@/ark-scene/islands/town/render/vehicles"; // p5 (humans)
import {OceanShadows} from "@/ark-scene/ocean-shadows"; // p2 (ocean)
import {TOWN_GRID, TOWN_NEAR_LIVE} from "@/ark-scene/islands/town/chunks";
import type {CatWalls as CatWallsT} from "@/ark-scene/islands/town/cat-walls"; // gfx (fauna)
import {arkGrassBuild, createArkRuntime, type ArkRuntime} from "@/ark-scene/runtime";
import {prepareGhostPlaces, prepareReadPlaces} from "@/ark-scene/runtime/prebuild";
import {sameArkRead, sameJson} from "@/ark-scene/runtime/same";
import {warmShaders} from "@/ark-scene/runtime/load";
import {arkOutside} from "@/ark-scene/live-budget";
import {HuntingLayer, loadPositionsAtlas} from "@/ark-scene/hunting";
import {LiveMeals, type MealAct} from "@/ark-scene/live-meals";
import {CONTEST_MAX_APART, LiveMatings} from "@/ark-scene/live-matings";
import {easeToward, framePair} from "@/ark-scene/pair-frame"; // 3.3 fix (mating tap)
import {CLUTCH_FRAME_POLAR, CLUTCH_SHOWN_SECONDS, clutchFrame, clutchSize, kinFrameApart, seenAt} from "@/ark-scene/live/breed-focus"; // 3.3 fix (breeding taps)
import {LiveBirths, newbornScale} from "@/ark-scene/live-births";
import {LiveSeeking} from "@/ark-scene/live-seeking";
import {LiveClutches} from "@/ark-scene/live-clutches";
import {reproOf, ReproFx} from "@/ark-scene/repro"; // REAL-REPRODUCTION (decision 440)
import {LiveDeaths, type DeathRecord} from "@/ark-scene/live-deaths"; // 3.3 fix (log)
import {ForestScene} from "@/ark-scene/forestry/forest-scene"; // p5 (humans): logging and replanting
// 3.3 batch (D): the escapes and the dragonflies' dips
import {LiveEscapes, type LimpOffsets} from "@/ark-scene/live-escapes";
import {DipRipples, microDipAt, waterNear} from "@/ark-scene/egg-dip";
// 3.3 batch (B): the birds' own moves (mobbing dive)
import {Mobbing, mobFoeFits, type MobHost} from "@/ark-scene/mobbing";
// Group life (lane SIG-GROUP): species that live in groups by their own text though their profile says otherwise.
import {groupLives} from "@/ark-scene/behaviour-group";
import {BrokenWing} from "@/ark-scene/broken-wing";
import {waysOf} from "@/ark-scene/young-ways";
/** How deep the water is to swim in, where a young one's ride is on the water only (m). */
const DEEP_WATER = 0.3;
/** How long a young one takes to get down from its parent's back, or up (ms). */
const RIDE_BLEND_MS = 1400;
import {LiveDuckDrops, type Hollow} from "@/ark-scene/duckling-drop";
import birdMoves from "@/ark-scene/bird-moves.json";
import {tailHabitOf} from "@/ark-scene/tail-habit";
import {signatureLineOf} from "@/ark-scene/live/signature-lines";
// 3.3 batch (A): defence moves.
import {defenceMoveOf, defencePack, defenceSaid, disturbedNow, escapesRunning, holdsNow, newDefenceState, predatorBeside, stepDefence, type DefenceSpec, type DefenceState} from "@/ark-scene/defence-moves";
// p3 (shake): shaking off the water after a swim.
import {SHAKE_LINE, shakePackOf, shakeStartOf} from "@/ark-scene/water-shake";
import {DUNG_PAUSE_SECONDS, DUNG_SNIFF_SECONDS, DUNG_VISIT_CROWD, DUNG_VISIT_METRES, dungAlpha, dungDiet, dungDrops, dungPose, dungVisitPose, eatsDung, leavesDung} from "@/ark-scene/dung";
import pouchTable from "@/ark-scene/pouch.json";
import {speciesCare} from "@/lib/ark-age";
// 3.3 batch (C): young with their recorded mother
import {Lineage, nurseTurn} from "@/ark-scene/young-care";
import {applyYoungCoat, youngCoatOf, youngCoatStrength, youngSteps} from "@/ark-scene/young-coat";
// 3.3 batch (C): the antler cycle.
import {antlerOf, antlerState, applyAntler, type AntlerState} from "@/ark-scene/antler-cycle";
import {MouthCarry} from "@/ark-scene/mouth-carry";
import {mealOnStage, mealScript, DRINK_REACH, type MealCatch} from "@/ark-scene/meal-acts";
import {MealTraces, type TraceDraw} from "@/ark-scene/meal-traces";
import {bodyMassKg, isScavenger, mealPlan, type MealPlan, type MealSide, type ScavengerCandidate} from "@/ark-scene/meals";
import * as liveBudget from "@/ark-scene/live-budget";
import {selectAim, selectionPins, selectionSurvives} from "@/ark-scene/selection";
import {arkPinnedMs} from "@/ark-scene/shared-clock";
import {wireZoneCapacity} from "@/ark-scene/map/capacity";
import {arkSeenKind, type ArkSeenAct} from "@/lib/ark-live-log";
import {l2BodyChannel, l2BodyUniforms, l2ClipBake, l2FlightFrame, l2FlightGate, l2LandingNow, l2Sidewind, l2SurfaceGuard, l2SwimRate, newL2Motion, type L2Motion} from "@/ark-scene/locomotion/l2-scene";
// 3.3 fix: taps on the resting figures.
import {pickFigure, preferTap, type Projector} from "@/ark-scene/tap-pick";
// 3.3 fix: the kept town animals near the look point move.
import {keptToBringOut, nearKeptDue, NEAR_KEPT_VIEW, NEAR_ZOO_MAX, NEAR_ZOO_MAX_LOW, NEAR_ZOO_VIEW, sameIds} from "@/ark-scene/near-kept";
/** ARK-ANIM: how far a rig drawn standing may go down into the ground as it sleeps (m; it cannot fold its legs). */
const RIG_STANDING_SINK = 0.02;
// 3.3 fix: a perched animal's reactions keep it on its perch (the schedule's own "raised": 0.4 m over the ground).
const PERCH_ABOVE = 0.4;

export * from "@/ark-scene/types";
export {arkThriveOf, arkThriveRank} from "@/ark-scene/thrive";
export {decodeArkSnapshot} from "@/ark-scene/snapshot";

/** Near level within this distance (m), far beyond it. */
const NEAR_DISTANCE = 25;
const HYSTERESIS = 2.5;
const NEAR_INSTANCE_CAP = 150;
const NEAR_SPECIES_CAP = 60;
/** Past this many animals in view, the farthest are drawn as icons. */
const MODEL_CAP = 150;
/** The lighter view (A18): fewer near models, fewer models before icons. */
const LITE_CAPS = {near: 40, nearSpecies: 24, models: 80};
/**
 * Rigged animals (`rig-player.ts`): at most this many at once (and of this
 * many species: one draw call each), within this distance unless they are
 * the viewer's own, selected or followed. The lighter view has fewer; reduced
 * motion none.
 */
const RIG_CAPS_DRAWN = {animals: 24, species: 12};
/** ARK-SEAT: an act's states that are off the ground by their own motion (`acts.ts` ActPose.state): left to it. */
const SEAT_ACT_FREE: ReadonlySet<string> = new Set(["leap", "swim", "fly", "glide", "plunge", "strike_feet", "takeoff"]);
/** ARK-CONTACT: animals this long (m) or shorter are kept out of the drawn rocks (`insideRock`): the bugs, snails, spiders. */
const SMALL_ON_ROCKS = 0.15;
const RIG_CAPS_DRAWN_LITE = {animals: 8, species: 4};
const RIG_WITHIN = 20;
/**
 * A bird in the air whose rig flies is drawn near (and rigged) this much further off: a flapping flight reads from
 * across the island, and the far level has no motion at all. Nothing changes for a set without flight (v1).
 */
const FLIGHT_RIG_EXTRA = 20;
/** A walker moving on the ground gets its rig (drawn near) from up to this far: the whole island from its home view. */
const MOVING_RIG_WITHIN = 260;
/** Seconds a rig takes to fade in or out against the procedural motion. */
const RIG_BLEND_SECONDS = 0.5;
/** Lane MA3: a floater still on the water plays its paddle this slowly (its float idle): feet gently under it, body level. */
const FLOAT_IDLE_RATE = 0.3;
/** Rigs not drawn for this long are let go (keeping this many). */
const RIG_KEEP_SECONDS = 45;
const RIG_KEEP = 24;
const LOAD_NEAR_WITHIN = 48;
/**
 * Part B: an animal past the render distance is not drawn or stepped (unless it is big on screen in the map view: `streaming/tiers.ts` keepsModelBeyond); where it is (its schedule's pose, the same for
 * every viewer) is worked out again after this many seconds (plus up to one more, by its phase, so they spread out).
 */
const STREAM_RECHECK_SECONDS = 2;
const FOV = 38;
// (True scale, motion pass §3: the camera's reach is `runtime/camera.ts` CAMERA_RANGE, per world in `islands/views.ts` wildFrame.)
const ENTRANCE_SECONDS = 1.6;
/** V1: the departure fade (see `departing`): how long one that left the Ark stays as it stood, its fade, and how many at once. */
const DEPART_HOLD_SECONDS = 0.9;
const DEPART_FADE_SECONDS = 2.6;
const DEPART_MOST = 12;
const RIPPLE_SECONDS = 2.6;
/** A clutch being laid, in a replay. */
const LAID_SECONDS = 2.6;
/** V1: how long a replayed hatching shows its young in the nest, once the eggs have split (s; it was `BIRTH_SECONDS`, 2.8: gone before they read). */
const HATCHLINGS_SECONDS = 6;
/** Close to an animal the camera looks more across the ground than down on it (radians from straight down). */
const CLOSE_POLAR = 1.13;
/** Seconds without a touch before the view starts to drift. */
const IDLE_DRIFT_AFTER = 9;
/** The idle drift's speed (OrbitControls' autoRotateSpeed: 2π/60 rad/s per unit). */
const DRIFT_SPEED = 0.18;
const OPENING_SECONDS = 4.6;
/** Within this distance (m) an animal glances at the camera now and then (more often the sharper it is). */
const GLANCE_WITHIN = 14;
/** Past this distance (m) a small animal's model is not drawn (its marker is), unless it is someone's own or selected. */
const MICRO_DRAW_WITHIN = 42;
/** Within this distance (m) of a small animal the camera may come right up to it. */
const MICRO_CLOSE_WITHIN = 3.5;
/** How close the camera may come to a small animal (m). */
const MICRO_MIN_DISTANCE = CAMERA_RANGE.close;

/** Birds that take to the air above their zone. */
const FLYERS = ARK_FLYERS;
/** A catch lying on its side (rad): over onto its flank, not quite flat. */
const LYING_ROLL = 1.42;
/** A meal act's states the rig plays from its own clips (`rig-player.ts` RECIPE_CLIPS): feeding, a glance up, lying up. */
const MEAL_CLIP_STATES = new Set(["eat", "scan", "rest", "bask"]);

/** The island's hour offset from UTC: everyone sees the same time of day (graphics pass; `src/lib/ark-clock.ts`). */
const ISLAND_OFFSET_HOURS = 0;

/** Per tier: shadow map size, grass tufts, pixel-ratio cap. */
const TIER_SETTINGS: Record<QualityTier, {shadows: number; grass: number; pixelRatio: number; /** The forest fill's share (graphics pass). */ fill: number}> = {
    high: {shadows: 2048, grass: 56000, pixelRatio: 2, fill: 1},
    medium: {shadows: 1024, grass: 22000, pixelRatio: 1.5, fill: 0.6},
    low: {shadows: 0, grass: 0, pixelRatio: 1, fill: 0.3}
};
const MAX_GRASS = TIER_SETTINGS.high.grass;
/** The low tier's pixel ratio at most, on a touch device whose frames have room for it (`runtime/pace.ts` rule 4). */
const LOW_SHARP_RATIO = 1.5;
/** Runtime (live budget): behaviour's resting-at-home test, looked up by name until it is in the release. */
const RESTING_AT_ROOST = ["resting", "AtRoost"].join("");

/**
 * Lane TB (decision 255): the town's resting kept animals drawn as static figures: per tier how many as the far model
 * (nearest first; the rest as specks), how near the camera a member must be to be drawn at all (m), and how near for its
 * kind's far model to be asked for (m). Specks and figures are a copied matrix each: no schedule, no rig.
 */
const RESTING_FIGURE_BUDGET = {high: 400, medium: 200, low: 120} as const;
const RESTING_DRAW_WITHIN = 150;
const RESTING_LOAD_WITHIN = 70;
/** How many resting kinds (nearest the camera) are drawn as their models: each one a draw call and a far model. */
const RESTING_FIGURE_KINDS = {high: 64, medium: 16, low: 8} as const;
/**
 * Animal rendering lane (2026-11-14): a resting kind with a member big on screen (the herds' own `HERD_SPECK_BELOW_PIXELS`)
 * is drawn as its model before any other, up to this many kinds: a speck is a few-pixel stand-in, never a clay figure
 * beside the reader's own cat (the town's yards and aviaries, 16 to 35 kinds big on screen at once on a phone).
 * The figure budget went up with it (it was 120 and 60: a yard's cats and dogs took all of it, and the six kinds
 * beside them stayed specks 50 px tall).
 */
const RESTING_FIGURE_KINDS_BIG = {high: 96, medium: 48, low: 32} as const;
/** Past `RESTING_LOAD_WITHIN` a resting kind's model is asked for only when it is this many times the speck size on screen (an elephant across the zoo). */
const RESTING_BIG_FAR = 3;
/** How long a resting animal big on screen waits unseen for its model before a speck stands in after all (a dead link, a refused load). */
const RESTING_WAIT_SECONDS = 10;
/** A resting speck's tint before its kind's model is in (by body plan). */
const RESTING_SPECK_COLOURS: Record<string, Color> = {"": new Color("#8f8670"), mammal: new Color("#8f7f66"), bird: new Color("#9a8a72"), fish: new Color("#7f97a3"), reptile: new Color("#7d8660"), turtle: new Color("#7d8660")};

type Level = "near" | "far" | "token";

/** An animal on the behaviour schedule: its profile and home, its trip (and its leader's, for a group's follower), its pose now. */
type Sched = {
    animal: ScheduleAnimal;
    profile: ArkBehaviourProfile;
    trip: Trip | null;
    lead: Trip | null;
    pose: (TripPose & {doing: ArkDoing}) | null;
    at: number;
    /** The ground under its pose and its pitch to the slope, worked out with the pose (not every frame). */
    ground: number;
    pitch: number;
    /** Its home, group and range worked out (`wireSchedules`, sliced): until then it waits unseen, never beside its prey. */
    wired?: boolean;
    /** Its schedule worked out once since it was wired (the first step is the costly one: a few a frame, `WARM_MS`). */
    warm?: boolean;
    /** Its pose was last worked out with the collisions (drawn as a model): one drawn again is worked out with them at once. */
    collided?: boolean;
    /** ARK-CONTACT: how far the collisions moved it off its schedule's pose when last worked out (m), held between steps. */
    eased?: {dx: number; dz: number};
    /** When (epoch s) a step last left its trip over (its pose came from elsewhere, a foray): not held as "due a new trip" meanwhile. */
    offTripAt?: number;
};

/** The roost kinds whose way in the props lane draws (`scene-modules.ts` roostOf). */
const DEN_ROOSTS: ReadonlySet<string> = new Set(["den", "burrow", "cave", "crevice"]);

/** A rider's or a hopper's memory (`riders.ts`, `ridePose`): only what the clock cannot give back. */
type RideMemo = {
    /** The host it is on (or would be on), and when that was last looked at (s, shared clock). */
    host: string | null;
    checked: number;
    /** Its host's pace (m/s, eased) and where the host was last frame: a flea only jumps off a host that keeps still. */
    pace: number;
    last: {x: number; z: number; t: number} | null;
    /** A flea's time off its host: the slot's window, where it hops about (beside the host as it was then), the point it left from. */
    off: {start: number; end: number; mid: {x: number; z: number}; from: {x: number; y: number; z: number}; leave: number; floor: (x: number, z: number) => number} | null;
    /** Jumping back on: from where, when (s, shared clock). */
    board: {x: number; y: number; z: number; t0: number} | null;
    /** On its host last frame (watched, it then keeps that host). */
    on: boolean;
    surface: RideSurface;
    hop: GroundHop;
};

type Entry = {
    /** ARK-ANIM: its heading and bank on the wing (`flight-heading.ts`), and its hops on a rig with no gait (`hop-gait.ts`). */
    hop?: HopState;
    flightHeading?: FlightHeadingState;
    animal: ArkAnimal;
    place: Placement;
    /** Its drawn body length (m, head to tail): from its stored length or its size stat (`stats.ts`). */
    length: number;
    /** The species' stats: looks and behaviour only. */
    stats: ArkStats;
    /**
     * How well kept it is (`thrive.ts`, the server's band; ordinary when it sent none): the hook for its coat and
     * energy and its claim on the best places. Refreshed with every snapshot. Not drawn yet; never a glow or a badge.
     */
    thrive: ArkThrive;
    /** At the size floor: drawn with a marker so it can be found. */
    floor: boolean;
    /** Its usual drawn length (m, the floor and the cap applied); `length` is what it is drawn at this frame. */
    full: number;
    /** Its body length (m), true to life: a small animal is drawn at it close by. */
    trueLength: number;
    /** A small animal at its microhabitat. */
    micro?: MicroSpecies | null;
    /** p3 (trees): the grass blade it climbs now and then (null: it does not). */
    climb?: ClimbStem | null;
    /** A moth: 0 resting on the wall, 1 circling the porch light (at night); eased. */
    toLight?: number;
    /** Its layer (`layers.ts`): the canopy, the ground, the underground, the reef, the open sea or the deep. */
    layer: SpeciesLayer;
    /** A water species' depth band (`sea-depth.ts`), and its seed for its swim up and down the band and its breaths; null on land. */
    depth: SpeciesDepth | null;
    /**
     * Lane MA3: its band while its schedule has it in the water (`sea-depth.ts` swimDepth: a water species' own with its
     * kind's float line; any other swimmer's, a coot's, an otter's, a crocodile's), worked out once; null if it does not swim.
     */
    swim?: SpeciesDepth | null;
    /** p2 (ocean): a wild animal of the open ocean, cruising its loop between and around the islands (`open-ocean.ts`); worked out once. */
    ocean?: boolean;
    seed: number;
    /** Underground and in its tunnel or chamber now (drawn only in the cutaway). */
    buried?: boolean;
    /** A cross-layer moment it is acting out (cosmetic): its kind, when it began, where from, its beats still to come. */
    moment?: {kind: ArkMomentKind; start: number; from: MomentFrom | null; beats: MomentBeat[]} | null;
    /** Its idle loops' pace (a swimmer's, a flyer's), from its speed. */
    pace: number;
    arrivedAt: number | null;
    level: Level;
    phase: number;
    /** Where it was drawn this frame (its middle), for picking; null when not drawn. */
    middle: Vector3 | null;
    drawnHeight: number;
    /** A hamlet resident out of doors: where the collisions last put it (m) and when (s): `collide/layer.ts`. */
    residentAt?: {x: number; z: number; at: number} | null;
    /** 0 on the ground, 1 aloft (flyers); eased. */
    air: number;
    /** 0…1 the selected lift, eased. */
    lift: number;
    /** The chat's animal visiting (never one of the Ark's). */
    visitor?: boolean;
    /** Which way it faced when last drawn. */
    yawNow?: number;
    /**
     * What it is doing now (`behaviour-state.ts`): the one state its animation, where it is drawn,
     * the tap card and follow mode all read. Never changed by selecting or following it.
     */
    state: ArkBehaviourState;
    /** Awake (`state` not asleep); `rest` eases to 1 asleep. */
    awake: boolean;
    rest: number;
    /** The loop's angle now, for a swimmer or a flyer (it slows asleep). */
    loop: number;
    /** The group's or pair's first one, which a school or a flock keeps to. */
    leader?: Entry | null;
    /** The near level's idle behaviours (look, startle, shake, bob, doze), made when first near. */
    director?: BehaviourDirector | null;
    /** Held back until its act in a replay (it arrived, or was born, since the last visit). */
    held?: boolean;
    /** In a replay only: an animal that is gone now (eaten, or died), standing in until its act. */
    ghost?: boolean;
    /** An act's pose, drawn in place of its own. */
    act?: ActPose | null;
    /** Its rig (`rig-player.ts`): the clip playing and how far the rig has faded in; absent until first rigged. */
    rig?: RigState | null;
    /** Chosen for a rig this frame (within the caps). */
    rigOn?: boolean;
    /**
     * Its behaviour schedule (`behaviour-schedule.ts`): its profile, its home, the trip it is on and where that puts it
     * now. Null for animals the schedule doesn't move (small animals at their microhabitats, burrowers, the visitor).
     */
    sched?: Sched | null;
    /** Turned to look at a predator passing (visual only), eased. */
    glance?: number;
    /** The local reactive layer's output this frame (`reactive.ts`): its offset, head look, action; null outside its budget. */
    reactive?: ReactiveOut | null;
    /** ARK-CONTACT round 4: its push off its neighbours as drawn (eased toward what `keepApart` wants). */
    apart?: {x: number; z: number};
    /** Development (ARK-CONTACT round 4): which path set its pose this frame. */
    posePath?: string;
    /** Powers you can see (decision 420, `power-show.ts`): its kind's mechanism (false: none) and what it shows now. */
    powerKind?: ArkPower | false;
    power?: ArkPowerFrame | null;
    /** 3.3 batch (A): its species' defence move (`defence-moves.ts`; false: it has none) and where it is in it. */
    defenceSpec?: DefenceSpec | false;
    defence?: DefenceState;
    defenceAt?: {x: number; z: number};
    /** A small animal at its microhabitat (outside the reactive layer): a predator beside it now (`predatorBeside`: 0, 1 close, 2 very close). */
    defenceNear?: 0 | 1 | 2;
    /** A young one's parent for the reactive layer (its group's adult leader, `ark-age.ts` for whether it is young), and when that was worked out. */
    youngOf?: {parent: string | null; play: number; at: number};
    /** 3.3 batch (C): how strongly it wears its species' young coat (`young-coat.ts`, 0-15), worked out again now and then. */
    youngCoat?: {steps: number; at: number};
    /** ARK-JUNGLE: a young one carried on its mother now (`carriedPose`): nothing pushes it off her. */
    riding?: boolean;
    /** ARK-SEAT: its seat on what is drawn under it (`seat/seat.ts`): the offset it is drawn with, eased. */
    seat?: SeatState;
    /** Its mother's pose as `carriedPose` read it (her id, where): moved with her when the frame's pushes move her. */
    ridingOn?: {id: string; x: number; z: number; base: number};
    /** A rider or a hopper (`riders.ts`): its host, when that was chosen, a flea's time off its host, the host's pace. */
    ride?: RideMemo;
    /** A host with a rider on it: its drawn transform this frame (`rideLate` puts the rider on the coat it is drawn with), and the frame's number. */
    drawnMatrix?: Matrix4;
    drawnFrame?: number;
    /** …and when it is drawn on its rig, the rig and its instance (its clip rows are read back from the instance). */
    drawnRig?: {rig: RigModel; mesh: InstancedMesh; index: number} | null;
    /** sig-young: its ride is on the water only; whether it rode last frame; where it was drawn; and the get-down or get-up it is easing through. */
    rideWaterOnly?: boolean;
    rideWas?: boolean;
    rideLast?: {x: number; z: number; base: number; yaw: number};
    rideBlend?: {from: {x: number; z: number; base: number; yaw: number}; at: number} | null;
    /** 3.3 batch (C): its antlers in this month of the Ark year (`antler-cycle.ts`), re-read every 30 s. */
    antler?: AntlerState & {at: number};
    /** A small animal's recipe act off the schedule (a house starling in a murmuration), for the near detail. */
    recipeAct?: RecipeAct | null;
    /** ARK-CONTACT: its rock face as the rock is drawn (kept, filled each frame). */
    drawnFace?: SurfacePoint;
    /** ARK-CONTACT: its town eave perch as drawn (`drawnEave`), kept so a frame makes no new point. */
    eaveFace?: SurfacePoint;
    /** ARK-CONTACT: its limb point moved clear of the trunk (`trunkClear`), kept so a frame makes no new point. */
    limbFace?: SurfacePoint;
    /** ARK-CONTACT: its flower head or leaf as drawn (`surfaceBelow`), kept so a frame makes no new point. */
    floorFace?: SurfacePoint;
    /** Ambient flock-mates round a small animal's spot (a swarm, a cluster). */
    recipeFlock?: Flock | null;
    /** The duller sex's dim (`sexDim`), worked out once. */
    sexDim?: number;
    /** Its gait (`rig-player.ts` stepGait): its pace and step cycle by the distance it covers, rigged or not. */
    gait?: Gait | null;
    /** A rigged animal on the ground walks about its spot now and then (`stepWander`). */
    wander?: Wander | null;
    /** A leaper in the air: how far across (0…1), else 0. */
    leapK?: number;
    /** An underground animal out of its burrow: how far through the peek (0…1), else -1. */
    peek?: number;
    /** A small animal's crawl once its rig has driven it (`crawlStep`): where along, which way, the pause left, its half-turn, its speed (m/s). */
    crawl?: {along: number; dir: number; pause: number; turn: number; speed: number} | null;
    /** Its sleep (`sleep.ts`): how far into lying down, its posture this bout; null awake and up. */
    sleepNow?: SleepNow | null;
    /** How much of a sleeper's stirred heading (`sleepDraw`) is drawn: none while it moves, eased back in when it stops. */
    stirShare?: number;
    /** Its rig plays the lying clips now (`sleepClip`): the procedural lying gives way to them as the rig fades in. */
    sleepClipped?: boolean;
    /** 0 out … 1 gone into its burrow or den to sleep or rest (its roost is the way in: `goesIntoRoost`), eased. */
    denIn?: number;
    /** 3.3 batch (B): flying one of the birds' own moves (`mobbing.ts`): its rig flies while its act has it in the air. */
    birdAloft?: boolean;
    /** Its sleep has been stepped once (its first frame is drawn as it is: no lying down on load). */
    sleepStarted?: boolean;
    /** Its sleeping posture's attitude (the recipes' act: a bat turned over), kept to ease it back as it wakes. */
    sleepAct?: {pitch: number; roll: number; hang?: boolean} | null;
    /** ARK-ANIM: hanging under its roost (`grounding/hang.ts`): since when (clock s), since when letting go, and posed once. */
    hangFrom?: number | null;
    hangOff?: number | null;
    hangSeen?: boolean;
    /** Lane L2's motion (`locomotion/l2-scene.ts`): its flight beat, its swim and crawl cycles (per viewer, visual only). */
    l2?: L2Motion | null;
    /** Part B: where it was last worked out (its schedule's pose) and when (scene seconds), for the render distance. */
    streamAt?: {x: number; y: number; z: number; t: number} | null;
};

/**
 * A rigged animal's walk about its spot: from it, a few body lengths, and
 * back, at its walk clip's own ground speed so its feet stay planted. It
 * only sets off while its rig is fully in, and stops wherever it is when the
 * rig is to go (then it stands there, procedural, until it walks back).
 */
type Wander = {x: number; z: number; heading: number; walking: boolean; until: number; tx: number; tz: number; trips: number};

type SpeciesMeshes = {
    near: InstancedMesh | null;
    far: InstancedMesh | null;
    nearMaterial: MeshStandardMaterial | null;
    farMaterial: MeshStandardMaterial | null;
    /** The rigged near mesh (its own geometry and bone texture), while the species' rig is loaded. */
    rig?: InstancedMesh | null;
    rigMaterial?: MeshStandardMaterial | null;
};

/** A herd's members past its representatives (A14): standing where the server placed them, drawn cheaply. */
type HerdDraw = {
    info: ArkHerd;
    slug: string;
    /** A member, for its size and stats (all of a species are drawn the same size). */
    sample: ArkAnimal;
    members: Array<{id: string; x: number; z: number; ground: number; yaw: number; water: boolean; phase: number; mine: boolean; awake: boolean; activity: ArkAnimal["activity"]; sleep?: Sleep | null; home?: {x: number; z: number; ground: number}}>;
    centre: {x: number; z: number};
    radius: number;
    /** The member nearest the middle: the badge stands over it. */
    anchor: number;
    length: number;
    colour: Color | null;
    /** The figures' and specks' matrices, kept until the drawn scale changes. */
    scale: number;
    figureMatrices: Float32Array;
    speckMatrices: Float32Array;
    /** Members nearest the camera first, sorted now and then. */
    order: Uint32Array;
    sortedAt: number;
    sortedFrom: Vector3;
    /** Each member's middle this frame (for picking), NaN when not drawn. */
    middles: Float32Array;
    badge: HTMLButtonElement;
    /** This frame: how many as models, how many as specks, the drawn height. */
    figures: number;
    specks: number;
    height: number;
    /** A resting kind whose model is on its way: its nearest members, big on screen, not drawn until it is in (`restingSpecks`). */
    hidden?: number;
    /** When (scene seconds) that wait began: past `RESTING_WAIT_SECONDS` the specks stand in after all. */
    waitFrom?: number;
};

/**
 * Lane TB (decision 255): the town's kept animals resting out of the live budget (in their rooms, tanks, ponds, yards,
 * paddocks and enclosures), drawn as static figures through the herd path: a species' group with no badge, no count,
 * nothing to tap. The animated budget is untouched; a figure costs a copied matrix.
 */
type FigureGroup = Omit<HerdDraw, "badge" | "info"> & {resting: true};

const MINE = new Color("#b9f75a");
const SELECTED = new Color("#fff4dc");
const ARRIVAL = new Color("#fff3d6");
/** V2 replay: the soft ring under an animal the cast marks (the last of its kind). */
const LAST_OF_KIND = new Color("#ffb347");

function easeOutBack(t: number): number {
    const c = 1.4;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** 0 → 1 → 0 across the two pauses of a crawl (its turn round), eased. */
function smoothTurn(u: number): number {
    const step = (a: number, b: number, x: number) => {
        const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
        return t * t * (3 - 2 * t);
    };
    return step(0.33, 0.48, u) * (1 - step(0.83, 0.98, u));
}

function phaseOf(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}

/**
 * Letter-spacing for a label's text: the tracking asked for where the script
 * takes it (Latin, Cyrillic, Greek), none elsewhere, since spacing breaks
 * Devanagari's and Bengali's head-strokes, Thai's clusters and Arabic's joins.
 */
export function arkTracking(text: string, tracking: string): string {
    return /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}\p{P}\p{S}\p{Z}]*$/u.test(text) ? tracking : "normal";
}

/** A development override for measuring each tier (`window.__arkQuality = "low"` before mounting). */
function forcedTier(): QualityTier | null {
    const asked = (globalThis as {__arkQuality?: string}).__arkQuality;
    return asked === "high" || asked === "medium" || asked === "low" ? asked : null;
}

export function mountArk(el: HTMLElement, options: ArkSceneOptions): ArkSceneHandle {
    // Islands mode (decision 148, `no-hamlet.ts`): with two islands the wild island has no hamlet. Set before anything
    // of the world is built (the page's `prepareArk` set the same from the same read).
    setNoHamlet(noHamletFor(arkTwoIslands(options.snapshot)));
    // Part C, one world (decisions 141-142): the town island beside the wild island, across the strait at its world origin
    // (`islands/scene.ts`), its animals through this one pipeline. Absent: the wild island alone, exactly as before.
    // (Decision 153: the town may come later, built off the first frame in idle slices: `attachIsland`.)
    let island: ArkIslandScene | null = options.island ?? null;
    const heightAt = (x: number, z: number) => {
        const isl = island;
        return isl && isl.contains(x, z) ? isl.heightAt(x, z) : wildHeightAt(x, z);
    };
    /** Part C: the wild island's animals of a list (the town's are placed by the town). */
    const wildOnly = (animals: ArkAnimal[]) => {
        const isl = island;
        return isl ? animals.filter((animal) => !isl.has(animal)) : animals;
    };
    /** The wild island's places last laid out, kept while its animals are the same (the town attaching re-places only the town). */
    let lastWild: {animals: ArkAnimal[]; places: Map<string, Placement>} | null = null;
    /** The same animals in the same order, each the very same or a new read of it field for field (`runtime/same.ts`). */
    const sameAnimalList = (a: readonly ArkAnimal[], b: readonly ArkAnimal[]) => a.length === b.length && a.every((animal, i) => animal === b[i] || sameJson(animal, b[i]));
    /** A new read's wild animals as `placeAll` will place them, or null when last time's places serve. */
    const wildToPlace = (snapshot: ArkSnapshot): ArkAnimal[] | null => {
        const isl = island;
        const wild = isl ? snapshot.animals.filter((animal) => !isl.has(animal)) : snapshot.animals;
        return lastWild && sameAnimalList(lastWild.animals, wild) ? null : wild;
    };
    /** The town's animals as the last read had them (a stand-in of the town is planned with them, `placeAll`). */
    let lastTown: ArkAnimal[] = [];
    /** Every animal's place: the wild island's by its map, the town's by its plan (in the world frame). */
    const placeAll = (animals: ArkAnimal[], ghosts = false): Map<string, Placement> => {
        const isl = island;
        if (!isl) {
            // (The same animals as last time, read again, keep last time's places: a place depends only on the animals.)
            if (!ghosts && lastWild && sameAnimalList(lastWild.animals, animals)) return new Map(lastWild.places);
            const places = placeAnimals(animals);
            if (!ghosts) lastWild = {animals, places: new Map(places)};
            return places;
        }
        const town: ArkAnimal[] = [];
        const wild: ArkAnimal[] = [];
        for (const animal of animals) (isl.has(animal) ? town : wild).push(animal);
        // (The wild island's list as the page's prebuild was given it, so its places come from the worker when primed; the
        // same animals as last time keep last time's places: the very same, or a new read of them, field for field.)
        let places: Map<string, Placement>;
        if (!ghosts && lastWild && sameAnimalList(lastWild.animals, wild)) places = new Map(lastWild.places);
        else {
            places = placeAnimals(options.wildAnimals && wild.length === options.wildAnimals.length && wild.every((a, i) => a === options.wildAnimals![i]) ? options.wildAnimals : wild);
            if (!ghosts) lastWild = {animals: wild, places: new Map(places)};
        }
        // The town's plan is of ALL its animals (`island.place` replaces it: who is in which tank, room and enclosure, who
        // is on the schedule). A stand-in's placing (`ghosts`: an eaten prey's, a dead one's, the cast's, a replay's) gave
        // it the stand-ins alone, most often none of the town's at all: the plan was then of nobody, so until the next
        // read every tank's fish, every room's pet and every zoo house's resident was off its plan (no tank, no schedule
        // made for it, the zoo's enclosures closed). Now a stand-in of the wild island leaves the town alone, and a
        // stand-in of the town is planned with everyone who lives there.
        if (!ghosts) {
            lastTown = town;
            isl.place(town, (animal) => animal.activity ?? behaviourProfile(animal.model_slug).activity).forEach((place, id) => places.set(id, place));
        } else if (town.length) {
            const added = new Set(town.map((animal) => animal.id));
            const planned = isl.place([...lastTown.filter((animal) => !added.has(animal.id)), ...town], (animal) => animal.activity ?? behaviourProfile(animal.model_slug).activity);
            for (const animal of town) {
                const place = planned.get(animal.id);
                if (place) places.set(animal.id, place);
            }
        }
        // (The town's colliders for the motion pass, L5's per island: its enclosures follow the snapshot.)
        if (!ghosts || town.length) setIslandColliders({contains: isl.contains, set: isl.colliders()});
        // (A replay's departed are added to the town's list; a snapshot's replace it.)
        if (ghosts) for (const animal of town) townIds.add(animal.id);
        else townIds = new Set(town.map((animal) => animal.id));
        return places;
    };
    // L1's foot IK on the drawn ground (L3's request, docs/ark/grounding.md): feet plant on the drawn triangles, not the
    // analytic surface (they differ by metres at the cliff bands). On the town, its own ground (`island.heightAt`, the
    // normal from its slope), never the wild island's.
    // (One world, T3: the town beside the wild island, so each foot asks the ground of the island it stands on.)
    // (Lane TB: the town's drawn ground, its tile with its pavements, paths and floors, `island.drawnGround`.)
    const applyLocoGround = () => {
        const isl = island;
        setLocoGround(isl ? (x, z) => (isl.contains(x, z) ? isl.drawnGround(x, z) : drawnGround(x, z)) : drawnGround);
    };
    /** Lane TB: the drawn ground the grounding stand puts feet on, on the island it stands on (never the wild sea floor under the town). */
    const standGround = (x: number, z: number, near?: number) => {
        const isl = island;
        return isl && isl.contains(x, z) ? isl.drawnHeight(x, z, near) : drawnGroundHeight(x, z);
    };
    /** The ground and water under an animal for its contact shadow and ring, on its own island. */
    // p2 (contact): `near`, the body's height, picks the floor it is on where floors are stacked (the town's perches, decks).
    const groundUnderAt = (x: number, z: number, seaLevel: number, exact: boolean, near?: number) => {
        const isl = island;
        return isl && isl.contains(x, z) ? isl.groundUnder(x, z, seaLevel, near) : look.groundUnder(x, z, seaLevel, exact);
    };
    /** p2 (contact): the drawn ground's normal under a point, on the island it is on (a contact shadow lies on it). */
    // (`height`: the floor it is on, where floors are stacked: another floor's normal is none of its, so level.)
    const groundNormalAt = (x: number, z: number, height?: number) => {
        const isl = island;
        if (isl && isl.contains(x, z)) {
            const g = isl.drawnGround(x, z);
            return height !== undefined && Math.abs(g.height - height) > 0.05 ? {x: 0, y: 1, z: 0, nx: 0, ny: 1, nz: 0} : {x: g.nx, y: g.ny, z: g.nz, nx: g.nx, ny: g.ny, nz: g.nz};
        }
        const n = look.groundNormal(x, z);
        return {...n, nx: n.x, ny: n.y, nz: n.z};
    };
    applyLocoGround();
    const forced = forcedTier();
    let tier: QualityTier = forced ?? tierFor(options.deviceMemoryGB);
    const renderer = new WebGLRenderer({antialias: tier === "low", powerPreference: "high-performance"});
    // (No draw call with nothing to draw: `runtime/empty-draws.ts`.)
    skipEmptyDraws(renderer);
    // One frame is several passes: count them all (reset at the frame's start).
    renderer.info.autoReset = false;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.66;
    renderer.shadowMap.type = PCFSoftShadowMap;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, TIER_SETTINGS[tier].pixelRatio);
    /**
     * Mobile performance lane (`runtime/pace.ts`): on a touch device, the frame rate (the display's, or a steady 30), the
     * drawing buffer's scale on the tier's pixel ratio and, as a last resort, the tier, from the frames as they are drawn.
     * Elsewhere (a desktop) and in a recording: none of it (the tier check as before, the scale 1).
     */
    // (The low tier starts at a steady 30 when the main thread is slow, `tierForCpu`; otherwise at the display's rate.)
    const pacer = !options.recording && Boolean(window.matchMedia?.("(pointer: coarse)").matches) ? new ArkFramePacer(tier, performance.now() / 1000, tier === "low" && (arkCpuScoreMs() ?? 0) > SLOW_CPU_MS) : null;
    // (A tier on trial, an iPhone's medium, must hold the display's rate: `pace.ts` rule 5.)
    if (pacer && !forced) pacer.trial = tierTrialOn();
    let resolutionScale = 1;
    /** The drawing buffer's pixels per CSS pixel: the tier's pixel ratio at the pacing's scale. */
    const drawRatio = () => pixelRatio * resolutionScale;
    /**
     * (Performance lane.) The highest scale the pacing may reach (`pace.ts` rule 4). The low tier draws one buffer pixel
     * a CSS pixel; on a denser screen, frames to spare earn up to `LOW_SHARP_RATIO` (never past the screen's own
     * density). Not while battery saver or heat holds the tier down, nor when the reader asked for the lighter view.
     */
    const scaleTop = () => (tier === "low" && liteChoice !== true && !runtime.powerCapped() ? Math.max(Math.min(window.devicePixelRatio || 1, LOW_SHARP_RATIO) / pixelRatio, 1) : 1);
    renderer.setPixelRatio(drawRatio());
    // The frame profiler and its overlay (`?perf=1`, runtime/perf.ts): off, every mark is one early return.
    const perf = new ArkPerf(arkPerfAsked());
    /** The shared collisions' time in the current `stepSchedule` call (the profiler's "collide"). */
    let collideCallMs = 0;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.outline = "none";
    canvas.tabIndex = 0;
    // The world takes the keyboard (A18): arrows move the view, + and − zoom, Esc closes the card.
    canvas.setAttribute("role", "application");
    // A lost context, back: it comes back empty, and the page starts the scene again (`ArkSceneOptions.onContextRestored`).
    const onContextRestored = () => options.onContextRestored?.();
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    if (options.canvasLabel) canvas.setAttribute("aria-label", options.canvasLabel);
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(canvas);

    const labelLayer = document.createElement("div");
    labelLayer.setAttribute("aria-hidden", "true");
    Object.assign(labelLayer.style, {position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden"});
    el.appendChild(labelLayer);

    let reducedMotion = Boolean(options.reducedMotion);
    /** The lighter view (A18): the reader's choice, or (null) on whenever the device's tier is low. */
    let liteChoice: boolean | null = typeof options.lite === "boolean" ? options.lite : null;
    const autoTier = tier;
    const liteOn = () => liteChoice ?? tier === "low";
    // Runtime: the instance caps per tier (runtime/budgets.ts; high and the lighter view as LITE_CAPS / *_CAP).
    const caps = () => runtime.caps(tier, liteOn());
    const scene = new Scene();
    // (A live view: the town's close-up detail fills in a few cells a frame after a jump, `islands/town/render/near.ts`.)
    TOWN_NEAR_LIVE.value = !options.recording;
    // The hour: pinned by the page (development's `?hour=`), or the viewer's own clock.
    let pinnedHours = typeof options.hours === "number" && Number.isFinite(options.hours) ? options.hours : null;
    // Island time (graphics pass): the same hour for every viewer and the livestream, from the shared clock
    // (`src/lib/ark-clock.ts`), not the viewer's own clock. `hours` / `setHours` still pin it (golden shots, recordings).
    // The world's time (ms): the clock, or (development, `setClockScale`) the clock run faster for a day-night recording.
    let clockScale = 1;
    let clockAnchor = Date.now();
    let clockAnchorReal = clockAnchor;
    // (A pinned shared clock, `pinArkClock`: a recorded event replayed at its own time, `replay/README.md`.)
    const worldMs = () => arkPinnedMs() ?? clockAnchor + (Date.now() - clockAnchorReal) * clockScale;
    const hoursNow = () => pinnedHours ?? islandHours(worldMs(), ISLAND_OFFSET_HOURS);
    // The weather and tide, from the same clock unless pinned (`setEnvironment`).
    let pinnedEnvironment: LivePin | null = null;
    /** The weather as the reactive layer reads it (comfort, hearing, smell on the wind): the liveliness controller's, pins and all. */
    let reactiveWeather = {rain: 0, wind: 0.3, windDirection: 0, fog: 0, storm: 0};
    let lookWeather: LookWeather = {wetness: 0, rain: 0, wind: 0.35};
    let environmentAt = 0;
    const voyageStart = Date.parse(options.snapshot.voyage.started_at ?? "") || null;
    const applyEnvironment = (force = false) => {
        const realMs = Date.now();
        // Every 2 s (a fast clock for a recording: every frame, so a tide's turn is smooth).
        if (!force && realMs - environmentAt < (clockScale > 1 ? 0 : 2000)) return;
        environmentAt = realMs;
        // The world's time (the island clock, run faster for a recording): weather, tide, young, shelter (`liveliness-scene.ts`).
        const env = liveliness.environmentAt(worldMs(), pinnedEnvironment);
        reactiveWeather = {rain: env.rain, wind: env.wind, windDirection: env.windDirection, fog: env.fog, storm: env.storm};
        // The animal-look pass: coats soak in the rain and dry before the ground; dust only on dry ground (a pinned wetness with no rain: none).
        lookWeather = {wetness: env.wetness, rain: pinnedEnvironment?.rain ?? (pinnedEnvironment?.wetness !== undefined ? 0 : env.rain), wind: env.wind};
        ARK_ENVIRONMENT.seaLevel.value = env.seaLevel;
        ARK_ENVIRONMENT.wetness.value = env.wetness;
        ARK_ENVIRONMENT.snow.value = env.snow;
        ARK_ENVIRONMENT.wind.value = env.wind;
        ARK_ENVIRONMENT.storm.value = env.storm;
        ARK_ENVIRONMENT.cloud.value = env.cloud;
        ARK_ENVIRONMENT.rain.value = lookWeather.rain;
        const strength = 0.45 + 1.4 * env.wind + 2 * env.storm;
        ARK_WIND_VECTOR.value.set(Math.cos(env.windDirection), Math.sin(env.windDirection)).multiplyScalar(strength * 0.95);
        WATER_WIND.value = 0.6 + 1.2 * env.wind + 1.6 * env.storm;
    };
    const lighting = new ArkLighting(renderer, scene, hoursNow());
    const fog = new Fog(lighting.horizon, 420, 1700);
    scene.fog = fog;
    // Part B: the edge haze rides on this fog (whoever sets it sets its base; with the haze off it is exactly that).
    const haze = hazeFog(fog);
    // Liveliness (`liveliness-scene.ts`): the clock's weather, tide and ages through the animals, the rain and fog,
    // the traces they leave, and the sound (off until a tap). Its hooks read the scene below, when they are called.
    const soundBase = options.soundBase !== undefined ? options.soundBase : (/^(https?:\/\/[^/]+)\/storage\/v1\//.exec(options.modelBase)?.[1] ?? null);
    // 3.3 batch (C): who the record says each young one's parents are (this visit's births, and earlier visits' on this device).
    const lineage = new Lineage({
        get: () => {
            try {
                return window.localStorage.getItem("ark-lineage-v1");
            } catch {
                return null;
            }
        },
        set: (text) => window.localStorage.setItem("ark-lineage-v1", text)
    });
    const liveliness = new ArkLiveliness({
        tier,
        fog,
        renderer,
        voyageStartMs: voyageStart,
        offsetHours: ISLAND_OFFSET_HOURS,
        soundBase,
        onSoundCredits: options.onSoundCredits,
        hooks: {
            // 3.3 batch (C): the young one's recorded mother (the parent drawn female, as the birth act has it).
            recordedParents: (id) => lineage.parentsOf(id),
            maleOf: (animal) => {
                const sex = sexLook(animal.id, animal.model_slug).sex;
                return sex === "male" ? true : sex === "female" ? false : null;
            },
            planOf: (slug) => library.get(slug)?.behaviour?.plan,
            profileOf: (e) => (e as Entry).sched?.profile ?? null,
            poseAt: (e, epoch) => {
                const own = (e as Entry).sched;
                if (!own || reducedMotion) return null;
                // Its schedule at another moment, its own trips left as they were (no cache of this frame's disturbed).
                const kept = {trip: own.trip, lead: own.lead};
                const at = schedulePose(e as Entry, epoch);
                own.trip = kept.trip;
                own.lead = kept.lead;
                return at;
            },
            roostOf: (e) => {
                const own = (e as Entry).sched;
                return own ? roostOf(worldOf(own.animal), own.profile, own.animal) : null;
            },
            entryOf: (id) => findEntry(id),
            heightAt,
            // sig-young: water deep enough to swim in (a grebe's, a swan's, a hippo's young ride only over it, `young-ways.ts`).
            deepWater: (x, z) => waterTopAt(x, z) - heightAt(x, z) > DEEP_WATER
        }
    });
    liveliness.setReducedMotion(reducedMotion);
    scene.add(liveliness.root);
    const dust = new DustPuffs();
    scene.add(dust.points);
    /** REAL-REPRODUCTION (decision 440): the gametes, eggs, milt and fry of the kinds' own ways of breeding (one draw). */
    const reproFx = new ReproFx(scene);
    /** REAL-REPRODUCTION: spawning rocks now (where, the room kept round them, how far in). */
    let reproNests: Array<{x: number; z: number; r: number; k: number}> = [];
    /** What meals leave on the ground (`meal-traces.ts`): feathers, fur, scales, pressed grass. */
    const mealTraces = new MealTraces();
    scene.add(mealTraces.patches, mealTraces.bits);
    // The behaviour recipes' near detail: catches and nest material carried, splashes, dirt, holes and mounds, nests,
    // ambient fish and flockmates (`recipe-scene.ts`); the poses are the schedule's.
    const recipeScene = new RecipeScene();
    scene.add(recipeScene.root);
    // The reef lane's ambient schools: a chase or a plunge goes after the nearest one (`setFishSource`).
    setFishSource((pos, radius, epoch) => fishSchoolsNear(pos, radius, epoch));
    /** Its seeded sex's size (`behaviour-recipes.ts` sexLook: a stag bigger than a hind; the species' mean stays). */
    const sexScale = (animal: ArkAnimal) => sexLook(animal.id, animal.model_slug).scale;
    // Clutches laid and hatching, in a replay (A9).
    const nests = new ArkNests();
    scene.add(nests.root);

    // Part B (docs/ark/streaming.md): the world in chunks along the ground's grid; the ground in tiles, the plants by chunk.
    const chunkGrid = chunkGridFor(TERRAIN_HALF, GROUND_SEGMENTS);
    const landscape = buildLandscape(chunkGrid);
    // (A live view: the ground's tiles coming within the render distance are built in full two a frame, the nearest to
    // what the camera looks at first, `streaming/ground-tiles.ts`; a recording builds them at once, as before.)
    if (landscape && !options.recording) landscape.tiles.spread = 2;
    // ARK-CONTACT (decision 447): the animals stand on the ground as its tiles draw it now (a map tile: every 4th vertex).
    if (landscape) setDrawnGroundStride((x, z) => landscape.tiles.strideAt(x, z));
    const graphicsBase = (options.graphicsBase ?? "/ark/graphics").replace(/\/+$/, "");
    void loadGroundTextures(graphicsBase);
    lighting.loadDaySky(`${graphicsBase}/sky-day.hdr`);
    if (landscape) scene.add(landscape.ground, landscape.water);
    /** The town's meshes in the scene and its sea floor in the one sea (decision 143). */
    const addIslandWorld = (isl: ArkIslandScene) => {
        scene.add(isl.root);
        const uniforms = (landscape.water.material as ShaderMaterial).uniforms;
        if (uniforms.islandDepth && isl.seaDepth) {
            uniforms.islandDepth.value = isl.seaDepth;
            // (Its sea floor only under its drawn chunks: the fail-safe for any part of it not drawn.)
            if (uniforms.islandDrawn) uniforms.islandDrawn.value = isl.drawnMask;
            (uniforms.islandPatch.value as {set: (x: number, y: number, z: number, w: number) => void}).set(isl.origin.x, isl.origin.z, isl.half, 16);
        }
    };
    if (island) addIslandWorld(island);
    // Runtime: the grass built for the device's tier, not always the highest's (runtime/budgets.ts GRASS_BUILD).
    const vegetation = buildVegetation(arkGrassBuild(tier), chunkGrid);
    /** The words for it ("Grass here: thinning", the page's, through the live log's fetch), null until then. */
    let grassWords: Partial<Record<GrassKey, string | null>> | null = null;
    /** The record's vegetation (`setVegetation`), null while it is off. */
    let grazing: ArkVegetation | null = null;
    // Close-up detail round what the camera looks at (graphics pass): pebbles, shells, litter, ferns, clover.
    const nearDetail = new NearDetail();
    if (nearDetail) scene.add(nearDetail.group);
    // p2 (ground): the ground at bug scale round what the camera looks at (blades, crumbs, moss, twigs), only close up.
    const bugGround = new BugGround();
    scene.add(bugGround.group);
    // p3 (trees): the blades the small ground insects climb (`bug-climb.ts`), near the camera only.
    const climbStems = new ClimbStems();
    scene.add(climbStems.mesh);
    const climbGround: ClimbPoint = {x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, ty: 0, tz: 1};
    const climbBlade: ClimbPoint = {x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, ty: 0, tz: 1};
    // ARK-WEBS: the web spinners' webs at their homes, hung on what is drawn there, and the spider on its web
    // (`spider-webs-draw.ts`, loaded with the first spider the scene draws); null until its web is fitted near the camera.
    let spiderWebs: SpiderWebs | null = null;
    let spiderWebsLoading = false;
    const webNoted = new Map<string, boolean>();
    const webPoseOf = (entry: Entry): SurfacePoint | null => {
        if (!/spider|weaver|widow/.test(entry.animal.model_slug) || entry.visitor) return null;
        if (!spiderWebs) {
            if (!spiderWebsLoading) {
                spiderWebsLoading = true;
                void import("@/ark-scene/spider-webs-draw").then((m) => {
                    spiderWebs = new m.SpiderWebs(scene, (x, z, near) => standGround(x, z, near));
                    scene.add(spiderWebs.mesh);
                    if (process.env.NODE_ENV !== "production") (window as unknown as {__arkWebs?: SpiderWebs}).__arkWebs = spiderWebs;
                }).catch(() => undefined);
            }
            return null;
        }
        const id = entry.animal.id;
        let noted = webNoted.get(id);
        if (noted === undefined) {
            const micro = entry.place.micro;
            const home = micro ? surfacePoint(micro, entry.animal.zone, 0) : {x: entry.place.x, y: entry.place.ground, z: entry.place.z};
            noted = spiderWebs.note(id, entry.animal.model_slug, entry.animal.scientific_name, {x: home.x, y: home.y, z: home.z});
            webNoted.set(id, noted);
        }
        return noted ? spiderWebs.pose(id, hoursNow(), worldMs() / 1000) : null;
    };
    // The asset library's trees (graphics pass, batch 3): they replace the decor's tree shapes once loaded.
    const assetTrees = new AssetTrees(options.assetBase);
    if (assetTrees) scene.add(assetTrees.group);
    let assetTreesShown = false;
    // p5 (humans): logging and replanting on the wild island (the record's forestry; humans aboard are the crews).
    let forestHumans: string[] = [];
    // (Its perches: every animal whose place, perch or roost is off the ground: its tree is left standing.)
    const forestPerches = () => {
        const out: Array<{x: number; z: number}> = [];
        for (const e of entries) {
            if (e.visitor) continue;
            const p = e.place;
            if (p.ground - heightAt(p.x, p.z) > 0.8) out.push({x: p.x, z: p.z});
            if (p.perch && p.perch.y - heightAt(p.perch.x, p.perch.z) > 0.8) out.push({x: p.perch.x, z: p.perch.z});
            const roost = p.map?.roost;
            if (roost && roost.y - heightAt(roost.x, roost.z) > 0.8) out.push({x: roost.x, z: roost.z});
        }
        return out;
    };
    const forest = new ForestScene({setOverride: assetTrees ? (o) => assetTrees.setOverride(o) : null, ground: (x, z) => standGround(x, z), humans: () => forestHumans, perches: forestPerches});
    scene.add(forest.group);
    // Graphics batch 5: the asset lane's rocks replace the procedural ones once loaded (asset-rocks.ts).
    const assetRocks = new AssetRocks(options.assetBase);
    if (assetRocks) scene.add(assetRocks.group);
    let assetRocksShown = false;
    // Graphics batch 6: the asset lane's forest floor (litter, twigs, cones, logs).
    const assetFloor = new AssetFloor(options.assetBase);
    if (assetFloor) scene.add(assetFloor.group);
    if (vegetation) {
        for (const mesh of vegetation.meshes) scene.add(mesh);
        scene.add(vegetation.grass);
    }
    const motes = buildMotes(260);
    motes.points.visible = !reducedMotion;
    scene.add(motes.points);
    // The cottage at Home, its porch light and the garden pond (the small animals' microhabitats).
    const micro = buildMicroScene();
    if (micro) {
        scene.add(micro.group);
        micro.setNight(lighting.daylight.night);
    }
    // The layers: burrows and the cutaway's pit and tunnels, the sea's plankton, glow and underwater light.
    const layersScene = buildLayersScene();
    scene.add(layersScene.group);
    renderer.localClippingEnabled = true;
    if (landscape && vegetation) layersScene.clip([landscape.groundMaterial, vegetation.grass.material as MeshStandardMaterial, ...vegetation.meshes.map((mesh) => mesh.material as MeshStandardMaterial)]);
    const PLANKTON = planktonClouds();
    // Scenery modules outside this file (`scene-modules.ts`: the props lane's nests, homes and area details), built below.
    let modules: ArkSceneModule[] = [];

    const camera = new PerspectiveCamera(FOV, 1, 0.4, 9000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = CAMERA_RANGE.near;
    // (Part C: with two islands the camera reaches out over both: the town's whole view is ~600 m off. The v2 island
    // is islands mode only: the reach is the two islands' from the start.)
    let maxDistance = island ? wildFrame().reachIslands : wildFrame().reach;
    controls.maxDistance = maxDistance;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.36;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.9;
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.autoRotateSpeed = DRIFT_SPEED;
    /** When the idle drift began (s; P6's sway on v2 is timed from it). */
    let driftFrom = 0;

    const shadows = new ContactShadows();
    // The animal-look pass (`animal-look.ts`): surfaces, wet and dust, eyes, fur shells, close-up skins, contact shadows.
    const look = new AnimalLook({
        scene,
        renderer,
        closeUpBase: options.closeUpBase === undefined ? options.modelBase.replace(/\/ark\/?$/, "/ark-closeup") : options.closeUpBase,
        basisBase: options.basisBase ?? "/ark/basis/",
        enabled: options.animalLook !== false
    });
    shadows.setContact(look.on);
    const rings = new GroundRings();
    // A placeholder species (A13) has no icon art: the generic figure's.
    // (And for a species whose art is not in the bucket, on a host that has no list of them: the apps' embed.)
    const tokens = new IconTokens((slug) => (isArkPlaceholderSlug(slug) ? ARK_PLACEHOLDER_ICON : options.iconUrl(slug)), 2048, ARK_PLACEHOLDER_ICON, renderer);
    const dots = new FindDots();
    const specks = new HerdSpecks();
    scene.add(shadows.mesh, rings.mesh, tokens.mesh, dots.mesh, specks.meshes["four-legged"].mesh, specks.meshes.oval.mesh);

    const post = new ArkPost(renderer, scene, camera, tier);

    // MARK: Part B, streaming (docs/ark/streaming.md)

    // The chunks' heights (the ground's own), and which hold something: land, plants, (with the snapshot) animals' homes.
    const groundSize = landscape ? landscape.arrays.size : 0;
    const groundHeights = new Float32Array(groundSize * groundSize);
    if (landscape) for (let i = 0; i < groundHeights.length; i++) groundHeights[i] = landscape.arrays.positions[i * 3 + 1];
    const chunkContent = new Uint8Array(chunkCount(chunkGrid));
    spansFromHeights(chunkGrid, groundHeights, groundSize, 0).forEach((span, key) => {
        if (span.maxY > 0.3) chunkContent[key] = 1;
    });
    if (vegetation) {
        const perChunk = new Uint32Array(chunkCount(chunkGrid));
        for (const chunked of vegetation.chunked) chunked.perChunk(perChunk);
        perChunk.forEach((n, key) => {
            if (n) chunkContent[key] = 1;
        });
    }
    let sceneGpuMB = 0;
    let sceneGpuAt = -Infinity;
    const streamer = new ArkStreamer({
        grid: chunkGrid,
        spans: spansFromHeights(chunkGrid, groundHeights, groundSize, CHUNK_HEADROOM),
        content: chunkContent,
        tier,
        // (Two islands: the clear fog pushed out with their reach, as the world's frame says: decisions 142 and 234.)
        fogFrom: wildFrame().fogFrom,
        haze,
        heapLimitMB: ((performance as Performance & {memory?: {jsHeapSizeLimit?: number}}).memory?.jsHeapSizeLimit ?? 0) / 2 ** 20 || null,
        memory: () => {
            // The scenery's GPU estimate (every object's geometry and textures but the animal models' own, which keep to
            // their own ceiling: `runtime/memory.ts`, `runtime.memoryReading`), at most every 10 s; and the heap's floor
            // over the last half minute, not this moment's reading.
            const nowS = performance.now() / 1000;
            const reading = runtime.memoryReading();
            if (nowS - sceneGpuAt > 10) {
                sceneGpuAt = nowS;
                const memory = sceneMemory(scene, runtime.modelObjects());
                sceneGpuMB = (memory.geometryBytes + memory.textureBytes) / 2 ** 20;
            }
            return {heapMB: reading.heapFloorMB, gpuMB: sceneGpuMB};
        },
        // (At the frame's end, where the pacing's own tier changes are made: the new tier's shaders are then compiled
        // beside the frames by the runtime's warm-up. Applied here, in the middle of a frame, the same frame's draw
        // compiled every one of them and waited: 0.65 s on a desktop.)
        onDrop: () => {
            memoryDropAsked = true;
        }
    });
    let memoryDropAsked = false;
    let streamSkipped = 0;
    let streamMarkers = 0;
    /** The props and other modules' objects, by chunk (`streaming/cull.ts`): the cottage and pond, the burrows and pit, and the modules once built. */
    const streamCull = new StreamCull();
    if (micro) streamCull.track(micro.group);
    streamCull.track(layersScene.group);
    const drawnIn = (chunk: number) => streamer.stateOf(chunk) === STATE_IN;
    const drawnAny = (chunk: number) => streamer.stateOf(chunk) !== STATE_OUT;
    const atIn = (x: number, z: number) => streamer.stateAt(x, z) === STATE_IN;
    const atAny = (x: number, z: number) => streamer.stateAt(x, z) !== STATE_OUT;
    streamer.onChange((states, allHere) => {
        // (This island's own: with another island in the world, it is all in whenever its own chunks are.)
        const all = allHere;
        landscape?.tiles.apply(states, performance.now() / 1000);
        // The ground's plants and the trees as the map too; the grass, the forest floor and the props only in full.
        vegetation?.setDrawn(all ? null : drawnAny, all ? null : drawnIn);
        assetTrees?.setDrawn(all ? null : atAny);
        assetRocks?.setDrawn(all ? null : atAny);
        assetFloor?.setDrawn(all ? null : atIn);
        streamCull.apply(all ? null : atIn);
    });
    // Part C: the town's chunks on Part B's streamer, on its own grid at its world origin (the multi-island streamer,
    // `ark-streaming-islands`); until that is in, the town is drawn whole.
    let islandStreamed = false;
    /** The town being shown a few chunks a frame as it joins (decision 153). */
    let townRevealing = false;
    /** The town's animals wait for its ground: their joining starts once its chunks are all shown (`attachIsland`). */
    let townJoin: (() => void) | null = null;
    /** A point's chunk state (Part C: until the multi-island streamer is in, the town's square counts as drawn in full). */
    const streamStateAt = (x: number, z: number) => (island && !islandStreamed && island.contains(x, z) ? STATE_IN : streamer.stateAt(x, z));
    const registerIslandStream = (isl: ArkIslandScene) => {
        const register = (streamer as unknown as {registerIsland?: (spec: {id: string; offset: {x: number; z: number}; grid: ArkIslandScene["grid"]; spans: ArkIslandScene["spans"]; content: Uint8Array; apply: (states: Uint8Array, allIn: boolean) => void}) => void}).registerIsland;
        islandStreamed = Boolean(register);
        register?.call(streamer, {id: "town", offset: isl.origin, grid: isl.grid, spans: isl.spans, content: isl.content, apply: isl.applyStream});
    };
    if (island) registerIslandStream(island);
    // (The town coming, built after the first frame: the fog reads both islands from the first frame, `expectIsland`.)
    else if (options.wildAnimals) streamer.expectIsland({id: "town", offset: townWorldOrigin(), grid: TOWN_GRID});

    const applyTier = (next: QualityTier) => {
        const liteBefore = liteOn();
        tier = next;
        runtime.tierChanged(tier);
        streamer.setTier(tier);
        const settings = TIER_SETTINGS[tier];
        lighting.setShadows(renderer, settings.shadows);
        vegetation?.setShadows(settings.shadows > 0);
        micro?.setShadows(settings.shadows > 0);
        island?.setShadows(settings.shadows > 0);
        island?.setTier(tier);
        shadows.setStrength(look.contactStrength(settings.shadows > 0));
        look.setTier(tier, liteOn());
        vegetation?.setGrassCount(settings.grass);
        vegetation?.setFill(settings.fill);
        nearDetail?.setShare(tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.35);
        bugGround.setTier(tier); // p2 (ground)
        // Full trees only close in on phones: the medium tier keeps the near level within about 10 m.
        assetTrees?.setTier(tier === "high" ? 1 : tier === "medium" ? 0.45 : 0.3, settings.fill, settings.shadows > 0);
        assetRocks?.setTier(tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.4, settings.shadows > 0);
        assetFloor?.setTier(tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.4, settings.shadows > 0);
        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far]) if (mesh) mesh.castShadow = settings.shadows > 0;
        });
        post.setTier(tier);
        liveliness.setTier(tier, liteOn());
        ARK_GROUND_LITE.value = tier === "low" ? 1 : 0;
        for (const sceneModule of modules) {
            sceneModule.setTier(tier, liteOn());
            sceneModule.setShadows(settings.shadows > 0);
        }
        pixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
        // (The canvas takes the tier's pixel ratio when the next frame is drawn: `resize`, `sizeCanvas`.)
        if (pacer) {
            pacer.setTier(tier, performance.now() / 1000);
            // (A scale earned above the low tier's ratio is not the next tier's.)
            pacer.setTop(scaleTop(), performance.now() / 1000);
            resolutionScale = pacer.resolution;
            if (runtime.ready) runtime.setPaceCap(pacer.interval);
        }
        motes.points.visible = !reducedMotion && !liteOn();
        resize();
        options.onTier?.(tier, liteOn());
        // The lighter view came on (or went off) with the tier: fewer of each herd drawn one by one.
        if (liteBefore !== liteOn() && herds.length) setSnapshot(current, false);
    };

    const library = new ModelLibrary(options.modelBase, 4);
    // L7's chases (docs/ark/chases.md, "Wiring for the integrator"): recipe legs against L5's colliders, chase paces from
    // L1's sprint and flee and L2's swim burst and stoop.
    setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)});
    const chasePlan = (slug?: string) => (slug ? library.get(slug)?.behaviour?.plan ?? null : null);
    setChasePaces({
        sprint: (b) => sprintPace({plan: chasePlan(b.slug), slug: b.slug, length: b.length, speedStat: b.speedStat}),
        flee: (b) => fleePace({plan: chasePlan(b.slug), slug: b.slug, length: b.length, speedStat: b.speedStat}),
        burst: (b) => {
            const swim = b.slug ? locoStyle(b.slug, chasePlan(b.slug)).swim : null;
            return swim ? swimPaces(b.length, swim).burst : null;
        },
        dive: (b) => (b.slug ? flightSpec(b.slug, b.length, chasePlan(b.slug))?.dive ?? null : null)
    });
    const species = new Map<string, SpeciesMeshes>();
    // Runtime (src/ark-scene/runtime): when to draw, power, the load order and budgets, the camera's body, the bar and reset.
    const runtime: ArkRuntime = createArkRuntime({
        // (Part C: the ground of the island under the camera: the same heights as the wild island's with one island.)
        groundAt: heightAt,
        // (Part C: the town's buildings for the camera's body, once the town is in.)
        islandObstacles: () => island?.cameraObstacles() ?? null,
        el,
        canvas,
        renderer,
        scene,
        camera,
        controls,
        library,
        options,
        tier: () => tier,
        // (A tier pinned for measuring, `__arkQuality`, stays pinned.)
        applyTier: (next) => {
            if (!forced) applyTier(next);
        },
        dropNear: (slug) => {
            const meshes = species.get(slug);
            if (!meshes) return;
            if (meshes.near) {
                scene.remove(meshes.near);
                meshes.near.dispose();
                meshes.near = null;
            }
            meshes.nearMaterial?.dispose();
            meshes.nearMaterial = null;
        },
        awayFromHome: () => {
            if (opening || replay || selectedId || followId || flight) return false;
            const home = homeView();
            // (Its own numbers: the shared spherical and offset belong to the flights.)
            const distance = camera.position.distanceTo(controls.target);
            const polar = Math.acos(Math.min(Math.max((camera.position.y - controls.target.y) / Math.max(distance, 1e-6), -1), 1));
            return controls.target.distanceTo(home.target) > 12 || Math.abs(distance / home.distance - 1) > 0.25 || Math.abs(polar - home.polar) > 0.22;
        },
        goHome: () => {
            endFollow();
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const view = homeView();
            fly(view.target, view.distance, 1.4, view.polar, view.azimuth);
        },
        fillShare: (at) => TIER_SETTINGS[at].fill,
        renderTarget: () => (post as unknown as {composer?: {readBuffer?: WebGLRenderTarget} | null}).composer?.readBuffer ?? null
    });
    // The rigs: the release's set beside the model set (or the page's own folder), then the v1 fallback set, each
    // manifest read once; a species plays from the first set that lists it. Nothing while motion is reduced.
    const rigs = new RigLibrary(rigBasesFrom(options.modelBase, options.rigBase), RIG_CAPS);
    rigs.onEvict = (slug) => {
        const meshes = species.get(slug);
        if (meshes?.rig) {
            scene.remove(meshes.rig);
            meshes.rig.dispose();
            meshes.rigMaterial?.dispose();
            meshes.rig = null;
            meshes.rigMaterial = null;
        }
        for (const entry of entries) if (entry.animal.model_slug === slug && entry.rig) entry.rig.weight = 0;
    };
    let entries: Entry[] = [];
    let entryById = new Map<string, Entry>();
    // The visitor (a panel beside a chat only): drawn and pickable, never counted.
    let visitor: Entry | null = null;
    let visitorLabel: HTMLSpanElement | null = null;
    let jetty: Group | null = null;
    /** A replay's stand-ins for animals that are gone now. */
    let ghosts: Entry[] = [];
    /** The live world's stand-ins for animals eaten in a meal still being acted (`live-meals.ts`). */
    let mealGhosts: Entry[] = [];
    // 3.3 fix (log): who left the roster lately (a death of the record): where it was, for where its body lies (`live-deaths.ts`).
    const departed = new Map<string, Entry>();
    const allEntries = () => (visitor || ghosts.length || mealGhosts.length ? [...entries, ...ghosts, ...mealGhosts, ...(visitor ? [visitor] : [])] : entries);
    const findEntry = (id: string | null) => (id ? entryById.get(id) ?? (visitor?.animal.id === id ? visitor : null) : null);
    /** The animal the camera follows (until any drag). */
    let followId: string | null = null;
    /** Tiny animals seen (`tiny-lift.ts`): the eased lift of the one chosen or followed, and when it was last stepped. */
    const tinyLifts = new Map<string, {value: number; at: number}>();
    const liftTiny = (entry: Entry, distance: number, at: number): number => {
        const id = entry.animal.id;
        // (`__arkTinyLift = false`: the harness's before picture, true size.)
        const watched = (selectedId === id || followId === id) && (globalThis as {__arkTinyLift?: boolean}).__arkTinyLift !== false;
        const want = tinyLift(watched, entry.trueLength, entry.length, distance, height, FOV);
        const was = tinyLifts.get(id);
        if (!was && want === 1) return 1;
        const value = reducedMotion ? want : easeLift(was?.value ?? 1, want, was ? at - was.at : 0.016);
        if (want === 1 && Math.abs(value - 1) < 0.01) {
            tinyLifts.delete(id);
            return 1;
        }
        tinyLifts.set(id, {value, at});
        return value;
    };
    // Who is talking, and the full model that stands in for them.
    const talking = {
        target: null as ArkTalking | null,
        actor: null as TalkingActor | null,
        mouth: new TextMouth(),
        pulse: 0,
        pulseAt: 0,
        lastActive: 0,
        open: 0,
        weight: 0
    };
    let talkingModels: TalkingModelSource | null = null;
    let mineOnly = Boolean(options.mineOnly);
    let selectedId: string | null = null;
    // Herds (A14): the snapshot as last given, every id aboard, and who must be drawn one by one.
    // p5 (humans): the town's people, one generic figure per human aboard (privacy: body and clothes from the id only,
    // never the capture's photo, a face or a name). (`away`: at work in the wild island's forest, `forest.away`.)
    // Humans visible (2026-11-18): people at home and asleep live in the towers' apartments (`humans/home-rooms-host.ts`),
    // seen through their open bays on the sofa, at the TV (`humans/tvs.ts`) and in bed; the scene draws the flats they live
    // in furnished (`island.setPeopleRooms`). Before this they were never drawn (no room host), so at night no one was seen.
    const townHumans = new TownHumans({away: (id) => forest.away(id), origin: townWorldOrigin(), roadHeight: townRoadHeight, seaLevel: () => ARK_ENVIRONMENT.seaLevel.value, boatSeconds: () => clockNow()});
    const humanFigures = new PeopleFigures(); // p6 (people): rigged bodies (the procedural figures while they load)
    // Carers (decision 418): the keepers, farmers and owners who feed the kept animals, generic figures (never anyone's
    // photo, face or name; not humans aboard), drawn only while the server's `carers` is on (`setCarers`; `?carers=1` in
    // the harnesses). Their posts are the town's (`island.carerPosts`), asked for once per placement.
    let carersOn = (globalThis as {__arkCarers?: boolean}).__arkCarers === true;
    let carerPosts: readonly CarerPost[] = [];
    let carerAsk: Promise<readonly CarerPost[]> | null = null;
    const carerOut: DrawnCarer[] = [];
    const stepCarers = (isl: NonNullable<typeof island>, hours: number): readonly DrawnCarer[] => {
        if (!carersOn) return carerOut.length ? ((carerOut.length = 0), carerOut) : carerOut;
        const ask = isl.carerPosts?.() ?? null;
        if (ask !== carerAsk) {
            carerAsk = ask;
            carerPosts = [];
            void ask?.then((posts) => {
                if (carerAsk === ask) carerPosts = posts;
            });
        }
        return carersAt(carerPosts, hours, townWorldOrigin(), isl.drawnHeight, carerOut);
    };
    scene.add(humanFigures.group);
    const humanTVs = new HumanTVs(); // humans visible: the TVs people at home watch
    scene.add(humanTVs.group);
    const sleepCovers = new SleepCovers(); // humans polish: the covers over those asleep
    scene.add(sleepCovers.group);
    /** Humans visible: the homes as the grown and the pets' flats are now (rebuilt only when either changes). */
    let humanRoomsFor: {island: unknown; grown: number; pets: readonly string[] | null} = {island: null, grown: -1, pets: null};
    const syncHumanRooms = (isl: NonNullable<typeof island>) => {
        const pets = isl.petRooms?.() ?? null;
        const grown = townHumans.grown.length;
        const was = humanRoomsFor;
        if (was.island === isl && was.grown === grown && (was.pets === pets || (was.pets !== null && pets !== null && was.pets.join(",") === pets.join(",")))) {
            humanRoomsFor.pets = pets;
            return;
        }
        humanRoomsFor = {island: isl, grown, pets};
        townHumans.setRoomHost(humanRoomHost(towerApartments(townPlan()), grown, new Set(pets ?? [])));
        isl.setPeopleRooms?.(townHumans.homeRooms());
    };
    const beachProps = new BeachProps(); // p5 (humans, quality pass): the sunbathers' towels and parasols
    scene.add(beachProps.group);
    // p5 (humans, dogs): the town's people walk the record's own dogs on a lead (`humans/dog-walks.ts`): a walked dog is
    // its own entry moved along the walk (its `act`), pinned outside while it walks; never a second dog.
    const dogWalks = new DogWalks(() => townHumans.walks!.graph, () => dogWalkPlaces(townHumans.beachWalks));
    townHumans.setDogWalks(dogWalks);
    const dogLeads = new DogLeads();
    scene.add(dogLeads.mesh);
    let dogRosterDirty = true;
    let walkPins: string[] = [];
    let walkPinsAt = 0;
    let walkPinsFrom: {x: number; z: number} | null = null;
    const dogActs = new Map<string, ActPose>();
    const dogCollar = {x: 0, y: 0, z: 0};
    let humansAboard: ArkAnimal[] = [];
    const humanSplit = new WeakMap<ArkSnapshot, {rest: ArkSnapshot; humans: ArkAnimal[]}>();
    /**
     * p5 (humans): the snapshot without its humans (the same object back when it has none; its own answer when asked
     * again) and its humans: humans are never animal entries, figures, herds or placeholders.
     */
    const splitHumans = (whole: ArkSnapshot) => {
        let split = humanSplit.get(whole);
        if (!split) {
            const humans = whole.animals.filter(isHumanAnimal);
            split = {rest: humans.length ? {...whole, animals: whole.animals.filter((animal) => !isHumanAnimal(animal))} : whole, humans};
            humanSplit.set(whole, split);
            humanSplit.set(split.rest, split);
        }
        return split;
    };
    const withoutHumans = (whole: ArkSnapshot): ArkSnapshot => splitHumans(whole).rest;
    let current: ArkSnapshot = withoutHumans(options.snapshot); // p5 (humans)
    let aboard = new Set<string>();
    let herds: HerdDraw[] = [];
    /** Lane TB: the town's resting kept animals as figures, by species (`FigureGroup`). */
    let restingGroups: FigureGroup[] = [];
    let selectedHerd: string | null = null;
    /** Pinned representatives: the one selected (a herd member promoted), and a replay's animals. */
    let selectionPin: string | null = null;
    let replayPins = new Set<string>();
    /**
     * V2 replay (`replay/cast.ts`, never loaded by the scene itself: whoever needs it hands it in through `setCast`): the
     * stand-ins for animals an act names that are gone now, and the ids pinned so they are always drawn one by one.
     */
    let cast: ArkCastLayer | null = null;
    /** V2 replay: the camera's near plane pushed out toward a shot's subject (m), or null: the scene's own. */
    let nearCut: number | null = null;
    /**
     * V2 replay: the nearest a shot asks to stand to its subject (m), whatever is chosen or near; null: no shot is
     * filming, the scene's own rules. While one films, the camera is kept over the ground as it is drawn (a lake's bed
     * lies under the analytic one) and may come within millimetres of it.
     */
    let shotClosest: number | null = null;
    /** Meal ids pinned (drawn one by one) while the live world acts them. */
    let mealPins = new Set<string>();
    /**
     * V1 (the audit's §2.4 "departure fade instead of the instant vanish"): an animal that has left the Ark between two
     * reads (recovering on a heart, taken off the Ark, its record not read yet) stays where it stood for
     * `DEPART_HOLD_SECONDS` (the record that says why, read just after, takes it over meanwhile: a death's act, a
     * meal's, the cast's stand-in), then fades into the haze over `DEPART_FADE_SECONDS`. Only the drawing.
     */
    let departing: Array<{ghost: Entry; from: number; pose: ActPose}> = [];
    // 3.3 batch (D): the limp of an animal that got away (`live-escapes.ts`), asked by the draw; null until the escapes' layer is up.
    let escapeLimp: ((id: string, epoch: number, moving: boolean, length: number, out: LimpOffsets) => boolean) | null = null;
    const limpNow: LimpOffsets = {drop: 0, roll: 0, pitch: 0};
    // 3.3 batch (D): the rings a laying dragonfly's taps leave on the water (`egg-dip.ts`, recipe `dip_lay`), near the camera.
    const dipRipples = new DipRipples();
    /**
     * 3.3 batch (D): a pond dragonfly laying (`egg-dip.ts`): a small animal on the water's surface whose species has the
     * recipe `dip_lay` (the catalogue's rows, `data/ark/egg-dip.json`), a female, by day, in her breeding months: her
     * flight round her spot and its act, or null. (Who lays is asked once per animal.)
     */
    const dipLayers = new Map<string, boolean>();
    const dipTops = new Map<string, number>();
    const dipCentres = new Map<string, {x: number; z: number} | null>();
    const microDipOf = (entry: Entry): {x: number; y: number; z: number; yaw: number; pitch: number; act: RecipeAct} | null => {
        const id = entry.animal.id;
        const slug = entry.animal.model_slug;
        let lays = dipLayers.get(id);
        if (lays === undefined) dipLayers.set(id, (lays = speciesRecipes(slug).recipes.some((r) => r.id === "dip_lay") && sexLook(id, slug).sex === "female"));
        const hours = hoursNow();
        if (!lays || hours <= 6.3 || hours >= 18.2 || entry.rest > 0.5) return null;
        const epoch = worldMs() / 1000;
        const place = entry.place;
        const open = (x: number, z: number) => {
            const top = waterTopAt(x, z);
            return heightAt(x, z) < top - 0.03 ? top : null;
        };
        // (Her spot is usually a leaf or a reed by the shore: she lays over the nearest open water, none near: never.)
        let centre = dipCentres.get(id);
        if (centre === undefined) dipCentres.set(id, (centre = waterNear(place, open)));
        if (!centre) return null;
        const dip = microDipAt(id, {x: place.x, y: place.micro?.attach?.y ?? place.ground, z: place.z, yaw: place.yaw}, epoch, entry.trueLength, 0.6 * seasonFactor(speciesRecipes(slug), "mating", epoch), open, centre);
        if (!dip) return null;
        dipTops.set(id, dip.top);
        return {x: dip.x, y: dip.y, z: dip.z, yaw: dip.yaw, pitch: dip.pitch, act: {episode: dip.episode, recipe: "dip_lay", block: dip.block, state: dip.block === "fly" ? "fly" : "hover", u: 0, pitch: dip.pitch, roll: 0, own: true, carry: null, prey: null, catch: null, fx: null, mark: null, label: "dip_lay", ...(dip.block === "dip_tail" ? {since: dip.since} : {})}};
    };
    let placedFor: ArkSnapshot | null = null;
    let placedAll = new Map<string, Placement>();
    let disposed = false;
    // Powers you can see (decision 420; `power-show.ts`): loaded with the first read that has an animal above ordinary.
    let powerShow: ArkPowerShow | null = null;
    let powerLoading = false;
    let width = 1;
    let height = 1;
    let onScreen = true;
    const started = performance.now();
    /** The shared clock (seconds since 1970): the wall's, moving with the page's frames (the recorder's too). Breaths and depth cycles run on it. */
    const clockOrigin = Date.now() / 1000;
    const clockNow = () => clockOrigin + (performance.now() - started) / 1000;

    // MARK: Labels

    const labels = new Map<ArkRegion, HTMLSpanElement>();
    for (const region of ARK_REGIONS) {
        // (Islands mode, `no-hamlet.ts`: the wild island's former home area is natural land, under its own name.)
        const text = (noHamlet() ? options.wildIslandRegionLabels?.[region] : undefined) ?? options.regionLabels?.[region];
        if (!text) continue;
        const label = document.createElement("span");
        label.textContent = text;
        Object.assign(label.style, {
            position: "absolute",
            left: "0",
            top: "0",
            transform: "translate(-50%, -50%)",
            whiteSpace: "nowrap",
            font: "500 10px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            letterSpacing: arkTracking(text, "0.16em"),
            textTransform: "uppercase",
            color: "rgba(255, 252, 244, 0.82)",
            textShadow: "0 1px 2px rgba(30, 24, 12, 0.45), 0 0 10px rgba(30, 24, 12, 0.25)",
            opacity: "0",
            transition: "opacity 400ms ease",
            willChange: "transform"
        });
        labelLayer.appendChild(label);
        labels.set(region, label);
    }
    const labelPoint = new Vector3();
    const tokenPoint = new Vector3();
    const labelSizes = new Map<ArkRegion, {w: number; h: number}>();
    /** Nudges tried in turn, in CSS pixels: on the spot, then above, below and beside it, further each time. */
    const NUDGES: Array<[number, number]> = [[0, 0], [0, -26], [0, 26], [0, -44], [0, 44], [-1, 0], [1, 0], [0, -64], [0, 64], [-1, -30], [1, -30], [-1, 30], [1, 30], [0, -88], [0, 88]];
    type Box = [number, number, number, number];
    const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const placeLabels = () => {
        const distance = camera.position.distanceTo(controls.target);
        const show = distance > 95;
        // What the names keep clear of: every animal (or icon) on screen.
        const taken: Box[] = [];
        if (show) {
            for (const entry of allEntries()) {
                if (!entry.middle) continue;
                tokenPoint.copy(entry.middle).project(camera);
                if (tokenPoint.z > 1) continue;
                const sx = (tokenPoint.x + 1) / 2 * width;
                const sy = (1 - tokenPoint.y) / 2 * height;
                const pixels = entry.level === "token" ? tokens.pixelSize(iconSize(entry.length), camera.position.distanceTo(entry.middle)) : 16;
                taken.push([sx - pixels / 2, sy - pixels, sx + pixels / 2, sy + 4]);
            }
        }
        labels.forEach((label, region) => {
            const anchor = regionLabelAnchor(region);
            labelPoint.set(anchor.x, Math.max(heightAt(anchor.x, anchor.z), 0) + (region === "high_cold" ? 14 : 0), anchor.z).project(camera);
            const visible = show && labelPoint.z < 1 && Math.abs(labelPoint.x) < 1.05 && Math.abs(labelPoint.y) < 1.05;
            // Less dominant (graphics pass): fade in only as the camera pulls back past the island's own size.
            label.style.opacity = visible ? Math.min(Math.max((distance - 95) / 70, 0), 1).toFixed(2) : "0";
            if (!visible) return;
            let size = labelSizes.get(region);
            if (!size || !size.w) {
                size = {w: label.offsetWidth, h: label.offsetHeight};
                labelSizes.set(region, size);
            }
            const ax = (labelPoint.x + 1) / 2 * width;
            const ay = (1 - labelPoint.y) / 2 * height;
            let best: Box | null = null;
            let bestCost = Infinity;
            for (const [dx, dy] of NUDGES) {
                const cx = Math.min(Math.max(ax + dx * (size.w / 2 + 30), size.w / 2 + 10), width - size.w / 2 - 10);
                const cy = ay + dy;
                const box: Box = [cx - size.w / 2 - 6, cy - size.h / 2 - 4, cx + size.w / 2 + 6, cy + size.h / 2 + 4];
                const cost = taken.reduce((sum, other) => sum + overlap(box, other), 0);
                if (cost < bestCost) {
                    best = box;
                    bestCost = cost;
                }
                if (cost === 0) break;
            }
            const box = best!;
            taken.push([box[0] - 8, box[1] - 12, box[2] + 8, box[3] + 12]);
            label.style.transform = `translate(${((box[0] + box[2]) / 2).toFixed(1)}px, ${((box[1] + box[3]) / 2).toFixed(1)}px) translate(-50%, -50%)`;
        });
    };

    // MARK: Snapshot

    /** The hour's sun, which says who is asleep (from the species' activity only; none known: awake by day). */
    let sunElevation = lighting.daylight.elevation;
    /**
     * At sea: the map's place says (`map/place.ts`: a sea tag, in the sea's water), else its zone's kind (the map off).
     * The sea's swimmers loop about their spot; a crab of a reef zone the map put on a rocky shore stays on its rocks.
     */
    const atSeaOf = (entry: {place: Placement; animal: ArkAnimal}) => entry.place.sea ?? ZONE_SITES[entry.animal.zone]?.kind === "sea";
    /** A bird of the air over land: it flies while awake. */
    const fliesOver = (animal: ArkAnimal) => (FLYERS.has(animal.model_slug) && ZONE_SITES[animal.zone]?.kind !== "sea") || Boolean(heldOffWater(animal.model_slug));

    // MARK: The behaviour schedule (NPC-style, visual only)

    /** On unless the page turns it off: every animal's behaviour from the time and its id (`behaviour-schedule.ts`). */
    const scheduleOn = options.behaviour !== false;
    let world: ScheduleWorld | null = null;
    /**
     * The places and the walk grid, from the graphics lane's scenery interface: built a few milliseconds a frame
     * (`ScheduleWorldBuild`, the same world to the bit as all at once), not in one half-second stall at load. Until it
     * is done the animals on the schedule wait unseen, and their wiring waits too; a recording builds it at once.
     */
    let worldBuild: ScheduleWorldBuild | null = scheduleOn ? new ScheduleWorldBuild() : null;
    let behaviourBuildMs = 0;
    let behaviourBuildSlices = 0;
    let behaviourBuildLongestMs = 0;
    let pendingWire: {list: Entry[]; arkDay: number | null} | null = null;
    const BUILD_SLICE_MS = 6;
    /**
     * (Performance lane, 2026-11.) The slice while a reader has been sent to an animal that cannot be drawn until this
     * build and the wiring after it are done (the apps' `ark:select` at `ark:ready`, a pick from the list: `arriving`).
     * One slice a drawn frame made the wild island's world 441 frames long on the phone profile: 18.5 s for 6.7 s of
     * work, the camera standing still over the island meanwhile. With the camera still the frames may be longer: the
     * same world, to the bit, in under half the frames (166 to 195). (60 ms measured no better than 40: a slice is a
     * few whole tasks either way; nor did holding the display's rate instead of the idle 30. What is left is the
     * build's own work and the frames' drawn meanwhile: `docs/ark/perf-interaction-2026-11.md`.)
     */
    const ARRIVAL_BUILD_SLICE_MS = 40;
    let wildBuildMs = 0;
    // The graphics lane's attach points first, a slice a frame on their own (`prepareAttachPoints`, about 6 ms each): the
    // places start from them, so this build waits for them rather than building them in one task itself. Asked for on
    // the first frame, after the snapshot has set the hamlet's plots (a reset mid-build would finish it in one go).
    let attachReady = false;
    let attachAsked = false;
    /** The hamlet's plots changed (`setBehaviourHomePlots`): the world is built again, a slice a frame, and rewired. */
    const restartBehaviourWorld = () => {
        if (!scheduleOn) return;
        world = null;
        worldBuild = new ScheduleWorldBuild();
        attachReady = false;
        attachAsked = false;
    };
    const scheduleWorldNow = (): ScheduleWorld => world!;
    // Part C, one world (decision 141): the town's own behaviour world (its places, walk grid and obstacles in the world
    // frame, `islands/town/sampler.ts`), built after the wild island's; its animals' schedules read it, the wild island's
    // theirs. The two are ready together (`world` is set once both are).
    let townBuild: ScheduleWorldBuild | null = scheduleOn && island ? new ScheduleWorldBuild(island.sampler()) : null;
    /** The town's animals waiting for its behaviour world: once it is built, their schedules are made and wired. */
    const townWorldReady = () => {
        const isl = island;
        if (!isl) return;
        for (const e of entries) if (!e.sched && townIds.has(e.animal.id)) e.sched = makeSched(e.animal, e.place, arkBody(e.animal, library.get(e.animal.model_slug)?.behaviour?.plan).display) ?? undefined;
        wireSchedules(entries, current.ark_day ?? null);
    };
    let townWorld: ScheduleWorld | null = null;
    /** The town's animals now (their schedules read the town's world). */
    let townIds = new Set<string>();
    const worldOf = (animal: {id: string}): ScheduleWorld => (townWorld && townIds.has(animal.id) ? townWorld : world!);
    /**
     * Runtime (sliced mount): the map's roost for a place (`scheduleRoost`, pure per place), remembered, so the mount can
     * look them up a slice at a time before the animals are laid out instead of all in that one task.
     */
    const roostMemo = new WeakMap<object, ReturnType<typeof scheduleRoost>>();
    const mapRoostOf = (place: Placement, zone: ArkAnimal["zone"]) => {
        if (roostMemo.has(place)) return roostMemo.get(place)!;
        const roost = scheduleRoost(place, zone);
        roostMemo.set(place, roost);
        return roost;
    };
    /**
     * Runtime (live budget): whether an animal is settled at its roost now (behaviour's `restingAtRoost`), for
     * `arkOutside` to sit those out first; undefined until the world is built or where behaviour lacks it.
     */
    const restingFor = (snapshot: ArkSnapshot, places: Map<string, Placement>): ((id: string) => boolean) | undefined => {
        // (A computed name: the bundlers would warn about an export the release does not have yet.)
        const resting = (behaviourSchedule as unknown as Record<string, unknown>)[RESTING_AT_ROOST] as undefined | ((world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epoch: number, hoursAt: HoursAt, activity?: ArkAnimal["activity"]) => {resting: boolean});
        if (!resting || !world || !scheduleOn) return undefined;
        const byId = new Map(snapshot.animals.map((animal) => [animal.id, animal]));
        // Asked at the rotation step's own instant (the same for every viewer, whenever their page lays out), remembered
        // per animal and step, and worked out ahead in small slices before the step comes (`prewarmResting`).
        const step = Math.floor(worldMs() / 1000 / REST_STEP);
        return (id) => {
            const key = `${id}|${step}`;
            const known = restingMemo.get(key);
            if (known !== undefined) return known;
            const animal = byId.get(id);
            const place = places.get(id);
            if (!animal || !place) return false;
            const sched = entryById.get(id)?.sched ?? makeSched(animal, place, arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan).display);
            const value = sched ? resting(worldOf(sched.animal), sched.profile, sched.animal, step * REST_STEP, scheduleHours, animal.activity).resting : false;
            restingMemo.set(key, value);
            return value;
        };
    };
    const REST_STEP = 300;
    const restingMemo = new Map<string, boolean>();
    let restingWarm: {step: number; queue: string[]} | null = null;
    /** The last rotation's question (setSnapshot's `runtime.outside` arguments), for the warm-up's list. */
    let lastRotation: {snapshot: ArkSnapshot; candidates: Array<{id: string; species_profile_id?: string | null; model_slug: string; mine?: boolean; zone: string}>; live: ReadonlySet<string>; pins: ReadonlySet<string>; lite: boolean} | null = null;
    /** The warm-up's asks owed (fractional, spread over the step's frames). */
    let restingCredit = 0;
    let warmIds: {snapshot: ArkSnapshot; byId: Map<string, ArkAnimal>; scheds: Map<string, Sched | null>; worlds: [unknown, unknown]} | null = null;
    /** In the minute before a rotation step, the next step's resting answers a few milliseconds a frame. */
    const prewarmResting = () => {
        if (!world || !scheduleOn || !(behaviourSchedule as unknown as Record<string, unknown>)[RESTING_AT_ROOST]) return;
        const seconds = worldMs() / 1000;
        const next = Math.floor(seconds / REST_STEP) + 1;
        // (Mobile performance lane: spread evenly over the step from its first seconds, at the frame rate it is drawn at,
        // at most one a frame, so it is done half a minute before the next; then up to 6 ms a frame for anything left, as
        // before. It was 6 ms a frame in the last minute only, and one ask (~1 ms on a desktop, ~4 ms on the phone profile)
        // overran that: 8–19 ms a frame for a minute, and on the phone profile not done by the step. The same answers,
        // remembered per step, asked sooner and fewer a frame: about one every other frame.)
        const ahead = next * REST_STEP - seconds;
        if (ahead > REST_STEP - 10) return;
        if (!restingWarm || restingWarm.step !== next) {
            for (const key of Array.from(restingMemo.keys())) if (!key.endsWith(`|${next - 1}`)) restingMemo.delete(key);
            // (Mobile performance lane: only what the next step's rotation will ask, a few hundred, not every animal aboard.)
            const rotation = lastRotation && lastRotation.snapshot === current ? lastRotation : null;
            restingWarm = {step: next, queue: rotation ? runtime.restingAsks(rotation.candidates, rotation.live, rotation.pins, rotation.lite, next * REST_STEP, (id) => restingMemo.get(`${id}|${next}`)) : current.animals.map((animal) => animal.id)};
        }
        const ask = restingForStep(current, placedAll, next);
        if (!ask) return;
        if (ahead > 30) {
            // Its share this frame: what is left over the frames left until half a minute before the step (at the rate
            // frames are drawn now, with a fifth to spare).
            // Never more than one a frame: one ask is ~4 ms on the phone profile, and a world built late in the step has
            // little time left (the rest is asked in the step's last half minute, or at the step, as before).
            const fps = frameIntervals.length ? Math.min(Math.max(1000 / mean(frameIntervals), 10), 60) : 20;
            // (Graphics and performance pass, 2026-11: none while the camera is flying or a finger is down. One ask is a
            // trip worked out for a moment minutes ahead: most are a few ms, some 60 to 400 ms on the phone profile, a
            // held frame in the middle of a flight or a drag. What is owed meanwhile is kept, and asked one a frame
            // once the view is at rest.)
            restingCredit = Math.min(restingCredit + restingWarm.queue.length / Math.max((ahead - 30) * fps * 0.8, 1), 40);
            if (flight || pointers > 0) return;
            if (restingCredit >= 1 && restingWarm.queue.length) {
                ask(restingWarm.queue.pop()!);
                restingCredit -= 1;
            }
            return;
        }
        restingCredit = 0;
        const started = performance.now();
        while (restingWarm.queue.length && performance.now() - started < 6) ask(restingWarm.queue.pop()!);
    };
    /** `restingFor` at a given step (the warm-up's). */
    const restingForStep = (snapshot: ArkSnapshot, places: Map<string, Placement>, step: number) => {
        const resting = (behaviourSchedule as unknown as Record<string, unknown>)[RESTING_AT_ROOST] as undefined | ((world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epoch: number, hoursAt: HoursAt, activity?: ArkAnimal["activity"]) => {resting: boolean});
        if (!resting || !world) return null;
        if (!warmIds || warmIds.snapshot !== snapshot) warmIds = {snapshot, byId: new Map(snapshot.animals.map((animal) => [animal.id, animal])), scheds: new Map(), worlds: [world, townWorld]};
        // (An animal not drawn one by one has no schedule of its own: the one made for it is kept for the next steps, for
        // this snapshot, its places and the behaviour worlds it was made in, instead of made again every five minutes.)
        if (warmIds.worlds[0] !== world || warmIds.worlds[1] !== townWorld) warmIds = {...warmIds, scheds: new Map(), worlds: [world, townWorld]};
        const byId = warmIds.byId;
        const scheds = warmIds.scheds;
        return (id: string) => {
            const key = `${id}|${step}`;
            if (restingMemo.has(key)) return;
            const animal = byId.get(id);
            const place = places.get(id);
            if (!animal || !place) return;
            // (As before: an entry's own schedule when it has one, else one made for it.)
            let sched: Sched | null | undefined = entryById.get(id)?.sched ?? undefined;
            if (sched === undefined) {
                sched = places === placedAll ? scheds.get(id) : undefined;
                if (sched === undefined) {
                    sched = makeSched(animal, place, arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan).display);
                    if (places === placedAll) scheds.set(id, sched);
                }
            }
            restingMemo.set(key, sched ? resting(worldOf(sched.animal), sched.profile, sched.animal, step * REST_STEP, scheduleHours, animal.activity).resting : false);
        };
    };
    const stepWorldBuild = (budgetMs: number, wildFirst = false) => {
        // Part C: the town's world after the wild island's, a slice a frame too; its animals join the schedule when it is in.
        if (world && townBuild) {
            // (Performance lane: a reader waiting on a wild animal. The town's world coming in asks for the wiring
            // again, and the latest asked for wins: the wild animals' spacing, a second of work on the phone profile
            // and nearly done, was thrown away and made again with the town's. It is let finish first; the town's
            // world and the wiring of both follow as before.)
            if (wildFirst && spacing) return;
            const town = options.recording ? townBuild.run() : townBuild.step(budgetMs);
            // (The two builds' time; it was the town's running total added again every frame.)
            behaviourBuildMs = wildBuildMs + townBuild.spentMs;
            if (town) {
                townWorld = town;
                townBuild = null;
                // gfx (fauna): the town's cat walls (its own chunk), from its plan and colliders.
                const walls = island?.origin, wallSet = town.sampler.colliders;
                if (walls && wallSet) void import("@/ark-scene/islands/town/cat-walls").then((m) => (catWalls = m.townCatWalls(walls, wallSet))).catch(() => undefined);
                townWorldReady();
            }
            return;
        }
        if (world || !worldBuild) return;
        // A recording (the marketing recorder, the golden shots) builds it at once on its first frame.
        if (!options.recording && !attachReady) {
            if (!attachAsked) {
                attachAsked = true;
                void prepareAttachPoints().then(() => (attachReady = true));
            }
            return;
        }
        const built = options.recording ? worldBuild.run() : worldBuild.step(budgetMs);
        behaviourBuildMs = wildBuildMs = worldBuild.spentMs;
        behaviourBuildSlices = worldBuild.slices;
        behaviourBuildLongestMs = worldBuild.longestMs;
        if (!built) return;
        world = built;
        worldBuild = null;
        // Runtime: who is resting at home is known now; the live budget sits them out first. (Only where behaviour has
        // restingAtRoost: otherwise laying the snapshot out again re-wires every schedule for nothing, a long task.)
        // (Not at once: laying everyone out again here re-wired schedules for many arrivals in one task, ~1 s on a phone at
        // the backfill. Resting counts from the next rotation step, which comes for everyone at the same moment.)
        // The schedules that waited start now, each where it is at this moment (wired, then posed, as at load).
        if (pendingWire) {
            const {list, arkDay} = pendingWire;
            pendingWire = null;
            wireSchedules(list, arkDay);
        }
    };
    /** Encounter hunting: due predators' forays (off until the hunting read says the Ark hunts by encounter). */
    const hunting = new HuntingLayer();
    /** The schedule's main-thread time in recent frames (ms), and how many animals it moved. */
    const behaviourTimes: number[] = [];
    let behaviourFrameMs = 0;
    /** Each schedule's first step after it is wired works out its last slots (where it walks from): a few a frame. */
    const WARM_MS = 6;
    let warmFrameMs = 0;
    /** How long an animal due a new trip may be held at its last pose for a frame with room (s): close by, and further off. */
    const TRIP_HOLD_NEAR_SECONDS = 0.5;
    const TRIP_HOLD_SECONDS = 1.5;
    /** Animal-frames held so (the scene's stats). */
    let tripsHeld = 0;
    let scheduledCount = 0;
    const scheduleHours: HoursAt = (epoch) => pinnedHours ?? islandHours(epoch * 1000, ISLAND_OFFSET_HOURS);
    /** Awake now off the schedule: the sun's rule, or one active at any hour's own bouts on the island clock (`sleep-hours.ts`). */
    const awakeNowOf = (activity: ArkAnimal["activity"] | null, sleep: Sleep | null | undefined): boolean =>
        activity === "any" && sleep ? arkAwakeAtHour(activity, scheduleHours(worldMs() / 1000), sleep) : isAwake(activity, sunElevation);
    const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
    const makeSched = (animal: ArkAnimal, place: Placement, length: number, statusOnly = false): Sched | null => {
        // Everyone but a true micro animal and an underground one (`map/place.ts` onSchedule); a perched bird or bat from its perch.
        // (Nor one the depth classifier holds off the water: the schedule would land a frigatebird on the sea to rest.)
        // (`statusOnly`: its day as its card's bars read it, never drawn: `statusSchedOf`.)
        if (!scheduleOn || (!statusOnly && (!onSchedule(place, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)))) return null;
        // (Part C: a town animal kept still at a window, behind the glass or in a tank stays at its spot.)
        const inTown = Boolean(island?.has(animal));
        // (Until the town's behaviour world is in, its animals stand at their places: `townWorldReady` wires them then.)
        if (inTown && ((!statusOnly && !island!.scheduled(animal.id)) || !townWorld)) return null;
        const sea = !inTown && ZONE_SITES[animal.zone]?.kind === "sea";
        return {
            // (Its roost the first time its schedule asks: the den search out of the mount, `withLazyRoost`; the runtime's
            // sliced mount may have found it already, `mapRoostOf`'s memo.)
            // (Part C: a town animal's range is its garden, paddock or enclosure; it finds its roost among the town's places.)
            animal: withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea, thrive: arkThriveOf(animal), sleep: arkSleepOf(animal), condition: animal.condition ?? null, ...(inTown ? {range: island!.rangeOf(animal.id), kept: true} : {})}, () => (inTown ? null : mapRoostOf(place, animal.zone))),
            profile: behaviourProfile(animal.model_slug, library.get(animal.model_slug)?.behaviour?.plan),
            trip: null,
            lead: null,
            pose: null,
            at: -1,
            ground: 0,
            pitch: 0
        };
    };
    // MARK: The local reactive layer (visual only; `reactive.ts`)

    /** Per tier: how many animals near the camera react, and how far they look (low and lite views fewer; reduced motion none). */
    const reactiveTier = (): ReactiveTier => (reducedMotion || options.reactive === false ? "lite" : liteOn() ? "low" : tier === "high" ? "high" : tier === "medium" ? "medium" : "low");
    const reactive = new ReactiveLayer({tier: reactiveTier()});
    let reactiveQueries: ReactiveWorldQueries | null = null;
    let reactiveMs = 0;
    let reactiveInputs = 0;
    /** Moved by its schedule now (not in an act or a moment, not with reduced motion). */
    const scheduled = (entry: Pick<Entry, "sched" | "visitor" | "act" | "moment">): boolean => Boolean(entry.sched) && !reducedMotion && !entry.visitor && !entry.act && !entry.moment;
    const tripFor = (holder: Sched, key: "trip" | "lead", profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkAnimal["activity"], epoch: number): Trip => {
        let trip = holder[key];
        if (!trip || epoch < trip.start || epoch >= trip.end) {
            // Part C: a zoo animal's feeding time takes it to its enclosure's station (its home for those slots), on the
            // island clock; a feeding's first and last slot start where the slot before ended, for every viewer alike.
            // (Fed only awake at its slot's start, at its own rhythm's times: lane ark-its-day.)
            const rhythm = {activity: activity ?? profile.activity, awake: (t: number) => scheduleAwakeAt(profile, activity, scheduleHours(t), arkSleepOf(animal))};
            const who = island ? island.feedingAnimal(animal, epoch, rhythm) : animal;
            let previous = trip;
            if (island) {
                const before = island.feedingAnimal(animal, epoch - SLOT_SECONDS, rhythm);
                const held = previous && epoch - SLOT_SECONDS >= previous.start && epoch - SLOT_SECONDS < previous.end;
                if (before !== who && !held) previous = tripAt(worldOf(animal), profile, before, epoch - SLOT_SECONDS, scheduleHours, activity, null);
            }
            holder[key] = trip = tripAt(worldOf(animal), profile, who, epoch, scheduleHours, activity, previous);
        }
        return trip;
    };
    /**
     * Where its schedule puts it now. A follower in a herd, flock, school or troop keeps to its leader: the leader's
     * pose a moment earlier, out to one side by its rank, so the group moves (and sleeps) together and turns together.
     */
    const schedulePose = (entry: Entry, epoch: number): TripPose & {doing: ArkDoing} => {
        const own = entry.sched!;
        const fromSchedule = () => {
            const trip = tripFor(own, "trip", own.profile, own.animal, entry.animal.activity, epoch);
            return {...poseOnTrip(worldOf(own.animal), trip, epoch), doing: trip.doing};
        };
        // Encounter hunting (`hunting.ts`): a due, awake predator walks its forays, from the server's own positions.
        if (hunting.active) {
            const hunt = hunting.pose(entry.animal, epoch, entry.length, heightAt, fromSchedule);
            if (hunt) return hunt;
        }
        return fromSchedule();
    };
    /**
     * After a snapshot: each group member keeps to its leader in the schedule (`ScheduleGroup`), the young are known,
     * and predators' home ranges are kept a safe distance from their prey's (`spaceHomes`, the catalogue's food links).
     */
    const wireSchedules = (list: Entry[], arkDay: number | null) => {
        if (!scheduleOn) return;
        if (!world) {
            pendingWire = {list, arkDay};
            return;
        }
        const onIt = list.filter((e) => e.sched && !e.visitor);
        const sizes = new Map<Entry, number>();
        for (const e of onIt) if (e.leader?.sched) sizes.set(e.leader, (sizes.get(e.leader) ?? 1) + 1);
        // (Worked out now, set when the spacing is done: until then the schedules run as they were wired before.)
        const groups = new Map<Entry, ScheduleGroup | null>();
        for (const e of onIt) {
            const own = e.sched!;
            const leader = e.leader && e.leader.sched && e.leader.animal.model_slug === e.animal.model_slug && (GROUPED.has(own.profile.social) || groupLives(e.animal.model_slug)) ? e.leader : null;
            groups.set(e, leader ? {leader: leader.sched!.animal, profile: leader.sched!.profile, activity: leader.animal.activity, rank: Math.max(e.place.rank ?? 1, 1), size: sizes.get(leader) ?? 2} : null);
        }
        // (Who really leads a group: only members that are grouped count, a species that does not flock leads nobody.)
        const ledOf = new Map<ScheduleAnimal, number>();
        groups.forEach((g) => g && ledOf.set(g.leader, (ledOf.get(g.leader) ?? 1) + 1));
        const navOf = (e: Entry) => worldOf(e.sched!.animal).nav;
        // A leader's reach includes its group's spread round it (its members roam round where it is).
        const radius = new Map(onIt.map((e) => [e.animal.id, rangeReach(e.sched!.profile, e.sched!.animal) + (sizes.has(e) ? groupSpread(e.length, sizes.get(e)!) : 0)]));
        // (The map lane's line, 2026-11-11: a flyer's home may be any dry ground; every home keeps 5 m inside its habitat.)
        const job = spaceHomesTasks(
            // (Part C: the town's kept animals keep their homes: house, farm and zoo animals take no part in the wild ecology.)
            onIt.filter((e) => !groups.get(e) && !(island && townIds.has(e.animal.id) && island.kept(e.animal.id))).map((e) => {
                const nav = navOf(e);
                const inTown = townIds.has(e.animal.id);
                const habitat = (x: number, z: number) => inTown || mapHabitatAt(e.animal, x, z, 5);
                return {id: e.animal.id, slug: e.animal.model_slug, home: {x: e.sched!.animal.home.x, z: e.sched!.animal.home.z}, length: e.length, walkable: (x: number, z: number) => (e.sched!.profile.move === "swim" || e.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : e.sched!.profile.move === "fly" ? heightAt(x, z) > 0.05 && habitat(x, z) : nav.walkable(x, z) && habitat(x, z))};
            }),
            eats,
            (id) => radius.get(id) ?? 3
        );
        const apply = (spaced: Map<string, SpacedHome>) => {
            for (const e of onIt) {
                const own = e.sched!;
                own.animal.group = groups.get(e) ?? null;
                // (How many a leader leads, itself included: its group's acts, `behaviour-group.ts`.)
                own.animal.led = ledOf.get(own.animal) ?? 0;
                const age = arkDay !== null && typeof e.animal.born_ark_day === "number" ? arkDay - e.animal.born_ark_day : null;
                own.animal.young = e.animal.origin === "born" && age !== null && age < 90;
                own.wired = true;
            }
            // How far each moved one's place has to shift (its group moves with it, by the same shift).
            const shifts = new Map<string, {dx: number; dz: number}>();
            for (const e of onIt) {
                const own = e.sched!;
                const moved = spaced.get(e.animal.id);
                if (moved) {
                    // (From its place as the snapshot set it: a later snapshot resets the place, not the home.)
                    shifts.set(e.animal.id, {dx: moved.home.x - e.place.x, dz: moved.home.z - e.place.z});
                    own.animal.home = {x: moved.home.x, y: Math.max(heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
                    // A leader's reach is shared with its group's spread: half each.
                    own.animal.range = moved.range === null ? null : sizes.has(e) ? moved.range / 2 : moved.range;
                    own.animal.prey = moved.prey;
                }
                own.trip = null;
                own.lead = null;
                // (Its last pose is kept to draw until its first step: the first steps are spread over frames.)
                own.warm = false;
            }
            // A group's members share their leader's place and range (they roost and roam round it).
            for (const e of onIt) {
                const lead = e.sched!.animal.group?.leader;
                if (!lead || !spaced.has(e.leader!.animal.id)) continue;
                e.sched!.animal.home = {...lead.home};
                e.sched!.animal.range = lead.range;
                const shift = shifts.get(e.leader!.animal.id);
                if (shift) shifts.set(e.animal.id, shift);
            }
            // The drawn place moves too (a copy: the placement map is shared), so whatever is posed from the place (a still
            // view with reduced motion, the moment before its schedule runs) keeps predators the same distance from prey.
            for (const e of onIt) {
                const shift = shifts.get(e.animal.id);
                if (!shift || (!shift.dx && !shift.dz) || e.place.canopy || e.place.micro || e.place.burrow) continue;
                const x = e.place.x + shift.dx;
                const z = e.place.z + shift.dz;
                e.place = {...e.place, x, z, ground: heightAt(x, z)};
            }
            // Prey know the predators aboard that could eat them (they watch one they can see).
            wireThreats(onIt.map((e) => ({slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})), eats);
            // Homes, groups and ranges changed: nothing remembered from before holds.
            forgetSchedules();
            // Who meets whom in the behaviour recipes: rival males, a male and a female, two of a group (`behaviour-recipes.ts`).
            wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
            // (A recording, and reduced motion, at once; else each one's first step as the frames come, `WARM_MS`.)
            const epoch = worldMs() / 1000;
            if (options.recording) for (const e of onIt) if (!reducedMotion) stepSchedule(e, epoch, 1);
        };
        // The spacing a slice a frame (`stepSpacing`, as the world's build: at the backfill scale it is the longest task
        // after the mount); the latest wiring asked for wins. A recording wires at once.
        spacing = {build: new SlicedBuild(job.tasks, job.finish), apply};
        if (options.recording) stepSpacing(Infinity);
    };
    /** The spacing being worked out, and what to do with it once it is. */
    let spacing: {build: SlicedBuild<Map<string, SpacedHome>>; apply: (spaced: Map<string, SpacedHome>) => void} | null = null;
    let spacingMs = 0;
    /** The longest single spacing step (ms, its slice and its wiring when done): runtime's phone budget is 200 ms. */
    let spacingLongestMs = 0;
    const stepSpacing = (budgetMs: number) => {
        if (!spacing) return;
        const now = spacing;
        const began = performance.now();
        const spaced = now.build.step(budgetMs);
        spacingMs = now.build.spentMs;
        if (spaced) {
            spacing = null;
            now.apply(spaced);
        }
        spacingLongestMs = Math.max(spacingLongestMs, performance.now() - began);
    };
    /**
     * Development only (the scenario recordings, `scripts/ark-intelligence-scenarios.mjs`): a scripted shared pose for an
     * animal, as if its schedule said so (a predator walking past a herd at a set time). Never set in production.
     */
    const sharedPins = new Map<string, (epoch: number) => Partial<TripPose & {doing: ArkDoing}>>();
    /** Development only (the head-look probe): a fixed `arkLook` (yaw, pitch, weight) for an animal, over the reactive layer's. */
    const forcedLooks = new Map<string, [number, number, number]>();

    // MARK: Collisions (motion pass L5: `collide/`)

    /** Every island's colliders as one set: the wild island's world's, with the town's world's when it has one. */
    const sceneColliders = (wild: ScheduleWorld, town: ScheduleWorld | null): ColliderSet | null => {
        const own = wild.sampler.colliders ?? null;
        const other = town?.sampler.colliders ?? null;
        return own && other ? unionColliders(own, other) : own ?? other;
    };
    /** Its shared pose before the collisions: its schedule's, then liveliness's (young at heel, shelter, the tide), a pin. */
    // gfx (fauna): a town cat up on a garden wall now and then (`islands/town/cat-walls.ts`): shared, from its schedule's
    // resting spot and back to it; loaded with the town's world.
    let catWalls: CatWallsT | null = null;
    const sharedBase = (entry: Entry, epoch: number, pin = sharedPins.size ? sharedPins.get(entry.animal.id) : undefined) => {
        const fromTrip = liveliness.sharedPose(entry, schedulePose(entry, epoch), epoch);
        const walled = catWalls && entry.sched && townIds.has(entry.animal.id) ? catWalls.pose(entry.animal.model_slug, entry.animal.id, epoch, Math.max(entry.length, 0.2) * 1.3, (t) => schedulePose(entry, t)) : null; // gfx (fauna)
        const base = walled ? {...fromTrip, ...walled} : fromTrip;
        return pin ? {...base, ...pin(epoch)} : base;
    };
    /** Development only: `window.__arkCollideOff = true` before mounting draws the schedule's poses as they come. */
    const collisionsOn = (globalThis as {__arkCollideOff?: boolean}).__arkCollideOff !== true;
    const HUDDLED = new Set(["huddle", "pile", "cluster", "row"]);
    const collideInput = (entry: Entry, pose: TripPose & {doing: ArkDoing; act?: RecipeAct | null}, epoch: number): ResolvePose => ({
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: pose.yaw,
        aloft: pose.aloft,
        asleep: pose.doing === "sleep",
        // (At its spot: it holds its place against one walking past, decision 204.)
        still: !pose.aloft && !pose.moving,
        // 3.3 batch (C): a young one at its mother's flank to suckle touches her (`liveliness-scene.ts`, `young-care.ts`).
        partner: (pose.act as (RecipeAct & {with?: string | null}) | null | undefined)?.with ?? (pose as {nurse?: string}).nurse ?? null,
        attached: entry.sched?.trip ? attachedOn(entry.sched.trip, epoch) : null,
        // (Perched up on a surface: held there, never eased off its branch into the air.)
        fixed: (pose as {onWall?: boolean}).onWall === true /* gfx (fauna): a cat on a wall */ || !pose.aloft && pose.y > Math.max(heightAt(pose.x, pose.z), 0) + 0.3 && Boolean(entry.sched?.trip && (tripPhase(entry.sched.trip, epoch) === "stay" || tripPhase(entry.sched.trip, epoch) === "pause") && attachedOn(entry.sched.trip, epoch))
    });
    /** A hamlet resident out of doors (on its spot, or walking its door route), before the collisions; null indoors. */
    const residentBase = (entry: Entry): (ResolvePose & {yaw: number}) | null => {
        const plot = entry.place.hamlet?.plot;
        if (!plot || entry.visitor) return null;
        const state = hamletAt();
        const beat = state.beats.get(entry.animal.id);
        const out = state.out.get(entry.animal.id);
        if (!beat && !out) return null;
        // (A door beat walks its route round the house, the fences and the props: `collide/routes.ts`.)
        const walk = beat ? doorWalkAt(collisionsOn && world ? world.nav : null, beat.from, beat.to, bodyShape(entry.animal.model_slug, entry.full).radius, beat.t) : null;
        const at = walk ?? out!.at;
        const yaw = walk ? walk.yaw : plot.rotation + (((hamletHash(entry.animal.id) >>> 5) % 628) / 100);
        return {x: at.x, y: Math.max(heightAt(at.x, at.z), 0), z: at.z, yaw, aloft: false};
    };
    const collisions = new CollideLayer<Entry>({
        // (Part C, one world: the wild island's colliders and the town's as one set, each island's animals among their own.)
        colliders: () => (collisionsOn && world ? sceneColliders(world, townWorld) : null),
        body: (entry) => {
            const shape = bodyShape(entry.animal.model_slug, entry.full);
            // (A walker is never pushed onto ground twice as steep as its walk takes, `collide/resolve.ts`.)
            const walker = entry.sched && entry.sched.profile.move !== "fly" && entry.sched.profile.move !== "swim";
            return {id: entry.animal.id, radius: shape.radius, half: shape.half, height: shape.height, group: entry.place.leader ?? entry.animal.id, huddles: HUDDLED.has(sleepStyle(entry.animal.model_slug).social), ...(walker ? {maxSlope: maxSlopeOf(entry.sched!.animal) * 2} : {})};
        },
        slope: (x, z) => Math.max(Math.abs(heightAt(x + 1, z) - heightAt(x - 1, z)), Math.abs(heightAt(x, z + 1) - heightAt(x, z - 1))) / 2,
        base: (entry, epoch) => (scheduled(entry) && entry.sched?.wired ? collideInput(entry, sharedBase(entry, epoch), epoch) : entry.place.hamlet ? residentBase(entry) : null),
        everyone: () => entries.filter((entry) => (scheduled(entry) && entry.sched!.wired && entry.sched!.pose) || (entry.place.hamlet && !entry.visitor && entry.residentAt)),
        last: (entry) => (entry.sched?.pose ? {x: entry.sched.pose.x, z: entry.sched.pose.z, at: entry.sched.at} : entry.residentAt ?? null),
        // (A resident walks its door route over a door beat: never faster than 3 m/s.)
        speed: (entry) => (entry.sched ? bodyLengthsPerSecond(entry.sched.profile) * Math.max(entry.full, 0.05) * Math.max(runFactor(entry.sched.profile), 1) * 1.5 : 3)
    });
    // Lane GB: the town's moving cars stop short of its animals. The town's animals near a point at a moment: their shared
    // poses (the schedule's, the same for every viewer, whatever each draws) and L5's bodies; null until they are wired.
    let trafficCells: {of: Entry[]; count: number; cells: Map<number, Entry[]>} | null = null;
    const trafficCell = (x: number, z: number) => (Math.floor(x / 16) + 4096) * 8192 + (Math.floor(z / 16) + 4096);
    const trafficPoses = {at: Number.NaN, poses: new Map<Entry, {x: number; z: number; r: number; h: number}>()};
    const trafficAnimals = (x: number, z: number, radius: number, epoch: number): Array<{x: number; z: number; r: number; h: number}> | null => {
        const isl = island;
        if (!isl || !townWorld) return null;
        if (!trafficCells || trafficCells.of !== entries || trafficCells.count !== entries.length) {
            const cells = new Map<number, Entry[]>();
            for (const entry of entries) {
                if (!townIds.has(entry.animal.id) || entry.visitor) continue;
                const k = trafficCell(entry.place.x, entry.place.z);
                const list = cells.get(k);
                if (list) list.push(entry);
                else cells.set(k, [entry]);
            }
            trafficCells = {of: entries, count: entries.length, cells};
        }
        // (Several cars ask at the same moment: each animal's pose and body worked out once a moment.)
        if (trafficPoses.at !== epoch) {
            trafficPoses.at = epoch;
            trafficPoses.poses.clear();
        }
        const out: Array<{x: number; z: number; r: number; h: number}> = [];
        const reach = radius + 18;
        for (let i = Math.floor((x - reach) / 16); i <= Math.floor((x + reach) / 16); i++) {
            for (let j = Math.floor((z - reach) / 16); j <= Math.floor((z + reach) / 16); j++) {
                for (const entry of trafficCells.cells.get((i + 4096) * 8192 + (j + 4096)) ?? []) {
                    const range = isl.rangeOf(entry.animal.id) ?? 12;
                    if (Math.hypot(entry.place.x - x, entry.place.z - z) > radius + range + 3) continue;
                    let known = trafficPoses.poses.get(entry);
                    if (!known) {
                        const pose = entry.sched?.wired ? sharedBase(entry, epoch) : entry.place;
                        const body = bodyShape(entry.animal.model_slug, entry.full);
                        known = {x: pose.x, z: pose.z, r: body.radius, h: body.height};
                        trafficPoses.poses.set(entry, known);
                    }
                    if (Math.hypot(known.x - x, known.z - z) < radius + known.r) out.push(known);
                }
            }
        }
        return out;
    };
    let trafficHooked: ArkIslandScene | null = null;
    /** Its pose with the collisions (the same pose when nothing moved it; on the ground, at the ground's height where it moved to). */
    const withCollisions = <P extends TripPose & {doing: ArkDoing}>(entry: Entry, base: P, epoch: number): P => {
        if (!collisionsOn || !world) return base;
        const at = collisions.apply(entry, epoch, collideInput(entry, base, epoch));
        if (at.x === base.x && at.z === base.z) return base;
        const onGround = !base.aloft && base.y >= -0.01;
        const y = onGround ? Math.max(heightAt(at.x, at.z), 0) + Math.max(base.y - Math.max(heightAt(base.x, base.z), 0), 0) : base.y;
        return {...base, x: at.x, z: at.z, y};
    };
    /** Its schedule's pose, worked out again now (every frame close by; less often further off: the same function, so nothing jumps). */
    const stepSchedule = (entry: Entry, epoch: number, dt: number) => {
        if (!world) return;
        const own = entry.sched!;
        const watched = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
        const pin = sharedPins.size ? sharedPins.get(entry.animal.id) : undefined;
        // Every frame close by (its near model, the one looked at, or a pinned one); twice a second as a far model; once a second as an icon.
        const every = entry.level === "near" || watched || pin ? 0 : entry.level === "far" ? 0.5 : 1;
        const modelled = entry.level === "near" || entry.level === "far" || watched;
        // (Drawn as a model again after a while as a dot or out of sight: its pose with the collisions now, not up to half a
        // second later, so what it is drawn at is the shared pose from its first frame.)
        if (process.env.NODE_ENV !== "production") entry.posePath = "kept";
        if (!own.pose || epoch - own.at >= every || epoch < own.at || (modelled && !own.collided)) {
            if (process.env.NODE_ENV !== "production") entry.posePath = "full";
            // On top of the schedule: young at heel, shelter from rain, off the tide (`liveliness-scene.ts`; shared); then
            // the collisions: out of anything solid, eased off its neighbours (`collide/`; shared).
            // (Drawn as a model, near or far: a dot far off is the same dot either way, so it skips them; the models round it
            // still ease off its own pose, worked out exactly: `collide/layer.ts`.)
            const base = sharedBase(entry, epoch, pin);
            const collideAt = perf.on ? performance.now() : 0;
            const at = (own.pose = modelled ? withCollisions(entry, base, epoch) : base);
            own.collided = modelled;
            own.eased = {dx: at.x - base.x, dz: at.z - base.z};
            if (perf.on) collideCallMs += performance.now() - collideAt;
            own.at = epoch;
            own.ground = heightAt(at.x, at.z);
            const onLand = !at.aloft && own.ground > 0.02 && Math.abs(at.y - own.ground) < 0.05;
            // Close by, walkers lean to the slope; far away nobody can see it. (Grounding leans every level to the drawn
            // slope where it draws it: `groundedStand`.)
            own.pitch = onLand && entry.level !== "far" && groundingRules() === "legacy" ? slopePitch(at.x, at.z, at.yaw, entry.length) : 0;
        } else if (modelled && own.pose && own.eased && epoch >= own.at) {
            // (Whether or not it was moving at the last step: one that set off since was held where it stood until the
            // next, and drawn near again it was on its way, 1.3 m on in a frame: the owner's giraffes "jumping" as the
            // camera came in. ARK-CONTACT zoom-run, 2026-11-21.)
            // ARK-CONTACT (decision 447, positions "glitch as I zoom in and out"): a far model on the move between its
            // steps follows its schedule every frame (the trip's own path, cheap), with the collisions' last offset
            // held; it was held still for half a second and then jumped on (a walking giraffe 60 cm at a time), only
            // from as far off as it is drawn far, so zooming out set it stuttering. The collisions still run twice a second.
            if (process.env.NODE_ENV !== "production") entry.posePath = "follow";
            const base = sharedBase(entry, epoch, pin);
            const x = base.x + own.eased.dx;
            const z = base.z + own.eased.dz;
            const onGround = !base.aloft && base.y >= -0.01;
            const y = onGround ? Math.max(heightAt(x, z), 0) + Math.max(base.y - Math.max(heightAt(base.x, base.z), 0), 0) : base.y;
            own.pose = {...base, x, y, z};
            own.ground = heightAt(x, z);
        }
        const target = own.pose.aloft ? 1 : 0;
        entry.air += (target - entry.air) * Math.min(dt * 6, 1);
        if (Math.abs(target - entry.air) < 0.002) entry.air = target;
    };

    /** An animal's route over a stretch of its shared schedule (for worn paths): its own trips, worked out aside. */
    const routeOf = (e: LiveAnimal, from: number, to: number, step: number): Array<{x: number; z: number}> => {
        const own = (e as Entry).sched;
        // (Not before the schedule's world is built: it is built a slice a frame, and tripAt keys its memo by it.)
        if (!own || !world) return [];
        const holder = {trip: null, lead: null} as unknown as Sched;
        const points: Array<{x: number; z: number}> = [];
        for (let t = from; t <= to; t += step) {
            const trip = tripFor(holder, "trip", own.profile, own.animal, (e as Entry).animal.activity, t);
            const at = poseOnTrip(worldOf(own.animal), trip, t);
            if (!at.aloft) points.push({x: at.x, z: at.z});
        }
        return points;
    };

    /**
     * Its one behaviour state now: its schedule (or the hour and its species), its breath cycle in the water, and
     * whether it is acting out a server event. Never the selection.
     */
    /** A scheduled diver's breath from its trip (`breath-trip.ts`); null asleep (its slower breath cycle, where it sleeps). */
    const scheduledBreath = (own: Sched): number | null => (own.pose?.doing === "sleep" ? null : own.trip ? tripBreath(own.trip, worldMs() / 1000) : 0);
    const stateOf = (entry: Pick<Entry, "animal" | "visitor" | "act"> & Partial<Pick<Entry, "sched" | "moment" | "depth" | "seed">>): ArkBehaviourState => {
        // An air-breather in the water comes up for air on its breath cycle (a floater is at the surface already).
        // (Its band and seed are the entry's own, worked out once, when it has them: this runs every frame.)
        const depth = entry.depth !== undefined ? entry.depth : speciesDepth(entry.animal.model_slug, entry.animal.zone);
        const onSchedule = entry.sched?.pose && scheduled({sched: entry.sched, visitor: entry.visitor, act: entry.act, moment: entry.moment});
        // (Awake on the schedule: the breath its breathe trip carries, on its way: `breath-trip.ts`.)
        const breather = depth?.breathes && waterMotion(depth) !== "float" ? {seed: entry.seed ?? depthSeed(entry.animal.id), clock: clockNow(), breath: onSchedule ? scheduledBreath(entry.sched!) : null} : null;
        // One the classifier holds off the water (a frigatebird) stays aloft, asleep or not: it never comes down onto the sea.
        const aloftAlways = Boolean(heldOffWater(entry.animal.model_slug));
        return behaviourState({
            activity: entry.animal.activity,
            elevation: sunElevation,
            // (One active at any hour sleeps its own bouts: every animal sleeps, `sleep-hours.ts`.)
            asleepOwn: entry.animal.activity === "any" ? !awakeNowOf("any", arkSleepOf(entry.animal)) : undefined,
            flyer: fliesOver(entry.animal),
            acting: Boolean(entry.act),
            visitor: entry.visitor,
            reducedMotion,
            breather,
            aloftAlways: onSchedule ? false : aloftAlways,
            scheduled: onSchedule ? {doing: entry.sched!.pose!.doing, aloft: entry.sched!.pose!.aloft} : null
        });
    };

    const newEntry = (animal: ArkAnimal, place: Placement, arrivedAt: number | null): Entry => {
        const phase = phaseOf(animal.id);
        const body = arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan);
        // It starts as it is now: a sleeping hawk on its roost, an awake one in the air (no drop from the sky on load).
        const sched = makeSched(animal, place, body.display);
        if (sched && !reducedMotion && world) {
            const trip = (sched.trip = tripAt(worldOf(sched.animal), sched.profile, sched.animal, worldMs() / 1000, scheduleHours, animal.activity));
            sched.pose = {...poseOnTrip(worldOf(sched.animal), trip, worldMs() / 1000), doing: trip.doing};
            sched.at = worldMs() / 1000;
            sched.ground = heightAt(sched.pose.x, sched.pose.z);
        }
        const state = stateOf({animal, visitor: false, act: null, sched});
        const targets = sched?.pose ? {...animationTargets(state), air: sched.pose.aloft ? 1 : 0} : animationTargets(state);
        return ownSize({
            sched,
            animal,
            place,
            length: body.display * sexScale(animal),
            full: body.display * sexScale(animal),
            trueLength: body.metres,
            micro: place.micro ? microSpecies(animal.model_slug) : null,
            layer: speciesLayer(animal.model_slug),
            depth: place.micro ? null : speciesDepth(animal.model_slug, animal.zone),
            seed: depthSeed(animal.id),
            stats: arkStats(animal),
            thrive: arkThriveOf(animal),
            floor: body.floor,
            pace: loopPace(animal),
            arrivedAt,
            level: "far",
            phase,
            middle: null,
            drawnHeight: 1,
            air: targets.air,
            lift: 0,
            state,
            awake: !state.asleep,
            rest: targets.rest,
            loop: phase * Math.PI * 2,
            // Asleep as it comes into the world (the page opening at night): already lying, never all lying down at once.
            sleepNow: state.asleep ? stepSleepNow(null, {id: animal.id, slug: animal.model_slug, length: body.display, asleep: true, startled: false, epoch: worldMs() / 1000, dt: 0, reduced: true}) : null
        });
    };
    /** Its own size (seeded) and, while young, its growth (`liveliness-scene.ts`), on its species' drawn length. */
    const ownSize = (entry: Entry): Entry => {
        const k = liveliness.lengthScale(entry, entry.floor);
        entry.length *= k;
        entry.full *= k;
        entry.trueLength *= k;
        return entry;
    };

    /** The selected animal's state as last told to the page (its tap card). */
    let toldState: ArkBehaviourState | null = null;
    let toldRest: {id: string; rest: ArkRestStatus | null} | null = null;
    /**
     * How it rests now, in the tap card's words (`sleep.ts` restStatus): from its one state, its schedule's doing, its
     * posture, its roost (in its den: gone in, or a den animal settled at its way in), and the sun.
     */
    const restOf = (entry: Entry): ArkRestStatus | null => {
        const own = entry.sched ?? null;
        const pose = own?.pose ?? null;
        const style = sleepStyle(entry.animal.model_slug);
        const asleep = entry.state.asleep && !entry.reactive?.woke;
        const settled = Boolean(own && pose && !pose.moving && own.trip && (own.trip.doing === "sleep" || own.trip.doing === "rest" || own.trip.doing === "to_roost"));
        const enclosed = (entry.denIn ?? 0) > 0.5 || Boolean(settled && own && goesIntoRoost(own.trip?.to.point, own.profile.roost));
        const raised = Boolean(pose && own && pose.y > Math.max(own.ground, 0) + 0.4) || Boolean(entry.place.canopy);
        const inWater = Boolean(entry.depth && (pose ? pose.y < 0.02 && own!.ground < 0 : true)) || Boolean(entry.place.water);
        const sunny = lighting.daylight.night < 0.2 && reactiveWeather.rain < 0.3;
        return restStatus({asleep, doing: entry.state.doing ?? null, atRoost: settled, enclosed, roost: own?.profile.roost ?? null, posture: entry.sleepNow?.posture ?? style.posture, social: style.social, raised, inWater, sunny});
    };
    const tellState = () => {
        const entry = selectedId ? findEntry(selectedId) : null;
        const state = entry ? entry.state : null;
        if (entry && options.onRest) {
            const rest = restOf(entry);
            if (toldRest?.id !== entry.animal.id || toldRest.rest !== rest) {
                toldRest = {id: entry.animal.id, rest};
                options.onRest(entry.animal.id, rest);
            }
        }
        if (sameBehaviour(state, toldState)) return;
        toldState = state;
        if (entry && state) options.onBehaviour?.(entry.animal.id, state);
    };
    /** Each animal's state for the hour (and the act it is in): who is asleep, who is in the air. */
    const refreshState = (entry: Entry) => {
        entry.state = stateOf(entry);
        entry.awake = !entry.state.asleep;
        if (reducedMotion) {
            const targets = animationTargets(entry.state);
            entry.rest = targets.rest;
            entry.air = targets.air;
        }
    };
    const applyHours = () => {
        sunElevation = lighting.daylight.elevation;
        for (const entry of allEntries()) refreshState(entry);
        for (const herd of herds) for (const member of herd.members) member.awake = awakeNowOf(member.activity ?? null, member.sleep);
        for (const group of restingGroups) for (const member of group.members) member.awake = awakeNowOf(member.activity ?? null, member.sleep);
        tellState();
    };

    // MARK: An animal's status (decision 240): the tap card's "Now" and "Next", its log, and the bars over it

    /** Record lines noted for animals' logs (the page's life story, the live log's events), newest first, a few each. */
    const records = new Map<string, ArkRecordNote[]>();
    const noteRecord = (notes: readonly ArkRecordNote[]) => {
        for (const note of notes) {
            const list = records.get(note.animalId) ?? [];
            if (list.some((known) => known.id === note.id)) continue;
            list.push(note);
            list.sort((a, b) => b.at - a.at);
            if (list.length > 12) list.length = 12;
            records.delete(note.animalId);
            records.set(note.animalId, list);
            if (records.size > 4000) records.delete(records.keys().next().value as string);
        }
        statusAt = -Infinity;
    };
    /** Its schedule as the status reads it (on it and wired), with a zoo's feeding time (Part C). */
    /** While its plans are still being worked out a few a frame (`warmStatus`): its status said plainly, as one off the schedule. */
    let statusLight = false;
    const subjectOf = (entry: Entry, own: Sched | null | undefined = entry.sched): ScheduleSubject | null => {
        if (statusLight || !own || !world || !own.wired || entry.visitor) return null;
        const town = island && townIds.has(entry.animal.id) ? island : null;
        const rhythm = {activity: entry.animal.activity ?? own.profile.activity, awake: (t: number) => scheduleAwakeAt(own.profile, entry.animal.activity, scheduleHours(t), arkSleepOf(entry.animal))};
        return {
            id: entry.animal.id,
            world: worldOf(own.animal),
            profile: own.profile,
            animalAt: town ? (epoch) => town.feedingAnimal(own.animal, epoch, rhythm) : () => own.animal,
            feedingAt: town ? (epoch) => town.feedingAnimal(own.animal, epoch, rhythm) !== own.animal : null,
            activity: entry.animal.activity,
            hoursAt: scheduleHours
        };
    };
    /**
     * Its day as its card's bars read it (bars truth, 2026-11-15: "I don't want fake values"): its own schedule, whether
     * or not it is drawn moving on it now (with motion reduced, in a replay's act); one never on it (a micro animal, a
     * hamlet resident, an underground one, one held off the water, a town animal kept still) has a schedule of its own
     * made for its card alone, never drawn (`statusSchedOf`). Its schedule is a pure function of the shared clock and its
     * id, so every viewer reads the same bars; only the drawing is skipped.
     */
    const statusScheds = new Map<string, {place: Placement; world: ScheduleWorld | null; town: ScheduleWorld | null; own: Sched | null}>();
    const statusSchedOf = (entry: Entry): Sched | null => {
        if (entry.sched || entry.visitor || !world) return null;
        let known = statusScheds.get(entry.animal.id);
        // (Made again when its place or the worlds change: a new snapshot, the town's world in.)
        if (!known || known.place !== entry.place || known.world !== world || known.town !== townWorld) {
            const own = makeSched(entry.animal, entry.place, entry.length, true);
            // (Its own day, as it is: no group, no spacing from its prey; wired as it stands.)
            if (own) own.wired = true;
            known = {place: entry.place, world, town: townWorld, own};
            statusScheds.set(entry.animal.id, known);
            if (statusScheds.size > 64) statusScheds.delete(statusScheds.keys().next().value as string);
        }
        return known.own;
    };
    const barsSubjectOf = (entry: Entry): ScheduleSubject | null => subjectOf(entry, entry.sched ?? statusSchedOf(entry));
    const statusOf = (entry: Entry): ArkAnimalStatus => {
        const epoch = worldMs() / 1000;
        const animal = entry.animal;
        const subject = scheduled(entry) && !entry.act ? subjectOf(entry) : null;
        const bars = barsSubjectOf(entry);
        const huntingNow = Boolean(subject && hunting.active && hunting.hunting(animal, epoch));
        const plan = subject ? scheduleStatus(subject, epoch, {trip: entry.sched?.trip ?? null, hunting: huntingNow}) : null;
        // Off the schedule (reduced motion, a micro or underground animal, a replay's act): its one state, said plainly.
        // (A meal's act says what it is drawn doing: hunting in the chase, eating, drinking, resting after it, scavenging.)
        const activity = entry.act?.meal ?? (plan ? plan.activity : arkActivityKey({doing: null, asleep: entry.state.asleep, airborne: entry.state.airborne, breathing: entry.state.breathing}));
        const notes = records.get(animal.id) ?? [];
        const record: ArkStatusLogEntry[] = [arkOriginEntry(animal, notes.some((note) => note.kind === "hatched")), ...notes.filter((note) => note.kind !== "born" && note.kind !== "hatched" && note.kind !== "arrived").map((note) => ({id: note.id, source: "record" as const, at: note.at, day: note.day, kind: note.kind, other: note.other ?? null, count: note.count ?? null, via: note.via ?? null, ...(note.text ? {text: note.text} : {})}))];
        // How fed it is and its energy over its day (card truth, 2026-11-13): from its own schedule, its eating and waking
        // slots (awake at its slot's start, as the schedule reads it); a kill of its on record (its log's meals) fills it.
        // (A kill of its, or a step's meal for it, `fed` with source step: each fills it from that moment.)
        const fed = bars ? scheduleFed(bars, epoch, notes.filter((note) => note.kind === "meal" || note.kind === "stepFed").map((note) => note.at / 1000)) : null;
        const energy = bars ? energyOf(bars, epoch) : null;
        return {
            id: animal.id,
            activity,
            since: plan?.since ?? null,
            goal: plan?.goal ?? null,
            log: arkStatusLog(plan?.log ?? [], record),
            bars: arkStatusBars({condition: animal.condition, arkDay: arkDayNow(current, Date.now()), fed, energy, bornDay: animal.born_ark_day ?? null, lifespanDays: animal.lifespan_days ?? null, lifespanEstimate: animal.lifespan_estimate === true})
        };
    };
    const energyOf = (subject: ScheduleSubject, epoch: number) => {
        const offset = slotOffset(subject.id);
        const slotStartOf = (t: number) => Math.floor((t + offset) / SLOT_SECONDS) * SLOT_SECONDS - offset;
        const sleep = subject.animalAt(epoch).sleep;
        return arkEnergy((t) => scheduleAwakeAt(subject.profile, subject.activity, subject.hoursAt(slotStartOf(t)), sleep), epoch, SLOT_SECONDS, slotStartOf);
    };
    /**
     * Its day (lane ark-its-day): what it did over a window, as the card would have said it at every moment
     * (`animal-status.ts` dayCursor), and its record lines in the window. A day is about a thousand slots, each a placed,
     * path-searched plan, so it is worked out a slot at a time in short slices a frame (shorter while the view moves),
     * told as it goes; a re-wiring of the schedules starts it again (its plans changed). Nothing is stored.
     */
    const DAY_SLICE_MS = 4;
    const DAY_SLICE_REST_MS = 8;
    const animalDay = (id: string, fromMs: number, toMs: number, dayOptions: {signal?: AbortSignal; onProgress?: (day: ArkAnimalDay) => void} = {}): Promise<ArkAnimalDay | null> => {
        const range = arkDayWindow(fromMs, toMs, worldMs());
        const entry = findEntry(id);
        if (!range || !entry) return Promise.resolve(null);
        const recordIn = (): ArkStatusLogEntry[] => {
            const notes = records.get(id) ?? [];
            const all: ArkStatusLogEntry[] = [arkOriginEntry(entry.animal, notes.some((note) => note.kind === "hatched")), ...notes.filter((note) => note.kind !== "born" && note.kind !== "hatched" && note.kind !== "arrived").map((note) => ({id: note.id, source: "record" as const, at: note.at, day: note.day, kind: note.kind, other: note.other ?? null, count: note.count ?? null, via: note.via ?? null, ...(note.text ? {text: note.text} : {})}))];
            return all.filter((line) => line.at >= range.from && line.at < range.to).sort((a, b) => a.at - b.at);
        };
        return new Promise((resolve) => {
            let cursor: DayCursor | null = null;
            let generation = -1;
            let subjectWorld: ScheduleWorld | null = null;
            let told = 0;
            const out = (): ArkAnimalDay => ({
                id,
                from: range.from,
                to: range.to,
                since: (cursor?.since ?? range.to / 1000) * 1000,
                done: Boolean(cursor?.done),
                segments: (cursor?.runs ?? []).map((run) => ({from: run.from * 1000, to: run.to * 1000, activity: run.key})),
                events: recordIn()
            });
            const frame = () => {
                if (dayOptions.signal?.aborted || disposed) return resolve(null);
                const live = findEntry(id);
                const subject = live && !live.act ? subjectOf(live) : null;
                if (!subject) {
                    // (Still being wired, or off the schedule: asked again next frame, a few seconds at most.)
                    if (++told > 600) return resolve(null);
                    requestAnimationFrame(frame);
                    return;
                }
                const now = behaviourSchedule.scheduleGeneration();
                if (!cursor || now !== generation || subject.world !== subjectWorld) {
                    cursor = dayCursor(subject, range.from / 1000, range.to / 1000);
                    generation = now;
                    subjectWorld = subject.world;
                }
                const began = performance.now();
                const slice = flight || pointers > 0 ? DAY_SLICE_MS : DAY_SLICE_REST_MS;
                while (!cursor.done && performance.now() - began < slice) cursor.step();
                if (cursor.done) return resolve(out());
                dayOptions.onProgress?.(out());
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
    };
    /** The selected animal's status as last worked out (about once a second), and what was last told. */
    let selectedStatus: ArkAnimalStatus | null = null;
    let statusAt = -Infinity;
    let toldStatus = "";
    let toldRhythm: string | null = null;
    let selectionBars: ArkSelectionBars | null = null;
    /** Hearts are lives: the owner's own animals' hearts (`setHearts`), for the bars' hearts row; null with hearts off. */
    let hearts: Map<string, number> | null = null;
    const heartsOf = (id: string): number | null => hearts?.get(id) ?? null;
    /** Back from recovering (`revive`): when its walk out of its home began (null: not drawn yet), where from, its pose. */
    const reviving = new Map<string, {from: number | null; home: ActBody | null; pose: ActPose | null; asked: number}>();
    /**
     * A status's costly part, a little a frame (graphics and performance pass, 2026-11). A status is the animal's
     * plans for its last ten slots and, for its "fed" bar, its last ninety waking slots (`animal-status.ts`
     * scheduleStatus, scheduleFed), each plan a placed, path-searched intent. Worked out in one go for an animal just
     * tapped, that was the frame after the tap: 0.9 s on the phone profile (4x CPU), 1 to 2.4 s on the low one, 0.2 s
     * on a desktop, and again after every re-wiring of the schedules while a card was open. Both functions remember
     * each slot as it is worked out and ask the subject for its animal once per plan, before the schedule's own code
     * is entered. So a dry run through a subject that stops the run there once `STATUS_SLICE_MS` are spent leaves what
     * it did remembered; the next frame's run goes on from it, and the status itself is asked for when a run comes
     * through: the same answers, a few plans a frame. True when everything it needs is remembered.
     */
    const STATUS_SLICE_MS = 6;
    /** With the view at rest (no flight, no finger down) a longer slice: the card is whole sooner. */
    const STATUS_SLICE_REST_MS = 12;
    const STATUS_STOP = {stop: true};
    let statusWarm: {id: string; generation: number; world: ScheduleWorld} | null = null;
    let statusWarming: {id: string; runs: number} | null = null;
    /** The status shown is still the light one (or the one from before a re-wiring): asked again every frame. */
    let statusPending = false;
    const warmStatus = (entry: Entry): boolean => {
        const subject = options.recording ? null : barsSubjectOf(entry);
        if (!subject) return true;
        // (Its card's "Now" from its plans only while it is drawn on its schedule; its bars from its day either way.)
        const drawn = scheduled(entry) && !entry.act;
        const generation = behaviourSchedule.scheduleGeneration();
        if (statusWarm && statusWarm.id === subject.id && statusWarm.generation === generation && statusWarm.world === subject.world) return true;
        if (statusWarming?.id !== subject.id) statusWarming = {id: subject.id, runs: 0};
        // (Should the status ever stop remembering slot by slot, the runs would never come through: after this many
        // the status itself, in one go, as before.)
        if (++statusWarming.runs <= 1200) {
            const began = performance.now();
            const slice = flight || pointers > 0 ? STATUS_SLICE_MS : STATUS_SLICE_REST_MS;
            let asked = 0;
            const sliced: ScheduleSubject = {
                ...subject,
                animalAt: (epoch) => {
                    if (asked++ > 0 && performance.now() - began > slice) throw STATUS_STOP;
                    return subject.animalAt(epoch);
                }
            };
            const epoch = worldMs() / 1000;
            try {
                scheduleFed(sliced, epoch, []);
                if (drawn) scheduleStatus(sliced, epoch, {});
            } catch (error) {
                if (error === STATUS_STOP) return false;
                throw error;
            }
        }
        statusWarm = {id: subject.id, generation, world: subject.world};
        statusWarming = null;
        return true;
    };
    /**
     * Its rhythm against its kind's System Dynamics (lane ark-sd-align, `rhythm-status.ts`): a little a call, as the
     * status's warming (each slot's key is remembered, so a run stopped part way goes on); "pending" until whole.
     */
    const rhythmOf = (entry: Entry, budgetMs: number, stepFeeds: boolean): ArkRhythmStatus | "pending" | null => {
        const subject = scheduled(entry) && !entry.act && !options.recording ? subjectOf(entry) : null;
        if (!subject) return null;
        const began = performance.now();
        let n = 0;
        const sliced: ScheduleSubject = {
            ...subject,
            animalAt: (epoch) => {
                if (n++ > 0 && performance.now() - began > budgetMs) throw STATUS_STOP;
                return subject.animalAt(epoch);
            }
        };
        try {
            return scheduleRhythm(sliced, worldMs() / 1000, {thrive: arkThriveOf(entry.animal), condition: entry.animal.condition ?? null, stepFeeds});
        } catch (error) {
            if (error === STATUS_STOP) return "pending";
            throw error;
        }
    };
    /** Its status without its plans (what an animal off the schedule gets): what a card shows while they are worked out. */
    let toldExtras = "";
    const selectionExtrasOf = (animal: ArkAnimal): ArkSelectionExtras | null => {
        try {
            return options.selectionExtras?.(animal) ?? null;
        } catch {
            return null;
        }
    };
    const lightStatus = (entry: Entry): ArkAnimalStatus => {
        statusLight = true;
        try {
            return statusOf(entry);
        } finally {
            statusLight = false;
        }
    };
    const tellStatus = (now: number) => {
        const entry = selectedId ? findEntry(selectedId) : null;
        if (!entry) {
            selectedStatus = null;
            toldStatus = "";
            statusPending = false;
            selectionBars?.set(null);
            return;
        }
        const same = selectedStatus?.id === entry.animal.id;
        if (same && !statusPending && now - statusAt < 1000) return;
        // Its plans a few a frame first. Meanwhile a newly selected animal's card has its light status (told once, its
        // bars not shown until they are whole); one whose schedules were re-wired keeps what it showed.
        if (!warmStatus(entry)) {
            if (!same) {
                selectedStatus = lightStatus(entry);
                toldStatus = arkStatusSignature(selectedStatus);
                selectionBars?.set(null);
                options.onStatus?.(entry.animal.id, selectedStatus);
            }
            statusPending = true;
            return;
        }
        if (!same || statusPending) toldStatus = "";
        statusPending = false;
        statusAt = now;
        selectedStatus = statusOf(entry);
        // (Its hearts, the owner's own, in the signature: a heart restored shows at once.)
        const signature = `${arkStatusSignature(selectedStatus)}|h${heartsOf(entry.animal.id) ?? ""}`;
        // Who brought it and its Talk link (the host's, from its founders read, which can land after the selection).
        const hostExtras = selectionExtrasOf(entry.animal);
        // V1: its mark, from the cast when one is in (`seen/`: the last of its kind in the wild, a lone founder).
        const mark = cast?.label?.(entry.animal.id) ?? null;
        // ARK-MATING-SHOWN: and its bar (a clutch's countdown to the hatching).
        const progress = cast?.progress?.(entry.animal.id) ?? null;
        const extras = mark || progress ? {byline: hostExtras?.byline ?? null, talk: hostExtras?.talk ?? null, mark, progress} : hostExtras;
        const extrasSignature = extras ? JSON.stringify(extras) : "";
        // (Its rhythm's dot, lane ark-sd-align: a few milliseconds a second until it is whole, then remembered.)
        const rhythm = rhythmOf(entry, 4, false);
        const rhythmState = rhythm && rhythm !== "pending" ? rhythm.agreement.state : null;
        if (signature === toldStatus && extrasSignature === toldExtras && rhythmState === toldRhythm) return;
        toldExtras = extrasSignature;
        toldRhythm = rhythmState;
        // (Its species' name over them, as its card has it: never a nickname. Under it, "Brought by @handle" only when the
        // server names its founder: docs/ark/CAPTURE-MEDIA-CONTRACT.md section 1.)
        (selectionBars ??= new ArkSelectionBars(labelLayer, reducedMotion, options.onSelectionLink ?? null))
            .set(selectedStatus.bars, entry.animal.name, extras, {animalId: entry.animal.id, slug: entry.animal.model_slug}, rhythmState, heartsOf(entry.animal.id));
        if (signature === toldStatus) return;
        toldStatus = signature;
        options.onStatus?.(entry.animal.id, selectedStatus);
    };
    const barsPoint = new Vector3();
    /** The bars over the selected animal's head, each frame. */
    const placeSelectionBars = () => {
        if (!selectionBars) return;
        const entry = selectedId ? findEntry(selectedId) : null;
        const middle = entry?.middle;
        if (!entry || !middle || entry.held || selectedStatus?.id !== entry.animal.id) return selectionBars.hide();
        barsPoint.copy(middle).setY(middle.y + entry.drawnHeight * 0.55 + 0.1).project(camera);
        const visible = barsPoint.z < 1 && Math.abs(barsPoint.x) < 1.02 && Math.abs(barsPoint.y) < 1.02;
        // (Kept above the page's card at the foot of the view, `setViewInset`: over it when the animal is behind the card.)
        selectionBars.place(((barsPoint.x + 1) / 2) * width, ((1 - barsPoint.y) / 2) * height, visible, {width, height: Math.max(height - Math.max(insetTarget, insetCovered > 0 ? insetBottom : 0), 60)});
    };

    // The live log's moments (`animal-status.ts` pickMoment): who can be named, worked out again when the animals change
    // and every half minute (schedules are wired a slice at a time, the town's once its world is in).
    let momentSubjects: MomentSubject[] | null = null;
    let momentsFor: Entry[] | null = null;
    let momentsAt = -Infinity;
    const momentSubjectsNow = (): MomentSubject[] => {
        if (momentSubjects && momentsFor === entries && performance.now() - momentsAt < 30_000) return momentSubjects;
        const leads = new Map<Entry, number>();
        for (const e of entries) if (e.leader && e.leader !== e && e.leader.animal.model_slug === e.animal.model_slug) leads.set(e.leader, (leads.get(e.leader) ?? 1) + 1);
        const list: MomentSubject[] = [];
        for (const e of entries) {
            const subject = subjectOf(e);
            if (!subject || e.place.micro) continue;
            list.push({...subject, young: Boolean(e.sched!.animal.young), leads: leads.get(e) ?? 0, surfaces: Boolean(e.sched!.profile.breathes && e.depth && e.trueLength >= 1.2)});
        }
        momentSubjects = list;
        momentsFor = entries;
        // (Until every schedule is wired, again at the next call.)
        momentsAt = entries.every((e) => !e.sched || e.sched.wired) ? performance.now() : -Infinity;
        return list;
    };
    const happening = (after: number | null): {window: number; moments: ArkHappening[]} => {
        const done = Math.floor(worldMs() / 1000 / MOMENT_WINDOW_SECONDS) - 1;
        if (!world || reducedMotion || !scheduleOn) return {window: done, moments: []};
        // Two windows a call at most; a caller far behind (a hidden tab) skips to now.
        const from = after === null || after < done - 2 ? done - 1 : after + 1;
        const subjects = from <= done ? momentSubjectsNow() : [];
        const moments: ArkHappening[] = [];
        for (let w = from; w <= done; w++) {
            const start = w * MOMENT_WINDOW_SECONDS;
            // Encounter hunting: a predator whose forays begin in this window (the server's next hunt came, and it is awake).
            const forays = hunting.active ? subjects.filter((s) => {
                const animal = findEntry(s.id)?.animal;
                return animal ? hunting.hunting(animal, start + MOMENT_WINDOW_SECONDS) && !hunting.hunting(animal, start) : false;
            }).map((subject) => ({subject, at: start})) : [];
            const moment = pickMoment(w, subjects, forays);
            const entry = moment ? findEntry(moment.animalId) : null;
            if (!moment || !entry) continue;
            const a = entry.animal;
            // (One animal starting a recipe its species has its own sentence for: said in those words.)
            const sentence = moment.recipe && moment.count <= 1 ? signatureLineOf(a.model_slug, moment.recipe) : null;
            // (A sentence about several of the kind only for a pair's moment: one animal setting out alone is not "they".)
            const ownLine = sentence && (!sentence.startsWith("{animals}") || moment.kind === "courting" || moment.kind === "contest") ? sentence : null;
            moments.push({id: moment.id, kind: moment.kind, activity: moment.activity, animalId: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, count: moment.count, at: moment.at, ...(ownLine ? {line: ownLine} : {})});
        }
        return {window: Math.max(done, after ?? done), moments};
    };

    /** The badge over a herd: its count, tappable (the population panel is the way in for the keyboard). */
    const herdBadge = (count: number) => options.herdBadge?.(count) ?? `\u00d7 ${count.toLocaleString()}`;
    const makeBadge = (key: string): HTMLButtonElement => {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.tabIndex = -1;
        Object.assign(badge.style, {
            position: "absolute",
            left: "0",
            top: "0",
            whiteSpace: "nowrap",
            font: "700 12px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            letterSpacing: "0.02em",
            color: "rgba(255, 252, 244, 0.98)",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "rgba(14, 20, 14, 0.66)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            opacity: "0",
            pointerEvents: "none",
            cursor: "pointer",
            transition: "opacity 300ms ease, background-color 200ms ease",
            willChange: "transform"
        });
        badge.addEventListener("click", (event) => {
            event.stopPropagation();
            selectHerd(key, true);
        });
        // A touch on the badge is the badge's, not the world's.
        badge.addEventListener("pointerdown", (event) => event.stopPropagation());
        labelLayer.appendChild(badge);
        return badge;
    };

    /** The herds' members past their representatives, at their own places (A14). */
    const buildHerds = (snapshot: ArkSnapshot, found: Map<string, ArkHerd>, places: Map<string, Placement>) => {
        const byId = new Map(snapshot.animals.map((animal) => [animal.id, animal]));
        const before = new Map(herds.map((herd) => [herd.info.key, herd]));
        const next: HerdDraw[] = [];
        found.forEach((info) => {
            const animals = info.massed.map((id) => byId.get(id)).filter((animal): animal is ArkAnimal => Boolean(animal));
            if (!animals.length) return;
            const members = animals.map((animal) => {
                const place = places.get(animal.id)!;
                return {id: animal.id, x: place.x, z: place.z, ground: place.ground, yaw: place.yaw, water: place.water, phase: phaseOf(animal.id), mine: animal.mine, awake: true, activity: animal.activity ?? null, sleep: arkSleepOf(animal)};
            });
            const cx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
            const cz = members.reduce((sum, m) => sum + m.z, 0) / members.length;
            let radius = 0;
            let anchor = 0;
            let nearest = Infinity;
            members.forEach((m, i) => {
                const d = Math.hypot(m.x - cx, m.z - cz);
                radius = Math.max(radius, d);
                if (d < nearest) {
                    nearest = d;
                    anchor = i;
                }
            });
            const old = before.get(info.key);
            before.delete(info.key);
            const sample = animals[0];
            const body = arkBody(sample, library.get(sample.model_slug)?.behaviour?.plan);
            next.push({
                info,
                slug: info.slug,
                sample,
                members,
                centre: {x: cx, z: cz},
                radius,
                anchor,
                length: body.display,
                colour: old?.colour ?? null,
                scale: 0,
                figureMatrices: new Float32Array(members.length * 16),
                speckMatrices: new Float32Array(members.length * 16),
                order: Uint32Array.from(members.map((_, i) => i)),
                sortedAt: 0,
                sortedFrom: new Vector3(Infinity, 0, 0),
                middles: new Float32Array(members.length * 3).fill(Number.NaN),
                badge: old?.badge ?? makeBadge(info.key),
                figures: 0,
                specks: 0,
                height: 1
            });
        });
        before.forEach((herd) => herd.badge.remove());
        herds = next;
        for (const herd of herds) herd.badge.textContent = herdBadge(herd.info.count);
        if (selectedHerd && !herds.some((herd) => herd.info.key === selectedHerd)) selectHerd(null, false);
    };

    /** Lane TB (decision 255): the resting kept town animals, grouped by species, each at its figure's place. */
    const buildRestingGroups = (animals: ArkAnimal[], places: Map<string, Placement>) => {
        const isl = island;
        const before = new Map(restingGroups.map((group) => [group.slug, group]));
        const bySlug = new Map<string, ArkAnimal[]>();
        for (const animal of animals) {
            const list = bySlug.get(animal.model_slug);
            if (list) list.push(animal);
            else bySlug.set(animal.model_slug, [animal]);
        }
        const next: FigureGroup[] = [];
        bySlug.forEach((list, slug) => {
            const sample = list[0];
            const body = arkBody(sample, library.get(slug)?.behaviour?.plan);
            const members = list.map((animal) => {
                const place = places.get(animal.id)!;
                // (In a tank: at its loop's point and depth at a fixed moment, so a tank's figures spread through its water.)
                const at = isl?.figurePose(animal.id, body.display) ?? null;
                return {id: animal.id, x: at?.x ?? place.x, z: at?.z ?? place.z, ground: place.ground, yaw: at?.yaw ?? place.yaw, water: false, phase: phaseOf(animal.id), mine: animal.mine, awake: awakeNowOf(animal.activity ?? null, arkSleepOf(animal)), activity: animal.activity ?? null, sleep: arkSleepOf(animal)};
            });
            let x0 = Infinity;
            let x1 = -Infinity;
            let z0 = Infinity;
            let z1 = -Infinity;
            for (const m of members) {
                x0 = Math.min(x0, m.x);
                x1 = Math.max(x1, m.x);
                z0 = Math.min(z0, m.z);
                z1 = Math.max(z1, m.z);
            }
            const old = before.get(slug);
            next.push({
                resting: true,
                slug,
                sample,
                members,
                centre: {x: (x0 + x1) / 2, z: (z0 + z1) / 2},
                radius: Math.hypot(x1 - x0, z1 - z0) / 2,
                anchor: 0,
                length: body.display,
                colour: old?.colour ?? null,
                scale: 0,
                figureMatrices: new Float32Array(members.length * 16),
                speckMatrices: new Float32Array(members.length * 16),
                order: Uint32Array.from(members.map((_, i) => i)),
                sortedAt: 0,
                sortedFrom: new Vector3(Infinity, 0, 0),
                middles: new Float32Array(members.length * 3).fill(Number.NaN),
                figures: 0,
                specks: 0,
                height: 1
            });
        });
        restingGroups = next;
        roostTickDrawn = Number.NaN;
    };
    // p5 (rural): the resting figures at their roosts by the clock (the hens shut in at dusk, `islands/town/rural.ts`):
    // placed again only when the island's tick changes (never by day), their matrices made again by the scale's reset.
    let roostTickDrawn = 0;
    const roostFigures = () => {
        const tick = island?.roostTick() ?? 0;
        if (tick === roostTickDrawn || !island) return;
        roostTickDrawn = tick;
        for (const group of restingGroups) {
            let moved = false;
            for (const m of group.members) {
                const home = m.home ?? {x: m.x, z: m.z, ground: m.ground};
                const at = island.roostFigure(m.id, home.x, home.z) ?? (m.home ? home : null);
                if (!at) continue;
                m.home = home;
                if (at.x === m.x && at.z === m.z && at.ground === m.ground) continue;
                m.x = at.x;
                m.z = at.z;
                m.ground = at.ground;
                moved = true;
            }
            if (!moved) continue;
            let x0 = Infinity;
            let x1 = -Infinity;
            let z0 = Infinity;
            let z1 = -Infinity;
            for (const m of group.members) {
                x0 = Math.min(x0, m.x);
                x1 = Math.max(x1, m.x);
                z0 = Math.min(z0, m.z);
                z1 = Math.max(z1, m.z);
            }
            group.centre = {x: (x0 + x1) / 2, z: (z0 + z1) / 2};
            group.radius = Math.hypot(x1 - x0, z1 - z0) / 2;
            group.scale = 0;
            group.sortedAt = 0;
        }
    };

    // 3.3 fix (`near-kept.ts`): the kept town animals nearest the look point, pinned outside on top of the budget, so a
    // garden's or a farm's animals in view move instead of standing as resting figures. Asked about once a second.
    let nearKept: string[] = [];
    let nearKeptFrom: {x: number; z: number} | null = null;
    let nearKeptAt = 0;
    let nearKeptClose = false;
    const keptAround = (): Array<{id: string; x: number; z: number; group: string | null}> => {
        const isl = island;
        const out: Array<{id: string; x: number; z: number; group: string | null}> = [];
        if (!isl) return out;
        for (const animal of current.animals) {
            if (!isl.has(animal) || !isl.kept(animal.id)) continue;
            const place = placedAll.get(animal.id);
            // p4 (zoolive): a zoo resident by its enclosure, which comes out whole (`near-kept.ts` keptToBringOut).
            if (place) out.push({id: animal.id, x: place.x, z: place.z, group: animal.area === "zoo" ? isl.townPlace(animal.id)?.place ?? animal.enclosure ?? null : null});
        }
        return out;
    };
    const stepNearKept = (now: number) => {
        if (now - nearKeptAt < 1) return;
        nearKeptAt = now;
        const target = controls.target;
        const view = camera.position.distanceTo(target);
        // p4 (zoolive): out to `NEAR_ZOO_VIEW` for a zoo enclosure in view; the gardens' and farms' nearest within `NEAR_KEPT_VIEW`.
        const close = Boolean(island) && !reducedMotion && !flight && !opening && !replay && view < NEAR_ZOO_VIEW && island!.contains(target.x, target.z);
        if (!close) {
            nearKeptFrom = null;
            if (!nearKept.length) return;
            nearKept = [];
            setSnapshot(current, false);
            return;
        }
        if (!nearKeptDue(nearKeptFrom, target.x, target.z) && nearKeptClose === view < NEAR_KEPT_VIEW) return;
        nearKeptFrom = {x: target.x, z: target.z};
        nearKeptClose = view < NEAR_KEPT_VIEW;
        const ids = keptToBringOut(keptAround(), target.x, target.z, view, liteOn() || tier === "low" ? NEAR_ZOO_MAX_LOW : NEAR_ZOO_MAX);
        if (sameIds(ids, nearKept)) return;
        nearKept = ids;
        setSnapshot(current, false);
    };

    /**
     * p5 (humans, dogs): the dogs on a walk now. Once a second: who is out (the pairing is redone when the roster
     * changed; the walked dogs nearest the look point, at most 12 (6 on the light tiers), are pinned outside). Every
     * frame: each walked dog's own entry is moved to its place at heel and its lead drawn; a dog whose walk has ended
     * is given back to its home's own day.
     */
    const stepDogWalks = (now: number) => {
        const isl = island;
        if (!isl) return;
        if (dogRosterDirty && placedFor === current) {
            dogRosterDirty = false;
            const o = townWorldOrigin();
            const dogs = [];
            for (const animal of current.animals) {
                if (!isHouseDog(animal) || !isl.has(animal) || !isl.kept(animal.id)) continue;
                const place = placedAll.get(animal.id);
                const town = isl.townPlace(animal.id);
                // (A dog kept still indoors, behind a window, is not walked: its home's rooms are another lane's.)
                if (place && town && town.area === "house" && !town.still) dogs.push({id: animal.id, household: town.place, x: place.x - o.x, z: place.z - o.z, length: arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan).display});
            }
            dogWalks.setRoster(dogs, townWalkers(townHumans.grown));
        }
        const walked = townHumans.dogs;
        if (now - walkPinsAt >= 1) {
            walkPinsAt = now;
            const cap = liteOn() || tier === "low" ? 6 : 12;
            const target = controls.target;
            let ids = walked.map((d) => d.id);
            const moved = !walkPinsFrom || Math.hypot(target.x - walkPinsFrom.x, target.z - walkPinsFrom.z) >= 8;
            if (ids.length > cap) {
                // (Over the cap: the nearest the look point, picked anew only when it has moved, as `near-kept.ts`.)
                if (!moved && walkPins.every((id) => ids.includes(id)) && walkPins.length === cap) ids = walkPins;
                else ids = walked.slice().sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z) || (a.id < b.id ? -1 : 1)).slice(0, cap).map((d) => d.id);
            }
            if (moved) walkPinsFrom = {x: target.x, z: target.z};
            if (!sameIds(ids, walkPins)) {
                walkPins = ids;
                setSnapshot(current, false);
            }
        }
        dogLeads.begin();
        for (const d of walked) {
            const e = entryById.get(d.id);
            let pose = dogActs.get(d.id);
            if (!e || e.held || e.ghost || (e.act && e.act !== pose)) continue;
            if (!pose) dogActs.set(d.id, (pose = {x: 0, z: 0, base: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: "walk", speed: 0}));
            pose.x = d.x;
            pose.z = d.z;
            pose.base = d.y;
            pose.yaw = d.yaw;
            pose.state = d.sniffing ? "eat" : "walk";
            pose.speed = d.speed;
            e.act = pose;
            pose.with = d.walker;
            // Its collar: at its neck, ahead of its middle.
            dogCollar.x = d.x + Math.sin(d.yaw) * d.length * 0.36;
            dogCollar.y = d.y + d.length * 0.58;
            dogCollar.z = d.z + Math.cos(d.yaw) * d.length * 0.36;
            humanFigures.leadHand(d.walker, d.hand); // p6 (people): the lead from the rigged walker's own hand
            dogLeads.add(d.hand, dogCollar);
        }
        dogLeads.end();
        if (dogActs.size > walked.length || walked.length === 0) {
            dogActs.forEach((pose, id) => {
                if (walked.some((d) => d.id === id)) return;
                const e = entryById.get(id);
                if (e && e.act === pose) e.act = null;
                dogActs.delete(id);
            });
        }
    };

    /** Again from the snapshot as it is: after a pin changed (a herd member selected, a replay's animals). */
    const refreshLive = () => {
        if (herds.length || replayPins.size || mealPins.size || selectionPin || cast) setSnapshot(current, false);
    };

    // The hamlet (`map/hamlet.ts`): its plots' key, its residents, and who is out now (worked out once a second), on the
    // runtime's own rotation (`live-budget.ts` arkOutside), so a resident indoors is one the live budget rests.
    let hamletPlotsKey = "";
    let hamletResidents: HamletResident[] = [];
    let hamletNow: {at: number; state: ReturnType<typeof hamletState>} | null = null;
    const hamletAt = () => {
        const epoch = worldMs() / 1000;
        if (!hamletNow || Math.abs(epoch - hamletNow.at) >= 0.5) hamletNow = {at: epoch, state: hamletState(hamletResidents, epoch, scheduleHours, arkOutside)};
        return hamletNow.state;
    };
    /** A resident out of doors now, or walking a door beat (else it is indoors: not drawn). */
    const hamletOutside = (entry: Entry) => {
        const state = hamletAt();
        return state.out.has(entry.animal.id) || state.beats.has(entry.animal.id);
    };
    let modulesFor: ArkSnapshot | null = null;
    /** Runtime (sliced mount): the animals are laid out; host calls that need them wait until then. */
    let animalsIn = false;
    const afterAnimals: Array<() => void> = [];
    const whenAnimals = <A extends unknown[]>(call: (...args: A) => void) => (...args: A) => {
        if (animalsIn) call(...args);
        else afterAnimals.push(() => call(...args));
    };
    const setSnapshot = (whole: ArkSnapshot, entrances: boolean) => {
        // The engine's own sexes first (`animal.sex`, while the server's switch is on): every mother, father and look below follows them.
        setRecordedSexes(whole.animals);
        // Powers you can see (decision 420): its layer loads the first time a read has an animal above ordinary.
        if (powerShow) powerShow.snapshot(whole);
        else if (!powerLoading && whole.animals.some((animal) => animal.thrive === "good" || animal.thrive === "prime")) {
            powerLoading = true;
            void import("@/ark-scene/power-show")
                .then((m) => {
                    if (disposed) return;
                    // (The Blender Power clips ride on the v3 rigs: `power-clips.ts`, loaded only when one is wanted.)
                    powerShow = m.createArkPowerShow({
                        base: rigBasesFrom(options.modelBase, options.rigBase).find((base) => rigSetVersion(base) === 3) ?? null,
                        loaded: (slug) => {
                            const rig = rigs.get(slug);
                            return rig ? {set: rig.set, version: rig.version, bones: rig.bones, has: (name: string) => Boolean(rig.clips[name])} : null;
                        },
                        request: (slug) => rigs.request(slug, true),
                        flight: (slug) => Boolean(rigs.get(slug)?.flight),
                        add: (slug, rig, bin, clips) => rigs.addPowerClips(slug, rig, bin, clips)
                    });
                    if (current) powerShow.snapshot(current);
                })
                .catch(() => {
                    powerLoading = false;
                });
        }
        // p5 (humans): the record's humans are drawn as generic town people (`humans/`), never as animals.
        const people = splitHumans(whole);
        const base = people.rest;
        // V2 replay: the roster with the cast's stand-ins (and, as of a time, without who came later); else the read itself.
        const snapshot = cast ? cast.roster(base) : base;
        humansAboard = people.humans;
        townHumans.setRoster(people.humans);
        // The entrance's clock is the frame's (seconds since the scene started).
        const now = (performance.now() - started) / 1000;
        current = base;
        aboard = new Set(snapshot.animals.map((animal) => animal.id));
        forestHumans = people.humans.map((animal) => animal.id); // p5 (humans): the logging crews are of the humans aboard
        dogRosterDirty = true; // p5 (humans, dogs)
        forest.rosterChanged(); // p5 (humans)
        // Everyone's place (the herds' members too): from the server's slots, the same for every viewer.
        if (placedFor !== base) {
            // The hamlet's plots for these residents (`map/hamlet.ts`), set before anything reads the attach points.
            // (Part C: the wild island's residents only; with two islands the kept animals live in the town.)
            const plots = hamletPlotsFor(wildOnly(base.animals));
            const plotsKey = plots.map((plot) => plot.id).join(",");
            if (plotsKey !== hamletPlotsKey) {
                hamletPlotsKey = plotsKey;
                setAttachHomePlots(plots);
                // (The behaviour world's walk grid and places keep wild walkers out of the plots' buildings and fences.)
                if (setBehaviourHomePlots(plots)) restartBehaviourWorld();
                for (const sceneModule of modules) (sceneModule as Partial<{setHomePlots: (list: HomePlot[]) => void}>).setHomePlots?.(plots);
            }
            placedAll = placeAll(base.animals);
            placedFor = base;
            hamletResidents = base.animals.flatMap((animal) => {
                const plot = placedAll.get(animal.id)?.hamlet?.plot;
                return plot ? [{id: animal.id, slug: animal.model_slug, length: arkBody(animal).metres, plot}] : [];
            });
        }
        let places = placedAll;
        // (The cast's stand-ins, placed as a replay's departed are: from the server's record of each, where it stood.)
        const standIns = snapshot === base ? [] : snapshot.animals.filter((animal) => !placedAll.has(animal.id));
        if (standIns.length) {
            places = new Map(placedAll);
            placeAll(standIns, true).forEach((place, id) => places.set(id, place));
        }
        // Part B: the chunks the animals live in hold content (the haze is on only while such a chunk lies beyond).
        places.forEach((place) => streamer.markContent(place.x, place.z));
        // A very popular species (A14): its representatives drawn one by one, the rest as the herd.
        // (The selected animal too, while aboard: it stays drawn one by one as the town joins or a new read comes.)
        const pins = selectionPins(aboard, {selected: selectedId, promoted: selectionPin, followed: followId, replay: mealPins.size || cast ? Array.from(replayPins).concat(Array.from(mealPins), Array.from(cast?.pins ?? [])) : replayPins});
        // 3.3 fix: the kept town animals nearest the look point are out to move (`near-kept.ts`).
        for (const id of nearKept) if (aboard.has(id)) pins.add(id);
        for (const id of walkPins) if (aboard.has(id)) pins.add(id); // p5 (humans, dogs): the dogs out on a walk
        // (Development: `window.__arkHerdOff = true` before mounting draws everyone one by one, to measure against.)
        const herdOff = (globalThis as {__arkHerdOff?: boolean}).__arkHerdOff === true;
        liveliness.setSnapshot(snapshot.animals, snapshot.ark_day);
        const representatives = arkRepresentatives(snapshot.animals, {pinned: pins, live: liteOn() ? ARK_HERD_LIVE_LITE : ARK_HERD_LIVE, from: herdOff ? Number.POSITIVE_INFINITY : undefined});
        buildHerds(snapshot, representatives.herds, places);
        // Runtime: a big Ark draws at most the tier's live budget one by one, the rest resting out of sight by the
        // shared rotation (live-budget.ts); the counts and herds are untouched.
        // (Part C: the wild island's per-zone capacity is its own land's: the town's animals are counted as the town's.)
        const isl = island;
        const candidates = isl ? snapshot.animals.map((animal) => (isl.has(animal) ? {...animal, zone: "town" as ArkAnimal["zone"]} : animal)) : snapshot.animals;
        // (Lane TB: on the high and medium tiers the town's kept pets and zoo residents held in their tanks, cages,
        // vivaria and houses are always out: an empty tank in a lit window reads as a bug, not as rest. They cost no
        // schedule. On the low tier and the lighter view they take their turn in the budget like everyone.)
        const livePins = isl && !liteOn() && tier !== "low" ? new Set([...Array.from(pins), ...snapshot.animals.filter((animal) => isl.has(animal) && isl.held(animal.id)).map((animal) => animal.id)]) : pins;
        const outside = runtime.outside(candidates, representatives.live, livePins, liteOn(), restingFor(snapshot, places));
        // ARK-JUNGLE: a carried young rests with its mother: never drawn alone while she is out of sight.
        const bornById = new Map(snapshot.animals.filter((animal) => animal.origin === "born").map((animal) => [animal.id, animal]));
        if (bornById.size) keepCarriedWithMothers(outside, (id) => (bornById.has(id) ? liveliness.carriedBy(bornById.get(id)!) : null));
        // (For the resting warm-up: what the next step's rotation will be asked about, `runtime.restingAsks`.)
        // (Kept by the read, not the roster: the warm-up asks only what the rotation will, with a cast too.)
        lastRotation = {snapshot: base, candidates, live: representatives.live, pins: livePins, lite: liteOn()};
        // (Lane TB, decision 255: the town's kept animals the budget rests, as figures where they live.)
        buildRestingGroups(isl ? snapshot.animals.filter((animal) => isl.has(animal) && (animal.area === "house" || animal.area === "farm" || animal.area === "zoo") && representatives.live.has(animal.id) && !outside.has(animal.id)) : [], places);
        const next: Entry[] = [];
        const nextById = new Map<string, Entry>();
        for (const animal of snapshot.animals) {
            if (!representatives.live.has(animal.id) || !outside.has(animal.id)) continue;
            const place = places.get(animal.id)!;
            // (A stand-in whose record gives it no place: left out rather than drawn nowhere.)
            if (!place) continue;
            const before = entryById.get(animal.id);
            const body = before ? arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan) : null;
            const entry: Entry = before && body
                ? ownSize(Object.assign(before, {animal, place, thrive: arkThriveOf(animal), length: body.display * sexScale(animal), full: body.display * sexScale(animal), trueLength: body.metres, micro: place.micro ? microSpecies(animal.model_slug) : null, layer: speciesLayer(animal.model_slug), depth: place.micro ? null : speciesDepth(animal.model_slug, animal.zone), floor: body.floor, stats: arkStats(animal), pace: loopPace(animal)}))
                : newEntry(animal, place, entrances ? now : null);
            next.push(entry);
            nextById.set(animal.id, entry);
            // (Payload lane: on a touch device an icon is fetched when its kind is first drawn as an icon,
            // `updateInstances`: the phone's opening view draws markers, and 256 icons were 3.4 MB of its first minute on
            // slow 4G. A desktop and a recording ask for every icon at once, as before.)
            if (!pacer) tokens.ensure(animal.model_slug);
        }
        // 3.3 fix (log): who left the roster, kept a while (a death read after the snapshot that dropped it).
        entryById.forEach((gone, id) => {
            if (nextById.has(id) || gone.ghost) return;
            departed.set(id, gone);
            if (departed.size > 64) departed.delete(departed.keys().next().value as string);
            // V1: gone from the Ark (not merely from the live set) while it was drawn: it fades where it stood.
            if (!aboard.has(id) && animalsIn && gone.middle && !gone.held && !gone.visitor && !gone.act?.hidden && !reducedMotion && departing.length < DEPART_MOST) {
                const ghost = Object.assign(newEntry(gone.animal, gone.place, null), {ghost: true});
                ghost.leader = null;
                const pose: ActPose = {x: gone.middle.x, z: gone.middle.z, base: gone.middle.y - gone.drawnHeight * 0.5, yaw: gone.yawNow ?? gone.place.yaw ?? 0, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, speed: 0};
                ghost.act = pose;
                mealGhosts = [...mealGhosts, ghost];
                departing.push({ghost, from: performance.now() / 1000, pose});
            }
        });
        // (One the roster has again, a stand-in brought for its act: its fade gives way at once.)
        if (departing.length) stepDeparting(performance.now() / 1000, nextById);
        // (Riders last: their hosts are drawn first in each frame, `rideLate`.)
        entries = next.some((e) => riderOf(e.animal.model_slug)) ? [...next.filter((e) => !riderOf(e.animal.model_slug)), ...next.filter((e) => riderOf(e.animal.model_slug))] : next;
        entryById = nextById;
        // (The collisions' bodies and speeds follow the entries' sizes: worked out again.)
        collisions.reset();
        // The underground's burrows and molehills, and the burrow mouths of the ground's diggers.
        const burrows = next.flatMap((entry) => (entry.place.burrow ? [entry.place.burrow] : []));
        const molehills = next.flatMap((entry) => {
            const burrow = entry.place.burrow;
            if (!burrow || !/mole/.test(entry.animal.model_slug)) return [];
            return [0, 1, 2].map((k) => {
                const at = tunnelPoint(burrow, 0.35 + k * 0.25);
                return {x: at.x + Math.cos(k * 2.1) * 0.5, z: at.z + Math.sin(k * 2.1) * 0.5};
            });
        });
        const mouths = next.filter((entry) => entry.layer.burrow && !entry.place.burrow && !entry.place.micro && !entry.place.canopy && !entry.place.water).map((entry) => {
            const side = entry.length * 0.55 + 0.25;
            return {x: entry.place.x + Math.cos(entry.place.yaw) * side, z: entry.place.z - Math.sin(entry.place.yaw) * side, size: Math.min(Math.max(entry.length * 0.35, 0.18), 0.6)};
        });
        layersScene.setBurrows(burrows, molehills, mouths);
        // Runtime: the scenery modules (the props' homes and nests) depend on the snapshot only: not rebuilt when the same
        // one is laid out again (a tier change, the resting rotation), which cost seconds at the captures scale.
        if (modulesFor !== snapshot && modules.length) {
            modulesFor = snapshot;
            for (const sceneModule of modules) sceneModule.setSnapshot(snapshot);
        }
        // A school or a flock keeps to its first one.
        for (const entry of next) entry.leader = entry.place.leader && entry.place.leader !== entry.animal.id ? nextById.get(entry.place.leader) ?? null : null;
        wireSchedules(next, snapshot.ark_day ?? null);
        applyHours();
        if (followId && !entryById.has(followId)) endFollow();
        // (Deselected only when it is gone from the Ark, not when it merely left the live set: selection.ts.)
        if (!selectionSurvives(selectedId, aboard, visitor?.animal.id ?? null)) {
            selectedId = null;
            options.onSelect?.(null);
        }
        // Every species' far model, nearest first, so the whole Ark fills in from where the camera is.
        // (Small animals' models wait until the camera comes close: they are not drawn from afar. Herds' far models are.)
        const byDistance = Array.from(new Set([...next.filter((entry) => !entry.micro || entry.animal.mine).map((entry) => entry.animal.model_slug), ...herds.map((herd) => herd.slug)]));
        // Runtime: a big Ark asks up front only for the kinds nearest the view; the rest as they come into view.
        // (Payload lane: a touch device, on a phone's link and its data plan, asks up front only for the herds' kinds,
        // whose figures are drawn from afar; every other kind when it comes into view, as the rest always were. The
        // opening view's own models come first either way: they are the ones it draws.)
        const firstFar = pacer ? Array.from(new Set(herds.map((herd) => herd.slug))) : runtime.upfrontFar(byDistance, next.map((entry) => ({slug: entry.animal.model_slug, x: entry.place.x, z: entry.place.z})), herds.map((herd) => herd.slug));
        library.ready().then(() => {
            for (const slug of firstFar) if (library.has(slug)) library.request(slug, "far");
        });
    };

    // MARK: Models

    const speciesMeshes = (slug: string): SpeciesMeshes => {
        let meshes = species.get(slug);
        if (!meshes) {
            meshes = {near: null, far: null, nearMaterial: null, farMaterial: null};
            species.set(slug, meshes);
        }
        return meshes;
    };

    const instancedFor = (model: SpeciesModel, level: "near" | "far", needed: number): InstancedMesh | null => {
        const source = level === "near" ? model.near : model.far;
        if (!source) return null;
        const meshes = speciesMeshes(model.slug);
        let mesh = level === "near" ? meshes.near : meshes.far;
        if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
        const capacity = Math.max(needed, 4, mesh ? mesh.instanceMatrix.count * 2 : 0);
        let material = level === "near" ? meshes.nearMaterial : meshes.farMaterial;
        if (!material) {
            const box = source.geometry.boundingBox!;
            material = animalMaterial({
                map: source.map,
                behaviour: model.behaviour,
                minY: box.min.y,
                maxY: box.max.y,
                animated: level === "near" && !reducedMotion && !model.placeholder,
                level,
                look: model.placeholder ? null : speciesLook(model.slug, model.behaviour?.plan, model.facing, source.geometry),
                bodyMotion: level === "near" && !model.placeholder ? l2BodyUniforms(model.slug, model.behaviour) : null,
                tailHabit: tailHabitOf(model.slug) // 3.3 batch (B): tail pump, cock and fan
            });
            if (level === "near" && !model.placeholder) look.track(model.slug, material);
            // The placeholder figure (A13): warm clay from its own vertex colours, a little softer.
            if (model.placeholder) {
                material.vertexColors = true;
                material.roughness = 0.9;
            }
            if (level === "near") meshes.nearMaterial = material;
            else meshes.farMaterial = material;
        }
        if (mesh) {
            scene.remove(mesh);
            mesh.dispose();
        }
        mesh = new InstancedMesh(source.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        // (phase, dim, rest, its sleep packed: `packSleep`)
        const instance = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        instance.setUsage(DynamicDrawUsage);
        source.geometry.setAttribute("arkInstance", instance);
        // The head look (`arkLook`, the reactive layer) and the coat's wet and dust (`arkCoat`, the animal-look pass).
        // (w: lane L2's body channel, `l2BodyChannel`.)
        const headLook = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        headLook.setUsage(DynamicDrawUsage);
        source.geometry.setAttribute("arkLook", headLook);
        attachLook(source.geometry, capacity);
        attachVary(source.geometry, capacity);
        mesh.frustumCulled = false;
        mesh.castShadow = TIER_SETTINGS[tier].shadows > 0;
        mesh.receiveShadow = true;
        mesh.count = 0;
        scene.add(mesh);
        runtime.prepare(mesh);
        if (level === "near") meshes.near = mesh;
        else meshes.far = mesh;
        return mesh;
    };

    /** Whether a species' mesh can be drawn this frame: made, and not held back while its shader compiles (`runtime.prepare`). */
    const drawable = (mesh: InstancedMesh | null | undefined): boolean => Boolean(mesh) && (mesh!.layers.mask & 1) !== 0;

    library.onLoad = (slug) => {
        const model = library.get(slug);
        if (model?.behaviour?.plan) {
            for (const entry of entries) {
                if (entry.animal.model_slug !== slug) continue;
                const body = arkBody(entry.animal, model.behaviour.plan);
                // (Its sex's size, as when it arrived: `sexLook`.)
                entry.length = body.display * sexScale(entry.animal);
                entry.full = body.display * sexScale(entry.animal);
                entry.trueLength = body.metres;
                entry.floor = body.floor;
                ownSize(entry);
            }
        }
    };

    // MARK: Per frame

    const frustum = new Frustum();
    const projection = new Matrix4();
    const sphere = new Sphere();
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const euler = new Euler(0, 0, 0, "YXZ");
    const scale = new Vector3();
    const position = new Vector3();
    const basisX = new Vector3();
    const basisY = new Vector3();
    const basisZ = new Vector3();
    const basisMatrix = new Matrix4();
    let counts = {near: 0, far: 0, token: 0, herdFigures: 0, herdSpecks: 0, rigged: 0, restingFigures: 0, restingSpecks: 0};
    const DIM_SPECK = new Color("#cfc3ad");

    /** A herd this frame: how many members are drawn (nearest first), how many of them as models. */
    type HerdPlan = {slug: string; order: Uint32Array; members: HerdDraw["members"]; figureMatrices: Float32Array; speckMatrices: Float32Array; colour: Color | null; drawn: number; figures: number; width: number; depth: number; herd: HerdDraw | FigureGroup; shape: SpeckShape; /** The nearest this many are not drawn (`restingSpecks`). */ hidden?: number};
    const herdSphere = new Sphere();
    const herdPosition = new Vector3();
    const herdRotation = new Quaternion();
    const herdScale = new Vector3();
    const herdMatrix = new Matrix4();
    const up = new Vector3(0, 1, 0);

    /**
     * Which of each herd's members are drawn this frame and how (A14): every
     * one in view; the nearest, up to the tier's budget and while bigger than
     * a few pixels, as the far model standing still; the rest as specks. The
     * matrices are worked out again only when the drawn scale changes.
     */
    const restingPoint = new Vector3();
    /**
     * Lane TB: a resting kind with no far model in yet: its members as specks, sized and shaped from its measured model.
     * `pending` (animal rendering lane): its model has been asked for (it is one of the kinds drawn as models): its
     * members big on screen wait for it unseen. On a slow link the yards stood full of clay figures for seconds as the
     * reader zoomed in; an animal that arrives a moment later reads better than a dummy that turns into one.
     */
    const restingSpecks = (group: FigureGroup, cameraPosition: Vector3, now: number, pending: boolean): HerdPlan | null => {
        const measured = modelBase(group.slug);
        if (!measured) return null;
        herdSphere.center.set(group.centre.x, 0, group.centre.z);
        herdSphere.radius = group.radius + group.length * 2 + 4;
        if (!frustum.intersectsSphere(herdSphere)) return null;
        const s = group.length / Math.max(bodyAxisExtent(group.slug, measured.plan, measured.size), 0.05);
        const tall = measured.size.y * s;
        const width = measured.size.x * s;
        const depth = measured.size.z * s;
        const shape: SpeckShape = measured.plan === "mammal" || measured.plan === "reptile" || !measured.plan ? "four-legged" : "oval";
        if (group.scale !== -s) {
            // (A negative scale: worked out without the model; the model's arrival works them out again.)
            group.scale = -s;
            group.height = tall;
            group.members.forEach((member, i) => {
                const base = island?.figureBase(member.id, member.x, member.z, member.ground, tall) ?? member.ground;
                herdRotation.setFromAxisAngle(up, member.yaw);
                if (shape === "oval") {
                    herdPosition.set(member.x, base + tall * 0.2, member.z);
                    herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.7, tall * 0.6, depth * 0.85));
                } else {
                    herdPosition.set(member.x, base, member.z);
                    herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.9, tall * 0.95, depth * 0.95));
                }
                herdMatrix.toArray(group.speckMatrices, i * 16);
            });
        }
        if (group.sortedFrom.distanceToSquared(cameraPosition) > 4 || now - group.sortedAt > 0.5) {
            group.sortedFrom.copy(cameraPosition);
            group.sortedAt = now;
            const d = new Float32Array(group.members.length);
            group.members.forEach((m, i) => {
                d[i] = (m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2;
            });
            group.order.sort((a, b) => d[a] - d[b]);
        }
        let drawn = 0;
        for (let k = 0; k < group.order.length; k++) {
            const m = group.members[group.order[k]];
            if ((m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2 > RESTING_DRAW_WITHIN ** 2) break;
            drawn++;
        }
        // (Nearest first, so the ones big on screen lead the order.)
        let hidden = 0;
        if (!pending) group.waitFrom = undefined;
        else group.waitFrom ??= now;
        if (pending && now - (group.waitFrom ?? now) < RESTING_WAIT_SECONDS) {
            const perPixelNow = 2 * Math.tan(FOV * Math.PI / 360) / height;
            for (; hidden < drawn; hidden++) {
                const m = group.members[group.order[hidden]];
                const distance = Math.hypot(m.x - cameraPosition.x, Math.max(m.ground, 0) - cameraPosition.y, m.z - cameraPosition.z);
                if (group.length / (perPixelNow * Math.max(distance, 0.01)) < HERD_SPECK_BELOW_PIXELS * RESTING_BIG_FAR) break;
            }
        }
        group.figures = 0;
        group.specks = drawn - hidden;
        group.hidden = hidden;
        // p4 (zoolive): a speck drawn is tapped like a figure (`tap-pick.ts`): its middle. They were left unset, so on a
        // phone (8 kinds as models) most of a zoo's resting kinds stood as specks no tap could select.
        for (let k = hidden; k < drawn; k++) {
            const i = group.order[k];
            group.middles[i * 3] = group.members[i].x;
            group.middles[i * 3 + 1] = group.speckMatrices[i * 16 + 13] + tall * (shape === "oval" ? 0.3 : 0.5);
            group.middles[i * 3 + 2] = group.members[i].z;
        }
        const colour = RESTING_SPECK_COLOURS[measured.plan ?? ""] ?? RESTING_SPECK_COLOURS[""];
        return {slug: group.slug, order: group.order, members: group.members, figureMatrices: group.figureMatrices, speckMatrices: group.speckMatrices, colour, drawn, figures: 0, width, depth, herd: group, shape, hidden};
    };

    const planHerds = (cameraPosition: Vector3, exaggerate: number, now: number): HerdPlan[] => {
        const plans: HerdPlan[] = [];
        if (!herds.length && !restingGroups.length) return plans;
        const budgetTier: QualityTier = liteOn() ? "low" : tier;
        let herdBudget: number = HERD_FIGURE_BUDGET[budgetTier];
        // (Lane TB: the town's resting kept animals have a figure budget of their own, so a wild herd never takes it.)
        let restingBudget: number = RESTING_FIGURE_BUDGET[budgetTier];
        let restingAsks = 0;
        // (Development: `window.__arkRestingOff = true` draws no resting figures, to compare against.)
        const restingOff = process.env.NODE_ENV !== "production" && (globalThis as {__arkRestingOff?: boolean}).__arkRestingOff === true;
        const groups: Array<HerdDraw | FigureGroup> = restingGroups.length && !restingOff ? [...herds, ...restingGroups] : herds;
        // (Lane TB: only the resting kinds nearest the camera are drawn as their models: a draw call and a far model each;
        // every other resting animal in reach is a speck, one mesh for all.)
        const figureKinds = new Set<string>();
        /** The resting kinds in the order they take the figure budget: the kinds drawn as models first, nearest first. */
        let restingOrdered = restingGroups;
        if (!restingOff && restingGroups.length) {
            const nearest: Array<[string, number, boolean]> = [];
            const perPixelNow = 2 * Math.tan(FOV * Math.PI / 360) / height;
            let bigKinds = 0;
            for (const group of restingGroups) {
                group.figures = 0;
                group.specks = 0;
                group.hidden = 0;
                // (Its nearest member in view: a kind behind the camera never takes a model's place.)
                let d = Infinity;
                // (And whether that member is big on screen: then a speck would be a generic figure in plain sight.)
                let big = false;
                const sizeUp = 1 + (exaggerate - 1) * Math.min(Math.max(1.6 / group.length, 0.25), 1);
                for (const m of group.members) {
                    const dm = (m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2;
                    if (dm >= d || dm > RESTING_DRAW_WITHIN ** 2) continue;
                    restingPoint.set(m.x, Math.max(m.ground, 0) + group.height * 0.5, m.z);
                    if (!frustum.containsPoint(restingPoint)) continue;
                    const pixels = group.length * sizeUp / (perPixelNow * Math.max(cameraPosition.distanceTo(restingPoint), 0.01));
                    // (Past the loading reach only a kind several times the speck size on screen counts at all.)
                    if (dm > RESTING_LOAD_WITHIN ** 2 && pixels < HERD_SPECK_BELOW_PIXELS * RESTING_BIG_FAR) continue;
                    d = dm;
                    big = pixels >= HERD_SPECK_BELOW_PIXELS;
                }
                if (d < Infinity) {
                    nearest.push([group.slug, d, big]);
                    if (big) bigKinds++;
                }
            }
            // The kinds big on screen first, then the nearest: the first get their models whatever the usual count.
            nearest.sort((a, b) => Number(b[2]) - Number(a[2]) || a[1] - b[1]);
            const kindRank = new Map<string, number>();
            for (const [slug, d] of nearest.slice(0, Math.max(RESTING_FIGURE_KINDS[budgetTier], Math.min(bigKinds, RESTING_FIGURE_KINDS_BIG[budgetTier])))) {
                kindRank.set(slug, figureKinds.size);
                figureKinds.add(slug);
                // (Ranked for loading as a kind seen this frame at its nearest resting member's distance.)
                runtime.see(slug, Math.sqrt(d), true);
            }
            // (The figure budget in that order too: it was spent in the snapshot's order, so a kind across the town
            // could take the figures of the one in front of the camera.)
            if (figureKinds.size) restingOrdered = restingGroups.slice().sort((a, b) => (kindRank.get(a.slug) ?? 1e9) - (kindRank.get(b.slug) ?? 1e9));
        }
        for (const herd of restingOrdered === restingGroups ? groups : [...herds, ...restingOrdered]) {
            const resting = "resting" in herd;
            let budget = resting ? (figureKinds.has(herd.slug) ? restingBudget : 0) : herdBudget;
            herd.middles.fill(Number.NaN);
            const model = library.get(herd.slug);
            const far = model?.far;
            if (!model || !far) {
                if (!resting) continue;
                // (A resting kind's far model is asked for once it is among the nearest in view: a few kinds a frame.)
                if (figureKinds.has(herd.slug) && restingAsks < 4 && library.has(herd.slug)) {
                    library.request(herd.slug, "far");
                    restingAsks++;
                }
                // Meanwhile (and for every kind past the nearest) a speck its size and shape, from its measured model.
                const plan = restingSpecks(herd as FigureGroup, cameraPosition, now, figureKinds.has(herd.slug));
                if (plan) plans.push(plan);
                continue;
            }
            if (resting) herd.waitFrom = undefined;
            herdSphere.center.set(herd.centre.x, 0, herd.centre.z);
            herdSphere.radius = herd.radius + herd.length * 2 + 4;
            if (!frustum.intersectsSphere(herdSphere)) continue;
            const body = arkBody(herd.sample, model.behaviour?.plan);
            // Part B: a herd wholly past the render distance is not drawn (its badge and count stay: they are data), unless
            // the map view sees its members big on screen (true scale: elephants across the island).
            if (!streamer.allIn) {
                // Past the render distance (map style) its figures only while big on screen; past the map distance none.
                const state = streamer.stateAt(herdSphere.center.x, herdSphere.center.z);
                const beyond = Math.max(cameraPosition.distanceTo(herdSphere.center) - herdSphere.radius, 0);
                if (state === STATE_OUT || (state === STATE_MAP && !keepsModelBeyond(body.display, beyond, height, FOV))) continue;
            }
            herd.length = body.display;
            const sizeUp = 1 + (exaggerate - 1) * Math.min(Math.max(1.6 / herd.length, 0.25), 1);
            const modelScale = herd.length / model.bodyLength;
            const s = modelScale * sizeUp;
            const tall = model.height * s;
            herd.height = tall;
            const box = far.geometry.boundingBox!;
            const width = (box.max.x - box.min.x) * s;
            const depth = model.length * s;
            const plan = model.behaviour?.plan ?? "";
            const swims = SWIMMING_PLANS.has(plan);
            // A water species' herd (a school): each in its band, under the surface (`sea-depth.ts`).
            const herdDepth = speciesDepth(herd.slug, herd.sample.zone);
            const shape: SpeckShape = !swims && (plan === "mammal" || plan === "reptile" || plan === "" || model.placeholder) ? "four-legged" : "oval";
            if (Math.abs(s - herd.scale) > herd.scale * 0.004) {
                herd.scale = s;
                herd.members.forEach((member, i) => {
                    // Standing (or floating, a swimmer at sea) still at its own place, as the server placed it.
                    let base = member.ground;
                    // One depth for the whole school (the herd's own seed), each spread on its own spot: level, side by side.
                    if (herdDepth) base = fitInWater(waterSpec(herdDepth, heightAt(member.x, member.z), depthSeed(herd.slug), 0, 0, waterSurfaceAt(member.x, member.z)), tall).base;
                    else if (member.water && member.ground < -0.45) base = -(swims ? 0.5 : 0.28) * tall;
                    else if (member.water) base = Math.max(member.ground, -0.3);
                    herdRotation.setFromAxisAngle(up, member.yaw);
                    // (Lane TB: a town member on its own island's ground: its drawn ground, its tank's water, its cage's tray.)
                    const townBase = island && island.contains(member.x, member.z) ? island.figureBase(member.id, member.x, member.z, member.ground, tall) : null;
                    if (townBase !== null) base = townBase;
                    // p3 (zoofix): a floater on the town's water at its float line (`water-float.ts`), not on the surface or the bed.
                    const afloat = townBase !== null ? floatOver(swimDepth(herd.slug, herd.sample.zone), heightAt(member.x, member.z), waterTopAt(member.x, member.z), tall)?.base ?? null : null;
                    if (afloat !== null) base = afloat;
                    // (Grounding: on land, the far level's true base on the drawn ground.)
                    const onLand = !herdDepth && !member.water && groundingRules() === "grounded";
                    herdPosition.set(member.x, afloat !== null ? afloat - model.minY * s : townBase !== null ? townBase - groundedLevelBase(herd.slug, "far", model.minY) * s : onLand ? drawnGroundHeight(member.x, member.z) - groundedLevelBase(herd.slug, "far", model.minY) * s : base - model.minY * s, member.z);
                    herdMatrix.compose(herdPosition, herdRotation, herdScale.set(s, s, s));
                    herdMatrix.toArray(herd.figureMatrices, i * 16);
                    // The speck: a generic figure the member's size (a four-legged one, or an oval on a bird or a swimmer's body).
                    if (shape === "oval") {
                        herdPosition.set(member.x, base + tall * 0.2, member.z);
                        herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.7, tall * 0.6, depth * 0.85));
                    } else {
                        herdPosition.set(member.x, base, member.z);
                        herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.9, tall * 0.95, depth * 0.95));
                    }
                    herdMatrix.toArray(herd.speckMatrices, i * 16);
                });
            }
            // Nearest first: sorted again when the camera has moved, or a while has passed.
            if (herd.sortedFrom.distanceToSquared(cameraPosition) > 4 || now - herd.sortedAt > 0.5) {
                herd.sortedFrom.copy(cameraPosition);
                herd.sortedAt = now;
                const d = new Float32Array(herd.members.length);
                herd.members.forEach((m, i) => {
                    d[i] = (m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2 + (Math.max(m.ground, 0) - cameraPosition.y) ** 2;
                });
                herd.order.sort((a, b) => d[a] - d[b]);
            }
            const perPixelAt = 2 * Math.tan(FOV * Math.PI / 360) / height;
            let figures = 0;
            for (let k = 0; k < herd.order.length; k++) {
                const m = herd.members[herd.order[k]];
                const distance = Math.hypot(m.x - cameraPosition.x, Math.max(m.ground, 0) - cameraPosition.y, m.z - cameraPosition.z);
                if (figures === k && budget > 0 && herd.length * sizeUp / (perPixelAt * distance) >= HERD_SPECK_BELOW_PIXELS) {
                    figures++;
                    budget--;
                }
                if (resting && distance > RESTING_DRAW_WITHIN) break;
                const i = herd.order[k];
                herd.middles[i * 3] = m.x;
                herd.middles[i * 3 + 1] = herd.figureMatrices[i * 16 + 13] + tall * 0.5 + model.minY * s;
                herd.middles[i * 3 + 2] = m.z;
            }
            // (A resting kind past the nearest had no budget of its own: the shared one stays as it was.)
            if (resting) {
                if (figureKinds.has(herd.slug)) restingBudget = budget;
            } else herdBudget = budget;
            // (A resting kind: only its members within reach are drawn at all, nearest first.)
            let drawn = herd.members.length;
            if (resting) {
                drawn = 0;
                for (let k = 0; k < herd.order.length; k++) {
                    const m = herd.members[herd.order[k]];
                    if ((m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2 > RESTING_DRAW_WITHIN ** 2) break;
                    drawn++;
                }
                figures = Math.min(figures, drawn);
            }
            herd.figures = figures;
            herd.specks = drawn - figures;
            plans.push({slug: herd.slug, order: herd.order, members: herd.members, figureMatrices: herd.figureMatrices, speckMatrices: herd.speckMatrices, colour: herd.colour, drawn, figures, width, depth, herd, shape});
        }
        return plans;
    };

    /** Where an animal is this moment: its spot, or its loop in the water, or its circle in the sky. */
    type Pose = {
        x: number; z: number; base: number; yaw: number; pitch: number; roll: number; afloat: boolean; surface?: SurfacePoint;
        /** In the water: where in its column, fitted again to the height it is drawn at. */
        water?: WaterSpec;
        /** A school's member: its first one's point, which its offset is scaled about at the size it is drawn (so a school drawn larger from afar spreads with it). */
        school?: {x: number; z: number};
        /**
         * Lane MA3: on its way into the water or out of it (the schedule's slide in or climb out): how far along (`u`), its
         * feet's height on the bank (`stand`), its band in the water there (`spec`), and how far it has settled to its float
         * line (`k`, 0 standing, 1 afloat). The base is blended again at the height it is drawn at, as `water` is.
         */
        edge?: {mode: "enter" | "exit"; u: number; k: number; stand: number; spec: WaterSpec};
        /** Lane MA3: over water with no band (a heron in the shallows): standing on the bed, never on the surface. */
        wading?: boolean;
        /** Lane MA3: under the surface in a recipe's act of its own (a coot's, a cormorant's dive): it swims there, never walks. */
        underwater?: boolean;
    };

    /**
     * A small animal on its surface: it crawls slowly to and fro along it (its
     * rig's walk or climb close by, a glide otherwise), turning
     * round in the pauses; asleep it keeps still. A moth at the cottage
     * circles the porch light at night, while it is awake.
     */
    /**
     * A small animal's crawl while its rig is in: along its surface at its
     * walk's (or climb's) ground speed, so its feet stay planted, out to its
     * reach and back, turning round in the pauses. It starts where the
     * procedural crawl had it, and keeps its own state once begun (so the
     * rig going again never makes it jump). Null: the procedural crawl.
     */
    const crawlStep = (entry: Entry, reach: number, along: number, turn: number): {along: number; turn: number} | null => {
        const slug = entry.animal.model_slug;
        const model = library.get(slug);
        const clip = rigs.clip(slug, "walk") ?? rigs.clip(slug, "climb");
        const rigIn = Boolean(entry.rigOn) && (entry.rig?.weight ?? 0) >= 0.999 && clip?.ground_speed && model;
        if (!entry.crawl) {
            if (!rigIn) return null;
            entry.crawl = {along, dir: turn > Math.PI / 2 ? -1 : 1, pause: 0, turn, speed: 0};
        }
        const crawl = entry.crawl;
        if (rigIn) crawl.speed = clip!.ground_speed! * (entry.length / model!.bodyLength);
        // (REAL-REPRODUCTION: a creeper at its own centimetres a minute, its clip slowed to match.)
        const creep = behaviourProfile(entry.animal.model_slug).creep;
        if (creep) crawl.speed = Math.min(crawl.speed, creep);
        const dt = frameDt;
        const moving = entry.state.kind === "awake" && crawl.speed > 0;
        if (crawl.pause > 0 || !moving) {
            crawl.pause = Math.max(crawl.pause - dt, 0);
        } else {
            crawl.along += crawl.dir * crawl.speed * dt;
            if (crawl.along >= reach || crawl.along <= 0) {
                crawl.along = Math.min(Math.max(crawl.along, 0), reach);
                crawl.dir = crawl.along >= reach ? -1 : 1;
                crawl.pause = 2 + 4 * wanderRandom(entry, crawl.along + crawl.turn);
            }
        }
        // Facing the way it goes: round in the pause (the procedural turn's half-turn about the surface's normal).
        const want = crawl.dir < 0 ? Math.PI : 0;
        crawl.turn += Math.min(Math.max(want - crawl.turn, -2.5 * dt), 2.5 * dt);
        return {along: crawl.along, turn: crawl.turn};
    };

    const microPose = (entry: Entry, time: number): Pose => {
        // ARK-WEBS: a web spinner on its web, once its web is hung.
        const web = webPoseOf(entry);
        if (web) return {x: web.x, z: web.z, base: web.y, yaw: Math.atan2(web.tx, web.tz), pitch: 0, roll: 0, afloat: true, surface: web};
        const place = entry.place;
        const micro = place.micro!;
        const surface = micro.surface;
        const L = entry.trueLength;
        const reach = surface === "around" || surface === "roof" ? 0 : surface === "water" ? 0.2 : surface === "flower" ? Math.min(0.02, 2 * L) : Math.min(Math.max(5 * L, 0.03), 0.35);
        // (REAL-REPRODUCTION: a creeper, a snail or a slug, goes out and back at its own centimetres a minute.)
        const creep = behaviourProfile(entry.animal.model_slug).creep;
        const period = creep && reach ? Math.max(11 + 9 * entry.phase, (reach * 2) / 0.64 / creep) : 11 + 9 * entry.phase;
        const u = (((time / period + entry.phase) % 1) + 1) % 1;
        // Out (0–0.32), a pause, back (0.5–0.82), a pause; the turn round in each pause.
        const out = u < 0.32 ? easeInOut(u / 0.32) : u < 0.5 ? 1 : u < 0.82 ? 1 - easeInOut((u - 0.5) / 0.32) : 0;
        const awake = 1 - entry.rest;
        let along = reducedMotion ? 0 : reach * out * awake;
        let turn = reducedMotion || !reach ? 0 : Math.PI * smoothTurn(u) * awake;
        // Its rig in (close by): it crawls at its walk's own ground speed (feet planted), out and back with pauses.
        const crawled = reach && !reducedMotion ? crawlStep(entry, reach, along, turn) : null;
        if (crawled) {
            along = crawled.along;
            turn = crawled.turn;
        }
        const point = surfacePoint(micro, entry.animal.zone, along);
        // On a leaf, bark or a branch of a tree in the wind: moved with it as the tree's shader moves it (graphics' `attachSway`).
        const swaying = micro.attach?.source;
        if (swaying && !reducedMotion) {
            const sway = attachSway(swaying, ARK_TIME.value, ARK_WIND_VECTOR.value);
            point.x += sway.x;
            point.y += sway.y;
            point.z += sway.z;
        }
        if (turn) {
            // Turn the heading about the normal: t cos + (n × t) sin.
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const bx = point.ny * point.tz - point.nz * point.ty;
            const by = point.nz * point.tx - point.nx * point.tz;
            const bz = point.nx * point.ty - point.ny * point.tx;
            point.tx = point.tx * c + bx * sn;
            point.ty = point.ty * c + by * sn;
            point.tz = point.tz * c + bz * sn;
        }
        // p3 (trees): a small ground insect climbs its blade now and then (a pure rule in its id and the clock).
        // (Decided once its model's behaviour has loaded: its body plan says whether it climbs.)
        const plan = entry.climb === undefined ? library.get(entry.animal.model_slug)?.behaviour?.plan : undefined;
        if (plan !== undefined) {
            const home = surfacePoint(micro, entry.animal.zone, 0);
            entry.climb = climbsBlades(entry.animal.model_slug, surface, plan, L, micro.attach?.tag) ? climbStem(entry.animal.id, home, bugCoverAt(home.x, home.z), L) : null;
        }
        if (entry.climb && !reducedMotion) {
            climbStems.note(entry.climb);
            const climb = climbAt(entry.animal.id, time);
            // (ARK-CONTACT: only up a blade that is drawn: `ClimbStems.shown`.)
            if (climb.on > 0 && climbStems.shown(entry.climb)) {
                Object.assign(climbGround, point);
                const mixed = mixClimb(climbGround, climbPoint(entry.climb, climb.up, climb.turn, climbBlade), climb.on, climbBlade);
                Object.assign(point, mixed);
            }
        }
        const k = entry.toLight ?? 0;
        if (k > 0.001) {
            // Round the porch light: a loose, wobbling loop, each moth its own.
            const radius = 0.16 + entry.phase * 0.32;
            const angle = time * (1.6 + entry.phase * 1.4) * (entry.phase > 0.5 ? 1 : -1) + entry.phase * 40;
            const light = nightLight(micro, entry.animal.zone);
            // Round a lamp post's lamp all the way; round the porch light in front of the wall.
            const flat = micro.spot === "lamp" ? 1 : 0.7;
            const lx = light.x + light.out.x + Math.cos(angle) * radius;
            const lz = light.z + light.out.z + Math.sin(angle) * radius * flat;
            const ly = light.y - 0.05 + Math.sin(time * 3.1 + entry.phase * 17) * 0.09;
            const e = easeInOut(k);
            const direction = entry.phase > 0.5 ? 1 : -1;
            const tx = -Math.sin(angle) * direction;
            const tz = Math.cos(angle) * direction * 0.7;
            const length = Math.hypot(tx, tz) || 1;
            // The wall's normal swings round to up as it takes off.
            const nx = point.nx * (1 - e);
            const ny = point.ny * (1 - e) + e;
            const nz = point.nz * (1 - e);
            const nl = Math.hypot(nx, ny, nz) || 1;
            const surfaceNow: SurfacePoint = {
                x: point.x + (lx - point.x) * e,
                y: point.y + (ly - point.y) * e,
                z: point.z + (lz - point.z) * e,
                nx: nx / nl,
                ny: ny / nl,
                nz: nz / nl,
                tx: point.tx * (1 - e) + (tx / length) * e,
                ty: point.ty * (1 - e),
                tz: point.tz * (1 - e) + (tz / length) * e
            };
            return {x: surfaceNow.x, z: surfaceNow.z, base: surfaceNow.y, yaw: Math.atan2(surfaceNow.tx, surfaceNow.tz), pitch: 0, roll: 0, afloat: true, surface: surfaceNow};
        }
        return {x: point.x, z: point.z, base: point.y, yaw: Math.atan2(point.tx, point.tz), pitch: 0, roll: 0, afloat: true, surface: point};
    };
    const nearestCloud = (x: number, z: number) => PLANKTON.reduce((best, cloud) => (Math.hypot(cloud.x - x, cloud.z - z) < Math.hypot(best.x - x, best.z - z) ? cloud : best), PLANKTON[0]);

    /**
     * A canopy animal on its tree: a percher sits still on its limb or the
     * crown; a climber crawls to and fro along its limb or up and down the
     * trunk; a leaper leaps to the next limb now and then and back; a hanger
     * hangs under its limb, swaying a little. Close by, a rig that has them
     * climbs, leaps, hangs and perches with its own clips (`rigFor`).
     */
    const canopyPose = (entry: Entry, time: number): Pose => {
        const place = entry.place.canopy!;
        const zone = entry.animal.zone;
        const awake = 1 - entry.rest;
        const period = 13 + 9 * entry.phase;
        const u = (((time / period + entry.phase) % 1) + 1) % 1;
        const reach = place.mode === "climb" ? (place.limb === -2 ? 0.7 : 0.45) : 0;
        const out = u < 0.32 ? easeInOut(u / 0.32) : u < 0.5 ? 1 : u < 0.82 ? 1 - easeInOut((u - 0.5) / 0.32) : 0;
        const point = canopyPoint(zone, place, reach * out * awake);
        if (reach && !reducedMotion) {
            const turn = Math.PI * smoothTurn(u) * awake;
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const bx = point.ny * point.tz - point.nz * point.ty;
            const by = point.nz * point.tx - point.nx * point.tz;
            const bz = point.nx * point.ty - point.ny * point.tx;
            point.tx = point.tx * c + bx * sn;
            point.ty = point.ty * c + by * sn;
            point.tz = point.tz * c + bz * sn;
        }
        if (place.mode === "hang" && !reducedMotion) {
            // A slow sway about the limb.
            const sway = Math.sin(time * 0.55 + entry.phase * 11) * 0.14;
            const c = Math.cos(sway);
            const sn = Math.sin(sway);
            const bx = point.ty * point.nz - point.tz * point.ny;
            const by = point.tz * point.nx - point.tx * point.nz;
            const bz = point.tx * point.ny - point.ty * point.nx;
            point.nx = point.nx * c + bx * sn;
            point.ny = point.ny * c + by * sn;
            point.nz = point.nz * c + bz * sn;
        }
        entry.leapK = 0;
        if (place.mode === "leap" && awake > 0.5 && !reducedMotion) {
            // Over to the next limb (0.42–0.5 of its cycle), a while there, and back (0.92–1).
            const other = canopyPoint(zone, leapTarget(place), 0);
            const there = u >= 0.5 && u < 0.92;
            const k = u >= 0.42 && u < 0.5 ? easeInOut((u - 0.42) / 0.08) : u >= 0.92 ? 1 - easeInOut((u - 0.92) / 0.08) : there ? 1 : 0;
            if (k > 0) {
                const flying = k < 1;
                entry.leapK = flying ? k : 0;
                // A rig's leap carries its own rise: the path's arc gives way to it.
                const rigLeap = entry.rig && entry.rig.now.name === "leap" ? entry.rig.weight : 0;
                const arc = flying ? Math.sin(Math.PI * k) * 0.9 * (1 - rigLeap) : 0;
                const x = point.x + (other.x - point.x) * k;
                const y = point.y + (other.y - point.y) * k + arc;
                const z = point.z + (other.z - point.z) * k;
                const dx = (other.x - point.x) * (u >= 0.92 ? -1 : 1);
                const dz = (other.z - point.z) * (u >= 0.92 ? -1 : 1);
                const length = Math.hypot(dx, dz) || 1;
                const at = flying ? {x, y, z, nx: 0, ny: 1, nz: 0, tx: dx / length, ty: 0, tz: dz / length} : {...other};
                return {x: at.x, z: at.z, base: at.y, yaw: Math.atan2(at.tx, at.tz), pitch: 0, roll: 0, afloat: true, surface: at};
            }
        }
        return {x: point.x, z: point.z, base: point.y, yaw: Math.atan2(point.tx, point.tz), pitch: 0, roll: 0, afloat: true, surface: point};
    };

    /**
     * An underground animal: in its chamber most of the time (seen only in
     * the cutaway), now and then along its tunnel to the entrance, where it
     * peeks out for a few seconds, and back. Asleep it stays in its chamber.
     */
    const undergroundPose = (entry: Entry, modelHeight: number, time: number): Pose => {
        const burrow = entry.place.burrow!;
        const period = 26 + 14 * entry.phase;
        const u = entry.awake && !reducedMotion ? (((time / period + entry.phase) % 1) + 1) % 1 : 0;
        // Along the tunnel: 1 in the chamber, 0 at the entrance.
        const t = u < 0.45 ? 1 : u < 0.55 ? 1 - easeInOut((u - 0.45) / 0.1) : u < 0.75 ? 0 : u < 0.85 ? easeInOut((u - 0.75) / 0.1) : 1;
        const peeking = u >= 0.55 && u < 0.75;
        entry.peek = peeking ? (u - 0.55) / 0.2 : -1;
        const at = tunnelPoint(burrow, Math.max(t, 0.02));
        const ahead = tunnelPoint(burrow, Math.min(Math.max(t, 0.02) + 0.05, 1));
        const outward = u >= 0.45 && u < 0.75;
        const yaw = Math.atan2((ahead.x - at.x) * (outward ? -1 : 1), (ahead.z - at.z) * (outward ? -1 : 1));
        entry.buried = !peeking;
        if (peeking && entry.rig && entry.rig.weight > 0 && rigs.clip(entry.animal.model_slug, "emerge") && rigs.clip(entry.animal.model_slug, "burrow")) {
            // Its rig's emerge and burrow carry it up out of the ground and back down: at the mouth, at ground level.
            return {x: burrow.x, z: burrow.z, base: burrow.ground, yaw, pitch: 0, roll: 0, afloat: true};
        }
        if (peeking) {
            // Head and shoulders out of the mouth, looking about.
            const rise = Math.sin(Math.PI * Math.min((u - 0.55) / 0.2, 1));
            return {x: burrow.x, z: burrow.z, base: burrow.ground - modelHeight * (0.75 - 0.5 * rise), yaw: yaw + Math.sin(time * 1.3) * 0.5 * rise, pitch: -0.5 * rise, roll: 0, afloat: true};
        }
        return {x: at.x, z: at.z, base: at.y - modelHeight * 0.45, yaw, pitch: 0, roll: 0, afloat: true};
    };

    /** Splashes on the water (a moment's beats), as rings that spread and fade. */
    const ripples: Array<{x: number; z: number; start: number}> = [];

    /** A cross-layer moment's pose (cosmetic), or null once it is over. */
    const momentAt = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose | null => {
        const moment = entry.moment!;
        const u = (time - moment.start) / MOMENT_SECONDS[moment.kind];
        if (u >= 1 || u < 0) {
            entry.moment = null;
            return null;
        }
        if (!moment.from) {
            // Where it is as the moment begins.
            entry.moment = null;
            const start = pose(entry, model, modelHeight, time);
            entry.moment = moment;
            moment.from = {x: start.x, y: start.base, z: start.z, yaw: start.yaw};
            moment.beats = momentBeats(moment.kind, moment.from, entry.length);
        }
        const at = momentPose(moment.kind, moment.from, u, entry.length);
        const due = moment.beats.filter((beat) => beat.at <= u);
        if (due.length) {
            moment.beats = moment.beats.filter((beat) => beat.at > u);
            const now = performance.now() / 1000;
            for (const beat of due) {
                for (let k = 0; k < (beat.kind === "blow" ? 7 : 4); k++) {
                    dust.add({x: beat.x + (k % 2 ? 1 : -1) * k * 0.08, y: beat.y + (beat.kind === "blow" ? k * 0.4 : 0.05), z: beat.z, size: beat.kind === "blow" ? 0.8 + k * 0.25 : 0.6, kind: "bubble"}, now);
                }
                ripples.push({x: beat.x, z: beat.z, start: time});
            }
        }
        return {x: at.x, z: at.z, base: at.y, yaw: at.yaw, pitch: at.pitch, roll: at.roll, afloat: at.afloat};
    };

    /**
     * Close to the camera (visual only, from what is drawn): animals on the ground don't stand inside each other (each
     * is pushed half the overlap apart), and prey turns its head to a predator passing within a few metres. Nothing
     * here changes a schedule; it only nudges what is drawn this frame.
     */
    /**
     * A burrow or den sleeper goes in to sleep or rest (its schedule's roost is the way in: `goesIntoRoost`), down
     * the hole over 1.6 s once it is settled there, and comes out as it sets off (shared: its trip and pose). Looked at
     * or followed, it stays half in at the way in.
     */
    const stepDen = (entry: Entry, dt: number) => {
        const own = entry.sched;
        const trip = own?.trip;
        const at = own?.pose;
        let want = 0;
        if (own && trip && at && scheduled(entry) && !entry.reactive?.woke && goesIntoRoost(trip.to.point, own.profile.roost)) {
            const settled = trip.doing === "sleep" || trip.doing === "rest" || trip.doing === "to_roost";
            if (settled && !at.moving && Math.hypot(at.x - trip.to.x, at.z - trip.to.z) < Math.max(entry.length * 2, 1.5)) want = 1;
        }
        if (want && (selectedId === entry.animal.id || followId === entry.animal.id)) want = 0.55;
        const now = entry.denIn ?? 0;
        if (!want && !now) return;
        entry.denIn = reducedMotion || snapNow ? want : now + Math.max(Math.min(want - now, dt / 1.6), -dt / 1.2);
    };

    /** Sleeping together (`sleep.ts` social: a huddle, a pile, a row, a cluster; a young mammal against the adult): bodies may touch. */
    const sleepsTouching = (a: Entry, b: Entry) =>
        (a.sleepNow?.t ?? 0) > 0.5 && (b.sleepNow?.t ?? 0) > 0.5 && a.animal.model_slug === b.animal.model_slug && (sleepStyle(a.animal.model_slug).social !== "apart" || Boolean(a.sched?.animal.young || b.sched?.animal.young));

    const keepApart = (list: Array<{entry: Entry; distance: number; visible: boolean; pose: Pose}>, dt: number) => {
        // ARK-CONTACT (decision 447, "the giraffes in their enclosure glitch positions as I zoom in and out"): who is eased
        // apart is chosen by the distance from the point the view looks at, not from the camera: zooming moves the camera
        // along its line to that point, so the same animals are pushed apart at every zoom (by the camera's distance a
        // herd crossing 45 m snapped back together and apart again, a metre for a giraffe).
        const tx = controls.target.x;
        const tz = controls.target.z;
        const focus = (c: {pose: Pose}) => Math.hypot(c.pose.x - tx, c.pose.z - tz);
        // (In view or not: one just off the screen's edge still holds its neighbour where it was pushed.)
        const near = list.filter((c) => c.entry.sched && scheduled(c.entry) && focus(c) < 45 && !c.entry.sched.pose?.aloft && !c.entry.riding).sort((a, b) => focus(a) - focus(b)).slice(0, 80);
        // Animals in an act (a birth, a mating, a contest, a meal) stand where the act has them: the others give them room.
        const acting = list.filter((c) => focus(c) < 45 && c.entry.act && !c.entry.act.hidden && !c.entry.act.role);
        // ARK-CONTACT round 4 (the owner's giraffes "jumping", most under load): the push apart was put on in full each
        // frame. One giraffe running past another standing slid the standing one sideways at the runner's 5 m/s, its
        // schedule still, and a long frame made that slide one step of half a metre. Now each frame's push is what it
        // wants; what it gets moves toward that at a walk (`APART_PACE`), and back to nothing when it is clear.
        const wanted = new Map<Entry, {x: number; z: number}>();
        const want = (e: Entry, x: number, z: number) => {
            const w = wanted.get(e);
            if (w) {
                w.x += x;
                w.z += z;
            } else wanted.set(e, {x, z});
        };
        for (let i = 0; i < near.length; i++) {
            const a = near[i];
            const pa = a.entry.sched!.profile;
            let look: number | null = null;
            for (const f of acting) {
                const dx = a.pose.x - f.entry.act!.x;
                const dz = a.pose.z - f.entry.act!.z;
                const d = Math.hypot(dx, dz);
                const room = (a.entry.length + f.entry.length) * 0.55;
                if (d >= room) continue;
                const onGround = Math.abs(a.pose.base - Math.max(heightAt(a.pose.x, a.pose.z), 0)) < 0.05;
                // (Straight off it; one standing exactly on it steps off along its own heading.)
                const ux = d > 1e-4 ? dx / d : Math.sin(a.pose.yaw);
                const uz = d > 1e-4 ? dz / d : Math.cos(a.pose.yaw);
                // (Off an act at once, as before: the act's spot is where it is, not a neighbour going by.)
                a.pose.x += ux * (room - d);
                a.pose.z += uz * (room - d);
                if (onGround) a.pose.base = Math.max(heightAt(a.pose.x, a.pose.z), 0);
            }
            for (let j = 0; j < near.length; j++) {
                if (i === j) continue;
                const b = near[j];
                const dx = b.pose.x - a.pose.x;
                const dz = b.pose.z - a.pose.z;
                const d = Math.hypot(dx, dz);
                const room = (a.entry.length + b.entry.length) * 0.42 * (sleepsTouching(a.entry, b.entry) ? 0.45 : 1);
                if (j > i && d < room && d > 1e-4) {
                    const push = (room - d) / 2;
                    want(a.entry, (-dx / d) * push, (-dz / d) * push);
                    want(b.entry, (dx / d) * push, (dz / d) * push);
                }
                // A predator (a meat or fish eater bigger than it) moving within 6 m: it looks.
                const pb = b.entry.sched!.profile;
                const hunter = (pb.diet === "meat" || pb.diet === "fish") && (pb.size ?? 0) > (pa.size ?? 0) && b.entry.sched!.pose?.moving;
                // (The reactive layer, when on, does this with the head and its whole reaction instead.)
                if (hunter && !a.entry.reactive && pa.diet !== "meat" && d < 6 && !a.entry.sched!.pose?.moving && a.entry.awake) look = Math.atan2(dx, dz) - a.pose.yaw;
            }
            while (look !== null && look > Math.PI) look -= Math.PI * 2;
            while (look !== null && look < -Math.PI) look += Math.PI * 2;
            const turnTo = look === null ? 0 : Math.max(Math.min(look, 1.2), -1.2);
            a.entry.glance = (a.entry.glance ?? 0) + (turnTo - (a.entry.glance ?? 0)) * Math.min(dt * 3, 1);
        }
        // The pushes, eased (and those pushed before, now clear or out of the set, eased back).
        for (const c of list) {
            const e = c.entry;
            const w = wanted.get(e);
            if (!w && !e.apart) continue;
            const at = (e.apart ??= {x: 0, z: 0});
            const tx = w?.x ?? 0;
            const tz = w?.z ?? 0;
            const gx = tx - at.x;
            const gz = tz - at.z;
            const gap = Math.hypot(gx, gz);
            const most = Math.min(Math.max(e.length * 0.5, 0.4), 2) * Math.min(Math.max(dt, 0), 0.1);
            if (gap <= most || reducedMotion) {
                at.x = tx;
                at.z = tz;
            } else {
                at.x += (gx / gap) * most;
                at.z += (gz / gap) * most;
            }
            if (!w && Math.hypot(at.x, at.z) < 1e-4) {
                e.apart = undefined;
                continue;
            }
            const onGround = Math.abs(c.pose.base - Math.max(heightAt(c.pose.x, c.pose.z), 0)) < 0.05;
            c.pose.x += at.x;
            c.pose.z += at.z;
            if (onGround) c.pose.base = Math.max(heightAt(c.pose.x, c.pose.z), 0);
        }
    };

    /**
     * The local reactive layer (`reactive.ts`), for the animals near the camera within the tier's budget: perception,
     * memory, needs and their choices, the head look; it moves an animal only inside its envelope round where the
     * schedule has it, never wakes a sleeper and leaves acts alone. Its offset and turn go onto what is drawn this frame.
     */
    let reactiveTierNow: ReactiveTier | null = null;
    /** Young (born on the Ark, `ark-age.ts`) keep to their group's adult leader: the scene's parent for shielding. Re-read every 30 s. */
    const youngFor = (e: Entry): {parent: string | null; play: number} => {
        const nowS = worldMs() / 1000;
        if (e.youngOf && nowS - e.youngOf.at < 30) return e.youngOf;
        let parent: string | null = null;
        let play = 0;
        if (e.animal.origin === "born") {
            const age = liveliness.ageOf(e);
            if (age && age.stage === "young") {
                play = age.play;
                // The parent it keeps to in the shared layer (`liveliness-scene.ts`), else its group's adult leader.
                const lead = e.leader;
                if (age.follow || age.carried || age.care !== "none") parent = liveliness.parentOf(e.animal.id) ?? (lead && lead !== e && lead.animal.origin !== "born" ? lead.animal.id : null);
            }
        }
        e.youngOf = {parent, play, at: nowS};
        return e.youngOf;
    };
    /** 3.3 batch (C): a young one's coat steps (`young-coat.ts`): its species' young coat by its age from the record. Re-read every 30 s. */
    const youngCoatSteps = (e: Entry): number => {
        const nowS = worldMs() / 1000;
        if (e.youngCoat && nowS - e.youngCoat.at < 30 && nowS >= e.youngCoat.at) return e.youngCoat.steps;
        const coat = youngCoatOf(e.animal.model_slug);
        const age = coat ? liveliness.ageOf(e) : null;
        e.youngCoat = {steps: youngSteps(youngCoatStrength(coat, e.animal.origin === "born", age ? {ageDays: age.ageDays, growth: age.growth, young: age.stage === "young"} : null)), at: nowS};
        return e.youngCoat.steps;
    };
    /** 3.3 batch (C): its antlers this month of the Ark year (`antler-cycle.ts`), or null for a species without the cycle. Re-read every 30 s. */
    const antlerNow = (e: Entry): AntlerState | null => {
        const spec = antlerOf(e.animal.model_slug);
        if (!spec) return null;
        const nowS = worldMs() / 1000;
        if (e.antler && nowS - e.antler.at < 30 && nowS >= e.antler.at) return e.antler;
        e.antler = {...antlerState(spec, seasonMonthAt(nowS), sexLook(e.animal.id, e.animal.model_slug).sex, e.animal.id), at: nowS};
        return e.antler;
    };
    // ARK-SEAT (the owner, 2026-11-21: "i need guaranteed fixes on animals not properly interacting with their
    // environments from bugs to mammals"): the last pass over every drawn animal: its body's own lowest points on what
    // is drawn under them, whatever kind of thing that is, and out of any rock or wall it is in (`seat/seat.ts`).
    // (`__arkSeatOff = true`: the harness's before picture.)
    const seat = new SeatPass(scene);
    if (process.env.NODE_ENV !== "production") {
        seat.off = (globalThis as {__arkSeatOff?: boolean}).__arkSeatOff === true || new URLSearchParams(window.location.search).get("seat") === "off";
        seat.keepPoints = true;
        (window as unknown as {__arkSeat?: SeatPass}).__arkSeat = seat;
        // The audit's probe (`scripts/ark-seat-audit.mjs`): every drawn animal's body against the scene's own meshes.
        void import("@/ark-scene/seat/audit-probe").then(({SeatProbe}) => {
            const probe = new SeatProbe(scene, (x, z, near) => standGround(x, z, near));
            type Drawn = Parameters<typeof probe.measure>[0];
            const drawnOf = (e: Entry) => (e as Entry & {seatDrawn?: Drawn}).seatDrawn ?? null;
            (window as unknown as {__arkSeatProbe?: unknown}).__arkSeatProbe = {
                begin: () => probe.begin(),
                end: () => probe.end(),
                frame: () => renderer.info.render.frame,
                /** The animals drawn in the last `within` frames as a model (near, far or a rig). */
                drawn: (within = 2) => allEntries().filter((e) => { const d = drawnOf(e); return d !== null && renderer.info.render.frame - d.frame <= within; }).map((e) => { const d = drawnOf(e)!; return {id: e.animal.id, slug: e.animal.model_slug, kind: d.kind, level: d.level, length: e.length, plan: library.get(e.animal.model_slug)?.behaviour?.plan ?? null, x: d.m[12], y: d.m[13], z: d.m[14]}; }),
                measure: (id: string) => { const e = entryById.get(id); const d = e ? drawnOf(e) : null; return d ? {...probe.measure(d), seat: e!.seat ? {x: e!.seat.x, y: e!.seat.y, z: e!.seat.z, gap: e!.seat.gap, on: e!.seat.on, inside: e!.seat.inside, pushes: e!.seat.pushes, stuck: e!.seat.stuck, solved: e!.seat.solved} : null} : null; }
            };
        });
    }
    // ARK-CONTACT (the owner's beetle over a daisy; the leaves left over: shrubs, reeds, trees): the highest drawn plant
    // surface straight under a resting insect's point (`up` over it to `down` under it), any plant the scene draws (the
    // vegetation's instanced shapes, the asset trees, the floor plants), each instance as placed. Kept by the point; at
    // most two new casts a frame (an instanced plant's ray tests every instance), the rest wait a frame.
    const plantKinds = new Set(["acacia", "broadleaf", "cactus", "canopy", "conifer", "flower", "leaf", "lily", "orchard", "palm", "rainforest", "reed", "shrub", "asset-tree", "asset-floor"]);
    let plantMeshes: Object3D[] | null = null;
    let plantMeshesAt = -1;
    const plantCache = new Map<string, number | null>();
    const plantCaster = new Raycaster();
    let plantCastsLeft = 2;
    let plantCastFrame = -1;
    const plantBelow = (x: number, y: number, z: number, up: number, down: number, frame: number, force = false): number | null | undefined => {
        const key = `${Math.round(x * 200)},${Math.round(y * 200)},${Math.round(z * 200)}`;
        const known = plantCache.get(key);
        if (known !== undefined) return known;
        if (frame !== plantCastFrame) {
            plantCastFrame = frame;
            plantCastsLeft = 2;
        }
        if (plantCastsLeft <= 0 && !force) return undefined;
        plantCastsLeft--;
        // (The plant meshes, gathered again every few seconds: the sets load and swap their levels.)
        if (!plantMeshes || frame - plantMeshesAt > 300) {
            plantMeshes = [];
            scene.traverse((o) => {
                if ((o as Mesh).isMesh && plantKinds.has(String(o.userData?.kind ?? ""))) plantMeshes!.push(o);
            });
            plantMeshesAt = frame;
        }
        plantCaster.set(new Vector3(x, y + up, z), new Vector3(0, -1, 0));
        plantCaster.near = 0;
        plantCaster.far = up + down;
        let best: number | null = null;
        for (const mesh of plantMeshes) {
            if (!mesh.visible) continue;
            for (const hit of plantCaster.intersectObject(mesh, false)) if (best === null || hit.point.y > best) best = hit.point.y;
        }
        if (plantCache.size > 4096) plantCache.clear();
        plantCache.set(key, best);
        return best;
    };
    // ARK-CONTACT (the langur in the trunk): how far to draw an animal of `length` held on the tree point `id` from it so
    // its middle is a trunk's radius (at its foot: the widest) and half its length from every trunk's axis there: out along
    // the limb (the point's own way, turned away from the trunk; straight out from the axis on a point with none), 5 cm at
    // a time, up to 2 m, then onto the drawn wood under that place (`plantBelow`). null when it is clear already (or no
    // point); undefined while the wood is still to be cast; `seated` false when no wood was under it (drawn out anyway).
    // Kept per point and length: the points and the trunks stay put.
    // The trunks round a tree point at its height: its own tree's as drawn (`placedTrunk`: the axis leans, the radius
    // tapers, up into the crown), and the trunk colliders near it (other trees; its own when its asset has no fit).
    const trunksAt = (point: AttachPoint, half: number, set: ColliderSet): Array<{cx: number; cz: number; r: number; id: string}> => {
        const at = point.position;
        const out: Array<{cx: number; cz: number; r: number; id: string}> = [];
        const own = point.asset && point.wind ? placedTrunk(point.asset, point.wind) : null;
        if (own) {
            const h = at.y - own.y;
            if (h >= 0 && h <= own.height) out.push({cx: own.x + own.lx * h, cz: own.z + own.lz * h, r: Math.max(own.r0 + own.taper * h, own.r0 * 0.25, 0.02), id: `trunk:${point.host}`});
        }
        for (const c of set.near(at.x, at.z, half + 4, trunkNear.splice(0))) {
            if (c.kind !== "trunk" || c.shape !== "circle" || at.y < c.y0 - 0.2 || at.y > c.y1 + 0.5 || (own && c.id === `trunk:${point.host}`)) continue;
            out.push({cx: c.cx, cz: c.cz, r: c.r, id: c.id});
        }
        return out;
    };
    const TREE_HELD = new Set(["limb", "canopy_perch", "branch", "canopy_climb", "leaf"]);
    const limbClears = new Map<string, {x: number; y: number; z: number; seated: boolean} | null>();
    const trunkNear: Collider[] = [];
    const limbClearOf = (id: string, length: number, frame: number, force: boolean): {x: number; y: number; z: number; seated: boolean} | null | undefined => {
        const key = `${id}|${Math.round(length * 20)}`;
        const known = limbClears.get(key);
        if (known !== undefined) return known;
        const point = attachPoint(id);
        const set = world ? sceneColliders(world, townWorld) : null;
        // (Not bark or a trunk's side: a woodpecker clings along the trunk, its body up it, not out from it.)
        if (!point || !set || !TREE_HELD.has(point.tag) || point.normal.y < 0.5) return null;
        const at = point.position;
        const half = length / 2;
        const trunks = trunksAt(point, half, set);
        const inside = (x: number, z: number) => trunks.find((c) => Math.hypot(x - c.cx, z - c.cz) < c.r + half);
        const first = inside(at.x, at.z);
        if (!first) {
            limbClears.set(key, null);
            return null;
        }
        const out = {x: at.x - first.cx, z: at.z - first.cz};
        const way = (along: {x: number; y: number; z: number} | null) => {
            let w = along && Math.hypot(along.x, along.z) > 0.3 ? {...along} : {x: out.x, y: 0, z: out.z};
            if (w.x * out.x + w.z * out.z < 0) w = {x: -w.x, y: -w.y, z: -w.z};
            const k = 1 / (Math.hypot(w.x, w.y, w.z) || 1);
            for (let step = 0.05; step <= 2; step += 0.05) {
                const x = at.x + w.x * k * step;
                const z = at.z + w.z * k * step;
                if (!inside(x, z)) return {x: w.x * k * step, y: w.y * k * step, z: w.z * k * step};
            }
            return null;
        };
        const ways = [way(point.forward ?? null), way(null)].filter((w): w is {x: number; y: number; z: number} => w !== null);
        if (!ways.length) {
            limbClears.set(key, null);
            return null;
        }
        for (const w of ways) {
            const wood = plantBelow(at.x + w.x, at.y + w.y, at.z + w.z, 0.3, 0.6, frame, force);
            if (wood === undefined) return undefined;
            if (wood !== null) {
                const seat = {x: w.x, y: wood - at.y, z: w.z, seated: true};
                limbClears.set(key, seat);
                return seat;
            }
        }
        const drawnOut = {...ways[0], seated: false};
        limbClears.set(key, drawnOut);
        return drawnOut;
    };
    // ARK-CONTACT: the view's target and the camera's distance from it at the reactive layer's last step: a move with the
    // target still and only the distance changed is a zoom (`ReactiveWorld.cameraZooming`).
    let zoomWas: {x: number; y: number; z: number; d: number} | null = null;
    const cameraZoomingNow = (): boolean => {
        const t = controls.target;
        const d = camera.position.distanceTo(t);
        const was = zoomWas;
        zoomWas = {x: t.x, y: t.y, z: t.z, d};
        // (Development: the before-and-after zoom test turns the fix off for its "before" runs.)
        if (process.env.NODE_ENV !== "production" && (globalThis as {__arkZoomFixOff?: boolean}).__arkZoomFixOff) return false;
        return Boolean(was && Math.hypot(t.x - was.x, t.y - was.y, t.z - was.z) < 0.05 && Math.abs(d - was.d) > 0.005);
    };
    const stepReactive = (list: Array<{entry: Entry; distance: number; pose: Pose; modelHeight: number}>, dt: number) => {
        const t0 = performance.now();
        const want = reactiveTier();
        if (want !== reactiveTierNow) {
            reactive.setTier(want);
            reactiveTierNow = want;
        }
        if (want === "lite" || !scheduleOn) {
            // 3.3 batch (A): (and no defence move for the small ones at their microhabitats.)
            for (const c of list) c.entry.defenceNear = 0;
            for (const c of list) c.entry.reactive = null;
            reactiveMs = 0;
            return;
        }
        const budget = reactive.budget;
        const reach = budget.radius + budget.reach;
        const inputs: ReactiveInput[] = [];
        const byId = new Map<string, (typeof list)[number]>();
        for (const c of list) {
            const e = c.entry;
            e.reactive = null;
            // p2 (ocean): not one out on its open-ocean loop (its way is the loop's: a body turn would swim it backwards).
            // (ARK-CONTACT: past the reach only while it still holds a step of the layer's, to ease back from it: zooming
            // out past the reach snapped it back to its schedule's place, a jump the owner saw on the giraffes.)
            if (!e.sched || e.micro || e.visitor || e.place.burrow || e.ocean || (c.distance > reach && !reactive.holding(e.animal.id))) continue;
            const intel = intelProfile(e.animal.model_slug, null, e.stats.intelligence);
            const sp = e.sched.pose;
            const young = youngFor(e);
            byId.set(e.animal.id, c);
            inputs.push({
                id: e.animal.id,
                slug: e.animal.model_slug,
                plan: intel.plan,
                length: e.length,
                size: e.sched.profile.size,
                speed: e.sched.profile.speed,
                gait: e.sched.profile.gait,
                walkPace: e.sched.profile.walkPace,
                runPace: e.sched.profile.runPace,
                dominance: e.sched.profile.dominance,
                social: e.sched.profile.social,
                diet: e.sched.profile.diet,
                intel,
                asleep: e.state.asleep,
                acting: Boolean(e.act || e.moment || e.visitor) || !scheduled(e),
                // A predator running down its prey in a meal's chase (`acts.ts`): nearby prey scatter from it.
                chasing: Boolean(e.act?.role === "hunter" && (e.act.speed ?? 0) > Math.max(e.length, 0.3) * 1.2),
                parentId: young.parent,
                youngPlay: young.play,
                headHeight: c.modelHeight * 0.8,
                // (The behaviour profile also calls the barnacle goose sessile, from its name: only the "other" plan.)
                sessile: (e.sched.profile.move === "sessile" && intel.plan === "other") || Boolean(e.sched.profile.creep), // (REAL-REPRODUCTION: a creeper withdraws, never flees)
                // Looked at or followed: the camera coming to it never wakes it (looking never changes what it does).
                watched: e.animal.id === selectedId || e.animal.id === followId,
                // 3.3 batch (A): a species whose own defence is made on the spot stays and does it.
                // (SIG-DEFENCE: a thumper while its thumps last; a rearer only when cornered: `holdsNow`.)
                holds: holdsNow(e.animal.model_slug, e.defence),
                escapes: escapesRunning(e.animal.model_slug),
                shared: {x: c.pose.x, y: c.pose.base, z: c.pose.z, yaw: c.pose.yaw, moving: Boolean(sp?.moving) || (e.act?.speed ?? 0) > 0.3, aloft: Boolean(sp?.aloft) || e.air > 0.5, doing: sp?.doing ?? "rest", spot: e.sched.trip?.to.point ?? null}
            });
        }
        reactiveInputs = inputs.length;
        // 3.3 batch (A): a small animal at its microhabitat is outside the layer; its defence move (`defence-moves.ts`)
        // still has to know when one of the layer's animals that could eat it is beside it.
        for (const c of list) {
            const e = c.entry;
            if (!e.place.micro) continue;
            const spec = (e.defenceSpec ??= defenceMoveOf(e.animal.model_slug) ?? false);
            e.defenceNear = spec && c.distance < budget.radius ? predatorBeside(e.animal.model_slug, c.pose.x, c.pose.z, inputs) : 0;
        }
        // Nothing near, or the world's sampler still being built a slice at a time (`worldSamplerReady` on the behaviour
        // lane's 67d6ddf3; asking for it now would finish the build in one stall): the layer waits a frame.
        const samplerReady = (worldSampling as unknown as {worldSamplerReady?: () => boolean}).worldSamplerReady;
        if (!inputs.length || (samplerReady && !samplerReady())) {
            reactiveMs = performance.now() - t0;
            return;
        }
        const sampler = worldSampler();
        // (Part C: the town's places and ground inside its square, the wild island's elsewhere.)
        reactiveQueries ??= reactiveWorldQueries(island ? composedSampler(sampler, island.sampler(), island.contains) : sampler, budget.sightSamples);
        reactiveQueries.samples = budget.sightSamples;
        const queries = reactiveQueries;
        const out = reactive.step(inputs, {
            now: worldMs() / 1000,
            dt,
            hours: hoursNow(),
            night: lighting.daylight.night,
            weather: reactiveWeather,
            camera: {x: camera.position.x, y: camera.position.y, z: camera.position.z},
            cameraZooming: cameraZoomingNow(),
            sight: queries.sight,
            refuge: queries.refuge
        });
        out.forEach((o, id) => {
            const c = byId.get(id);
            if (!c) return;
            c.entry.reactive = o;
            const pose = c.pose;
            // 3.3 batch (C): a young one at its mother's flank to suckle moves as she does here (her step back from the
            // camera, not its own), so the two stay together.
            const nursed = (c.entry.sched?.pose as {nurse?: string} | null | undefined)?.nurse;
            const led = nursed ? out.get(nursed) ?? null : null;
            const dam = led ? byId.get(nursed!)?.entry.sched?.pose ?? null : null;
            const own = c.entry.sched?.pose;
            // (Her turn here too: its place beside her turned about her as she turns.)
            const [rx, rz] = led && dam && own ? nurseTurn(own.x - dam.x, own.z - dam.z, led.bodyYaw) : [0, 0];
            // (Powers you can see: a camouflaged, warning-coloured or armoured one showing its Power holds its ground.)
            const hold = 1 - (c.entry.power?.still ?? 0);
            const odx = (led ? led.dx + rx : o.dx) * hold;
            const odz = (led ? led.dz + rz : o.dz) * hold;
            if (odx || odz) {
                const ground = Math.max(heightAt(pose.x, pose.z), 0);
                const onGround = !pose.afloat && Math.abs(pose.base - ground) < 0.08;
                // In the water (swimming, walking the floor, floating): it stays in the water, at its depth.
                const inWater = pose.afloat && !c.entry.sched?.pose?.aloft && pose.base < 0.02 && sampler.isWater(pose.x, pose.z);
                // A land animal is never pushed into the water, nor a water animal onto a shore (`offsetShare`).
                // 3.3 fix: on a perch well over the ground (not afloat, not flying) it keeps to it (`offsetShare` "perch").
                const perched = !onGround && !inWater && !pose.afloat && !c.entry.sched?.pose?.aloft && pose.base - ground > PERCH_ABOVE;
                const k = offsetShare(pose, odx, odz, onGround ? "land" : inWater ? "water" : perched ? "perch" : "free", (x, z) => sampler.isWater(x, z), heightAt);
                pose.x += odx * k;
                pose.z += odz * k;
                if (onGround) pose.base = Math.max(heightAt(pose.x, pose.z), 0);
            }
            pose.yaw += led ? led.bodyYaw : o.bodyYaw;
            pose.base -= o.crouch * c.modelHeight * 0.08;
        });
        reactiveMs = performance.now() - t0;
    };

    // MARK: Powers you can see (decision 420; `power-show.ts`, loaded lazily)
    /** Its Power's move on its pose, within its element, as the reactive layer's offsets are (`offsetShare`). */
    const powerShift = (c: ArkPowerCandidate, dx: number, dz: number) => {
        const ready = (worldSampling as unknown as {worldSamplerReady?: () => boolean}).worldSamplerReady;
        if ((!dx && !dz) || (ready && !ready())) return;
        const pose = c.pose as Pose;
        const aloft = Boolean((c.entry as unknown as Entry).sched?.pose?.aloft);
        const sampler = worldSampler();
        const ground = Math.max(heightAt(pose.x, pose.z), 0);
        const onGround = !pose.afloat && Math.abs(pose.base - ground) < 0.08;
        const inWater = pose.afloat && !aloft && pose.base < 0.02 && sampler.isWater(pose.x, pose.z);
        const perched = !onGround && !inWater && !pose.afloat && !aloft && pose.base - ground > PERCH_ABOVE;
        const k = offsetShare(pose, dx, dz, onGround ? "land" : inWater ? "water" : perched ? "perch" : "free", (x, z) => sampler.isWater(x, z), heightAt);
        pose.x += dx * k;
        pose.z += dz * k;
        if (onGround) pose.base = Math.max(heightAt(pose.x, pose.z), 0);
    };

    /** Lane L2's per-animal motion (`locomotion/l2-scene.ts`), made on first use. */
    const l2Of = (entry: Entry, plan?: string | null) => (entry.l2 ??= newL2Motion(entry.animal.model_slug, plan ?? null, entry.phase));

    /** Nose down going downhill, up going uphill: the ground's slope along its heading over its length (so its feet meet the slope). */
    const slopePitch = (x: number, z: number, yaw: number, length: number) => {
        const half = Math.max(length * 0.4, 0.05);
        const front = Math.max(heightAt(x + Math.sin(yaw) * half, z + Math.cos(yaw) * half), 0);
        const back = Math.max(heightAt(x - Math.sin(yaw) * half, z - Math.cos(yaw) * half), 0);
        return Math.max(Math.min(Math.atan2(back - front, half * 2), 0.45), -0.45);
    };

    /**
     * The water's surface over a point as the scene draws it (lane MA3): the higher of the drawn lattice's surface and the
     * schedule's own water level (`waterLevelAt`; the lattice reads the sea's 0 at points by a lake's shore). The sea's 0
     * at sea and on dry land; the bigger wild island's lake and river at their own level; another island's own water.
     */
    const waterTopAt = (x: number, z: number) => Math.max(waterSurfaceAt(x, z), waterLevelAt(x, z, 0));

    /**
     * ARK-JUNGLE (board: "mothers carrying infants"): a young one its species carries (`ark-age.ts`: the first third of its
     * dependence) rides its mother wherever she is drawn now, in her own frame: a newborn clings under her belly, facing her
     * chest, its back to the ground; older, it rides on her back. So it goes up the trunk with her, swings under her and
     * flies the gap with her. Null when it is not carried, or its mother is not drawn (it is then at heel, as before).
     */
    const carriedPose = (entry: Entry, time: number): Pose | null => {
        const age = liveliness.ageOf(entry);
        if (!age || age.stage !== "young" || !age.carried) return null;
        const mother = findEntry(age.follow?.parentId ?? liveliness.parentOf(entry.animal.id));
        if (!mother || mother === entry || mother.act || !mother.sched) return null;
        const motherModel = library.get(mother.animal.model_slug);
        const motherHeight = motherModel ? motherModel.height * (mother.length / motherModel.bodyLength) : mother.length * 0.6;
        const at = pose(mother, motherModel, motherHeight, time);
        // (A ride that is on the water only: out of it, on the bank, the young get down and follow, `liveliness-scene.ts`.)
        if (age.ways?.rideWater && !(waterTopAt(at.x, at.z) - heightAt(at.x, at.z) > DEEP_WATER)) return null;
        entry.ridingOn = {id: mother.animal.id, x: at.x, z: at.z, base: at.base};
        // Her frame: her back's way (n), her head's (t), her feet's point.
        const s = at.surface;
        const n = s ? {x: s.nx, y: s.ny, z: s.nz} : {x: 0, y: 1, z: 0};
        const t = s ? {x: s.tx, y: s.ty, z: s.tz} : {x: Math.sin(at.yaw), y: 0, z: Math.cos(at.yaw)};
        const foot = {x: at.x, y: at.base, z: at.z};
        const middle = {x: foot.x + n.x * motherHeight * 0.5, y: foot.y + n.y * motherHeight * 0.5, z: foot.z + n.z * motherHeight * 0.5};
        // (A newborn's first weeks under her, then on her back: a share of its growth, `ark-age.ts`; a species whose own text
        // says where its young ride (`young-ways.ts`) has it there: on the back, clinging to the belly or chest, on the tail
        // root, beneath the tail.)
        const style = age.ride;
        const belly = style === "belly" || style === "under" ? true : style ? false : age.growth < 0.11;
        const side = belly ? -1 : 1;
        const along = style === "tail" ? -0.34 : style === "under" ? -0.3 : style === "back" ? -0.04 : belly ? 0.1 : -0.12;
        // Its feet against her: under her belly its own up is her down, so its feet (its belly) face hers.
        // (Where on her it sits: a primate's or a mammal's back is high on her model; a bird's, floating or standing, is low under its neck and head.)
        const motherPlan = motherModel?.behaviour?.plan;
        const reach = motherHeight * (style === "under" ? 0.3 : motherPlan === "bird" && !belly ? -0.12 : 0.4);
        const fx = middle.x + n.x * side * reach + t.x * mother.length * along;
        const fy = middle.y + n.y * side * reach + t.y * mother.length * along;
        const fz = middle.z + n.z * side * reach + t.z * mother.length * along;
        const up = belly ? {x: -n.x, y: -n.y, z: -n.z} : n;
        const surface = {x: fx, y: fy, z: fz, nx: up.x, ny: up.y, nz: up.z, tx: t.x, ty: t.y, tz: t.z};
        return {x: fx, z: fz, base: fy, yaw: Math.atan2(t.x, t.z), pitch: 0, roll: 0, afloat: true, surface};
    };

    // MARK: Riders and hoppers (`riders.ts`; owner, 2026-11-21: fleas hop, and ride their cats)

    /** Per rider kind, the entries that can be its host and their tier: worked out again when the entries change. */
    let rideHosts: {of: Entry[]; bySlug: Map<string, Array<{entry: Entry; tier: number}>>} | null = null;
    const rideHostsFor = (slug: string, spec: RiderSpec) => {
        if (!rideHosts || rideHosts.of !== entries) rideHosts = {of: entries, bySlug: new Map()};
        let list = rideHosts.bySlug.get(slug);
        if (!list) {
            list = [];
            for (const e of entries) {
                if (e.ghost || e.visitor || riderOf(e.animal.model_slug)) continue;
                const tier = hostTier(spec, {slug: e.animal.model_slug, kindId: e.animal.kind_species_profile_id, speciesId: e.animal.species_profile_id, water: Boolean(e.place.water)});
                if (tier >= 0) list.push({entry: e, tier});
            }
            rideHosts.bySlug.set(slug, list);
        }
        return list;
    };
    /** A host as it is drawn this frame (its own pose, worked out again here, so its rider is never a frame behind it). */
    const hostFrameOf = (host: Entry, time: number): {frame: HostFrame; at: Pose} => {
        const slug = host.animal.model_slug;
        const model = library.get(slug);
        const height = model ? model.height * (host.length / model.bodyLength) : host.length * 0.6;
        const at = pose(host, model, height, time);
        const s = at.surface;
        const frame: HostFrame = {
            x: at.x, y: at.base, z: at.z,
            nx: s ? s.nx : 0, ny: s ? s.ny : 1, nz: s ? s.nz : 0,
            tx: s ? s.tx : Math.sin(at.yaw), ty: s ? s.ty : 0, tz: s ? s.tz : Math.cos(at.yaw),
            length: host.length,
            height,
            radius: bodyShape(slug, host.length).radius,
            body: mapBodyOf(slug),
            rest: host.rest
        };
        return {frame, at};
    };
    /** How far a flea can jump onto a host (m): a long flea jump (Cadiergues et al. 2000: up to about 48 cm). */
    const RIDE_REACH = 0.45;
    const rideGround = (x: number, z: number) => Math.max(heightAt(x, z), 0);
    /** The floor it hops on: the ground, or (a room's floor, a deck: well off the ground there) the flat at that height. */
    const floorAt = (y: number) => (x: number, z: number) => {
        const ground = rideGround(x, z);
        return Math.abs(ground - y) < 0.12 ? ground : y;
    };
    const hopSurface = (hop: {x: number; y: number; z: number; hx: number; hz: number}, out: RideSurface): RideSurface => {
        out.x = hop.x;
        out.y = hop.y;
        out.z = hop.z;
        out.nx = 0;
        out.ny = 1;
        out.nz = 0;
        out.tx = hop.hx;
        out.ty = 0;
        out.tz = hop.hz;
        return out;
    };
    const surfacePose = (sf: RideSurface): Pose => ({x: sf.x, z: sf.z, base: sf.y, yaw: Math.atan2(sf.tx, sf.tz), pitch: 0, roll: 0, afloat: true, surface: {...sf}});

    let rideFrame = 0;
    const riddenNow = new Set<string>();
    const rideProfiles = new Map<string, BackProfile | null>();
    const rideProfile = (slug: string, model: SpeciesModel | undefined): BackProfile | null => {
        let profile = rideProfiles.get(slug);
        if (profile !== undefined) return profile;
        const geometry = (model?.near ?? model?.far)?.geometry;
        if (!geometry || model?.placeholder) return null;
        const at = geometry.getAttribute("position");
        profile = backProfile(at.count, (i) => at.getX(i), (i) => at.getY(i), (i) => at.getZ(i));
        // (Measured again once the near file is in: the far one has lost its thin parts.)
        if (model?.near) rideProfiles.set(slug, profile);
        return profile;
    };
    const rideLocal = new Vector3();
    const rideNormal = new Vector3();
    const rideAlong = new Vector3();
    /**
     * The rider's spot on its host as the host is drawn this frame: its own mesh's back (`backProfile`) under the host's
     * whole drawn transform (its place, heading, slope, lying down, scale). A sleeper lying on its rig's clip is lowered by
     * its posture's drop (the clip lowers the mesh, not the transform).
     */
    const rideVertex = new Map<string, {vertex: number; at: number}>();
    const identity12 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    const rideSkin = {x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0};
    const rideLate = (entry: Entry, where: Pose) => {
        const memo = entry.ride!;
        const host = memo.host ? findEntry(memo.host) : null;
        const spec = riderOf(entry.animal.model_slug);
        if (!host || !spec || host.drawnFrame !== rideFrame || !host.drawnMatrix) return;
        const drawnRig = host.drawnRig;
        const clock = reducedMotion ? 0 : worldMs() / 1000;
        let p: {x: number; y: number; z: number; nx: number; ny: number; nz: number};
        if (drawnRig) {
            // On a rig: a vertex of its own mesh near the spot (chosen again as the spot creeps), posed by its bones.
            const {rig, mesh, index} = drawnRig;
            const geometry = rig.geometry;
            const profile = rideProfile(`rig:${host.animal.model_slug}`, {near: {geometry}} as unknown as SpeciesModel);
            if (!profile) return;
            const position = geometry.getAttribute("position");
            const normal = geometry.getAttribute("normal");
            let chosen = rideVertex.get(entry.animal.id);
            if (!chosen || chosen.at > clock || clock - chosen.at > 2) {
                const target = profileSpot(profile, spotOf(entry.animal.id, spec.on, clock));
                const vertex = nearestVertex(position.count, (i, o) => { o[0] = position.getX(i); o[1] = position.getY(i); o[2] = position.getZ(i); }, normal ? (i, o) => { o[0] = normal.getX(i); o[1] = normal.getY(i); o[2] = normal.getZ(i); } : null, target);
                if (vertex < 0) return;
                rideVertex.set(entry.animal.id, (chosen = {vertex, at: clock}));
            }
            const i = chosen.vertex;
            const joints = geometry.getAttribute("arkJoints");
            const weights = geometry.getAttribute("arkWeights");
            const a = mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute;
            const data = rig.data;
            const stride = rig.bones * 12;
            // (The locomotion layer's live rows, a negative clip row: its own pose texture's data.)
            const live = rig.loco?.live.data ?? null;
            p = skinVertex(
                {x: position.getX(i), y: position.getY(i), z: position.getZ(i)},
                normal ? {x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i)} : {x: 0, y: 1, z: 0},
                [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)],
                [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)],
                (row, b, k) => (row < -0.5 ? (live ? live[(Math.round(-row) - 1) * stride + Math.round(b) * 12 + k] ?? 0 : identity12[k]) : halfToFloat(data[Math.round(row) * stride + Math.round(b) * 12 + k] ?? 0)),
                [a.getX(index), a.getY(index), a.getZ(index)],
                a.getW(index),
                rideSkin
            );
        } else {
            const model = library.get(host.animal.model_slug);
            const profile = rideProfile(host.animal.model_slug, model);
            if (!profile) return;
            p = profileSpot(profile, spotOf(entry.animal.id, spec.on, clock));
        }
        const m = host.drawnMatrix;
        rideLocal.set(p.x, p.y, p.z).applyMatrix4(m);
        rideNormal.set(p.nx, p.ny, p.nz).transformDirection(m);
        rideAlong.set(0, 0, 1).transformDirection(m);
        rideAlong.addScaledVector(rideNormal, -rideAlong.dot(rideNormal)).normalize();
        if (spec.on === "belly") {
            // (A remora hangs under: its back, the disc on its head, to the host's belly.)
            rideLocal.addScaledVector(rideNormal, Math.max(entry.length * 0.25, 0.01));
            rideNormal.negate();
        }
        where.x = rideLocal.x;
        where.z = rideLocal.z;
        where.base = rideLocal.y;
        where.yaw = Math.atan2(rideAlong.x, rideAlong.z);
        where.surface = {x: rideLocal.x, y: rideLocal.y, z: rideLocal.z, nx: rideNormal.x, ny: rideNormal.y, nz: rideNormal.z, tx: rideAlong.x, ty: rideAlong.y, tz: rideAlong.z};
    };

    /**
     * A rider on its host, or a hopper hopping (`riders.ts`); null: neither now (it is drawn as before). The host is the
     * first tier's nearest in range of its own spot while one is drawn; once on, it stays on that host while the host is
     * drawn. A flea jumps off a host that keeps still now and then, hops about beside it and jumps back on (or on as the
     * host gets up, if still within a jump). Chosen or followed while on its host, it keeps that host.
     */
    const ridePose = (entry: Entry, time: number): Pose | null => {
        const slug = entry.animal.model_slug;
        const spec = riderOf(slug);
        const hopper = hops(slug);
        // (`__arkRiders = false`: the harness's before picture, every rider drawn as it was.)
        if ((!spec && !hopper) || (globalThis as {__arkRiders?: boolean}).__arkRiders === false) return null;
        const id = entry.animal.id;
        const place = entry.place;
        const epoch = worldMs() / 1000;
        const still = reducedMotion;
        const memo = (entry.ride ??= {host: null, checked: -Infinity, pace: 0, last: null, off: null, board: null, on: false, surface: {x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, ty: 0, tz: 1}, hop: {x: 0, y: 0, z: 0, hx: 0, hz: 1, air: -1, n: 0}});
        const watched = selectedId === id || followId === id;
        const L = Math.max(entry.trueLength, 0.0005);
        // Its host now, if any.
        let host: Entry | null = null;
        if (spec) {
            // (A host of the roster, drawn this frame or not: one just behind the camera, or not yet drawn as the view arrives, still counts.)
            const hostOk = (e: Entry | null | undefined): e is Entry => Boolean(e && entryById.get(e.animal.id) === e && !e.held && !e.ghost && !e.act?.hidden);
            if (spec.range === null) host = place.host ? findEntry(place.host.id) : null;
            else if (spec.night && !nightNow(hoursNow())) host = null;
            else {
                const current = memo.host ? findEntry(memo.host) : null;
                if (hostOk(current)) host = current;
                else if (epoch - memo.checked >= 1 || epoch < memo.checked) {
                    memo.checked = epoch;
                    const home = {x: place.x, y: place.ground, z: place.z};
                    const candidates: Array<{id: string; tier: number; x: number; y: number; z: number}> = [];
                    for (const c of rideHostsFor(slug, spec)) {
                        if (!hostOk(c.entry)) continue;
                        const e = c.entry;
                        const at = e.middle ? {x: e.middle.x, y: e.middle.y - e.drawnHeight * 0.5, z: e.middle.z} : e.sched?.pose ? {x: e.sched.pose.x, y: e.sched.pose.y, z: e.sched.pose.z} : {x: e.place.x, y: e.place.ground, z: e.place.z};
                        candidates.push({id: e.animal.id, tier: c.tier, ...at});
                    }
                    const chosen = chooseHost(home, spec.range, candidates, null);
                    host = chosen ? findEntry(chosen) : null;
                }
            }
            // (`__arkRidersFree = true`: the harness's hop strip, every rider off its host.)
            if (!hostOk(host) || (globalThis as {__arkRidersFree?: boolean}).__arkRidersFree) host = null;
            // (Watched and on its host, it stays with that host while the host is aboard: never moved to another one.)
            if (watched && memo.on) {
                const was = memo.host ? findEntry(memo.host) : null;
                if (hostOk(was)) host = was;
            }
            memo.host = host ? host.animal.id : null;
        }
        if (host && spec) {
            const {frame, at} = hostFrameOf(host, time);
            // Its host's pace (a flea jumps off one that keeps still, and back on as it gets up).
            if (memo.last && epoch > memo.last.t) {
                const v = Math.hypot(frame.x - memo.last.x, frame.z - memo.last.z) / Math.max(epoch - memo.last.t, 1e-3);
                memo.pace += (Math.min(v, 20) - memo.pace) * Math.min((epoch - memo.last.t) / 0.5, 1);
            }
            memo.last = {x: frame.x, z: frame.z, t: epoch};
            const spot = spotOf(id, spec.on, still ? 0 : epoch);
            const onHost = hostSurface(frame, spot, memo.surface);
            if (spec.on === "belly") {
                // A remora's sucking disc is on its head's top: it hangs under the belly, its back to the host.
                const h = Math.max(entry.length * 0.25, 0.01);
                onHost.x += onHost.nx * h;
                onHost.y += onHost.ny * h;
                onHost.z += onHost.nz * h;
                onHost.nx = -onHost.nx;
                onHost.ny = -onHost.ny;
                onHost.nz = -onHost.nz;
            }
            const ridden = (): Pose => {
                riddenNow.add(host!.animal.id);
                entry.riding = true;
                entry.ridingOn = {id: host!.animal.id, x: at.x, z: at.z, base: at.base};
                memo.on = true;
                return surfacePose(onHost);
            };
            // A flea's time off its host (never with reduced motion).
            // (`__arkRidersStay = true`: the harness's pictures on the host, no time off it.)
            if (spec.excursions && hopper && !still && !(globalThis as {__arkRidersStay?: boolean}).__arkRidersStay) {
                const window = excursionAt(id, epoch);
                if (!memo.off && window && epoch >= window.start && epoch - window.start < 1.5 && memo.pace < 0.08 && memo.on) {
                    // Off beside the host, where a hop or two from its side puts it, on the ground.
                    const side = unit(id, "off-side", window.start) < 0.5 ? -1 : 1;
                    const sx = frame.tz * side;
                    const sz = -frame.tx * side;
                    const out = frame.radius + L * 90;
                    memo.off = {start: window.start, end: window.end, mid: {x: frame.x + sx * out, z: frame.z + sz * out}, from: {x: onHost.x, y: onHost.y, z: onHost.z}, leave: 0, floor: floorAt(frame.y)};
                    memo.board = null;
                }
                const off = memo.off;
                if (off) {
                    const t = epoch - off.start;
                    const first = groundHop(id, off.mid, L, 0, off.floor, memo.hop, 0);
                    const firstAt = {x: first.x, y: first.y, z: first.z};
                    off.leave ||= hopFlight(Math.hypot(firstAt.x - off.from.x, firstAt.z - off.from.z), firstAt.y - off.from.y);
                    if (t < off.leave) {
                        // The jump off: a ballistic arc from its spot on the host to the ground.
                        entry.riding = false;
                        memo.on = false;
                        const p = hopArc(off.from, firstAt, t / off.leave);
                        const dx = firstAt.x - off.from.x;
                        const dz = firstAt.z - off.from.z;
                        const dl = Math.hypot(dx, dz) || 1;
                        return surfacePose(hopSurface({x: p.x, y: p.y, z: p.z, hx: dx / dl, hz: dz / dl}, memo.surface));
                    }
                    const ground = memo.board ? null : groundHop(id, off.mid, L, t - off.leave, off.floor, memo.hop, 0);
                    if (ground && ground.air < 0) {
                        // Back on: its time is up, or its host gets up; only if it is still within a jump (else it waits on the ground).
                        const near = Math.hypot(onHost.x - ground.x, onHost.z - ground.z);
                        if ((epoch >= off.end || memo.pace > 0.15) && near <= RIDE_REACH) memo.board = {x: ground.x, y: ground.y, z: ground.z, t0: epoch};
                        // (Left behind too long, a few minutes, and not watched: it is back on its host.)
                        else if (epoch - off.end > 180 && !watched) {
                            memo.off = null;
                            return ridden();
                        }
                    }
                    const board = memo.board;
                    if (board) {
                        const flight = hopFlight(Math.hypot(onHost.x - board.x, onHost.z - board.z), onHost.y - board.y);
                        const u = (epoch - board.t0) / flight;
                        if (u >= 1) {
                            memo.off = null;
                            memo.board = null;
                            return ridden();
                        }
                        entry.riding = false;
                        memo.on = false;
                        const p = hopArc(board, onHost, u);
                        const dx = onHost.x - board.x;
                        const dz = onHost.z - board.z;
                        const dl = Math.hypot(dx, dz) || 1;
                        return surfacePose(hopSurface({x: p.x, y: p.y, z: p.z, hx: dx / dl, hz: dz / dl}, memo.surface));
                    }
                    entry.riding = false;
                    memo.on = false;
                    return surfacePose(hopSurface(ground!, memo.surface));
                }
            }
            return ridden();
        }
        memo.on = false;
        memo.off = null;
        memo.board = null;
        memo.last = null;
        // No host: a hopper hops about its own spot on the ground (only where that spot is on the ground).
        if (!hopper) return null;
        // (Only where its own spot faces up: a floor, the ground, a step; not a wall or a stem.)
        const home = place.micro ? surfacePoint(place.micro, entry.animal.zone, 0) : {x: place.x, y: place.ground, z: place.z, ny: 1};
        if (home.ny < 0.7) return null;
        const floor = floorAt(home.y);
        const at = groundHop(id, {x: home.x, z: home.z}, L, still ? 0 : epoch, floor, memo.hop);
        if (still) {
            at.x = home.x;
            at.z = home.z;
            at.y = floor(home.x, home.z);
        }
        return surfacePose(hopSurface(at, memo.surface));
    };

    /** Its schedule's pose as the scene draws it: banked into the turn when circling, the head a little down asleep. */
    const fromSchedule = (entry: Entry, modelHeight: number): Pose => {
        // ARK-WEBS: a web spinner on its web, once its web is hung (drawn there; its schedule's shared pose is unchanged).
        const web = webPoseOf(entry);
        if (web) return {x: web.x, z: web.z, base: web.y, yaw: Math.atan2(web.tx, web.tz), pitch: 0, roll: 0, afloat: true, surface: web};
        const own = entry.sched!;
        const at = own.pose!;
        const ground = own.ground;
        // In the water: where it goes is the schedule's; how deep, its own place in its species' band (`sea-depth.ts`,
        // each animal its own depth, so a school is spread up and down), up to the surface on its breath, fitted at its drawn size.
        const act = (at as RecipePose).act;
        // (`schedule-water.ts`: in the water, the band wins over the schedule's own height; a recipe act of its own, a dive, keeps its height.)
        // (Part C: the water's surface there, the sea's 0 or the bigger wild island's lake and river at their own level.)
        // (Lane MA3: the higher of the drawn lattice's surface and the schedule's own water level, `waterLevelAt`: the
        // lattice reads the sea's 0 at points by a lake's shore, and a goose sliding in sank to the sea's level.)
        const surfaceHere = waterTopAt;
        const waterTop = surfaceHere(at.x, at.z);
        // (Lane MA3: anything that swims has a band while its schedule has it in the water, a coot, an otter, a crocodile
        // as well as a duck: `swimDepth`; a water species its own band, with its kind's float line.)
        const band = (entry.swim ??= entry.place.micro ? null : swimDepth(entry.animal.model_slug, entry.animal.zone));
        // Into the water or out of it (lane MA3, the movement audit's goose): down the bank it settles from standing to its
        // float line by the slide's progress, nose down into the water; out of it, the reverse, nose up. Its rig plays
        // the entry or exit clip by the same progress (`rigFor`).
        const edge = band && own.trip && !at.aloft && !act?.own ? waterEdgeAt(own.trip, own.at) : null;
        if (edge && band) {
            const leg = own.trip!.legs.find((l) => l.mode === edge.mode);
            const wetEnd = leg ? (edge.mode === "enter" ? leg.to : leg.from) : at;
            const top = surfaceHere(wetEnd.x, wetEnd.z);
            const {spec} = scheduledWater(band, Math.min(ground, top - 0.05), entry.seed, clockNow(), 0, modelHeight, top);
            const s = edge.u * edge.u * (3 - 2 * edge.u);
            const k = edge.mode === "enter" ? s : 1 - s;
            const stand = Math.max(at.y, ground);
            const fitted = tideFit(spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
            const dip = (edge.mode === "enter" ? 0.32 : -0.26) * Math.sin(Math.PI * edge.u);
            // (ARK-CONTACT: never into the bank it is on: a marsh frog climbing out sank half its body into it.)
            return {x: at.x, z: at.z, base: edgeBase(stand, fitted, k, Math.max(ground, standGround(at.x, at.z, stand))), yaw: at.yaw + (entry.glance ?? 0), pitch: dip + floatPitch(band.kind) * k, roll: 0, afloat: k > 0.5, edge: {mode: edge.mode, u: edge.u, k, stand, spec}};
        }
        // (A recipe's act owns its pose, a dive under the surface; one at the surface, a dabble's swim and up-end, rides at
        // its float line all the same: lane MA3, a dabbling duck stood on the water.)
        const atSurface = Boolean(act?.own) && band !== null && waterMotion(band) === "float" && !at.aloft && Math.abs(at.y - waterTop) < 0.06;
        if (inDepthBand(band, at, ground, waterTop) && (!act?.own || atSurface)) {
            const clock = clockNow();
            // (Awake, its breath on its way there: `breath-trip.ts`.)
            const breath = entry.state.breathing ? scheduledBreath(own) ?? breathAt(entry.seed, clock, entry.state.asleep) : 0;
            const {spec} = scheduledWater(band, ground, entry.seed, clock, breath, modelHeight, waterTop);
            // (Under the surface where the tide has it now: `tideFit`.)
            const fitted = tideFit(spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
            // (Lane L2: a swimmer not up for air keeps its flukes and tail under the surface: `swimSurfaceGuard`.)
            const base = spec.motion === "swim" && !spec.breath ? l2SurfaceGuard(l2Of(entry), fitted, modelHeight, entry.length, 0, spec.surface ?? ARK_ENVIRONMENT.seaLevel.value) : fitted;
            const yaw = at.yaw + (entry.glance ?? 0);
            // A walker on the floor stands on its slope while its rig walks it there (as in `waterPose`).
            const surface = spec.motion === "walk" && entry.rig && entry.rig.weight > 0 ? onGround(at.x, base, at.z, yaw) : undefined;
            // (A penguin lies down to swim: `swimBodyPitch`; a floater rides its kind's way, a duck tail up: `floatPitch`. A
            // recipe's attitude on top: an up-end tips it nose down.)
            const ride = spec.motion === "swim" ? swimBodyPitch(entry.animal.model_slug) : spec.motion === "float" ? floatPitch(band.kind) : 0;
            return {x: at.x, z: at.z, base, yaw, pitch: ride + (act && act.episode !== "sleep" ? act.pitch : 0), roll: act && act.episode !== "sleep" ? act.roll : 0, afloat: true, water: spec, ...(surface ? {surface} : {})};
        }
        // Under the surface in its own act (a dive): where the act has it, swimming (lane MA3: it walked and hopped there).
        const diving = Boolean(band) && Boolean(act?.own) && !at.aloft && ground < waterTop - 0.02 && at.y < waterTop - 0.06;
        // No walking on the water (lane MA3): over water with no band (a heron, an egret in the shallows), not in the air,
        // it stands on the bed, its legs in the water, never on the surface.
        if (!band && !at.aloft && !act?.own && ground < waterTop - 0.02 && at.y >= ground - 0.01 && at.y <= waterTop + 0.02) {
            // (ARK-CONTACT: only as deep as its legs; deeper, at its float line, never under the surface on the bed: the
            // owner's "birds under the water walking on the water floor", decision 447. `grounding/contact.ts` wadeBase.)
            const plan = library.get(entry.animal.model_slug)?.behaviour?.plan ?? modelBase(entry.animal.model_slug)?.plan;
            const wade = wadeBase(ground, waterTop, modelHeight, own.profile.water, plan, livesUnderWater(own.profile, plan));
            return {x: at.x, z: at.z, base: wade.base, yaw: at.yaw + (entry.glance ?? 0), pitch: act ? act.pitch : 0, roll: act ? act.roll : 0, afloat: wade.floating, wading: !wade.floating};
        }
        const circling = at.aloft && (at.doing === "fly" || at.doing === "soar");
        const glance = entry.glance ?? 0;
        // A sleeping posture's attitude (a bat turned over, an otter on its back) comes in as it settles and goes as it
        // wakes (kept from its last sleeping moment, so the turn back is eased too), never at once.
        const sleepT = entry.sleepNow?.t ?? 0;
        const hangAct = Boolean(act) && act!.episode === "sleep" && act!.state === "sleep_hang" && act!.pitch > 1;
        if (act && act.episode === "sleep") entry.sleepAct = {pitch: act.pitch, roll: act.roll, hang: hangAct};
        else if (!sleepT) entry.sleepAct = null;
        const actShare = act && act.episode === "sleep" ? sleepStages(sleepT).roll : 1;
        const after = !act || act.episode !== "sleep" ? entry.sleepAct ?? null : null;
        const afterShare = after ? sleepStages(sleepT).roll : 0;
        // ARK-ANIM (round 4): a bat roosting hangs under its limb from its feet, head down, its body below the limb,
        // swinging slowly about its feet (`grounding/hang.ts`); it lay along the limb, turned about its middle.
        // (Its own ease, 1.2 s each way: a bat roosting by day is resting, not asleep, so the sleep stages never turn
        // it. Already hanging on its first frame: no turning over on load.)
        const hangNow = clockNow();
        if (hangAct) {
            entry.hangFrom ??= entry.hangSeen ? hangNow : hangNow - HANG_EASE;
            entry.hangOff = null;
        } else if (entry.hangFrom != null) entry.hangOff ??= hangNow;
        entry.hangSeen = true;
        const hangEase = (u: number) => {
            const c = Math.min(Math.max(u, 0), 1);
            return c * c * (3 - 2 * c);
        };
        let hanging = entry.hangFrom == null ? 0 : hangEase((hangNow - entry.hangFrom) / HANG_EASE) * (entry.hangOff == null ? 1 : 1 - hangEase((hangNow - entry.hangOff) / HANG_EASE));
        if (entry.hangOff != null && hangNow - entry.hangOff >= HANG_EASE) {
            entry.hangFrom = entry.hangOff = null;
            hanging = 0;
        }
        if (hanging > 0 && !at.aloft && groundingRules() === "grounded") {
            const roostTrip = own.trip;
            const held = roostTrip?.to?.point && own.at >= roostTrip.arrive ? hangPointAt(roostTrip.to.point, ARK_TIME.value, ARK_WIND_VECTOR.value) : null;
            const pivot = hangPivot(held && Math.hypot(at.x - held.x, at.z - held.z) < 0.3 ? held : {x: at.x, y: at.y, z: at.z, tag: "canopy_hang"});
            const yaw = at.yaw + glance;
            const hung = hangPose(pivot, yaw, entry.length, hanging, clockNow(), entry.seed);
            return {x: hung.x, z: hung.z, base: hung.base, yaw, pitch: hung.pitch, roll: hung.roll, afloat: true};
        }
        // Grounding: held on a raised point (a branch, a limb, bark, a wall), drawn on it: its back along the surface's
        // normal, up a trunk, swaying with its tree (`scheduledPerch`).
        const trip = own.trip;
        const perch = groundingRules() === "grounded" ? scheduledPerch(at, trip?.to, Boolean(trip) && own.at >= trip!.arrive && !at.moving, ARK_TIME.value, ARK_WIND_VECTOR.value, standGround) : null;
        // p5 (monkeys): a primate staying up in its tree goes out through the crowns and back now and then: swinging arm
        // over arm, leaping or running from hold to hold of the drawn trees (`canopy-scene.ts`, the shared clock's).
        const canopy = trip && perch && !at.moving && !act && !reducedMotion ? canopyFrame(entry.animal, trip, own.at, entry.length, !entry.state.asleep, perch, heightAt) : null;
        if (canopy) return {x: canopy.x, z: canopy.z, base: canopy.y, yaw: Math.atan2(canopy.tx, canopy.tz), pitch: 0, roll: 0, afloat: false, surface: canopy};
        if (perch) return {x: perch.x, z: perch.z, base: perch.y, yaw: at.yaw + glance, pitch: 0, roll: 0, afloat: false, surface: perch};
        // ARK-JUNGLE: a langur of the rocks resting on the ground goes up a rock near it now and then, ledge by ledge, sits
        // on its top a while and comes down (`rock-ledge.ts`, the shared clock's).
        const ledge = trip && !at.moving && !at.aloft && !act && !reducedMotion && own.at >= trip.arrive && (entry.denIn ?? 0) <= 0.001 && Math.abs(at.y - ground) < 0.4 ? ledgeFrame(entry.animal, trip, own.at, !entry.state.asleep, {x: at.x, y: Math.max(at.y, ground), z: at.z}, heightAt) : null;
        if (ledge) return {x: ledge.x, z: ledge.z, base: ledge.y, yaw: Math.atan2(ledge.tx, ledge.tz), pitch: 0, roll: 0, afloat: false, surface: ledge};
        // ARK-ANIM (decision 447): on the wing it faces its track (within `SLIP`) and banks by its turn, both ways; it was
        // banked left whenever it flew and its recipe heading lagged a swallow's curves until it flew backwards.
        const wing = flightHeading((entry.flightHeading ??= newFlightHeading()), at.x, at.z, clockNow(), at.yaw, Boolean(at.aloft));
        // ARK-CONTACT round 3 (crocs and seals "floating" at the shore): out of the water on a swim (its way in or out
        // over the bank), the swim's own height is the water's, not the bank's; on dry ground it walks on the ground.
        const ashore = at.doing === "swim" && !at.aloft && !act?.own && !diving && ground >= waterTop - 0.02 && ground > 0 && at.y > ground && at.y - ground < Math.max(modelHeight, 0.5);
        return {
            x: at.x,
            z: at.z,
            base: ashore ? ground : at.y,
            yaw: (at.aloft ? wing.yaw : at.yaw) + glance,
            // A recipe's attitude on top (a plunge nose down, an up-end, a roll in the dust).
            pitch: (at.aloft ? 0.95 * entry.air : 0.05 * entry.rest + own.pitch) + (act ? act.pitch * actShare : 0) + (after ? after.pitch * afterShare : 0),
            roll: (circling ? wing.roll * entry.air : 0) + (act ? act.roll * actShare : 0) + (after ? after.roll * afterShare : 0),
            // (Over water: the sea's below 0, or (lane MA3 water 2) a lake's or a river's above its bed, the v2 lake at 6 m: it
            // read as dry ground there, and a swimmer out of its band was stood on the bed by its feet, a metre down.)
            afloat: at.aloft || at.y < Math.max(ground, 0) - 0.01 || ground < 0 || ground < waterTop - 0.02 || diving,
            ...(diving ? {underwater: true} : {})
        };
    };

    /**
     * A water species' pose: a loop about its spot (a swimmer's wide, a crab's and a duck's small, none for an
     * octopus in its hole; a school keeps to its first one, a plankton feeder loops round its cloud), at its
     * band's depth from the shared clock and its seed, rising to the surface while its state is breathing.
     */
    /**
     * The ground under a walker, as the graphics pass's sampler sees it
     * (`sampler.ts` groundNormal): its normal, and its heading laid onto the
     * slope, so a crab on the seabed or a small animal on a bank stands on it.
     */
    const onGround = (x: number, y: number, z: number, yaw: number): SurfacePoint => {
        const n = groundNormal(x, z);
        const hx = Math.sin(yaw);
        const hz = Math.cos(yaw);
        const dot = hx * n.x + hz * n.z;
        const tx = hx - n.x * dot;
        const ty = -n.y * dot;
        const tz = hz - n.z * dot;
        const length = Math.hypot(tx, ty, tz) || 1;
        return {x, y, z, nx: n.x, ny: n.y, nz: n.z, tx: tx / length, ty: ty / length, tz: tz / length};
    };

    const waterPose = (entry: Entry, depth: SpeciesDepth, modelHeight: number, time: number): Pose => {
        const place = entry.place;
        const motion = waterMotion(depth);
        const clock = reducedMotion ? 0 : clockNow();
        const breath = entry.state.breathing && !reducedMotion ? breathAt(entry.seed, clock, entry.state.asleep) : 0;
        if (motion === "hole") {
            // In its hole: still, its head turning slowly.
            const spec = waterSpec(depth, place.ground, entry.seed, clock, breath, waterSurfaceAt(place.x, place.z));
            const yaw = place.yaw + (reducedMotion ? 0 : Math.sin(time * 0.2 + entry.phase * 9) * 0.5 * (1 - entry.rest));
            return {x: place.x, z: place.z, base: tideFit(spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base, yaw, pitch: 0, roll: 0, afloat: true, water: spec};
        }
        const lead = entry.leader && entry.leader !== entry && !entry.leader.act && entry.leader.depth ? entry.leader : null;
        const follower = lead ? Math.max(entry.place.rank ?? 1, 1) : 0;
        const owner = lead ?? entry;
        const direction = owner.phase > 0.5 ? 1 : -1;
        // The first one's loop (a plankton feeder's round its cloud); the others keep beside it.
        const cloud = owner.layer.mode === "filter" && motion === "swim" && ZONE_SITES[owner.animal.zone]?.kind === "sea" ? nearestCloud(owner.place.x, owner.place.z) : null;
        const centre = cloud ?? owner.place;
        let radius = cloud ? cloud.radius * 0.7 + owner.phase * 2 : waterLoopRadius(motion, owner.phase, owner.length);
        // The loop stays over its water (the lake's open water; off the beach and the reef's shallows).
        radius = safeLoopRadius(centre.x, centre.z, radius);
        const angle = owner.loop;
        const lx = centre.x + Math.cos(angle) * radius;
        const lz = centre.z + Math.sin(angle) * radius;
        // Level, nose along the loop (model heads face +z): forward (sin yaw, cos yaw), right (cos yaw, -sin yaw).
        const yaw = Math.atan2(-Math.sin(angle) * direction, Math.cos(angle) * direction);
        let x = lx;
        let z = lz;
        if (follower) {
            // Beside its first one, side by side; in file behind it where the water beside is too shallow.
            const at = schoolOffset(follower, owner.seed, owner.length);
            let px = lx + Math.cos(yaw) * at.side - Math.sin(yaw) * at.back;
            let pz = lz - Math.sin(yaw) * at.side - Math.cos(yaw) * at.back;
            if (heightAt(px, pz) > -0.6) {
                // In file instead: back along the loop itself, so it stays over the loop's water.
                const back = schoolFile(follower, owner.seed, owner.length).back / Math.max(radius, 0.5);
                px = centre.x + Math.cos(angle - direction * back) * radius;
                pz = centre.z + Math.sin(angle - direction * back) * radius;
            }
            x = px;
            z = pz;
        }
        const floorY = heightAt(x, z);
        // The school swims at its first one's depth in the band (its own breath apart).
        const spec = waterSpec(depth, floorY, owner.seed, clock, breath, waterSurfaceAt(x, z));
        const along = reducedMotion ? 0 : (0.05 + owner.phase * 0.05) * owner.pace * radius * (1 - 0.85 * owner.rest);
        // (A penguin lies down to swim: `swimBodyPitch`.)
        const pitch = (reducedMotion ? 0 : swimPitch(depth, (spec.surface ?? 0) - floorY, owner.seed, clock, along)) + (motion === "swim" ? swimBodyPitch(entry.animal.model_slug) : 0);
        const fitted = tideFit(spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
        // (Lane L2: a swimmer not up for air keeps its flukes and tail under the surface: `swimSurfaceGuard`.)
        const base = motion === "swim" && !spec.breath ? l2SurfaceGuard(l2Of(entry), fitted, modelHeight, entry.length, pitch - (motion === "swim" ? swimBodyPitch(entry.animal.model_slug) : 0), spec.surface ?? ARK_ENVIRONMENT.seaLevel.value) : fitted;
        // A walker on the floor stands on its slope (its rig walks it there). (A walker's swim pitch is 0.)
        const surface = motion === "walk" && entry.rig && entry.rig.weight > 0 ? onGround(x, base, z, yaw) : undefined;
        return {x, z, base, yaw, pitch, roll: 0, afloat: true, water: spec, school: follower ? {x: lx, z: lz} : undefined, ...(surface ? {surface} : {})};
    };

    // p2 (ocean): the open ocean's wild animals (`open-ocean.ts`): who goes out from the record (islands mode, the v2
    // world), where on its loop from the shared clock; its depth, breath and pitch the sea's own, as `waterPose`'s.
    const oceanRoams = (entry: Entry) => (entry.ocean ??= Boolean(options.wildAnimals) && arkWorld() === "v2" && !entry.visitor && !townIds.has(entry.animal.id) && roamsOpenOcean(entry.animal, entry.depth, entry.trueLength));
    const oceanPose = (entry: Entry, depth: SpeciesDepth, modelHeight: number): Pose => {
        const clock = reducedMotion ? 0 : clockNow();
        const fix = oceanFix(entry.animal, entry.length, clock);
        // (Its breath as everywhere: awake on the schedule, its breathe trip's (every third slot); else the clock's cycle.)
        const sched = entry.sched;
        const breath = reducedMotion ? 0 : sched?.pose && scheduled(entry) ? scheduledBreath(sched) ?? breathAt(entry.seed, clock, true) : entry.state.breathing ? breathAt(entry.seed, clock, entry.state.asleep) : 0;
        // (Its band in a working column of OCEAN_COLUMN m: 2–6 m under for an upper-water swimmer, not 13–35 m.)
        const floorY = Math.max(heightAt(fix.x, fix.z), -OCEAN_COLUMN);
        const spec = waterSpec(depth, floorY, entry.seed, clock, breath);
        const pitch = reducedMotion ? 0 : swimPitch(depth, -floorY, entry.seed, clock, fix.speed);
        const fitted = tideFit(spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
        const base = spec.breath ? fitted : l2SurfaceGuard(l2Of(entry), fitted, modelHeight, entry.length, pitch, ARK_ENVIRONMENT.seaLevel.value);
        return {x: fix.x, z: fix.z, base, yaw: fix.yaw, pitch, roll: 0, afloat: true, water: spec};
    };

    const poseCore = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose => {
        // An act's pose, from a replayed event.
        if (entry.act) {
            const act = entry.act;
            // (Lying on its side after a catch, `meal-acts.ts`: rolled over, lowered onto the ground where it is drawn.)
            const lying = act.lying ? Math.sign(act.lying) * LYING_ROLL * Math.min(Math.abs(act.lying), 1) : 0;
            return {x: act.x, z: act.z, base: act.base, yaw: act.yaw, pitch: act.pitch, roll: act.roll + lying, afloat: act.base < -0.02 || act.base > Math.max(heightAt(act.x, act.z), 0) + 0.3};
        }
        // ARK-JUNGLE: a carried young rides its mother as she is drawn this frame (up a trunk, swinging, in flight).
        const riding = !reducedMotion && entry.animal.origin === "born" ? carriedPose(entry, time) : null;
        entry.riding = Boolean(riding);
        if (riding) return riding;
        const place = entry.place;
        if (entry.moment) {
            const at = momentAt(entry, model, modelHeight, time);
            if (at) return at;
        }
        // Lane TB: a town tank's resident (the aquarium's, a home's tank, a garden pond) swims in its tank's own water.
        const tank = island && !entry.visitor ? island.tankPose(entry.animal.id, entry.length, modelHeight, reducedMotion ? 0 : clockNow()) : null;
        if (tank) {
            // REAL-REPRODUCTION: out of a spawning pair's way (`reproNests`).
            let {x, z} = tank;
            for (const n of reproNests) {
                const dx = x - n.x;
                const dz = z - n.z;
                const d = Math.hypot(dx, dz);
                const r = n.r + entry.length * 0.5;
                if (d >= r) continue;
                const ux = d > 1e-4 ? dx / d : 1;
                const uz = d > 1e-4 ? dz / d : 0;
                x += ux * (r - d) * n.k;
                z += uz * (r - d) * n.k;
            }
            return {x, z, base: tank.base, yaw: tank.yaw, pitch: tank.pitch, roll: 0, afloat: true, water: tank.spec};
        }
        // p5 (homes): a pet indoors walks about its room's floor on the shared clock (`islands/town/home-rooms.ts`).
        const room = island && !entry.visitor && !tank ? island.roomPose(entry.animal.id, entry.length, reducedMotion ? 0 : clockNow()) : null;
        if (room) return {x: room.x, z: room.z, base: room.base, yaw: room.yaw, pitch: 0, roll: 0, afloat: false};
        // ARK-JUNGLE: a primate house resident that travels through trees goes out on the hall's climbing frames now and then
        // (up a post, along the beams the way its kind travels, back down: `islands/town/zoo-swing.ts`, the shared clock's).
        const swing = island && !entry.visitor && !tank && !room && !reducedMotion && !entry.act && island.held(entry.animal.id) ? island.zooSwing(entry.animal, entry.length, {x: place.x, y: place.ground, z: place.z}, worldMs() / 1000, !entry.state.asleep) : null;
        if (swing) return {x: swing.x, z: swing.z, base: swing.y, yaw: Math.atan2(swing.tx, swing.tz), pitch: 0, roll: 0, afloat: true, surface: swing};
        if (entry.depth && oceanRoams(entry)) return oceanPose(entry, entry.depth, modelHeight); // p2 (ocean)
        if (place.hamlet && !entry.visitor) {
            // A hamlet resident: on its spot when out, walking out of its door or back in, else at its door (drawn only when it is yours).
            // Out of doors, the collisions have the last word (out of the props, eased off the others: `collide/`).
            const outside = residentBase(entry);
            if (outside) {
                const epoch = worldMs() / 1000;
                const at = collisionsOn && world ? collisions.apply(entry, epoch, outside) : outside;
                entry.residentAt = {x: at.x, z: at.z, at: epoch};
                return {x: at.x, z: at.z, base: Math.max(heightAt(at.x, at.z), 0), yaw: outside.yaw, pitch: 0, roll: 0, afloat: false};
            }
            entry.residentAt = null;
            const door = plotSpots(place.hamlet.plot).door;
            return {x: door.x, z: door.z, base: Math.max(heightAt(door.x, door.z), 0), yaw: place.hamlet.plot.rotation, pitch: 0, roll: 0, afloat: false};
        }
        // Riders on their hosts and hoppers hopping (`riders.ts`): a flea on its cat, a tick on its horse, an oxpecker on its buffalo.
        if (!entry.visitor) {
            const ride = ridePose(entry, time);
            if (ride) return ride;
        }
        if (place.host && !entry.visitor) {
            // A partner on its host (map section 6): on its back, under a shark, at a grazer's feet, beside it, as the host moves now.
            const host = findEntry(place.host.id);
            if (host?.middle && !host.held) {
                const rider = place.host.role === "rider";
                const yaw = host.yawNow ?? place.yaw;
                const base = rider ? (host.place.water ? host.middle.y - host.drawnHeight * 0.55 : host.middle.y + host.drawnHeight * 0.45) : heightAt(host.middle.x + place.host.dx, host.middle.z + place.host.dz);
                return {x: host.middle.x + place.host.dx, z: host.middle.z + place.host.dz, base, yaw, pitch: 0, roll: 0, afloat: rider};
            }
        }
        if (scheduled(entry) && entry.sched!.pose && !(entry.depth && waterMotion(entry.depth) === "hole")) {
            const at = fromSchedule(entry, modelHeight);
            // Part C: a zoo animal never leaves its enclosure (the mask is its hard bound, whatever its schedule's route).
            if (island) island.bound(entry.animal.id, at);
            return at;
        }
        if (place.micro && !entry.visitor) {
            // A house starling in its flock's murmuration at dusk (`behaviour-recipes.ts`), else at its microhabitat.
            const flock = scheduleOn && !reducedMotion ? microMurmuration(entry.animal.id, entry.animal.model_slug, {x: place.x, y: place.ground, z: place.z}, worldMs() / 1000, hoursNow(), heightAt) : null;
            entry.recipeAct = flock?.act ?? null;
            // A swarm round a small animal's spot (bees at the hive by day, mayflies at dusk), or a crawling cluster.
            entry.recipeFlock = scheduleOn && !reducedMotion && !flock ? (swarmFlock(entry.animal.id, entry.animal.model_slug, {x: place.x, y: place.ground, z: place.z}, worldMs() / 1000, hoursNow()) ?? entry.power?.flock ?? null) : null;
            if (flock) return {x: flock.x, z: flock.z, base: flock.y, yaw: flock.yaw, pitch: 0.95 + flock.pitch, roll: flock.roll, afloat: true};
            // 3.3 batch (D): a pond dragonfly laying: low over the water near her spot, tapping her abdomen's tip to it.
            const laying = scheduleOn && !reducedMotion ? microDipOf(entry) : null;
            if (laying) {
                entry.recipeAct = laying.act;
                return {x: laying.x, z: laying.z, base: laying.y, yaw: laying.yaw, pitch: laying.pitch, roll: 0, afloat: true};
            }
            const resting = microPose(entry, reducedMotion ? 0 : time);
            // (Signature wave 2, birds: a house bird's roost at dusk: its kind's crowd round the spot it is drawn at.)
            if (!entry.recipeFlock && scheduleOn && !reducedMotion) entry.recipeFlock = microRoost(entry.animal.model_slug, {x: resting.x, y: resting.base, z: resting.z}, worldMs() / 1000, hoursNow(), entry.length);
            return resting;
        }
        // Off its schedule (reduced motion): on its perch, its back to the perch's normal.
        if (place.perch && !entry.visitor) return {x: place.perch.x, z: place.perch.z, base: place.perch.y, yaw: Math.atan2(place.perch.tx, place.perch.tz), pitch: 0, roll: 0, afloat: true, surface: place.perch};
        // (A bird of the air flies from its perch, and comes back to it to rest.)
        if (place.canopy && !entry.visitor && entry.air <= 0.001) return canopyPose(entry, reducedMotion ? 0 : time);
        if (place.burrow && !entry.visitor) return undergroundPose(entry, modelHeight, reducedMotion ? 0 : time);
        const plan = model?.behaviour?.plan ?? "";
        // A water species (`sea-depth.ts`): in its depth band, its whole body under the surface (a floater on it, a
        // bottom-dweller on the floor, an octopus in its hole), an air-breather up for air when its state says so.
        // (Only where it is placed in the water: a penguin or a seal standing on its shore has a band for its swims, not for its rest.)
        if (entry.depth && entry.place.water && !entry.visitor && entry.air <= 0.001) return waterPose(entry, entry.depth, modelHeight, time);
        // The reef's and the sea's bottom-dwellers (crabs, octopus, stars): on the sea floor.
        if (!entry.depth && atSeaOf(entry) && entry.layer.mode === "floor") {
            const sway = reducedMotion ? 0 : Math.sin(time * 0.25 + entry.phase * 9) * 0.25 * (1 - entry.rest);
            return {x: place.x + Math.cos(place.yaw) * sway, z: place.z - Math.sin(place.yaw) * sway, base: place.ground, yaw: place.yaw, pitch: 0, roll: 0, afloat: true};
        }
        const t = reducedMotion ? 0 : time;
        const site = ZONE_SITES[entry.animal.zone];
        // The visitor: at the jetty's foot, or a swimmer floating off its end.
        if (entry.visitor) {
            const swims = SWIMMING_PLANS.has(plan);
            const spot = swims ? VISITOR_LANDING.end : VISITOR_LANDING.foot;
            const ground = heightAt(spot.x, spot.z);
            const yaw = visitorYaw();
            return {x: spot.x, z: spot.z, base: swims ? -modelHeight * 0.35 : Math.max(ground, 0.05), yaw, pitch: 0, roll: 0, afloat: swims};
        }
        // Birds of the air: a wide circle above their zone, banked into the turn.
        if (entry.air > 0.001) {
            // A pair flies together: the mate a little behind on the first one's circle.
            const lead = entry.leader && !entry.leader.act && entry.leader.air > 0.5 ? entry.leader : null;
            const owner = lead ?? entry;
            const radius = 6 + owner.phase * 6;
            const angle = lead ? lead.loop - 0.22 * (entry.place.rank ?? 1) : entry.loop;
            const altitude = 9 + owner.phase * 6 + Math.sin(t * 0.4 + entry.phase * 7) * 0.8 + (lead ? 0.8 : 0);
            const centre = lead ? lead.place : place;
            const ax = centre.x + Math.cos(angle) * radius - radius;
            const az = centre.z + Math.sin(angle) * radius;
            const ground = Math.max(place.ground, 0);
            const yawAir = Math.atan2(-Math.sin(angle), Math.cos(angle));
            const k = easeInOut(entry.air);
            return {
                x: place.x + (ax - place.x) * k,
                z: place.z + (az - place.z) * k,
                base: ground + (altitude) * k,
                yaw: place.yaw + (yawAir - place.yaw) * k,
                pitch: 0.95 * k,
                roll: -0.35 * k,
                afloat: k > 0.5
            };
        }
        let base = place.ground;
        if (place.water && place.ground < -0.45) base = -(SWIMMING_PLANS.has(plan) ? 0.5 : 0.28) * modelHeight;
        else if (place.water) base = Math.max(place.ground, -0.3);
        // p3 (zoofix): a floater on water (the town's canal, ponds and pools) rides at its float line, never on the surface.
        const floatBand = (entry.swim ??= entry.place.micro ? null : swimDepth(entry.animal.model_slug, entry.animal.zone));
        const floatAt = (x: number, z: number) => (place.water ? null : floatOver(floatBand, heightAt(x, z), waterTopAt(x, z), modelHeight));
        const floating = floatAt(place.x, place.z);
        if (floating) base = floating.base;
        const wander = entry.wander;
        if (wander && (wander.x || wander.z) && !place.water) {
            // Walked off its spot (its rig's walk): on the ground where it is now.
            const x = place.x + wander.x;
            const z = place.z + wander.z;
            const afloat = floatAt(x, z);
            if (afloat) return {x, z, base: afloat.base, yaw: wander.heading, pitch: floatPitch(floatBand?.kind), roll: 0, afloat: true, water: afloat.water};
            const ground = Math.max(heightAt(x, z), 0);
            // A small one stands on the slope (the sampler's normal); a big one stays upright, as it always has.
            const surface = entry.trueLength < 0.5 ? onGround(x, ground, z, wander.heading) : undefined;
            const walked: Pose = {x, z, base: ground, yaw: wander.heading, pitch: 0.05 * entry.rest, roll: 0, afloat: false, ...(surface ? {surface} : {})};
            // p5 (rural): bound where it has walked to as well (a hen off her spot at dusk still goes in to roost).
            if (island && townIds.has(entry.animal.id)) island.bound(entry.animal.id, walked);
            return walked;
        }
        // Asleep: a little lower at the front, as the head goes down.
        if (floating && !wander?.x && !wander?.z) return {x: place.x, z: place.z, base, yaw: place.yaw, pitch: floatPitch(floatBand?.kind), roll: 0, afloat: true, water: floating.water};
        const still: Pose = {x: place.x, z: place.z, base, yaw: wander ? wander.heading : place.yaw, pitch: 0.05 * entry.rest, roll: 0, afloat: base < Math.max(place.ground, 0) - 0.01 || place.ground < 0};
        // p5 (rural): off its schedule too (asleep, at rest), a town animal's bound: a hen shut in her hen house at night.
        if (island && townIds.has(entry.animal.id)) island.bound(entry.animal.id, still);
        return still;
    };
    /**
     * sig-young: a young one whose ride is on the water only (`young-ways.ts` `rideWater`) gets down when its parent comes out
     * of the water and up when she goes in, over `RIDE_BLEND_MS`, from where it was drawn to where it is drawn now: a
     * cygnet steps off the swan's back at the bank and follows her up it, never jumping.
     */
    const pose = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose => {
        const out = poseCore(entry, model, modelHeight, time);
        if (reducedMotion || entry.animal.origin !== "born") return out;
        entry.rideWaterOnly ??= Boolean(waysOf(entry.animal.model_slug)?.rideWater);
        if (!entry.rideWaterOnly) return out;
        const now = worldMs();
        const riding = Boolean(entry.riding);
        if (entry.rideWas !== undefined && entry.rideWas !== riding && entry.rideLast) entry.rideBlend = {from: entry.rideLast, at: now};
        entry.rideWas = riding;
        let drawn = out;
        const blend = entry.rideBlend;
        if (blend) {
            const u = (now - blend.at) / RIDE_BLEND_MS;
            if (u >= 1 || u < 0) entry.rideBlend = null;
            else {
                const k = u * u * (3 - 2 * u);
                let turn = out.yaw - blend.from.yaw;
                while (turn > Math.PI) turn -= Math.PI * 2;
                while (turn < -Math.PI) turn += Math.PI * 2;
                drawn = {...out, x: blend.from.x + (out.x - blend.from.x) * k, z: blend.from.z + (out.z - blend.from.z) * k, base: blend.from.base + (out.base - blend.from.base) * k, yaw: blend.from.yaw + turn * k};
            }
        }
        entry.rideLast = {x: drawn.x, z: drawn.z, base: drawn.base, yaw: drawn.yaw};
        return drawn;
    };

    // MARK: Rigs

    /** On its own feet on land: where a rigged animal may walk about its spot. */
    const onFoot = (entry: Entry) =>
        !scheduled(entry) &&
        // (Lane TB: never out of its cage, vivarium, tank or zoo house: a town animal held there.)
        !(island && island.held(entry.animal.id)) &&
        !entry.visitor && !entry.place.micro && !entry.place.perch && !entry.place.canopy && !entry.place.burrow && !entry.place.water && !atSeaOf(entry) && entry.air <= 0.001 && !entry.act && !entry.moment;
    /** A number in [0, 1) for this animal and this count (the same every visit). */
    const wanderRandom = (entry: Entry, n: number) => {
        const x = Math.sin(entry.phase * 12.9898 * 1000 + n * 78.233) * 43758.5453;
        return x - Math.floor(x);
    };
    const groundClip = (slug: string): RigClipData | null => rigs.clip(slug, "walk") ?? rigs.clip(slug, "slither") ?? rigs.clip(slug, "hop");

    /**
     * A rigged animal on land walks about its spot now and then: out a few
     * body lengths onto open ground, a while there, and back. Only while its
     * rig is fully in (so its feet move with it, at its walk's own ground
     * speed); it stops where it is when the rig is to go, or it falls asleep,
     * or it is looked at.
     */
    const stepWander = (entry: Entry, modelScale: number, dt: number, now: number) => {
        if (!onFoot(entry) || reducedMotion) {
            if (entry.wander) entry.wander.walking = false;
            return;
        }
        const clip = groundClip(entry.animal.model_slug);
        if (!clip?.ground_speed) {
            if (entry.wander) entry.wander.walking = false;
            return;
        }
        const place = entry.place;
        const wander = (entry.wander ??= {x: 0, z: 0, heading: place.yaw, walking: false, until: now + 3 + entry.phase * 6, tx: 0, tz: 0, trips: 0});
        // Only awake (its one behaviour state); being looked at or followed changes nothing.
        const free = Boolean(entry.rigOn) && (entry.rig?.weight ?? 0) >= 0.999 && entry.state.kind === "awake";
        if (!free) {
            wander.walking = false;
            wander.until = Math.max(wander.until, now + 2);
            return;
        }
        if (wander.walking) {
            const dx = wander.tx - wander.x;
            const dz = wander.tz - wander.z;
            const left = Math.hypot(dx, dz);
            let turn = Math.atan2(dx, dz) - wander.heading;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            const most = 1.6 * dt;
            wander.heading += Math.min(Math.max(turn, -most), most);
            // Slowly while it turns towards where it is going; at its walk's own speed once it faces it.
            const speed = clip.ground_speed! * modelScale * (Math.abs(turn) > 0.6 ? 0.3 : 1);
            const step = Math.min(speed * dt, left);
            if (left <= Math.max(step * 1.5, 0.004) || left < 0.12 * entry.length) {
                wander.walking = false;
                wander.until = now + 5 + 10 * wanderRandom(entry, wander.trips + 0.25);
                return;
            }
            wander.x += Math.sin(wander.heading) * step;
            wander.z += Math.cos(wander.heading) * step;
            return;
        }
        if (now < wander.until) return;
        wander.trips++;
        let tx = 0;
        let tz = 0;
        if (Math.hypot(wander.x, wander.z) < 0.2 * entry.length) {
            // Out onto open ground: dry land about as high as its spot.
            const angle = wanderRandom(entry, wander.trips) * Math.PI * 2;
            const reach = Math.min(Math.max(entry.length * (1.5 + 2.5 * wanderRandom(entry, wander.trips + 0.5)), 0.35), 6);
            tx = Math.sin(angle) * reach;
            tz = Math.cos(angle) * reach;
            const level = Math.max(place.ground, 0);
            for (const f of [0.35, 0.7, 1]) {
                const h = heightAt(place.x + tx * f, place.z + tz * f);
                if (h < 0.05 || Math.abs(h - level) > Math.max(0.8, entry.length)) {
                    wander.until = now + 4;
                    return;
                }
            }
        }
        wander.tx = tx;
        wander.tz = tz;
        wander.walking = true;
    };

    const rigHere = new Vector3();
    const rigLift = new Vector3();
    /** Movers rigged from the island view and the cheap gait of the rest (development: `window.__arkMoverGait = false` before mounting turns both off, to compare). */
    const moverGait = (globalThis as {__arkMoverGait?: boolean}).__arkMoverGait !== false;
    /** The reactive layer's actions that have an animal watching something: it stops feeding and lifts its head to look. */
    const WATCHING_ACTIONS: ReadonlySet<string> = new Set(["scan", "watch_camera", "investigate_camera", "back_off_camera", "sentinel", "alert", "freeze", "threat_display", "watch_prey", "startle", "look_kin", "shield_young"]);
    const rigGrip = new Vector3();
    /**
     * An animal's rig this frame, when it has one ready and is close enough:
     * fades it in or out (never in the middle of a peek out of its burrow),
     * picks the clip for what the scene is doing with it, and moves the clip
     * on — by the distance it moved for walking, running, climbing, slithering,
     * hopping and swimming (so the feet stay planted whatever the pace), with
     * the path for a leap or a burrow's emerge, by time otherwise. Null: draw
     * it procedural. The clip follows the animal's one behaviour state
     * (`behaviour-state.ts`): asleep, its idle (slowed); flying, its flight
     * clips when its rig flies (`rigFlies`: the set's and the species'
     * approval, rig contract 3.1): a take-off as it leaves the ground, then
     * flap, glide, soar, hover or a bank into the turn (`flightClip`), and a
     * landing as it comes down, after which it walks with its wings closed;
     * a rig that does not fly fades out in the air (the procedural flight).
     * Awake, what the scene is doing with it, and the schedule's beat where
     * the rig has a clip for it (`beatClip`: graze, browse, scan, shake_off,
     * into and out of the water).
     */
    /** ARK-CONTACT: a body with legs under it (its belly above `LEGLESS_BELLY`): a snake's or a slug's lies as it is. */
    const legsUnder = (geometry: BufferGeometry | null): boolean => {
        if (!geometry) return false;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return bellyOfGeometry(geometry) >= LEGLESS_BELLY;
    };
    const rigFor = (entry: Entry, model: SpeciesModel, where: Pose, modelScale: number, dt: number): RigModel | null => {
        const slug = entry.animal.model_slug;
        entry.sleepClipped = false;
        const rig = rigs.get(slug);
        const turned = (d: number) => ((Math.round(d) % 360) + 360) % 360;
        if (!rig || model.placeholder || turned(rig.facingDeg) !== turned(model.facing)) {
            if (entry.rig) entry.rig.weight = 0;
            return null;
        }
        const state = (entry.rig ??= newRigState());
        // Reduced motion: no rigs (the scene's clock stands still, so nothing would fade): straight back to the near model.
        if (reducedMotion) {
            state.weight = 0;
            state.last = null;
            return null;
        }
        const flies = rigFlies(rig);
        const grounded = !entry.state.airborne && entry.air <= 0.001;
        // ARK-ANIM (decision 447, the owner's bears and hogs at rest): asleep on a rig with no sleeping clip of its own
        // (a four-legged rig's lying clips are held, `rig-clips.ts` QUADRUPED_LYING_HELD), the rig fades out and the
        // near model lies in the scene's own posture (`sleep.ts`: lowered onto its chest, the legs folded under it): the
        // rig only stood there playing its idle.
        const sleepsOff = Boolean(entry.sleepNow?.down) && !entry.act && grounded && !sleepClipOf(rig, entry.sleepNow!.posture);
        const target = entry.rigOn && !entry.visitor && (grounded || flies) && !sleepsOff ? 1 : 0;
        const peeking = (entry.peek ?? -1) >= 0;
        if (!peeking) state.weight = Math.min(Math.max(state.weight + Math.min(Math.max(target - state.weight, -dt / RIG_BLEND_SECONDS), dt / RIG_BLEND_SECONDS), 0), 1);
        rigHere.set(where.x, where.base, where.z);
        const turnYaw = state.yaw; // gfx (PLACE): the heading it was drawn at last frame
        // Its path's climb and turn (for the flight clips), eased so a frame's jitter never flips flap and glide.
        if (state.last && dt > 0) {
            const dx = where.x - state.last.x;
            const dz = where.z - state.last.z;
            const flat = Math.hypot(dx, dz);
            const climbNow = flat > 1e-5 ? Math.atan2(where.base - state.last.y, flat) : 0;
            let dyaw = state.yaw === null ? 0 : where.yaw - state.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            const ease = Math.min(dt * 4, 1);
            // The drawn yaw: the shared heading plus the reactive layer's body turn (`stepReactive` adds it to the pose
            // before this runs), so an animal turned round to flee runs forwards, not in reverse.
            if (flat < 3) state.reverse = stepReverses(state.reverse, dx, dz, where.yaw);
            if (flat < 3) {
                state.climb += (climbNow - state.climb) * ease;
                state.sink = (state.sink ?? 0) + ((state.last.y - where.base) / dt - (state.sink ?? 0)) * ease;
                state.turn += (dyaw / dt - state.turn) * ease;
            }
        }
        state.yaw = where.yaw;
        const groundSpeed = state.last && dt > 0 ? Math.hypot(where.x - state.last.x, where.z - state.last.z) / dt : 0;
        let moved = state.last ? rigHere.distanceTo(state.last) / Math.max(modelScale, 1e-6) : 0;
        // A jump (a new spot, an act's cut): no stride for it.
        if (moved > 3) moved = 0;
        // gfx (PLACE): a turn on the spot on the ground steps its feet round (`turnSteps`), never a pivot with its feet still.
        if (grounded && !where.afloat && !where.water && state.last && turnYaw !== null) moved = Math.hypot(moved, turnSteps(where.yaw - turnYaw, dt, entry.length) / Math.max(modelScale, 1e-6));
        state.last = (state.last ?? new Vector3()).copy(rigHere);
        // ARK-ANIM: hops along its way in its own pose (`hop-gait.ts`), for a rig with no clip to move by.
        const hopAlong = () => {
            const hop = stepHop((entry.hop ??= newHopState()), groundSpeed * dt < 3 ? groundSpeed * dt : 0, dt, entry.length);
            const w = state.weight;
            where.x -= Math.sin(where.yaw) * hop.back * w;
            where.z -= Math.cos(where.yaw) * hop.back * w;
            where.base += hop.lift * w;
            where.pitch += hop.pitch * w;
        };
        if (state.weight <= 0) {
            // Out of its rig: back on its feet (the near model's rest pose) for when it comes back.
            state.base = "stand";
            state.toward = null;
            // (ARK-CONTACT: and when it comes back, straight into the pose it is in then, no transition: `entering`.)
            state.entering = true;
            return null;
        }
        // Its pace for choosing the clip, eased over about a fifth of a second (the clip's phase still follows the real distance).
        if (dt > 0) state.pace += (moved / dt - state.pace) * Math.min(dt * 5, 1);
        const speed = state.pace;
        const clip = (name: string) => rigs.clip(slug, name);
        const moving = (move: RigClipData | null): move is RigClipData => Boolean(move?.ground_speed) && speed > move!.ground_speed! * (state.now.name === move!.name ? 0.12 : 0.3);
        let want: string | null = null;
        let mode: "distance" | "time" | "sync" = "time";
        let sync = 0;
        /** Lane MA3: still on the water, its float idle (below) where nothing else plays, never its standing idle under the surface. */
        let floatIdle = false;
        /** A time-played clip's pace (a swim's, by how fast it goes). */
        let rate = 1;
        const place = entry.place;
        const up = where.surface ? where.surface.ny : 1;
        // On a steep trunk or wall: head first down it plays climb_down where the rig has one (its schedule pose says
        // `down`, or it is sinking faster than a tenth of its length a second), else its climb.
        const climber = () => {
            // (p5 (monkeys): one backing down a trunk tail first plays its climb, not a head-first climb_down.)
            const posed = own?.pose as {down?: boolean; backing?: boolean} | null | undefined;
            const name = climbClipName(up, Boolean(posed?.down) || (!posed?.backing && (state.sink ?? 0) > entry.length * 0.1), (n) => Boolean(clip(n)));
            return name ? clip(name) : null;
        };
        const own = entry.sched && scheduled(entry) ? entry.sched : null;
        // (ARK-CANOPY: how far through a leap on its canopy route it is, or null: `canopy-scene.ts`.)
        const canopyLeap = (where.surface as {leap?: number | null} | undefined)?.leap ?? null;
        // A behaviour recipe's act (`behaviour-recipes.ts`): on its schedule pose, or a house starling's own.
        const recipeAct = ((own?.pose ?? null) as RecipePose | null)?.act ?? entry.recipeAct ?? null;
        // In the air: on its schedule, from the moment an air leg starts (the pose counts as aloft only a little way up,
        // and the take-off plays from the ground); otherwise as its state's air eases in.
        const pose = own?.pose ?? null;
        const airLeg = Boolean(pose && pose.moving && (pose.beat === "fly" || pose.beat === "glide"));
        // (Lane L2: a small flyer off its microhabitat's surface, a moth round the porch light or a starling in its
        // murmuration, flies on its rig too: it has no schedule pose to say so. On its leaf, bark or wall it is not flying.)
        const microAloft = Boolean(place.micro && flies && !entry.visitor && ((entry.toLight ?? 0) > 0.5 || (entry.recipeAct?.flock && where.base - Math.max(heightAt(where.x, where.z), 0) > Math.max(entry.length * 1.5, 0.12))));
        const inAir = (pose ? pose.aloft || airLeg : entry.air > 0.001) || microAloft;
        // (MA1: its air leg's stage on the schedule: a run to take off, the climb, level flight, the glide-in, a ski.)
        const stage = (pose && airLeg ? pose.air?.stage : null) ?? null;
        // Heading up from the start of an air leg (not the tail of a flight whose landing has played): only then does it take off.
        const rising = (pose ? pose.aloft || (airLeg && (stage ? stage === "run" || stage === "climb" : state.climb > -0.01 && clockNow() - state.landedAt > 2)) : entry.state.airborne) || microAloft || Boolean(entry.birdAloft && entry.act); // 3.3 batch (B): a bird's own move in the air
        // Coming down: the landing plays as it touches down (its wings folding away), once it is low and descending on
        // its schedule's leg, or its state's air has nearly eased out.
        // (Lane L2: within the landing clip's reach of the ground on the way down, so its touch-down meets the ground.)
        // (MA1: its height over the surface it lands on, the schedule's own: a perch, a rock's top, the lake's level;
        // from the terrain under it, a landing on any of those never fired and the clip played after touch-down.)
        const agl = pose?.air ? where.base - pose.air.to : where.base - Math.max(heightAt(where.x, where.z), 0);
        const landHeight = (clip("land")?.rise_h ?? 1.2) * entry.drawnHeight;
        const landing = !microAloft && ((pose ? (!pose.aloft && (stage ? stage === "descend" || stage === "ski" : state.climb < -0.01)) || !inAir : !entry.state.airborne && entry.air < 0.2) || l2LandingNow(l2Of(entry, model.behaviour?.plan), agl, state.climb, landHeight));
        // Leaving the ground: a take-off, unless it comes into view already up in the air or runs off (`flightGate`).
        const gate = l2FlightGate({flies, flying: state.flying, inAir, rising, landing, air: entry.air, now: state.now.name, phase: state.now.phase, stage, hasTakeoff: Boolean(clip("takeoff")), hasLand: Boolean(clip("land"))});
        if (gate.play === "takeoff" || gate.play === "land") rigSwitch(state, gate.play, 0);
        // (A landing left from a flight cut short: dropped for whatever the flight frame picks now.)
        const leaveOneShot = gate.play === "flight";
        if (state.flying && !gate.flying) {
            // Down (or out of the air): its pace starts again from how fast it moves now, not eased down from its flight's
            // (MA1: a coot ran in place for 0.8 s after landing on its eased flight pace).
            state.pace = dt > 0 ? moved / dt : 0;
            if (gate.landed) state.landedAt = clockNow();
        }
        state.flying = gate.flying;
        const oneShot = (name: string) => !leaveOneShot && state.now.name === name && state.now.phase < 1;
        if (state.flying) {
            // Lane L2 (`locomotion/flight.ts`): the beat by its size and effort (hard flaps out of a take-off, a flare to
            // land), the downstroke the fuller stroke, its family's rhythm (bounding, flap-gliding, soaring with trims), the
            // bank of a coordinated turn and a heave in time with the beat. Species with no flight style keep `flightClip`.
            const l2 = l2Of(entry, model.behaviour?.plan);
            const frame = l2FlightFrame(l2, entry.trueLength, {
                has: (name) => Boolean(clip(name)),
                clipHz: (name) => clip(name)?.flap_hz ?? null,
                current: state.now.name,
                phase: state.now.phase,
                climb: state.climb,
                turn: state.turn,
                speed: groundSpeed,
                agl,
                drawnLength: entry.length,
                drawnHeight: entry.drawnHeight,
                landHeight,
                stage,
                // (A v7 file's flight clips bake their own beat, fold and tuck: MA2's v3 birds.)
                bake: (name) => l2ClipBake(rig.code, clip(name)),
                beat: own?.pose?.beat ?? null,
                soaring: own?.pose?.doing === "soar",
                oneShot: oneShot("takeoff") ? "takeoff" : oneShot("land") ? "land" : null,
                actState: recipeAct?.state ?? (entry.act as {state?: string | null} | null | undefined)?.state ?? null,
                clock: clockNow(),
                seed: entry.phase,
                dt,
                open: rig.flightOpen
            });
            if (frame && clip(frame.clip)) {
                want = frame.clip;
                mode = frame.mode;
                sync = frame.phase;
                rate = frame.rate;
                const w = state.weight;
                where.pitch = where.pitch * (1 - w) + (frame.pitch + (recipeAct?.pitch ?? 0)) * w;
                where.roll = where.roll * (1 - w) + (frame.roll + (recipeAct?.roll ?? 0)) * w;
                where.base += frame.heave * w;
            } else {
                if (oneShot("takeoff") || oneShot("land")) {
                    want = state.now.name;
                } else if (recipeAct?.state === "plunge" && clip("plunge")) {
                    // A dive from the air: streamlined, wings closed (contract 8.4; the recipe pitches it nose down).
                    want = "plunge";
                } else {
                    const glideClip = clip("glide") ?? clip("soar");
                    want = flightClip({
                        has: (name) => Boolean(clip(name)),
                        current: state.now.name,
                        climb: state.climb,
                        turn: state.turn,
                        speed: groundSpeed / Math.max(entry.length, 0.01),
                        beat: own?.pose?.beat ?? null,
                        soaring: own?.pose?.doing === "soar",
                        clock: clockNow(),
                        seed: entry.phase,
                        glideShare: glideClip?.glide_share,
                        open: rig.flightOpen
                    });
                    // No open-wing loop: the take-off's last frame held (wings spread), never the closed rest pose.
                    if (want === OPEN_WINGS_HOLD) {
                        mode = "sync";
                        sync = 1;
                    }
                }
                if (want) {
                    // The rig levels the body in flight itself: the instance keeps only its path's climb, and rolls into a
                    // turn only when no bank clip does it (soaring on its circle a little, flapping hardly).
                    const w = state.weight;
                    const banking = want === "bank_l" || want === "bank_r";
                    const into = Math.max(-1, Math.min(1, state.turn / 0.2));
                    // (A recipe's attitude stays on top: a plunge nose down.)
                    where.pitch = where.pitch * (1 - w) + (-0.6 * state.climb + (recipeAct?.pitch ?? 0)) * w;
                    where.roll = where.roll * (1 - w) + ((banking ? 0 : -0.35 * into * (want === "soar" ? 1 : 0.4)) + (recipeAct?.roll ?? 0)) * w;
                }
            }
        } else if (entry.sleepNow?.down && !entry.act) {
            // Asleep (`sleep.ts`; woken here by the reactive layer it is not, and gets up): its sleep posture where the
            // rig has one (contract 8.2: lying down first, `baseStep`), the night's own posture first
            // (`sleepPostureClips`: a lion on its side tonight plays sleep_side), else the rig's own, else its idle, slow
            // (and the head lowered by the material's droop); never a walk.
            const own = sleepPostureClips(entry.sleepNow.posture).find((name) => Boolean(clip(name))) ?? null;
            const posture = own ?? (place.canopy?.mode === "hang" && clip("sleep_hang") ? "sleep_hang" : null) ?? (where.water && clip("sleep_float") ? "sleep_float" : null) ?? ASLEEP_CLIPS.find((name) => Boolean(clip(name))) ?? null;
            if (posture) want = posture;
        } else if (place.canopy && !entry.visitor) {
            const kind = place.canopy.mode;
            const move = climber() ?? clip("walk") ?? clip("climb");
            if (kind === "hang" && clip("hang")) want = "hang";
            else if (kind === "leap" && (entry.leapK ?? 0) > 0 && clip("leap")) {
                want = "leap";
                mode = "sync";
                sync = entry.leapK!;
            } else if (kind === "perch" && clip("perch")) want = "perch";
            else if (moving(move)) {
                want = move.name;
                mode = "distance";
            } else if (!move) hopAlong();
        } else if (place.micro && !entry.visitor) {
            const move = climber() ?? clip("walk") ?? clip("climb") ?? clip("slither") ?? clip("hop");
            if (moving(move)) {
                want = move.name;
                mode = "distance";
            }
        } else if (place.burrow && !entry.visitor) {
            const peek = entry.peek ?? -1;
            if (peek >= 0 && clip("emerge") && clip("burrow")) {
                if (peek < 0.35) {
                    want = "emerge";
                    mode = "sync";
                    sync = peek / 0.35;
                } else if (peek > 0.65) {
                    want = "burrow";
                    mode = "sync";
                    sync = (peek - 0.65) / 0.35;
                }
            } else {
                const move = clip("walk");
                if (moving(move)) {
                    want = move.name;
                    mode = "distance";
                }
            }
        } else if (where.edge && !entry.visitor && clip(where.edge.mode === "enter" ? "enter_water" : "exit_water")) {
            // Into the water or out of it (lane MA3, the movement audit's goose: it paddled down the bank and through the
            // slide, and its entry played for 0.13 s once afloat): its entry or exit clip by how far along the slide it is,
            // the pose settling it from standing to its float line the while (`fromSchedule`). A rig with no such clip
            // (a seal, an otter: MA2's list) plays its gait by its speed, as before.
            want = where.edge.mode === "enter" ? "enter_water" : "exit_water";
            mode = "sync";
            sync = where.edge.u;
        } else if (!entry.visitor && where.underwater) {
            // Lane MA3: under the surface in its own dive: its swim, else its paddle, by the distance it covers (its dive clip
            // plays from the recipe below), never a walk on the bed.
            const swim = clip("swim") ?? clip("paddle");
            if (moving(swim)) {
                want = swim.name;
                mode = "distance";
            }
        } else if (!entry.visitor && where.water) {
            // In the water, in its depth band (`sea-depth.ts`; on land, a seal or a duck walks like any walker): a seabed crab or lobster walks its slow loop on the
            // floor (feet planted: phase by distance); a swimmer swims (or a snake or eel slithers) at the pace it goes;
            // a floater and a hole-dweller keep their idle.
            // (Lane MA3: any animal with a band in the water, `swimDepth`, a coot as well as a duck: its band is its pose's.)
            const motion = where.water.motion;
            if (motion === "walk") {
                const move = clip("walk") ?? clip("slither") ?? clip("run");
                if (moving(move)) {
                    want = move.name;
                    mode = "distance";
                }
            } else if (motion === "swim") {
                const swim = clip("swim") ?? clip("slither");
                if (swim) {
                    want = swim.name;
                    // (Lane L2: at the tail-beat rate its speed asks for, `tailBeatHz`; the clip's own pace otherwise.)
                    rate = l2SwimRate(l2Of(entry, model.behaviour?.plan), speed / Math.max(entry.length / Math.max(modelScale, 1e-6), 1e-3), swim.seconds) ?? (swim.ground_speed ? Math.min(Math.max(speed / swim.ground_speed, 0.5), 1.6) : 1);
                }
            }
            // Moving at the surface with no swim of its own (a duck, a seal, a turtle): its paddle, by distance (contract 8.4).
            const paddle = want ? null : clip("paddle");
            if (moving(paddle)) {
                want = "paddle";
                mode = "distance";
            } else if (motion === "float") floatIdle = true;
        } else if (place.water && !entry.visitor && (clip("swim") || clip("slither"))) {
            // Standing water with no band (an anaconda in the wetland's pool): it swims where it lies.
            want = clip("swim") ? "swim" : "slither";
            rate = 0.6;
        } else if (atSeaOf(entry) && SWIMMING_PLANS.has(model.behaviour?.plan ?? "")) {
            const swim = clip("swim");
            if (swim) {
                want = "swim";
                mode = swim.ground_speed ? "distance" : "time";
            }
        } else if (!entry.visitor && typeof canopyLeap === "number" && clip("leap")) {
            // ARK-CANOPY: a leap from crown to crown on its canopy route (`canopy-travel.ts`): its own leap clip through the
            // arc (crouch, spring, reach, land), not a run spun at the leap's speed.
            want = "leap";
            mode = "sync";
            sync = canopyLeap;
        } else if (!flies && (entry.air > 0.001 || entry.state.airborne)) {
            // Leaving the ground or coming down on a rig that does not fly (it fades out in the air): its idle, never a
            // walk spun at the flight's speed.
        } else {
            // The ground clip whose own pace fits how fast it goes (a walk, a run, a hop for a hopping bird).
            // (ARK-ANIM: a sitting hopper's `bound` too, through its `drop` onto its fore feet: 36 rigs, the rabbits, hares,
            // wallabies and jerboas, have no other way to go and slid along on their idle.)
            const gaits = ["walk", "trot", "run", "hop", "slither", "bound"].map((name) => clip(name)).filter((c): c is RigClipData => Boolean(c));
            const pick = paceClip(speed, gaits, state.now.name);
            if (moving(pick)) {
                want = pick.name;
                mode = "distance";
            } else if (speed > 1e-3 && clip("slither") && !clip("walk") && l2Of(entry, model.behaviour?.plan).style.legless) {
                // (Lane L2: a legless animal creeping slower than its slither's own pace still crawls, a heavy snake
                // straight on its belly: the chain driver poses it by the distance it moves.)
                want = "slither";
                mode = "distance";
            }
            // ARK-ANIM (decision 447): a rig with no moving clip at all (a sitting or upright rest pose: wallabies, hares,
            // jerboas, sifakas, the siamang) hops along its way in its pose instead of sliding on its idle (`hop-gait.ts`).
            if (!gaits.length && !clip("slither")) hopAlong();
            else if (entry.hop) entry.hop = undefined;
        }
        // The reactive layer's action (`reactive.ts`, intelligence-review-30 section 6), on its own feet on land: a flee
        // runs (or walks, without a run) by the distance it covers, so the feet keep up at any flee speed; a sentinel
        // stands up and scans (its idle, upright, without a scan); withdrawn or frozen, it holds its idle, low (the
        // reactive crouch lowers the body).
        const action = !state.flying && !entry.visitor && !place.canopy && !place.micro && !place.burrow && !where.water ? entry.reactive?.action ?? null : null;
        const walkNow = groundClip(slug);
        const reacting = reactiveClip(action, (name) => Boolean(clip(name)), !walkNow?.ground_speed || speed > walkNow.ground_speed * 1.2);
        if (reacting && (!reacting.byDistance || moving(clip(reacting.name)))) {
            want = reacting.name;
            mode = reacting.byDistance ? "distance" : "time";
        }
        // While the reactive layer has it watching something (the camera, a predator, its kin), it stops feeding and lifts
        // its head: its idle, the look turning the head.
        const watching = Boolean(entry.reactive && entry.reactive.headWeight > 0.3 && WATCHING_ACTIONS.has(entry.reactive.action));
        const headDown = (name: string | null) => name === "graze" || name === "browse" || name === "scan";
        // A recipe's named state where a clip expresses it (`RECIPE_CLIPS`; docs/ark/rig-player.md): a travel state by the
        // distance it covers while it moves, a one-shot (into or out of the water, a take-off, a shake) from its start, a
        // hold when nothing else plays. Otherwise its block's beat (below) plays.
        const reacted = Boolean(reacting && want === reacting.name);
        // (A meal's act, `meal-acts.ts`: head down feeding, a glance up, lying up to rest, on the rig's own clips.)
        const mealState = !recipeAct && entry.act?.meal && entry.act.state && MEAL_CLIP_STATES.has(entry.act.state) ? entry.act.state : null;
        const recipeRaw = !state.flying && !reacted && (recipeAct || mealState) ? recipeClip(sleepState(recipeAct?.state ?? mealState), (name) => Boolean(clip(name))) : null;
        // A rig with a sit (a pilot cat's or dog's) rests sitting up rather than lying, about half of them (by its own phase).
        const fromRecipe = recipeRaw?.name === "lie" && clip("sit") && entry.phase < 0.5 ? {...recipeRaw, name: "sit"} : recipeRaw;
        let byRecipe = false;
        if (fromRecipe && !(watching && headDown(fromRecipe.name))) {
            if (fromRecipe.play === "distance") {
                const move = clip(fromRecipe.name);
                if (moving(move)) {
                    want = move.name;
                    mode = "distance";
                    byRecipe = true;
                } else if (fromRecipe.still) {
                    // Where the rivals meet: the clash itself, once.
                    want = fromRecipe.still;
                    mode = "time";
                    byRecipe = true;
                }
            } else if (fromRecipe.play === "once" || !want || want === "idle" || (where.water && want === "paddle" && fromRecipe.name !== "paddle")) {
                // (Lane MA3: on the water a recipe's own state plays through its drift, a dabbler's up-end as it paddles on.)
                want = fromRecipe.name;
                mode = "time";
                byRecipe = true;
            }
        }
        // The schedule's beat picks its own clip where the rig has one (graze, browse, scan, shake_off, into and out of
        // the water); a water animal in its depth band keeps the band's place (`PATH_CARRIED_CLIPS`).
        let beat = !state.flying && !byRecipe && !reacted && own?.pose ? beatClip(own.pose.beat, own.pose.doing, (name) => Boolean(clip(name))) : null;
        if (watching && headDown(beat)) beat = null;
        if (beat && (!want || want === "idle")) want = beat;
        // (Lane MA3.) Still on the water: its paddle held slow, body level and feet under it, the float idle; and never a
        // walk, a run or a hop on the surface (the audit's coot ran on the lake).
        const afloat = (where.water && (where.water.motion === "float" || where.water.motion === "swim")) || Boolean(where.underwater);
        if (afloat && (want === "walk" || want === "run" || want === "hop")) {
            want = null;
            floatIdle = where.water?.motion === "float";
        }
        if ((!want || want === "idle") && floatIdle && clip("paddle")) {
            want = "paddle";
            mode = "time";
            rate = FLOAT_IDLE_RATE;
        }
        if (!want && clip("idle")) want = "idle";
        if (!want) {
            // Nothing for standing still (an idle that did not pass): its moving clip held at its first frame.
            const any = Object.values(rig.clips)[0];
            if (!any) return null;
            want = any.name;
            mode = "sync";
            sync = 0;
        }
        // Powers you can see: its species' Blender Power clip while its Power shows (`power-clips.ts`), over its own.
        const powerClip = !reducedMotion && !state.flying ? entry.power?.clip ?? null : null;
        if (powerClip && rig.clips[powerClip]) {
            want = powerClip;
            mode = "time";
            rate = 1;
        }
        // Development only (the rig harness's `clips_<slug>` scene): a clip forced on one animal by id, played in time,
        // its base pose taken as the clip's own (no transitions). Never set by the site.
        const forced = (globalThis as {__arkRigForce?: Record<string, string>}).__arkRigForce?.[entry.animal.id];
        if (forced && rig.clips[forced]) {
            want = forced;
            mode = "time";
            rate = 1;
            state.base = clipBase(rig.clips[forced]);
            state.toward = null;
        } else if (state.toward && state.now.name === state.toward.clip && state.now.phase >= 1) {
            state.base = state.toward.ends;
            state.toward = null;
        }
        if (state.toward && state.now.name === state.toward.clip) {
            want = state.toward.clip;
            mode = "time";
        } else {
            state.toward = null;
            const target = clipBase(rig.clips[want]);
            // ARK-CONTACT: back in its rig after a level swap (a zoom), it is already in the pose its behaviour holds: that
            // pose's own clip from its steady phase, no lie_down or get_up played for a change the schedule never made.
            if (state.entering && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkZoomFixOff?: boolean}).__arkZoomFixOff)) state.base = target;
            const urgent = entry.reactive?.action === "flee" || entry.reactive?.action === "alert" || entry.reactive?.action === "startle";
            const step = baseStep(state.base, target, (name) => Boolean(rig.clips[name]), urgent);
            if (step) {
                state.toward = step;
                want = step.clip;
                mode = "time";
            } else if (state.base !== target && target === "stand") {
                // No way back up in this file: stand again (the rest pose), as the rig always could.
                state.base = "stand";
            } else if (state.base !== target) {
                // No way into that pose: its idle where it is.
                want = clip("idle") ? "idle" : want;
            }
        }
        // On its side by itself (contract 8.1, `sleep_side`): no recipe roll on top.
        if (want === "sleep_side" && recipeAct?.roll) where.roll -= recipeAct.roll * state.weight;
        // A sleep posture, a lying base or the way down and up draws the posture itself (the head, the drop, the breath):
        // the procedural one (`sleep.ts` sleepDraw) gives way to it as the rig fades in.
        state.entering = false;
        entry.sleepClipped = clipDrawsSleep(want, clipBase(rig.clips[want]));
        const playing = rig.clips[want];
        if (!playing) return null;
        // Each animal's loops start at its own point (no herd stepping in time); a one-shot from its start.
        rigSwitch(state, want, mode === "sync" ? sync : playing.loop ? entry.phase : 0);
        // By distance, up to 3.5 times the clip's own pace (a flee is capped at the gait's 2.5: the feet never slide).
        // ARK-ANIM (decision 447, the owner's blue-tongued skink "too shaky"): never more than GAIT_HZ_MAX cycles a second.
        // A short-legged clip played by the distance covered ran its legs at 20-30 cycles a second (the skink's 0.12 s
        // run at 3.5 times its pace), a blur of shaking at 60 frames a second; above that the feet slide a little instead.
        if (mode === "distance") state.now.phase += Math.min(cyclesFor(playing, moved), (dt / playing.seconds) * 3.5, dt * GAIT_HZ_MAX) * (state.reverse ? -1 : 1);
        else if (mode === "sync") state.now.phase = sync;
        else state.now.phase += (dt / playing.seconds) * (want === "idle" ? 1 - 0.65 * entry.rest : rate);
        state.ratio = mode === "distance" && playing.ground_speed && dt > 0 ? moved / dt / playing.ground_speed : 0;
        if (state.from) {
            state.fade += dt / RIG_FADE_SECONDS;
            const from = rig.clips[state.from.name];
            if (from && from.loop) state.from.phase += dt / from.seconds;
            if (state.fade >= 1 || !from) state.from = null;
        }
        rig.usedAt = lastUpdate;
        return rig;
    };

    /** The rigged near mesh of a species (its own geometry, the near level's skin, its bone texture). */
    const instancedRigFor = (model: SpeciesModel, rig: RigModel, needed: number): InstancedMesh | null => {
        const meshes = speciesMeshes(model.slug);
        let mesh = meshes.rig ?? null;
        if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
        const capacity = Math.max(needed, 4, mesh ? mesh.instanceMatrix.count * 2 : 0);
        let material = meshes.rigMaterial ?? null;
        if (!material) {
            const box = (model.near ?? model.far)?.geometry.boundingBox ?? rig.geometry.boundingBox!;
            material = animalMaterial({
                map: model.near?.map ?? model.far?.map ?? null,
                behaviour: model.behaviour,
                minY: box.min.y,
                maxY: box.max.y,
                animated: true,
                rig: rig.texture,
                pose: rig.loco?.live.texture ?? null,
                lookChain: rig.look,
                lookOff: rig.lookOff,
                level: "near",
                look: speciesLook(model.slug, model.behaviour?.plan, model.facing, model.near?.geometry ?? rig.geometry),
                bodyMotion: l2BodyUniforms(model.slug, model.behaviour),
                tailHabit: tailHabitOf(model.slug) // 3.3 batch (B): tail pump, cock and fan
            });
            look.track(model.slug, material);
            meshes.rigMaterial = material;
        }
        if (mesh) {
            scene.remove(mesh);
            mesh.dispose();
        }
        mesh = new InstancedMesh(rig.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        for (const [name, size] of [["arkInstance", 4], ["arkLook", 4], ["arkRigA", 4], ["arkRigB", 4]] as const) {
            const attribute = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
            attribute.setUsage(DynamicDrawUsage);
            rig.geometry.setAttribute(name, attribute);
        }
        attachLook(rig.geometry, capacity);
        attachVary(rig.geometry, capacity);
        mesh.frustumCulled = false;
        mesh.castShadow = TIER_SETTINGS[tier].shadows > 0;
        mesh.receiveShadow = true;
        mesh.count = 0;
        scene.add(mesh);
        runtime.prepare(mesh);
        meshes.rig = mesh;
        return mesh;
    };
    /** A species' fur-shell material (`fur-shells.ts`): its near or rigged material's, pushed out in layers. */
    const shellMaterial = (source: InstancedMesh): MeshStandardMaterial | null => {
        const base = source.material as MeshStandardMaterial;
        const made = (base.userData as {arkOptions?: Parameters<typeof animalMaterial>[0]; arkSlug?: string});
        if (!made.arkOptions || !made.arkSlug) return null;
        const material = animalMaterial({...made.arkOptions, shell: true, shellLength: 0.012});
        look.track(made.arkSlug, material);
        return material;
    };
    // p3 (reflect): the animals' reflections in still water (`water-reflect-render.ts`): the same mesh, mirrored.
    const reflections = new WaterReflections(scene, (source, uniforms) => {
        const made = ((source.material as MeshStandardMaterial).userData as {arkOptions?: Parameters<typeof animalMaterial>[0]; arkSlug?: string});
        if (!made.arkOptions) return null;
        const material = animalMaterial({...made.arkOptions, reflect: uniforms});
        // (The placeholder figure's own clay colours, as its mesh has them.)
        material.vertexColors = (source.material as MeshStandardMaterial).vertexColors;
        material.roughness = (source.material as MeshStandardMaterial).roughness;
        if (made.arkSlug) look.track(made.arkSlug, material);
        return material;
    });
    const reflectSources: Array<InstancedMesh | null> = [];
    rigs.onLoad = (slug) => {
        const rig = rigs.get(slug);
        if (rig) rig.usedAt = lastUpdate;
    };
    let lastEvict = 0;
    /** This frame's step (s), for the poses that keep their own state (`crawlStep`). */
    let frameDt = 0;

    /** Marks (holes, mounds) and nests near the camera, worked out again every second (pure: the same for every viewer). */
    const recipeNear = new Map<string, {at: number; marks: RecipeMark[]; nest: RecipeNest | null; coat: RecipeCoat | null}>();
    const COATING = new Set(["wallow", "dust_bathe", "roll", "bathe", "dabble", "surface_dive", "chase_fish", "perch_plunge", "air_plunge", "talon_grab", "pouch_scoop", "river_fish"]);
    const MARKING = new Set(["root_dig", "dig_burrow", "dust_bathe", "wallow", "bury_sand", "beach_nest", "cache_food", "pounce", "burrow_dig", "bank_burrow"]);
    // The live log's "seen" (`lib/ark-live-log.ts`): who is in view near the camera, and the logged recipes they run now.
    let seenActs: ArkSeenAct[] = [];
    // 3.3 batch (A): the defence moves in view this frame (said in the log in the species' own sentence).
    const defenceSeen: ArkSeenAct[] = [];
    const seenNear = new Set<string>();
    const stepRecipeScene = (list: Array<{entry: Entry; distance: number; visible: boolean; pose: Pose; modelHeight: number}>, now: number, epoch: number) => {
        if (!world) return;
        seenActs = [];
        seenNear.clear();
        const actors: RecipeActor[] = [];
        const marks: RecipeMark[] = [];
        const nests: RecipeNest[] = [];
        const flocks: Flock[] = [];
        for (const c of list) {
            const own = c.entry.sched;
            if (c.entry.recipeFlock) flocks.push(c.entry.recipeFlock);
            const flockNow = (own?.pose as RecipePose | null | undefined)?.flock;
            if (flockNow) flocks.push(flockNow);
            // A house starling's murmuration (its flockmates are drawn round it, far as it may be).
            if (c.entry.recipeAct) actors.push({id: c.entry.animal.id, x: c.pose.x, y: c.pose.base, z: c.pose.z, yaw: c.pose.yaw, pitch: c.pose.pitch, length: c.entry.length, height: c.modelHeight, act: c.entry.recipeAct});
            // 3.3 batch (D): a pond dragonfly laying (off the schedule): her rings, and her kind's own sentence in the log.
            if (c.entry.recipeAct?.recipe === "dip_lay" && c.visible && c.distance < 60) {
                const laid = c.entry.recipeAct;
                const a = c.entry.animal;
                if (laid.since !== undefined) dipRipples.note(a.id, `${laid.episode}#${Math.round(epoch - laid.since)}`, laid.since, {x: c.pose.x, y: (dipTops.get(a.id) ?? waterTopAt(c.pose.x, c.pose.z)) + 0.004, z: c.pose.z}, c.entry.trueLength, epoch);
                const ownLine = signatureLineOf(a.model_slug, laid.recipe);
                if (ownLine) seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: laid.recipe, episode: laid.episode, block: laid.block, fish: false, line: ownLine});
            }
            if (!own?.pose || c.distance > 90) continue;
            const act = (own.pose as RecipePose).act;
            if (act && c.visible) actors.push({id: c.entry.animal.id, x: c.pose.x, y: c.pose.base, z: c.pose.z, yaw: c.pose.yaw, pitch: c.pose.pitch, length: c.entry.length, height: c.modelHeight, act});
            // 3.3 batch (D): a laying dragonfly's taps (`dip_tail`): a ring on the water where each touched.
            if (act && act.since !== undefined && c.visible && !reducedMotion) dipRipples.note(c.entry.animal.id, `${act.episode}#${act.block}#${Math.round(epoch - act.since)}`, act.since, {x: c.pose.x, y: waterTopAt(c.pose.x, c.pose.z) + 0.012, z: c.pose.z}, c.entry.length, epoch);
            if (c.visible) {
                seenNear.add(c.entry.animal.id);
                // 3.3 batch (C): a parent carrying its young in its mouth (`mouth-carry.ts`), in the species' own sentence.
                const carrying = mouthCarry.size ? mouthCarry.showing(c.entry.animal.id) : null;
                if (carrying) {
                    const p = c.entry.animal;
                    seenActs.push({id: p.id, name: p.name, speciesId: p.kind_species_profile_id || p.species_profile_id || `slug:${p.model_slug}`, zone: p.zone, recipe: "mouth_carry", episode: carrying.key, block: "carry", fish: false, line: carrying.line});
                }
                // sig-young: a young one kept, carried or led as its species' own text says (`young-ways.ts`), close by: the species' own sentence for it.
                if (c.distance < 45 && c.entry.animal.origin === "born") {
                    const y = c.entry.animal;
                    const way = liveliness.wayNow(y.id, epoch * 1000);
                    const ride = c.entry.riding ? liveliness.ageOf(c.entry)?.ways?.lines.ride : null;
                    const said = way ?? (ride ? {way: "ride", key: `ride:${y.id}:${Math.floor(epoch / 900)}`, line: ride} : null);
                    if (said) seenActs.push({id: y.id, name: y.name, speciesId: y.kind_species_profile_id || y.species_profile_id || `slug:${y.model_slug}`, zone: y.zone, recipe: `young_${said.way}`, episode: said.key, block: "care", fish: false, line: said.line});
                }
                // 3.3 batch (C): a young one in its species' young coat, close by: the species' own sentence for it.
                if (c.distance < 40 && (c.entry.youngCoat?.steps ?? 0) > 7) {
                    const y = c.entry.animal;
                    seenActs.push({id: y.id, name: y.name, speciesId: y.kind_species_profile_id || y.species_profile_id || `slug:${y.model_slug}`, zone: y.zone, recipe: "young_coat", episode: `young_coat:${y.id}:${Math.floor(epoch / 900)}`, block: "look", fish: false, line: youngCoatOf(y.model_slug)!.line});
                }
                // 3.3 batch (C): its antlers this month, close by, when its species' own sentence is true of them.
                if (c.distance < 40 && antlerNow(c.entry)?.say) {
                    const d = c.entry.animal;
                    seenActs.push({id: d.id, name: d.name, speciesId: d.kind_species_profile_id || d.species_profile_id || `slug:${d.model_slug}`, zone: d.zone, recipe: "antler_cycle", episode: `antler_cycle:${d.id}:${Math.floor(epoch / 900)}`, block: "look", fish: false, line: antlerOf(d.model_slug)!.line});
                }
                // (One of the log's kinds, or a recipe its species has its own sentence for: `live/signature-lines.ts`.)
                const ownLine = act ? signatureLineOf(c.entry.animal.model_slug, act.recipe) : null;
                if (act && (ownLine || arkSeenKind(act.recipe))) {
                    const a = c.entry.animal;
                    seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: act.recipe, episode: act.episode, block: act.block, fish: Boolean((act.catch?.ok && act.catch.kind === "fish") || act.carry?.item === "fish"), ...(ownLine ? {line: ownLine} : {})});
                }
            }
            // p3 (shake): shaking off the water, in the log (English first: `water-shake.json`'s line).
            if (act?.recipe === "water_shake" && c.visible && c.distance < 60) {
                const a = c.entry.animal;
                seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: act.recipe, episode: act.episode, block: act.block, fish: false, line: SHAKE_LINE});
            }
            if (c.distance > 45) continue;
            const recipes = speciesRecipes(c.entry.animal.model_slug).recipes;
            let near = recipeNear.get(c.entry.animal.id);
            if (!near || epoch - near.at > 1 || epoch < near.at) {
                const digs = recipes.some((r) => MARKING.has(r.id));
                // Its nest (this branch's drawing, until the props lane's are wired; a sitter's at the wired site).
                const sourced = nestSourceOf(c.entry.animal.id, epoch);
                const builds = fallbackNests() && (recipes.some((r) => r.id === "nest_build" || r.id === "dummy_nests") || Boolean(sourced));
                const site = builds ? recipeNest(world, own.profile, own.animal, epoch) : null;
                const stage = sourced ? ((sourced.eggs ?? 0) > 0 || (sourced.chicks ?? 0) > 0 ? 1 : sourced.stage) : site ? nestStageAt(c.entry.animal.model_slug, epoch) : 0;
                const species = speciesRecipes(c.entry.animal.model_slug);
                near = {
                    at: epoch,
                    marks: digs ? recipeMarks(world, own.profile, own.animal, epoch, scheduleHours, c.entry.animal.activity) : [],
                    nest: site && stage > 0 ? {id: c.entry.animal.id, x: site.x, y: site.y, z: site.z, size: Math.min(Math.max(own.animal.length * 0.9, 0.12), 1.4), stage, material: species.nest?.materials[0] ?? "twigs"} : null,
                    coat: recipes.some((r) => COATING.has(r.id)) ? recipeCoat(world, own.profile, own.animal, epoch, scheduleHours, c.entry.animal.activity) : null
                };
                recipeNear.set(c.entry.animal.id, near);
            }
            marks.push(...near.marks);
            if (near.nest) nests.push(near.nest);
        }
        // Molehills round the moles' burrows (underground animals: off the schedule, not in the list).
        for (const entry of allEntries()) {
            if (!entry.place.burrow || !speciesRecipes(entry.animal.model_slug).has.has("molehills")) continue;
            if (Math.hypot(entry.place.x - camera.position.x, entry.place.z - camera.position.z) > 50) continue;
            marks.push(...molehillsOf(entry.animal.id, entry.animal.model_slug, {x: entry.place.x, y: entry.place.ground, z: entry.place.z}, epoch, heightAt));
        }
        if (recipeNear.size > 300) recipeNear.clear();
        recipeScene.droplets = !reducedMotion && !liteOn(); // p3 (shake): no shaken drops on the low tier
        recipeScene.update(actors, marks, nests, now, epoch, camera.position, flocks);
    };

    let lastUpdate = 0;
    /** The visual CI's `resetTransients`: the next frame sets every eased share (rest, den, stir) straight to where its schedule has it. */
    let snapEased = false;
    let snapNow = false;
    const IDLE_ABILITIES = {jaw: false, eyes: true, nose: false, tail: false};
    const updateInstances = (now: number) => {
        const dt = reducedMotion || !lastUpdate ? 0 : Math.min(now - lastUpdate, 0.1);
        frameDt = dt;
        lastUpdate = now;
        snapNow = snapEased;
        snapEased = false;
        // 3.3 batch (A): this frame's defence moves in view.
        defenceSeen.length = 0;
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection);
        const cameraPosition = camera.position;
        const viewDistance = cameraPosition.distanceTo(controls.target);
        // True scale (motion pass §3): drawn at their true size from every distance (small ones get their marker).
        const exaggerate = 1;

        type Candidate = {entry: Entry; distance: number; model: SpeciesModel | undefined; visible: boolean; pose: Pose; modelHeight: number; modelScale: number; skip: boolean; rig: RigModel | null};
        const epochNow = worldMs() / 1000;
        const hoursFrame = hoursNow();
        behaviourFrameMs = 0;
        warmFrameMs = 0;
        scheduledCount = 0;
        const night = lighting.daylight.night;
        const candidates: Candidate[] = [];
        // Riders (`riders.ts`): this frame's number, and the hosts ridden now (their drawn transforms are kept for `rideLate`).
        rideFrame++;
        riddenNow.clear();
        // Part B: animals past the render distance this frame, and their markers in the map view.
        const streamDots: FindDot[] = [];
        streamSkipped = 0;
        const streaming = !streamer.allIn;
        oceanShadows?.begin(); // p2 (ocean)
        const pinnedNow = (entry: Entry) => entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id || Boolean(entry.visitor || entry.act || entry.moment || entry.held || cast?.pins.has(entry.animal.id));
        // Past the render distance: drawn only from the map view, and only when big on screen (a whale, an elephant: true
        // scale); otherwise skipped (a marker in the map view).
        const streamedOut = (entry: Entry, at: {x: number; y: number; z: number}) => {
            const state = streamStateAt(at.x, at.z);
            if (state === STATE_IN) return false;
            if (state === STATE_OUT) return true;
            return !keepsModelBeyond(entry.length, cameraPosition.distanceTo(position.set(at.x, at.y, at.z)), height, FOV);
        };
        const skipStreamed = (entry: Entry, at: {x: number; y: number; z: number}) => {
            entry.middle = null;
            // (Not drawn as a model: its schedule at an icon's rate and without the collisions, as for one out of view.)
            entry.level = "token";
            // Back in range it is drawn as it is then (never lying down on arrival).
            entry.sleepStarted = false;
            streamSkipped++;
            if (streamStateAt(at.x, at.z) === STATE_MAP) streamDots.push({x: at.x, y: Math.max(at.y, 0) + 0.6, z: at.z, pixels: 5, alpha: mineOnly && !entry.animal.mine ? 0.35 : 0.85});
        };
        for (const entry of allEntries()) {
            if (reviving.size) stepRevive(entry);
            const slug = entry.animal.model_slug;
            const model = library.get(slug);
            if (entry.held || entry.act?.hidden) {
                entry.middle = null;
                continue;
            }
            // On the schedule, its world still building (the first moments): unseen until it can be where its schedule says
            // (with reduced motion too: until the spacing is worked out, a predator's place could be among its prey).
            if ((!world || !entry.sched?.wired) && entry.sched && !entry.visitor && !entry.act && !entry.moment) {
                entry.middle = null;
                continue;
            }
            // Part B: last seen past the render distance, and seen recently: skipped (its schedule is not stepped).
            if (streaming && entry.streamAt && !pinnedNow(entry) && now - entry.streamAt.t < STREAM_RECHECK_SECONDS + entry.phase && streamedOut(entry, entry.streamAt)) {
                skipStreamed(entry, entry.streamAt);
                continue;
            }
            // Its schedule first (where it is and what it is doing now), then its one state from that. A first step waits
            // for a frame with room for it (held where it was drawn; unseen if it never was).
            // (Graphics and performance pass, 2026-11: so does a new trip. An animal's trip lasts one 80 s slot and the
            // next is worked out in the frame that first needs it, a path search: when the camera arrives among animals
            // whose slots have turned over since they were last drawn close, or a few slots end in the same frame, they
            // were all worked out in it (frames of 0.3 to 0.8 s on the phone profiles, a third of the main thread in the
            // second after arriving). Now one such frame's worth at most (`WARM_MS`), the rest held at the pose they
            // were last drawn at, for half a second at most close by and a second and a half further off, then worked
            // out whatever the frame: the same trips and poses, a few frames later. Never the animal being watched.)
            const sched = scheduled(entry) ? entry.sched! : null;
            // (One whose pose is not its trip's for now, a predator on a foray: stepping it renews no trip, so it is never
            // "due"; looked at again every two seconds.)
            const tripOver = sched !== null && (!sched.trip || epochNow >= sched.trip.end || epochNow < sched.trip.start);
            const offTrip = sched !== null && sched.offTripAt !== undefined && epochNow >= sched.offTripAt && epochNow - sched.offTripAt < 2;
            const tripDue = sched !== null && sched.warm === true && sched.pose !== null && tripOver && !offTrip;
            // (The one chosen or followed never waits: the camera is flying to where it is, and a first step taken after
            // the flight had ended moved it out from in front of the camera, 1.9 m for a fish 8 cm long.)
            if (sched && !sched.warm && warmFrameMs > WARM_MS && !options.recording && selectedId !== entry.animal.id && followId !== entry.animal.id) {
                if (process.env.NODE_ENV !== "production") entry.posePath = "warm-wait";
                if (!sched.pose) {
                    entry.middle = null;
                    continue;
                }
            } else if (sched && tripDue && warmFrameMs > WARM_MS && !options.recording && entry.animal.id !== selectedId && entry.animal.id !== followId && epochNow >= sched.at && epochNow - sched.at < (entry.level === "near" ? TRIP_HOLD_NEAR_SECONDS : TRIP_HOLD_SECONDS)) {
                // (Held: drawn where it was this frame.)
                tripsHeld++;
                if (process.env.NODE_ENV !== "production") entry.posePath = "trip-hold";
            } else if (sched) {
                const started = performance.now();
                collideCallMs = 0;
                stepSchedule(entry, epochNow, dt);
                const spent = performance.now() - started;
                perf.carve("schedule", spent - collideCallMs);
                perf.carve("collide", collideCallMs);
                behaviourFrameMs += spent;
                if (!sched.warm || tripDue) warmFrameMs += spent;
                if (tripDue && (!sched.trip || epochNow >= sched.trip.end || epochNow < sched.trip.start)) sched.offTripAt = epochNow;
                sched.warm = true;
                scheduledCount++;
            }
            // Its one state (its schedule, or the hour and its species, an act it is in) sets what it does: asleep eases in,
            // a flyer takes to the air or comes down to its roost. Selecting or following it never changes this.
            refreshState(entry);
            const targets = animationTargets(entry.state);
            // Grazing, drinking, pecking: the head goes down to bite (the material's droop), up again to look round.
            const beat = scheduled(entry) ? entry.sched!.pose?.beat : null;
            const headDown = beat === "bite" || beat === "drink" || beat === "peck" ? 0.6 : beat === "chew" ? 0.3 : 0;
            // Woken here by the reactive layer (a threat, an alarm, the camera close: `reactive.ts`), it is up though the
            // shared layer has it asleep; then it lies down again (`sleep.ts`: the posture, the way down and up).
            const woke = Boolean(entry.reactive?.woke);
            const restWant = woke ? 0 : targets.rest;
            if (snapNow) entry.rest = Math.max(restWant, headDown);
            else if (!reducedMotion) entry.rest += (Math.max(restWant, headDown) - entry.rest) * Math.min(dt * (headDown ? 3 : woke ? 4 : 1.5), 1);
            // (Its first frame with its schedule: as it is now, already lying if asleep; it never lies down on load.)
            entry.sleepNow = stepSleepNow(entry.sleepNow ?? null, {id: entry.animal.id, slug, length: entry.length, asleep: entry.state.asleep && !woke && !entry.act && !entry.visitor && !entry.moment, startled: Boolean(entry.reactive?.startled), epoch: epochNow, dt, reduced: reducedMotion || !entry.sleepStarted});
            entry.sleepStarted = true;
            stepDen(entry, dt);
            // Loops (a swimmer's, a flyer's) slow almost to a stop asleep.
            const plan = model?.behaviour?.plan ?? "";
            const pace = 1 - 0.85 * entry.rest;
            // Its speed sets the pace: a tuna laps the reef, a turtle drifts.
            // (ARK-CONTACT: a sea star or an urchin creeps on the bed, centimetres a minute; a sessile one keeps still.)
            const creep = entry.depth && waterMotion(entry.depth) === "walk" ? benthicCreep(behaviourProfile(slug, plan)) : null;
            if (entry.depth && creep !== null) entry.loop += dt * creep * Math.max(entry.length, 0.02) / Math.max(waterLoopRadius("walk", entry.phase, entry.length), 0.1) * (entry.phase > 0.5 ? 1 : -1) * pace;
            else if (entry.depth) entry.loop += dt * (0.05 + entry.phase * 0.05) * (entry.phase > 0.5 ? 1 : -1) * pace * entry.pace * waterPace(waterMotion(entry.depth));
            else if (atSeaOf(entry) && SWIMMING_PLANS.has(plan)) entry.loop += dt * (0.05 + entry.phase * 0.05) * (entry.phase > 0.5 ? 1 : -1) * pace * entry.pace;
            else if (entry.air > 0.001) entry.loop += dt * (0.16 + entry.phase * 0.08) * pace * entry.pace;
            // A flyer comes down to its roost to sleep and takes to the air again awake (an act flies its own path).
            if (fliesOver(entry.animal) && !entry.act && !scheduled(entry)) entry.air += (targets.air - entry.air) * 0.02;
            entry.lift += ((selectedId === entry.animal.id ? 1 : 0) - entry.lift) * 0.08;
            let skip = false;
            if (entry.micro && !entry.act) {
                // A moth at the cottage goes to the porch light at night while it is awake (looked at or not).
                if (entry.micro.moth && (entry.place.micro?.spot === "house" || entry.place.micro?.spot === "lamp")) {
                    const want = entry.awake && night > 0.35 && !reducedMotion ? 1 : 0;
                    entry.toLight = (entry.toLight ?? 0) + (want - (entry.toLight ?? 0)) * Math.min(dt * 0.5, 1);
                }
                // True to size at every distance (motion pass §3): its marker when it is a few pixels across.
                const near = cameraPosition.distanceTo(position.set(entry.place.x, entry.place.ground, entry.place.z));
                entry.length = entry.full;
                const own = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
                skip = near > MICRO_DRAW_WITHIN && !own && !entry.recipeAct;
                if (!skip && library.has(slug) && !model) library.request(slug, "far");
            }
            const modelScale = model ? entry.length / model.bodyLength : 1;
            const modelHeight = model ? model.height * modelScale : entry.length * 0.6;
            if (model && entry.rig) stepWander(entry, modelScale, dt, now);
            const where = pose(entry, model, modelHeight, now);
            // p2 (ocean): an open-ocean animal's shape on the water over it, seen from above (`ocean-shadows.ts`).
            if (entry.ocean) {
                const shadows = (oceanShadows ??= new OceanShadows(scene));
                shadows.add(where.x, where.z, where.yaw, entry.length, bodyShape(slug, entry.length).radius * 2, where.base + modelHeight);
                // (A whale's blow from its head as it breathes at the surface: cetaceans by their model's body plan.)
                if (where.water?.breath && model?.behaviour?.plan === "cetacean") shadows.blow(where.x + Math.sin(where.yaw) * entry.length * 0.42, where.z + Math.cos(where.yaw) * entry.length * 0.42, entry.length, where.water.breath);
            }
            // Part B: where it is now, for the render distance; past it, not drawn (a marker in the map view).
            if (streaming) {
                const at = (entry.streamAt ??= {x: 0, y: 0, z: 0, t: 0});
                at.x = where.x;
                at.y = where.base;
                at.z = where.z;
                at.t = now;
                if (!pinnedNow(entry) && streamedOut(entry, at)) {
                    skipStreamed(entry, at);
                    continue;
                }
            }
            // Only the layer the camera is in is drawn in full: under the sea nothing of the land; above it not the deep;
            // the underground only in the cutaway (or peeking out of its burrow).
            const own = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
            const atSea = atSeaOf(entry) || entry.depth?.water === "salt";
            // The deep's are hidden from above while they are down there (an air-breather of the deep shows when it comes up).
            const down = entry.depth ? entry.depth.band === "deep" && where.base < -2.5 : entry.layer.layer === "deep";
            if (!own && !entry.moment && ((underwater && !atSea) || (!underwater && down) || (entry.place.burrow && entry.buried && !cutawayOpen) || (entry.place.hamlet && !hamletOutside(entry)) || (entry.denIn ?? 0) >= 0.999)) {
                entry.middle = null;
                continue;
            }
            // (In the water at its own depth: a seabed animal is culled and loaded by where it is, not the surface over it.)
            // (An act under the water, a sea kind's birth on its seabed: at its depth too, not at the surface, or the view
            // from down there culls it. REAL-REPRODUCTION.)
            position.set(where.x, where.water || (entry.act && where.base < -0.02) ? where.base : Math.max(where.base, 0), where.z);
            const distance = cameraPosition.distanceTo(position);
            // 3.3 batch (E): bubbles from an air-breather's dive and a fast swimmer's wake, near the camera under the sea.
            if (underwater && seaLook && where.water && distance < 28) seaLook.swimmer(entry.animal.id, where.x, where.base + modelHeight * 0.7, where.z, where.water.breath, entry.length, seaLookNow);
            // (Or large on screen at true size: a whale or an elephant across the bay, motion pass §3.)
            if ((distance < LOAD_NEAR_WITHIN || nearBySize(entry.length, distance, height, FOV)) && library.has(slug)) library.request(slug, "near");
            // A walker on the move with a rig: its near model too, from the island view (it is drawn rigged, near).
            else if (moverGait && distance < MOVING_RIG_WITHIN && !reducedMotion && entry.air <= 0.001 && gaitMoving(entry.gait, entry.length) && rigs.available(slug) && library.has(slug)) library.request(slug, "near");
            sphere.center.copy(position);
            sphere.radius = entry.length * 2 + 3;
            candidates.push({entry, distance, model, visible: frustum.intersectsSphere(sphere), pose: where, modelHeight, modelScale, skip, rig: null});
            runtime.see(slug, distance, candidates[candidates.length - 1].visible);
        }

        oceanShadows?.end(underwater); // p2 (ocean)
        // The page's tap card says what the selected animal is doing now, from the same state.
        tellState();
        perf.lap("animals");
        // The local reactive layer first (its offsets and turns go onto the poses keepApart and the grass then read).
        if (scheduleOn && !reducedMotion) stepReactive(candidates, dt);
        // Powers you can see (decision 420): after the reactive layer, on the same poses; the looks even with motion off.
        if (powerShow) powerShow.step(candidates as unknown as ArkPowerCandidate[], dt, {now: worldMs() / 1000, motion: scheduleOn && !reducedMotion && !liteOn(), shift: powerShift});
        perf.lap("reactive");
        if (scheduleOn && !reducedMotion) {
            const started = performance.now();
            keepApart(candidates, dt);
            // ARK-JUNGLE: a young one carried rides where its mother is drawn: moved as the reactive layer and the pushes moved her.
            if (candidates.some((c) => c.entry.riding)) {
                const byId = new Map(candidates.map((c) => [c.entry.animal.id, c]));
                for (const c of candidates) {
                    const on = c.entry.riding ? c.entry.ridingOn : null;
                    const m = on ? byId.get(on.id) : null;
                    if (!on || !m) continue;
                    const dx = m.pose.x - on.x;
                    const dz = m.pose.z - on.z;
                    const dy = m.pose.base - on.base;
                    c.pose.x += dx;
                    c.pose.z += dz;
                    c.pose.base += dy;
                    if (c.pose.surface) c.pose.surface = {...c.pose.surface, x: c.pose.surface.x + dx, y: c.pose.surface.y + dy, z: c.pose.surface.z + dz};
                }
            }
            // The muzzles of the grazers biting and the bodies of the walkers nearest the camera, for the grass to bend at (`grass-press.ts`).
            const biting = (c: (typeof candidates)[number]) => c.entry.sched!.pose?.beat === "bite" || c.entry.sched!.pose?.beat === "chew";
            setGrassPress(
                // (Where a meal pressed the grass flat, `meal-traces.ts`: nearest the camera first, like the rest.)
                // 3.3 fix (breeding taps): and round a clutch a laid line's tap drew, first.
                (liveClutch?.spot ? [liveClutch.spot] : []).concat(pressedByMeals(cameraPosition)).concat(candidates
                    .filter((c) => c.visible && c.distance < 40 && c.entry.sched && !c.entry.sched.pose?.aloft && !c.pose.afloat && (biting(c) || c.entry.sched.pose?.moving))
                    .sort((a, b) => a.distance - b.distance)
                    .map((c) =>
                        biting(c)
                            ? {x: c.pose.x + Math.sin(c.pose.yaw) * c.entry.length * 0.5, y: c.pose.base, z: c.pose.z + Math.cos(c.pose.yaw) * c.entry.length * 0.5, radius: Math.max(c.entry.length * 0.18, 0.08)}
                            : {x: c.pose.x, y: c.pose.base, z: c.pose.z, radius: Math.max(c.entry.length * 0.35, 0.1)}
                    ))
            );
            stepRecipeScene(candidates, now, epochNow);
            // 3.3 batch (B): the birds' own moves
            stepBirdMoves(candidates, epochNow);
            behaviourFrameMs += performance.now() - started;
        }
        // p2 (ground): the blades at bug scale bow away round the animals in the patch the camera is down at.
        if (bugGround.shown) {
            const clear: Array<{x: number; y: number; z: number; radius: number}> = bugClearPoints(candidates, (c, out) => ((out.x = c.pose.x), (out.y = c.pose.base), (out.z = c.pose.z), (out.length = c.entry.length), c.visible), controls.target, bugGround.reach);
            // 3.3 fix (breeding taps): the blades bow away round a clutch a laid line's tap drew, first.
            bugGround.setClear(liveClutch?.spot ? [liveClutch.spot, ...clear] : clear);
        }
        behaviourTimes.push(behaviourFrameMs);
        if (behaviourTimes.length > 120) behaviourTimes.shift();
        perf.lap("apart");
        // Every visible animal's gait (its pace by the distance it covers): which movers get a rig from far off, and
        // the cheap gait of those that don't.
        for (const c of candidates) if (c.visible && !c.skip) c.entry.gait = stepGait(c.entry.gait, c.pose.x, c.pose.z, dt, c.entry.length, c.pose.afloat ? undefined : c.pose.yaw); // gfx (PLACE): a turn on the spot steps
        // A walker moving on the ground, seen from anywhere (the island view is ~190 m off): its rig, within the caps,
        // so the island's movers walk on their legs rather than glide (the owner, 2026-11-11). It is drawn near for that.
        const movingRig = (c: Candidate) =>
            moverGait &&
            !reducedMotion &&
            rigs.walks(c.entry.animal.model_slug) && c.entry.air <= 0.001 && !c.entry.visitor && !c.pose.afloat && gaitMoving(c.entry.gait, c.entry.length) && rigs.available(c.entry.animal.model_slug);
        const chosen = (entry: Entry) => entry.animal.id === selectedId || entry.animal.id === followId;
        const nearWanted = candidates
            .filter((c) => c.visible && !c.skip && c.model?.near && (c.distance < NEAR_DISTANCE + (c.entry.level === "near" ? HYSTERESIS : 0) + ((c.entry.air > 0.5 || c.entry.rig?.flying) && rigs.mayFly(c.entry.animal.model_slug) ? FLIGHT_RIG_EXTRA : 0) || (movingRig(c) && (c.entry.level === "near" || c.distance < MOVING_RIG_WITHIN)) || nearBySize(c.entry.length, c.distance, height, FOV)))
            // (Largest on screen first at true size: a whale far off before a beetle near by. The one chosen or followed
            // before all: among forty birds in an aviary the near cap could pass it by, close up on its far model.)
            .sort((a, b) => Number(chosen(b.entry)) - Number(chosen(a.entry)) || screenWeight(b.entry.length, b.distance) - screenWeight(a.entry.length, a.distance));
        const nearIds = new Set<string>();
        const nearSpecies = new Set<string>();
        const cap = caps();
        for (const candidate of nearWanted) {
            if (nearIds.size >= cap.near) break;
            const slug = candidate.entry.animal.model_slug;
            if (!nearSpecies.has(slug) && nearSpecies.size >= cap.nearSpecies) continue;
            nearSpecies.add(slug);
            nearIds.add(candidate.entry.animal.id);
        }
        runtime.usedNear(nearSpecies);
        // Models for the MODEL_CAP largest on screen (true scale: a whale far off before a beetle near by); past that, icons.
        const modelled = new Set(candidates.filter((c) => c.visible && !c.skip && c.model?.far).sort((a, b) => screenWeight(b.entry.length, b.distance) - screenWeight(a.entry.length, a.distance)).slice(0, cap.models).map((c) => c.entry.animal.id));

        // Rigs: the viewer's own, the one looked at or followed, then the nearest, within the caps (none with reduced motion).
        rigs.caps = liteOn() ? RIG_CAPS_LITE : RIG_CAPS;
        const rigCap = reducedMotion ? null : liteOn() ? RIG_CAPS_DRAWN_LITE : RIG_CAPS_DRAWN;
        const rigPriority = (entry: Entry) => (entry.animal.id === selectedId || entry.animal.id === followId ? 0 : entry.animal.mine ? 1 : 2);
        const rigWanted = rigCap
            ? candidates
                  .filter((c) => c.visible && !c.skip && c.model && nearIds.has(c.entry.animal.id) && !c.entry.visitor && (c.entry.air <= 0.001 || rigs.mayFly(c.entry.animal.model_slug)) && (c.distance < RIG_WITHIN + (c.entry.air > 0.5 || c.entry.rig?.flying ? FLIGHT_RIG_EXTRA : 0) || rigPriority(c.entry) < 2 || movingRig(c)) && rigs.available(c.entry.animal.model_slug))
                  .sort((a, b) => rigPriority(a.entry) - rigPriority(b.entry) || a.distance - b.distance)
            : [];
        const rigSpecies = new Set<string>();
        let rigCount = 0;
        for (const candidate of candidates) candidate.entry.rigOn = false;
        for (const candidate of rigWanted) {
            if (!rigCap || rigCount >= rigCap.animals) break;
            const slug = candidate.entry.animal.model_slug;
            if (!rigSpecies.has(slug) && rigSpecies.size >= rigCap.species) continue;
            rigSpecies.add(slug);
            rigCount++;
            candidate.entry.rigOn = true;
            // (The one looked at or followed, and the viewer's own, first: never left stiff by a full library. The
            // caps bound the rigs held, so the rest get theirs as rigs not drawn for a while are let go.)
            rigs.request(slug, rigPriority(candidate.entry) < 2);
        }
        let rigged = 0;
        for (const candidate of candidates) {
            const {entry, model} = candidate;
            if (!model || !nearIds.has(entry.animal.id) || !candidate.visible || candidate.skip) {
                if (entry.rig) {
                    entry.rig.weight = 0;
                    entry.rig.last = null;
                }
                continue;
            }
            candidate.rig = rigFor(entry, model, candidate.pose, candidate.modelScale, dt);
            if (candidate.rig) rigged++;
        }
        perf.lap("rigs");

        const perMesh = new Map<InstancedMesh, number>();
        const used = new Set<InstancedMesh>();
        const tokenList: TokenInstance[] = [];
        const shadowList: Shadow[] = [];
        const ringList: Ring[] = [];
        const dotList: FindDot[] = [];
        counts = {near: 0, far: 0, token: 0, herdFigures: 0, herdSpecks: 0, rigged: 0, restingFigures: 0, restingSpecks: 0};

        look.begin(lookWeather, worldMs());
        // Development: the sleep clips' page draws the same frame with the eyes open, to compare (`sleep-entry.ts`).
        const eyesOpenForDev = process.env.NODE_ENV !== "production" && Boolean((globalThis as {__arkEyesOpen?: boolean}).__arkEyesOpen);
        const needs = new Map<string, {near: number; far: number; rig: number}>();
        for (const candidate of candidates) {
            const {entry} = candidate;
            let level: Level = nearIds.has(entry.animal.id) ? "near" : modelled.has(entry.animal.id) ? "far" : "token";
            // The hand-over. A species' mesh is held back when it is first made, until its shader has compiled
            // (`runtime.prepare`: a frame or two, up to seconds for the first rig on a slow phone). Until it can be
            // drawn the animal stays one level down, as it was (the rig as its near model, the near model as its far
            // one); before, it was not drawn at all for those frames, a blink at each first far to near to rig step.
            if (level === "near" && candidate.visible && !candidate.skip && candidate.model) {
                const meshes = speciesMeshes(entry.animal.model_slug);
                if (candidate.rig && !drawable(meshes.rig)) {
                    instancedRigFor(candidate.model, candidate.rig, 1);
                    if (!drawable(meshes.rig)) {
                        candidate.rig = null;
                        // (Its rig fades in from nothing once it can be drawn.)
                        if (entry.rig) entry.rig.weight = 0;
                    }
                }
                if (!candidate.rig && !drawable(meshes.near) && candidate.model.far) {
                    instancedFor(candidate.model, "near", 1);
                    if (!drawable(meshes.near)) level = "far";
                }
            }
            entry.level = level;
            if (!candidate.visible || level === "token" || candidate.skip) continue;
            const need = needs.get(entry.animal.model_slug) ?? {near: 0, far: 0, rig: 0};
            if (level === "near" && candidate.rig) need.rig++;
            else need[level]++;
            needs.set(entry.animal.model_slug, need);
        }
        // The herds' members (A14): how many as the far model this frame, the rest as specks.
        roostFigures(); // p5 (rural)
        const herdPlans = planHerds(cameraPosition, exaggerate, now);
        for (const herd of herdPlans) {
            if (!herd.figures) continue;
            const need = needs.get(herd.slug) ?? {near: 0, far: 0, rig: 0};
            need.far += herd.figures;
            needs.set(herd.slug, need);
        }
        needs.forEach((need, slug) => {
            const model = library.get(slug)!;
            if (need.near) instancedFor(model, "near", need.near);
            if (need.far) instancedFor(model, "far", need.far);
            const rig = need.rig ? rigs.get(slug) : undefined;
            if (rig) instancedRigFor(model, rig, need.rig);
        });
        perf.lap("herds");

        seat.begin(renderer.info.render.frame);
        for (const candidate of candidates) {
            const {entry, model, pose: where} = candidate;
            // A rider on its host: on the coat its host was drawn with this frame (hosts are drawn first: riders end the roster).
            if (entry.ride?.on) rideLate(entry, where);
            // (Grounding: the pose's own base before the offsets below, an idle's lift, a sleeper's drop, a den, a gait's bob.)
            const poseBase = where.base;
            const level = entry.level;
            const animal = entry.animal;
            const dim = mineOnly && !animal.mine ? 1 : 0;
            let grow = 1;
            if (entry.arrivedAt !== null) {
                const t = (now - entry.arrivedAt) / ENTRANCE_SECONDS;
                if (t < 1 && !reducedMotion) grow = Math.max(easeOutBack(Math.max(t, 0)), 0.001);
                const ripple = (now - entry.arrivedAt) / RIPPLE_SECONDS;
                if (ripple < 1 && !reducedMotion) {
                    ringList.push({x: where.x, y: Math.max(entry.place.ground, 0), z: where.z, radius: entry.length * (0.8 + 2.6 * ripple), color: ARRIVAL, alpha: 0.9 * (1 - ripple) ** 1.5});
                }
            }
            // Big animals need less help to be seen: a whale isn't blown up like a sparrow.
            // (Tiny animals seen, `tiny-lift.ts`: a beetle or a fly chosen or followed, near, is at least a few pixels long.)
            const sizeUp = level !== "near" ? 1 + (exaggerate - 1) * Math.min(Math.max(1.6 / entry.length, 0.25), 1) : liftTiny(entry, candidate.distance, now);
            const modelHeight = candidate.modelHeight * sizeUp;
            entry.drawnHeight = modelHeight;
            // In the water: fitted again at the height it is drawn at (from afar it is drawn larger), so its back never breaks the surface.
            if (where.water) {
                // A school drawn larger from afar spreads with it (never touching), and its depth is fitted again.
                if (where.school && sizeUp !== 1) {
                    where.x = where.school.x + (where.x - where.school.x) * sizeUp;
                    where.z = where.school.z + (where.z - where.school.z) * sizeUp;
                    where.water = {...where.water, floorY: heightAt(where.x, where.z)};
                }
                // (At the sea's level now: the column rises and falls with the tide, `tideFit`.)
                where.base = tideFit(where.water, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
            } else if (where.edge) {
                // (Lane MA3: into the water or out of it, settled to its float line as far as its slide has gone, at the height it is drawn at.)
                const fitted = tideFit(where.edge.spec, modelHeight, ARK_ENVIRONMENT.seaLevel.value, fitInWater).base;
                where.base = edgeBase(where.edge.stand, fitted, where.edge.k, Math.max(heightAt(where.x, where.z), standGround(where.x, where.z, where.edge.stand)));
            }
            if (!candidate.visible) {
                entry.middle = null;
                continue;
            }
            entry.yawNow = where.yaw;
            // p2 (contact): no hover when it is chosen (it rose 12% of its height off the ground: a lion asleep on its side
            // floated over its own shadow, the shadow "not on the surface"). The ring and the card mark the chosen one.
            const lift = 0;
            // Near and awake: now and then it looks round, startles, shakes, bobs or dozes (the talking models' idles, as root motion).
            if (level === "near" && entry.awake && !entry.act && !entry.visitor && !entry.micro && model && !reducedMotion) {
                // The sharper it is, the more different things it does (`arkIdleBehaviour`).
                entry.director ??= new BehaviourDirector(arkIdleBehaviour(model.behaviour, entry.stats.intelligence), IDLE_ABILITIES, BehaviourRandom.seed(animal.id));
                const idle = entry.director.pose(now, false);
                where.yaw += idle.yaw * (where.water ? 0.4 : 1);
                // In the water it swims level: no idle pitch, roll or lift (its depth is its band's).
                if (!where.water) {
                    where.pitch += idle.pitch;
                    where.roll += idle.roll;
                    where.base += idle.lift * candidate.modelScale;
                }
                // Calling (sound on): its head comes up for the call it is heard making (`liveliness-scene.ts`).
                if (!where.water) where.pitch -= 0.16 * liveliness.callLiftOf(animal.id);
                // A camera close by: now and then it glances at it, more often the sharper it is.
                // (With the reactive layer the head looks at the camera instead: `watch_camera`, `investigate_camera`.)
                const looking = candidate.distance < GLANCE_WITHIN && !where.afloat && !entry.reactive ? glance(entry.stats.intelligence, now, entry.phase) : 0;
                if (looking > 0) {
                    let turn = Math.atan2(cameraPosition.x - where.x, cameraPosition.z - where.z) - where.yaw;
                    while (turn > Math.PI) turn -= Math.PI * 2;
                    while (turn < -Math.PI) turn += Math.PI * 2;
                    where.yaw += Math.min(Math.max(turn, -1.1), 1.1) * 0.8 * looking;
                    where.pitch -= 0.05 * looking;
                }
            }
            // ARK-CONTACT (decision 447, the mangrove crab floating over its rock): on a rock's face or ledge, where the
            // rock is drawn reached down to its ground, the face as drawn (`asset-rocks.ts` drawnFace), not as made.
            const microTag = (entry.place.micro as {attach?: {tag?: string}} | null | undefined)?.attach?.tag;
            const drawnFace = where.surface && where.surface !== entry.drawnFace && (microTag === "rock_face" || microTag === "ledge") ? assetRocks.drawnFace(where.surface, (entry.drawnFace ??= {...where.surface})) : null;
            if (drawnFace && where.surface) {
                where.x += drawnFace.x - where.surface.x;
                where.base += drawnFace.y - where.surface.y;
                where.z += drawnFace.z - where.surface.z;
                where.surface = drawnFace;
            }
            // ARK-CONTACT (the coordinator, 2026-11-21: a wolf spider 4 m up a tree): a ground dweller (its microhabitat the
            // leaf litter: a wolf spider, a ground beetle, a woodlouse) given a raised plant point (a tree's or a shrub's
            // leaf, a branch, bark; not a flower head, which it visits) more than 30 cm up is drawn on the drawn ground straight below it, where
            // it hunts, not up in the plant.
            const groundDweller = entry.micro?.spot === "leaf_litter" && (microTag === "leaf" || microTag === "branch" || microTag === "bark" || microTag === "canopy_perch" || microTag === "limb");
            if (groundDweller && where.surface && !where.water && entry.air <= 0.001 && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkFlowerFixOff?: boolean}).__arkFlowerFixOff)) {
                const p = where.surface;
                const below = standGround(p.x, p.z, p.y);
                if (p.y - below > 0.3) {
                    where.base = below;
                    where.surface = undefined;
                }
            }
            // ARK-CONTACT (the owner, 2026-11-21: "a golden tortoise beetle is hovering above a daisy"): an insect at rest on
            // a flower's head or a low leaf is drawn on the flower or the leaf as drawn there (the drawn floor plant under
            // its point, as placed and scaled: `asset-rocks.ts` surfaceBelow), not at the height the point was made with
            // (the flower's unscaled shape, the ground then). Where no flower is drawn at a flower's point (a thinner
            // planting than the points were made for), it rests on the drawn ground, not in the air over it.
            if (assetFloor && microTag && (microTag === "flower_head" || microTag === "leaf") && where.surface && where.surface.ny > 0.5 && entry.length <= SMALL_ON_ROCKS && !entry.sched?.pose?.moving && entry.air <= 0.001 && level !== "token" && candidate.distance < 40 && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkFlowerFixOff?: boolean}).__arkFlowerFixOff)) {
                const p = where.surface;
                const floorTop = assetFloor.surfaceBelow(p.x, p.y, p.z, microTag === "flower_head" ? 0.3 : 0.08, 0.12);
                // (A leaf on a shrub, a reed or a tree, or a flower no floor plant holds: any drawn plant under it, near.)
                const plantTop = floorTop === null && candidate.distance < 20 ? plantBelow(p.x, p.y, p.z, microTag === "flower_head" ? 0.3 : 0.15, 0.25, renderer.info.render.frame) : null;
                const top = floorTop ?? plantTop ?? null;
                const groundHere = standGround(p.x, p.z, p.y);
                const to = plantTop === undefined ? null : top !== null ? top : microTag === "flower_head" && p.y - groundHere < 0.8 && p.y - groundHere > 0.01 ? groundHere : null;
                if (to !== null && Math.abs(to - p.y) > 0.002) {
                    where.base += to - p.y;
                    where.surface = entry.floorFace = Object.assign(entry.floorFace ?? {...p}, p, {y: to});
                }
            }
            // ARK-CONTACT (the owner, 2026-11-21: "shield bugs and stink bugs are inside a rock"): a small animal (a bug, a
            // beetle, an ant, a spider, a snail, a woodlouse) is never drawn inside a drawn rock: on its way over the ground
            // (the schedule's walk knows the rock's place, not the rock as drawn on today's ground) or on a rock point the
            // face cast left as made, it walks up and over the rock, on its top straight above (`asset-rocks.ts` insideRock).
            if (assetRocks && entry.length <= SMALL_ON_ROCKS && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkRockFixOff?: boolean}).__arkRockFixOff) && !where.water && !where.afloat && entry.air <= 0.001 && level !== "token" && candidate.distance < 40) {
                const inside = assetRocks.insideRock(where.x, where.base + Math.max(entry.length * 0.25, 0.01), where.z);
                if (inside > 0.005) {
                    where.base += inside + Math.max(entry.length * 0.25, 0.01);
                    // (On the rock's top it stands upright on it, not along a face it was set on inside the rock.)
                    if (where.surface && Math.abs(where.surface.ny) < 0.5) where.surface = undefined;
                }
            }
            // ARK-CONTACT (ARK-SLEEP, 2026-11-21: a langur at limb:decor98:4 drawn inside its tree's trunk): an animal held on
            // a tree's point (a limb's top) is never in a trunk: closer to a trunk's axis than the trunk's radius and half its
            // length, it is drawn further out along its limb, on the limb's drawn wood there (`limbClearOf`).
            const limbId = where.surface && !where.water ? entry.sched?.trip?.to.point ?? null : null;
            if (limbId && world && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkLimbFixOff?: boolean}).__arkLimbFixOff)) {
                const clear = limbClearOf(limbId, entry.length, renderer.info.render.frame, false);
                const point = clear ? attachPoint(limbId) : null;
                if (clear && point && Math.hypot(where.x - point.position.x, where.z - point.position.z) < 0.4) {
                    where.x += clear.x;
                    where.base += clear.y;
                    where.z += clear.z;
                    const face = where.surface!;
                    where.surface = entry.limbFace = Object.assign(entry.limbFace ?? {...face}, face, {x: face.x + clear.x, y: face.y + clear.y, z: face.z + clear.z});
                }
            }
            // ARK-CONTACT (the owner, 2026-11-21: the ground dove in mid-air beside a house's roof): resting on a town eave's
            // perch, on the drawn roof's edge (`islands/town/eave-draw.ts`), not beside it.
            if (island && !where.water && !where.afloat && !entry.sched?.pose?.moving && entry.air <= 0.001 && !(process.env.NODE_ENV !== "production" && (globalThis as {__arkEaveFixOff?: boolean}).__arkEaveFixOff)) {
                const from = where.surface ?? {x: where.x, y: where.base, z: where.z};
                const eave = island.drawnEave?.(from.x, from.y, from.z) ?? null;
                if (eave) {
                    where.x += eave.x - from.x;
                    where.base += eave.y - from.y;
                    where.z += eave.z - from.z;
                    if (where.surface) where.surface = entry.eaveFace = Object.assign(entry.eaveFace ?? {...where.surface}, where.surface, {x: eave.x, y: eave.y, z: eave.z});
                }
            }
            const surface = where.surface;
            if (surface) entry.middle = (entry.middle ?? new Vector3()).set(where.x + surface.nx * modelHeight / 2, where.base + surface.ny * modelHeight / 2, where.z + surface.nz * modelHeight / 2);
            else entry.middle = (entry.middle ?? new Vector3()).set(where.x, where.base + lift + modelHeight / 2, where.z);
            // What it leaves behind, and (sound on) its calls (`liveliness-scene.ts`); the reactive layer's alarm when it has one.
            if (!candidate.skip && level !== "token") {
                const reaction = (entry as {reactive?: {called?: boolean; alarmed?: number} | null}).reactive ?? null;
                liveliness.drawn(
                    entry,
                    {x: where.x, base: where.base, z: where.z, yaw: where.yaw, afloat: where.afloat || Boolean(surface), inWater: Boolean(where.water) || Boolean(entry.place.water)},
                    {distance: candidate.distance, asleep: entry.state.asleep, aloft: entry.air > 0.5, resting: entry.sched?.pose?.doing === "rest", alarmed: reaction?.alarmed ?? 0, called: Boolean(reaction?.called), hours: hoursFrame},
                    now
                );
            }
            const rest = Math.max(entry.place.ground, 0);
            const marked = selectedId === animal.id ? 2 : mineOnly && animal.mine ? 1 : cast?.marks.has(animal.id) ? 3 : 0;
            // Too small to find on its own (a few pixels across: from far, or a beetle a few metres off): a soft dot over it,
            // and its icon once tapped. Close by it is drawn true to size, and found by looking. (True scale, motion pass §3.)
            const fromAfar = !entry.micro || entry.length >= entry.full * 0.999;
            const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * candidate.distance / height;
            const pixels = entry.length * sizeUp / perPixel;
            // Past the model cap, one too small on screen for its icon to mean anything is its marker instead.
            const dotNotIcon = level === "token" && markerNotIcon(pixels);
            if ((level !== "token" || candidate.skip || dotNotIcon) && !entry.act && fromAfar) {
                if (entry.floor || pixels < MARKER_BELOW_PIXELS || candidate.skip || dotNotIcon) {
                    const top = where.base + lift + modelHeight + Math.max(perPixel * 7, 0.08);
                    dotList.push({x: where.x, y: Math.max(top, rest + 0.1), z: where.z, pixels: marked === 2 ? 11 : 8, alpha: dim ? 0.35 : 1});
                    if (marked === 2) tokens.ensure(animal.model_slug);
                    if (marked === 2 && tokens.loaded(animal.model_slug)) tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(top, rest + 0.1) + perPixel * 20, z: where.z, size: 0.5, dim: 0, ring: 2, grow});
                }
            }

            // A small animal far off: its marker only.
            if (candidate.skip) continue;
            if (level === "token") {
                counts.token++;
                if (!dotNotIcon) {
                    tokens.ensure(animal.model_slug);
                    tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(where.base + modelHeight * 0.75, rest + 0.4), z: where.z, size: iconSize(entry.length), dim, ring: marked, grow});
                }
                continue;
            }

            // The one talking: its full talking model stands in its place.
            const actor = talking.actor;
            if (actor?.ready && talking.weight > 0 && talking.target?.animalId === animal.id && actor.slug === animal.model_slug) {
                const as = (entry.length / Math.max(bodyAxisExtent(actor.slug, model?.behaviour?.plan, {x: actor.width, y: actor.height, z: actor.length}), 0.05)) * sizeUp;
                const bob = talking.open * 0.06;
                euler.set(where.pitch + bob, where.yaw + Math.sin(now * 1.1) * 0.05 * talking.weight, where.roll + Math.sin(now * 0.7) * 0.02 * talking.weight);
                actor.root.rotation.copy(euler);
                actor.root.position.set(where.x, where.base + lift - actor.minY * as, where.z);
                actor.root.scale.setScalar(as);
                actor.root.visible = true;
                // Its shadow on the ground under it now (not its home spot's height), gone off the ground or in water.
                const under = groundUnderAt(where.x, where.z, ARK_ENVIRONMENT.seaLevel.value, true, where.base);
                const touch = groundContact(where.base + lift, under.height, under.water, entry.drawnHeight || entry.length * 0.6);
                if (touch) shadowList.push({x: where.x, y: touch.y, z: where.z, width: actor.width * as, length: actor.length * as, yaw: where.yaw, strength: touch.strength});
                // (Afloat: on the water's surface there, the sea's 0, the v2 lake's 6 m: lane MA3 water 2, it was under the lake's bed.)
                if (marked) ringList.push({x: where.x, y: where.afloat ? waterTopAt(where.x, where.z) : rest, z: where.z, radius: Math.max(entry.length * sizeUp * 0.8, 0.7), color: marked === 2 ? SELECTED : marked === 3 ? LAST_OF_KIND : MINE, alpha: 1});
                counts.near++;
                continue;
            }

            const rig = level === "near" ? candidate.rig : null;
            // Moving with no rig (past the rig caps, or no rig file): a cheap gait, the body bobbing and rocking with its
            // steps, by the distance it covers, so nothing slides along still.
            if (moverGait && !rig && !surface && !where.afloat && entry.air <= 0.001 && entry.gait && !reducedMotion) {
                const g = gaitPose(entry.gait, entry.length, modelHeight);
                if (g.weight > 0) {
                    where.base += g.bob;
                    where.pitch += g.pitch;
                    where.roll += g.roll;
                }
            }
            const meshes = species.get(animal.model_slug);
            const mesh = (level === "near" ? (rig ? meshes?.rig : meshes?.near) : meshes?.far) ?? null;
            if (!mesh || !model) continue;
            const index = perMesh.get(mesh) ?? 0;
            perMesh.set(mesh, index + 1);
            used.add(mesh);
            if (level === "near") counts.near++;
            else counts.far++;
            const act = entry.act;
            const s = candidate.modelScale * sizeUp * grow * (act ? Math.max(act.scale, 0.001) : 1);
            // Asleep (`sleep.ts`): its posture's body (lowered until its torso meets the ground, rolled onto a side, nosed
            // down, on a new heading after a stir) and gone down into its burrow; its eyes, curl, breath and head go to the
            // shader below. The same near and far (only the fine parts fade with distance), so a level change never pops.
            const sn = entry.sleepNow ?? null;
            const clipShare = sn && rig && entry.sleepClipped && entry.rig ? entry.rig.weight : 0;
            // p2 (contact): the drawn ground a lying sleeper rests on (its contact shadow's), null otherwise.
            let lyingOn: number | null = null;
            const slept = sn && !surface && !act ? sleepDraw(sn, {id: animal.id, slug: animal.model_slug, length: entry.length, epoch: epochNow, procedural: 1 - clipShare, reduced: reducedMotion}) : null;
            // ARK-CONTACT (the owner, 2026-11-21, the farm at night: "cows and pigs are sunk into the ground, with the lower
            // half of their legs cut off"): a sleeper whose legs are drawn standing (no lying clip plays: the four-legged
            // rigs' lying clips are held, `QUADRUPED_LYING_HELD`, and the near and far meshes stand) is not lowered onto its
            // belly with its legs through the ground; it sleeps on its feet, its head low and its eyes shut, its hooves on
            // the drawn ground like any standing animal (`groundedStand`). A rig's own lying clip still lies it down.
            const sleepsStanding = sleepsOnFeet({slept: Boolean(slept), rigged: Boolean(rig), sleepClipped: entry.sleepClipped === true, clipShare, water: Boolean(where.water), lying: Boolean(sn?.spec.lying), flat: sn?.posture === "flat", legsUnder: Boolean(slept) && legsUnder((level === "near" ? model.near ?? model.far : model.far ?? model.near)?.geometry ?? null)});
            if (slept && sleepsStanding) {
                const stirTarget = entry.sched?.pose?.moving ? 0 : 1;
                const stirWas = entry.stirShare ?? stirTarget;
                entry.stirShare = reducedMotion ? stirTarget : stirWas + (stirTarget - stirWas) * Math.min(dt * 3, 1);
                where.yaw += slept.yaw * entry.stirShare;
            } else if (slept) {
                // (Its stirred heading only while it keeps still: moving, a foal at its mother's heel say, it faces where
                // it goes; eased out and in, so nothing snaps. 2026-11-12.)
                const stirTarget = entry.sched?.pose?.moving ? 0 : 1;
                const stirWas = entry.stirShare ?? stirTarget;
                entry.stirShare = reducedMotion ? stirTarget : stirWas + (stirTarget - stirWas) * Math.min(dt * 3, 1);
                where.yaw += slept.yaw * entry.stirShare;
                where.pitch += slept.pitch;
                const lyingGeometry = (level === "near" ? model.near ?? model.far : model.far ?? model.near)?.geometry ?? null;
                const box = lyingGeometry?.boundingBox ?? null;
                // p2 (contact): no deeper than its belly, a legless body flat (`sleep.ts` lyingBody), on the drawn ground.
                const body = lyingBody(slept, sn!.spec.drop, lyingGeometry ? bellyOfGeometry(lyingGeometry) : 1);
                // ARK-ANIM (the owner on batch 13: a sleeping elk's legs in the ground): a rig drawn standing (no lying clip
                // of its own playing) cannot fold its legs, so lowering it to its belly put them through the ground: no
                // more than 2 cm down.
                if (rig && entry.rig && entry.rig.weight > 0.5 && clipShare < 0.5 && modelHeight > 0) body.legs = Math.min(body.legs, RIG_STANDING_SINK / modelHeight);
                where.roll += body.roll;
                if (where.water) {
                    // On the bottom: down to the floor under it as it settles.
                    if (sn!.posture === "bottom") where.base += (where.water.floorY + modelHeight * 0.05 - where.base) * sleepStages(sn!.t).body;
                } else if (box && !surface && groundingRules() === "grounded" && standsOnGround({...where, base: poseBase}, heightAt(where.x, where.z), standGround(where.x, where.z, poseBase))) {
                    const lyingGround = standGround(where.x, where.z, poseBase);
                    const lie = lieOnGround(where.x, where.z, where.yaw, s, lyingTorso(box, body.legs), where.pitch, where.roll, lyingGround, groundNormalAt(where.x, where.z, lyingGround), (x, z) => standGround(x, z, poseBase));
                    where.pitch += lie.pitch;
                    where.roll += lie.roll;
                    where.base = lie.rootY + groundedLevelBase(animal.model_slug, rig ? "rig" : level, model.minY) * s;
                    lyingOn = lie.ground;
                } else if (box) where.base -= lyingDrop({minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y}, body.legs, body.roll) * s;
            }
            if (entry.denIn) where.base -= entry.denIn * modelHeight * 1.1;
            // A catch lying on its side (`meal-acts.ts`): its body turned by the roll, lowered so its side meets the ground.
            if (act?.lying && !where.water) {
                const box = (level === "near" ? model.near ?? model.far : model.far ?? model.near)?.geometry.boundingBox ?? null;
                if (box) where.base -= lyingDrop({minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y}, 0, where.roll) * s;
            }
            // (Lane L2: a sidewinder's body lies across its way while it moves, `l2Sidewind`.)
            if (entry.l2 && !where.water && !act) where.yaw += l2Sidewind(entry.l2, entry.phase);
            let stand: Stand | null = null;
            // (ARK-CANOPY: and always on its canopy route: swinging under a hold its back tilts past the half way at each end
            // of the swing, and an upright body was turned onto its back there, head down, twice a swing.)
            const uprightOn = surface && (Math.abs(surface.ny) < 0.5 || (surface as {canopy?: boolean}).canopy) ? uprightBody(animal.model_slug) : null; // p5 (monkeys)
            if (surface && uprightOn) {
                // p5 (monkeys): an upright-bodied model (a gibbon, an ape: taller than long) on a trunk, a wall, or hanging
                // from a hold: its spine along the climb's heading, its front to the surface, its front's depth off it.
                basisY.set(surface.tx, surface.ty, surface.tz).normalize();
                basisZ.set(-surface.nx, -surface.ny, -surface.nz);
                basisZ.addScaledVector(basisY, -basisZ.dot(basisY)).normalize();
                basisX.crossVectors(basisY, basisZ);
                rotation.setFromRotationMatrix(basisMatrix.makeBasis(basisX, basisY, basisZ));
                const along = -groundedLevelBase(animal.model_slug, rig ? "rig" : level, model.minY) * s;
                const out = uprightOn.front * s;
                position.set(where.x + surface.nx * out + basisY.x * along, where.base + surface.ny * out + basisY.y * along, where.z + surface.nz * out + basisY.z * along);
            } else if (surface) {
                // On its surface: its back to the surface's normal, heading the way it crawls; its underside on the surface.
                basisY.set(surface.nx, surface.ny, surface.nz).normalize();
                basisZ.set(surface.tx, surface.ty, surface.tz);
                basisZ.addScaledVector(basisY, -basisZ.dot(basisY)).normalize();
                basisX.crossVectors(basisY, basisZ);
                rotation.setFromRotationMatrix(basisMatrix.makeBasis(basisX, basisY, basisZ));
                const up = -groundedLevelBase(animal.model_slug, rig ? "rig" : level, model.minY) * s + (1 - Math.min(grow, 1)) * -modelHeight * 0.3;
                position.set(where.x + surface.nx * up, where.base + surface.ny * up, where.z + surface.nz * up);
            } else {
                // Grounding: its true base on the drawn ground, leaning to the slope (the pose's own offsets carried over).
                stand = !act && (!slept || sleepsStanding) && groundingRules() === "grounded" && standsOnGround({...where, base: poseBase}, heightAt(where.x, where.z), standGround(where.x, where.z, poseBase))
                    ? groundedStand({slug: animal.model_slug, level: rig ? "rig" : level === "far" ? "far" : "near", x: where.x, z: where.z, yaw: where.yaw, pitch: 0, roll: 0, scale: s, minY: model.minY, clip: rig ? entry.rig?.now.name : null, clipWeight: entry.rig?.weight, ground: island ? (x, z) => standGround(x, z, poseBase) : standGround})
                    : null;
                if (stand) {
                    where.pitch += stand.pitch;
                    where.roll += stand.roll;
                }
                euler.set(where.pitch, where.yaw, where.roll);
                rotation.setFromEuler(euler);
                const standY = stand ? stand.rootY + where.base - poseBase : where.base - groundedLevelBase(animal.model_slug, rig ? "rig" : level, model.minY) * s;
                position.set(where.x, standY + lift - (1 - Math.min(grow, 1)) * modelHeight * 0.3, where.z);
                // 3.3 batch (D): the limp after an escape: an uneven dip and roll onto the leg it favours, on its feet only.
                // (On the drawn body alone: the pose itself, which a still clock hands back again, is left as it is.)
                if (escapeLimp && !where.water && !where.afloat && !slept && !act?.role && entry.air < 0.5 && escapeLimp(animal.id, epochNow, act ? (act.speed ?? 0) > 0.05 : Boolean(entry.sched?.pose?.moving), entry.length, limpNow)) {
                    position.y -= limpNow.drop;
                    rotation.setFromEuler(euler.set(where.pitch + limpNow.pitch, where.yaw, where.roll + limpNow.roll));
                }
            }
            const state = rig ? entry.rig : null;
            if (surface && rig && state && state.weight > 0.5 && rig.clips[state.now.name] && gripPoint(rig, clipRows(rig.clips[state.now.name], state.now.phase), rigGrip)) {
                // On a branch, a trunk, a ledge or a wall: its grip (the rig's feet, hands, claws) on the surface, not its underside (`map/grip.ts`).
                // (Grounding: the soles, not the grip bones' pivots: a percher's toes on the branch, not its ankles in it.)
                if (groundingRules() === "grounded") rigGrip.y -= gripSoleDrop(animal.model_slug);
                rigGrip.multiplyScalar(s).applyQuaternion(rotation);
                position.set(where.x - rigGrip.x, where.base - rigGrip.y, where.z - rigGrip.z);
            }
            if (rig && state) {
                // A leap's clip carries the body forward itself: take that off the path's own motion.
                const leap = state.now.name === "leap" ? rig.clips.leap : undefined;
                if (leap) {
                    rootOffset(rig, leap, state.now.phase, rigLift).multiplyScalar(s * state.weight).applyQuaternion(rotation);
                    position.x -= rigLift.x;
                    position.z -= rigLift.z;
                }
                // A take-off, a landing, into or out of the water: the path (and the depth band) already makes the rise and
                // the sink, so the clip's own body offset from the rest pose comes off, in the share each clip is drawn.
                const fromShare = state.from ? 1 - easeInOut(Math.min(state.fade, 1)) : 0;
                for (const [play, share] of [[state.now, 1 - fromShare], [state.from, fromShare]] as const) {
                    const carried = play && share > 0 && PATH_CARRIED_CLIPS.has(play.name) ? rig.clips[play.name] : undefined;
                    if (!carried || !play) continue;
                    rootOffset(rig, carried, play.phase, rigLift, true).multiplyScalar(s * state.weight * share).applyQuaternion(rotation);
                    position.sub(rigLift);
                }
                // ARK-CONTACT (decision 447, the owner's hovering cat): a clip played in place on the ground (a pounce, a
                // strike at play, a Power clip) lifted its root off its rest as if it leapt, with nothing under it carrying
                // a leap: the body stood in the air over its shadow for the clip's length. On the ground its rise past a
                // bob comes off (`grounding/contact.ts` inPlaceLift), as a standing clip's sole offset does.
                if (stand && !state.flying) {
                    for (const [play, share] of [[state.now, 1 - fromShare], [state.from, fromShare]] as const) {
                        const inPlace = play && share > 0 && play.name !== "leap" && !PATH_CARRIED_CLIPS.has(play.name) && !feetCarryClip(play.name) ? rig.clips[play.name] : undefined;
                        if (!inPlace || !play) continue;
                        const rise = rootOffset(rig, inPlace, play.phase, rigLift, true).y * s * state.weight * share;
                        position.y -= inPlaceLift(rise, modelHeight);
                    }
                }
                const clipNow = rig.clips[state.now.name];
                const [a0, a1, at] = clipNow ? clipRows(clipNow, state.now.phase) : [0, 0, 0];
                (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute).setXYZW(index, a0, a1, at, clipNow ? state.weight : 0);
                const clipFrom = state.from ? rig.clips[state.from.name] : undefined;
                if (clipFrom && state.from) {
                    const [b0, b1, bt] = clipRows(clipFrom, state.from.phase);
                    (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).setXYZW(index, b0, b1, bt, 1 - easeInOut(Math.min(state.fade, 1)));
                } else {
                    (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).setXYZW(index, 0, 0, 0, 0);
                }
            }
            // Grounding's runtime check (development, `?grounding=1`): its contacts against what it stands on.
            if (groundingCheck.on && !slept && !act && !where.water && entry.air <= 0.001 && !entry.denIn) {
                const checkLevel = rig ? "rig" : level === "far" ? "far" : "near";
                if (!surface && standsOnGround({...where, base: poseBase}, heightAt(where.x, where.z), standGround(where.x, where.z, poseBase))) groundingCheck.record(animal.id, animal.model_slug, "ground", drawnContactGap(animal.model_slug, checkLevel, model.minY, position, rotation, s, (x, z) => standGround(x, z, poseBase)) ?? 0, modelHeight);
                else if (surface && !(rig && state && state.weight > 0.5)) groundingCheck.record(animal.id, animal.model_slug, "surface", surfaceContactGap(animal.model_slug, checkLevel, model.minY, position, rotation, s, {x: where.x, y: where.base, z: where.z}, surface), modelHeight);
            }
            // Powers you can see: its body down into cover, crouched, on its side, or up off the ground (`power-show.ts` drop).
            // ARK-CONTACT (decision 447, the hovering cat): a lift (a negative drop: the climb Power's "up the slope's way",
            // 45% of its height, the vigilance stand's 8%) only off the ground or for a flyer. On the ground a walker rose
            // into the air with nothing under it, nose up like a pounce, its shadow left below: its climb is its shift,
            // its attitude and its clip.
            const powerFlies = entry.air > 0.001 || model.behaviour?.plan === "bird" || model.behaviour?.plan === "bat" || model.behaviour?.plan === "flying_insect";
            if (entry.power?.drop && !reducedMotion) position.y -= entry.power.drop < 0 && stand && !powerFlies ? 0 : entry.power.drop;
            // ARK-SEAT: what it is doing, for its seat, and the offset its last solve left it (eased in).
            const seatAs = seatKind({
                riding: Boolean(entry.ride?.on),
                carried: entry.riding === true,
                hanging: entry.hangFrom != null,
                onWeb: Boolean(surface) && Boolean(webNoted.get(animal.id)),
                flying: entry.air > 0.001 || Boolean(state?.flying) || Boolean(entry.sched?.pose?.aloft),
                water: Boolean(where.water) || Boolean(where.edge),
                afloat: where.afloat,
                den: Boolean(entry.denIn) || Boolean(entry.power?.drop),
                growing: grow < 1,
                // (An act on its feet, a stalk, a run, a meal, is seated like any other; one in the air or the water, or fading out, is its own.)
                acting: Boolean(act) && (act!.hidden || act!.scale < 0.999 || SEAT_ACT_FREE.has(act!.state ?? "")),
                swinging: Boolean((surface as {canopy?: boolean} | undefined)?.canopy),
                hopping: Boolean(entry.hop?.hopping),
                surfaceNy: surface ? surface.ny : null,
                lying: (Boolean(slept) && !sleepsStanding) || lyingOn !== null || Boolean(act?.lying)
            });
            const seated = seat.offset(entry, seatAs, dt);
            if (seated) {
                position.x += seated.x;
                position.y += seated.y;
                position.z += seated.z;
            }
            matrix.compose(position, rotation, scale.set(s, s, s));
            // ARK-CONTACT round 4 (the town's cat asleep 4 to 14 cm over the lawn): a body lying on the ground in its
            // rig's sleep or lying pose, settled (no fade from another clip), lowered until the pose's own lowest
            // points (its clip's frame, skinned: `grounding/tips.ts`) meet the ground, by 15 cm at most.
            if (rig && state && lyingOn !== null && entry.sleepClipped && state.weight >= 0.999 && !state.from && !reducedMotion) {
                const clipNow = rig.clips[state.now.name];
                if (clipNow) {
                    const drop = seatDrop(lowestPoints(rig, clipRows(clipNow, state.now.phase)[0]), matrix.elements, (x, z) => standGround(x, z, poseBase));
                    if (drop > 0) {
                        position.y -= drop;
                        matrix.setPosition(position);
                    }
                }
            }
            // Development (ARK-CONTACT's zoom probe, `scripts/ark-contact-shots.mjs`): where it is drawn, its base by
            // the level it is drawn at, to measure any jump as the camera crosses a level's distance.
            if (process.env.NODE_ENV !== "production") {
                const drawn = ((entry as {drawn?: {x: number; y: number; z: number; level: string; root?: number; ground?: number; lying?: number | null; slept?: boolean; scale?: number}}).drawn ??= {x: 0, y: 0, z: 0, level: ""});
                drawn.x = position.x;
                drawn.y = position.y + groundedLevelBase(animal.model_slug, rig ? "rig" : level, model.minY) * s;
                drawn.z = position.z;
                drawn.level = rig ? "rig" : level;
                drawn.root = position.y;
                drawn.ground = standGround(where.x, where.z, poseBase);
                drawn.lying = lyingOn;
                drawn.slept = Boolean(slept);
                drawn.scale = s;
                (drawn as {m?: number[]}).m = matrix.elements.slice();
                Object.assign(drawn, {path: entry.posePath ?? null, frameDt: dt, wx: where.x, wz: where.z, yaw: where.yaw, react: entry.reactive ? {x: entry.reactive.dx, z: entry.reactive.dz} : null, apart: entry.apart ? {...entry.apart} : null, surfacePoint: surface ? {x: surface.x, y: surface.y, z: surface.z, nx: surface.nx, ny: surface.ny, nz: surface.nz} : null, faceFixed: Boolean(entry.drawnFace && surface === entry.drawnFace), inWater: Boolean(where.water), afloat: Boolean(where.afloat), waterTop: waterTopAt(where.x, where.z), height: heightAt(where.x, where.z), base: where.base, poseY: entry.sched?.pose?.y ?? null, clip: entry.rig?.now.name ?? null});
            }
            // ARK-RIDERS: the matrix as finally drawn (after the contact seat-drop above), for a rider to sit on.
            if (riddenNow.has(animal.id)) {
                (entry.drawnMatrix ??= new Matrix4()).copy(matrix);
                entry.drawnFrame = rideFrame;
                entry.drawnRig = rig && state && mesh ? {rig, mesh, index} : null;
            }
            if (rig && state && level === "near") {
                // The locomotion layer (`locomotion/`, lane L1): gaits with planted feet, foot IK, the body's motion and
                // the tail's, posed on the CPU into the species' live pose row (the baked rows when it is off).
                const act2 = act as {state?: string; speed?: number} | null;
                // (A behaviour recipe's state too: its attitude, a crouch or a rear, stays on the body.)
                // (Powers you can see: an act's state, a catalogue recipe played on demand or a lane's clip, when nothing else plays.)
                const recipeState = ((entry.sched?.pose ?? null) as RecipePose | null)?.act?.state ?? entry.recipeAct?.state ?? (reducedMotion ? null : entry.power?.state) ?? null;
                // (Lane TB: one held in a cage, a vivarium or a zoo house keeps its clip's feet: its floor may be over another.)
                // (On the ground only, by grounding's own test: a pose held up on something the drawn ground does not know, a
                // rock's top, a log, a climb's ramp, is no ground for the feet; the legged driver would stand its body on the
                // terrain under it, inside the rock. The komodo basking on a boulder, 2026-11-13; the film lane's 1c4ae4ce.)
                const grounded = !surface && !where.water && !where.afloat && entry.air <= 0.001 && !entry.place.canopy && !entry.place.micro && !entry.place.burrow && !slept && !(island && island.held(animal.id)) && standsOnGround({...where, base: poseBase}, heightAt(where.x, where.z), standGround(where.x, where.z, poseBase));
                const locoAt = perf.on ? performance.now() : 0;
                // (ARK-SEAT: on a rock's top or a roof its feet's ground is that top, not the terrain under it.)
                const seatFloor = entry.seat && entry.seat.floor !== null && (entry.seat.x || entry.seat.y || entry.seat.z) ? entry.seat.floor : null;
                const live = rigLivePose(rig, state, {instance: matrix, scale: s, yaw: where.yaw, dt: frameDt, clock: epochNow, seed: entry.phase, grounded, ...(seatFloor !== null ? {ground: () => ({height: seatFloor, nx: 0, ny: 1, nz: 0})} : {}), actState: act2?.state ?? recipeState ?? ((entry.sleepNow?.t ?? 0) > 0.3 ? "sleep" : null), actSpeed: act2?.speed ?? null, airStage: state.flying ? (entry.sched?.pose as TripPose | null | undefined)?.air?.stage ?? null : null, canopy: (surface as {arms?: LocoCanopy | null} | null | undefined)?.arms ?? (entry.hop && (entry.hop.hopping || state.pace > entry.length * 0.1) && !surface && !where.water && brachiates(animal.model_slug, animal.scientific_name) ? {phase: "walk", hand: null, next: null, lead: 1, u: (epochNow * 1.4 + entry.phase) % 1, brachiate: true} : null)}, index);
                if (perf.on) perf.carve("locomotion", performance.now() - locoAt);
                if (live) {
                    (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute).setXYZW(index, live.code, live.code, 0, state.weight);
                    (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).setXYZW(index, 0, 0, 0, 0);
                }
            }
            // ARK-SEAT: where its body, as posed and placed now, rests on what is drawn (worked out for a few a frame).
            if (!seat.off) {
                const rigA = rig && state ? (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute) : null;
                const rigB = rig && state ? (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute) : null;
                const liveRow = rigA && rigA.getX(index) < -0.5 ? Math.round(-rigA.getX(index)) - 1 : -1;
                seat.settle({
                    holder: entry,
                    kind: seatAs,
                    matrix,
                    geometry: rig ? rig.geometry : mesh.geometry,
                    pose: rig && rigA && rigB ? {bones: rig.bones, live: liveRow >= 0 ? rig.loco?.live.data ?? null : null, liveRow, baked: rig.data, row0: Math.max(rigA.getX(index), 0), row1: Math.max(rigA.getY(index), 0), t: rigA.getZ(index), from0: Math.max(rigB.getX(index), 0), from1: Math.max(rigB.getY(index), 0), fromT: rigB.getZ(index), fromWeight: rigB.getW(index), weight: rigA.getW(index)} : null,
                    height: modelHeight,
                    length: entry.length * sizeUp,
                    surface: surface ?? null,
                    moving: Boolean(entry.sched?.pose?.moving),
                    ground: (x, z, near) => standGround(x, z, near ?? poseBase),
                    focus: selectedId === animal.id,
                    level
                });
            }
            mesh.setMatrixAt(index, matrix);
            // 3.3 batch (A): its defence move (`defence-moves.ts`): stepped from the reactive layer's action, drawn by the
            // shader from `arkInstance.w` in place of its sleep (a negative pack), said in the log in its species' words.
            const defenceSpec = (entry.defenceSpec ??= defenceMoveOf(animal.model_slug) ?? false);
            let defended = 0;
            if (defenceSpec && !reducedMotion) {
                const moveState = (entry.defence ??= newDefenceState());
                const tail = model.behaviour?.tail?.length ?? 0;
                const reacted = act ? null : entry.reactive;
                const near = act || !entry.place.micro ? 0 : entry.defenceNear ?? 0;
                // (SIG-DEFENCE: one that rears only when cornered does it at a predator very close; a deer's stamp at a
                // disturbance the day's schedule gives now and then, awake and about its own day.)
                const beside = defenceSpec.cornered && near < 2 ? 0 : near;
                const disturbed = Boolean(defenceSpec.disturbance && !act && !slept && !entry.moment && !entry.visitor && disturbedNow(animal.id, epochNow));
                stepDefence(moveState, defenceSpec, {action: beside ? "withdraw" : reacted?.action ?? null, alarmed: beside ? 1 : reacted?.alarmed ?? 0, pressed: near === 2 || Boolean(reacted?.pressed), moved: tail > 0 && moveState.shed >= 0 ? Math.hypot(where.x - (entry.defenceAt?.x ?? where.x), where.z - (entry.defenceAt?.z ?? where.z)) / (tail * s) : 0, disturbed}, dt);
                (entry.defenceAt ??= {x: 0, z: 0}).x = where.x;
                entry.defenceAt.z = where.z;
                if (!slept) defended = defencePack(moveState, defenceSpec, model.behaviour?.plan);
                const said = candidate.distance < 45 ? defenceSaid(moveState, defenceSpec, animal.id) : null;
                if (said) defenceSeen.push({id: animal.id, name: animal.name, speciesId: animal.kind_species_profile_id || animal.species_profile_id || `slug:${animal.model_slug}`, zone: animal.zone, recipe: `defence_${defenceSpec.move}`, episode: said, block: "defend", fish: false, line: defenceSpec.line});
            }
            // p3 (shake): shaking off the water (`water-shake.ts`), drawn from w as the moves are (a move or sleep wins).
            // Powers you can see: an armoured one's shape (a move of its own, or its sleep, wins).
            if (!defended && !slept && !reducedMotion && entry.power?.pack) defended = entry.power.pack;
            if (!defended && !slept && !reducedMotion) defended = shakePackOf(((entry.sched?.pose ?? null) as RecipePose | null)?.act, animal.model_slug, entry.length, entry.rig?.now.name === "shake_off" && entry.rig.weight > 0.5);
            // (The duller sex a little greyer: `sexDim`, beside the per-instance variation `arkVary`.)
            entry.sexDim ??= sexDim(entry.animal.id, entry.animal.model_slug);
            // Its sleep for the shader in w (`packSleep`): eyes shut, the curl (near only), a tail flick, its breaths a second.
            (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).setXYZW(index, entry.phase, Math.min((act ? act.dim : dim) + entry.sexDim, 1), entry.rest, defended || (slept ? packSleep(eyesOpenForDev ? 0 : slept.eyes, level === "near" && !sleepsStanding ? slept.curl : 0, slept.flick, slept.breath) : packSleep(0, 0, 0, 0)));
            setVary(mesh.geometry, index, animal.id);
            if (entry.power?.q) setVaryPower(mesh.geometry, mesh.material, index, entry.power.q, entry.power.look);
            // The head look (near only; it fades out as the animal falls asleep).
            const lookAttr = mesh.geometry.getAttribute("arkLook") as InstancedBufferAttribute | undefined;
            const looked = level === "near" ? entry.reactive : null;
            const forcedLook = forcedLooks.size && level === "near" ? forcedLooks.get(entry.animal.id) : undefined;
            if (lookAttr && forcedLook) lookAttr.setXYZ(index, forcedLook[0], forcedLook[1], forcedLook[2]);
            else if (lookAttr && slept && slept.headWeight > 0.001 && level === "near") {
                // Asleep: its posture's head (back to its flank, down, sunk), within its plan's limits, allowing for the
                // material's own droop; a waking head goes over to the reactive layer's look.
                const limits = headLimits(intelProfile(animal.model_slug, null, entry.stats.intelligence).plan, animal.model_slug);
                const hw = slept.headWeight;
                const awakeW = looked ? looked.headWeight * (1 - entry.rest) * (1 - hw) : 0;
                const yaw = Math.min(Math.max(slept.headYaw, -limits.yaw), limits.yaw);
                const pitch = Math.min(Math.max(slept.headPitch + droopOf(model.behaviour?.plan) * entry.rest, -limits.down), limits.up);
                lookAttr.setXYZ(index, (looked?.headYaw ?? 0) * awakeW + yaw * hw, (looked?.headPitch ?? 0) * awakeW + pitch * hw, 1);
            } else if (lookAttr) lookAttr.setXYZ(index, looked?.headYaw ?? 0, looked?.headPitch ?? 0, looked ? looked.headWeight * (1 - entry.rest) : 0);
            // Powers you can see: head up in alarm, or a hunter's look at a prime one and away (`power-show.ts`).
            const powerHead = level === "near" && !slept && !forcedLook && !reducedMotion ? entry.power?.head : null;
            if (lookAttr && powerHead && powerHead[2] > 0.05) lookAttr.setXYZ(index, powerHead[0], powerHead[1], powerHead[2]);
            // Lane L2's body channel (w): a swimmer's or a crawler's wave by the distance it moved (near only).
            if (lookAttr) lookAttr.setW(index, level === "near" && !reducedMotion ? l2BodyChannel(l2Of(entry, model.behaviour?.plan), where.x, where.base, where.z, frameDt, entry.length, Boolean(where.water) || (where.afloat && where.base < 0)) : 0);
            // Grazing or browsing on its rig, the head stays where the clip puts it: the look only turns it sideways.
            if (lookAttr && !forcedLook && rig && state && (state.now.name === "graze" || state.now.name === "browse")) lookAttr.setY(index, 0);
            // The animal-look pass: wet (rain, a swim, in the water) and dust per animal; the near ones offered fur shells and their close-up skin.
            const sea = ARK_ENVIRONMENT.seaLevel.value;
            look.instance(mesh, index, {
                id: animal.id,
                slug: animal.model_slug,
                x: where.x,
                y: where.base,
                z: where.z,
                distance: candidate.distance,
                pixels: (entry.length * sizeUp * height) / (2 * Math.tan((FOV * Math.PI) / 360) * Math.max(candidate.distance, 0.01)),
                inWater: where.afloat && !surface && where.base < sea + 0.1 && entry.place.ground < sea,
                onSurface: Boolean(surface)
            }, level === "near");
            // Wet or muddy or dusty from its recent acts (a wallow, a dust bath, a dive): after the look pass wrote `arkCoat`,
            // the larger of the two (`applyRecipeCoat`).
            applyRecipeCoat(mesh.geometry, index, recipeNear.get(entry.animal.id)?.coat);
            // 3.3 batch (C): a young one's own coat (a striped piglet, a banded hatchling: `young-coat.ts`), by its age.
            if (animal.origin === "born") applyYoungCoat(mesh.geometry, index, youngCoatSteps(entry));
            // 3.3 batch (C): its antlers this month (growing in velvet, shed): `antler-cycle.ts`.
            applyAntler(mesh.geometry, index, antlerNow(entry)?.code ?? 0);

            // Contact shadows (the animal-look pass): on a broad surface the animal really is on (a small one on a wall,
            // a leaf, a stone; a perch on bark, a rock face, a log), never on a limb, a post or a leap through the canopy,
            // nor under water; everything else is projected down onto the ground under it now, and fades as it leaves
            // the ground (a hop, a perch, flight), none where water covers the ground.
            const broadSurface = Boolean(surface) && !entry.toLight && !where.water && !entry.place.canopy && (Boolean(entry.place.micro) || Boolean(entry.place.perch && SHADOW_SURFACE_TAGS.has(entry.place.perch.tag)));
            // (Round 3: on a rock, a leaf or a wall its shadow is on that surface with the look pass off too; it fell back to
            // the terrain under it, a metre down, and drew nothing: the crab on its rock with no shadow under it.)
            const underFeet = broadSurface ? null : groundUnderAt(where.x, where.z, ARK_ENVIRONMENT.seaLevel.value, level === "near", poseBase);
            // (A sleeper lying on the ground touches it with its body, its legs folded into it: its shadow stays.)
            const contact = underFeet ? groundContact(lyingOn !== null ? Math.max(lyingOn, underFeet.height) : where.base + lift, underFeet.height, underFeet.water, modelHeight) : null;
            if (broadSurface || contact) {
                const box = (level === "near" ? model.near : model.far)!.geometry.boundingBox!;
                // ARK-CONTACT (decision 447, "animal shadows don't match their body or size"): its own box as it lies now,
                // turned by its pitch and roll (a lion on its side, a giraffe's long narrow body), at every level; no
                // generic floor (from afar every shadow was at least 40 cm across: a sparrow's a fox's).
                const foot = shadowFootprint(box, candidate.modelScale * sizeUp, where.pitch, where.roll);
                const width = foot.width;
                const length = foot.length;
                if (broadSurface && surface) {
                    // On a wall, a leaf, a flower or a stone: under its body (not its splayed legs), on that surface where it
                    // touches it, long the way it crawls.
                    shadowList.push({x: where.x, y: where.base, z: where.z, width: width * 0.8, length: length * 0.9, yaw: where.yaw, strength: grow, nx: surface.nx, ny: surface.ny, nz: surface.nz, tx: surface.tx, ty: surface.ty, tz: surface.tz});
                } else if (contact) {
                    // On the ground under it: on its slope (near ones, with the pass on), under the body's middle (a
                    // model's origin is not always there: a seal's is at its chest), turned with it.
                    // (Its middle at every level and with the pass off too: a level change never moves the shadow.)
                    const normal = look.on && level === "near" ? groundNormalAt(where.x, where.z) : null;
                    const midX = foot.midX;
                    const midZ = foot.midZ;
                    shadowList.push({
                        x: where.x + midX * Math.cos(where.yaw) + midZ * Math.sin(where.yaw),
                        y: contact.y,
                        z: where.z - midX * Math.sin(where.yaw) + midZ * Math.cos(where.yaw),
                        width: Math.max(width, 0.004),
                        length: Math.max(length, 0.004),
                        yaw: where.yaw,
                        strength: grow * contact.strength,
                        ...(normal ? {nx: normal.x, ny: normal.y, nz: normal.z} : {})
                    });
                }
            }
            if (marked === 3 && entry.length < 0.05) {
                // V1: the last of a kind's ring round a speck is its own size, where it lies (a 0.7 m ring round an aphid or
                // a water flea filmed from a centimetre is nowhere in the picture; the rings are drawn 8 cm up, `marks.ts`).
                ringList.push({x: where.x, y: where.base + 0.0008 - 0.08, z: where.z, radius: Math.max(entry.length * 1.6, 0.004), color: LAST_OF_KIND, alpha: 1});
            } else if (marked && !entry.micro) {
                // On the ground under it now (its home spot's height floated the ring over one that had walked downhill); on the
                // water's surface over a swimmer or a wader (lane MA3 water 2: the sea's 0 as before; the v2 lake's 6 m, where it
                // was drawn at 0, under the lake's bed).
                const ringY = where.afloat ? (island?.contains(where.x, where.z) ? where.base : waterTopAt(where.x, where.z)) : Math.max(underFeet?.height ?? groundUnderAt(where.x, where.z, ARK_ENVIRONMENT.seaLevel.value, true, poseBase).height, island?.contains(where.x, where.z) ? 0 : waterTopAt(where.x, where.z));
                ringList.push({x: where.x, y: ringY, z: where.z, radius: Math.max(entry.length * sizeUp * 0.8, 0.7), color: marked === 2 ? SELECTED : marked === 3 ? LAST_OF_KIND : MINE, alpha: 1});
            } else if (marked && surface && surface.ny > 0.8 && !entry.toLight) {
                // A small one on level ground (the litter, a flower, the pond): a ring its own size.
                ringList.push({x: where.x, y: where.base + 0.004, z: where.z, radius: Math.max(entry.length * 1.3, 0.025), color: marked === 2 ? SELECTED : marked === 3 ? LAST_OF_KIND : MINE, alpha: 1});
            }
        }

        perf.lap("instances");
        // The herds' figures after their species' representatives, in the same far mesh (one draw call); the specks in one mesh for all.
        specks.begin();
        for (const herd of herdPlans) {
            const model = library.get(herd.slug);
            const mesh = species.get(herd.slug)?.far ?? null;
            const instance = mesh ? mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute : null;
            const target = mesh ? mesh.instanceMatrix.array as Float32Array : null;
            let index = mesh ? perMesh.get(mesh) ?? 0 : 0;
            const colour = herd.herd.colour ?? (herd.herd.colour = model?.far ? textureColour(model.far.map, model.placeholder ? "#b9a789" : "#8f7f66") : null) ?? herd.colour;
            for (let k = herd.hidden ?? 0; k < herd.drawn; k++) {
                const i = herd.order[k];
                const member = herd.members[i];
                const dim = mineOnly && !member.mine ? 1 : 0;
                if (k < herd.figures && mesh && target && instance && model) {
                    const at = index * 16;
                    for (let j = 0; j < 16; j++) target[at + j] = herd.figureMatrices[i * 16 + j];
                    instance.setXYZW(index, member.phase, dim, member.awake ? 0 : 1, packSleep(member.awake ? 0 : 1, 0, 0, 0));
                    look.figure(mesh, index);
                    setVary(mesh.geometry, index, member.id);
                    index++;
                    if ("resting" in herd.herd) counts.restingFigures++;
                    else counts.herdFigures++;
                    if (!member.water && shadowList.length < 900) shadowList.push({x: member.x, y: Math.max(member.ground, 0), z: member.z, width: herd.width, length: herd.depth, yaw: member.yaw, strength: 1});
                } else if (colour) {
                    specks.push(herd.shape, herd.speckMatrices, i * 16, dim ? DIM_SPECK : colour);
                    if ("resting" in herd.herd) counts.restingSpecks++;
                    else counts.herdSpecks++;
                }
            }
            if (mesh && index > (perMesh.get(mesh) ?? 0)) {
                perMesh.set(mesh, index);
                used.add(mesh);
            }
        }
        specks.end();

        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far, meshes.rig ?? null]) {
                if (!mesh) continue;
                const count = used.has(mesh) ? perMesh.get(mesh) ?? 0 : 0;
                mesh.count = count;
                mesh.visible = count > 0;
                if (count) {
                    mesh.instanceMatrix.needsUpdate = true;
                    (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).needsUpdate = true;
                    const lookAttr = mesh.geometry.getAttribute("arkLook") as InstancedBufferAttribute | undefined;
                    if (lookAttr) lookAttr.needsUpdate = true;
                    AnimalLook.touch(mesh);
                    if (mesh === meshes.rig) {
                        (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute).needsUpdate = true;
                        (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).needsUpdate = true;
                    }
                }
            }
        });
        counts.rigged = rigged;
        look.end(now, shellMaterial);
        // p3 (reflect): after every instance is written: the nearest animals over still water, mirrored in it.
        reflections.setTier(tier, liteOn());
        reflections.setReducedMotion(reducedMotion);
        reflectSources.length = 0;
        species.forEach((meshes) => reflectSources.push(meshes.rig ?? null, meshes.near, meshes.far));
        reflections.update(reflectSources, camera.position, ARK_ENVIRONMENT.seaLevel.value, now, ARK_TIME.value);
        if (now - lastEvict > 5) {
            lastEvict = now;
            // (And room under the caps for as many species as may be rigged at once: the caps count what is held.)
            rigs.evict(now - RIG_KEEP_SECONDS, RIG_KEEP, (liteOn() ? RIG_CAPS_DRAWN_LITE : RIG_CAPS_DRAWN).species);
        }
        // The splashes of the moments.
        for (let i = ripples.length - 1; i >= 0; i--) {
            const age = now - ripples[i].start;
            if (age > 2.4 || age < 0) {
                ripples.splice(i, 1);
                continue;
            }
            ringList.push({x: ripples[i].x, y: 0.03, z: ripples[i].z, radius: 0.4 + age * 1.7, color: ARRIVAL, alpha: 0.9 * (1 - age / 2.4) ** 1.5});
        }
        // 3.3 batch (D): and the rings of a laying dragonfly's taps.
        if (dipRipples.size) dipRipples.each(epochNow, (x, y, z, radius, alpha) => ringList.push({x, y, z, radius, color: ARRIVAL, alpha}));
        // The animals that glow, at night: a soft glow on each.
        const glowing: Array<{x: number; y: number; z: number; strength: number}> = [];
        if (night > 0.3) {
            for (const entry of allEntries()) {
                if (!entry.layer.glow || !entry.middle) continue;
                glowing.push({x: entry.middle.x, y: entry.middle.y, z: entry.middle.z, strength: Math.min((night - 0.3) / 0.4, 1) * (0.75 + 0.25 * Math.sin(now * 1.7 + entry.phase * 20))});
            }
        }
        layersScene.setGlow(glowing);
        tokens.set(tokenList, camera);
        for (const dot of streamDots) dotList.push(dot);
        streamMarkers = streamDots.length;
        dots.set(dotList);
        shadows.set(shadowList);
        rings.set(ringList);
        perf.lap("herds");
    };

    // MARK: Camera

    /** A flight eases the target, the distance, and (when given) the angle from straight down and the bearing. */
    type Flight = {from: Vector3; to: Vector3; fromDistance: number; toDistance: number; fromPolar: number; toPolar: number; fromAzimuth: number; toAzimuth: number; start: number; seconds: number; then?: () => void; aim?: () => Vector3 | null};
    let flight: Flight | null = null;
    const offset = new Vector3();
    const spherical = new Spherical();

    const fly = (target: Vector3, distance: number, seconds = 1.1, polar?: number, azimuth?: number, then?: () => void) => {
        distance = Math.min(Math.max(distance, controls.minDistance), maxDistance);
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const toPolar = polar ?? spherical.phi;
        let toAzimuth = azimuth ?? spherical.theta;
        // The short way round.
        while (toAzimuth - spherical.theta > Math.PI) toAzimuth -= Math.PI * 2;
        while (toAzimuth - spherical.theta < -Math.PI) toAzimuth += Math.PI * 2;
        if (reducedMotion || seconds <= 0) {
            spherical.radius = distance;
            spherical.phi = toPolar;
            spherical.theta = toAzimuth;
            controls.target.copy(target);
            camera.position.copy(target).add(offset.setFromSpherical(spherical));
            controls.update();
            then?.();
            return;
        }
        flight = {from: controls.target.clone(), to: target.clone(), fromDistance: spherical.radius, toDistance: distance, fromPolar: spherical.phi, toPolar, fromAzimuth: spherical.theta, toAzimuth, start: performance.now() / 1000, seconds, then};
    };

    const stepFlight = (now: number) => {
        if (!flight) return;
        const t = Math.min((now - flight.start) / flight.seconds, 1);
        const k = easeInOut(t);
        // Flying to something that moves (a small animal crawling): the destination keeps up with it.
        const aim = flight.aim?.();
        if (aim) flight.to.copy(aim);
        controls.target.lerpVectors(flight.from, flight.to, k);
        spherical.radius = flight.fromDistance + (flight.toDistance - flight.fromDistance) * k;
        spherical.phi = flight.fromPolar + (flight.toPolar - flight.fromPolar) * k;
        spherical.theta = flight.fromAzimuth + (flight.toAzimuth - flight.fromAzimuth) * k;
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        if (t >= 1) {
            const then = flight.then;
            flight = null;
            then?.();
        }
    };
    let lastTouch = performance.now() / 1000;
    controls.addEventListener("start", () => {
        flight = null;
        lastTouch = performance.now() / 1000;
        controls.autoRotate = false;
    });
    controls.addEventListener("end", () => {
        lastTouch = performance.now() / 1000;
    });

    // MARK: Part C, two islands in one world (decisions 141-142)

    /** Kept over either island or the strait between (a capsule from the wild island to the town): the move back in, or null. */
    const keepInCapsule = (x: number, z: number): {dx: number; dz: number} | null => {
        // p2 (ocean): in islands mode from the start (the town's origin before it is in), out over the open ocean's loops too.
        const o = island?.origin ?? townWorldOrigin();
        const l2 = o.x * o.x + o.z * o.z || 1;
        const t = Math.min(Math.max((x * o.x + z * o.z) / l2, 0), 1);
        const cx = o.x * t;
        const cz = o.z * t;
        const radius = WORLD_RADIUS + ((island?.worldRadius ?? ARK_ISLANDS.town.half * 0.92) - WORLD_RADIUS) * t + (arkWorld() === "v2" ? OCEAN_VIEW_MARGIN : 0); // p2 (ocean)
        const d = Math.hypot(x - cx, z - cz);
        if (d <= radius) return null;
        const pull = 1 - radius / d;
        return {dx: (cx - x) * pull, dz: (cz - z) * pull};
    };
    /** The island the view is over now (the nearer along the strait), told to the page when it changes. */
    let islandNear: "wild" | "town" = "wild";
    const stepIslandNear = () => {
        if (!island) return;
        const o = island.origin;
        const t = (controls.target.x * o.x + controls.target.z * o.z) / (o.x * o.x + o.z * o.z || 1);
        const next = island.contains(controls.target.x, controls.target.z) && t > 0.55 ? "town" : t < 0.45 ? "wild" : islandNear;
        if (next === islandNear) return;
        islandNear = next;
        options.onIslandNear?.(next);
    };
    /** An island's whole view: the wild island's default, or the town's from the south (its own radius). */
    const islandView = (id: "wild" | "town") => {
        if (id === "wild" || !island) return homeView();
        const aspect = width / Math.max(height, 1);
        const vertical = FOV * Math.PI / 180;
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
        const fit = Math.min(vertical, horizontal);
        const radius = aspect < 0.8 ? island.home.radiusTall : island.home.radius;
        const distance = Math.min(radius / Math.sin(fit / 2) * 0.8, maxDistance);
        return {target: new Vector3(island.home.x, 0, island.home.z), distance: distance * 0.94, polar: 1.0, azimuth: 0};
    };

    /** The whole world in view, from the south and above (`islands/views.ts`: per world, with the town or without). */
    const homeView = () => {
        const view = wildHomeView(width / Math.max(height, 1), FOV, island ? island.origin : null, Boolean(options.wildAnimals));
        return {target: new Vector3(view.target.x, view.target.y, view.target.z), distance: view.distance, polar: view.polar, azimuth: view.azimuth};
    };

    // Keep the view over the world and above the ground.
    const keepInWorld = () => {
        const target = controls.target;
        const reach = Math.hypot(target.x, target.z);
        // (Part C: with two islands the view may be anywhere over either and the strait between: a capsule.)
        const capsule = island || options.wildAnimals ? keepInCapsule(target.x, target.z) : null; // p2 (ocean)
        if (capsule) {
            target.x += capsule.dx;
            target.z += capsule.dz;
            camera.position.x += capsule.dx;
            camera.position.z += capsule.dz;
        } else if (!island && reach > WORLD_RADIUS) {
            const pull = WORLD_RADIUS / reach;
            const dx = target.x * pull - target.x;
            const dz = target.z * pull - target.z;
            target.x += dx;
            target.z += dz;
            camera.position.x += dx;
            camera.position.z += dz;
        }
        // (V2 replay: under a shot's cast the bed as it is drawn, where that lies under the analytic one: a lake's.)
        const seabed = shotClosest !== null ? Math.min(heightAt(target.x, target.z), standGround(target.x, target.z)) : heightAt(target.x, target.z);
        // Under the sea (a swimmer looked at, the director's dive) the target stays down there, above the sea floor.
        const diving = seabed < -0.4 && target.y < -0.15;
        // (Diving, it is only kept off the floor: it used to be pulled down onto it, which sank the view below a swimmer in its band.)
        // Fresh water stands above the sea (the lake at 6 m, the river, the town's canal and ponds), with its bed above
        // sea level too: the view rests on its surface as it does on the sea's, unless it looks at something under it (a
        // fish chosen in the lake). Before, a view over the lake sank to its bed and the camera came in under its water,
        // where nothing draws an underwater view: the water was gone from the picture (graphics pass 2026-11-14).
        // (Looked up only from near enough to come down to it, and for the camera only when it is low over its ground:
        // the whole views pay nothing.)
        const viewDistance = camera.position.distanceTo(target);
        const freshTop = !diving && viewDistance < 80 ? waterLevelAt(target.x, target.z, 0) : 0;
        // (V2 replay: or a shot's cast in it, `replay/shot.ts`.)
        // (V1: a shot of a speck, a water flea in a pool a hand deep: under its surface too, however shallow. From over
        // the water the camera was a pool's depth from an animal filmed from a centimetre.)
        const shotSpeck = shotClosest !== null && shotClosest < 0.25;
        const underFresh = Boolean(selectedId || followId || shotClosest !== null) && (freshTop - seabed > 0.4 || shotSpeck) && target.y < freshTop - (shotSpeck ? 0.005 : 0.15);
        const groundUnderTarget = diving ? seabed + 0.3 : underFresh ? Math.max(seabed, 0) : Math.max(seabed, freshTop, 0);
        // Close up (a gecko on a wall, a beetle on a trunk), or looking at an animal up a tree or on a wall, the target
        // may stand above the ground: only kept out of it.
        const looked = selectedId ? findEntry(selectedId) : null;
        // (Or at the chosen animal where it stands above the ground: on a roof, a balcony, a perch, in a tank on a
        // house's floor. The target was pulled down to the ground under it from 6 m and further, and the animal left
        // the top of the picture: graphics pass 2026-11-14.)
        const raised = Boolean(looked?.middle && looked.middle.y - looked.drawnHeight / 2 > groundUnderTarget + 0.3 && Math.hypot(target.x - looked.middle.x, target.z - looked.middle.z) < looked.length + 2);
        // (Humans visible: or at a person chosen at home up in a tower's flat.)
        const person = heldHuman ? townHumans.out.find((h) => h.id === heldHuman) : undefined;
        const raisedPerson = Boolean(person && person.y > groundUnderTarget + 0.3 && Math.hypot(target.x - person.x, target.z - person.z) < 4);
        const aloft = diving || viewDistance < 6 || raised || raisedPerson || Boolean(looked && (looked.place.canopy || looked.place.micro || looked.air > 0.001));
        const lift = (aloft ? Math.max(groundUnderTarget - target.y, 0) : groundUnderTarget - target.y) * 0.15;
        // A golden shot may hold a view the user cannot (development only: golden-entry.ts sets it for one shot).
        const golden = process.env.NODE_ENV !== "production" ? (window as unknown as {__arkGoldenCamera?: {maxPolar?: number; free?: boolean}}).__arkGoldenCamera : undefined;
        // (Not while following: a flyer is followed up in the air.)
        if (Math.abs(lift) > 0.001 && !followId && !golden?.free) {
            target.y += lift;
            camera.position.y += lift;
        }
        // Close to the ground only when close to what it looks at (a small animal), else well above it.
        // (V2 replay: a shot's camera is kept over the ground as it is drawn, where that lies under the analytic one: a lake's bed.)
        const below = shotClosest !== null ? Math.min(heightAt(camera.position.x, camera.position.z), standGround(camera.position.x, camera.position.z)) : heightAt(camera.position.x, camera.position.z);
        const floor = (diving && below < -0.4 ? below + 0.5 : Math.max(below, underFresh || camera.position.y > below + 6 ? 0 : waterLevelAt(camera.position.x, camera.position.z, 0), 0)) + (diving ? 0 : Math.min(Math.max(viewDistance * 0.25, shotClosest !== null ? 0.003 : 0.03), 1.2));
        if (camera.position.y < floor) camera.position.y = floor;
        // Looking up at the surface is allowed only under it; up at a canopy animal only while it is looked at.
        controls.maxPolarAngle = golden?.maxPolar ?? (diving ? 1.62 : looked?.place.canopy ? 2.7 : 1.36);
    };

    // MARK: Layers: underwater and the cutaway

    let underwater = false;
    let cutawayOpen = false;
    /** The page's or the director's choice: open, closed, or (null) open when an underground animal is looked at. */
    let cutawayWanted: boolean | null = null;
    let cutawayAt: {target: Vector3; azimuth: number} | null = null;
    // Under water the view is absorbed exponentially (graphics pass): blue-green, half gone by about 12 m.
    const underFog = new FogExp2(new Color("#2b6f78"), 0.058);
    // 3.3 batch (E): the water's colour and haze by the camera's depth, and the marine snow (built on the first dive).
    const underLook: UnderwaterLook = {r: 0, g: 0, b: 0, density: 0.058};
    let seaLook: SeaLookView | null = null;
    let seaLookNow = 0;
    /** p2 (ocean): the open sea's boats, once the town is in (`attachIsland`). */
    let oceanTraffic: OceanTrafficView | null = null;
    /** p2 (ocean): the open-ocean animals' shapes on the water, made with the first of them. */
    let oceanShadows: OceanShadows | null = null;
    const stepLayers = (elapsed: number) => {
        const under = camera.position.y < -0.02 && heightAt(camera.position.x, camera.position.z) < -0.3;
        if (under !== underwater) {
            underwater = under;
            lighting.setUnderwater(under);
            scene.fog = under ? underFog : fog;
            // (SIG-DEFENCE: the behaviours harness can leave the grass out, to see a spider's move at its feet.)
            if (vegetation) vegetation.grass.visible = !under && TIER_SETTINGS[tier].grass > 0 && !(globalThis as {__arkNoGrass?: boolean}).__arkNoGrass;
            if (micro) micro.group.visible = !under;
            // 3.3 batch (E): nor the land's trees (they stand above the sea: seen from under it they are not seen, but the
            // ambient-occlusion pass still read their depth through the surface and drew dark shards on its underside).
            if (assetTrees) assetTrees.group.visible = !under;
            // p2 (ocean): nor the town's trees, seen across the open ocean from under it (the same dark shards on the surface's underside).
            const townTrees = island?.root.getObjectByName("town:trees");
            if (townTrees) townTrees.visible = !under;
            ARK_CAUSTICS.value = under ? 0.9 : 0.3;
        }
        if (under) {
            // 3.3 batch (E): bright and clear in the shallows, a dim thick blue far down (sea-look.ts), not one colour everywhere.
            underwaterLook(-camera.position.y, lighting.daylight.daylight, underLook, openWaterClarity(-heightAt(camera.position.x, camera.position.z))); // p2 (ocean): blue water clearer
            underFog.color.setRGB(underLook.r, underLook.g, underLook.b, "srgb");
            underFog.density = underLook.density;
            scene.background = underFog.color;
        } else if (scene.background) {
            scene.background = null;
        }
        layersScene.setUnderwater(under, camera.position, lighting.daylight.daylight);
        // 3.3 batch (E): marine snow all round the camera under the sea; nothing is built until the first dive.
        if (under && !seaLook) seaLook = new SeaLookView(scene);
        seaLookNow = elapsed;
        seaLook?.step(under, camera, lighting.daylight.daylight, underFog.density, seaClockSeconds(seaEpochSeconds()), elapsed, tier, renderer.domElement.height, reducedMotion);
        // The cutaway: in front of what the camera looks at, rebuilt only when that moves on or the camera turns.
        const selected = selectedId ? findEntry(selectedId) : null;
        const want = cutawayWanted ?? Boolean(selected?.place.burrow && camera.position.distanceTo(controls.target) < 30);
        if (!want) {
            if (cutawayOpen) cutawayOpen = layersScene.setCutaway(null);
            cutawayAt = null;
        } else {
            const middleOfTunnel = selected?.place.burrow ? tunnelPoint(selected.place.burrow, 0.5) : null;
            const target = middleOfTunnel && selected?.place.burrow ? new Vector3(middleOfTunnel.x, selected.place.burrow.ground, middleOfTunnel.z) : controls.target.clone();
            const azimuth = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
            const turned = cutawayAt ? Math.abs(Math.atan2(Math.sin(azimuth - cutawayAt.azimuth), Math.cos(azimuth - cutawayAt.azimuth))) : Infinity;
            if (!cutawayAt || cutawayAt.target.distanceTo(target) > 1 || turned > 0.35) {
                cutawayAt = {target, azimuth};
                cutawayOpen = layersScene.setCutaway({target, towardCamera: new Vector3(Math.sin(azimuth), 0, Math.cos(azimuth))});
            }
        }
        // The light shafts drift on the sea's shared clock (epoch seconds), not on the time since this page opened.
        layersScene.step(seaEpochSeconds());
    };

    /**
     * Close to a small animal the camera may come right up to it: the
     * nearest distance and the near plane follow what is in front of it.
     */
    const fitCloseUp = () => {
        const target = controls.target;
        const selected = selectedId ? findEntry(selectedId) : null;
        // Looking at a small animal (flying to it, too: at its microhabitat, or a crab on the seabed), or with one close in front.
        let close = Boolean(selected?.micro) || Boolean(selected && selected.trueLength < 0.3);
        /** V2 replay: an animal of the cast under about 5 cm that the view is on (an aphid, a water flea): the camera comes as near as its size asks. */
        let castTiny: Entry | null = null;
        // (V1: with a cast, looked for whatever is chosen: a watched line's own animal is chosen too, and it is its stand-in
        // that is drawn, a dead water flea's body. Without this the near plane stayed a centimetre out, at the body itself.)
        if (!close || cast) {
            // (V2 replay: and a small animal of the cast, wherever it is drawn now, its body after its death too.)
            for (const entry of cast ? allEntries() : entries) {
                // (V1: a micro animal of the cast too, a water flea's body: the near plane then stops short of it, below.)
                const pinned = Boolean(cast?.pins.has(entry.animal.id)) && entry.trueLength < 0.3 && (!entry.micro || Boolean(entry.act)) ? entry.middle : null;
                if (!entry.micro && !pinned) continue;
                const dx = (pinned?.x ?? entry.place.x) - target.x;
                const dz = (pinned?.z ?? entry.place.z) - target.z;
                if (dx * dx + dz * dz < MICRO_CLOSE_WITHIN * MICRO_CLOSE_WITHIN && Math.abs((pinned?.y ?? entry.place.ground) - target.y) < MICRO_CLOSE_WITHIN) {
                    close = true;
                    if (pinned && entry.trueLength < 0.05 && dx * dx + dz * dz < 0.25 && (!castTiny || entry.trueLength < castTiny.trueLength)) castTiny = entry;
                    if (!cast) break;
                }
            }
        }
        // A scenery module's close-up (a nest, a web, the cave): the camera may come nearer than usual.
        let moduleWant = 4;
        if (!close) for (const sceneModule of modules) moduleWant = Math.min(moduleWant, sceneModule.closeUp?.(target.x, target.y, target.z) ?? 4);
        if (!close && spiderWebs) moduleWant = Math.min(moduleWant, spiderWebs.closeUp(target.x, target.y, target.z)); // ARK-WEBS
        const want = Math.min(shotClosest ?? Infinity, castTiny ? Math.min(MICRO_MIN_DISTANCE, Math.max(castTiny.trueLength * 4, 0.008)) : close ? MICRO_MIN_DISTANCE : moduleWant);
        // Down at once; back up gently (the camera eases out rather than jumping).
        controls.minDistance = want < controls.minDistance ? want : controls.minDistance + (want - controls.minDistance) * 0.05;
        let distance = camera.position.distanceTo(target);
        let near = Math.min(Math.max(distance * 0.08, 0.01), 0.4);
        // From far, the near plane goes out with the view (a fiftieth of its distance past 20 m, 12 m at most). Held at
        // 0.4 m, the depth buffer's step was 3 cm at the town from its own whole view and 7 to 12 cm from the wild
        // island's: its window panes stand 3.5 cm off their walls, so they and the walls flickered through each other
        // as the view drifted (the lit windows blinking on and off at night), and touching walls did the same.
        if (distance > 20) near = Math.min(distance * 0.02, 12);
        // Close up to an animal under about 5 cm (an ant, a gecko's hatchling, a spider): the scenery around it is huge at
        // its scale. The camera keeps above the ground it is on, and the near plane comes out to just short of the animal,
        // so a grass blade or a leaf the camera is in is cut away instead of filling the view.
        const tiny = selected && selected.trueLength < 0.05 && selected.middle ? selected : castTiny;
        if (tiny && distance < Math.max(tiny.trueLength * 40, 0.6) && !flight) {
            // (V1: under a shot's cast the bed as it is drawn, as the view's own floor above: a lake's analytic bed
            // stands centimetres over the drawn one, and the camera, lifted onto it after it had been aimed, looked
            // over a water flea's body from a centimetre away: the body was under the picture's lower edge.)
            const floor = shotClosest !== null ? Math.min(heightAt(camera.position.x, camera.position.z), standGround(camera.position.x, camera.position.z)) : heightAt(camera.position.x, camera.position.z);
            // (V2 replay: one of a shot's cast is filmed from as near as its size asks, millimetres over its leaf.)
            const clear = floor + Math.max(distance * 0.3, tiny === castTiny ? 0.002 : 0.02);
            // (On land; under water the floor is the seabed, and the camera keeps above it the same way.)
            if (camera.position.y < clear && tiny.middle!.y < floor + 0.5) {
                camera.position.y = clear;
                distance = camera.position.distanceTo(target);
            }
            near = Math.min(Math.max(distance * 0.4, 0.002), Math.max(distance - tiny.trueLength * 1.5, 0.002));
        }
        // (V2 replay: a shot's cut, `setNearCut`: what stands in the first part of the way to its subject is not drawn.)
        if (nearCut !== null) near = Math.max(near, Math.min(nearCut, distance * 0.98));
        if (Math.abs(near - camera.near) > camera.near * (nearCut !== null ? 0.005 : 0.08)) {
            camera.near = near;
            camera.updateProjectionMatrix();
        }
    };

    // MARK: Picking

    const projected = new Vector3();
    const humanPoint = new Vector3();
    /** p5 (humans): the drawn person nearest a tap (within 28 px of their middle), as an animal for the card. */
    const pickHuman = (clientX: number, clientY: number): ArkAnimal | null => {
        const rect = canvas.getBoundingClientRect();
        let best: string | null = null;
        let bestD = 28;
        for (const h of townHumans.out) {
            humanPoint.set(h.x, h.y + 1, h.z).project(camera);
            if (humanPoint.z > 1) continue;
            const d = Math.hypot((humanPoint.x + 1) / 2 * width - (clientX - rect.left), (1 - humanPoint.y) / 2 * height - (clientY - rect.top));
            if (d < bestD) {
                bestD = d;
                best = h.id;
            }
        }
        const animal = best ? humansAboard.find((a) => a.id === best) : undefined;
        // (`model_slug: "human"`: the card never fetches a human's photo, `ark-view.tsx`.)
        return animal ? {...animal, model_slug: "human"} : null;
    };
    const pick = (clientX: number, clientY: number): Entry | null => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: Entry | null = null;
        let bestScore = Infinity;
        for (const entry of allEntries()) {
            if (!entry.middle || entry.ghost) continue;
            projected.copy(entry.middle).project(camera);
            if (projected.z > 1) continue;
            const sx = (projected.x + 1) / 2 * width;
            const sy = (1 - projected.y) / 2 * height;
            const distance = camera.position.distanceTo(entry.middle);
            let radius: number;
            if (entry.level === "token") {
                const pixels = tokens.pixelSize(iconSize(entry.length), distance);
                // (At true scale an icon may be a few pixels across: it is still picked within 20 px, like the rest.)
                radius = Math.max(pixels / 2 + 4, 20);
                const d = Math.hypot(x - sx, y - (sy - pixels / 4));
                if (d < radius && d / radius < bestScore) {
                    best = entry;
                    bestScore = d / radius;
                }
                continue;
            }
            const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * distance / height;
            radius = Math.max(Math.max(entry.length, entry.drawnHeight) / perPixel / 2, 20);
            const d = Math.hypot(x - sx, y - sy);
            if (d < radius && d / radius < bestScore) {
                best = entry;
                bestScore = d / radius;
            }
        }
        // 3.3 fix: the winner's score, for the drawn resting figures to be weighed against it (`tap-pick.ts`).
        lastPickScore = bestScore;
        return best;
    };
    // 3.3 fix: the town's resting kept animals are tapped too (`tap-pick.ts`): the figure a tap lands on, and its score.
    let lastPickScore = Infinity;
    const tapProjected = {sx: 0, sy: 0, distance: 0};
    const tapProject: Projector = (px, py, pz) => {
        projected.set(px, py, pz);
        tapProjected.distance = camera.position.distanceTo(projected);
        projected.project(camera);
        if (projected.z > 1) return null;
        tapProjected.sx = (projected.x + 1) / 2 * width;
        tapProjected.sy = (1 - projected.y) / 2 * height;
        return tapProjected;
    };
    const pickRestingFigure = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        return pickFigure(clientX - rect.left, clientY - rect.top, restingGroups, tapProject, 2 * Math.tan(FOV * Math.PI / 360) / height);
    };

    /** A tap on a herd's members (not on one of its representatives): the herd, for its species card. */
    const pickHerd = (clientX: number, clientY: number): HerdDraw | null => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: HerdDraw | null = null;
        let bestScore = Infinity;
        for (const herd of herds) {
            const perPixelAt = 2 * Math.tan(FOV * Math.PI / 360) / height;
            for (let i = 0; i < herd.members.length; i++) {
                const mx = herd.middles[i * 3];
                if (Number.isNaN(mx)) continue;
                projected.set(mx, herd.middles[i * 3 + 1], herd.middles[i * 3 + 2]);
                const distance = camera.position.distanceTo(projected);
                projected.project(camera);
                if (projected.z > 1) continue;
                const sx = (projected.x + 1) / 2 * width;
                const sy = (1 - projected.y) / 2 * height;
                const radius = Math.max(Math.max(herd.length, herd.height) / (perPixelAt * distance) / 2, 12);
                const d = Math.hypot(x - sx, y - sy);
                if (d < radius && d / radius < bestScore) {
                    best = herd;
                    bestScore = d / radius;
                }
            }
        }
        return best;
    };

    const herdInfo = (herd: HerdDraw): ArkHerdInfo => ({key: herd.info.key, slug: herd.slug, name: herd.info.name, count: herd.info.count, mine: herd.info.mine});

    /** A herd selected: its species card in the page, the camera over the whole herd (A14). */
    const selectHerd = (key: string | null, flyTo: boolean): boolean => {
        const herd = key ? herds.find((h) => h.info.key === key) ?? null : null;
        if (key && !herd) return false;
        selectedHerd = herd ? herd.info.key : null;
        for (const h of herds) h.badge.dataset.selected = h === herd ? "1" : "";
        if (herd) {
            if (selectedId) select(null, false);
            options.onHerd?.(herdInfo(herd));
            if (flyTo) {
                opening = false;
                controls.autoRotate = false;
                lastTouch = performance.now() / 1000;
                // Every one of them in view (with the representatives, who stand among them).
                const live = entries.filter((entry) => herdKeyOf(entry.animal) === herd.info.key);
                let reach = herd.radius;
                for (const entry of live) reach = Math.max(reach, Math.hypot(entry.place.x - herd.centre.x, entry.place.z - herd.centre.z));
                const target = new Vector3(herd.centre.x, Math.max(heightAt(herd.centre.x, herd.centre.z), 0), herd.centre.z);
                fly(target, Math.min(Math.max(reach * 2.4 + 12, 24), 160), 1.4, 0.95);
            }
        } else {
            options.onHerd?.(null);
        }
        return true;
    };
    const herdKeyOf = (animal: ArkAnimal) => animal.species_profile_id || `slug:${animal.model_slug}`;

    /** A bearing away from the south from which the ground doesn't hide `target` (the first clear one; else the side). */
    const clearAzimuth = (target: Vector3, distance: number, polar: number, phase: number): number => {
        const side = phase < 0.5 ? 1 : -1;
        const bearings = [side * Math.PI / 2, -side * Math.PI / 2, side * Math.PI * 0.75, -side * Math.PI * 0.75, Math.PI];
        const look = new Spherical();
        const point = new Vector3();
        for (const azimuth of bearings) {
            look.set(distance, polar, azimuth);
            const away = new Vector3().setFromSpherical(look);
            let clear = true;
            for (let t = 0.08; t <= 1 && clear; t += 0.08) {
                point.copy(target).addScaledVector(away, t);
                clear = heightAt(point.x, point.z) < point.y - 0.25;
            }
            if (clear) return azimuth;
        }
        return bearings[0];
    };

    // MARK: Leaves in the way

    /** The plants that can stand between the camera and an animal up a tree (never the grass). */
    const TREE_KINDS = new Set(["canopy", "rainforest", "broadleaf", "conifer", "acacia", "palm", "orchard", "shrub", "cactus"]);
    const occluders = (vegetation?.meshes ?? []).filter((mesh) => TREE_KINDS.has(mesh.userData.kind as string));
    const rays = new Raycaster();
    const rayFrom = new Vector3();
    const rayTo = new Vector3();
    /** What is hit between a camera position and a target, short of the animal itself (its own perch within `slack` m). */
    const back = new Vector3();
    const blockers = (from: Vector3, to: Vector3, slack: number): Array<{mesh: InstancedMesh; distance: number; instance: number}> => {
        const span = from.distanceTo(to);
        rays.set(from, rayTo.copy(to).sub(from).normalize());
        rays.near = 0;
        rays.far = Math.max(span - slack, 0.01);
        const hits = rays.intersectObjects(occluders, false).map((hit) => ({mesh: hit.object as InstancedMesh, distance: hit.distance, instance: hit.instanceId ?? -1}));
        // And back from the animal to the camera: leaves are single-sided, so a camera inside a pad of leaves only
        // sees it from the inside (no hit one way, a hit the other).
        rays.set(back.copy(to), rayTo.copy(from).sub(to).normalize());
        rays.near = slack;
        rays.far = span;
        for (const hit of rays.intersectObjects(occluders, false)) hits.push({mesh: hit.object as InstancedMesh, distance: span - hit.distance, instance: hit.instanceId ?? -1});
        rays.near = 0;
        return hits;
    };
    const cameraAt = (target: Vector3, distance: number, polar: number, azimuth: number) => rayFrom.copy(target).add(offset.setFromSpherical(spherical.set(distance, polar, azimuth)));
    /**
     * A view of an animal up a tree with nothing in the way: its mode's own
     * angle first, then turned either side, from higher and lower, a little
     * nearer. Else the mode's own (the leaves in the way fade while it is
     * looked at: `foldTrees`).
     */
    const clearCanopyView = (target: Vector3, distance: number, polar: number, azimuth: number, length: number) => {
        const slack = Math.max(length * 0.6, 0.35);
        for (const near of [1, 0.75, 0.55]) {
            for (const turn of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2 + 0.4, -Math.PI / 2 - 0.4, Math.PI]) {
                for (const tilt of [polar, 2.45, 1.55, 1.0]) {
                    const from = cameraAt(target, distance * near, tilt, azimuth + turn);
                    if (from.y < Math.max(heightAt(from.x, from.z), 0) + 0.3) continue;
                    if (!blockers(from, target, slack).length) return {distance: distance * near, polar: tilt, azimuth: azimuth + turn};
                }
            }
        }
        return {distance, polar, azimuth};
    };
    /**
     * The trees still between the camera and the animal looked at up a tree
     * (no clear view was found, or the camera was moved): those trees are
     * folded away (their instance shrunk to nothing) while it is looked at,
     * and stand again after. Checked a few times a second; never the
     * animal's own perch (within its slack).
     */
    let foldCheck = 0;
    const folded = new Map<InstancedMesh, Map<number, Matrix4>>();
    const unfold = (keep: Set<string>) => {
        folded.forEach((instances, mesh) => {
            instances.forEach((original, index) => {
                if (keep.has(`${mesh.id}#${index}`)) return;
                mesh.setMatrixAt(index, original);
                mesh.instanceMatrix.needsUpdate = true;
                instances.delete(index);
            });
            if (!instances.size) folded.delete(mesh);
        });
    };
    // Part B: a chunked plant mesh rewritten (the render distance moved) puts its folded trees back first; they fold
    // again at the next check if still in the way.
    for (const chunked of vegetation?.chunked ?? []) {
        chunked.beforeWrite = () => {
            unfold(new Set());
            foldCheck = 0;
        };
    }
    const foldTrees = (now: number) => {
        if (now - foldCheck < 0.25) return;
        foldCheck = now;
        const looked = selectedId ? findEntry(selectedId) : null;
        const keep = new Set<string>();
        // (Powers you can see: one looked at while its Power's act shows, on the ground too: its duck into cover, its
        // scramble up, a hunter's pass over it are not hidden behind a bush.)
        const acting = !looked?.place.canopy && (looked?.power?.react ?? 0) > 0.02;
        if ((looked?.place.canopy || acting) && looked?.middle && !flight) {
            // Shrunk ones are not hit again: keep what is folded while it is still in the way (tested at full size).
            const hits = blockers(rayFrom.copy(camera.position), looked.middle, Math.max(looked.length * 0.6, 0.35));
            for (const hit of hits) {
                // (Never a canopy tree: the animal may be on it. Those the view search keeps out of the way.)
                if (hit.instance < 0 || (hit.mesh.userData.kind === "canopy" && !acting)) continue;
                keep.add(`${hit.mesh.id}#${hit.instance}`);
                let instances = folded.get(hit.mesh);
                if (!instances) folded.set(hit.mesh, (instances = new Map()));
                if (instances.has(hit.instance)) continue;
                const original = new Matrix4();
                hit.mesh.getMatrixAt(hit.instance, original);
                instances.set(hit.instance, original);
                hit.mesh.setMatrixAt(hit.instance, new Matrix4().makeScale(0, 0, 0).setPosition(new Vector3().setFromMatrixPosition(original)));
                hit.mesh.instanceMatrix.needsUpdate = true;
            }
            folded.forEach((instances, mesh) => instances.forEach((_, index) => keep.add(`${mesh.id}#${index}`)));
        }
        unfold(keep);
    };

    /** Where an animal's middle is now, drawn or not (off screen, or a layer not drawn from here). */
    const middleNow = (entry: Entry): Vector3 => {
        if (entry.middle) return entry.middle.clone();
        const model = library.get(entry.animal.model_slug);
        const height = model ? model.height * (entry.length / model.bodyLength) : entry.length * 0.6;
        const where = pose(entry, model, height, elapsedNow());
        return new Vector3(where.x, where.base + height / 2, where.z);
    };

    // MARK: A clear close-up (graphics pass 2026-11-14: `runtime/sight.ts`, `runtime/camera.ts` closeUpViews)

    /**
     * The chosen animal in clear view. A close-up's view was chosen by the animal's size and kind alone, so it often
     * ended behind a house's wall, outside the shell of the house the animal is kept in, behind a rock or a trunk, or
     * inside a building. Every flight to the chosen animal (whoever started it: a tap, the list, a focus link, the
     * apps' face-to-face close-up) has its view tried against what is drawn; when its lines to the animal are blocked,
     * the other views round it are tried a few a frame (never more than about 3 ms of a frame) and the flight ends at
     * the first clear one instead. Afterwards, while the animal stays chosen and nobody touches the view, the lines are
     * looked at again about once a second: an animal that has walked behind something is flown round to. The same
     * step keeps the whole animal in the picture (the flight's distance is at least what its height and length need
     * in this view's shape) and brings the view back to an animal that has jumped out of it after landing.
     * Not for an animal under the ground (the cutaway shows it), under the sea (the dive's own view), up a tree (its
     * own search, `clearCanopyView`) or on its microhabitat (its own view out along its surface, centimetres away).
     * Nothing here moves an animal or the scenery.
     */
    const sight = new Sight(scene);
    /** V2 replay: the cast's own lines (`sightOf`), made at a shot's first asking. */
    let castSight: Sight | null = null;
    let castLeaves: Sight | null = null;
    let castSightLast = "";
    let clearSearch: {views: CloseView[]; next: number; best: CloseView | null; bestBlocked: number; asked: CloseView | null} | null = null;
    let clearedFlight: Flight | null = null;
    let clearCheckAt = 0;
    let clearMisses = 0;
    let clearFlying = false;
    let clearLandedAt = 0;
    let clearFor: string | null = null;
    let clearRecentres = 0;
    let clearDriftSince = 0;
    /** What the search cost (the probes read it in a development build): searches begun, views tried, ms in all and in the worst frame. */
    const clearStats = {searches: 0, views: 0, ms: 0, worstMs: 0, moved: 0};
    const sightEye = new Vector3();
    const sightPoint = new Vector3();
    const sightFrom = new Vector3();
    const sightLook = new Spherical();
    /**
     * How many of the four lines from a view's eye to the animal are blocked (5: the eye is no place to stand); counted
     * only up to `enough`. Each line: the ground and the camera's boxes first (cheap), then the drawn meshes.
     */
    const blockedFrom = (entry: Entry, at: Vector3, view: CloseView, enough: number): number => {
        sightEye.setFromSphericalCoords(view.distance, view.polar, view.azimuth).add(at);
        if (heightAt(sightEye.x, sightEye.z) > sightEye.y - 0.2) return 5;
        if (runtime.eyeBlocked(sightEye, at)) return 5;
        const yaw = entry.yawNow ?? entry.place.yaw;
        const along = entry.length * 0.3;
        const slack = Math.max(entry.length, entry.drawnHeight) * 0.6 + 0.08;
        let blocked = 0;
        for (let line = 0; line < 4 && blocked < enough; line++) {
            if (line === 0) sightPoint.copy(at);
            else if (line === 3) sightPoint.set(at.x, at.y + entry.drawnHeight * 0.3, at.z);
            else sightPoint.set(at.x + Math.sin(yaw) * along * (line === 1 ? 1 : -1), at.y, at.z + Math.cos(yaw) * along * (line === 1 ? 1 : -1));
            if (runtime.sightBlocked(sightEye, sightPoint, slack) || sight.blocked(sightEye, sightPoint, slack)) blocked++;
        }
        return blocked;
    };
    const stepClearView = (now: number) => {
        if (options.recording) return;
        const entry = selectedId ? findEntry(selectedId) : null;
        const at = entry?.middle ?? null;
        // (3.3 fix, mating tap: a pair framed together is kept by the pair's own tracking, not brought back to the one.)
        if (!entry || !at || entry.place.burrow || entry.place.canopy || entry.place.micro || (at.y - entry.drawnHeight / 2 < -0.3 && heightAt(at.x, at.z) < -0.3) || pairAim(entry.animal.id)) {
            clearSearch = null;
            return;
        }
        // The least distance its whole body is in the picture from: its height in the view's height, its length (seen
        // three-quarters on) in the view's width. A giraffe's close-up on an upright phone showed its legs and belly.
        const tangent = 2 * Math.tan((FOV * Math.PI) / 360);
        // (Its height as the view's middle sees it: the view looks at a point between its feet and its middle, so what
        // must fit is twice the longer way from there, up to its head or down to its feet.)
        const lookY = flight ? flight.to.y : controls.target.y;
        const tall = 2 * Math.max(at.y + entry.drawnHeight / 2 - lookY, lookY - (at.y - entry.drawnHeight / 2), entry.drawnHeight / 2);
        const whole = Math.max(tall / (0.66 * tangent), (entry.length * 0.8) / (0.85 * tangent * Math.max(width / Math.max(height, 1), 0.3)));
        const nearest = Math.max(controls.minDistance, entry.length * 1.6 + 0.4, whole);
        // Landed: the flight to it has ended (what moves the view after that is the animal, until someone touches it).
        if (flight && flight === clearedFlight) clearFlying = true;
        else if (!flight && clearFlying) {
            clearFlying = false;
            clearLandedAt = now;
        }
        if (clearFor !== entry.animal.id) {
            clearFor = entry.animal.id;
            clearRecentres = 0;
            clearDriftSince = 0;
        }
        if (flight && flight !== clearedFlight) {
            // A flight to it that has not been looked at yet: its own view first.
            if (flight.to.distanceTo(at) < entry.length + 1.5) {
                if (flight.toDistance < whole) flight.toDistance = Math.min(whole, maxDistance);
                clearedFlight = flight;
                // (A new close-up: what was gathered for the last one may have been streamed in or out since.)
                sight.reset();
                const asked = {distance: flight.toDistance, polar: flight.toPolar, azimuth: flight.toAzimuth};
                clearSearch = {views: closeUpViews(asked, nearest), next: 0, best: null, bestBlocked: 6, asked};
                clearMisses = 0;
            }
        } else if (!flight && !clearSearch && pointers === 0 && now - lastTouch > 2 && now - clearCheckAt > 0.9 && controls.target.distanceTo(at) < entry.length + 1.5) {
            // Still chosen, the view left alone: has it gone behind something? (Twice running before the view moves.)
            clearCheckAt = now;
            sightLook.setFromVector3(sightEye.copy(camera.position).sub(controls.target));
            sight.near(at, sightLook.radius + entry.length);
            const current = {distance: sightLook.radius, polar: sightLook.phi, azimuth: sightLook.theta};
            const blocked = blockedFrom(entry, at, current, 3);
            clearMisses = blocked >= 3 ? clearMisses + 1 : 0;
            if (clearMisses >= 2) {
                clearMisses = 0;
                clearSearch = {views: closeUpViews(current, nearest).slice(1), next: 0, best: null, bestBlocked: blocked, asked: null};
            }
        }
        // Kept in the picture after landing: the tracking follows its steps, but not a jump (its schedule taking hold, a
        // model's swap, a take-off faster than a frame allows). When it has been off the view's middle for half a
        // second with nobody touching the view since it landed (or while it is followed), the view comes back to it,
        // as it stands; that flight is then looked at like any other. A few times a selection at most.
        if (!flight && !clearSearch && pointers === 0 && clearLandedAt > 0 && (lastTouch <= clearLandedAt + 0.05 || followId === entry.animal.id) && clearRecentres < 8) {
            const viewDistance = camera.position.distanceTo(controls.target);
            // (Sideways from the view's middle, or out of its height: the view rests at an animal's feet, not its middle.)
            const aside = Math.hypot(controls.target.x - at.x, controls.target.z - at.z);
            const above = Math.abs(controls.target.y - at.y) - entry.drawnHeight / 2;
            if (aside > Math.max(entry.length * 0.6, viewDistance * 0.14) || above > viewDistance * 0.14) {
                if (!clearDriftSince) clearDriftSince = now;
                else if (now - clearDriftSince > 0.5) {
                    clearDriftSince = 0;
                    clearRecentres++;
                    sightLook.setFromVector3(sightEye.copy(camera.position).sub(controls.target));
                    const id = entry.animal.id;
                    fly(at.clone(), Math.max(sightLook.radius, whole), 0.7, sightLook.phi, sightLook.theta);
                    const back = flight as Flight | null;
                    if (back) back.aim = () => (selectedId === id ? findEntry(id)?.middle ?? null : null);
                }
            } else clearDriftSince = 0;
        }
        const search = clearSearch;
        if (!search) return;
        const started = performance.now();
        // (The big meshes' triangles round the animal, gathered once for the whole search: `runtime/sight.ts`.)
        if (search.next === 0) sight.near(at, search.views[0].distance + entry.length);
        let found = false;
        while (search.next < search.views.length && performance.now() - started < 3) {
            const view = search.views[search.next++];
            // (The asked view is counted whole, to know how bad it is; another is given up at its first blocked line.)
            const blocked = blockedFrom(entry, at, view, view === search.asked ? 4 : Math.min(search.bestBlocked, 4));
            if (blocked < search.bestBlocked) {
                search.bestBlocked = blocked;
                search.best = view;
            }
            // (The asked view may keep one line of four blocked: a post, a leaf. Another view must be wholly clear.)
            if (blocked === 0 || (view === search.asked && blocked <= 1)) {
                found = true;
                break;
            }
        }
        const spent = performance.now() - started;
        clearStats.ms += spent;
        clearStats.worstMs = Math.max(clearStats.worstMs, spent);
        if (!found && search.next < search.views.length) return;
        clearSearch = null;
        clearStats.searches++;
        clearStats.views += search.next;
        const best = search.best;
        if (!best || best === search.asked) return;
        clearStats.moved++;
        const distance = Math.min(Math.max(best.distance, controls.minDistance), maxDistance);
        if (flight && flight === clearedFlight) {
            // Still on its way: it ends at the clear view instead (the short way round from where it started).
            let azimuth = best.azimuth;
            while (azimuth - flight.fromAzimuth > Math.PI) azimuth -= Math.PI * 2;
            while (azimuth - flight.fromAzimuth < -Math.PI) azimuth += Math.PI * 2;
            flight.toDistance = distance;
            flight.toPolar = best.polar;
            flight.toAzimuth = azimuth;
            return;
        }
        if (flight) return;
        const id = entry.animal.id;
        fly(at.clone(), distance, 0.9, best.polar, best.azimuth);
        const next = flight as Flight | null;
        if (next) {
            next.aim = () => (selectedId === id ? findEntry(id)?.middle ?? null : null);
            clearedFlight = next;
        }
    };

    /** A held arrival's flight is beginning (`arrive`): the selection is not told again. */
    let arrivalResumed = false;
    // 3.3 fix (mating tap): the log's mating line frames the pair (owner 2026-11-16: "when i click a mating log, i don't
    // see 2 of its kind next to each other"). While their mating is acted (`liveMatings.partnerOf`), the view's middle is
    // between the two and far enough back for both (`pair-frame.ts`); once it is over, the first of them alone, as any
    // line's tap. A touch on the view ends it.
    // 3.3 fix (breeding taps): `kin`, a newborn and its mother, framed together while they are near, mating or not.
    let pairFramed: {a: string; b: string; kin?: boolean} | null = null;
    const pairPoint = new Vector3();
    const pairAim = (id: string) => {
        if (!pairFramed || pairFramed.a !== id || selectedId !== id || (!pairFramed.kin && liveMatings.partnerOf(id) !== pairFramed.b)) return null;
        const a = findEntry(id);
        const b = findEntry(pairFramed.b);
        if (!a?.middle || !b?.middle) return null;
        const aspect = width / Math.max(height, 1);
        const pair = framePair({x: a.middle.x, y: a.middle.y, z: a.middle.z, length: a.length}, {x: b.middle.x, y: b.middle.y, z: b.middle.z, length: b.length}, {fovDeg: FOV, aspect, single: meetDistance(Math.max(a.length, b.length), aspect, FOV), max: 60});
        if (pair && pairFramed.kin && pair.apart > kinFrameApart(Math.max(a.length, b.length))) return null;
        // (Two small ones too far apart to be made out together: the first alone, close.)
        if (pair && !seenAt(Math.max(a.length, b.length), pair.distance, FOV)) return null;
        return pair ? {at: pairPoint.set(pair.x, pair.y, pair.z), distance: pair.distance} : null;
    };
    // 3.3 fix (breeding taps): a laid line's tap draws the record's clutch beside the mother (as a replay's `laid` does)
    // once she is drawn, for a while; one at a time. Only on a tap: no draw call otherwise.
    // Framed once laid (and the tap's flight over): the mother and her eggs close, from above the blades, which part
    // round the clutch (`clutchPress`, read by the grass and the bug-scale blades) while it is shown.
    let liveClutch: {key: string; parents: string[]; eggs: number | null; mother: string | null; until: number; spot: {x: number; y: number; z: number; radius: number} | null; framed: boolean} | null = null;
    const clutchFrameAt = new Vector3();
    const stepLiveClutch = (now: number) => {
        const clutch = liveClutch;
        if (!clutch) return;
        if (now > clutch.until) {
            // (ARK-MATING-SHOWN: a clutch the live layer keeps stays until it hatches.)
            if (!liveClutches.keeps(clutch.key)) nests.remove(clutch.key);
            liveClutch = null;
            return;
        }
        if (clutch.mother) {
            const mother = findEntry(clutch.mother);
            if (clutch.framed || !clutch.spot || flight || !mother?.middle) return;
            clutch.framed = true;
            // (Only while the view is still on the pair the tap chose: a viewer who moved on is left alone.)
            if (!selectedId || !clutch.parents.includes(selectedId) || pointers > 0) return;
            const frame = clutchFrame(mother.middle, clutch.spot, mother.length, FOV);
            pairFramed = null;
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
            fly(clutchFrameAt.set(frame.x, frame.y, frame.z), frame.distance, 1.2, CLUTCH_FRAME_POLAR, spherical.theta);
            return;
        }
        const drawn = clutch.parents.map((id) => findEntry(id)).filter((e): e is Entry => Boolean(e?.middle));
        if (!drawn.length) return;
        const mother = drawn.find((e) => sexLook(e.animal.id, e.animal.model_slug).sex === "female") ?? drawn[0];
        const middle = mother.middle!;
        const plan = library.get(mother.animal.model_slug)?.behaviour?.plan;
        const kind = nestKind({plan, slug: mother.animal.model_slug, water: inWater(mother)});
        const side = hash32(clutch.key) % 2 ? 1 : -1;
        const yaw = mother.yawNow ?? 0;
        // (Their mating acted now: where she stood for it. A small animal on its wall, trunk or flower: the eggs where it
        // is. Else a body length to her side.)
        const mated = liveMatings.clutchSpotOf(mother.animal.id);
        const spot = mated
            ? {x: mated.x, y: 0, z: mated.z}
            : mother.place.micro
              ? {x: middle.x, y: middle.y - mother.drawnHeight * 0.5, z: middle.z}
              : {x: middle.x + Math.cos(yaw) * side * mother.length * 0.9, y: 0, z: middle.z - Math.sin(yaw) * side * mother.length * 0.9};
        if (mother.place.micro) spot.y = middle.y - mother.drawnHeight * 0.5;
        else spot.y = Math.max(heightAt(spot.x, spot.z), 0) + (kind === "spawn" ? -0.05 : 0);
        // (ARK-MATING-SHOWN: the clutch the live layer laid already is where it is.)
        const laid = nests.where(clutch.key);
        if (laid) Object.assign(spot, {x: laid.x, y: laid.y, z: laid.z});
        nests.lay(clutch.key, spot, clutchSize(mother.length), kind, clutch.eggs, now);
        clutch.mother = mother.animal.id;
        clutch.spot = {...spot, radius: Math.max(mother.length * 1.1, clutchSize(mother.length) * 1.5, 0.06)};
    };
    controls.addEventListener("start", () => {
        pairFramed = null;
    });
    /**
     * A human chosen from the page (the species list's "Human" row, search, `?focus=`): humans are never entries, so
     * `select` found nothing and the card closed again (the live bug of 2026-11-18). Now its card ("Human" and the
     * capturer, as a tapped person's) and, asked to fly, the camera on that person where they are drawn now, else over
     * the town where the people live (indoors or at work they are not drawn: the card still opens).
     */
    const selectHuman = (chosen: ChosenHuman<ArkAnimal>, flyTo: boolean, wait = true) => {
        select(null, false);
        heldHuman = chosen.at?.face !== undefined ? chosen.human.id : null; // humans visible: looked at up in their flat
        options.onSelect?.({...chosen.human, model_slug: "human"});
        if (!flyTo) return;
        opening = false;
        controls.autoRotate = false;
        lastTouch = performance.now() / 1000;
        endFollow();
        if (chosen.at) {
            // (Humans visible: someone at home or asleep is seen from outside their flat's open front, near level with it.)
            if (chosen.at.face !== undefined) fly(new Vector3(chosen.at.x, chosen.at.y, chosen.at.z), 8, reducedMotion ? 0 : 1.6, 1.42, chosen.at.face);
            else fly(new Vector3(chosen.at.x, chosen.at.y, chosen.at.z), 9, reducedMotion ? 0 : 1.6, CLOSE_POLAR);
            return;
        }
        // Humans visible: no one drawn yet (the town still joining): the flight waits for the first person drawn
        // (`stepPendingHuman`), and only past that the whole town's view.
        if (wait && townHumans.count) {
            pendingHuman = {id: chosen.human.id, until: performance.now() + 30_000};
            return;
        }
        pendingHuman = null;
        const view = islandView("town");
        fly(view.target, view.distance, reducedMotion ? 0 : 2.4, view.polar, view.azimuth);
    };
    /** Humans visible: a person chosen at home or asleep up in a tower's flat: the view stays up there with them. */
    let heldHuman: string | null = null;
    /** Humans visible: a human chosen before anyone was drawn: flown to once someone is (or the town's view at `until`). */
    let pendingHuman: {id: string; until: number} | null = null;
    const stepPendingHuman = () => {
        if (!pendingHuman) return;
        const chosen = chosenHuman(pendingHuman.id, humansAboard, townHumans.out, townHumans.nightNow);
        if (!chosen) {
            pendingHuman = null;
            return;
        }
        if (!chosen.at && performance.now() < pendingHuman.until) return;
        pendingHuman = null;
        selectHuman(chosen, true, false);
    };
    const select = (id: string | null, flyTo: boolean, close = false) => {
        heldHuman = null;
        if (id !== null) pendingHuman = null;
        const human = chosenHuman(id, humansAboard, townHumans.out, townHumans.nightNow);
        if (human) {
            selectHuman(human, flyTo);
            return;
        }
        // A herd member that isn't one of its representatives comes forward to be met (A14); the last one goes back.
        const pin = id && ((!entryById.has(id) && aboard.has(id)) || id === selectionPin) ? id : null;
        if (pin !== selectionPin) {
            selectionPin = pin;
            refreshLive();
        }
        if (id && selectedHerd) selectHerd(null, false);
        selectedId = id;
        if (followId && followId !== id) endFollow();
        const entry = findEntry(id);
        // The one chosen: its model (both levels) ahead of everything else in the queue, asked for now, not when the
        // camera gets within 48 m of it, so it is in by the time the flight arrives (it arrived to an icon, then the far
        // model, then the near one).
        library.urgent = entry?.animal.model_slug ?? null;
        if (entry && library.has(entry.animal.model_slug)) library.request(entry.animal.model_slug, "near");
        // (Not told twice when a held arrival's flight begins: `arrive`.)
        if (!arrivalResumed) options.onSelect?.(entry?.animal ?? null);
        toldState = null;
        tellState();
        if (entry && flyTo) {
            // Its rig is asked for now too, first in its queue (its models are, above: `library.urgent`): it comes in
            // while the camera flies there. It was asked for only once the near model was in and the camera within
            // 20 m, a file's fetch and bake after the flight had ended.
            if (!reducedMotion) rigs.request(entry.animal.model_slug, true);
            // A selection from the page (the HUD, `?focus=`) ends the opening, as a touch does.
            opening = false;
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const distance = camera.position.distanceTo(controls.target);
            // 3.3 fix (mating tap): a pair under way, both in the picture (they are on the ground while acted).
            const pair = pairAim(entry.animal.id);
            if (pair) {
                const pairId = entry.animal.id;
                fly(pair.at.clone(), pair.distance, distance > 30 ? 2 : 1.4, CLOSE_POLAR);
                if (flight) flight.aim = () => pairAim(pairId)?.at ?? (selectedId === pairId ? entry.middle : null);
                return;
            }
            if (entry.place.micro) {
                // A small animal: right up to it, from out along its surface (in front of a wall, beside a trunk, above a flower).
                // The right distance for its size: about a fifth of the view's height.
                const point = surfacePoint(entry.place.micro, entry.animal.zone);
                const target = entry.middle ? entry.middle.clone() : new Vector3(point.x, point.y, point.z);
                const view = viewFrom(point);
                const closeDistance = Math.min(Math.max(entry.trueLength * 6, 0.12), 3);
                controls.minDistance = MICRO_MIN_DISTANCE;
                fly(target, closeDistance, distance > 30 ? 2.2 : 1.4, view.polar, view.azimuth);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? entry.middle : null);
                return;
            }
            // A swimmer under the surface: the camera dives to it, level with it (underwater).
            const swimming = atSeaOf(entry) || entry.depth?.home === "coast" ? middleNow(entry) : null;
            // (The apps' face-to-face close-up too: from above the water it looked at the surface over the animal.)
            if (swimming && swimming.y - entry.drawnHeight / 2 < -0.3) {
                const under = () => middleNow(entry).setY(Math.min(middleNow(entry).y, -0.8));
                // A small one (a crab on the seabed) close, at about six of its lengths; the rest a few metres off.
                // (A whale far enough back to be seen whole: true scale.)
                const whole = Math.max(Math.min(3 + entry.length * 2.2, 14), fitWhole(entry.length, width / Math.max(height, 1), FOV));
                // p2 (ocean): out in the open ocean, 24 m at most (side on, a whale still fills the frame; further, the water hides it).
                const away = entry.trueLength < 0.3 ? Math.min(Math.max(entry.trueLength * 6, 0.15), 3) : entry.ocean ? Math.min(whole, 24) : whole;
                if (entry.trueLength < 0.3) controls.minDistance = MICRO_MIN_DISTANCE;
                fly(under(), away, distance > 30 ? 2 : 1.4, entry.trueLength < 0.3 ? 1.1 : 1.5, (entry.yawNow ?? entry.place.yaw) + Math.PI / 2);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? under() : null);
                return;
            }
            // A bird of the air in flight stays in the air: the camera goes up to it and keeps it in view.
            const aloft = entry.state.airborne && entry.air > 0.5;
            if (aloft && !close) {
                const at = middleNow(entry);
                fly(at, 8 + entry.length * 4, distance > 30 ? 2 : 1.4, CLOSE_POLAR);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? middleNow(entry) : null);
                return;
            }
            // A canopy animal: up at its height, from the clearing's side of its tree (the forest round it would hide it).
            if (entry.place.canopy && !close) {
                // Where the leaves don't hide it: from above for one on the crown, from below for one under a limb,
                // from below and beside its limb for one on it (looking up past the limb, the leaf pads are above it),
                // level with one on the trunk, out along the trunk's face.
                const place = entry.place.canopy;
                const site = ZONE_SITES[entry.animal.zone] ?? ZONE_SITES.farm_garden;
                const target = middleNow(entry);
                const point = canopyPoint(entry.animal.zone, place);
                let azimuth = Math.atan2(site.x - target.x, site.z - target.z);
                let polar = 2.2;
                if (place.limb === -1) polar = 0.75;
                else if (place.limb === -2) {
                    polar = 1.5;
                    azimuth = Math.atan2(point.nx, point.nz);
                } else {
                    // Square to the limb, on the clearing's side of it.
                    const side = Math.atan2(point.tz, -point.tx);
                    const toSite = azimuth;
                    azimuth = Math.cos(side - toSite) >= 0 ? side : side + Math.PI;
                    polar = place.mode === "hang" ? 2.55 : 2.15;
                }
                // The first view, of the mode's own and some others round it, with no leaves or limbs between.
                const view = clearCanopyView(target, 2.6 + entry.length * 2.2, polar, azimuth, entry.length);
                fly(target, view.distance, distance > 30 ? 2 : 1.4, view.polar, view.azimuth);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? middleNow(entry) : null);
                return;
            }
            // An underground animal: from above its burrow, a little to one side; the cutaway opens in front of it.
            if (entry.place.burrow && !close) {
                const burrow = entry.place.burrow;
                const middle = tunnelPoint(burrow, 0.5);
                fly(new Vector3(middle.x, burrow.ground - 0.7, middle.z), 5.5 + entry.length * 2, 1.4, 1.2, Math.atan2(Math.sin(burrow.direction + Math.PI / 2), Math.cos(burrow.direction + Math.PI / 2)));
                return;
            }
            // Where it is drawn now, not its snapshot place: from the wide view an animal on its schedule may be metres from
            // that place (the film lane's close-up landed 4.6 m past a Komodo). When it is not drawn yet (streamed out),
            // its schedule's pose; and the flight keeps aiming at it as it moves.
            const aimNow = () => {
                const at = selectAim(middleNow(entry), entry.drawnHeight);
                return new Vector3(at.x, at.y, at.z);
            };
            const target = aimNow();
            const follow = () => {
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? aimNow() : null);
            };
            if (close) {
                // Face to face: low, near, from three-quarters in front, where its mouth can be seen.
                // A visitor is seen from along the beach, with the jetty beside it rather than under the camera.
                if (entry.length < 0.3) controls.minDistance = MICRO_MIN_DISTANCE;
                fly(target, Math.max(entry.length < 0.3 ? meetDistance(entry.length, width / Math.max(height, 1), FOV) : 3.5 + entry.length * 2, cardFit(entry)), 1.6, 1.26, (entry.yawNow ?? entry.place.yaw) + 0.35);
                framedOnGround = entry.animal.id;
                follow();
                return;
            }
            // True scale (motion pass §3): a small one close enough to see, a whale or an elephant far enough back to see whole.
            const meet = meetDistance(entry.length, width / Math.max(height, 1), FOV);
            if (entry.length < 0.3) controls.minDistance = MICRO_MIN_DISTANCE;
            // (With a card over the view's foot, never nearer than the whole animal and its bars fit above it: the apps open on
            // a close-up of the chat's animal, and a pick from there kept that distance, a horse filling the screen.)
            const plain = entry.length < 0.3 ? meet : distance > 40 ? Math.max(10 + entry.length * 4, meet) : Math.min(distance, Math.max(10 + entry.length * 6, meet));
            const fit = cardFit(entry);
            const distanceTo = Math.max(plain, fit);
            framedOnGround = entry.animal.id;
            // One partly behind a tree or a rock from the south is seen from the side or the north, wherever the ground leaves a clear view.
            fly(target, distanceTo, 1.3, CLOSE_POLAR, entry.place.covered ? clearAzimuth(target, distanceTo, CLOSE_POLAR, entry.phase) : undefined);
            follow();
        }
    };

    // MARK: The host's selection: chosen at once, flown to when there is an animal to see

    /**
     * A selection from the host or the page (`ark:select`, a focus link, the list): the apps send theirs the moment the
     * page says it is ready, for the chat's animal, so the camera flew at once to an animal that could not be drawn
     * yet. A wild animal is unseen until the behaviour world is built and its schedule wired (20 s and more on a phone):
     * the close-up was an empty patch of ground. One whose files were still on their way was its icon in a ring for
     * seconds (slow 4G: 6 to 7 s). So the animal is chosen at once (its card, its ring, its model, icon and rig asked
     * for first) and the camera stays where it is, the whole island in the opening, until the animal can be seen and
     * its model is in; then the flight, to the animal itself. A touch meanwhile keeps the view the reader took.
     */
    let arriving: {id: string; close: boolean; since: number; seen: number | null} | null = null;
    /**
     * The animal flown to, and whether its schedule was wired then. A town animal has none until the town's behaviour
     * world is built, half a minute into a phone's visit: it is drawn at its home place, the camera comes, and then its
     * schedule puts it where its day has it, metres away, out of the close-up. So the flight is made once more when
     * its schedule first takes hold, to where it is now.
     */
    let arrived: {id: string; close: boolean; wired: boolean} | null = null;
    // (The reader's own hand on the view meanwhile: the view they took stays.)
    controls.addEventListener("start", () => {
        arriving = null;
        arrived = null;
        framedOnGround = null;
    });
    /**
     * The longest the flight waits for an animal that cannot be drawn at all, and (from when it can) for its model: a
     * close-up's near level on a slow link, or the far level for a pick from the list, which is seen from further off (s).
     */
    const ARRIVE_UNSEEN_SECONDS = 90;
    const ARRIVE_MODEL_SECONDS = {close: 12, far: 4};
    /** Whether the flight to it should still wait: not drawn yet (the frame loop's own rule), or its model not in. */
    const arrivalWaits = (entry: Entry, held: NonNullable<typeof arriving>, now: number): boolean => {
        const unseen = Boolean(entry.sched) && (!world || !entry.sched!.wired) && !entry.visitor && !entry.act && !entry.moment;
        if (unseen) return now - held.since < ARRIVE_UNSEEN_SECONDS;
        held.seen ??= now;
        const model = library.get(entry.animal.model_slug);
        // (Close up, its near level too; from further off the far one is the picture.)
        const modelIn = Boolean(model?.far) && (!held.close || Boolean(model?.near));
        return !modelIn && now - held.seen < (held.close ? ARRIVE_MODEL_SECONDS.close : ARRIVE_MODEL_SECONDS.far);
    };
    /**
     * For the page's loading card: what the held flight waits for and how much of it is in, each a real step (the
     * behaviour world built, the animal's schedule wired, its far model, its near model for a close-up).
     */
    const flightHeld = (): {steps: number; done: number} | null => {
        const held = arriving;
        const entry = held && selectedId === held.id ? findEntry(held.id) : undefined;
        if (!held || !entry) return null;
        const model = library.get(entry.animal.model_slug);
        const unseen = Boolean(entry.sched) && (!world || !entry.sched!.wired) && !entry.visitor && !entry.act && !entry.moment;
        const steps = [!entry.sched || Boolean(world), !unseen, Boolean(model?.far)];
        if (held.close) steps.push(Boolean(model?.near));
        return {steps: steps.length, done: steps.filter(Boolean).length};
    };
    /** The flight itself, the selection already told. */
    const flyToChosen = (id: string, close: boolean) => {
        arrivalResumed = true;
        try {
            select(id, true, close);
        } finally {
            arrivalResumed = false;
        }
    };
    const stepArrival = (now: number) => {
        const held = arriving;
        if (!held) {
            // Flown to before its schedule took hold: once more, to where that has put it.
            if (!arrived || arrived.wired) return;
            const entry = selectedId === arrived.id ? findEntry(arrived.id) : undefined;
            if (!entry) {
                arrived = null;
                return;
            }
            if (!entry.sched?.wired || !entry.sched.warm) return;
            arrived.wired = true;
            flyToChosen(arrived.id, arrived.close);
            return;
        }
        // (Another animal chosen, or the selection cleared: nothing to fly to.)
        if (selectedId !== held.id) {
            arriving = null;
            return;
        }
        const entry = findEntry(held.id);
        if (!entry) {
            arriving = null;
            return;
        }
        if (arrivalWaits(entry, held, now)) return;
        arriving = null;
        arrived = {id: held.id, close: held.close, wired: Boolean(entry.sched?.wired) || Boolean(entry.visitor)};
        flyToChosen(held.id, held.close);
    };
    /**
     * The nearest a selected animal on the ground is framed from while a card covers the view's foot (`setViewInset`):
     * whole, with its bars box, in the part above the card (`fitAboveCard`); 0 with no card.
     */
    const cardFit = (entry: Entry): number => {
        if (insetCovered <= 0 || height <= 0) return 0;
        return fitAboveCard(entry.length, entry.drawnHeight, width / Math.max(height, 1), (height - insetCovered) / height, FOV);
    };
    /** The animal last framed on the ground by a selection (until the reader moves the view): refitted when a card opens. */
    let framedOnGround: string | null = null;
    /** A card that opened (or grew) after the flight: back out until the animal fits above it, the flight still aiming at it. */
    const refitAboveCard = () => {
        const entry = framedOnGround && selectedId === framedOnGround ? findEntry(selectedId) : null;
        if (!entry) return;
        const fit = cardFit(entry);
        if (camera.position.distanceTo(controls.target) >= fit * 0.92) return;
        const aim = () => {
            const at = selectAim(middleNow(entry), entry.drawnHeight);
            return new Vector3(at.x, at.y, at.z);
        };
        fly(aim(), fit, reducedMotion ? 0 : 0.9);
        if (flight) flight.aim = () => (selectedId === entry.animal.id ? aim() : null);
    };

    const arrive = (id: string | null, close: boolean) => {
        arriving = null;
        arrived = null;
        const human = chosenHuman(id, humansAboard, townHumans.out, townHumans.nightNow);
        if (human) {
            selectHuman(human, true);
            return;
        }
        if (!id || reducedMotion || options.recording) {
            select(id, true, close);
            return;
        }
        // Chosen now, without the flight.
        select(id, false, close);
        const entry = findEntry(id);
        if (!entry) return;
        tokens.ensure(entry.animal.model_slug);
        if (!entry.visitor) rigs.request(entry.animal.model_slug, true);
        // (The frame loop's clock: seconds, `performance.now()`.)
        arriving = {id, close, since: performance.now() / 1000, seen: null};
        stepArrival(performance.now() / 1000);
    };

    /** The wild island's ground under a tap (a march along the view ray, then halving), its zone and the grass there. */
    const groundTap = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        rays.setFromCamera(tapNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
        const o = rays.ray.origin, d = rays.ray.direction;
        let prev = 0;
        for (let t = 0.5; t < 400; t *= 1.08) {
            const y = o.y + d.y * t;
            if (y > Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), 0)) {
                prev = t;
                continue;
            }
            let lo = prev, hi = t;
            for (let i = 0; i < 12; i++) {
                const mid = (lo + hi) / 2;
                if (o.y + d.y * mid > Math.max(heightAt(o.x + d.x * mid, o.z + d.z * mid), 0)) lo = mid;
                else hi = mid;
            }
            const x = o.x + d.x * hi, z = o.z + d.z * hi;
            if (heightAt(x, z) <= 0) return; // the sea
            const zone = worldSampler().zoneAt(x, z);
            const level = grazing?.levels.get(`wild|${zone}`);
            const text = level === undefined ? undefined : grassWords?.[grassKey(level)];
            if (text) showGroundWord(text, clientX - rect.left, clientY - rect.top);
            return;
        }
    };
    const tapNdc = new Vector2();
    /** The ground tap's chip ("Grass here: thinning"), at the tap, for 2.6 s. */
    let groundChip: HTMLParagraphElement | null = null;
    let groundChipTimer = 0;
    const showGroundWord = (text: string, x: number, y: number) => {
        const host = canvas.parentElement;
        if (!host) return;
        if (!groundChip) {
            groundChip = document.createElement("p");
            groundChip.setAttribute("role", "status");
            groundChip.dataset.testid = "ark-ground-grass";
            groundChip.style.cssText = "position:absolute;z-index:10;pointer-events:none;transform:translate(-50%,-130%);white-space:nowrap;border-radius:999px;background:rgba(12,14,20,.85);color:#fff;padding:4px 12px;font:600 12.5px/1.4 inherit;box-shadow:0 1px 3px rgba(0,0,0,.3)";
        }
        groundChip.textContent = text;
        groundChip.style.left = `${x}px`;
        groundChip.style.top = `${y}px`;
        host.appendChild(groundChip);
        window.clearTimeout(groundChipTimer);
        groundChipTimer = window.setTimeout(() => groundChip?.remove(), 2600);
    };

    let down: {x: number; y: number; time: number; id: number} | null = null;
    let pointers = 0;
    const onPointerDown = (event: PointerEvent) => {
        pointers++;
        // A tap wakes a sound context the system put to sleep (sound only ever starts from the page's toggle).
        liveliness.audio.touch();
        lastTouch = performance.now() / 1000;
        if (opening) {
            // The first touch skips the opening.
            opening = false;
            flight = null;
        }
        // A touch during a replay skips it: the Ark as it is now.
        if (replay) finishReplay(true, true);
        down = pointers === 1 ? {x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId} : null;
    };
    const onPointerUp = (event: PointerEvent) => {
        pointers = Math.max(pointers - 1, 0);
        if (!down || down.id !== event.pointerId) return;
        const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
        const quick = performance.now() - down.time < 500;
        down = null;
        if (moved > 8 || !quick) return;
        const hit = pick(event.clientX, event.clientY);
        // 3.3 fix: a resting figure under the tap comes out to be met, as `?focus=` brings one (`tap-pick.ts`).
        const chosen = preferTap(hit ? {hit, score: lastPickScore} : null, pickRestingFigure(event.clientX, event.clientY));
        if (chosen && "figure" in chosen) {
            if (selectedHerd) selectHerd(null, false);
            arrive(chosen.figure, false);
            return;
        }
        if (!hit) {
            // p5 (humans): a tapped person shows "Human" and the capturer, no photo.
            const human = pickHuman(event.clientX, event.clientY);
            if (human) {
                select(null, false);
                options.onSelect?.(human);
                return;
            }
            const herd = pickHerd(event.clientX, event.clientY);
            if (herd) {
                selectHerd(herd.info.key, true);
                return;
            }
            if (selectedHerd) selectHerd(null, false);
            // Vegetation on: bare ground tapped says how grazed the grass is there.
            if (grazing && grassWords) groundTap(event.clientX, event.clientY);
        }
        select(hit ? hit.animal.id : null, Boolean(hit));
    };
    const onPointerMove = (event: PointerEvent) => {
        // Any drag ends following.
        if (followId && down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) endFollow();
        else if (followId && pointers > 1) endFollow();
    };
    const onPointerCancel = () => {
        pointers = Math.max(pointers - 1, 0);
        down = null;
    };
    const onWheel = () => {
        lastTouch = performance.now() / 1000;
        if (opening) {
            opening = false;
            flight = null;
        }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, {passive: true});
    // The keyboard (A18): arrows move the view (OrbitControls), + and − zoom, Esc closes the card.
    controls.listenToKeyEvents(canvas);
    controls.keyPanSpeed = 14;
    const onKey = (event: KeyboardEvent) => {
        lastTouch = performance.now() / 1000;
        if (opening) {
            opening = false;
            flight = null;
        }
        if (event.key === "Escape") {
            if (replay) finishReplay(true, true);
            else if (selectedId) select(null, false);
            else if (selectedHerd) selectHerd(null, false);
            return;
        }
        if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
            event.preventDefault();
            const distance = camera.position.distanceTo(controls.target);
            const next = Math.min(Math.max(distance * (event.key === "+" || event.key === "=" ? 0.8 : 1.25), controls.minDistance), maxDistance);
            fly(controls.target.clone(), next, 0.35);
        }
    };
    canvas.addEventListener("keydown", onKey);

    // MARK: Size

    let inset = 0;
    let insetTarget = 0;
    /** The bars box's height over a selected animal's head, and its gap (CSS px): kept clear above it in the apps' embed. */
    const SELECTION_BARS_ROOM = 120;
    /** The card's own height at the foot (`setViewInset`), and that plus what the page draws over the top: the view's covered part. */
    let insetBottom = 0;
    let insetCovered = 0;
    const applyInset = () => {
        if (inset < 0.5) camera.clearViewOffset();
        else camera.setViewOffset(width, height, 0, inset / 2, width, height);
        camera.updateProjectionMatrix();
    };
    const stepInset = () => {
        if (inset === insetTarget) return;
        inset += (insetTarget - inset) * (reducedMotion ? 1 : 0.18);
        if (Math.abs(insetTarget - inset) < 0.5) inset = insetTarget;
        applyInset();
    };

    /**
     * The drawing buffer's size and pixel ratio are set just before a frame is drawn, never after one. Setting them
     * empties the canvas, and a canvas emptied after its frame was drawn is a black frame on screen: each step of a
     * phone's adaptive resolution and each tier change (made at a frame's end), each resize of the page or the app's
     * panel (the observer runs after the frame's drawing), and for as long as a tier change's shaders compiled. Until
     * the next drawn frame the last picture stays up, stretched to the new box if that changed.
     *
     * (Performance lane.) The view's shape follows the element at once: the camera's aspect, the labels' and markers'
     * scale (`sizeView`). The canvas and the finish's render targets (some thirty framebuffers on the high tier) are
     * made again only when the size has stood still for `RESIZE_SETTLE_MS`, and at most every `RESIZE_MOST_MS` while
     * it keeps changing: a window being dragged (or a phone's address bar sliding away) changes the size every frame,
     * and each of those frames re-made every one of them. Meanwhile the picture is drawn with the new shape into the
     * buffer it has and the browser fits it to the element. A tier or a resolution change (`resize`), the mount and
     * a recording take the next frame.
     */
    const RESIZE_SETTLE_MS = 120;
    const RESIZE_MOST_MS = 400;
    let canvasStale = false;
    let drawnOnce = false;
    let canvasAt = -Infinity;
    let canvasTimer: ReturnType<typeof setTimeout> | null = null;
    let canvasFor = "";
    const sizeCanvas = () => {
        canvasStale = false;
        if (canvasTimer !== null) clearTimeout(canvasTimer);
        canvasTimer = null;
        canvasAt = performance.now();
        // (The same size, ratio and tier as it has: nothing to make again, and nothing emptied.)
        const key = `${width}x${height}@${drawRatio()}/${tier}`;
        if (key === canvasFor) return;
        canvasFor = key;
        if (renderer.getPixelRatio() !== drawRatio()) renderer.setPixelRatio(drawRatio());
        renderer.setSize(width, height, false);
        post.setSize(width, height, drawRatio());
        motes.setPixelRatio(drawRatio());
        dust.setPixelRatio(drawRatio());
        liveliness.setPixelRatio(drawRatio());
    };
    const sizeView = () => {
        const rect = el.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        camera.aspect = width / height;
        applyInset();
        tokens.setViewport(FOV, height, width < 640);
        dots.setViewport(FOV, height);
    };
    const resize = () => {
        sizeView();
        // (Before the first frame there is no picture to keep: sized at once.)
        if (drawnOnce) canvasStale = true;
        else sizeCanvas();
    };
    const resizeObserver = new ResizeObserver(() => {
        if (options.recording || disposed || !drawnOnce) {
            resize();
            return;
        }
        sizeView();
        if (canvasTimer !== null) clearTimeout(canvasTimer);
        // (Still changing: once it stands still; a long drag, a few times a second.)
        const due = Math.max(Math.min(RESIZE_SETTLE_MS, canvasAt + RESIZE_MOST_MS - performance.now()), 0);
        canvasTimer = setTimeout(() => {
            canvasTimer = null;
            canvasStale = true;
        }, due);
    });
    resizeObserver.observe(el);
    resize();
    // Out of sight (scrolled away, another tab, the app's panel closed): the sound sleeps.
    // (Runtime: and while the app says its panel is covered or the app is away, `ark:visible` false: the drawing stops, so
    // does the sound.)
    const syncSound = () => liveliness.audio.setHidden(!onScreen || document.hidden || !runtime.visible());
    runtime.onVisibleChange = syncSound;
    document.addEventListener("visibilitychange", syncSound);
    const visibility = new IntersectionObserver(([seen]) => {
        onScreen = seen?.isIntersecting ?? true;
        runtime.onScreen(onScreen);
        syncSound();
    });
    visibility.observe(el);
    // Runtime (sliced mount): the scenery modules (the props' homes, areas, nests and effects, ~0.3 s on a phone) are
    // built after mountArk returns, in their own task before the animals are laid out; a recording builds them now.
    const buildModules = () => {
        modules = ARK_SCENE_MODULES.map((create) => create({
            scene,
            renderer,
            tier,
            snapshot: withoutHumans(options.snapshot), // p5 (humans)
            hours: hoursNow(),
            placeOf: (id) => placedAll.get(id) ?? null,
            planOf: (slug) => library.get(slug)?.behaviour?.plan,
            reducedMotion,
            // (The props lane's burrow mouths and rock dens: a den, burrow, cave or crevice sleeper's roost.)
            roostOf: (id) => {
                const sched = entryById.get(id)?.sched;
                if (!sched || !world || !DEN_ROOSTS.has(sched.profile.roost)) return null;
                return {...roostOf(world, sched.profile, sched.animal), kind: sched.profile.roost};
            }
        }));
        if (options.props === false) for (const sceneModule of modules) sceneModule.setEnabled(false);
        for (const sceneModule of modules) {
            sceneModule.setTier(tier, liteOn());
            sceneModule.setShadows(TIER_SETTINGS[tier].shadows > 0);
            // Part B: their objects by chunk, past the render distance not drawn.
            streamCull.track(sceneModule.root);
        }
    };
    if (options.recording) buildModules();
    else runtime.mountLater([() => {
        buildModules();
        return true;
    }]);
    // The recipes' nests and fish (`behaviour-recipes.ts`): a builder carries to the props' nest for it while it grows
    // (`props/nest-growth.ts`, on the Ark day), and a hunter's chase or plunge goes to the reef's nearest school.
    // The map lane's per-zone visible capacity (rule E, `map/capacity.ts`) for the runtime's live budget (`setArkZoneCapacity`).
    wireZoneCapacity(liveBudget);
    setNestSource(options.props === false ? null : nestSourceFromProps({sites: nestSites, stage: nestStage, arkDayAt: (epoch) => arkDayNow(current, epoch * 1000) ?? 0}));
    // And the recipes' seasons on the Ark's year, from the same Ark day (lane ark-activities: not the calendar month).
    setRecipeArkDay((epoch) => arkDayNow(current, epoch * 1000));
    setFishSource((pos, radius, epoch) => fishSchoolsNear(pos, radius, epoch));
    // And the reef's schools split round the recipes' hunters where they are now (`fish-render.ts`; shared positions).
    setFishChasers(() => recipeScene.chasers);
    applyTier(tier);

    // MARK: First view

    // Runtime (sliced mount): a recording lays the animals out now, as before; otherwise the attach points, the
    // animals' places and their roosts are worked out a slice a frame before the first frame, and the animals laid out
    // in their own task (host calls that need them wait: `afterAnimals`).
    if (options.recording) {
        setSnapshot(options.snapshot, false);
        animalsIn = true;
    } else {
        const first = withoutHumans(options.snapshot); // p5 (humans)
        let attachDone = false;
        let roostQueue: ArkAnimal[] | null = null;
        runtime.mountLater([
            () => {
                void prepareAttachPoints().then(() => (attachDone = true));
                return true;
            },
            () => attachDone,
            () => {
                placedAll = placeAll(first.animals);
                placedFor = first;
                roostQueue = [...first.animals];
                return true;
            },
            () => {
                const started = performance.now();
                while (roostQueue && roostQueue.length && performance.now() - started < 12) {
                    const animal = roostQueue.pop()!;
                    const place = placedAll.get(animal.id);
                    if (place && scheduleOn && onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug)) mapRoostOf(place, animal.zone);
                }
                return !roostQueue || roostQueue.length === 0;
            },
            () => {
                setSnapshot(first, false);
                animalsIn = true;
                for (const call of afterAnimals.splice(0)) call();
                return true;
            }
        ]);
    }
    // (Part C: the page may open on the town, decision 26.)
    const home = island && options.openIsland === "town" ? islandView("town") : homeView();
    // A recording (`?record=1`) starts on its first shot's view: no opening flight.
    let opening = !reducedMotion && !options.recording;
    const newest = [...options.snapshot.animals].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    const afterOpening = () => {
        opening = false;
        // A beginning Ark (a few animals): go on to the newest arrival.
        if (!newest || options.snapshot.animals.length > 3 || disposed) return;
        const entry = entryById.get(newest.id);
        if (!entry) return;
        // From the island's edge looking in, so the world (the lake, the trees, the mountain) stands behind it.
        fly(new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + 0.6, entry.place.z), 9 + entry.length * 2.6, 2.8, 1.22, Math.atan2(entry.place.x, entry.place.z));
    };
    if (opening && options.arrival) {
        // Part C, a crossing (`islands/archipelago.ts`): in from over the sea the way the camera came, down onto the island.
        const from = options.arrival.from;
        controls.target.set(from.target.x, from.target.y, from.target.z);
        spherical.set(Math.min(from.distance, maxDistance), from.polar, from.azimuth);
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        controls.update();
        fly(home.target, home.distance, options.arrival.seconds, home.polar, home.azimuth, afterOpening);
    } else if (opening) {
        // The opening: from high over the sea, a slow descent and arc onto the island.
        controls.target.copy(home.target).add(new Vector3(0, 0, -10));
        spherical.set(maxDistance * 0.98, 0.62, -0.95);
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        controls.update();
        fly(home.target, home.distance, OPENING_SECONDS, home.polar, home.azimuth, afterOpening);
    } else {
        spherical.set(home.distance, home.polar, home.azimuth);
        controls.target.copy(home.target);
        camera.position.copy(home.target).add(offset.setFromSpherical(spherical));
        controls.update();
        afterOpening();
    }

    // MARK: Visitor and talking

    /** The visitor faces along the beach, a little toward the sea: seen face on from the sand, the jetty beside it. */
    const visitorYaw = () => Math.atan2(-Math.sin(VISITOR_LANDING.theta), Math.cos(VISITOR_LANDING.theta)) + 0.3;

    /** A small jetty at the landing: planks on posts, from the beach out over the water. */
    const buildJetty = (): Group => {
        const group = new Group();
        const wood = new MeshStandardMaterial({color: new Color("#8a6a4a"), roughness: 0.85, metalness: 0});
        const dark = new MeshStandardMaterial({color: new Color("#5e4632"), roughness: 0.9, metalness: 0});
        const from = VISITOR_LANDING.deckFrom;
        const to = VISITOR_LANDING.deckTo;
        const length = Math.hypot(to.x - from.x, to.z - from.z);
        const angle = Math.atan2(to.x - from.x, to.z - from.z);
        const geometries: BufferGeometry[] = [];
        const planks = Math.round(length / 0.5);
        for (let i = 0; i < planks; i++) {
            const plank = new BoxGeometry(1.7, 0.08, 0.42);
            geometries.push(plank);
            const mesh = new Mesh(plank, i % 3 === 0 ? dark : wood);
            mesh.position.set(0, 0.38, -length / 2 + (i + 0.5) * (length / planks));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        }
        for (let i = 0; i <= 3; i++) {
            for (const side of [-0.78, 0.78]) {
                const post = new CylinderGeometry(0.07, 0.08, 1.8, 6);
                geometries.push(post);
                const mesh = new Mesh(post, dark);
                mesh.position.set(side, -0.5, -length / 2 + (i / 3) * length);
                mesh.castShadow = true;
                group.add(mesh);
            }
        }
        group.position.set((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
        group.rotation.y = angle;
        group.userData.dispose = () => {
            geometries.forEach((geometry) => geometry.dispose());
            wood.dispose();
            dark.dispose();
        };
        return group;
    };

    const setVisitor = (next: ArkVisitor | null): string | null => {
        if (!next) {
            if (selectedId && visitor && selectedId === visitor.animal.id) select(null, false);
            visitor = null;
            visitorLabel?.remove();
            visitorLabel = null;
            if (jetty) {
                scene.remove(jetty);
                (jetty.userData.dispose as () => void)();
                jetty = null;
            }
            return null;
        }
        const id = `visitor:${next.slug}`;
        const foot = VISITOR_LANDING.foot;
        visitor = {
            animal: {
                id,
                species_profile_id: "",
                name: next.name,
                scientific_name: null,
                model_slug: next.slug,
                zone: "seashore",
                arrived_at: "",
                brought_by: {label: "", named: false},
                mine: false
            },
            place: {x: foot.x, z: foot.z, ground: heightAt(foot.x, foot.z), yaw: visitorYaw(), water: false},
            length: displayLength(next.slug),
            full: displayLength(next.slug),
            trueLength: arkBody({model_slug: next.slug}).metres,
            layer: speciesLayer(next.slug),
            depth: null,
            seed: 0,
            stats: arkStats({model_slug: next.slug}),
            // The chat's visitor is never one of the Ark's: ordinary, always.
            thrive: "ordinary",
            floor: arkBody({model_slug: next.slug}).floor,
            pace: loopPace({model_slug: next.slug}),
            arrivedAt: (performance.now() - started) / 1000,
            level: "far",
            phase: phaseOf(id),
            middle: null,
            drawnHeight: 1,
            air: 0,
            lift: 0,
            visitor: true,
            state: behaviourState({activity: null, elevation: 0, flyer: false, visitor: true}),
            awake: true,
            rest: 0,
            loop: 0
        };
        library.ready().then(() => {
            if (library.has(next.slug)) {
                library.request(next.slug, "far");
                library.request(next.slug, "near");
            }
        });
        if (!jetty) {
            jetty = buildJetty();
            scene.add(jetty);
        }
        if (!visitorLabel) {
            visitorLabel = document.createElement("span");
            Object.assign(visitorLabel.style, {
                position: "absolute",
                left: "0",
                top: "0",
                whiteSpace: "nowrap",
                font: "500 10px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                letterSpacing: "0.04em",
                color: "rgba(255, 252, 244, 0.96)",
                padding: "6px 9px",
                borderRadius: "999px",
                background: "rgba(14, 20, 14, 0.62)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                opacity: "0",
                transition: "opacity 300ms ease",
                willChange: "transform"
            });
            labelLayer.appendChild(visitorLabel);
        }
        visitorLabel.textContent = next.label;
        visitorLabel.style.letterSpacing = arkTracking(next.label, "0.04em");
        return id;
    };

    /** Lane ark-relation-lines: `screenOf`'s point. */
    const relationPoint = new Vector3();
    const visitorPoint = new Vector3();
    const placeVisitorLabel = () => {
        if (!visitorLabel) return;
        const middle = visitor?.middle;
        if (!middle) {
            visitorLabel.style.opacity = "0";
            return;
        }
        visitorPoint.copy(middle).setY(middle.y + (visitor?.drawnHeight ?? 1) * 0.55 + 0.25).project(camera);
        const visible = visitorPoint.z < 1 && Math.abs(visitorPoint.x) < 1.05 && Math.abs(visitorPoint.y) < 1.05;
        visitorLabel.style.opacity = visible ? "1" : "0";
        if (visible) visitorLabel.style.transform = `translate(${((visitorPoint.x + 1) / 2 * width).toFixed(1)}px, ${((1 - visitorPoint.y) / 2 * height).toFixed(1)}px) translate(-50%, -100%) translateY(-6px)`;
    };

    /** Each herd's count badge over its middle, while the herd is in view and the camera isn't among it. */
    const badgePoint = new Vector3();
    const placeBadges = () => {
        for (const herd of herds) {
            const badge = herd.badge;
            const member = herd.members[herd.anchor];
            const shown = member && !Number.isNaN(herd.middles[herd.anchor * 3]);
            if (!shown) {
                badge.style.opacity = "0";
                badge.style.pointerEvents = "none";
                continue;
            }
            badgePoint.set(member.x, Math.max(member.ground, 0) + herd.height * 1.25 + 0.4, member.z);
            const near = camera.position.distanceTo(badgePoint) < 10;
            badgePoint.project(camera);
            const visible = !near && !replay && badgePoint.z < 1 && Math.abs(badgePoint.x) < 1.02 && Math.abs(badgePoint.y) < 1.02;
            badge.style.opacity = visible ? "1" : "0";
            badge.style.pointerEvents = visible ? "auto" : "none";
            badge.style.background = badge.dataset.selected ? "rgba(167, 244, 50, 0.9)" : "rgba(14, 20, 14, 0.66)";
            badge.style.color = badge.dataset.selected ? "#0e140e" : "rgba(255, 252, 244, 0.98)";
            if (visible) badge.style.transform = `translate(${((badgePoint.x + 1) / 2 * width).toFixed(1)}px, ${((1 - badgePoint.y) / 2 * height).toFixed(1)}px) translate(-50%, -100%)`;
        }
    };

    const setTalking = (next: ArkTalking | null) => {
        const now = performance.now() / 1000;
        if (!next || !next.active) {
            if (talking.target) talking.target = {...talking.target, active: false};
            talking.mouth.flush(now - started / 1000);
            return;
        }
        const changed = !talking.target || talking.target.slug !== next.slug || talking.target.animalId !== next.animalId;
        if (changed) talking.mouth.clear();
        talking.target = {...next};
        talking.lastActive = now;
        if (!talking.actor || talking.actor.slug !== next.slug) {
            talking.actor?.dispose();
            talkingModels ??= talkingSource(options.talkingBase ?? options.modelBase.replace(/\/ark\/?$/, ""));
            const actor = new TalkingActor(next.slug, talkingModels, () => undefined);
            talking.actor = actor;
            scene.add(actor.root);
        }
    };

    /** Each frame: the mouth from the text (or the voice), and the swap back once it has been quiet a while. */
    let lastTalkStep = 0;
    const stepTalking = (elapsed: number) => {
        const actor = talking.actor;
        const delta = lastTalkStep ? Math.min(elapsed - lastTalkStep, 0.1) : 0;
        lastTalkStep = elapsed;
        if (!actor) return;
        const active = Boolean(talking.target?.active);
        const now = performance.now() / 1000;
        if (active) talking.lastActive = now;
        const fromVoice = now - talking.pulseAt < 0.25 ? talking.pulse : 0;
        const want = reducedMotion ? 0 : Math.max(talking.mouth.level(elapsed), fromVoice);
        talking.open = actor.ready ? actor.setMouth(want, delta) : 0;
        const speaking = active || talking.mouth.speaking || now - talking.lastActive < 1.4;
        talking.weight = speaking ? 1 : 0;
        // Shown again by updateInstances when its animal is drawn this frame.
        actor.root.visible = false;
    };

    // MARK: Following

    const endFollow = () => {
        if (!followId) return;
        followId = null;
        runtime.endFollow();
        options.onFollowEnd?.();
    };

    const follow = (id: string | null) => {
        if (!id || !findEntry(id)) {
            followId = null;
            return;
        }
        followId = id;
        controls.autoRotate = false;
        lastTouch = performance.now() / 1000;
    };

    // MARK: The hour

    let lastClock = performance.now() / 1000;
    let lastLight = lastClock;
    const setLight = () => {
        lighting.setHours(hoursNow(), fog);
        micro?.setNight(lighting.daylight.night);
        for (const sceneModule of modules) sceneModule.setHours(hoursNow());
        applyHours();
    };

    // MARK: Replay ("while you were away")

    type Running = {
        acts: ArkAct[];
        index: number;
        begun: boolean;
        /** Since when the next act has waited for its models (a chase needs the body plan). */
        waitFrom: number | null;
        /** When the current act's acting began (after the camera's flight); null while flying. */
        actingFrom: number | null;
        seconds: number;
        lastT: number;
        /** The current act, each frame: t is seconds since the acting began. */
        step: ((t: number, last: number, now: number) => void) | null;
        /** V1: the current act's own letting go at its end (a hatching's young out of the nest). */
        release?: (() => void) | null;
        onAct?: (index: number) => void;
        resolve: () => void;
        home: {target: Vector3; distance: number; polar: number; azimuth: number};
        /** Who stands where a stand-in stood (its place, given again): shown once the act that ends the stand-in is over. */
        after: Map<Entry, number>;
    };
    let replay: Running | null = null;

    const elapsedNow = () => (performance.now() - started) / 1000;
    const inWater = (entry: Entry) => atSeaOf(entry) || entry.place.water;

    /** Where an entry is now and how big, as the acts take it. */
    const bodyOf = (entry: Entry): ActBody => {
        const model = library.get(entry.animal.model_slug);
        const modelScale = model ? entry.length / model.bodyLength : 1;
        const height = model ? model.height * modelScale : entry.length * 0.6;
        const saved = entry.act;
        entry.act = null;
        const where = pose(entry, model, height, elapsedNow());
        entry.act = saved;
        return {x: where.x, z: where.z, base: where.base, yaw: where.yaw, length: entry.length, height, speed: moveSpeed(entry.animal, entry.length)};
    };

    /**
     * Hearts are lives (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md, section 6): an animal back from recovering walks out of
     * its home spot (`acts.ts` emergePose), from the first frame it is aboard after its `revived` event was read; with
     * reduced motion, or under a replay, it is simply there. Never the place it was eaten: its kept slot.
     */
    const stepRevive = (entry: Entry) => {
        const back = reviving.get(entry.animal.id);
        if (!back) return;
        if (replay || reducedMotion) {
            reviving.delete(entry.animal.id);
            if (back.pose && entry.act === back.pose) entry.act = null;
            return;
        }
        const now = elapsedNow();
        if (back.from === null) {
            back.from = now;
            // Not a newcomer: no arrival's grow and ripple.
            entry.arrivedAt = null;
            entry.held = false;
            const at = bodyOf(entry);
            back.home = {...at, x: entry.place.x, z: entry.place.z, base: entry.place.ground, yaw: entry.place.yaw};
        }
        const t = now - back.from;
        if (t >= REVIVE_SECONDS || !back.home) {
            reviving.delete(entry.animal.id);
            if (entry.act === back.pose) entry.act = null;
            return;
        }
        // (Another act took it meanwhile: that one plays.)
        if (entry.act && entry.act !== back.pose) return;
        back.pose = emergePose(back.home, bodyOf(entry), t);
        entry.act = back.pose;
    };

    const entryFor = (animal: ArkEventAnimal): Entry | null => findEntry(animal.id) ?? ghosts.find((ghost) => ghost.animal.id === animal.id) ?? null;

    // MARK: Meals (lane ark-kills-real: the catch, the meal, traces, scavengers)

    /** One side of a meal as its rules read it (`meals.ts`): its body plan, true length and mass, its diet. */
    const mealSideOf = (entry: Entry, water: boolean): MealSide => {
        const slug = entry.animal.model_slug;
        const plan = library.get(slug)?.behaviour?.plan ?? null;
        const flies = FLYERS.has(slug) && ZONE_SITES[entry.animal.zone]?.kind !== "sea";
        const length = Math.max(entry.trueLength, 0.01);
        return {slug, plan, flies, water, length, massKg: bodyMassKg({slug, plan, flies}, length), diet: (entry.sched?.profile ?? behaviourProfile(slug, plan)).diet};
    };
    /** Where a model's mouth is (its foremost vertices, model units), per species; then scaled to the entry. */
    const mouthPoints = new Map<string, {x: number; y: number; z: number; minY: number; bodyLength: number} | null>();
    const mouthOfModel = (entry: Entry): MealCatch["mouth"] => {
        const slug = entry.animal.model_slug;
        const model = library.get(slug);
        if (!mouthPoints.has(slug) && model) {
            const geometry = model && !model.placeholder && !model.facing ? (model.near ?? model.far)?.geometry ?? null : null;
            const position = geometry?.getAttribute("position");
            let found: {x: number; y: number; z: number; minY: number; bodyLength: number} | null = null;
            if (model && position && position.count) {
                let max = -Infinity;
                for (let i = 0; i < position.count; i++) max = Math.max(max, position.getZ(i));
                let n = 0;
                let x = 0;
                let y = 0;
                const near = max - Math.max(model.bodyLength * 0.02, 1e-4);
                for (let i = 0; i < position.count; i++) {
                    if (position.getZ(i) < near) continue;
                    x += position.getX(i);
                    y += position.getY(i);
                    n++;
                }
                found = n ? {x: x / n, y: y / n, z: max, minY: model.minY, bodyLength: model.bodyLength} : null;
            }
            mouthPoints.set(slug, found);
        }
        const m = mouthPoints.get(slug);
        if (!m) return null;
        const k = entry.length / Math.max(m.bodyLength, 1e-6);
        return {forward: m.z * k, side: m.x * k, up: Math.max((m.y - m.minY) * k, 0)};
    };
    /** The nearest water's edge a drinker can reach from a spot (dry ground beside water), searched on rings; or null. */
    const waterEdgeNear = (x: number, z: number, reach = DRINK_REACH): {x: number; z: number} | null => {
        for (let r = 2; r <= reach; r += 1.5) {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const wx = x + Math.sin(a) * r;
                const wz = z + Math.cos(a) * r;
                if (heightAt(wx, wz) >= -0.05) continue;
                // Back toward the spot until the ground is dry: the edge.
                for (let k = 0.4; k <= r; k += 0.4) {
                    const ex = wx - Math.sin(a) * k;
                    const ez = wz - Math.cos(a) * k;
                    if (heightAt(ex, ez) >= 0.02) return {x: ex, z: ez};
                }
            }
        }
        return null;
    };
    /**
     * A meal's chase and its meal script. With the server's encounter the two start exactly where it says (the hunter
     * at its waypoint, the prey at its disc's middle), so a replay and the live world act the same meal the same way for
     * every viewer; without one (the pool) from where the scene has them, as before.
     */
    const buildMealStage = (act: MealAct, predator: Entry, prey: Entry): {kind: ReturnType<typeof chaseKind>; stage: MealStage; bodies: {predator: ActBody; prey: ActBody}; script: ReturnType<typeof mealScript> | null; plan: MealPlan | null; catchInfo: Omit<MealCatch, "predator" | "prey" | "kind"> | null} => {
        const model = library.get(predator.animal.model_slug);
        const predatorWater = inWater(predator);
        const preyWater = inWater(prey);
        const kind = chaseKind({
            predatorSlug: predator.animal.model_slug,
            predatorPlan: model?.behaviour?.plan ?? null,
            predatorWater,
            preyWater,
            predatorFlies: FLYERS.has(predator.animal.model_slug) && ZONE_SITES[predator.animal.zone]?.kind !== "sea"
        });
        // The chase (L7, `acts.ts`): with both sides' speeds, the prey's way of fleeing, the ground or water each may cross.
        const chaser = (entry: Entry): ActBody => ({...bodyOf(entry), speedStat: entry.stats.speed, gait: entry.sched?.profile.gait ?? null, slug: entry.animal.model_slug});
        const encounter = mealEncounter(act);
        let bodies: {predator: ActBody; prey: ActBody};
        if (encounter) {
            const hunter = chaser(predator);
            const quarry = chaser(prey);
            const ground = (x: number, z: number) => Math.max(heightAt(x, z), -0.3);
            const ph = {...hunter, x: encounter.predator.x, z: encounter.predator.z, base: predatorWater ? Math.min(hunter.base, -0.05) : hunter.base > ground(hunter.x, hunter.z) + 0.3 ? hunter.base : ground(encounter.predator.x, encounter.predator.z)};
            const qh = {...quarry, x: encounter.prey.x, z: encounter.prey.z, base: preyWater ? Math.min(quarry.base, -0.05) : ground(encounter.prey.x, encounter.prey.z), yaw: ((hash32(act.prey.id) % 6283) / 1000) - Math.PI};
            bodies = encounterBodies(ph, qh, encounter);
        } else bodies = {predator: chaser(predator), prey: chaser(prey)};
        const flee = preyFleeStyle({preySlug: prey.animal.model_slug, preyPlan: library.get(prey.animal.model_slug)?.behaviour?.plan ?? null, preyWater, preyFlies: FLYERS.has(prey.animal.model_slug) && ZONE_SITES[prey.animal.zone]?.kind !== "sea", speedStat: prey.stats.speed});
        const chaseGround = (x: number, z: number) => !world || (world.nav.walkable(x, z) && !world.sampler.blocked(x, z, 0.3) && !collideBlocked(x, z, 0.3));
        const seed = `${act.prey.id}#${act.at}`;
        const withMeal = kind !== "cutaway";
        const stage = mealStage(kind, bodies.predator, bodies.prey, {seed, flee, clear: chaseGround, water: (x, z) => heightAt(x, z) < -0.05, exact: Boolean(encounter), meal: withMeal});
        if (!withMeal) return {kind, stage, bodies, script: null, plan: null, catchInfo: null};
        const plan = mealPlan(mealSideOf(predator, predatorWater), mealSideOf(prey, preyWater), seed);
        const at = stage.catchAt ?? stage.seconds;
        const p = stage.predator(at)!;
        const q = stage.prey(at);
        const predatorSwims = kind === "dart" || (predatorWater && !FLYERS.has(predator.animal.model_slug));
        const catchInfo: Omit<MealCatch, "predator" | "prey" | "kind"> = {
            mouth: mouthOfModel(predator),
            preyInWater: preyWater || heightAt(q.x, q.z) < -0.05,
            predatorSwims,
            ground: (x, z) => Math.max(heightAt(x, z), -0.3),
            clear: (x, z) => heightAt(x, z) >= 0.02 && chaseGround(x, z),
            water: plan.drinkSeconds > 0 ? waterEdgeNear(q.x, q.z) : null,
            walk: Math.max(moveSpeed(predator.animal, predator.length) * 0.5, 0.3)
        };
        const script = mealScript(plan, {...catchInfo, kind, predator: {x: p.x, z: p.z, base: p.base, yaw: p.yaw, length: bodies.predator.length, height: bodies.predator.height}, prey: {x: q.x, z: q.z, base: q.base, yaw: q.yaw, length: bodies.prey.length, height: bodies.prey.height}});
        return {kind, stage, bodies, script, plan, catchInfo};
    };
    /** A stand-in for an eaten animal, from the event's record (the replay's `ghostAnimalsOf`, one at a time). */
    const ghostAnimalOf = (animal: ArkEventAnimal): ArkAnimal => ({
        id: animal.id,
        species_profile_id: animal.species_profile_id,
        name: animal.name,
        scientific_name: null,
        model_slug: animal.model_slug,
        zone: animal.zone,
        arrived_at: animal.arrived_at ?? "",
        brought_by: {label: "", named: false},
        mine: false,
        origin: animal.origin ?? undefined,
        generation: animal.generation ?? undefined,
        slot: animal.slot,
        slot_rank: animal.slot_rank,
        sociality: animal.sociality,
        activity: animal.activity
    });
    const liveMeals = new LiveMeals<Entry>({
        find: (id) => entryById.get(id) ?? null,
        ghost: (act) => {
            const animal = ghostAnimalOf(act.prey);
            const place = placeAll([animal], true).get(animal.id);
            if (!place) return null;
            const ghost = Object.assign(newEntry(animal, place, null), {ghost: true});
            ghost.leader = null;
            mealGhosts = [...mealGhosts, ghost];
            // Both models, near and far, as a replay asks for its acts' (a small prey's is otherwise asked for only close by).
            void library.ready().then(() => {
                for (const slug of [act.prey.model_slug, act.predator.model_slug]) {
                    if (!library.has(slug)) continue;
                    library.request(slug, "far");
                    library.request(slug, "near");
                    tokens.ensure(slug);
                }
            });
            // The living one (a read not yet refreshed since it was eaten): out of sight while its stand-in is acted.
            const alive = entryById.get(animal.id);
            if (alive) alive.held = true;
            return ghost;
        },
        drop: (ghost) => {
            mealGhosts = mealGhosts.filter((g) => g !== ghost);
        },
        stage: (act, predator, prey) => {
            const built = buildMealStage(act, predator, prey);
            if (!built.script || !built.plan || !built.catchInfo) return null;
            return {stage: built.stage, kind: built.kind, plan: built.plan, catch: built.catchInfo, predatorHeight: built.bodies.predator.height, preyHeight: built.bodies.prey.height, predatorLength: built.bodies.predator.length, preyLength: built.bodies.prey.length};
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return {x: at.x, z: at.z, y: at.y, yaw: at.yaw, doing: at.doing, aloft: at.aloft};
        },
        candidates: (spot, epoch) => {
            const out: Array<ScavengerCandidate & {entry: Entry; height: number; walk: number}> = [];
            for (const e of entries) {
                if (!e.sched || e.visitor || e.held || townIds.has(e.animal.id)) continue;
                const slug = e.animal.model_slug;
                const plan = library.get(slug)?.behaviour?.plan ?? null;
                const c = {slug, plan, diet: e.sched.profile.diet, length: e.trueLength};
                if (!isScavenger(c)) continue;
                // (Its home far beyond its reach: not worth asking its schedule.)
                const flies = e.sched.profile.move === "fly";
                if (Math.hypot(e.sched.animal.home.x - spot.x, e.sched.animal.home.z - spot.z) > (flies ? 160 : 90)) continue;
                const at = schedulePose(e, epoch);
                const model = library.get(slug);
                out.push({id: e.animal.id, ...c, flies, x: at.x, z: at.z, awake: at.doing !== "sleep" && at.doing !== "to_roost", entry: e, height: model ? model.height * (e.length / model.bodyLength) : e.length * 0.6, walk: Math.max(moveSpeed(e.animal, e.length) * 0.5, 0.3)});
            }
            return out;
        },
        eats,
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id))),
        hold: (ghost, held) => {
            ghost.held = held;
        }
    });
    // 3.3 fix (log): the record's deaths (owner 2026-11-16: "i should see its corpse"): where it died, its body there.
    const deathEntryOf = (death: DeathRecord): Entry | null => {
        const known = entryById.get(death.animal.id) ?? departed.get(death.animal.id);
        if (known) return known;
        const animal: ArkAnimal = {...ghostAnimalOf(death.animal), area: death.animal.area ?? null, thrive: death.animal.thrive ?? null};
        const place = placeAll([animal], true).get(animal.id);
        return place ? newEntry(animal, place, null) : null;
    };
    const liveDeaths = new LiveDeaths<Entry>({
        spotOf: (death) => {
            const e = deathEntryOf(death);
            if (!e) return null;
            // p5 (humans): a logging death lies where the server judged its home (inside the cleared stand).
            if (death.at) return {x: death.at.x, z: death.at.z, base: Math.max(standGround(death.at.x, death.at.z), -0.3), yaw: e.place.yaw ?? 0};
            // Where its schedule had it at the death's time (pure in the clock and its id); else where it lived.
            const own = world ? e.sched ?? statusSchedOf(e) : null;
            const at = own ? poseOnTrip(worldOf(own.animal), tripAt(worldOf(own.animal), own.profile, own.animal, death.t0, scheduleHours, e.animal.activity, null), death.t0) : null;
            const x = at?.x ?? e.place.x;
            const z = at?.z ?? e.place.z;
            // (V1: a speck in the water, a water flea: it dies where it drifts. Brought down to the bed it lay under the
            // bed as it is drawn, which stands a few millimetres to centimetres off the analytic one: nothing to see.)
            if (at && e.trueLength < 0.05 && at.y < waterTopAt(x, z) - 0.01 && at.y > standGround(x, z)) return {x, z, base: at.y, yaw: at.yaw ?? e.place.yaw ?? 0, from: null};
            // (V1: how high it was then, a flyer on the wing: the dying act brings it down.)
            return {x, z, base: Math.max(standGround(x, z), -0.3), yaw: at?.yaw ?? e.place.yaw ?? 0, from: at ? at.y : null};
        },
        ghost: (death) => {
            const from = deathEntryOf(death);
            if (!from) return null;
            const ghost = Object.assign(newEntry(from.animal, from.place, null), {ghost: true});
            ghost.leader = null;
            mealGhosts = [...mealGhosts, ghost];
            const alive = entryById.get(death.animal.id);
            if (alive) alive.held = true;
            void library.ready().then(() => {
                if (!library.has(from.animal.model_slug)) return;
                library.request(from.animal.model_slug, "far");
                library.request(from.animal.model_slug, "near");
                tokens.ensure(from.animal.model_slug);
            });
            return ghost;
        },
        drop: (ghost) => {
            mealGhosts = mealGhosts.filter((g) => g !== ghost);
            // (Still in the roster after its body has gone, a read not yet refreshed: drawn again.)
            const alive = entryById.get(ghost.animal.id);
            if (alive) alive.held = false;
        },
        setAct: (ghost, pose) => {
            ghost.act = pose;
        }
    });
    /**
     * V1: where one of the town's held animals is now (a tank's, a cage's, a room's or a zoo house's resident: it has no
     * day to walk from), for an act there; null for anyone else. The same for every viewer: a swimmer's and a room's
     * walker's place are the shared clock's (`tankPose`, `roomPose`); one kept on a display's tray is at its place, by
     * its place's own heading (its idle turning about is each viewer's own).
     */
    const housedPlace = (entry: Entry): {x: number; z: number; yaw: number; base: number} | null => {
        if (entry.sched || reducedMotion || !island?.held(entry.animal.id)) return null;
        const at = bodyOf(entry);
        const id = entry.animal.id;
        const moves = Boolean(island.tankPose(id, entry.length, entry.drawnHeight || entry.length * 0.3, clockNow()) ?? island.roomPose(id, entry.length, clockNow()));
        return moves ? {x: at.x, z: at.z, yaw: at.yaw, base: at.base} : {x: entry.place.x, z: entry.place.z, yaw: entry.place.yaw ?? at.yaw, base: at.base};
    };
    /**
     * ARK-MATING-SHOWN: where an act takes one with no day: a held one's place (`housedPlace`), else, for a small animal
     * off any day (on its wall, its flower, its leaf: `map/place.ts` onSchedule), where it is drawn, `free`.
     */
    const actPlace = (entry: Entry): {x: number; z: number; yaw: number; base: number; free?: boolean} | null => {
        const housed = housedPlace(entry);
        if (housed || entry.sched || reducedMotion || island?.held(entry.animal.id)) return housed;
        const at = bodyOf(entry);
        return {x: at.x, z: at.z, yaw: at.yaw, base: at.base, free: true};
    };
    /** The record's matings acted out (owner 2026-11-15): the two walk to each other, court, nuzzle and lie together. */
    const liveMatings = new LiveMatings<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return {x: at.x, z: at.z, y: at.y, yaw: at.yaw, doing: at.doing, aloft: at.aloft};
        },
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        // The drawn body (what the viewer sees touch and mount), not the real metres.
        length: (entry) => entry.length,
        height: (entry) => entry.drawnHeight,
        plan: (entry) => library.get(entry.animal.model_slug)?.behaviour?.plan ?? null,
        // REAL-REPRODUCTION (decision 440): the kind's own way of breeding (a spawning night, a redd, amplexus, a pouch).
        repro: (entry) => reproOf(entry.animal.species_profile_id),
        // (Its kind close by, awake or not: on its spawning night they spawn with it, each where it is.)
        kinSpots: (entry) => {
            const out: Array<{x: number; z: number}> = [];
            const me = bodyOf(entry);
            for (const e of allEntries()) {
                if (e === entry || e.animal.species_profile_id !== entry.animal.species_profile_id || e.held || e.visitor) continue;
                const at = bodyOf(e);
                if (Math.hypot(at.x - me.x, at.z - me.z) < 60) out.push({x: at.x, z: at.z});
            }
            return out;
        },
        // The species' own courtship from its recipes (a display, a dance together); else he chases her.
        courtship: (entry) => {
            const ids = new Set(speciesRecipes(entry.animal.model_slug).recipes.map((r) => r.id));
            return ids.has("court_dance") ? "dance" : ids.has("court_display") ? "display" : null;
        },
        male: (entry) => {
            const sex = sexLook(entry.animal.id, entry.animal.model_slug).sex;
            return sex === "male" ? true : sex === "female" ? false : null;
        },
        together: (a, b) => worldOf(a.animal) === worldOf(b.animal),
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id)),
        // A contest first (handover §5): where the species' recipes have rival males contest, and a real male is near.
        contest: (entry) => {
            const ids = new Set(speciesRecipes(entry.animal.model_slug).recipes.map((r) => r.id));
            return ids.has("antler_clash") || ids.has("horn_clash") ? "clash" : ids.has("box_spar") ? "box" : ids.has("wrestle") || ids.has("jaw_spar") || ids.has("lizard_contest") ? "wrestle" : null;
        },
        rival: (male, female, epoch) => {
            if (!world || reducedMotion || !male.sched) return null;
            const kind = male.animal.kind_species_profile_id || male.animal.species_profile_id || male.animal.model_slug;
            const at = schedulePose(male, epoch);
            let best: {entry: Entry; d: number} | null = null;
            for (const e of allEntries()) {
                if (e === male || e === female || e.held || e.visitor || !e.sched || e.sched.animal.young) continue;
                if ((e.animal.kind_species_profile_id || e.animal.species_profile_id || e.animal.model_slug) !== kind) continue;
                if (worldOf(e.animal) !== worldOf(male.animal) || sexLook(e.animal.id, e.animal.model_slug).sex !== "male") continue;
                const p = schedulePose(e, epoch);
                const d = Math.hypot(p.x - at.x, p.z - at.z);
                // (The nearest; ties by id, so every viewer picks the same one.)
                if (d <= CONTEST_MAX_APART && (!best || d < best.d || (d === best.d && e.animal.id < best.entry.animal.id))) best = {entry: e, d};
            }
            return best?.entry ?? null;
        },
        // V1: one with no day to walk from (the town's held: a zoo house's, a tank's, a cage's or a room's resident) is where the scene draws it now.
        // ARK-MATING-SHOWN: and one off any day that is not held (a small animal on its wall, its flower, its leaf): where
        // it is drawn, `free` (he goes to her there).
        placeOf: (entry) => actPlace(entry),
        flies: (entry) => {
            const plan = library.get(entry.animal.model_slug)?.behaviour?.plan ?? "";
            return FLYERS.has(entry.animal.model_slug) || /fly|butterfly|bird|bat/.test(plan);
        },
        // ARK-MATING-SHOWN (decision 416): a meeting that can be seen: dry ground for land animals, nothing solid over it.
        clear: (p, wet) => {
            const ground = heightAt(p.x, p.z);
            if (!wet && waterTopAt(p.x, p.z) > ground + 0.05) return false;
            if (!overheadSight) {
                overheadSight = new Sight(scene);
                overheadSight.skip = (mesh) => mesh.userData.kind === "asset-tree" || Boolean(((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined)?.userData.arkNearFade);
            }
            const from = overheadFrom.set(p.x, Math.max(ground, wet ? ground : 0) + 0.25, p.z);
            overheadSight.near(from, 30);
            return !overheadSight.blocked(from, overheadTo.set(p.x, from.y + 30, p.z), 0);
        },
        // REAL-REPRODUCTION: nothing at all over it, a fence rail or a hedge counted too (the shots look in past them).
        open: (p) => {
            // (A fence, a wall, a post near: the camera that looks in from a metre off would have it between.)
            if (collideBlocked(p.x, p.z, 1.3)) return false;
            const ground = heightAt(p.x, p.z);
            if (!openSight) {
                openSight = new Sight(scene);
                openSight.skip = (mesh) => mesh.userData.kind === "asset-tree";
            }
            // (Up and out on every side, as the camera looks in: a rail beside the spot meets one of these.)
            const from = overheadFrom.set(p.x, Math.max(ground, 0) + 0.15, p.z);
            openSight.near(from, 8);
            for (const tilt of [0.35, 0.7, 1.05]) {
                for (let i = 0; i < 8; i++) {
                    const turn = (i * Math.PI) / 4;
                    const out = Math.sin(tilt) * 5;
                    if (openSight.blocked(from, overheadTo.set(p.x + Math.sin(turn) * out, from.y + Math.cos(tilt) * 5, p.z + Math.cos(turn) * out), 0)) return false;
                }
            }
            return !openSight.blocked(from, overheadTo.set(p.x, from.y + 30, p.z), 0);
        },
        between: (a, b) => {
            if (!openSight) return false;
            for (const up of [0.1, 0.4, 0.9]) {
                const from = overheadFrom.set(a.x, Math.max(heightAt(a.x, a.z), 0) + up, a.z);
                openSight.near(from, 4);
                if (openSight.blocked(from, overheadTo.set(b.x, Math.max(heightAt(b.x, b.z), 0) + up, b.z), 0)) return false;
            }
            return true;
        }
    }, (entry) => entry.animal.id);
    let openSight: Sight | null = null;
    let overheadSight: Sight | null = null;
    const overheadFrom = new Vector3();
    const overheadTo = new Vector3();
    /**
     * The record's live births acted out (handover §5): the mother settles, the young are born, licked, get up and
     * suckle, by the species' care (`live-births.ts`). A meal or a mating under way has the animal first.
     */
    const POUCHED = new Set((pouchTable as {slugs: string[]}).slugs);
    const liveBirths = new LiveBirths<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            // (Not in the air, not out at sea on the wing: a birth is on the ground or in the water where it lives.)
            // (`base`: its own level, a sea kind's seabed: REAL-REPRODUCTION's births there.)
            return at.aloft ? null : {x: at.x, z: at.z, yaw: at.yaw, base: at.y};
        },
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        length: (entry) => entry.length,
        height: (entry) => entry.drawnHeight,
        plan: (entry) => library.get(entry.animal.model_slug)?.behaviour?.plan ?? null,
        care: (entry) => speciesCare(entry.animal.model_slug, library.get(entry.animal.model_slug)?.behaviour?.plan ?? null).kind,
        pouch: (entry) => POUCHED.has(entry.animal.model_slug),
        repro: (entry) => reproOf(entry.animal.species_profile_id), // REAL-REPRODUCTION
        male: (entry) => {
            const sex = sexLook(entry.animal.id, entry.animal.model_slug).sex;
            return sex === "male" ? true : sex === "female" ? false : null;
        },
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveMatings.pins().includes(entry.animal.id)),
        // V1: one with no day (the town's held: a tank's, a cage's, a room's or a zoo house's resident) is where the scene
        // draws it now; after a birth there each young comes in where it lives with the scene's own entrance.
        placeOf: (entry) => actPlace(entry), // ARK-MATING-SHOWN: and a small animal off any day, where it is drawn
        appear: (entry) => {
            entry.arrivedAt = elapsedNow();
        }
    });
    // 3.3 batch (B): mobbing dive. Birds whose own text says they mob (`bird-moves.json`) dive in turns at a predator
    // of theirs standing near them, near the camera (`mobbing.ts`: viewer-local, visual only, back to their day after).
    const BIRD_MOVES = birdMoves as unknown as {mob: Record<string, {line: string | null; foe: string | null}>; tail: Record<string, {line: string | null; while: string}>; lure: Record<string, {line: string | null}>};
    // (Where it is drawn this frame, from the frame's own list; out of view, where its day has it.)
    const birdPlaces = new Map<Entry, {x: number; z: number; base: number; yaw: number}>();
    const drawnAt = (e: Entry) => {
        if (e.held || e.act?.hidden || (e.denIn ?? 0) > 0.3) return null;
        const p = birdPlaces.get(e);
        if (p) return {x: p.x, y: p.base, z: p.z, yaw: p.yaw};
        const at = e.sched?.pose;
        return at ? {x: at.x, y: at.y, z: at.z, yaw: at.yaw} : null;
    };
    const birdHost: MobHost<Entry> = {
        id: (e) => e.animal.id,
        slug: (e) => e.animal.model_slug,
        mobs: (e) => e.animal.model_slug in BIRD_MOVES.mob,
        free: (e) => scheduled(e) && !e.held && e.awake && !e.state.asleep && !e.place.micro && !e.sched?.animal.young && !mealPins.has(e.animal.id),
        place: drawnAt,
        home: (e, epoch) => (e.sched && world ? schedulePose(e, epoch) : null),
        length: (e) => e.length,
        height: (e) => e.drawnHeight,
        threatens: (t, b) =>
            Boolean(t.sched && b.sched) && !t.visitor && !t.place.micro && !t.place.water && !atSeaOf(t) && t.air <= 0.5 && !t.sched!.pose?.aloft &&
            canEat(intelProfile(t.animal.model_slug, null, t.stats.intelligence), intelProfile(b.animal.model_slug, null, b.stats.intelligence), t.sched!.profile.size, b.sched!.profile.size),
        ground: (x, z) => Math.max(heightAt(x, z), 0),
        act: (e) => e.act ?? null,
        setAct: (e, pose, aloft) => {
            e.act = pose;
            e.birdAloft = Boolean(pose && aloft);
            if (pose && aloft) e.air = 1;
        }
    };
    const mobbing = new Mobbing<Entry>(birdHost);
    // 3.3 batch (B): broken-wing display. A ground-nester whose own text says so leads a predator near it away from its
    // nest along the ground, then flies back (`broken-wing.ts`); its nest is the record's (the props' site with eggs or chicks).
    const brokenWing = new BrokenWing<Entry>({
        ...birdHost,
        mobs: (e) => e.animal.model_slug in BIRD_MOVES.lure,
        free: (e) => birdHost.free(e) && e.air <= 0.001 && !e.sched?.pose?.aloft && !e.place.water,
        nest: (e, epoch) => {
            const nest = nestSourceOf(e.animal.id, epoch);
            return nest && ((nest.eggs ?? 0) > 0 || (nest.chicks ?? 0) > 0) ? nest : null;
        }
    });
    const birdNear: Entry[] = [];
    const tailSeen: ArkSeenAct[] = [];
    const stepBirdMoves = (list: Array<{entry: Entry; distance: number; visible: boolean; pose: {x: number; z: number; base: number; yaw: number}}>, epoch: number) => {
        if (!world || reducedMotion || !scheduleOn) {
            brokenWing.clear();
            return void mobbing.clear();
        }
        // 3.3 batch (B): tail pump, cock and fan. The shader moves the tail (`tail-habit.ts`); here only the log's sentence,
        // for a bird close enough for it to be seen, once per bird and ten minutes (listed once a second).
        if (mobbing.due(epoch)) {
            tailSeen.length = 0;
            for (const c of list) {
                const e = c.entry;
                const said = c.visible && c.distance < 18 ? BIRD_MOVES.tail[e.animal.model_slug] : undefined;
                if (!said?.line || e.act || e.state.asleep || e.air > 0.001 || !library.get(e.animal.model_slug)?.behaviour?.tail) continue;
                if (said.while !== "any" && (said.while === "walk") !== Boolean(e.sched?.pose?.moving)) continue;
                const a = e.animal;
                tailSeen.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: "tail_habit", episode: `tail:${a.id}:${Math.floor(epoch / 600)}`, block: "tail", fish: false, line: said.line});
            }
        }
        for (const seen of tailSeen) seenActs.push(seen);
        if (duckDrops.size) {
            for (const j of duckDrops.jumping(epoch)) {
                const e = entryById.get(j.id);
                const line = e ? DROPS[e.animal.model_slug]?.line : null;
                const a = e?.animal;
                if (a && line && seenNear.has(a.id)) seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: "hollow_drop", episode: j.episode, block: "jump", fish: false, line});
            }
        }
        birdNear.length = 0;
        birdPlaces.clear();
        if (!mobbing.active && !brokenWing.active && !mobbing.due(epoch) && !brokenWing.due(epoch)) return;
        for (const c of list) {
            if (!c.visible || c.distance > 70) continue;
            birdNear.push(c.entry);
            birdPlaces.set(c.entry, c.pose);
        }
        mobbing.step(epoch, birdNear);
        brokenWing.step(epoch, birdNear);
        for (const l of brokenWing.seen(epoch)) {
            const a = l.entry.animal;
            const line = BIRD_MOVES.lure[a.model_slug]?.line;
            // (A sentence that speaks of its nest only when the record has it one there.)
            if (line && (l.nested || !/nest/.test(line))) seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: "broken_wing", episode: l.episode, block: "lure", fish: false, line});
        }
        for (const m of mobbing.seen(epoch)) {
            const a = m.entry.animal;
            const said = BIRD_MOVES.mob[a.model_slug];
            const line = said && mobFoeFits(said.foe, m.threat.animal.model_slug, library.get(m.threat.animal.model_slug)?.behaviour?.plan ?? null) ? said.line : null;
            if (line) seenActs.push({id: a.id, name: a.name, speciesId: a.kind_species_profile_id || a.species_profile_id || `slug:${a.model_slug}`, zone: a.zone, recipe: "mob_dive", episode: m.episode, block: "dive", fish: false, line});
        }
    };
    // 3.3 batch (B): ducklings dropping from the tree hole. A hatching of the record, of a kind whose own text says its
    // young leave a tree hole by jumping (`bird-moves.json` drop), acted from the hatch's time (`duckling-drop.ts`).
    const DROPS = (birdMoves as unknown as {drop: Record<string, {line: string | null}>}).drop;
    let hollowPoints: Array<{x: number; y: number; z: number; nx: number; nz: number; id: string; drawn: boolean}> | null = null;
    const hollowNear = (x: number, z: number): Hollow | null => {
        // (The scenery's holes: a drawn `tree_hollow`, else a sideways `bark` point more than 1.5 m up a tree; the same
        // for every viewer. The nearest within 60 m, a drawn hole first.)
        hollowPoints ??= allAttachPoints()
            .filter((p) => p.tag === "tree_hollow" || (p.tag === "bark" && Math.abs(p.normal.y) < 0.35 && p.position.y - Math.max(heightAt(p.position.x, p.position.z), 0) > 1.5 && /broadleaf|rainforest|orchard|acacia|conifer|palm|canopy/.test(p.hostKind)))
            .map((p) => {
                const flat = Math.hypot(p.normal.x, p.normal.z) || 1;
                return {x: p.position.x, y: p.position.y, z: p.position.z, nx: p.normal.x / flat, nz: p.normal.z / flat, id: p.id, drawn: p.tag === "tree_hollow"};
            });
        let best: (typeof hollowPoints)[number] | null = null;
        let bestD = Infinity;
        for (const p of hollowPoints) {
            const d = Math.hypot(p.x - x, p.z - z) + (p.drawn ? 0 : 20);
            if (d < bestD || (d === bestD && best && p.id < best.id)) {
                best = p;
                bestD = d;
            }
        }
        return best && bestD <= 80 ? {x: best.x, y: best.y, z: best.z, nx: best.nx, nz: best.nz} : null;
    };
    const duckDrops = new LiveDuckDrops<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return {x: at.x, z: at.z, yaw: at.yaw};
        },
        drops: (entry) => entry.animal.model_slug in DROPS,
        hollow: hollowNear,
        ground: (x, z) => Math.max(heightAt(x, z), 0),
        length: (entry) => entry.length,
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        male: (entry) => {
            const sex = sexLook(entry.animal.id, entry.animal.model_slug).sex;
            return sex === "male" ? true : sex === "female" ? false : null;
        },
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveMatings.pins().includes(entry.animal.id))
    });
    /**
     * 3.3 batch (D): the record's escapes acted out (`live-escapes.ts`, decision 373; owner 2026-11-16): the chase that
     * ends in a miss, from where the two's days have them at the encounter's step (the server's places where it gives
     * them), then the prey's limp. A meal, a mating or a birth under way has the animal first.
     */
    // (Whoever's day has it on the wing, `profile.move`: the old `FLYERS` list is seven birds.)
    const escapeFlies = (entry: Entry) => (entry.sched?.profile.move === "fly" || FLYERS.has(entry.animal.model_slug)) && ZONE_SITES[entry.animal.zone]?.kind !== "sea";
    const liveEscapes = new LiveEscapes<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        chase: (act, predator, prey) => {
            if (!world || reducedMotion || !predator.sched || !prey.sched || worldOf(predator.animal) !== worldOf(prey.animal)) return null;
            const predatorWater = Boolean(inWater(predator));
            const preyWater = Boolean(inWater(prey));
            const planOf = (e: Entry) => library.get(e.animal.model_slug)?.behaviour?.plan ?? null;
            const kind = chaseKind({predatorSlug: predator.animal.model_slug, predatorPlan: planOf(predator), predatorWater, preyWater, predatorFlies: escapeFlies(predator)});
            if (kind === "cutaway") return null;
            const ground = (x: number, z: number) => Math.max(heightAt(x, z), -0.3);
            const at = (e: Entry, water: boolean): ActBody & {aloft: boolean} => {
                const p = schedulePose(e, act.t0);
                return {x: p.x, z: p.z, base: water ? Math.min(p.y, -0.05) : p.y, yaw: p.yaw, length: e.length, height: e.drawnHeight, speed: moveSpeed(e.animal, e.length), speedStat: e.stats.speed, gait: e.sched?.profile.gait ?? null, slug: e.animal.model_slug, aloft: Boolean(p.aloft)};
            };
            const hunter = at(predator, predatorWater);
            const quarry = at(prey, preyWater);
            // (A bird on the wing is not run down on foot.)
            if (quarry.aloft && kind !== "swoop") return null;
            const e = act.encounter ?? null;
            const bodies = e ? encounterBodies(hunter, quarry, e, ground) : {predator: hunter, prey: quarry};
            const flee = preyFleeStyle({preySlug: prey.animal.model_slug, preyPlan: planOf(prey), preyWater, preyFlies: escapeFlies(prey), speedStat: prey.stats.speed});
            return {kind, flee, predator: bodies.predator, prey: bodies.prey, seed: `${act.prey}#${act.t0}`, exact: Boolean(e), ground, clear: (x, z) => world!.nav.walkable(x, z) && !world!.sampler.blocked(x, z, 0.3) && !collideBlocked(x, z, 0.3), water: (x, z) => heightAt(x, z) < -0.05};
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return {x: at.x, z: at.z, y: at.y, yaw: at.yaw, aloft: Boolean(at.aloft)};
        },
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        flies: escapeFlies,
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveMatings.pins().includes(entry.animal.id) || liveBirths.pins().includes(entry.animal.id))
    });
    escapeLimp = (id, epoch, moving, length, out) => liveEscapes.size > 0 && liveEscapes.limp(id, epoch, moving, length, out);
    /**
     * 3.3 batch (C): young carried in the mouth after a hatching of the record (`mouth-carry.ts`): a crocodilian mother
     * takes her hatchlings from the nest to the water at her jaw; a mouthbrooding fish's fry come and go at its mouth.
     */
    const mouthCarry = new MouthCarry<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        slug: (entry) => entry.animal.model_slug,
        placeAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return at.aloft ? null : {x: at.x, y: at.y, z: at.z, yaw: at.yaw};
        },
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        waterNear: (x, z) => waterEdgeNear(x, z, 40),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        length: (entry) => entry.length,
        height: (entry) => entry.drawnHeight,
        male: (entry) => {
            const sex = sexLook(entry.animal.id, entry.animal.model_slug).sex;
            return sex === "male" ? true : sex === "female" ? false : null;
        },
        alarmed: (entry) => (entry.reactive?.alarmed ?? 0) > 0.25,
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveMatings.pins().includes(entry.animal.id) || liveBirths.pins().includes(entry.animal.id))
    });
    /** The meals' traces this frame (feathers, fur, scales, pressed grass), and the pressed grass for the grass to bend. */
    let tracesNow: TraceDraw[] = [];
    /**
     * Dung (`dung.ts`, handover §5): the droppings of the land mammals near where the camera looks, each where its day
     * had it when it fell (pure in the time: the same marks for every viewer), and the pause of one whose moment has
     * just come while it stands still. Listed every 2 s; the pauses posed every frame.
     */
    const DUNG_NEAR = 90;
    const dungPlaces = new Map<string, {x: number; z: number; yaw: number; still: boolean} | null>();
    let dungListedAt = -Infinity;
    let dungMarks: TraceDraw[] = [];
    let dungPauses: Array<{entry: Entry; key: string; at: number; place: {x: number; z: number; yaw: number}}> = [];
    const dungActing = new Set<Entry>();
    let dungVisits: Array<{entry: Entry; mark: TraceDraw; key: string; fly: boolean}> = [];
    const stepDung = () => {
        if (!world || reducedMotion || !scheduleOn) {
            if (dungMarks.length) dungMarks = [];
            dungVisits = [];
            dungActing.forEach((e) => {
                if (e.act) e.act = null;
            });
            dungActing.clear();
            return;
        }
        const epoch = worldMs() / 1000;
        const now = performance.now();
        if (now - dungListedAt > 2000) {
            dungListedAt = now;
            const marks: typeof dungMarks = [];
            const pauses: typeof dungPauses = [];
            const day = ARK_DAY_MS / 1000;
            if (dungPlaces.size > 4000) dungPlaces.clear();
            for (const e of allEntries()) {
                const at = e.sched?.pose;
                if (!e.sched || !at || e.held || e.visitor) continue;
                if (Math.hypot(at.x - controls.target.x, at.z - controls.target.z) > DUNG_NEAR) continue;
                const plan = library.get(e.animal.model_slug)?.behaviour?.plan ?? null;
                if (!leavesDung(plan, e.length, Boolean(e.place.water) || atSeaOf(e) || Boolean(e.place.hamlet))) continue;
                const diet = dungDiet(e.sched.profile.diet);
                for (const drop of dungDrops(e.animal.id, diet, epoch, day)) {
                    let place = dungPlaces.get(drop.key);
                    if (place === undefined) {
                        const p = schedulePose(e, drop.at);
                        const later = schedulePose(e, drop.at + DUNG_PAUSE_SECONDS);
                        // (Not in the air, not in the water, not asleep in its den.)
                        place = p.aloft || heightAt(p.x, p.z) < 0.05 || p.doing === "sleep" ? null : {x: p.x, z: p.z, yaw: p.yaw, still: Math.hypot(later.x - p.x, later.z - p.z) < 0.3};
                        dungPlaces.set(drop.key, place);
                    }
                    if (!place) continue;
                    const age = epoch - drop.at;
                    marks.push({key: drop.key, x: place.x, y: 0, z: place.z, kind: "dung", flattened: false, size: Math.min(Math.max(e.length * 0.08, 0.05), 0.3), amount: 1, alpha: dungAlpha(age), seed: drop.key});
                    if (place.still && age < DUNG_PAUSE_SECONDS + DUNG_SNIFF_SECONDS + 2) pauses.push({entry: e, key: drop.key, at: drop.at, place});
                }
            }
            dungMarks = marks;
            dungPauses = pauses;
            // Decision 434: the dung users near the camera go to the freshest mark near them (`dung.ts` dungVisitPose),
            // a few to a mark; one with no fresh mark near stays at home (its microhabitat, the map's pat).
            const visits: typeof dungVisits = [];
            const fresh = marks.filter((m) => m.alpha >= 1);
            const crowd = new Map<string, number>();
            if (fresh.length) {
                for (const e of allEntries()) {
                    if (e.held || e.visitor || !eatsDung(e.animal.model_slug, e.animal.zone)) continue;
                    const home = e.middle ?? e.place;
                    if (Math.hypot(home.x - controls.target.x, home.z - controls.target.z) > DUNG_NEAR) continue;
                    let best: (typeof fresh)[number] | null = null;
                    let bestD = DUNG_VISIT_METRES;
                    for (const m of fresh) {
                        const d = Math.hypot(m.x - home.x, m.z - home.z);
                        if (d < bestD && (crowd.get(m.key) ?? 0) < DUNG_VISIT_CROWD) {
                            best = m;
                            bestD = d;
                        }
                    }
                    if (!best) continue;
                    crowd.set(best.key, (crowd.get(best.key) ?? 0) + 1);
                    visits.push({entry: e, mark: best, key: `${e.animal.id}|${best.key}`, fly: e.sched?.profile.move === "fly" || FLYERS.has(e.animal.model_slug) || /fly$/.test(e.animal.model_slug)});
                }
            }
            dungVisits = visits;
        }
        const acting = new Set<Entry>();
        for (const pause of dungPauses) {
            const e = pause.entry;
            if (e.moment || e.visitor || e.held || (e.act && !dungActing.has(e)) || mealPins.has(e.animal.id)) continue;
            const act = dungPose(pause.place, pause.place.yaw, Math.max(heightAt(pause.place.x, pause.place.z), 0), dungDiet(e.sched!.profile.diet), e.length, pause.key, epoch - pause.at);
            if (!act) continue;
            e.act = act;
            acting.add(e);
        }
        for (const visit of dungVisits) {
            const e = visit.entry;
            if (acting.has(e) || e.moment || e.visitor || e.held || (e.act && !dungActing.has(e)) || mealPins.has(e.animal.id)) continue;
            e.act = dungVisitPose(visit.mark, visit.key, Math.max(heightAt(visit.mark.x, visit.mark.z), 0), visit.fly, epoch);
            acting.add(e);
        }
        dungActing.forEach((e) => {
            if (!acting.has(e)) e.act = null;
        });
        dungActing.clear();
        acting.forEach((e) => dungActing.add(e));
    };
    /**
     * Dormancy (AnimalDex decision 370): the animals of the kinds the server says are dormant now are in their dens,
     * burrows or mud: held out of sight where their day has them, their cards saying sleeping, until the server says
     * the kind is awake. The record decides it (`setDormant`); with an empty list nothing here does anything.
     */
    let dormantKinds = new Set<string>();
    const dormantHeld = new Map<Entry, {x: number; z: number; yaw: number}>();
    const stepDormant = () => {
        if (!dormantKinds.size && !dormantHeld.size) return;
        const epoch = worldMs() / 1000;
        const still = new Set<Entry>();
        if (dormantKinds.size && world) {
            for (const e of allEntries()) {
                if (!dormantKinds.has(e.animal.kind_species_profile_id || e.animal.species_profile_id || "") || e.visitor || e.held || !e.sched) continue;
                if (e.act && !dormantHeld.has(e)) continue;
                let at = dormantHeld.get(e);
                if (!at) {
                    const p = schedulePose(e, epoch);
                    dormantHeld.set(e, (at = {x: p.x, z: p.z, yaw: p.yaw}));
                }
                e.act = {x: at.x, z: at.z, base: Math.max(heightAt(at.x, at.z), -0.3), yaw: at.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: true, state: "rest", speed: 0, meal: "sleeping"};
                still.add(e);
            }
        }
        dormantHeld.forEach((_, e) => {
            if (still.has(e)) return;
            if (e.act?.meal === "sleeping") e.act = null;
            dormantHeld.delete(e);
        });
    };
    const stepMealTraces = () => {
        stepDormant();
        stepDung();
        const next = (liveMeals.size ? (liveMeals.traces(worldMs() / 1000) as TraceDraw[]) : []).concat(dungMarks);
        if (!next.length && !tracesNow.length) return;
        tracesNow = next;
        mealTraces.set(next, (x, z) => Math.max(heightAt(x, z), 0));
    };
    const pressedByMeals = (from: Vector3) =>
        liveMeals
            .pressed(worldMs() / 1000)
            .filter((p) => Math.hypot(p.x - from.x, p.z - from.z) < 60)
            .map((p) => ({x: p.x, y: Math.max(heightAt(p.x, p.z), 0), z: p.z, radius: p.radius}))
            .concat(tracesNow
            .filter((t) => t.flattened && t.alpha > 0.2 && Math.hypot(t.x - from.x, t.z - from.z) < 60)
            .map((t) => ({x: t.x, y: Math.max(heightAt(t.x, t.z), 0), z: t.z, radius: t.size * 0.6 * t.alpha})));
    /**
     * The newest real hunt under way (the page's marker): a meal being acted (its chase or its feeding) first, else the
     * predator whose encounter forays began last (awake and due: the server hunts on exactly those). Once a second.
     */
    let huntAsked: {at: number; hunt: ArkLiveHunt | null} | null = null;
    const liveHuntNow = (): ArkLiveHunt | null => {
        const now = performance.now();
        if (huntAsked && now - huntAsked.at < 1000) return huntAsked.hunt;
        const epoch = worldMs() / 1000;
        const said = (id: string, phase: ArkLiveHunt["phase"], since: number): ArkLiveHunt | null => {
            const entry = entryById.get(id);
            return entry ? {id, name: entry.animal.name, slug: entry.animal.model_slug, phase, since} : null;
        };
        const meal = liveMeals.newest(epoch);
        let hunt = meal ? said(meal.predator, meal.phase, meal.t0) : null;
        if (!hunt && hunting.active) {
            let best: {id: string; since: number} | null = null;
            for (const id of hunting.predators()) {
                const entry = entryById.get(id);
                if (!entry) continue;
                const since = hunting.since(entry.animal, epoch);
                if (since !== null && (!best || since > best.since || (since === best.since && id > best.id))) best = {id, since};
            }
            hunt = best ? said(best.id, "hunting", best.since) : null;
        }
        huntAsked = {at: now, hunt};
        return hunt;
    };
    /** V1: the departed fading where they stood (`departing`); one an act has taken up (its death, its meal, a stand-in) gives way. */
    const stepDeparting = (now: number, roster: Map<string, Entry> = entryById) => {
        const epoch = worldMs() / 1000;
        departing = departing.filter((d) => {
            const id = d.ghost.animal.id;
            const k = (now - d.from - DEPART_HOLD_SECONDS) / DEPART_FADE_SECONDS;
            const taken = roster.has(id) || liveDeaths.has(id, epoch) || mealGhosts.some((g) => g !== d.ghost && g.animal.id === id);
            if (!taken && k < 1) {
                const c = Math.min(Math.max(k, 0), 1);
                const e = c * c * (3 - 2 * c);
                d.ghost.act = {...d.pose, dim: e, scale: 1 - 0.1 * e};
                return true;
            }
            mealGhosts = mealGhosts.filter((g) => g !== d.ghost);
            return false;
        });
    };
    /**
     * ARK-MATING-SHOWN (decision 416): an adult the read says is looking for a mate (E6's `animal.state`) roams and looks
     * about while its day has it about on the ground (`live-seeking.ts`). Who they are is read from the entries every
     * two seconds (the read changes every 45).
     */
    const liveSeeking = new LiveSeeking<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor && e.middle ? e : null;
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return {x: at.x, z: at.z, yaw: at.yaw, doing: at.doing, aloft: at.aloft};
        },
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        length: (entry) => entry.length,
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveMatings.pins().includes(entry.animal.id) || liveBirths.pins().includes(entry.animal.id))
    });
    /**
     * ARK-MATING-SHOWN (decision 416): the record's layings and hatchings you can see (`live-clutches.ts`): she lays
     * where she stood for the mount, the clutch stays there until it hatches, the young come out of it.
     */
    const liveClutches = new LiveClutches<Entry>({
        find: (id) => {
            const e = entryById.get(id);
            return e && !e.held && !e.visitor ? e : null;
        },
        female: (entry) => {
            const sex = sexLook(entry.animal.id, entry.animal.model_slug).sex;
            return sex === "female" ? true : sex === "male" ? false : null;
        },
        scheduleAt: (entry, epoch) => {
            if (!entry.sched || !world || reducedMotion) return null;
            const at = schedulePose(entry, epoch);
            return at.aloft ? null : {x: at.x, z: at.z, yaw: at.yaw};
        },
        placeOf: (entry) => actPlace(entry),
        ground: (x, z) => Math.max(heightAt(x, z), -0.3),
        length: (entry) => entry.length,
        walk: (entry) => Math.max(moveSpeed(entry.animal, entry.length) * 0.5, 0.3),
        spawns: (entry, p) => nestKind({plan: library.get(entry.animal.model_slug)?.behaviour?.plan, slug: entry.animal.model_slug, water: waterTopAt(p.x, p.z) > heightAt(p.x, p.z) + 0.05}) === "spawn",
        setAct: (entry, pose) => {
            entry.act = pose;
        },
        busy: (entry) => Boolean(entry.moment || entry.visitor || (replay && replayPins.has(entry.animal.id)) || liveMeals.pins().includes(entry.animal.id) || liveBirths.pins().includes(entry.animal.id) || mouthCarry.pins().includes(entry.animal.id) || duckDrops.pins().includes(entry.animal.id)),
        matingEnd: (id) => liveMatings.endOf(id),
        clutchSpot: (id) => liveMatings.clutchSpotOf(id),
        lay: (key, at, mother, eggs, ago) => {
            const water = waterTopAt(at.x, at.z) > heightAt(at.x, at.z) + 0.05;
            const kind = nestKind({plan: library.get(mother.animal.model_slug)?.behaviour?.plan, slug: mother.animal.model_slug, water});
            // (On her own floor when she has one, a tank's, a cage's, a wall's or a flower's: the eggs where she is.)
            const own = Math.abs(at.base - Math.max(heightAt(at.x, at.z), -0.3)) > 0.02;
            const y = own ? at.base : Math.max(heightAt(at.x, at.z), 0) + (kind === "spawn" ? -0.05 : 0);
            nests.lay(key, {x: at.x, y, z: at.z}, clutchSize(mother.length), kind, eggs, performance.now() / 1000 - ago);
        },
        hatch: (key, ago) => nests.hatch(key, performance.now() / 1000 - ago, HATCHLINGS_SECONDS + ArkNests.YOUNG_AFTER + 1.1),
        where: (key) => {
            const at = nests.where(key);
            return at ? {x: at.x, y: at.y, z: at.z, size: at.size} : null;
        },
        remove: (key) => nests.remove(key)
    });
    let seekingRead = -Infinity;
    const readSeeking = (epoch: number) => {
        if (epoch - seekingRead < 2 && epoch >= seekingRead) return;
        seekingRead = epoch;
        const ids: string[] = [];
        for (const e of allEntries()) if (e.animal.state?.kind === "mate_seeking" && !e.sched?.animal.young) ids.push(e.animal.id);
        if (ids.length || liveSeeking.size) liveSeeking.set(ids, epoch);
    };
    /** The live world's meals, a frame (after the replay's acts): poses, and their pins for the herds. */
    const stepLiveMeals = () => {
        if (!reducedMotion) {
            const epoch = worldMs() / 1000;
            readSeeking(epoch);
            if (liveSeeking.size) liveSeeking.step(epoch);
        }
        if (reproFx.visible && !liveMatings.size && !liveBirths.size) {
            reproFx.update([]); // REAL-REPRODUCTION
            reproNests = [];
        }
        if ((!liveMeals.size && !liveMatings.size && !liveBirths.size && !duckDrops.size && !liveEscapes.size && !mouthCarry.size && !liveClutches.size) || reducedMotion) return; // 3.3 batch (B, C, D): + duckDrops, mouthCarry, liveEscapes; ARK-MATING-SHOWN: + liveClutches
        const epoch = worldMs() / 1000;
        if (liveMeals.size) liveMeals.step(epoch, (id) => Boolean(replay && replayPins.has(id)));
        if (liveMatings.size) liveMatings.step(epoch);
        if (liveBirths.size) liveBirths.step(epoch);
        if (duckDrops.size) duckDrops.step(epoch); // 3.3 batch (B)
        if (liveEscapes.size) liveEscapes.step(epoch); // 3.3 batch (D)
        if (mouthCarry.size) mouthCarry.step(epoch); // 3.3 batch (C)
        if (liveClutches.size) liveClutches.step(epoch); // ARK-MATING-SHOWN (after the matings: her laying follows the mount)
        const reproNow = liveMatings.size || liveBirths.size ? [...liveMatings.fx(epoch), ...liveBirths.fx(epoch)] : [];
        reproFx.update(reproNow); // REAL-REPRODUCTION
        // (A clownfish pair's rock: the tank's others keep off it while they lay and he guards, as a guarding male drives
        // them off; the eggs are then in sight. `poseCore`'s tank branch reads it.)
        reproNests = reproNow.filter((e) => e.kind === "rock").map((e) => ({x: e.x, z: e.z, r: Math.max(0.45, (e.long ?? e.size) * 3), k: Math.min(e.t / 3, 1)}));
        const pins = new Set([...liveMeals.pins(), ...liveMatings.pins(), ...liveBirths.pins(), ...duckDrops.pins(), ...liveEscapes.pins(), ...mouthCarry.pins(), ...liveClutches.pins()]); // 3.3 batch (B, C, D); ARK-MATING-SHOWN
        if (pins.size !== mealPins.size || Array.from(pins).some((id) => !mealPins.has(id))) {
            mealPins = pins;
            refreshLive();
        }
    };

    /** The camera across a chase: side on, the short way round from where it looks now. */
    const sideOn = (dx: number, dz: number) => {
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const across = Math.atan2(dz, -dx);
        const options2 = [across, across + Math.PI];
        const delta = (a: number) => Math.abs(Math.atan2(Math.sin(a - spherical.theta), Math.cos(a - spherical.theta)));
        return delta(options2[0]) <= delta(options2[1]) ? options2[0] : options2[1];
    };

    /** A polar angle from which the camera sees `focus` over the hills: lower (more from above) until nothing is in the way. */
    const clearPolar = (focus: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number) => {
        for (let phi = polar; phi > 0.55; phi -= 0.12) {
            let blocked = false;
            for (let k = 0.15; k < 1 && !blocked; k += 0.1) {
                const r = distance * k;
                const x = focus.x + Math.sin(phi) * Math.sin(azimuth) * r;
                const y = focus.y + Math.cos(phi) * r;
                const z = focus.z + Math.sin(phi) * Math.cos(azimuth) * r;
                if (heightAt(x, z) > y - 0.4) blocked = true;
            }
            if (!blocked) return phi;
        }
        return 0.55;
    };

    /**
     * Where a clutch is laid: where the young will stand once they hatch
     * (when that is in the same replay), else beside the parent, a body
     * length to its side.
     */
    const nestSpot = (parent: Entry, acts: ArkAct[], index: number) => {
        const plan = library.get(parent.animal.model_slug)?.behaviour?.plan;
        const kind = nestKind({plan, slug: parent.animal.model_slug, water: inWater(parent)});
        const size = clutchSize(parent.length);
        const laid = acts[index];
        for (let i = index + 1; i < acts.length; i++) {
            const later = acts[i];
            if (later.kind !== "birth" || arkHatchNest(acts, i) !== laid) continue;
            const young = later.young.map(entryFor).find((entry): entry is Entry => Boolean(entry));
            if (young) return {x: young.place.x, y: Math.max(young.place.ground, 0) + (kind === "spawn" ? -0.05 : 0), z: young.place.z, size, kind};
        }
        const body = bodyOf(parent);
        const side = parent.phase > 0.5 ? 1 : -1;
        const x = body.x + Math.cos(body.yaw) * side * parent.length * 0.9;
        const z = body.z - Math.sin(body.yaw) * side * parent.length * 0.9;
        return {x, y: Math.max(heightAt(x, z), 0) + (kind === "spawn" ? -0.05 : 0), z, size, kind};
    };

    const beginAct = (run: Running) => {
        const act = run.acts[run.index];
        run.actingFrom = null;
        run.step = null;
        run.lastT = 0;
        run.onAct?.(run.index);
        run.release = null;
        const toFrame = (focus: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number | undefined, seconds: number, then: () => void) => {
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
            const bearing = azimuth ?? spherical.theta;
            fly(new Vector3(focus.x, focus.y, focus.z), distance, reducedMotion ? 0 : 1.2, clearPolar(focus, distance, polar, bearing), bearing, () => {
                run.seconds = seconds;
                run.actingFrom = performance.now() / 1000;
                then();
            });
        };
        if (act.kind === "laid") {
            // A clutch appears beside the parent: where its young will stand when they hatch in this replay, else at its side.
            const parent = entryFor(act.animal);
            if (!parent) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const spot = nestSpot(parent, run.acts, run.index);
            toFrame({x: spot.x, y: spot.y + 0.3, z: spot.z}, 5 + parent.length * 2.4, 1.1, undefined, LAID_SECONDS, () => {
                let laid = false;
                run.step = (_t, _last, now) => {
                    if (laid) return;
                    laid = true;
                    nests.lay(act.nest, spot, spot.size, spot.kind, act.eggs, now);
                };
            });
            return;
        }
        if (act.kind === "birth" && act.fromEgg) {
            // They hatch: from the clutch laid earlier in this replay, else from one at the young's place.
            const young = act.young.map(entryFor).filter((entry): entry is Entry => Boolean(entry));
            const first = young[0];
            if (!first) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const laid = arkHatchNest(run.acts, run.index);
            const nestId = laid?.nest ?? `hatch:${first.animal.id}`;
            const parent = act.parents.map((id) => findEntry(id)).find(Boolean) ?? null;
            const plan = library.get((parent ?? first).animal.model_slug)?.behaviour?.plan;
            const kind = nestKind({plan, slug: (parent ?? first).animal.model_slug, water: inWater(parent ?? first)});
            const at = nests.where(nestId) ?? {x: first.place.x, y: Math.max(first.place.ground, 0) + (kind === "spawn" ? -0.05 : 0), z: first.place.z, size: clutchSize((parent ?? first).length)};
            // V1 (a tapped hatching line showed a nest and no young: they were where their day had them, a roost's hole at
            // night, a branch across the wood): the young are IN THE NEST as the eggs split, each in from small, and stay in
            // it while the act lasts (`HATCHLINGS_SECONDS`, the nest with them); then each is where its day has it, as before.
            const mine = new Map<Entry, ActPose>();
            toFrame({x: at.x, y: at.y + 0.3, z: at.z}, 5 + first.length * 3, 1.1, undefined, HATCHLINGS_SECONDS + ArkNests.YOUNG_AFTER, () => {
                let hatched = false;
                run.step = (t, _last, now) => {
                    if (!hatched) {
                        hatched = true;
                        // A clutch laid before the last visit: it is there already, its eggs about to hatch.
                        if (!nests.has(nestId)) nests.lay(nestId, at, at.size, kind, young.length, now - 3);
                        nests.hatch(nestId, now, HATCHLINGS_SECONDS + ArkNests.YOUNG_AFTER + 1.1);
                    }
                    young.forEach((entry, i) => {
                        if (entry.held && t >= ArkNests.YOUNG_AFTER + i * 0.25) {
                            entry.held = false;
                            entry.air = 0;
                            entry.arrivedAt = elapsedNow();
                        }
                        // (Another layer's act, a duckling's drop or a mother's mouth, has it: left alone.)
                        if (reducedMotion || (entry.act && mine.get(entry) !== entry.act)) return;
                        const since = t - (ArkNests.YOUNG_AFTER + i * 0.25);
                        const shown = Math.min(young.length, 6);
                        const ring = shown === 1 ? 0 : Math.max(at.size * 0.3, entry.length * 0.7, (parent ?? entry).length * 0.3);
                        const bearing = (i % shown) * ((Math.PI * 2) / shown) + (hash32(nestId) % 628) / 100;
                        const x = at.x + Math.cos(bearing) * ring;
                        const z = at.z + Math.sin(bearing) * ring;
                        // (One much smaller than its parent, larger than it is for these moments, as a newborn: `newbornScale`.)
                        const pop = Math.min(Math.max(((parent ?? entry).length * 0.42) / Math.max(entry.length, 1e-4), 1), 3);
                        const pose: ActPose = {x, z, base: at.y + (kind === "nest" ? at.size * 0.06 : 0), yaw: Math.atan2(Math.cos(bearing), Math.sin(bearing)), pitch: 0, roll: since > 0 ? Math.sin(since * 2.3 + i) * 0.06 : 0, scale: newbornScale(pop, since), dim: 0, hidden: since < 0 || i >= 6, state: "rest", speed: 0, meal: "resting"};
                        mine.set(entry, pose);
                        entry.act = pose;
                    });
                };
            });
            run.release = () => {
                for (const entry of young) if (entry.act && mine.get(entry) === entry.act) entry.act = null;
            };
            return;
        }
        if (act.kind === "arrival" || act.kind === "birth") {
            const arrivals = (act.kind === "arrival" ? [act.animal] : act.young).map(entryFor).filter((entry): entry is Entry => Boolean(entry));
            const first = arrivals[0];
            if (!first) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const parent = act.kind === "birth" ? act.parents.map((id) => findEntry(id)).find(Boolean) ?? null : null;
            const focus = parent ?? first;
            toFrame({x: (first.place.x + focus.place.x) / 2, y: Math.max(first.place.ground, 0) + 0.5, z: (first.place.z + focus.place.z) / 2}, 8 + first.length * 3.2, 1.12, undefined, act.kind === "arrival" ? ARRIVAL_SECONDS : BIRTH_SECONDS, () => {
                run.step = (t) => {
                    arrivals.forEach((entry, i) => {
                        if (entry.held && t >= 0.15 + i * 0.35) {
                            entry.held = false;
                            // A flyer comes aboard on the ground, then takes to the air.
                            entry.air = 0;
                            entry.arrivedAt = elapsedNow();
                        }
                    });
                };
            });
            return;
        }
        if (act.kind === "death") {
            const entry = entryFor(act.animal);
            if (!entry) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const body = bodyOf(entry);
            entry.act = deathPose(body, 0);
            toFrame({x: body.x, y: Math.max(body.base, 0) + body.height * 0.4, z: body.z}, 7 + body.length * 3, 1.15, undefined, DEATH_SECONDS, () => {
                run.step = (t) => {
                    entry.act = deathPose(body, t);
                };
            });
            return;
        }
        if (act.kind === "extinction") {
            run.seconds = EXTINCTION_SECONDS;
            run.actingFrom = performance.now() / 1000;
            return;
        }
        // A meal.
        const predator = entryFor(act.predator);
        const prey = entryFor(act.prey);
        if (!predator || !prey) {
            run.seconds = 0.4;
            run.actingFrom = performance.now() / 1000;
            return;
        }
        // The chase (L7, `acts.ts`) from the server's encounter, then the meal by rule (`meals.ts`, `meal-acts.ts`): in a
        // replay a summary of it (a few feeding bouts, a whole swallow); if the live world is still acting it, the
        // carcass stays for it to carry on.
        const built = buildMealStage(act, predator, prey);
        const kind = built.kind;
        const bodies = built.bodies;
        let stage: MealStage = built.stage;
        if (built.script) {
            const live = liveMeals.under(act.predator.id, act.prey.id, worldMs() / 1000);
            const swallow = built.script.plan.style === "swallow";
            const show = swallow ? Math.min(built.script.plan.feedSeconds, 10) + built.script.carry + 0.8 : built.script.carry + 8 + (live ? 0 : 2.6);
            const summary = swallow && built.script.plan.feedSeconds > 10 ? mealScript({...built.script.plan, feedSeconds: 10}, built.script.c) : built.script;
            stage = mealOnStage(stage, summary, show, live ? Infinity : show - 2.6);
        }
        const partnered = (pose: ActPose | null, id: string, role: ActPose["role"]): ActPose | null => (pose ? {...pose, with: id, role} : null);
        // Both hold where they are while the camera comes.
        prey.act = partnered(stage.prey(0), predator.animal.id, "quarry");
        if (kind !== "cutaway") predator.act = partnered(stage.predator(0), prey.animal.id, "hunter");
        const dx = bodies.prey.x - bodies.predator.x;
        const dz = bodies.prey.z - bodies.predator.z;
        // (Side on, round to the nearest bearing with no tree between the camera and the chase: `clearBearing`.)
        const azimuth = kind === "cutaway" ? undefined : clearBearing(stage.focus, stage.distance, stage.polar, sideOn(dx, dz), (x, z, clearance) => Boolean(world?.sampler.blocked(x, z, clearance)), undefined, stage.places);
        toFrame(stage.focus, stage.distance, stage.polar, azimuth, stage.seconds, () => {
            let turned = false;
            run.step = (t, last, now) => {
                prey.act = partnered(stage.prey(t), predator.animal.id, "quarry");
                if (kind !== "cutaway") predator.act = partnered(stage.predator(t), prey.animal.id, "hunter");
                for (const puff of stage.puffs(last, t)) dust.add(puff, now);
                if (stage.turnAt !== undefined && t >= stage.turnAt && !turned) {
                    // The cut-away: the camera turns aside, out to the sea's horizon, while it happens.
                    turned = true;
                    const out = Math.hypot(stage.focus.x, stage.focus.z) > 1 ? Math.atan2(stage.focus.x, stage.focus.z) : 0;
                    const target = new Vector3(stage.focus.x + Math.sin(out) * 26, 1.5, stage.focus.z + Math.cos(out) * 26);
                    // From behind the prey's spot, looking out: the camera's bearing is the way back toward the island.
                    fly(target, 30, reducedMotion ? 0 : 1.3, 1.34, out + Math.PI);
                }
            };
        });
    };

    /** The Ark as it is now: everyone in place, the stand-ins gone; the view goes back unless a touch took it. */
    const finishReplay = (skipped: boolean, touched = false) => {
        const run = replay;
        if (!run) return;
        replay = null;
        for (const entry of entries) {
            if (entry.held) {
                entry.held = false;
                entry.arrivedAt = skipped ? null : entry.arrivedAt;
            }
            entry.act = null;
        }
        ghosts = [];
        dust.clear();
        recipeScene.clear();
        nests.clear();
        flight = null;
        if (replayPins.size) {
            replayPins = new Set();
            refreshLive();
        }
        if (!touched) fly(run.home.target, run.home.distance, 1.6, run.home.polar, run.home.azimuth);
        run.resolve();
    };

    /** A meal's two models, loaded (or not to be had): the chase depends on the eater's body plan and both sizes. */
    const modelsReady = (act: ArkAct) => act.kind !== "meal" || [act.predator.model_slug, act.prey.model_slug].every((slug) => !library.has(slug) || Boolean(library.get(slug)));

    const stepReplay = (now: number) => {
        const run = replay;
        if (!run || opening) return;
        if (!run.begun) {
            run.waitFrom ??= now;
            if (!modelsReady(run.acts[run.index]) && now - run.waitFrom < 4) return;
            run.waitFrom = null;
            run.begun = true;
            beginAct(run);
        }
        if (run.actingFrom === null) return;
        const t = now - run.actingFrom;
        run.step?.(t, run.lastT, now);
        run.lastT = t;
        if (t >= run.seconds) {
            // The act's end: whoever moved goes back to its own place (the camera is moving on).
            run.release?.();
            run.release = null;
            const act = run.acts[run.index];
            if (act.kind === "meal") {
                const predator = entryFor(act.predator);
                if (predator) predator.act = null;
            }
            run.after.forEach((index, entry) => {
                if (index !== run.index || !entry.held) return;
                entry.held = false;
                entry.arrivedAt = elapsedNow();
            });
            run.index++;
            // The next act begins (once its models are in) on a later frame.
            if (run.index >= run.acts.length) finishReplay(false);
            else run.begun = false;
        }
    };

    /** A replay's stand-ins for the animals gone now, with the server's record of each (play, and prepareReplay). */
    const ghostAnimalsOf = (acts: ArkAct[]): ArkAnimal[] => {
        // Who is gone now (eaten, or died): standing in where they were until their act.
        const gone = new Map<string, ArkEventAnimal>();
        for (const act of acts) {
            const named = act.kind === "meal" ? [act.predator, act.prey] : act.kind === "death" ? [act.animal] : [];
            for (const animal of named) if (!aboard.has(animal.id)) gone.set(animal.id, animal);
        }
        // The server's own record of each (its place included), so it stands where it stood.
        return Array.from(gone.values()).map((animal) => ({
            id: animal.id,
            species_profile_id: animal.species_profile_id,
            name: animal.name,
            scientific_name: null,
            model_slug: animal.model_slug,
            zone: animal.zone,
            arrived_at: animal.arrived_at ?? "",
            brought_by: {label: "", named: false},
            mine: false,
            origin: animal.origin ?? undefined,
            generation: animal.generation ?? undefined,
            slot: animal.slot,
            slot_rank: animal.slot_rank,
            sociality: animal.sociality,
            activity: animal.activity
        }));
    };
    const play = (acts: ArkAct[], callbacks?: {onAct?: (index: number) => void}): ArkReplayRun => {
        if (replay) finishReplay(true);
        if (!acts.length) return {skip: () => undefined, done: Promise.resolve()};
        // Everyone the acts name is drawn one by one while it plays, a herd's members too (A14).
        replayPins = new Set(acts.flatMap((act) => (act.kind === "meal" ? [act.predator.id, act.prey.id] : act.kind === "birth" ? act.young.map((a) => a.id) : act.kind === "extinction" ? [] : [act.animal.id])));
        refreshLive();
        // Who arrived or was born since: held back until their act.
        for (const act of acts) {
            const ids = act.kind === "arrival" ? [act.animal.id] : act.kind === "birth" ? act.young.map((a) => a.id) : [];
            for (const id of ids) {
                const entry = entryById.get(id);
                if (entry) entry.held = true;
            }
        }
        // Who is gone now (eaten, or died): standing in where they were until their act (`ghostAnimalsOf`).
        const ghostAnimals = ghostAnimalsOf(acts);
        const places = ghostAnimals.length ? placeAll(ghostAnimals, true) : new Map<string, Placement>();
        ghosts = ghostAnimals.map((animal) => Object.assign(newEntry(animal, places.get(animal.id)!, null), {ghost: true}));
        const after = new Map<Entry, number>();
        for (const ghost of ghosts) {
            ghost.leader = null;
            // One that came aboard since and is gone already: held back until its own arrival.
            ghost.held = acts.some((act) => (act.kind === "arrival" && act.animal.id === ghost.animal.id) || (act.kind === "birth" && act.young.some((a) => a.id === ghost.animal.id)));
            // Its place was given again since (only the living hold one): the newcomer waits until it is gone.
            const end = acts.findIndex((act) => (act.kind === "meal" && act.prey.id === ghost.animal.id) || (act.kind === "death" && act.animal.id === ghost.animal.id));
            if (end < 0) continue;
            for (const entry of entries) {
                if (entry.held || entry.animal.zone !== ghost.animal.zone || Math.hypot(entry.place.x - ghost.place.x, entry.place.z - ghost.place.z) > 0.05) continue;
                entry.held = true;
                after.set(entry, end);
            }
        }
        applyHours();
        // Their models, near and far.
        const slugs = new Set(acts.flatMap((act) => (act.kind === "meal" ? [act.predator.model_slug, act.prey.model_slug] : act.kind === "death" || act.kind === "arrival" || act.kind === "laid" ? [act.animal.model_slug] : act.kind === "birth" ? act.young.map((a) => a.model_slug) : [])));
        library.ready().then(() => {
            slugs.forEach((slug) => {
                if (!library.has(slug)) return;
                library.request(slug, "far");
                library.request(slug, "near");
                tokens.ensure(slug);
            });
        });
        controls.autoRotate = false;
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const view = opening ? homeView() : null;
        let resolve = () => undefined as void;
        const done = new Promise<void>((r) => {
            resolve = r;
        });
        replay = {
            acts,
            index: 0,
            begun: false,
            waitFrom: null,
            actingFrom: null,
            seconds: 0,
            lastT: 0,
            step: null,
            onAct: callbacks?.onAct,
            resolve,
            after,
            home: view ? {target: view.target, distance: view.distance, polar: view.polar, azimuth: view.azimuth} : {target: controls.target.clone(), distance: spherical.radius, polar: spherical.phi, azimuth: spherical.theta}
        };
        return {skip: () => finishReplay(true), done};
    };

    // MARK: Loop

    const frameTimes: number[] = [];
    const frameIntervals: number[] = [];
    let lastDrawn = 0;
    /**
     * Mobile performance lane: a new read whose wild animals changed is placed in the places worker first (as the mount's
     * and a replay's are: `prepareGhostPlaces`, primed for exactly that list), then laid out; meanwhile the world goes
     * on as it was. A newer read arriving meanwhile replaces it. A recording, or no worker, lays it out at once as before.
     */
    let readPending: ArkSnapshot | null = null;
    let readPlacing = false;
    let afterRead: Array<() => void> = [];
    const layRead = (snapshot: ArkSnapshot) => {
        // Runtime: the entrances play at the full frame rate.
        runtime.busyFor(ENTRANCE_SECONDS + 1);
        setSnapshot(snapshot, true);
        const calls = afterRead;
        afterRead = [];
        for (const call of calls) call();
    };
    const placeRead = () => {
        const snapshot = readPending;
        if (!snapshot || disposed) return;
        const wild = options.recording || typeof Worker === "undefined" ? null : wildToPlace(snapshot);
        if (!wild || !wild.length) {
            readPending = null;
            layRead(snapshot);
            return;
        }
        readPlacing = true;
        void prepareReadPlaces(wild).then(() => {
            readPlacing = false;
            if (disposed) return;
            // (A newer read came meanwhile: that one, placed in turn.)
            if (readPending !== snapshot) {
                placeRead();
                return;
            }
            readPending = null;
            layRead(snapshot);
        });
    };
    let ready = false;
    let raf = 0;
    let lastTracked: Vector3 | null = null;
    const followAim = new Vector3();
    /**
     * Mobile performance lane: on a touch device the sun's shadow map is drawn again every other frame while its box
     * stands still (the view drifting or turning round what it looks at), and every frame whenever the box moves (a pan,
     * a zoom, the sun's hour), so no shadow ever swims; elsewhere every frame as before. The shadow pass is a second draw
     * of everything that casts one: on the medium tier about a quarter of the frame's draw calls.
     */
    const shadowKey = new Float64Array(4).fill(Number.NaN);
    let shadowFrames = 0;
    const stepShadowMap = () => {
        if (!pacer) return;
        const map = renderer.shadowMap;
        if (!map.enabled) {
            map.autoUpdate = true;
            return;
        }
        map.autoUpdate = false;
        const sun = lighting.sun;
        const box = sun.shadow.camera.right;
        const moved = sun.position.x !== shadowKey[0] || sun.position.y !== shadowKey[1] || sun.position.z !== shadowKey[2] || box !== shadowKey[3] || !sun.shadow.map;
        shadowFrames++;
        if (moved || shadowFrames % 2 === 0) {
            map.needsUpdate = true;
            shadowKey[0] = sun.position.x;
            shadowKey[1] = sun.position.y;
            shadowKey[2] = sun.position.z;
            shadowKey[3] = box;
        }
    };
    /** The tier check: frames over two seconds once the models are in; a tier lower if they run long. */
    let measureFrom = 0;
    let measureArmed = false;
    /** When the first frame was drawn (s), and whether the start is over (the pacing may drop a tier only then). */
    let readyAt = 0;
    let settledYet = false;
    let settledAskedAt = 0;
    const paceSettled = (nowS: number) => {
        if (settledYet) return true;
        if (nowS - settledAskedAt < 1) return false;
        settledAskedAt = nowS;
        // The behaviour world built (the town's too) and spaced, and the first view's models in (or 20 s on).
        settledYet = Boolean(world) && !townBuild && !spacing && (nowS - readyAt > 20 || runtime.handle.runtime().viewComplete);
        return settledYet;
    };
    const measured: number[] = [];

    const frame = (stamp?: number) => {
        if (disposed) return;
        // Runtime: hidden, the loop stops until visible again (onWake); idle-capped or warming shaders, this display frame is skipped.
        // (The animation frame's own time: the runtime reads the display's refresh rate off it.)
        const step = runtime.frame(performance.now(), stamp);
        if (step === "sleep") {
            raf = 0;
            return;
        }
        raf = requestAnimationFrame(frame);
        if (step === "skip" || !onScreen || document.hidden) return;
        const startedAt = performance.now();
        perf.begin(startedAt);
        const frameDt = lastDrawn ? Math.min((startedAt - lastDrawn) / 1000, 0.1) : 1 / 60;
        runtime.activity(Boolean(flight || followId || replay || opening || talking.target?.active || lastTracked), reducedMotion);
        const now = startedAt / 1000;
        const elapsed = (startedAt - started) / 1000;
        // The behaviour schedule's world, a slice a frame until it is built.
        // (A reader sent to an animal not drawable yet, the view standing still: longer slices, `ARRIVAL_BUILD_SLICE_MS`.)
        const awaited = Boolean(arriving) && arriving!.seen === null && !flight && pointers === 0 && !options.recording;
        const buildSlice = awaited ? ARRIVAL_BUILD_SLICE_MS : BUILD_SLICE_MS;
        stepWorldBuild(buildSlice, awaited);
        if (world) stepSpacing(buildSlice);
        // Reduced motion: the water, the grass and the animals hold still (A18).
        if (!reducedMotion) {
            // The shared clock (shared-clock.ts): every viewer's water, wind, sway and idles in the same phase.
            ARK_TIME.value = runtime.shaderTime();
            ARK_CLOCK.value = runtime.animalClock();
        }
        applyEnvironment();
        if (landscape) landscape.water.position.y = ARK_ENVIRONMENT.seaLevel.value;
        perf.lap("world");
        // Part C: the other island's people implied, its clocks and its zoo's day, on the world's clock.
        // (A pinned hour, `?hour=` or `setHours`, pins the town's day too: its windows, bins and the zoo's feeding.)
        // Decision 153: the town shown a few chunks a frame as it joins.
        if (townRevealing && island) {
            townRevealing = island.stepReveal(3);
            if (!townRevealing && townJoin) townJoin();
        }
        if (island && trafficHooked !== island) {
            island.setTrafficAnimals?.(trafficAnimals);
            trafficHooked = island;
        }
        island?.update(pinnedHours === null ? worldMs() : worldMs() + (pinnedHours - islandHours(worldMs(), ISLAND_OFFSET_HOURS)) * 3_600_000);
        // p5 (humans): the town's people on their day (none drawn without humans aboard or the town).
        if (island && (townHumans.count || carersOn)) {
            const islandMs = pinnedHours === null ? worldMs() : worldMs() + (pinnedHours - islandHours(worldMs(), ISLAND_OFFSET_HOURS)) * 3_600_000;
            const traffic = island.movingCars?.();
            townHumans.setArkDay(arkDayNow(current, worldMs())); // p5 (humans, couples): a child's age
            syncHumanRooms(island); // humans visible
            const people = townHumans.frame(islandMs, traffic?.cars ?? null, traffic?.count ?? 0);
            const carers = stepCarers(island, hoursNow()); // decision 418: the carers at work now
            humanFigures.setFrame(carers.length ? [...people, ...carers] : people, camera.position, islandMs / 1000);
            humanTVs.setFrame(townHumans.tvs, islandMs / 1000); // humans visible
            sleepCovers.setFrame(townHumans.covers, camera.position); // humans polish
            stepPendingHuman(); // humans visible
            beachProps.setFrame(townHumans.beach); // p5 (humans, quality pass)
            stepDogWalks(now); // p5 (humans, dogs)
        } else if (humanFigures.drawn.near + humanFigures.drawn.far + humanFigures.drawn.dots + sleepCovers.drawn) {
            humanFigures.setFrame([], camera.position, 0);
            humanTVs.setFrame([], 0); // humans visible
            sleepCovers.setFrame([], camera.position); // humans polish
            beachProps.setFrame([]); // p5 (humans, quality pass)
        }
        perf.lap("town");
        stepArrival(now);
        stepFlight(now);
        stepClearView(now);
        stepInset();
        stepIslandNear();
        // 3.3 fix: the kept town animals around the look point out to move (`near-kept.ts`).
        stepNearKept(now);
        // Idle: after a while untouched, the view drifts slowly round.
        if (!reducedMotion && !options.recording && !flight && !selectedId && !followId && !opening && !replay && now - lastTouch > IDLE_DRIFT_AFTER) {
            if (!controls.autoRotate) driftFrom = now;
            controls.autoRotate = true;
        }
        // P6 (docs/ark/wild-island.md): on the bigger wild island with the town in the world (or coming: the view is the
        // two-island view from the first frame), the drift sways about where the view was (± the frame's driftSway rad)
        // instead of going round, so the town across the strait stays in the picture.
        const sway = controls.autoRotate && (island || options.wildAnimals) ? wildFrame().driftSway : null;
        if (sway) controls.autoRotateSpeed = DRIFT_SPEED * Math.cos((now - driftFrom) * ((DRIFT_SPEED * Math.PI) / 30 / sway));
        runtime.controls(frameDt);
        controls.update();
        keepInWorld();
        fitCloseUp();
        if (!options.recording) runtime.collide(controls.target, frameDt, controls.minDistance < 1);
        perf.lap("camera");
        // Part B: which chunks are drawn from here, the edge haze, the memory check; the ground's hidden tiles let go.
        streamer.update(camera.position, camera.position.distanceTo(controls.target), FOV, width / Math.max(height, 1), now, controls.target);
        landscape?.tiles.release(now, controls.target);
        streamCull.step(now);
        perf.lap("stream");
        stepLayers(elapsed);
        oceanTraffic?.step(reducedMotion ? 0 : clockNow(), true); // p2 (ocean)
        foldTrees(elapsed);
        micro?.step(camera.position);
        for (const sceneModule of modules) sceneModule.step(elapsed, camera, controls.target);
        stepTalking(elapsed);
        // The hour: read again every minute (who is asleep, the props' lights). The light itself every five seconds: at
        // dawn and dusk a minute's step showed (the sun climbs a quarter of a degree a minute, the picture's brightness a
        // seventieth of its range), and `lighting.step` eases the photographed sky in when it arrives.
        if (now - lastClock > (clockScale > 1 ? 0.25 : 60) && !replay) {
            lastClock = now;
            lastLight = now;
            setLight();
        } else if (now - lastLight > 5 && !replay) {
            lastLight = now;
            lighting.setHours(hoursNow(), fog);
            micro?.setNight(lighting.daylight.night);
        }
        lighting.step(now);
        stepReplay(now);
        stepLiveMeals();
        if (liveDeaths.size && !reducedMotion) liveDeaths.step(worldMs() / 1000); // 3.3 fix (log): the record's dead, lying where they died
        if (departing.length) stepDeparting(performance.now() / 1000); // V1: the departed, fading
        stepMealTraces();
        // Runtime: the resting rotation moved on (every 5 minutes on the shared clock): who is outside, again.
        perf.lap("scenery");
        if (!replay && runtime.rotationDue(liteOn())) setSnapshot(current, true);
        else prewarmResting();
        perf.lap("resting");
        updateInstances(elapsed);
        dust.step(now);
        liveliness.step(elapsed, worldMs(), camera, controls.target, scene.fog === fog ? fog : null, lighting.horizon, width, height, hoursNow(), () => (world ? entries.filter((e) => Boolean(e.sched)) : []), routeOf);
        perf.lap("particles");
        // p3 (shake): on the clock its particles are born on (`updateInstances(elapsed)`); the page's clock made every one
        // older than its life at birth, so no splash, dust or drop was ever drawn.
        recipeScene.step(elapsed);
        stepLiveClutch(now); // 3.3 fix (breeding taps)
        nests.step(now);
        perf.lap("recipes");
        // Following: the camera keeps the animal in the middle of the view, at the height it is (a flyer in the air).
        const followed = followId ? findEntry(followId) : null;
        if (followed?.middle && !flight && pointers === 0) {
            // Runtime: per second, a little ahead by its speed (no lag), the same at 30, 60 or 120 fps.
            const {x: dx, y: dy, z: dz} = runtime.follow(controls.target, followAim.set(followed.middle.x, followed.middle.y - followed.drawnHeight * 0.1, followed.middle.z), reducedMotion ? 0 : frameDt);
            controls.target.x += dx;
            controls.target.y += dy;
            controls.target.z += dz;
            camera.position.x += dx;
            camera.position.y += dy;
            camera.position.z += dz;
        }
        // 3.3 fix (mating tap): a pair framed together: the view's middle and distance ease to the two as they move.
        const pairNow = selectedId && !followed && !flight && pointers === 0 ? pairAim(selectedId) : null;
        if (pairNow) {
            const dx = easeToward(controls.target.x, pairNow.at.x, frameDt) - controls.target.x;
            const dy = easeToward(controls.target.y, pairNow.at.y, frameDt) - controls.target.y;
            const dz = easeToward(controls.target.z, pairNow.at.z, frameDt) - controls.target.z;
            controls.target.x += dx;
            controls.target.y += dy;
            controls.target.z += dz;
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target).add(followAim.set(dx, dy, dz)));
            spherical.radius = easeToward(spherical.radius, pairNow.distance, frameDt, 1.5);
            camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
            lastTracked = null;
        }
        // Otherwise a selected animal that moves (a swimmer's loop) is kept in view.
        const tracked = selectedId && !followed && !pairNow ? findEntry(selectedId)?.middle : null;
        if (tracked && !flight && pointers === 0) {
            if (lastTracked) {
                const dx = tracked.x - lastTracked.x;
                const dz = tracked.z - lastTracked.z;
                if (Math.abs(dx) + Math.abs(dz) < 2) {
                    controls.target.x += dx;
                    controls.target.z += dz;
                    camera.position.x += dx;
                    camera.position.z += dz;
                    // A small animal crawls up and down its wall or trunk, a flyer climbs and comes down: kept in view.
                    const dy = tracked.y - lastTracked.y;
                    const trackedEntry = findEntry(selectedId);
                    // (And one above its ground, on a roof or a floor, or under the sea: its height is the view's too.)
                    const offGround = Boolean(trackedEntry && (tracked.y < -0.3 || tracked.y - trackedEntry.drawnHeight / 2 > heightAt(tracked.x, tracked.z) + 0.3));
                    if ((trackedEntry?.micro || offGround || (trackedEntry && trackedEntry.air > 0.001)) && Math.abs(dy) < 1) {
                        controls.target.y += dy;
                        camera.position.y += dy;
                    }
                }
            }
            lastTracked = (lastTracked ?? new Vector3()).copy(tracked);
        } else {
            lastTracked = null;
        }
        perf.lap("camera");
        const viewDistance = camera.position.distanceTo(controls.target);
        nearDetail?.update(controls.target, viewDistance);
        bugGround.update(controls.target, viewDistance); // p2 (ground)
        climbStems.update(camera.position); // p3 (trees)
        spiderWebs?.update(camera.position, hoursNow(), worldMs() / 1000, {width: renderer.domElement.width, height: renderer.domElement.height, pixelRatio: renderer.getPixelRatio()}, reducedMotion); // ARK-WEBS
        forest.step(arkDayNow(current, worldMs())); // p5 (humans): before the trees' re-sort
        forest.draw(camera.position, worldMs() / 1000); // p5 (humans): the crews
        assetTrees?.update(camera.position);
        assetRocks?.update(camera.position);
        assetFloor?.update(camera.position);
        if (assetRocks?.ready && !assetRocksShown) {
            assetRocksShown = true;
            vegetation?.hideKinds(new Set(["rock"]));
        }
        vegetation?.update(camera);
        if (assetTrees?.ready && !assetTreesShown) {
            assetTreesShown = true;
            vegetation?.hideKinds(ASSET_TREE_KINDS);
        }
        lighting.fitShadow(controls.target, viewDistance);
        stepShadowMap();
        // The miniature's soft top and bottom, gentler on a tall phone screen where it covers more of the picture.
        post.setTiltShift(Math.min(Math.max((viewDistance - 110) / 260, 0), width < height ? 0.18 : 0.3));
        perf.lap("plants");
        renderer.info.reset();
        if (canvasStale) sizeCanvas();
        post.render();
        drawnOnce = true;
        perf.lap("render");
        placeLabels();
        placeVisitorLabel();
        placeBadges();
        perf.lap("labels");
        // Decision 240: the selected animal's status (about once a second) and its bars over it (every frame).
        tellStatus(startedAt);
        perf.lap("status");
        placeSelectionBars();
        perf.lap("labels");
        runtime.drawnFrame(startedAt, inset);
        perf.lap("runtime");

        const spent = performance.now() - startedAt;
        perf.end(spent);
        frameTimes.push(spent);
        if (frameTimes.length > 60) frameTimes.shift();
        if (lastDrawn) {
            const interval = startedAt - lastDrawn;
            // Long gaps (a tab in the background, a stall) stay out of the stats, but the tier check counts slow frames
            // too: a device drawing at 5 fps must still drop to the low tier (only gaps over 2 s, a hidden page, are skipped).
            if (interval < 250) {
                frameIntervals.push(interval);
                if (frameIntervals.length > 60) frameIntervals.shift();
            }
            if (pacer && Math.abs(pacer.scaleTop - scaleTop()) > 0.006) {
                // (Battery saver or heat came or went, the lighter view was asked for: a scale over the top comes down now.)
                pacer.setTop(scaleTop(), startedAt / 1000);
                if (pacer.resolution !== resolutionScale) {
                    resolutionScale = pacer.resolution;
                    resize();
                }
            }
            if (interval < 2000 && pacer) {
                // A touch device: the pacing (runtime/pace.ts) instead of the tier check. A tier pinned for measuring
                // (`__arkQuality`) is never dropped; the start (the world being built, the first models) never judged for a drop.
                const decision = pacer.step(startedAt / 1000, interval, spent, runtime.drawsFull(), !forced && paceSettled(startedAt / 1000));
                if (decision.changed) {
                    runtime.setPaceCap(decision.interval);
                    if (decision.scale !== resolutionScale) {
                        // (The canvas takes the new scale when the next frame is drawn, never after this one: `sizeCanvas`.)
                        resolutionScale = decision.scale;
                        resize();
                    }
                    if (decision.dropTier && !forced && tier !== "low") {
                        // (A tier on trial that the frames did not hold: the low tier from the start next time, `runtime/trial.ts`.)
                        tierTrialFailed("pace");
                        applyTier(lowerTier(tier));
                    }
                }
            } else if (pacer) {
                // (Back from a pause, the panel covered or the page hidden: the pacing starts its measuring over.)
                pacer.resume(startedAt / 1000);
            } else if (interval < 2000) {
                // (A desktop: the tier check waits for the start to be over, as the phones' pacing does, then draws at the
                // full rate for the few seconds it measures. Judged 1.5 s after the first frame, with the behaviour
                // world's build slices and the first models' hand-over in every frame, a desktop that holds 60 on the
                // high tier lost it every time: high → medium 3.5 s after the first frame, measured.)
                if (!measureArmed && !options.recording && paceSettled(startedAt / 1000)) {
                    measureArmed = true;
                    measureFrom = performance.now() + 1500;
                    runtime.busyFor(4);
                }
                if (!forced && tier !== "low" && measureFrom && startedAt > measureFrom && runtime.uncapped()) {
                    measured.push(interval);
                    if (startedAt - measureFrom > 2000) {
                        const sorted = [...measured].sort((a, b) => a - b);
                        const typical = sorted[Math.floor(sorted.length * 0.5)];
                        measured.length = 0;
                        if (typical > 21) {
                            applyTier(lowerTier(tier));
                            measureFrom = performance.now() + 600;
                        } else {
                            measureFrom = 0;
                        }
                    }
                }
            }
        }
        if (memoryDropAsked) {
            memoryDropAsked = false;
            if (!forced && tier !== "low") {
                tierTrialFailed("memory");
                applyTier(lowerTier(tier));
            }
        }
        lastDrawn = startedAt;
        if (!ready) {
            ready = true;
            readyAt = startedAt / 1000;
            // (A recording is judged from its first frames, as it was; a live desktop once the start is over.)
            if (options.recording) {
                measureArmed = true;
                measureFrom = performance.now() + 1500;
            }
            // (The low tier starts at a steady 30 on a touch device.)
            if (pacer) runtime.setPaceCap(pacer.interval);
            options.onReady?.();
        }
    };
    runtime.onWake = () => {
        if (!raf && !disposed) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    perf.attach(el, () => ({
        gpu: {calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length ?? 0, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries},
        tier,
        dpr: renderer.getPixelRatio(),
        scale: resolutionScale,
        // (A touch device: its main thread's benchmark, `pace.ts` arkCpuScore, and the tier's trial, `runtime/trial.ts`.)
        device: pacer ? `bench ${(arkCpuScoreMs() ?? 0).toFixed(1)} ms${tierTrialState() ? `  ${tierTrialState()}` : ""}` : null,
        drawn: counts.near + counts.far + counts.token,
        rigged: counts.rigged,
        mode: runtime.handle.runtime().mode,
        inView: Boolean(world) && runtime.handle.runtime().viewComplete
    }));

    const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
    if (typeof window !== "undefined") (window as unknown as {__arkTier?: () => QualityTier}).__arkTier = () => tier;
    if (process.env.NODE_ENV !== "production") (window as unknown as {__arkDebug?: unknown}).__arkDebug = {camera, controls, scene, library, rigs, liveliness, visitor: () => visitor, talking, lighting, entries: () => allEntries(), meals: () => liveMeals.debug(), matings: () => liveMatings.debug(), births: () => liveBirths.debug(), catWalls: () => catWalls /* gfx (fauna) */, hatchings: () => mouthCarry.debug(), escapes: () => liveEscapes.debug(), traces: () => tracesNow, reactive: () => ({stats: reactive.stats, ms: reactiveMs, tier: reactiveTierNow}), collisions: () => ({ms: collisions.spentMs, pushed: collisions.pushed, eased: collisions.eased, clusters: collisions.clusters}),
        grounding: () => groundingCheck.report(), groundingReset: () => groundingCheck.reset(),
        clearView: () => ({...clearStats, rays: sight.tests, gathered: sight.gathered}),
        // (Lane TB: the resting kept town animals: each member's place and whether it is drawn this frame.)
        resting: () => restingGroups.flatMap((group) => Array.from(group.members, (member, i) => {
            const k = group.order.indexOf(i);
            return {id: member.id, slug: group.slug, x: member.x, z: member.z, ground: member.ground, length: group.length, drawn: k >= (group.hidden ?? 0) && k < (group.hidden ?? 0) + group.figures + group.specks, figure: k >= 0 && k < group.figures, waiting: k >= 0 && k < (group.hidden ?? 0)};
        })),
        pinShared: (id: string, fn: ((epoch: number) => Partial<TripPose & {doing: ArkDoing}>) | null) => (fn ? sharedPins.set(id, fn) : sharedPins.delete(id)),
        forceLook: (id: string, look: [number, number, number] | null) => (look ? forcedLooks.set(id, look) : forcedLooks.delete(id)),
        // 3.3 batch (A): an animal's defence move now (the harness).
        defence: (id: string) => findEntry(id)?.defence ?? null,
        // 3.3 fix (log): the record's deaths, where each lies (the harness).
        deaths: () => liveDeaths.debug(),
        forest: () => forest.debug(), // p5 (humans)
        carers: () => carerOut.map((h) => ({carer: h.carer, kind: h.kind, pose: h.pose, x: h.x, y: h.y, z: h.z, yaw: h.yaw})), // decision 418
        people: () => ({rigged: humanFigures.rigged, drawn: {...humanFigures.drawn}, out: townHumans.out.map((h) => ({id: h.id, what: h.what, pose: h.pose, x: h.x, y: h.y, z: h.z, yaw: h.yaw, face: h.face}))}), // p6 (people)
        dogWalks: () => ({walked: townHumans.dogs.map((d) => ({id: d.id, walker: d.walker, x: d.x, y: d.y, z: d.z, yaw: d.yaw, sniffing: d.sniffing})), pins: walkPins.slice(), live: Array.from(dogActs.keys()), pairs: dogWalks.pairing.walkerOf.size, home: dogWalks.pairing.home.length}), // p5 (humans, dogs)
        rigState: (id: string) => {
            const e = allEntries().find((x) => x.animal.id === id);
            return e ? {rigOn: Boolean(e.rigOn), weight: e.rig?.weight ?? 0, clip: e.rig?.now?.name ?? null, level: e.level ?? null} : null;
        },
        setHome: (id: string, x: number, z: number) => {
            const entry = findEntry(id);
            if (!entry?.sched) return false;
            const ground = heightAt(x, z);
            entry.place.x = x;
            entry.place.z = z;
            entry.place.ground = ground;
            entry.sched.animal.home = {x, y: ground, z};
            entry.sched.trip = null;
            entry.sched.lead = null;
            entry.sched.pose = null;
            return true;
        }, replaying: () => Boolean(replay), following: () => followId, occlusion: () => {
        const looked = selectedId ? findEntry(selectedId) : null;
        return looked?.middle ? blockers(camera.position.clone(), looked.middle, 0.35).map((hit) => ({kind: hit.mesh.userData.kind, distance: hit.distance})) : null;
    }};
    // 3.3 fix (breeding taps): the clutch a laid line's tap drew, for the harness
    if (process.env.NODE_ENV !== "production") Object.assign((window as unknown as {__arkDebug: object}).__arkDebug, {liveClutch: () => liveClutch && {...liveClutch, at: nests.where(liveClutch.key)}});
    // 3.3 batch (B): the birds' own moves, for the harness
    if (process.env.NODE_ENV !== "production") Object.assign((window as unknown as {__arkDebug: object}).__arkDebug, {deepWater: (x: number, z: number) => waterTopAt(x, z) - heightAt(x, z) > DEEP_WATER, mobbing: () => mobbing.debug(), mobStart: (bird: string, threat: string) => { const b = entryById.get(bird); const t = entryById.get(threat); return Boolean(b && t && mobbing.begin(worldMs() / 1000, b, t, allEntries().filter((e) => e !== b && e !== t), new Set(), 1e9)); }, seenNow: () => seenActs.slice(), lures: () => brokenWing.debug(), drops: () => duckDrops.debug(), lureStart: (bird: string, threat: string) => { const b = entryById.get(bird); const t = entryById.get(threat); return Boolean(b && t && brokenWing.begin(worldMs() / 1000, b, t)); }});
    // p3 (shake): the harness's question: when an animal next climbs out of the water (its trips' arrivals after an exit leg).
    // p4 (zoolive): the resting figures and the near-kept pins, for the zoo probes.
    if (process.env.NODE_ENV !== "production") Object.assign((window as unknown as {__arkDebug: object}).__arkDebug, {resting: () => restingGroups, nearKept: () => nearKept.slice()});
    // Development (ARK-CONTACT's contact probe): the drawn surfaces straight under where an animal is drawn (its base by
    // its level, `entry.drawn`), top down: what it stands on and how far its base is over (or under) each. Animals,
    // marks and the water's surface are left out.
    if (process.env.NODE_ENV !== "production") {
        const probe = new Raycaster();
        const down = new Vector3(0, -1, 0);
        const from = new Vector3();
        const marks = new Set<Object3D>([shadows.mesh, rings.mesh, tokens.mesh, dots.mesh]);
        Object.assign((window as unknown as {__arkDebug: object}).__arkDebug, {
            under: (id: string, normal?: {x: number; y: number; z: number}, point?: {x: number; y: number; z: number}) => {
                const found = (entryById.get(id) as {drawn?: {x: number; y: number; z: number; level: string}} | undefined)?.drawn;
                if (!found) return null;
                const drawn = point ? {...found, x: point.x, y: point.y, z: point.z} : found;
                const n = normal ? new Vector3(normal.x, normal.y, normal.z).normalize() : new Vector3(0, 1, 0);
                probe.set(from.set(drawn.x, drawn.y, drawn.z).addScaledVector(n, 3), down.copy(n).negate());
                probe.near = 0;
                probe.far = 8;
                const hits = [];
                for (const hit of probe.intersectObjects(scene.children, true)) {
                    const object = hit.object as Mesh;
                    if (marks.has(object) || object.geometry?.getAttribute?.("arkInstance") || object.geometry?.getAttribute?.("arkRigA") || !object.visible) continue;
                    const kind = String(object.userData?.kind ?? object.name ?? object.type);
                    if (/water|sea|ocean|sky|rain|fog|cloud|mist|bug-ground/i.test(kind)) continue;
                    hits.push({gap: Math.round((3 - hit.distance) * 1000) / 1000, kind, instance: hit.instanceId ?? null});
                    if (hits.length >= 6) break;
                }
                // (The town's ground is not drawn as a mesh a ray meets: its drawn height, on its own island, straight down.)
                const ground = standGround(drawn.x, drawn.z, drawn.y);
                return {drawn: {...drawn}, hits, drawnGround: Math.round((ground - drawn.y) * 1000) / 1000};
            },
            // ARK-CONTACT round 3: everything a ray down at a spot meets (no filtering), to name what a probe misses.
            rayAll: (x: number, z: number, top = 40) => {
                probe.set(from.set(x, top, z), down.set(0, -1, 0));
                probe.near = 0;
                probe.far = top + 60;
                return probe.intersectObjects(scene.children, true).slice(0, 12).map((hit) => ({y: Math.round(hit.point.y * 1000) / 1000, name: hit.object.name, type: hit.object.type, kind: String(hit.object.userData?.kind ?? ""), parent: hit.object.parent?.name ?? "", visible: hit.object.visible, instanced: Boolean((hit.object as Mesh).geometry?.getAttribute?.("arkInstance"))}));
            },
            // ARK-CONTACT round 3: its leg tips this frame (the playing clip's frame skinned on the CPU, by the instance's
            // matrix), each one's gap over what is drawn under it along the body's up (negative: in the air).
            // ARK-CONTACT (the shield bugs in a rock): every small animal (to `maxLength` m) inside a drawn rock, by where it
            // was last drawn (`drawn`) or, never drawn, where its schedule has it (`posed`).
            insideRocks: (maxLength = 0.15) => {
                const out: Array<{id: string; slug: string; depth: number; from: string; x: number; y: number; z: number; micro: string | null}> = [];
                let checked = 0;
                for (const e of allEntries()) {
                    if (e.length > maxLength || e.place.water) continue;
                    const d = (e as {drawn?: {x: number; y: number; z: number; level: string}}).drawn;
                    const p = e.sched?.pose;
                    // (Never drawn nor posed here: its home place, on its microhabitat's surface or its ground.)
                    const at = d && d.level ? {x: d.x, y: d.y, z: d.z, from: "drawn"} : p && !p.aloft ? {x: p.x, y: p.y, z: p.z, from: "posed"} : e.place && !e.place.canopy && !e.place.burrow ? {x: e.place.x, y: e.place.ground, z: e.place.z, from: "home"} : null;
                    if (!at) continue;
                    checked++;
                    // (Its middle, half its height up: a body skimming a rock's face is not in it.)
                    const depth = assetRocks?.insideRock(at.x, at.y + Math.max(e.length * 0.25, 0.01), at.z) ?? 0;
                    if (depth > 0.005) out.push({id: e.animal.id, slug: e.animal.model_slug, depth: Math.round(depth * 1000) / 1000, from: at.from, x: at.x, y: at.y, z: at.z, micro: (e.place.micro as {attach?: {tag?: string}} | null | undefined)?.attach?.tag ?? null});
                }
                return {checked, inside: out.length, rows: out.sort((a, b) => b.depth - a.depth).slice(0, 60)};
            },
            eaveAt: (x: number, y: number, z: number) => {
                const at = island?.drawnEave?.(x, y, z) ?? null;
                return at ? {building: `${at.x.toFixed(1)},${at.z.toFixed(1)}`, x: at.x, y: at.y, z: at.z} : null;
            },
            rockDepth: (x: number, y: number, z: number) => assetRocks?.insideRock(x, y, z) ?? 0,
            planOf: (slug: string) => library.get(slug)?.behaviour?.plan ?? null,
            // ARK-CONTACT (the langur in the trunk): every animal up off the ground whose body is in a tree's trunk (its middle
            // closer to the axis than the trunk's radius and half its length), where it was last drawn or else posed.
            limbClear: (id: string, length: number) => {
                const point = attachPoint(id);
                const set = world ? sceneColliders(world, townWorld) : null;
                const trunk = point && set ? trunksAt(point, length / 2, set)[0] ?? null : null;
                const off = limbClearOf(id, length, renderer.info.render.frame, true);
                return {point: point && {position: point.position, normal: point.normal, forward: point.forward ?? null, radius: point.radius ?? null, size: point.size}, trunk, axis: point && trunk ? Math.hypot(point.position.x - trunk.cx, point.position.z - trunk.cz) : null, off: off ?? null};
            },
            inTrunks: () => {
                // Every animal held at a tree's point, wherever it is on either island (its shared spot: drawn or not):
                // its body in a trunk at the point (before), and where the scene draws it (after: `limbClearOf`).
                const set = world ? sceneColliders(world, townWorld) : null;
                if (!set) return null;
                const inTrunk = (point: AttachPoint, dx: number, dz: number, half: number) => {
                    for (const c of trunksAt(point, half, set)) {
                        const by = c.r + half - Math.hypot(point.position.x + dx - c.cx, point.position.z + dz - c.cz);
                        if (by > 0.02) return {by: Math.round(by * 100) / 100, trunk: c.id};
                    }
                    return null;
                };
                let checked = 0;
                let seated = 0;
                let unseated = 0;
                const before: Array<{id: string; slug: string; point: string; by: number; trunk: string}> = [];
                const after: typeof before = [];
                for (const e of allEntries()) {
                    const id = e.sched?.trip?.to.point;
                    const point = id ? attachPoint(id) : null;
                    if (!id || !point || !TREE_HELD.has(point.tag) || point.normal.y < 0.5 || e.sched?.pose?.aloft) continue;
                    if (Math.hypot((e.sched?.pose?.x ?? 1e9) - point.position.x, (e.sched?.pose?.z ?? 1e9) - point.position.z) > 0.4) continue;
                    checked++;
                    const was = inTrunk(point, 0, 0, e.length / 2);
                    if (was) before.push({id: e.animal.id, slug: e.animal.model_slug, point: id, ...was});
                    const off = (globalThis as {__arkLimbFixOff?: boolean}).__arkLimbFixOff ? null : limbClearOf(id, e.length, renderer.info.render.frame, true);
                    if (off) {
                        if (off.seated) seated++;
                        else unseated++;
                    }
                    const now = inTrunk(point, off?.x ?? 0, off?.z ?? 0, e.length / 2);
                    if (now) after.push({id: e.animal.id, slug: e.animal.model_slug, point: id, ...now});
                }
                const top = (rows: typeof before) => rows.sort((a, b) => b.by - a.by).slice(0, 30);
                const primates = allEntries().filter((e) => /langur|monkey|macaque|lemur|gibbon|colobus|capuchin|tamarin|marmoset|orangutan|baboon|chimp/.test(e.animal.model_slug) && (e.sched?.trip?.to.point ?? "").startsWith("limb:")).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, point: e.sched!.trip!.to.point, moving: Boolean(e.sched?.pose?.moving)}));
                return {primates, checked, before: before.length, after: after.length, moved: seated + unseated, seated, unseated, beforeRows: top(before), afterRows: top(after)};
            },
            // ARK-CONTACT: the clips a species' loaded rig has (the rules' pick: `rigClip`).
            rigClips: (slug: string) => Object.keys(rigs.get(slug)?.clips ?? {}),
            tips: (id: string, count = 8) => {
                const entry = entryById.get(id);
                const drawn = (entry as {drawn?: {m?: number[]}} | undefined)?.drawn;
                const rig = entry ? rigs.get(entry.animal.model_slug) : null;
                const state = entry?.rig;
                if (!entry || !drawn?.m || !rig || !state) return null;
                const clip = rig.clips[state.now.name];
                if (!clip) return null;
                const [r0] = clipRows(clip, state.now.phase);
                const m = new Matrix4().fromArray(drawn.m);
                const up = new Vector3().setFromMatrixColumn(m, 1).normalize();
                const position = rig.geometry.getAttribute("position");
                const joints = rig.geometry.getAttribute("arkJoints");
                const weights = rig.geometry.getAttribute("arkWeights");
                const d = rig.data;
                const out: Array<{x: number; y: number; z: number; along: number}> = [];
                const p = new Vector3();
                for (let v = 0; v < position.count; v++) {
                    const x = position.getX(v), y = position.getY(v), z = position.getZ(v);
                    let sx = 0, sy = 0, sz = 0;
                    for (let k = 0; k < 4; k++) {
                        const w = weights.getComponent(v, k);
                        if (w <= 0) continue;
                        const o = r0 * rig.bones * 12 + joints.getComponent(v, k) * 12;
                        const h = (i: number) => halfToFloat(d[o + i]);
                        sx += w * (h(0) * x + h(1) * y + h(2) * z + h(3));
                        sy += w * (h(4) * x + h(5) * y + h(6) * z + h(7));
                        sz += w * (h(8) * x + h(9) * y + h(10) * z + h(11));
                    }
                    p.set(sx, sy, sz).applyMatrix4(m);
                    out.push({x: p.x, y: p.y, z: p.z, along: p.dot(up)});
                }
                out.sort((a, b) => a.along - b.along);
                // The lowest, a few centimetres apart at the least (one per tip, not one tip's vertices).
                const spread = (entry.length || 0.1) * 0.12;
                const picked: typeof out = [];
                for (const t of out) {
                    if (picked.length >= count) break;
                    if (picked.every((q) => Math.hypot(q.x - t.x, q.y - t.y, q.z - t.z) > spread)) picked.push(t);
                }
                const result = picked.map((t) => {
                    probe.set(from.set(t.x, t.y, t.z).addScaledVector(up, 1), down.copy(up).negate());
                    probe.near = 0;
                    probe.far = 3;
                    for (const hit of probe.intersectObjects(scene.children, true)) {
                        const object = hit.object as Mesh;
                        if (marks.has(object) || object.geometry?.getAttribute?.("arkInstance") || object.geometry?.getAttribute?.("arkRigA") || !object.visible) continue;
                        const kind = String(object.userData?.kind ?? object.name ?? object.type);
                        if (/water|sea|ocean|sky|rain|fog|cloud|mist|bug-ground/i.test(kind)) continue;
                        return {gap: Math.round((1 - hit.distance) * 1000) / 1000, kind};
                    }
                    return {gap: Math.round((standGround(t.x, t.z, t.y) - t.y) * 1000) / 1000, kind: "drawn-ground"};
                });
                return {clip: state.now.name, up: {x: up.x, y: up.y, z: up.z}, tips: result};
            }
        });
    }
    if (process.env.NODE_ENV !== "production") Object.assign((window as unknown as {__arkDebug: object}).__arkDebug, {waterOuts: (id: string, from: number, slots: number) => { const e = entryById.get(id); const own = e?.sched; if (!e || !own) return []; const out: Array<{arrive: number; x: number; z: number}> = []; let previous: Trip | null = null; for (let k = 0; k < slots && out.length < 6; k++) { const trip: Trip = tripAt(worldOf(own.animal), own.profile, own.animal, from + k * SLOT_SECONDS + 1, scheduleHours, e.animal.activity, previous); previous = trip; const at = shakeStartOf(trip); if (at !== null) out.push({arrive: at, x: trip.to.x, z: trip.to.z}); } return out; }});

    return {
        ...runtime.handle,
        update: whenAnimals((snapshot: ArkSnapshot) => {
            // Mobile performance lane: a read that changes nothing laid out (the apps read every 45 s) is not laid out again.
            if (sameArkRead(readPending ?? current, snapshot)) return;
            readPending = snapshot;
            if (!readPlacing) placeRead();
        }),
        setMineOnly: (value) => {
            mineOnly = value;
        },
        select: whenAnimals((id: string | null, closeUp?: boolean) => {
            pairFramed = null; // 3.3 fix (mating tap): a plain selection frames the one
            // (An animal a read just brought aboard, while that read is being placed: selected once it is laid out.)
            if (id && readPlacing && !aboard.has(id)) {
                afterRead.push(() => arrive(id, Boolean(closeUp)));
                return;
            }
            arrive(id, Boolean(closeUp));
        }),
        // 3.3 fix (mating tap): the first of a pair chosen, both framed while their mating is acted.
        selectPair: whenAnimals((a: string, b: string, kin?: boolean) => {
            pairFramed = {a, b, kin: Boolean(kin)};
            arrive(a, false);
        }),
        // 3.3 fix (breeding taps): what is selected and followed, for the log's wait on a young not aboard yet.
        selection: () => ({selected: selectedId, followed: followId}),
        // 3.3 fix (breeding taps): a laid line's clutch beside the mother (`stepLiveClutch`).
        showClutch: (key, parents, eggs) => {
            if (reducedMotion || !parents.length) return;
            if (liveClutch && liveClutch.key !== key && !liveClutches.keeps(liveClutch.key)) nests.remove(liveClutch.key);
            if (liveClutch?.key === key) return;
            liveClutch = {key, parents, eggs, mother: null, until: performance.now() / 1000 + CLUTCH_SHOWN_SECONDS, spot: null, framed: false};
        },
        // (Before the animals are in, a herd is not known yet: false, as for any unknown key.)
        selectHerd: (key) => (animalsIn ? selectHerd(key, true) : false),
        setLite: (lite) => {
            liteChoice = lite;
            const want: QualityTier = lite === true ? "low" : lite === false && tier === "low" ? (forced ?? (autoTier === "low" ? "medium" : autoTier)) : lite === null ? (forced ?? autoTier) : tier;
            if (want !== tier) applyTier(want);
            else options.onTier?.(tier, liteOn());
            liveliness.setTier(tier, liteOn());
            motes.points.visible = !reducedMotion && !liteOn();
            // Fewer (or more) of each herd drawn one by one.
            if (herds.length) setSnapshot(current, false);
        },
        setProps: (on) => {
            for (const sceneModule of modules) sceneModule.setEnabled(on);
        },
        setReducedMotion: (reduced) => {
            if (reduced === reducedMotion) return;
            reducedMotion = reduced;
            selectionBars?.setReducedMotion(reduced);
            liveliness.setReducedMotion(reduced);
            for (const sceneModule of modules) sceneModule.setReducedMotion(reduced);
            motes.points.visible = !reducedMotion && !liteOn();
            if (reduced) {
                flight = null;
                controls.autoRotate = false;
                if (replay) finishReplay(true, true);
                applyHours();
            }
        },
        follow: whenAnimals((id: string | null) => follow(id)),
        setClockScale: (scale, atMs) => {
            // Development: the world's time runs `scale` times faster from now, or from `atMs` (a day-night recording); 1 is the clock again.
            const now = typeof atMs === "number" && Number.isFinite(atMs) ? atMs : worldMs();
            clockAnchor = now;
            clockAnchorReal = Date.now();
            clockScale = Math.max(Number.isFinite(scale) ? scale : 1, 1);
            if (clockScale === 1 && atMs === undefined) clockAnchor = clockAnchorReal = Date.now();
            setLight();
        },
        setHours: (hours) => {
            pinnedHours = typeof hours === "number" && Number.isFinite(hours) ? hours : null;
            setLight();
        },
        setHunting: (read) => {
            // Encounter hunting: the server's read, or null (off: everyone on their schedules, exactly as before).
            if (!read || read.hunting !== "encounter") {
                hunting.set(null, null, null);
                return;
            }
            void loadPositionsAtlas()
                .then((atlas) => {
                    if (!disposed) hunting.set(read, atlas, voyageStart);
                })
                .catch(() => hunting.set(null, null, null));
        },
        setMeals: (meals) => {
            liveMeals.set(meals.filter((meal) => meal.kind === "meal"));
            if (!liveMeals.size && mealPins.size) {
                mealPins = new Set();
                refreshLive();
            }
        },
        // V1: meals from the event log as it is read (added; the hunting read's set comes later and does not double them).
        addMeals: (meals) => liveMeals.add(meals.filter((meal) => meal.kind === "meal"), worldMs() / 1000),
        // V1 hook (E5, not sent yet): who the server says is wounded limps (`live-escapes.ts` setWounded).
        setWounded: (list) => liveEscapes.setWounded(list),
        addMatings: (matings) => {
            liveMatings.add(matings, worldMs() / 1000);
        },
        // 3.3 fix (log): the record's deaths, and a death line's tap: the camera to where it died (its body there a while).
        addDeaths: (deaths) => liveDeaths.add(deaths),
        focusDeath: (key) => {
            const spot = liveDeaths.spot(key);
            const death = liveDeaths.record(key);
            if (!spot || !death) return false;
            select(null, false);
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const length = deathEntryOf(death)?.length ?? 1;
            fly(new Vector3(spot.x, spot.base, spot.z), Math.min(Math.max(length * 7, 4), 40), 1.6);
            return true;
        },
        addBirths: (births) => {
            liveBirths.add(births, worldMs() / 1000);
            // 3.3 batch (C): the young of the record's births follow (and suckle from) their recorded mother from now on.
            if (births.map((b) => lineage.note(b.young, b.parents)).some(Boolean)) liveliness.lineageChanged();
        },
        // 3.3 batch (C): the record's hatchings: a mouth-carrying species acts it (`mouth-carry.ts`); the lineage as for a birth.
        addLayings: (layings) => {
            liveClutches.most = tier === "low" ? 10 : 24;
            liveClutches.addLaid(layings);
        },
        addHatchings: (hatchings) => {
            // ARK-MATING-SHOWN: the young come out of their clutch, held as a birth is (`live-clutches.ts`).
            liveClutches.addHatched(hatchings.map((h) => ({key: h.key, parents: h.parents, young: h.young, t0: h.held ?? h.t0})));
            mouthCarry.add(hatchings, worldMs() / 1000);
            duckDrops.add(hatchings, worldMs() / 1000); // 3.3 batch (B): ducklings dropping from the tree hole
            if (hatchings.map((b) => lineage.note(b.young, b.parents)).some(Boolean)) liveliness.lineageChanged();
        },
        // 3.3 batch (D): the record's escapes, on the encounter's step where the server gives it.
        addEscapes: (escapes) => {
            liveEscapes.add(escapes.map((e) => {
                const encounter = mealEncounter({encounter: e.encounter});
                // (V1: the feeder's time is the act's start, held until the record is out; never before the encounter's step.)
                return {key: e.key, prey: e.prey, predator: e.predator, t0: Math.max(encounter?.t ?? -Infinity, e.t0), encounter};
            }), worldMs() / 1000);
        },
        setForestry: (record) => forest.setRecord(record), // p5 (humans)
        setCarers: (record) => {
            carersOn = record !== null || (globalThis as {__arkCarers?: boolean}).__arkCarers === true; // decision 418
        },
        carersOn: () => carersOn,
        // Vegetation (decision 417 (1)): the grass thins where it is overgrazed; nothing changes while it is off.
        setVegetation: (raw, words) => {
            grazing = decodeVegetation(raw);
            grassWords = words ?? null;
            vegetation?.setGrazed(grazing);
            // (And the sward at bug scale round the point looked at: `bug-ground.ts`.)
            const levels = grazing?.levels;
            setBugGrazing(levels ? (zone) => levels.get(`wild|${zone}`) ?? 1 : null);
        },
        grassAt: (zone, island) => {
            const level = grazing?.levels.get(`${island === "town" ? "town" : "wild"}|${zone}`);
            return level === undefined ? null : (grassWords?.[grassKey(level)] ?? null);
        },
        setHumanBonds: (raw) => townHumans.setBonds(decodeHumanBonds(raw)), // p5 (humans, couples)
        setDormant: (kinds) => {
            dormantKinds = new Set(kinds);
        },
        liveHunt: () => liveHuntNow(),
        setSound: (on) => liveliness.setSound(on),
        sound: () => ({on: liveliness.audio.playing, unlocked: liveliness.audio.unlocked, credits: liveliness.audio.credits()}),
        setSoundVolume: (volume) => liveliness.audio.setVolume(volume),
        setEnvironment: (environment) => {
            pinnedEnvironment = environment;
            applyEnvironment(true);
        },
        setAnimalLook: (on, pin) => {
            look.setEnabled(on);
            if (pin && "islandMs" in pin) look.pinIsland(pin.islandMs ?? null);
            shadows.setContact(on);
            shadows.setStrength(look.contactStrength(TIER_SETTINGS[tier].shadows > 0));
        },
        play,
        // V2 replay: every act of the live layers let go (their animals their own again, the stand-ins dropped, whoever a
        // stand-in hid shown again): before a replay and after it. The live page's log feeds the layers again as it reads.
        clearLiveActs: () => {
            liveMeals.clear();
            liveMatings.clear();
            liveBirths.clear();
            liveSeeking.clear();
            liveClutches.clear();
            liveEscapes.clear();
            liveDeaths.clear();
            for (const entry of entries) if (cast?.pins.has(entry.animal.id)) entry.held = false;
            if (mealPins.size) {
                mealPins = new Set();
                refreshLive();
            }
        },
        // V2 replay: the live layers' acts under way and their times (what `__arkDebug` shows in development), for a shot's cuts.
        liveActs: () => {
            const clutches = liveClutches.debug();
            return {meals: liveMeals.debug(), matings: liveMatings.debug(), births: liveBirths.debug(), escapes: liveEscapes.debug(), deaths: liveDeaths.debug(), clutches: {layings: clutches.layings, kept: clutches.kept.map((key) => ({key, at: nests.where(key)}))}};
        },
        // V2 replay: the recorder's exposure (1: as the Ark is; more for a night's act, a camera's own choice: nothing of the
        // world, its hour or its animals changes).
        setExposure: (gain, fill = 1) => {
            renderer.toneMappingExposure = 0.66 * Math.min(Math.max(Number.isFinite(gain) ? gain : 1, 0.25), 8);
            // (And the recorder's fill: more of the sky's own light, in the night's own colours, `lighting.ts` lift.)
            const lift = Math.min(Math.max(Number.isFinite(fill) ? fill : 1, 1), 12);
            if (Math.abs(lift - lighting.lift) > 0.01) {
                lighting.lift = lift;
                setLight();
            }
        },
        // V2 replay: how many of these points (the cast's bodies) a view of `target` cannot see: the ground, then what is
        // drawn solid (`runtime/sight.ts`, as a chosen animal's close-up asks it), leaving out what a shot's cone
        // dissolves (`near-fade.ts`: the trees and the leaf cards). One more than the points: the eye is no place to
        // stand (under the ground, inside a trunk, a rock or a wall). `fresh`: the world may have changed (a cut).
        sightOf: (target, view, points, fresh, cut = 0, leaves = false) => {
            if (!castSight) {
                castSight = new Sight(scene);
                castSight.skip = (mesh) => mesh.userData.kind === "asset-tree" || Boolean(((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined)?.userData.arkNearFade);
                castLeaves = new Sight(scene);
            }
            if (fresh) {
                castSight.reset();
                castLeaves!.reset();
            }
            const lines = leaves ? castLeaves! : castSight;
            const at = sightPoint.set(target.x, target.y, target.z).clone();
            sightEye.setFromSphericalCoords(view.distance, view.polar, view.azimuth).add(at);
            // (Over the ground as it is drawn, where that lies under the analytic one: a lake's bed.)
            if (Math.min(heightAt(sightEye.x, sightEye.z), standGround(sightEye.x, sightEye.z)) > sightEye.y - Math.min(0.2, view.distance * 0.2) || runtime.eyeBlocked(sightEye, at)) return points.length + 1;
            lines.near(at, view.distance + 4);
            let blocked = 0;
            castSightLast = "";
            for (const point of points) {
                sightPoint.set(point.x, point.y, point.z);
                // (From within a metre no hill stands between: the heights asked are the analytic ground's, not the drawn bed's.)
                if (view.distance > 1 && runtime.sightBlocked(sightEye, sightPoint, point.slack)) {
                    blocked++;
                    castSightLast ||= "ground";
                    continue;
                }
                // (What the shot's near cut takes away is not in the way: the line begins where the picture does.)
                const span = sightEye.distanceTo(sightPoint);
                const from = cut > 0 && cut < span - point.slack ? sightFrom.copy(sightPoint).sub(sightEye).multiplyScalar(cut / span).add(sightEye) : sightEye;
                // (A leaf counts nearer the body than a wall does: the bush an animal stands in hides it.)
                if (lines.blocked(from, sightPoint, leaves ? point.slack * 0.6 : point.slack)) {
                    blocked++;
                    castSightLast ||= lines.last || "a wall";
                }
            }
            return blocked;
        },
        sightMet: () => castSightLast,
        // V2 replay: the camera's near plane out to `metres` from it (a cutaway: the roof, the fern or the bush in the
        // first part of the way to a shot's subject is not drawn), or null: the scene's own again.
        setNearCut: (metres, closest = null) => {
            nearCut = metres !== null && metres > 0 ? metres : null;
            shotClosest = closest !== null && closest > 0 ? closest : null;
        },
        // V2 replay: the trees and leaf cards dissolve inside a cone round the view's axis, as far as `end` metres from
        // the camera (`near-fade.ts`); null: the Ark's own near fade only. (On the handle so that nothing a shot loads
        // lazily imports a module of the scene's own chunk.)
        setNearCone: (cone) => setNearCone(cone),
        // V2 replay: the ground's standing plants drawn smaller round these spots, to nothing at them (`near-detail.ts`).
        setGroundClear: (spots) => nearDetail?.setClear(spots),
        // V2 replay: the scene is flying its own camera (a replay's flight to its act): a shot leaves the view alone until it lands.
        flying: () => Boolean(flight),
        // V2 replay: the view an act is clear from, as the scene's own replay finds it: the polar that sees the focus over
        // the hills (`clearPolar`), then the bearing nearest `azimuth` with the fewest trunks between the camera and the
        // places (`clearBearing`: the bearing itself when nothing is in the way).
        clearView: (focus, distance, polar, azimuth, places) => {
            const phi = clearPolar(focus, distance, polar, azimuth);
            return {polar: phi, azimuth: clearBearing(focus, distance, phi, azimuth, (x, z, clearance) => Boolean((townWorld && island?.contains(x, z) ? townWorld : world)?.sampler.blocked(x, z, clearance)), undefined, places)};
        },
        // V2 replay (`replay/cast.ts`): the cast handed in (or taken away, null); the roster is laid out again with it.
        setCast: whenAnimals((layer: ArkCastLayer | null) => {
            cast = layer;
            setSnapshot(current, false);
        }),
        // Runtime (the visual CI): drop what earlier real-time frames carried, so a frame drawn at the frozen clock is a
        // function of that time only: the reactive layer, rig blends, glances, the gait, and how far each animal is into
        // lying down or up (its eased shares are set straight to where its schedule has it on the next frame, as on load).
        // The gait's speed is eased over the frames and a walker is drawn near, on its rig, only while it is over a fifth
        // of its length a second (`gaitMoving`): the jump from where an elephant stood on the real clock to where its
        // schedule has it at the frozen time counted as a step, and what was left of it after 60 frames (about 1 m/s)
        // put it on its rig in one run and left it a far model standing in the next.
        resetTransients: () => {
            reactive.resetAll();
            for (const entry of allEntries()) {
                entry.reactive = null;
                entry.rig = null;
                entry.glance = 0;
                entry.gait = null;
                entry.sleepNow = null;
                entry.sleepStarted = false;
                entry.stirShare = undefined;
            }
            snapEased = true;
        },
        // Runtime: a replay's departed animals placed in the places worker ahead of play (the map's sampler stays off
        // the main thread); play then finds them placed.
        prepareReplay: (acts: ArkAct[]) => {
            const ghosts = ghostAnimalsOf(acts);
            return ghosts.length ? prepareGhostPlaces(ghosts).then(() => undefined) : Promise.resolve();
        },
        setVisitor,
        setTalking,
        talkText: (chunk) => {
            if (!talking.target) return;
            talking.mouth.feed(chunk, performance.now() / 1000 - started / 1000);
        },
        talkPulse: (level) => {
            talking.pulse = Math.min(Math.max(level, 0), 1);
            talking.pulseAt = performance.now() / 1000;
            talking.lastActive = talking.pulseAt;
        },
        setViewInset: (bottomPixels, topPixels = 0) => {
            const before = insetCovered;
            // (With a top given, room for the selected animal's bars box over its head counts as covered too: the animal
            // is framed below it, the box clear of the page's chips.)
            const top = topPixels === undefined ? 0 : Math.max(0, Math.min(topPixels + SELECTION_BARS_ROOM, height * 0.6));
            insetBottom = Math.max(0, Math.min(bottomPixels, height * 0.7));
            // (Framing whole above the card only for a page that says what covers the top too: the apps' embed.)
            insetCovered = topPixels === undefined ? 0 : Math.min(insetBottom + top, height * 0.88);
            insetTarget = Math.max(0, Math.min(insetBottom - top, height * 0.6));
            if (insetCovered > before + 1) refitAboveCard();
        },
        view: (): ArkCameraView => {
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
            return {target: {x: controls.target.x, y: controls.target.y, z: controls.target.z}, distance: spherical.radius, polar: spherical.phi, azimuth: spherical.theta};
        },
        homeView: (): ArkCameraView => {
            const view = homeView();
            return {target: {x: view.target.x, y: view.target.y, z: view.target.z}, distance: view.distance, polar: view.polar, azimuth: view.azimuth};
        },
        setView: (view) => {
            // Exactly this view, now: any flight (a replay's way home) is dropped.
            flight = null;
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            spherical.set(Math.min(Math.max(view.distance, controls.minDistance), maxDistance), view.polar, view.azimuth);
            controls.target.set(view.target.x, view.target.y, view.target.z);
            camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
            controls.update();
        },
        locate: (id) => {
            // (A stand-in being acted first: an eaten prey's, a dead one's body, while the one in the roster is held back.)
            const entry = (mealGhosts.length ? mealGhosts.find((ghost) => ghost.animal.id === id && !ghost.held) : null) ?? findEntry(id);
            if (!entry) return null;
            const ground = Math.max(entry.place.ground, 0);
            // p2 (ocean): one out in the open ocean not drawn yet is where its loop has it now, not at its old place.
            const sea = !entry.middle && entry.depth && oceanRoams(entry) ? oceanFix(entry.animal, entry.length, clockNow()) : null;
            if (sea) return {x: sea.x, y: ARK_ENVIRONMENT.seaLevel.value - 4, z: sea.z, ground: 0, length: entry.length, height: entry.drawnHeight, awake: entry.awake, yaw: sea.yaw};
            // (Out of the picture, it is not drawn: where its act poses it, else where its day last had it, else its place.)
            const posed = entry.act && !entry.act.hidden ? {x: entry.act.x, y: entry.act.base, z: entry.act.z} : entry.sched?.pose ?? null;
            const middle = entry.middle ?? (posed ? new Vector3(posed.x, posed.y + entry.drawnHeight * 0.5, posed.z) : new Vector3(entry.place.x, ground + entry.drawnHeight * 0.5, entry.place.z));
            // (V2 replay: how far under the water its middle is, where it swims: a shot films it from under the surface.)
            const top = waterTopAt(middle.x, middle.z);
            const under = heightAt(middle.x, middle.z) < top - 0.15 ? Math.max(top - middle.y, 0) : 0;
            return {x: middle.x, y: middle.y, z: middle.z, ground, length: entry.length, height: entry.ghost ? Math.min(entry.drawnHeight, entry.length * 0.6) : entry.drawnHeight, awake: entry.awake, yaw: entry.yawNow ?? 0, act: entry.act?.state ?? null, shown: Boolean(entry.middle) && !entry.held && !entry.act?.hidden, under};
        },
        relationView: () => ({layer: labelLayer, width, height, inset: insetTarget}),
        screenOf: (x, y, z, out) => {
            relationPoint.set(x, y, z).project(camera);
            out.front = relationPoint.z < 1;
            out.x = ((relationPoint.x + 1) / 2) * width;
            out.y = ((1 - relationPoint.y) / 2) * height;
            return out;
        },
        eggSites: () => (options.props === false ? [] : nestSites().filter((site) => (site.eggs ?? 0) > 0).map((site) => ({key: site.siteId, speciesId: site.speciesId, x: site.position.x, y: site.position.y, z: site.position.z, sitter: site.sitter}))),
        lifeOf: (id) => {
            const entry = findEntry(id);
            if (!entry) return null;
            const stage = liveliness.ageOf(entry)?.stage ?? "adult";
            return {adult: stage === "adult" || stage === "old", sex: sexLook(entry.animal.id, entry.animal.model_slug).sex};
        },
        sexOf: (id) => {
            const entry = findEntry(id);
            const sex = entry ? sexLook(entry.animal.id, entry.animal.model_slug).sex : null;
            return sex === "male" || sex === "female" ? sex : null;
        },
        behaviour: (id) => findEntry(id)?.state ?? null,
        rest: (id) => {
            const entry = findEntry(id);
            return entry ? restOf(entry) : null;
        },
        animalStatus: (id) => {
            const entry = findEntry(id);
            if (!entry) return null;
            if (selectedStatus?.id === id && (statusPending || performance.now() - statusAt < 1000)) return selectedStatus;
            // (Asked at the tap itself, by the page's card: its plans are not worked out in the tap, `warmStatus`.)
            return warmStatus(entry) ? statusOf(entry) : lightStatus(entry);
        },
        animalRhythm: (id, asked = {}) => {
            const entry = findEntry(id);
            return entry ? rhythmOf(entry, asked.budgetMs ?? 8, asked.stepFeeds ?? false) : null;
        },
        noteRecord,
        eatsDung,
        animalDay,
        happening,
        reactive: (id) => {
            const r = findEntry(id)?.reactive;
            return r ? {...r} : null;
        },
        seen: () => {
            const alarms = [];
            for (const call of reactive.recentAlarms()) {
                const caller = seenNear.has(call.caller) ? findEntry(call.caller)?.animal : null;
                if (caller) alarms.push({id: caller.id, name: caller.name, speciesId: caller.kind_species_profile_id || caller.species_profile_id || `slug:${caller.model_slug}`, zone: caller.zone, at: call.at, threat: call.threat || null});
            }
            // 3.3 batch (A): with the defence moves in view.
            return {acts: reducedMotion ? [] : seenActs.concat(defenceSeen), alarms: reducedMotion ? [] : alarms};
        },
        reactiveStats: () => ({tier: reactiveTierNow ?? reactiveTier(), agents: reactive.stats.agents, inputs: reactiveInputs, perceptions: reactive.stats.perceptions, sightChecks: reactive.stats.sightChecks, alarms: reactive.stats.alarms, ms: reactiveMs}),
        heightAt: (x, z) => Math.max(heightAt(x, z), 0),
        preload: async (slugs) => {
            await library.ready();
            for (const slug of slugs) {
                if (!library.has(slug)) continue;
                library.request(slug, "far");
                library.request(slug, "near");
                tokens.ensure(slug);
            }
        },
        loading: () => library.busy || Boolean(worldBuild) || Boolean(spacing),
        flightHeld,
        hold: (id) => {
            const entry = findEntry(id);
            if (entry) entry.held = true;
        },
        moment: (kind, id) => {
            const now = elapsedNow();
            const fits = (entry: Entry) => canMoment(kind, entry.animal.model_slug, entry.animal.zone) && !entry.act && !entry.held && (kind !== "primate_drop" || Boolean(entry.place.canopy));
            const chosen = (id ? findEntry(id) : null) ?? [...entries].sort((a, b) => a.animal.id.localeCompare(b.animal.id)).find(fits) ?? null;
            if (!chosen || !fits(chosen)) return null;
            chosen.moment = {kind, start: now, from: null, beats: []};
            return chosen.animal.id;
        },
        setCutaway: (open) => {
            cutawayWanted = open;
            cutawayAt = null;
        },
        revive: (id) => {
            // (Its read may still be placing it: it walks out once it is aboard; one never placed is dropped after a while.)
            const asked = performance.now();
            for (const [key, back] of Array.from(reviving)) if (back.from === null && asked - back.asked > 120_000) reviving.delete(key);
            if (!reviving.has(id)) reviving.set(id, {from: null, home: null, pose: null, asked});
        },
        setHearts: (next) => {
            hearts = next ? new Map(Object.entries(next)) : null;
            // The bars say it at their next read.
            toldStatus = "";
            statusAt = 0;
        },
        arrive: (id) => {
            const entry = findEntry(id);
            if (!entry) return;
            // As a replay's arrival: on the ground first (a flyer then takes to the air), with the entrance's grow and ripple.
            entry.held = false;
            entry.air = 0;
            entry.arrivedAt = elapsedNow();
        },
        attachIsland: (isl: ArkIslandScene, snapshot: ArkSnapshot, joined?: () => void) => {
            // Decision 153: the town built off the first frame joins the one world now (its meshes, sea floor, ground,
            // streaming, behaviour world and animals); the view goes on to the two-island default if it is still at home.
            if (island || disposed) return;
            const atHome = !selectedId && !followId && !replay && controls.target.distanceTo(homeView().target) < 12;
            island = isl;
            applyLocoGround();
            addIslandWorld(isl);
            // Its programs compiled off the frame (KHR_parallel_shader_compile where the GPU has it), then shown a few
            // chunks a frame: no single long frame as the town comes in (decision 153).
            // (The compile starts now, on what is visible; hidden from the next frame on, shown once compiled.)
            const warm = warmShaders(renderer, isl.root, camera, 4000, scene);
            isl.beginReveal();
            const reveal = () => (townRevealing = true);
            void warm.then(reveal, reveal);
            registerIslandStream(isl);
            // p2 (ocean): the open sea's boats between the islands (`ocean-traffic-render.ts`), loaded with the town.
            if (arkWorld() === "v2") {
                void import("@/ark-scene/ocean-traffic-render").then(({OceanTrafficView}) => {
                    if (disposed || island !== isl || oceanTraffic) return;
                    oceanTraffic = new OceanTrafficView();
                    scene.add(oceanTraffic.group);
                });
            }
            maxDistance = wildFrame().reachIslands;
            controls.maxDistance = maxDistance;
            reactiveQueries = null;
            if (scheduleOn) townBuild = new ScheduleWorldBuild(isl.sampler());
            applyTier(tier);
            // Its animals join a few hundred at a time, each batch in an idle moment of its own (decision 153).
            const townAnimals = snapshot.animals.filter((animal) => isl.has(animal));
            const wildAnimals = snapshot.animals.filter((animal) => !isl.has(animal));
            isl.joining(true);
            let joinedCount = 0;
            const join = () => {
                if (disposed || island !== isl) return;
                joinedCount = Math.min(joinedCount + 450, townAnimals.length);
                const done = joinedCount >= townAnimals.length;
                if (done) isl.joining(false);
                setSnapshot(done ? snapshot : {...snapshot, animals: [...wildAnimals, ...townAnimals.slice(0, joinedCount)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))}, false);
                if (done) joined?.();
                else {
                    const ric = (globalThis as {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number}).requestIdleCallback;
                    if (ric) ric(join, {timeout: 250});
                    else setTimeout(join, 32);
                }
            };
            // (The view's flight first: a focus link waiting for the town (`joined`) flies on from it.)
            if (options.openIsland === "town") {
                const view = islandView("town");
                fly(view.target, view.distance, reducedMotion ? 0 : 2.6, view.polar, view.azimuth);
            } else if (atHome || opening) {
                // (Still at home, or still on the opening flight: on to the two-island view.)
                opening = false;
                const view = homeView();
                fly(view.target, view.distance, reducedMotion ? 0 : 2.4, view.polar, view.azimuth);
            }
            // The town's animals after its ground (graphics pass 2026-11-14): they joined at once, while its chunks
            // were still hidden for its shaders or coming in a few a frame, and stood as hundreds of markers over the
            // open sea for the first second or more. They start once every chunk is shown (the frame loop's reveal),
            // or after 6 s whatever happens (a page whose frames are paused).
            const startJoin = () => {
                if (townJoin !== startJoin) return;
                townJoin = null;
                join();
            };
            townJoin = startJoin;
            setTimeout(startJoin, 6000);
        },
        flyToIsland: (id: "wild" | "town") => {
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            endFollow();
            const view = islandView(id);
            // Across the strait: a longer, higher flight than a region's.
            fly(view.target, view.distance, reducedMotion ? 0 : 3.2, view.polar, view.azimuth);
        },
        islandNear: () => islandNear,
        islandView: (id: "wild" | "town") => {
            const view = islandView(id);
            return {target: {x: view.target.x, y: view.target.y, z: view.target.z}, distance: view.distance, polar: view.polar, azimuth: view.azimuth};
        },
        focusRegion: (region) => {
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            if (!region) {
                const view = homeView();
                fly(view.target, view.distance, 1.6, view.polar);
                return;
            }
            const centre = regionCentre(region);
            // (P6: on v2 a region is seen from further and a little more from above, over its taller canopy: `wildFrame()`.)
            const frame = wildFrame();
            fly(new Vector3(centre.x, Math.max(heightAt(centre.x, centre.z), 0), centre.z), Math.min(Math.max(centre.radius * 1.9, frame.regionNearest), 150), 1.6, frame.regionPolar ?? undefined);
        },
        stats: (): ArkSceneStats => ({
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            frameMs: Math.round(mean(frameTimes) * 100) / 100,
            intervalMs: Math.round(mean(frameIntervals) * 100) / 100,
            near: counts.near,
            far: counts.far,
            sprites: counts.token,
            pixelRatio,
            modelsLoaded: library.loadedCount,
            herdFigures: counts.herdFigures,
            restingFigures: counts.restingFigures,
            restingSpecks: counts.restingSpecks,
            herdSpecks: counts.herdSpecks,
            live: entries.length,
            placeholders: library.placeholderCount,
            tier,
            lite: liteOn(),
            rigged: counts.rigged,
            scheduled: scheduledCount,
            behaviourMs: Math.round(mean(behaviourTimes) * 1000) / 1000,
            tripsHeld,
            behaviourBuildMs: Math.round(behaviourBuildMs),
            behaviourBuildSlices,
            behaviourSpacingMs: Math.round(spacingMs),
            behaviourSpacingLongestMs: Math.round(spacingLongestMs),
            behaviourBuildLongestMs: Math.round(behaviourBuildLongestMs),
            rigsLoaded: rigs.loadedCount,
            rigBytes: rigs.bytes,
            animalLook: look.on,
            furShells: look.on ? look.shells.drawn : 0,
            closeUpSkins: look.closeUps.loaded,
            liveliness: liveliness.stats(),
            powers: powerShow?.report() ?? null,
            streaming: (() => {
                const stream = streamer.stats();
                return {renderDistance: stream.renderDistance, mapDistance: stream.mapDistance, active: stream.active, islands: stream.islands, fog: stream.fog, renderScale: stream.renderScale, map: stream.map, haze: stream.haze, chunks: stream.chunks, changes: stream.changes, tiles: landscape ? landscape.tiles.stats() : {full: 0, map: 0, hidden: 0}, animalsSkipped: streamSkipped, mapMarkers: streamMarkers, memory: stream.memory};
            })()
        }),
        dispose: () => {
            window.clearTimeout(groundChipTimer);
            groundChip?.remove();
            disposed = true;
            reproFx.dispose(); // REAL-REPRODUCTION
            powerShow?.dispose();
            cancelAnimationFrame(raf);
            humanFigures.dispose(); // p5 (humans)
            humanTVs.dispose(); // humans visible
            sleepCovers.dispose(); // humans polish
            beachProps.dispose(); // p5 (humans, quality pass)
            dogLeads.dispose(); // p5 (humans, dogs)
            runtime.dispose();
            perf.dispose();
            resizeObserver.disconnect();
            if (canvasTimer !== null) clearTimeout(canvasTimer);
            visibility.disconnect();
            canvas.removeEventListener("webglcontextrestored", onContextRestored);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("keydown", onKey);
            controls.stopListenToKeyEvents();
            herds.forEach((herd) => herd.badge.remove());
            specks.dispose();
            controls.dispose();
            species.forEach((meshes) => {
                meshes.near?.dispose();
                meshes.far?.dispose();
                meshes.rig?.dispose();
                meshes.nearMaterial?.dispose();
                meshes.farMaterial?.dispose();
                meshes.rigMaterial?.dispose();
            });
            rigs.dispose();
            look.dispose();
            talking.actor?.dispose();
            replay = null;
            dust.dispose();
            mealTraces.dispose();
            recipeScene.dispose();
            setNestSource(null);
            setRecipeArkDay(null);
            setFishSource(null);
            setFishChasers(null);
            nests.dispose();
            document.removeEventListener("visibilitychange", syncSound);
            liveliness.dispose();
            if (jetty) (jetty.userData.dispose as () => void)();
            library.dispose();
            tokens.dispose();
            dots.dispose();
            shadows.dispose();
            rings.dispose();
            landscape?.dispose();
            setDrawnGroundStride(null);
            nearDetail?.dispose();
            bugGround.dispose(); // p2 (ground)
            reflections.dispose(); // p3 (reflect)
            climbStems.dispose(); // p3 (trees)
            spiderWebs?.dispose(); // ARK-WEBS
            forest.dispose(); // p5 (humans)
            assetTrees?.dispose();
            assetRocks?.dispose();
            assetFloor?.dispose();
            vegetation?.dispose();
            micro?.dispose();
            if (island) {
                scene.remove(island.root);
                island.dispose();
                setIslandColliders(null);
            }
            for (const sceneModule of modules) sceneModule.dispose();
            motes.dispose();
            // 3.3 batch (E)
            seaLook?.dispose();
            oceanTraffic?.dispose(); // p2 (ocean)
            oceanShadows?.dispose(); // p2 (ocean)
            lighting.dispose();
            post.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
            selectionBars?.dispose();
            labelLayer.remove();
        }
    };
}

/** ARK-ANIM: the hanging posture's act state (`behaviour-recipes.ts` postureOf: `sleep_hang`, a bat roosting head down)
 * plays the sleep rule's clips, its own posture's first (a bat's sleep_hang, wings folded). */
function sleepState(state: string | null | undefined): string | null | undefined {
    return state === "sleep_hang" ? "sleep" : state;
}

/** ARK-ANIM: the most step cycles a second a gait clip plays (a cycle is two steps: twelve steps a second). */
export const GAIT_HZ_MAX = 6;

/** ARK-ANIM: the rig's own sleeping clip for a posture (`sleepPostureClips`, then its kind's), or null. */
function sleepClipOf(rig: RigModel, posture: SleepPosture): string | null {
    return sleepPostureClips(posture).find((name) => Boolean(rig.clips[name])) ?? ASLEEP_CLIPS.find((name) => Boolean(rig.clips[name])) ?? null;
}
