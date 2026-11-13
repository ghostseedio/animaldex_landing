/**
 * Part C: the town island in the Ark's one world (decisions 141–142; the owner: "the second island should be pannable
 * from the first island, they should be visibly next to each other"). `mountArk` with `island` builds the wild island
 * as always and this island beside it, across the strait at its world origin (`islands/index.ts` townWorldOrigin): its
 * ground, scenery and people implied (the town lane's meshes, moved to the origin), its placement of the animals that
 * live there (in world coordinates), its camera views. The animals go through the scene's one pipeline (models, rigs,
 * the live budget, Part B's streaming), exactly as on the wild island.
 *
 * Everything here answers in world coordinates; the town's own modules work in its local frame (+ the origin).
 */

import {DataTexture, NearestFilter, RedFormat, UnsignedByteType, type Group, type Mesh, type ShaderMaterial, type Texture} from "three";
import type {Placement} from "@/ark-scene/placement";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ChunkGrid, ChunkSpan} from "@/ark-scene/streaming/chunks";
import type {TownPlace} from "@/ark-scene/islands/town/placement";
import {ARK_ISLANDS, townWorldOrigin} from "@/ark-scene/islands";
import {TOWN_CHUNK_COUNT, TOWN_GRID} from "@/ark-scene/islands/town/chunks";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import type {ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import type {ColliderSet} from "@/ark-scene/collide/colliders";
import type {TownPrepared} from "@/ark-scene/islands/town/prebuild";
import type {TownIsland} from "@/ark-scene/islands/town/render/index";
import type {WaterSpec} from "@/ark-scene/sea-depth";
import type {PetHomes} from "@/ark-scene/islands/town/render/pet-homes";
import {splitTwoSided} from "@/ark-scene/runtime/two-sided";

export type ArkIslandScene = {
    id: "town";
    /** How its build went on the main thread: the slices, their work (ms) and the longest one, and its wall time. */
    buildStats?: {slices: number; workMs: number; longestMs: number; wallMs: number};
    /** Its local origin in the world frame. */
    origin: {x: number; z: number};
    /** Its meshes, already at the origin. */
    root: Group;
    /** Half its square (m), and its sea floor's depth map over it (r = depth / 16 m) for the one world's sea (decision 143). */
    half: number;
    seaDepth: Texture | null;
    /**
     * Its chunks as drawn now (1 drawn, 0 not; one texel a chunk over its square, rows along z): the one sea applies the
     * town's sea floor only where its chunk is drawn, so a chunk that is not drawn never shows the town's shallows (white)
     * through the land's place, only the open sea.
     */
    drawnMask: Texture;
    /** Within its square (its ground answers there; the wild island's outside). */
    contains: (x: number, z: number) => boolean;
    /** The ground's height in the world frame (inside its square). */
    heightAt: (x: number, z: number) => number;
    /**
     * Lane TB: the ground as it is drawn there (world frame): its ground tile's triangles, its decals (roads, pavements,
     * paths, fields, the zoo's ground, bridge decks) and its floors (`islands/town/drawn-ground.ts`). Feet, the
     * grounding stand, contact shadows and selection rings stand on it, never on the wild island's sea floor.
     */
    /** `near`: the body's height (its pose's base): the floor it stands on where floors are stacked (balconies). */
    drawnHeight: (x: number, z: number, near?: number) => number;
    drawnGround: (x: number, z: number) => {height: number; nx: number; ny: number; nz: number};
    /** The drawn ground under a point and the water's surface over it (null on dry land), for contact shadows and rings. */
    groundUnder: (x: number, z: number, seaLevel: number) => {height: number; water: number | null};
    /** Lives on this island (the server's `island`, else a kept area). */
    has: (animal: Pick<ArkAnimal, "island" | "area">) => boolean;
    /** Part B (its chunks in its local frame, the streamer places them at `origin`). */
    grid: ChunkGrid;
    spans: ChunkSpan[];
    content: Uint8Array;
    /** Part B's states for its chunks (STATE_IN full, STATE_MAP map style, STATE_OUT hidden); `allIn`: everything drawn. */
    applyStream: (states: Uint8Array, allIn: boolean) => void;
    /**
     * Decision 153: shown a few chunks a frame as it joins the world (its GPU uploads spread over frames, never one long
     * frame): `beginReveal` hides it, each `stepReveal(n)` shows n more chunks; true while there is more to show.
     */
    beginReveal: () => void;
    stepReveal: (chunks: number) => boolean;
    /** Decision 153: its animals join a few hundred at a time; meanwhile their places keep the whole town's open enclosures. */
    joining: (on: boolean) => void;
    /** Every frame: the world's clock (epoch ms), for the people implied and the zoo's day. */
    update: (epochMs: number) => void;
    /**
     * Lane GB: the scene's answer for the town's moving cars (world frame, epoch seconds): the animals near a point at a
     * moment (their shared poses and L5's body radius), null while the town's schedules are not wired yet.
     */
    setTrafficAnimals: (query: ((x: number, z: number, radius: number, epochSeconds: number) => Array<{x: number; z: number; r: number; h?: number}> | null) | null) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: "high" | "medium" | "low") => void;
    /** Its animals' places in the world frame (the snapshot's animals of this island). */
    place: (animals: ArkAnimal[]) => Map<string, Placement>;
    /** The town's facts for a placed animal (its area, home, enclosure and range; local frame). */
    townPlace: (id: string) => TownPlace | undefined;
    /**
     * A zoo animal's hard bound: a world pose pulled back inside its enclosure's mask. Lane TB: and any town animal's
     * scheduled pose under the drawn ground where no water is (a drink at the canal's walled edge, a swim by its wall)
     * stands on the ground there instead, never in it.
     */
    bound: (id: string, pose: {x: number; z: number; base?: number; afloat?: boolean; water?: unknown; surface?: unknown}) => void;
    /** Its behaviour world in the world frame (`islands/town/sampler.ts`): places, ground, walk grid, obstacles. */
    sampler: () => ArkWorldSampler;
    /** Its colliders in the world frame (`islands/town/colliders.ts`, through L5's `collide/` per island). */
    colliders: () => ColliderSet;
    /** On the behaviour schedule (not one kept still at a window, behind the glass or in a tank or pool). */
    scheduled: (id: string) => boolean;
    /**
     * Lane TB: a tank's resident's pose now (the aquarium's tanks, a home's tank, a garden pond: `islands/town/tanks.ts`),
     * world frame, at its drawn length and height and the shared clock (s); null for anyone else.
     */
    tankPose: (id: string, length: number, height: number, clock: number) => {x: number; z: number; yaw: number; pitch: number; base: number; spec: WaterSpec} | null;
    /** Lane TB: held at its place (in a cage, a vivarium, a tank, a zoo house): never walks off it. */
    held: (id: string) => boolean;
    /**
     * Lane TB: where a herd's member figure stands (its lowest point, m): in its tank's water, on its display's tray or
     * its zoo house's floor (`ground`, its place's), else on the town's drawn ground there (never the wild sea floor).
     */
    figureBase: (id: string, x: number, z: number, ground: number, tall: number) => number;
    /** Lane TB (decision 255): a tank resident's figure's point and heading (its loop at a fixed moment), world frame; null for others. */
    figurePose: (id: string, length: number) => {x: number; z: number; yaw: number} | null;
    /** The most its home range may reach (m): its garden, paddock or enclosure. */
    rangeOf: (id: string) => number | null;
    /** A kept animal (house, farm, zoo): its home is never moved away from prey. */
    kept: (id: string) => boolean;
    /**
     * A zoo resident's schedule animal for the slot holding `epoch`: during its enclosure's feeding (on the island clock,
     * decided at the slot's start) the same animal with the feeding station as its home and a small range; else itself.
     */
    feedingAnimal: (animal: ScheduleAnimal, epoch: number) => ScheduleAnimal;
    /** Its whole-island view: target (world) and the radius it fits. */
    home: {x: number; z: number; radius: number; radiusTall: number};
    /** The camera's target is kept within this of its middle. */
    worldRadius: number;
    dispose: () => void;
};

/** Builds the town for the scene (its modules on demand, so a one-island page does not carry them). */
/**
 * How long a slice of the town's build waits for an idle moment at most (ms). The live scene draws every frame, so
 * idle moments are rare and a slice mostly runs at this timeout: about two frames, not 120 ms (decision 153's town
 * took 13 such waits, 1.2-2.4 s, for under 0.2 s of work).
 */
export const TOWN_IDLE_TIMEOUT_MS = 34;

/** The next idle moment (or the next frame's time where the browser has no idle callbacks). */
function idle(): Promise<void> {
    return new Promise((resolve) => {
        const ric = (globalThis as {requestIdleCallback?: (cb: () => void, options?: {timeout: number}) => number}).requestIdleCallback;
        if (ric) ric(() => resolve(), {timeout: TOWN_IDLE_TIMEOUT_MS});
        else setTimeout(resolve, 16);
    });
}

/**
 * The next task: the slice ends, the browser draws a frame if one is due, then the next slice. Once the live scene draws,
 * its frames leave few idle moments and an idle wait ran late (about 1.2 s for one on the phone profile); so did a
 * plain task (0.9-1.2 s: the page's loading work goes first), so where the browser has the Prioritized Task Scheduling
 * API the next slice is a user-blocking task. Between tasks the frames still come first.
 */
export function nextTask(): Promise<void> {
    return new Promise((resolve) => {
        const scheduler = (globalThis as {scheduler?: {postTask?: (cb: () => void, options?: {priority?: string}) => Promise<unknown>}}).scheduler;
        if (scheduler?.postTask) {
            scheduler.postTask(resolve, {priority: "user-blocking"}).catch(() => resolve());
            return;
        }
        if (typeof MessageChannel === "undefined") {
            setTimeout(resolve, 0);
            return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
        };
        channel.port2.postMessage(null);
    });
}

/**
 * `prepared`: the town's prebuild worker's answer (`islands/town/prebuild.ts`, decision 153). `sliceMs`: the build runs
 * in slices of about this long (its meshes chunk by chunk), never one long task; absent: all at once. `between`: what
 * a slice waits for: an idle moment (default; before the live scene draws) or the next task (`nextTask`, once it does).
 */
export async function loadTownScene(options: {tier: "high" | "medium" | "low"; animals: readonly ArkAnimal[]; offsetHours?: number; origin?: {x: number; z: number}; prepared?: TownPrepared | null; sliceMs?: number; between?: "idle" | "task"}): Promise<ArkIslandScene> {
    const pause = options.between === "task" ? nextTask : idle;
    const [{townIslandSteps}, {townClockAt}, {placeTownAnimals}, {enclosuresIn, launchEnclosures, zooLayout}, {inPoly, centroid}, {townWorldSampler}, {buildZooLife}, {zooFeedingAt, feedingHome}, {SLOT_SECONDS, slotOffset}, {townHeight}] = await Promise.all([
        import("@/ark-scene/islands/town/render/index"),
        import("@/ark-scene/islands/town/people"),
        import("@/ark-scene/islands/town/placement"),
        import("@/ark-scene/islands/town/areas"),
        import("@/ark-scene/islands/town/geom"),
        import("@/ark-scene/islands/town/sampler"),
        import("@/ark-scene/islands/town/render/zoo-life"),
        import("@/ark-scene/islands/town/zoo-life"),
        import("@/ark-scene/behaviour-schedule"),
        import("@/ark-scene/islands/town/ground")
    ]);
    const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
    const {primeTownDrawnGrid, setTownWalkSurfaces, townDrawnGround, townDrawnHeight, townWalkSurfaces, townWaterLevel, townWaterSurface} = await import("@/ark-scene/islands/town/drawn-ground");
    const {setIslandWater} = await import("@/ark-scene/water-level");
    const {homeSites, tankPose} = await import("@/ark-scene/islands/town/tanks");
    const {buildPetHomes} = await import("@/ark-scene/islands/town/render/pet-homes");
    const {townHouseholds} = await import("@/ark-scene/islands/town/areas");
    const {modelBase} = await import("@/ark-scene/grounding/base");
    const {sampleTownGround} = await import("@/ark-scene/islands/town/ground");
    const {CANAL_LEVEL} = await import("@/ark-scene/islands/town/plan");
    const origin = options.origin ?? townWorldOrigin();
    const def = ARK_ISLANDS.town;
    const has = (animal: Pick<ArkAnimal, "island" | "area">) => animal.island === "town" || (!animal.island && (animal.area === "house" || animal.area === "farm" || animal.area === "zoo"));
    const open = enclosuresIn(options.animals.filter(has));
    const zooOpen = open.length ? open : launchEnclosures();
    const prepared = options.prepared ?? null;
    const steps = townIslandSteps({tier: options.tier, zooOpen, built: prepared?.built ?? undefined});
    const sliced = options.sliceMs !== undefined;
    let town: TownIsland;
    const buildStats = {slices: 0, workMs: 0, longestMs: 0, wallMs: 0};
    const wallStart = performance.now();
    const counted = (from: number) => {
        const ms = performance.now() - from;
        buildStats.slices++;
        buildStats.workMs += ms;
        buildStats.longestMs = Math.max(buildStats.longestMs, ms);
    };
    for (;;) {
        const sliceStart = performance.now();
        let next = steps.next();
        while (!next.done && (!sliced || performance.now() - sliceStart < options.sliceMs!)) next = steps.next();
        counted(sliceStart);
        if (next.done) {
            town = next.value;
            break;
        }
        await pause();
    }
    if (sliced) await pause();
    town.root.position.set(origin.x, 0, origin.z);
    // Lane TB: the drawn ground's grid (the prebuild's, when there is one) and its walk surfaces: every decal the town
    // draws, the zoo's included (and, as they change, the zoo's and the displays' floors: `walkSurfacesNow`).
    primeTownDrawnGrid(prepared?.built?.grid.heights ?? null);
    /** The zoo houses' floors and the drawn home displays' floors (cages' trays and perches, vivaria, garden rooms). */
    let houseFloors = new Float32Array(0);
    let petFloors = new Float32Array(0);
    const walkSurfacesNow = () => {
        const sources: Float32Array[] = [houseFloors, petFloors];
        town.root.traverse((o) => {
            const mesh = o as Mesh;
            if (mesh.isMesh && (mesh.name === "decal" || mesh.name === "zoo:decal")) sources.push(mesh.geometry.getAttribute("position").array as Float32Array);
        });
        setTownWalkSurfaces(townWalkSurfaces(sources));
    };
    // Lane TB: the town's water at its own level for the schedule and the depth bands (the canal's 1.15 m, not the sea's 0).
    const inside = (x: number, z: number) => Math.abs(x - origin.x) < def.half && Math.abs(z - origin.z) < def.half;
    setIslandWater({level: (x, z) => (inside(x, z) ? townWaterLevel(x - origin.x, z - origin.z) : null), surface: (x, z) => (inside(x, z) ? townWaterSurface(x - origin.x, z - origin.z) : null)});
    // What Part B's streamer draws, and how much of the town is shown yet as it joins (decision 153).
    let streamDrawn: ((chunk: number) => boolean) | null = null;
    let joinOpen: string[] | null = null;
    let revealed = Number.POSITIVE_INFINITY;
    let hidden: Group["children"] = [];
    // (The one sea's fail-safe: the drawn chunks, for its town patch.)
    const drawnBytes = new Uint8Array(TOWN_CHUNK_COUNT).fill(255);
    const drawnMask = new DataTexture(drawnBytes, TOWN_GRID.columns, TOWN_GRID.rows, RedFormat, UnsignedByteType);
    drawnMask.magFilter = NearestFilter;
    drawnMask.minFilter = NearestFilter;
    drawnMask.needsUpdate = true;
    let splitAt = -Infinity;
    const applyDrawn = () => {
        const stream = streamDrawn;
        const upTo = revealed;
        const drawn = upTo >= TOWN_CHUNK_COUNT ? stream : (chunk: number) => chunk < upTo && (!stream || stream(chunk));
        // (The town lane: its chunk layers' batches let in one a reveal step, never all uploaded in one frame.)
        town.setRevealed(Math.min(upTo, TOWN_CHUNK_COUNT));
        town.setDrawn(drawn);
        let changed = false;
        for (let chunk = 0; chunk < TOWN_CHUNK_COUNT; chunk++) {
            const value = !drawn || drawn(chunk) ? 255 : 0;
            if (drawnBytes[chunk] !== value) {
                drawnBytes[chunk] = value;
                changed = true;
            }
        }
        if (changed) drawnMask.needsUpdate = true;
    };
    // One sea for the world (decision 143): the wild island's; the town's own plane would lie over it.
    const sea = town.root.getObjectByName("town:sea") as Mesh | undefined;
    if (sea) sea.visible = false;
    const seaDepth = ((sea?.material as ShaderMaterial | undefined)?.uniforms?.depthMap?.value as Texture | null | undefined) ?? null;
    town.root.updateMatrixWorld(true);
    let openKey = zooOpen.join(",");
    // (The prebuild's sampler and colliders are for the enclosures open when it ran.)
    const preparedKey = prepared?.built?.zooOpen.join(",") ?? null;
    // The zoo's day: its enrichment and the food at its stations (`render/zoo-life.ts`), in the town's frame.
    const zooStart = performance.now();
    let zooLife = buildZooLife(zooLayout(openKey.split(",")).enclosures, townHeight);
    town.root.add(zooLife.group);
    houseFloors = zooLife.floors;
    walkSurfacesNow();
    // Lane TB: the pets kept at home, in their garden rooms, on their balconies, in their ponds (`render/pet-homes.ts`).
    let petHomes: PetHomes | null = null;
    let petKey = "";
    const showPetHomes = (places: Map<string, TownPlace>) => {
        const byHousehold = new Map<string, Set<string>>();
        places.forEach((info) => {
            if (!info.display) return;
            let set = byHousehold.get(info.display.household);
            if (!set) byHousehold.set(info.display.household, (set = new Set()));
            set.add(info.display.id);
        });
        const key = Array.from(byHousehold.values(), (set) => Array.from(set).sort().join("+")).sort().join(",");
        if (key === petKey) return;
        petKey = key;
        const sites = homeSites(townHouseholds());
        const used = Array.from(byHousehold.entries()).flatMap(([household, displays]) => {
            const site = sites.get(household);
            return site ? [{site, displays}] : [];
        });
        if (petHomes) {
            town.root.remove(petHomes.group);
            petHomes.dispose();
        }
        petHomes = buildPetHomes(used);
        town.root.add(petHomes.group);
        petFloors = petHomes.floors;
        walkSurfacesNow();
    };
    counted(zooStart);
    if (sliced) await pause();
    buildStats.wallMs = performance.now() - wallStart;
    for (const key of ["workMs", "longestMs", "wallMs"] as const) buildStats[key] = Math.round(buildStats[key]);
    const clockAt = (ms: number) => townClockAt(ms, options.offsetHours ?? 0);
    /** Each zoo resident's feeding variant (one object each: the schedule's memo is kept per animal). */
    const feeding = new WeakMap<ScheduleAnimal, ScheduleAnimal>();
    let towned = new Map<string, TownPlace>();
    /** The town's animals by id (a tank resident's slug and zone for its band). */
    const townAnimals = new Map<string, ArkAnimal>();
    let sampler: {key: string; sampler: ArkWorldSampler} | null = null;
    let collidersMemo: {key: string; set: ColliderSet} | null = null;
    const STILL_WHERE = new Set(["window", "indoor", "pool"]);
    const half = def.half;
    return {
        id: "town",
        buildStats,
        origin,
        root: town.root,
        half: def.half,
        seaDepth,
        drawnMask,
        contains: (x, z) => Math.abs(x - origin.x) <= half && Math.abs(z - origin.z) <= half,
        heightAt: (x, z) => town.heightAt(x - origin.x, z - origin.z),
        drawnHeight: (x, z, near) => townDrawnHeight(x - origin.x, z - origin.z, undefined, near),
        drawnGround: (x, z) => townDrawnGround(x - origin.x, z - origin.z),
        groundUnder: (x, z, seaLevel) => {
            const lx = x - origin.x;
            const lz = z - origin.z;
            const height = townDrawnHeight(lx, lz);
            // (The sea and the harbour at the sea's level; the canal, the millpond and the farm pond held by the lock.)
            const ground = sampleTownGround(lx, lz);
            const water = ground.height < seaLevel ? seaLevel : ground.surface === "water" ? Math.max(CANAL_LEVEL, ground.height + 0.05) : null;
            return {height, water: water !== null && water > height ? water : null};
        },
        has,
        grid: town.grid,
        spans: town.spans,
        content: town.content,
        applyStream: (states, allIn) => {
            streamDrawn = allIn ? null : (chunk) => states[chunk] !== 0;
            applyDrawn();
        },
        joining: (on) => {
            joinOpen = on ? openKey.split(",") : null;
        },
        beginReveal: () => {
            revealed = 0;
            // (The chunks show a few a step; so do their layers' batches, let in by the town itself: `setRevealed`.)
            hidden = town.root.children.filter((child) => !child.name.startsWith("town:chunk:") && !child.userData.townChunks && child.visible);
            for (const child of hidden) child.visible = false;
            applyDrawn();
        },
        stepReveal: (chunks) => {
            if (revealed >= TOWN_CHUNK_COUNT) return false;
            revealed = Math.min(revealed + chunks, TOWN_CHUNK_COUNT);
            if (revealed >= TOWN_CHUNK_COUNT) {
                for (const child of hidden) child.visible = true;
                hidden = [];
            }
            applyDrawn();
            return revealed < TOWN_CHUNK_COUNT;
        },
        update: (epochMs) => {
            const clock = clockAt(epochMs);
            town.update(clock);
            zooLife.update(clock);
            // Mobile performance lane: its transparent double-sided meshes (the zoo's glass, cage bars and nets) as two
            // meshes each, the same picture without three's two program look-ups a frame for each (`runtime/two-sided.ts`);
            // looked for every few seconds, for what is built or rebuilt later (an enclosure opening).
            const now = typeof performance !== "undefined" ? performance.now() : 0;
            if (now - splitAt > 3000) {
                splitAt = now;
                splitTwoSided(town.root);
            }
        },
        setTrafficAnimals: (query) => {
            // (The town's cars ask in its own frame and on the island clock's seconds: the world's frame and epoch here.)
            const shift = (options.offsetHours ?? 0) * 3600;
            town.setTrafficAnimals(
                query
                    ? (x, z, radius, islandSeconds) => {
                          const found = query(x + origin.x, z + origin.z, radius, islandSeconds - shift);
                          return found && found.map((a) => ({x: a.x - origin.x, z: a.z - origin.z, r: a.r, h: a.h}));
                      }
                    : null
            );
        },
        setShadows: town.setShadows,
        setTier: town.setTier,
        place: (animals) => {
            const placed = placeTownAnimals(animals, joinOpen ?? undefined);
            // The zoo's open enclosures follow the snapshot (an arrival opening the next plot).
            const key = placed.open.join(",");
            if (key !== openKey) {
                openKey = key;
                town.setZooOpen(placed.open);
                town.root.remove(zooLife.group);
                zooLife.dispose();
                zooLife = buildZooLife(zooLayout(placed.open).enclosures, townHeight);
                town.root.add(zooLife.group);
                houseFloors = zooLife.floors;
                walkSurfacesNow();
            }
            towned = placed.town;
            showPetHomes(placed.town);
            for (const animal of animals) townAnimals.set(animal.id, animal);
            const world = new Map<string, Placement>();
            placed.places.forEach((p, id) => world.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
            return world;
        },
        townPlace: (id) => towned.get(id),
        bound: (id, pose) => {
            if (pose.base !== undefined && !pose.water && !pose.surface) {
                const lx = pose.x - origin.x;
                const lz = pose.z - origin.z;
                // (Under the analytic ground the scene would draw it afloat, under the drawn one: stood on the drawn ground.)
                const analytic = townHeight(lx, lz);
                const water = townWaterSurface(lx, lz);
                if (pose.base < analytic - 0.02 && (water === null || analytic >= water)) {
                    pose.base = townDrawnHeight(lx, lz, undefined, analytic);
                    pose.afloat = false;
                }
            }
            const mask = towned.get(id)?.enclosure?.mask;
            if (!mask) return;
            const lx = pose.x - origin.x;
            const lz = pose.z - origin.z;
            if (inPoly(mask, lx, lz)) return;
            const c = centroid(mask);
            let lo = 0;
            let hi = 1;
            for (let k = 0; k < 8; k++) {
                const t = (lo + hi) / 2;
                if (inPoly(mask, c.x + (lx - c.x) * t, c.z + (lz - c.z) * t)) lo = t;
                else hi = t;
            }
            pose.x = origin.x + c.x + (lx - c.x) * lo;
            pose.z = origin.z + c.z + (lz - c.z) * lo;
        },
        sampler: () => {
            if (!sampler || sampler.key !== openKey) {
                if (!collidersMemo || collidersMemo.key !== openKey) collidersMemo = {key: openKey, set: townColliderSet(openKey ? openKey.split(",") : [], origin, openKey === preparedKey ? prepared?.colliders ?? undefined : undefined)};
                sampler = {key: openKey, sampler: townWorldSampler(openKey ? openKey.split(",") : [], origin, collidersMemo.set, openKey === preparedKey ? prepared?.sampler ?? undefined : undefined)};
            }
            return sampler.sampler;
        },
        colliders: () => {
            if (!collidersMemo || collidersMemo.key !== openKey) collidersMemo = {key: openKey, set: townColliderSet(openKey ? openKey.split(",") : [], origin, openKey === preparedKey ? prepared?.colliders ?? undefined : undefined)};
            return collidersMemo.set;
        },
        tankPose: (id, length, height, clock) => {
            const info = towned.get(id);
            const tank = info?.tank;
            const animal = tank ? townAnimals.get(id) : undefined;
            if (!tank || !animal) return null;
            const pose = tankPose(tank, animal, length, height, modelBase(animal.model_slug)?.plan ?? null, clock);
            return {x: pose.x + origin.x, z: pose.z + origin.z, yaw: pose.yaw, pitch: pose.pitch, base: pose.base, spec: pose.spec};
        },
        figureBase: (id, x, z, ground, tall) => {
            const info = towned.get(id);
            if (info?.tank) return Math.max(info.tank.floor + 0.05, (info.tank.floor + info.tank.top) / 2 - tall / 2);
            if (info && (info.display || info.where === "indoor" || info.where === "window" || info.where === "pool")) return ground;
            return townDrawnHeight(x - origin.x, z - origin.z, undefined, ground);
        },
        figurePose: (id, length) => {
            const info = towned.get(id);
            const animal = info?.tank ? townAnimals.get(id) : undefined;
            if (!info?.tank || !animal) return null;
            const pose = tankPose(info.tank, animal, length, length * 0.3, modelBase(animal.model_slug)?.plan ?? null, 0);
            return {x: pose.x + origin.x, z: pose.z + origin.z, yaw: pose.yaw};
        },
        held: (id) => {
            const info = towned.get(id);
            return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
        },
        scheduled: (id) => {
            const info = towned.get(id);
            return Boolean(info) && !info!.still && !STILL_WHERE.has(info!.where);
        },
        rangeOf: (id) => {
            const info = towned.get(id);
            return info ? Math.max(info.range, 0.6) * 1.5 : null;
        },
        kept: (id) => {
            const area = towned.get(id)?.area;
            return area === "house" || area === "farm" || area === "zoo";
        },
        feedingAnimal: (animal, epoch) => {
            const enclosure = towned.get(animal.id)?.enclosure;
            if (!enclosure) return animal;
            // (Decided at the start of the slot holding `epoch`: one goal a slot, the schedule's rule.)
            const offset = slotOffset(animal.id);
            const start = Math.floor((epoch + offset) / SLOT_SECONDS) * SLOT_SECONDS - offset;
            if (!zooFeedingAt(enclosure.type, clockAt(start * 1000))) return animal;
            let variant = feeding.get(animal);
            if (!variant) {
                const station = feedingHome(enclosure, townHeight);
                const lead = (base: ScheduleAnimal) => (towned.get(base.id)?.enclosure?.id === enclosure.id ? (feeding.get(base) ?? base) : base);
                variant = Object.create(animal, {
                    home: {value: {x: station.x + origin.x, y: station.y, z: station.z + origin.z}, enumerable: true},
                    range: {value: station.range * 1.5, enumerable: true},
                    // (Its group's leader feeds too: the same enclosure, the same time.)
                    group: {get: () => (animal.group ? {...animal.group, leader: lead(animal.group.leader)} : animal.group), enumerable: true}
                }) as ScheduleAnimal;
                feeding.set(animal, variant);
            }
            return variant;
        },
        home: {x: origin.x + def.home.target[0], z: origin.z + def.home.target[2], radius: 205, radiusTall: 230},
        worldRadius: half * 0.92,
        dispose: () => {
            setIslandWater(null);
            setTownWalkSurfaces(null);
            petHomes?.dispose();
            zooLife.dispose();
            town.dispose();
        }
    };
}

/**
 * One sampler over the one world (decision 141): another island's inside its square (`contains`), the wild island's
 * elsewhere. For what reads the world everywhere at once (the reactive layer's sight and cover); the schedules read
 * each island's own.
 */
export function composedSampler(wild: ArkWorldSampler, other: ArkWorldSampler, contains: (x: number, z: number) => boolean): ArkWorldSampler {
    const at = (x: number, z: number) => (contains(x, z) ? other : wild);
    return {
        version: `${wild.version}+${other.version}`,
        heightAt: (x, z) => at(x, z).heightAt(x, z),
        isWater: (x, z) => at(x, z).isWater(x, z),
        slope: (x, z) => at(x, z).slope(x, z),
        zoneAt: (x, z) => at(x, z).zoneAt(x, z),
        attachPoints: (tag, near) => (near ? at(near.x, near.z).attachPoints(tag, near) : [...wild.attachPoints(tag), ...other.attachPoints(tag)]),
        blocked: (x, z, clearance) => at(x, z).blocked(x, z, clearance)
    };
}
