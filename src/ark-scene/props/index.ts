/**
 * The props lane (docs/ark/props.md): the owner's "extreme detail" brief,
 * sections 5 (nests, homes and structures, shown where the species is
 * present) and 6 (environment details by area), as one scene module
 * (`scene-modules.ts`) on top of the graphics lane's terrain and scenery
 * interface (`sampler.ts`).
 *
 * - `homes.ts`: species-gated nests, hives, mounds, webs, cocoons, warrens,
 *   worm casts, dens, lairs, the turtles' nest, the beavers' works and
 *   slime trails; rebuilt only when what is present changes.
 * - `areas.ts`: the garden's, the farm's, the mountain's and the
 *   grassland's details; `cave.ts`: the cave (and the bats' roost when bats
 *   are aboard).
 * - `effects.ts`: smoke, moths, dew, mist, blowing snow and dust.
 *
 * Weather and time come from the shared island clock (`src/lib/ark-clock.ts`)
 * through `conditions.ts`, following the scene's own pins (`ARK_ENV`), with
 * a development override (`globalThis.__arkPropsWeather`, a partial
 * `PropsConditions` or a named look) for the golden shots.
 *
 * Near / far detail by camera distance, counts capped per tier (`kit.ts`
 * PROPS_TIERS), everything off with `setEnabled(false)` (the page's
 * `props` option, or `globalThis.__arkProps = false` in development).
 * Visual only: nothing here decides anything that happens in the Ark.
 */

import {Group, Vector3} from "three";
import {ARK_ENV, ARK_SUN} from "@/ark-scene/glsl";
import type {ArkSceneModule, ArkSceneModuleContext} from "@/ark-scene/scene-modules";
import type {QualityTier} from "@/ark-scene/post";
import type {ArkSnapshot} from "@/ark-scene/types";
import {ARK_DAY_MS, arkDayAt, weatherAt} from "@/lib/ark-clock";
import {nestStage, type NestSiteInfo} from "@/ark-scene/props/nest-growth";
import {buildAreasSteps, type Areas} from "@/ark-scene/props/areas";
import {chimneyTop, defaultHomePlots, type HomePlot} from "@/ark-scene/props/home-layout";
import {prepareAttachPoints, setAttachHomePlots} from "@/ark-scene/sampler";
import {buildCave, CAVE_ROOST} from "@/ark-scene/props/cave";
import {conditionsFromArkWeather, PROPS_WEATHER_LOOKS, withOverride, type PropsConditions} from "@/ark-scene/props/conditions";
import {buildEffects} from "@/ark-scene/props/effects";
import {buildHomesSteps, buildWebs, type Homes} from "@/ark-scene/props/homes";
import {PROPS_TIERS, PROPS_WEATHER, runSliced, type LodBatch, type LodPiece} from "@/ark-scene/props/kit";
import {presenceKey, propsPresence} from "@/ark-scene/props/presence";

type Override = Partial<PropsConditions> | string | null | undefined;

function override(): Partial<PropsConditions> | null {
    const asked = (globalThis as {__arkPropsWeather?: Override}).__arkPropsWeather;
    if (!asked) return null;
    if (typeof asked === "string") return PROPS_WEATHER_LOOKS[asked] ?? null;
    return asked;
}

/** What the props draw now (for the golden shots' numbers and development). */
export type PropsStats = {enabled: boolean; tier: QualityTier; drawn: Record<string, number>; presence: string; nests: Homes["nests"]};

/** Where the props' things are: the homes' and the areas' marks, the cave's mouth and its way out. */
export type PropsMarks = {spots: Record<string, {x: number; y: number; z: number}>; cave: {x: number; y: number; z: number; facing: number; /** Where the bats hang, in the world. */ roost: {x: number; y: number; z: number}}};

/**
 * The Ark day now (fractional, as the server counts it): the snapshot's
 * `ark_day` carried forward from its `as_of` at the Ark's pace, else from
 * the voyage's start; pinned in development (`__arkPropsArkDay`, the golden
 * shots) or by `setArkDay`. The same for every viewer.
 */
export function arkDayNow(snapshot: Pick<ArkSnapshot, "ark_day" | "as_of" | "voyage">, nowMs: number, pinned: number | null = null): number | null {
    if (pinned !== null) return pinned;
    const dev = (globalThis as {__arkPropsArkDay?: number}).__arkPropsArkDay;
    if (typeof dev === "number" && Number.isFinite(dev)) return dev;
    const asOf = Date.parse(snapshot.as_of ?? "");
    if (typeof snapshot.ark_day === "number" && Number.isFinite(snapshot.ark_day) && Number.isFinite(asOf)) return snapshot.ark_day + (nowMs - asOf) / ARK_DAY_MS;
    const start = Date.parse(snapshot.voyage.started_at ?? "");
    return Number.isFinite(start) ? arkDayAt(nowMs, start) : null;
}

export function createPropsModule(context: ArkSceneModuleContext): ArkSceneModule & {
    stats: () => PropsStats;
    conditions: () => PropsConditions;
    marks: () => PropsMarks;
    /** The nests drawn now (for the recipes lane: where to carry twigs to, and each one's stage). */
    nestSites: () => Array<NestSiteInfo & {stage: number}>;
    /** Pin the Ark day the nests are built to (null follows the clock). */
    setArkDay: (day: number | null) => void;
    /** The home area's plots (the map lane's `homePlots()`; default: today's cottage and barn). */
    setHomePlots: (plots: HomePlot[]) => void;
} {
    const root = new Group();
    root.name = "props";
    context.scene.add(root);
    let tierName: QualityTier = context.tier;
    let tier = PROPS_TIERS[tierName];
    let enabled = (globalThis as {__arkProps?: boolean}).__arkProps !== false;
    let hours = context.hours;
    let reducedMotion = context.reducedMotion;
    const voyageStart = Date.parse(context.snapshot.voyage.started_at ?? "") || null;

    // The areas and the homes stand on the scenery's attach points (ledges, rocks, trees): they are built once
    // the sampler has prepared them a slice a frame (`prepareAttachPoints`), so the mount has no long task.
    let areas: Areas | null = null;
    let disposed = false;
    let shadows = true;
    let homePlots: HomePlot[] = defaultHomePlots();
    const cave = buildCave(tier);
    root.add(cave.group);
    const effectsGroup = new Group();
    effectsGroup.name = "props:effects";
    root.add(effectsGroup);
    const firstHouse = homePlots.find((plot) => plot.kind === "house");
    const chimney = firstHouse ? chimneyTop(firstHouse) : {x: 0, y: -100, z: 0};
    const effects = buildEffects(effectsGroup, new Vector3(chimney.x, chimney.y, chimney.z));
    effects.setTier(tier.particles);

    let homes: Homes | null = null;
    let homesJob = 0;
    let areasJob = 0;
    /** Bumped whenever the homes or the areas are swapped in (the close-up spots' cache). */
    let homesVersion = 0;
    let webs: ReturnType<typeof buildWebs> | null = null;
    let homesKey = "";
    let snapshot = context.snapshot;
    let moved = true;
    let arkDayPin: number | null = null;
    const rebuildHomes = () => {
        if (!areas) return;
        const presence = propsPresence(snapshot, context.planOf);
        // The sitters' and the den-keepers' places too: the scene places everyone after the module is built.
        const placed = [...presence.nests.map((nest) => nest.sitter), ...Array.from(presence.groups.values()).flat().map((animal) => animal.id)]
            .map((id) => (id ? context.placeOf(id) : null))
            .map((at) => (at ? `${at.x.toFixed(2)},${at.z.toFixed(2)}` : "-"))
            .join(";");
        const key = `${presenceKey(presence)}|${placed}`;
        if (key === homesKey) return;
        homesKey = key;
        // Built a few milliseconds a frame (buildHomesSteps, runSliced): the old homes stay until the new are ready. A
        // build overtaken by a newer one finishes and is thrown away (so nothing it made is left undisposed).
        const job = ++homesJob;
        void runSliced(buildHomesSteps(presence, context.placeOf, tier), 6, () => disposed).then((built) => {
            if (!built) return;
            if (disposed || job !== homesJob) {
                built.dispose();
                return;
            }
            if (homes) {
                root.remove(homes.group);
                homes.dispose();
            }
            if (webs) {
                root.remove(webs.lines);
                webs.lines.geometry.dispose();
                (webs.lines.material as {dispose: () => void}).dispose();
            }
            homes = built;
            homesVersion++;
            root.add(homes.group);
            for (const batch of homes.batches) batch.setShadows(shadows);
            webs = homes.webs.length ? buildWebs(homes.webs) : null;
            if (webs) root.add(webs.lines);
            effects.setGlints(webs?.beads ?? new Float32Array(0), homes.slimeGlints);
            cave.setRoost(homes.roost);
            homes.setNestStages(arkDayNow(snapshot, Date.now(), arkDayPin));
            moved = true;
        });
    };
    /** Build the areas for the plots now, a few milliseconds a frame, and put them in place of the old ones when done. */
    const rebuildAreas = () => {
        const job = ++areasJob;
        const plots = homePlots;
        void runSliced(buildAreasSteps(tier, plots), 6, () => disposed).then((built) => {
            if (!built) return;
            if (disposed || job !== areasJob) {
                built.dispose();
                return;
            }
            const first = !areas;
            if (areas) {
                root.remove(areas.group);
                areas.dispose();
            }
            areas = built;
            root.add(areas.group);
            for (const batch of areas.batches) batch.setShadows(shadows);
            for (const piece of areas.pieces) piece.setShadows(shadows);
            areas.buildings.setShadows(shadows);
            homesVersion++;
            conditionsAt = -Infinity;
            // The homes once the areas are in (they share the attach points, already prepared).
            if (first) rebuildHomes();
            moved = true;
        });
    };
    // The scenery after the first frame: the sampler's attach points a slice a frame, then the areas and the homes
    // the same way, so the mount has no long task at any population (docs/ark/runtime.md).
    void prepareAttachPoints(6).then(() => {
        if (!disposed) rebuildAreas();
    });

    /** The places worth a close look: the nests, the homes' marks, the webs, the cave's mouth. */
    let closeCache: {key: string; spots: Array<{x: number; y: number; z: number}>} = {key: "", spots: []};
    const closeSpots = () => {
        const cacheKey = `${homesKey}|${homesVersion}`;
        if (closeCache.key === cacheKey) return closeCache.spots;
        const inside = cave.toWorld(new Vector3(0, 1.4, -2));
        const spots = [...(homes?.nests ?? []), ...Object.values(homes?.marks ?? {}), ...Object.values(areas?.marks ?? {}), {x: cave.origin.x, y: cave.origin.y + 1.4, z: cave.origin.z}, inside];
        closeCache = {key: cacheKey, spots};
        return spots;
    };
    const batches = (): LodBatch[] => [...(areas?.batches ?? []), ...(homes?.batches ?? [])];
    const pieces = (): LodPiece[] => [...(areas?.pieces ?? []), ...cave.pieces];

    let conditions: PropsConditions = conditionsFromArkWeather({rain: 0, wind: 0.3, windDirection: 0.6, fog: 0, wetness: 0, puddles: 0, cold: 0.4, mountainSnowCover: 0.5}, hours);
    let conditionsAt = -Infinity;
    const readConditions = (nowMs: number) => {
        const weather = weatherAt(nowMs, {voyageStartMs: voyageStart});
        // The scene's own pins (setEnvironment, the golden shots) win: wetness, snow and wind as the ground and trees draw them.
        const pinned = {...weather, wetness: ARK_ENV.wetness.value, mountainSnowCover: ARK_ENV.snow.value, wind: ARK_ENV.wind.value};
        conditions = withOverride(conditionsFromArkWeather(pinned, hours), override());
    };

    const last = new Vector3(Infinity, 0, 0);
    let lastUpdate = 0;
    const sun = new Vector3();

    const propsModule = {
        name: "props",
        root,
        setTier: (next: QualityTier) => {
            tierName = next;
            tier = PROPS_TIERS[next];
            for (const batch of batches()) batch.setTier(tier);
            for (const piece of pieces()) piece.setTier(tier);
            effects.setTier(tier.particles);
            moved = true;
        },
        setShadows: (on: boolean) => {
            shadows = on;
            areas?.buildings.setShadows(on);
            for (const batch of batches()) batch.setShadows(on);
            for (const piece of pieces()) piece.setShadows(on);
        },
        /** The home area's plots (the map lane's `homePlots()`): each gets its own garden or yard, paddock, coop and fences. */
        setHomePlots: (plots: HomePlot[]) => {
            const same = plots.length === homePlots.length && plots.every((plot, i) => plot.id === homePlots[i].id && plot.x === homePlots[i].x && plot.z === homePlots[i].z && plot.rotation === homePlots[i].rotation);
            homePlots = plots;
            setAttachHomePlots(plots); // the sampler's fence_post points follow the same plots (graphics attach)
            // Before the first build, the mount's own build takes the newest plots; after it, a sliced rebuild.
            if (same || areasJob === 0) return;
            rebuildAreas();
        },
        setSnapshot: (next: ArkSnapshot) => {
            snapshot = next;
            rebuildHomes();
        },
        setHours: (next: number) => {
            hours = next;
            conditionsAt = -Infinity;
        },
        setEnabled: (on: boolean) => {
            enabled = on;
            root.visible = on;
            moved = true;
        },
        setReducedMotion: (reduced: boolean) => {
            reducedMotion = reduced;
        },
        step: (elapsed: number, camera: {position: Vector3}) => {
            if (!enabled) return;
            const nowMs = Date.now();
            if (nowMs - conditionsAt > 1000) {
                conditionsAt = nowMs;
                readConditions(nowMs);
                PROPS_WEATHER.wet.value = conditions.wetness;
                // Frost at a cold dawn (and in the cold's small hours), lying snow on the cold props.
                PROPS_WEATHER.frost.value = Math.max(0, (conditions.cold - 0.45) * 2) * Math.max(conditions.dawn, conditions.night * 0.6, conditions.cold > 0.8 ? 0.5 : 0);
                PROPS_WEATHER.snow.value = Math.max(0, conditions.snowCover - 0.3) * Math.min(1, conditions.cold * 1.4);
                areas?.buildings.setNight(conditions.night);
                if (areas?.setWeather({puddles: conditions.puddles, snowCover: conditions.snowCover, cold: conditions.cold})) moved = true;
                cave.setIcicles(conditions.cold > 0.55 ? conditions.cold : 0);
                // A slime trail glints when wet and in a low, raking light.
                homes?.setGlint(Math.min(1, 0.25 + conditions.wetness * 0.8 + conditions.dawn * 0.4));
                // The nests grow with the Ark's days (nest-growth.ts): refill when one has visibly grown.
                if (homes?.setNestStages(arkDayNow(snapshot, nowMs, arkDayPin))) moved = true;
            }
            effects.setPixelRatio(context.renderer.getPixelRatio());
            sun.copy(ARK_SUN.value as Vector3);
            effects.update(reducedMotion ? {...conditions, wind: 0} : conditions, camera.position, sun);
            // Refill near and far when the camera has moved a metre, or every half second.
            if (moved || camera.position.distanceToSquared(last) > 1 || elapsed - lastUpdate > 0.5) {
                moved = false;
                lastUpdate = elapsed;
                last.copy(camera.position);
                const {x, y, z} = camera.position;
                for (const batch of batches()) batch.update(x, y, z);
                for (const piece of pieces()) piece.update(x, y, z);
                if (webs) webs.lines.visible = tier.fine && Math.hypot(x - chimney.x, z - chimney.z) < 400;
            }
        },
        stats: (): PropsStats => {
            const drawn: Record<string, number> = {};
            for (const batch of batches()) {
                const d = batch.drawn();
                if (d.near || d.far) drawn[batch.name] = d.near + d.far;
            }
            for (const piece of pieces()) if (piece.near.visible || piece.far?.visible) drawn[piece.name] = piece.near.visible ? 2 : 1;
            return {enabled, tier: tierName, drawn, presence: homesKey, nests: homes?.nests ?? []};
        },
        closeUp: (x: number, y: number, z: number): number | null => {
            if (!enabled) return null;
            const spots = closeSpots();
            for (const spot of spots) if (Math.hypot(spot.x - x, spot.y - y, spot.z - z) < 2.6) return 1;
            return null;
        },
        conditions: () => conditions,
        nestSites: () => {
            const t = arkDayNow(snapshot, Date.now(), arkDayPin);
            return (homes?.nestSites ?? []).map((site) => ({...site, stage: t === null ? 1 : nestStage(site.speciesId, site.siteId, t)}));
        },
        setArkDay: (day: number | null) => {
            arkDayPin = day;
            if (homes?.setNestStages(arkDayNow(snapshot, Date.now(), arkDayPin))) moved = true;
        },
        marks: (): PropsMarks => ({spots: {...(areas?.marks ?? {}), ...(homes?.marks ?? {})}, cave: {x: cave.origin.x, y: cave.origin.y, z: cave.origin.z, facing: cave.facing, roost: (({x, y, z}) => ({x, y, z}))(cave.toWorld(CAVE_ROOST))}}),
        dispose: () => {
            disposed = true;
            context.scene.remove(root);
            areas?.dispose();
            cave.dispose();
            effects.dispose();
            homes?.dispose();
            if (webs) {
                webs.lines.geometry.dispose();
                (webs.lines.material as {dispose: () => void}).dispose();
            }
        }
    };
    root.visible = enabled;
    // Development (the golden shots): the module itself, to read where things are and what is drawn.
    if (process.env.NODE_ENV !== "production") (globalThis as {__arkPropsModule?: unknown}).__arkPropsModule = propsModule;
    return propsModule;
}
