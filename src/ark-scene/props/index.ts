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
import {weatherAt} from "@/lib/ark-clock";
import {buildAreas} from "@/ark-scene/props/areas";
import {buildCave} from "@/ark-scene/props/cave";
import {conditionsFromArkWeather, PROPS_WEATHER_LOOKS, withOverride, type PropsConditions} from "@/ark-scene/props/conditions";
import {buildEffects} from "@/ark-scene/props/effects";
import {buildHomes, buildWebs, type Homes} from "@/ark-scene/props/homes";
import {PROPS_TIERS, PROPS_WEATHER, type LodBatch, type LodPiece} from "@/ark-scene/props/kit";
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
export type PropsMarks = {spots: Record<string, {x: number; y: number; z: number}>; cave: {x: number; y: number; z: number; facing: number}};

export function createPropsModule(context: ArkSceneModuleContext): ArkSceneModule & {stats: () => PropsStats; conditions: () => PropsConditions; marks: () => PropsMarks} {
    const root = new Group();
    root.name = "props";
    context.scene.add(root);
    let tierName: QualityTier = context.tier;
    let tier = PROPS_TIERS[tierName];
    let enabled = (globalThis as {__arkProps?: boolean}).__arkProps !== false;
    let hours = context.hours;
    let reducedMotion = context.reducedMotion;
    const voyageStart = Date.parse(context.snapshot.voyage.started_at ?? "") || null;

    const areas = buildAreas(tier);
    root.add(areas.group);
    const cave = buildCave(tier);
    root.add(cave.group);
    const effectsGroup = new Group();
    effectsGroup.name = "props:effects";
    root.add(effectsGroup);
    const effects = buildEffects(effectsGroup, areas.chimney);
    effects.setTier(tier.particles);

    let homes: Homes | null = null;
    let webs: ReturnType<typeof buildWebs> | null = null;
    let homesKey = "";
    let snapshot = context.snapshot;
    let moved = true;
    const rebuildHomes = () => {
        const presence = propsPresence(snapshot, context.planOf);
        // The sitters' and the den-keepers' places too: the scene places everyone after the module is built.
        const placed = [...presence.nests.map((nest) => nest.sitter), ...Array.from(presence.groups.values()).flat().map((animal) => animal.id)]
            .map((id) => (id ? context.placeOf(id) : null))
            .map((at) => (at ? `${at.x.toFixed(2)},${at.z.toFixed(2)}` : "-"))
            .join(";");
        const key = `${presenceKey(presence)}|${placed}`;
        if (key === homesKey && homes) return;
        homesKey = key;
        if (homes) {
            root.remove(homes.group);
            homes.dispose();
        }
        if (webs) {
            root.remove(webs.lines);
            webs.lines.geometry.dispose();
        }
        homes = buildHomes(presence, context.placeOf, tier);
        root.add(homes.group);
        webs = homes.webs.length ? buildWebs(homes.webs) : null;
        if (webs) root.add(webs.lines);
        effects.setGlints(webs?.beads ?? new Float32Array(0), homes.slimeGlints);
        cave.setRoost(homes.roost);
        moved = true;
    };
    rebuildHomes();

    /** The places worth a close look: the nests, the homes' marks, the webs, the cave's mouth. */
    let closeCache: {key: string; spots: Array<{x: number; y: number; z: number}>} = {key: "", spots: []};
    const closeSpots = () => {
        if (closeCache.key === homesKey) return closeCache.spots;
        const inside = cave.toWorld(new Vector3(0, 1.4, -2));
        const spots = [...(homes?.nests ?? []), ...Object.values(homes?.marks ?? {}), ...Object.values(areas.marks), {x: cave.origin.x, y: cave.origin.y + 1.4, z: cave.origin.z}, inside];
        closeCache = {key: homesKey, spots};
        return spots;
    };
    const batches = (): LodBatch[] => [...areas.batches, ...(homes?.batches ?? [])];
    const pieces = (): LodPiece[] => [...areas.pieces, ...cave.pieces];

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
    let shadows = true;

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
            for (const batch of batches()) batch.setShadows(on);
            for (const piece of pieces()) piece.setShadows(on);
        },
        setSnapshot: (next: ArkSnapshot) => {
            snapshot = next;
            rebuildHomes();
            if (homes) for (const batch of homes.batches) batch.setShadows(shadows);
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
                if (areas.setWeather({puddles: conditions.puddles, snowCover: conditions.snowCover, cold: conditions.cold})) moved = true;
                cave.setIcicles(conditions.cold > 0.55 ? conditions.cold : 0);
                // A slime trail glints when wet and in a low, raking light.
                homes?.setGlint(Math.min(1, 0.25 + conditions.wetness * 0.8 + conditions.dawn * 0.4));
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
                if (webs) webs.lines.visible = tier.fine && Math.hypot(x - areas.chimney.x, z - areas.chimney.z) < 400;
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
        marks: (): PropsMarks => ({spots: {...areas.marks, ...(homes?.marks ?? {})}, cave: {x: cave.origin.x, y: cave.origin.y, z: cave.origin.z, facing: cave.facing}}),
        dispose: () => {
            context.scene.remove(root);
            areas.dispose();
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
