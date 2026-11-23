/**
 * The hunt acts' harness page (development only; `scripts/ark-hunt-clips.mjs`, or `scripts/ark-behaviours-clips.mjs
 * --scenes hunt-...`, builds it into `.ark-golden/hunt/` and serves it, nothing deploys it). The live scene with a
 * cast-only snapshot (`?scene=<name>&mode=catch|miss`) on a controlled clock, and a made-up server record (a meal, or an
 * escape: the event's two animals and its encounter, as the hunting read and the event log would give them) handed to
 * `setMeals` / `addEscapes`: the live world acts it from its step, exactly as it would for a real record.
 * `window.__hunt.shot(s, distance)` sets the world time to `s` seconds after the step and frames the two.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {setAllHuntActs} from "@/ark-scene/hunt-acts";

// (The harness films every act, the ones not live yet too: decision 456.)
setAllHuntActs(true);

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; /** Its stored scientific name, where the scene reads it (a spider's web). */ sci?: string};
type Scene = {zone: string; hours: number; predator: Cast; prey: Cast; /** How far off the camera stands (m): a few of the hunter's lengths. */ distance: number; /** The prey stands this far from the hunter (m) at the encounter, when set. */ gap?: number; /** The hunter starts in the water, at its edge nearest the prey (a crocodilian). */ water?: boolean; /** The camera's angles (radians), where the default view is blocked by the scene. */ azimuth?: number; polar?: number};

const SCENES: Record<string, Scene> = {
    // pounce: a house cat on a rat; leap: a fox on a vole; jump: a jumping spider on a fly
    cat: {zone: "grassland", hours: 10, predator: {slug: "domestic-cat", name: "Domestic Cat"}, prey: {slug: "house-mouse", name: "House Mouse"}, distance: 3.2, gap: 9},
    fox: {zone: "grassland", hours: 10, predator: {slug: "red-fox", name: "Red Fox"}, prey: {slug: "meadow-vole", name: "Meadow Vole"}, distance: 4, gap: 10},
    tiger: {zone: "grassland", hours: 10, predator: {slug: "bengal-tiger", name: "Bengal Tiger"}, prey: {slug: "wild-boar", name: "Wild Boar"}, distance: 12, gap: 25},
    jumper: {zone: "grassland", hours: 10, predator: {slug: "jumping-spider", name: "Jumping Spider"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 0.35, gap: 0.5},
    // dash, lunge, tongue, web
    gecko: {zone: "grassland", hours: 10, predator: {slug: "common-house-gecko", name: "Common House Gecko"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 0.9, gap: 1.6},
    wolf: {zone: "grassland", hours: 10, predator: {slug: "carolina-wolf-spider", name: "Carolina Wolf Spider"}, prey: {slug: "two-spotted-cricket", name: "Two-spotted Cricket"}, distance: 0.5, gap: 0.6},
    mantis: {zone: "grassland", hours: 10, predator: {slug: "chinese-mantis", name: "Chinese Mantis"}, prey: {slug: "house-cricket", name: "House Cricket"}, distance: 0.8, gap: 1.2},
    toad: {zone: "grassland", hours: 10, predator: {slug: "american-toad", name: "American Toad"}, prey: {slug: "two-spotted-cricket", name: "Two-spotted Cricket"}, distance: 0.7, gap: 1.2},
    web: {zone: "grassland", hours: 10, predator: {slug: "orb-weaver-spider", name: "Orb-weaver Spider"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 0.4, gap: 0.5},
    // ARK-WEBS: on the web as drawn (an orb among the woodland's plants; a comb-footed spider's tangle (Steatoda, aboard in the town's woodland)): a honey bee,
    // a fly.
    orb: {zone: "woodland", hours: 10, predator: {slug: "orb-weaver-spider", name: "Orb-weaver Spider", sci: "Araneidae"}, prey: {slug: "western-honey-bee", name: "Western Honey Bee"}, distance: 0.5, gap: 0.5},
    cobweb: {zone: "woodland", hours: 10, predator: {slug: "triangulate-combfoot", name: "Triangulate Combfoot", sci: "Steatoda triangulosa"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 0.4, gap: 0.5},
    // wade, peck, lurk
    heron: {zone: "river_lake", hours: 9, predator: {slug: "grey-heron", name: "Grey Heron"}, prey: {slug: "rainbow-trout", name: "Rainbow Trout"}, distance: 4, gap: 7},
    blackbird: {zone: "grassland", hours: 9, predator: {slug: "common-blackbird", name: "Common Blackbird"}, prey: {slug: "common-earthworm", name: "Common Earthworm"}, distance: 1.1, gap: 3},
    croc: {zone: "river_lake", hours: 9, predator: {slug: "saltwater-crocodile", name: "Saltwater Crocodile"}, prey: {slug: "wild-boar", name: "Wild Boar"}, distance: 12, gap: 8, water: true},
    // drop, hover, plunge, talon
    owl: {zone: "grassland", hours: 10, predator: {slug: "little-owl", name: "Little Owl"}, prey: {slug: "meadow-vole", name: "Meadow Vole"}, distance: 5, gap: 10},
    kestrel: {zone: "grassland", hours: 10, predator: {slug: "common-kestrel", name: "Common Kestrel"}, prey: {slug: "meadow-vole", name: "Meadow Vole"}, distance: 7, gap: 8},
    osprey: {zone: "river_lake", hours: 10, predator: {slug: "osprey", name: "Osprey"}, prey: {slug: "rainbow-trout", name: "Rainbow Trout"}, distance: 10, gap: 15},
    kingfisher: {zone: "river_lake", hours: 10, predator: {slug: "common-kingfisher", name: "Common Kingfisher"}, prey: {slug: "rainbow-trout", name: "Rainbow Trout"}, distance: 4, gap: 8},
    kite: {zone: "river_lake", hours: 10, predator: {slug: "brahminy-kite", name: "Brahminy Kite"}, prey: {slug: "rainbow-trout", name: "Rainbow Trout"}, distance: 8, gap: 15},
    // hawk
    skimmer: {zone: "river_lake", hours: 10, predator: {slug: "slender-skimmer", name: "Slender Skimmer"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 2.4, gap: 6},
    swallow: {zone: "grassland", hours: 10, predator: {slug: "barn-swallow", name: "Barn Swallow"}, prey: {slug: "house-fly", name: "House Fly"}, distance: 3.4, gap: 8}
};

const castId = (k: number, i: number) => `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const speciesId = (k: number) => `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("scene") ?? "cat";
    const mode = params.get("mode") === "miss" ? "miss" : "catch";
    const scene = SCENES[name];
    if (!scene) throw new Error(`no scene ${name}`);
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const casts = [scene.predator, scene.prey];
    const animals: Raw[] = [];
    casts.forEach((c, k) => animals.push({...template, id: castId(k, 0), species_profile_id: speciesId(k), name: c.name, scientific_name: c.sci ?? c.name, model_slug: c.slug, zone: scene.zone, activity: "diurnal", sociality: null, slot: 90 + k, slot_rank: 0} as Raw));
    const snapshot = decodeArkSnapshot({...fixture, animals});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const t0 = Date.UTC(2026, 10, 20, scene.hours) / 1000 + 60;
    const setAt = async (epoch: number) => {
        const ms = epoch * 1000;
        if (!fake) {
            fake = {date: ms, perf: realPerfNow()};
            handle.setClockScale(1, ms);
        } else {
            fake.perf += ms - fake.date;
            fake.date = ms;
        }
        await frames(3);
    };
    await setAt(t0 - 20);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log("[hunt] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    const predatorId = castId(0, 0);
    const preyId = castId(1, 0);
    // ARK-WEBS: a web scene waits for the spider's web to be hung (fitted near the camera), so its catch plays on it.
    type Webs = {web: (id: string) => {hub: {x: number; y: number; z: number}; normal: {x: number; y: number; z: number}; radius: number} | null};
    const webs = () => (window as unknown as {__arkWebs?: Webs}).__arkWebs ?? null;
    const webScene = name === "orb" || name === "cobweb";
    if (webScene) {
        const spot = handle.locate(predatorId);
        if (spot) handle.setView({target: {x: spot.x, y: spot.y, z: spot.z}, distance: 2, polar: 0.8, azimuth: 0.7});
        const by = realPerfNow() + 60_000;
        let t = t0 - 2;
        while (realPerfNow() < by && !webs()?.web(predatorId)) {
            t += 0.5;
            await setAt(t);
            await wait(30);
        }
        console.log("[hunt] web", JSON.stringify(webs()?.web(predatorId) ? {hub: webs()!.web(predatorId)!.hub, radius: webs()!.web(predatorId)!.radius} : null));
        if (!webs()?.web(predatorId)) throw new Error("no web hung for the spider");
    }
    const hunter = handle.locate(predatorId);
    const quarry = handle.locate(preyId);
    if (!hunter || !quarry) throw new Error("cast not placed");
    // The encounter: the prey where it is, the hunter brought to `gap` m from it (a foray's reach), on the line to where it was.
    const d = Math.hypot(quarry.x - hunter.x, quarry.z - hunter.z);
    const gap = scene.gap ?? 12;
    const k = d > gap ? gap / d : 1;
    const hx = quarry.x + (hunter.x - quarry.x) * k;
    const hz = quarry.z + (hunter.z - quarry.z) * k;
    const record = (c: Cast, id: string, k2: number): ArkEventAnimal => ({id, species_profile_id: speciesId(k2), name: c.name, model_slug: c.slug, zone: scene.zone as ArkEventAnimal["zone"], arrived_at: "2026-11-12T00:00:00Z", origin: "arrived", generation: 0, slot: 90 + k2, slot_rank: 0, activity: "diurnal" as ArkEventAnimal["activity"], sociality: null, status: null});
    let from = {x: hx, z: hz};
    if (scene.water) {
        // The nearest water to the prey, on rings round it.
        search: for (let r = 2; r <= 30; r += 2) {
            for (let a = 0; a < 24; a++) {
                const x = quarry.x + Math.sin((a / 24) * Math.PI * 2) * r;
                const z = quarry.z + Math.cos((a / 24) * Math.PI * 2) * r;
                if (handle.heightAt(x, z) < -0.06) {
                    from = {x, z};
                    break search;
                }
            }
        }
    }
    // (ARK-WEBS: the web scenes' records are the engine's web catches, `encounter.web`.)
    const encounter = {t: t0, predator: from, prey: {x: quarry.x, z: quarry.z, r: 0.5}, ...(name === "orb" || name === "cobweb" ? {web: true} : {})};
    if (mode === "catch") {
        // (A record's act begins 75 s after its row (`ark-act-hold.ts`): the row is dated so that it begins at the step.)
        const act: Extract<ArkAct, {kind: "meal"}> = {kind: "meal", at: new Date((t0 - 75) * 1000).toISOString(), predator: record(scene.predator, predatorId, 0), prey: record(scene.prey, preyId, 1), phrase: null, extinct: false, encounter};
        handle.setMeals?.([act]);
    } else {
        handle.addEscapes?.([{key: `escape:${name}`, prey: preyId, predator: predatorId, t0, encounter}]);
    }
    await setAt(t0 + 0.05);
    await frames(4);
    type Debug = {meals: () => Array<{t0: number; catchAt: number; hunt: string | null}>; escapes: () => Array<{hunt: string | null; missAt: number | null; seconds: number | null; kind: string | null; closest: number | null; gap: number | null; phase: string}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    // (The act is built on the first frame both animals are in the scene: asked for a few seconds.)
    const waitUntil = realPerfNow() + 8000;
    while (realPerfNow() < waitUntil && !(mode === "catch" ? debug.meals()[0]?.catchAt : debug.escapes()[0]?.seconds)) {
        await setAt(t0 + 0.1);
        await wait(150);
    }
    if (!(mode === "catch" ? debug.meals()[0]?.catchAt : debug.escapes()[0]?.seconds)) throw new Error(`no act built: ${JSON.stringify(mode === "catch" ? debug.meals() : debug.escapes())}`);
    const stateOf = (id: string) => {
        const e = debug.entries().find((x) => x.animal.id === id);
        return e?.act ? `${String(e.act.state ?? "-")}${e.act.hidden ? " hidden" : ""}` : "-";
    };
    const strikeAt: number | null = (mode === "catch" ? debug.meals()[0]?.catchAt : debug.escapes()[0]?.missAt) ?? null;
    const api = {
        info: () => {
            const meal = debug.meals()[0];
            const escape = debug.escapes()[0];
            return {mode, act: (mode === "catch" ? meal?.hunt : escape?.hunt) ?? null, catchAt: meal?.catchAt ?? null, missAt: escape?.missAt ?? null, seconds: escape?.seconds ?? null, kind: escape?.kind ?? null, closest: escape?.closest ?? null, gap: escape?.gap ?? null, predator: scene.predator.slug, prey: scene.prey.slug};
        },
        /** The world at `s` seconds after the step, framed on the two from `distance` (or `scene.distance`). */
        shot: async (s: number, distance?: number, azimuth = 0.7, polar = 0.7) => {
            await setAt(t0 + s - 1.2);
            for (let i = 1; i <= 12; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const a = handle.locate(predatorId);
            const b = handle.locate(preyId);
            // ARK-WEBS: a web's catch is framed on the web itself, square to its face, at the scene's distance.
            const hung = webScene ? webs()?.web(predatorId) ?? null : null;
            if (hung) {
                const d0 = distance ?? scene.distance;
                const rig = debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
                rig.controls.minDistance = Math.min(rig.controls.minDistance, d0);
                rig.camera.near = Math.min(0.01, d0 / 30);
                rig.camera.updateProjectionMatrix();
                const n = hung.normal;
                const flat = Math.hypot(n.x, n.z);
                const az = flat > 0.3 ? Math.atan2(n.x, n.z) : azimuth;
                const po = flat > 0.3 ? 1.25 : 0.35;
                const target = {x: hung.hub.x, y: hung.hub.y - hung.radius * 0.2, z: hung.hub.z};
                const clear = handle.clearView?.(target, d0, po, az, [target]) ?? null;
                handle.setView({target, distance: d0, polar: clear?.polar ?? po, azimuth: clear?.azimuth ?? az});
            } else if (a && b) {
                // Readable catch frames: around the strike (1.5 s either side) the camera holds on the hunter at the scene's
                // own distance (a few of its lengths), whatever the gap, so the catch fills the frame; before it, both are
                // framed with a margin in the scene's own scale (it was a flat +1 m and +0.2 m: a spider's catch was a dot).
                const d0 = distance ?? scene.distance;
                const near = strikeAt !== null && Math.abs(s - strikeAt) <= 1.5;
                const x = near ? a.x * 0.75 + b.x * 0.25 : (a.x + b.x) / 2;
                const z = near ? a.z * 0.75 + b.z * 0.25 : (a.z + b.z) / 2;
                const ground = handle.heightAt(x, z);
                const y = Math.max(near ? a.y : (a.y + b.y) / 2, Math.max(ground, 0)) + 0.06 * d0;
                const span = Math.hypot(a.x - b.x, a.z - b.z);
                // Near the strike: a few of the hunter's own lengths (the cat's 0.5 m: 1.6 m), never wider than the scene's distance.
                const dist = near ? Math.max(Math.min(d0, 3.2 * (a.length || d0)), span * 0.9, 0.12) : Math.max(d0, span * 1.15 + 0.3 * d0);
                // (Near the strike, from higher up: posts, trunks and grass round a small hunter hid the catch from the side.)
                polar = near ? Math.min(polar, 0.45) : polar;
                // (Closer than the page lets a visitor come, as the behaviours harness does: a jumping spider is 1 cm long.)
                const rig = debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
                rig.controls.minDistance = Math.min(rig.controls.minDistance, dist);
                rig.camera.near = Math.min(0.03, dist / 20);
                rig.camera.updateProjectionMatrix();
                // (From the clearest side, `clearView`: trunks, posts and canopy between the camera and the catch hid it.)
                const clear = handle.clearView?.({x, y, z}, dist, scene.polar ?? polar, scene.azimuth ?? azimuth, [{x: a.x, y: a.y, z: a.z}, {x: b.x, y: b.y, z: b.z}]) ?? null;
                const view: ArkCameraView = {target: {x, y, z}, distance: dist, polar: clear?.polar ?? scene.polar ?? polar, azimuth: clear?.azimuth ?? scene.azimuth ?? azimuth};
                handle.setView(view);
            }
            await frames(3);
            return `+${s.toFixed(1)} s   hunter: ${stateOf(predatorId)}   prey: ${stateOf(preyId)}`;
        },
        handle
    };
    (window as unknown as {__hunt: typeof api}).__hunt = api;
}

main().catch((error) => {
    console.error("[hunt]", error?.stack ?? error);
    (window as unknown as {__huntError?: string}).__huntError = String(error?.stack ?? error);
});
