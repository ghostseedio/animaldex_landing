/**
 * The behaviours harness's page (development only; `scripts/ark-behaviours-clips.mjs` builds it into
 * `.ark-golden/behaviours/` and serves it, nothing deploys it). The live scene with a cast-only snapshot
 * (`?scene=birth|den|contest|dung`) on a controlled clock, and made-up record events (a litter, a mating) handed to
 * `addBirths` / `addMatings` exactly as the events controller would: the live world acts them from their time.
 * `window.__behaviours.shot(s, distance, follow)` sets the world time to `s` seconds after the event and frames it.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; young?: number};
type Scene = {zone: string; hours: number; cast: Cast[]; kind: "birth" | "mating" | "dung" | "mob"};

const SCENES: Record<string, Scene> = {
    // A foal born in the open: licked, up on wobbly legs, suckling.
    birth: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 3, young: 1}]},
    // Cubs born in the den: tucked at her belly.
    den: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "african-lion", name: "African Lion", n: 2, young: 2}]},
    // The rut: a rival stag first, then the mating.
    contest: {zone: "grassland", hours: 8, kind: "mating", cast: [{slug: "red-deer", name: "Red Deer", n: 6}]},
    // The webs of a garden's spiders, respun through the day.
    web: {zone: "farm_garden", hours: 7, kind: "dung", cast: [{slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", n: 3}]},
    // A dormant kind: in its dens while the server says so (the marmots), the others about (the zebras).
    dormant: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "alpine-marmot", name: "Alpine Marmot", n: 4}, {slug: "plains-zebra", name: "Plains Zebra", n: 3}]},
    // 3.3 batch (B): magpies mobbing a fox near them, in turns (`mobbing.ts`; started by hand here, the cast is placed apart).
    mob: {zone: "grassland", hours: 9, kind: "mob", cast: [{slug: "australian-magpie", name: "Australian Magpie", n: 4}, {slug: "red-fox", name: "Red Fox", n: 1}, {slug: "coyote", name: "Coyote", n: 1}, {slug: "bobcat", name: "Bobcat", n: 1}, {slug: "tawny-owl", name: "Tawny Owl", n: 1}, {slug: "red-tailed-hawk", name: "Red-tailed Hawk", n: 1}]},
    // A herd's droppings along its day.
    dung: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 6}, {slug: "african-lion", name: "African Lion", n: 2}]}
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
    const scene = SCENES[params.get("scene") ?? "birth"];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const day = fixture.voyage.ark_day;
    const animals: Raw[] = [];
    const youngIds: string[] = [];
    scene.cast.forEach((c, k) => {
        for (let i = 0; i < c.n + (c.young ?? 0); i++) {
            const young = i >= c.n;
            if (young) youngIds.push(castId(k, i));
            animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: "diurnal", sociality: "group", slot: 90 + k, slot_rank: i, origin: young ? "born" : "arrived", born_ark_day: young ? day : 0} as Raw);
        }
    });
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
    console.log("[behaviours] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    type Debug = {births: () => Array<Record<string, unknown>>; matings: () => Array<Record<string, unknown>>; traces: () => Array<{kind: string; x: number; z: number; alpha: number}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>; mobbing?: () => unknown[]; mobStart?: (bird: string, threat: string) => boolean; seenNow?: () => Array<{name: string; line?: string; episode: string}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const a = castId(0, 0);
    const b = castId(0, 1);
    if (scene.kind === "birth") handle.addBirths?.([{key: "birth:harness", parents: [a, b], young: youngIds, t0}]);
    if (scene.kind === "mating") handle.addMatings?.([{key: "mated:harness", a, b, t0}]);
    await setAt(t0 + 0.05);
    await frames(4);
    // (The first of the cast's predators that is out in the open now: not in its den, not on the wing.)
    let foe = castId(1, 0);
    if (scene.kind === "mob") {
        for (let k = 1; k < scene.cast.length; k++) {
            const at = handle.locate(castId(k, 0));
            if (at && at.y > at.ground + 0.05 && at.y < at.ground + 6 && debug.mobStart?.(a, castId(k, 0))) {
                foe = castId(k, 0);
                console.log("[behaviours] mobbing", scene.cast[k].slug, JSON.stringify(at));
                break;
            }
        }
    }
    const at0 = handle.locate(a);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.5, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    const api = {
        info: () => ({births: debug.births(), matings: debug.matings(), young: youngIds, a, b, c: foe, mobbing: debug.mobbing?.() ?? []}),
        dung: () => debug.traces().filter((t) => t.kind === "dung"),
        /** The first cast's kind dormant (or awake again), then what the scene shows of every animal. */
        dormant: async (on: boolean) => {
            handle.setDormant?.(on ? [speciesId(0)] : []);
            await frames(6);
            return debug.entries().map((e) => `${e.animal.model_slug} ${e.act ? `${String(e.act.meal)}${e.act.hidden ? " hidden" : ""}` : "about"} card:${handle.animalStatus?.(e.animal.id)?.activity ?? "-"}`);
        },
        /** The webs' mesh: where its first web is, how many threads, and the clock's place in the webs' cycle. */
        webs: () => {
            const lines = (debug as unknown as {scene: {getObjectByName: (n: string) => {geometry: {attributes: Record<string, {array: Float32Array; count: number}>}; visible: boolean} | undefined}}).scene.getObjectByName("props:webs");
            if (!lines) return null;
            const p = lines.geometry.attributes.position.array;
            return {x: p[0], y: p[1], z: p[2], vertices: lines.geometry.attributes.position.count, seed: lines.geometry.attributes.aSeed.array[0], visible: lines.visible};
        },
        /** The view on an animal where it is now, in the air too (after a `shot`, the clock standing). */
        closeOn: async (id: string, distance: number, polar = 1.35) => {
            const act = debug.entries().find((e) => e.animal.id === id)?.act as {x: number; z: number; base: number} | null | undefined;
            const at = act ? {x: act.x, y: act.base + 0.15, z: act.z} : handle.locate(id);
            if (at) handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth: 0.7});
            await frames(3);
        },
        /** The world at an absolute time (s), looking at a point from close by. */
        look: async (epoch: number, at: {x: number; y: number; z: number}, distance: number) => {
            await setAt(epoch);
            handle.setView({target: at, distance, polar: 1.35, azimuth: 0.4});
            await frames(6);
        },
        /** The world at `s` seconds after the event, from `distance`, on an animal (`follow`) or a point. */
        shot: async (s: number, distance: number, follow?: string, point?: {x: number; z: number}, azimuth = 0.7, polar = 1.15) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = point ?? handle.locate(follow ?? a) ?? at0;
            handle.setView(view(distance, {x: who.x, z: who.z}, polar, azimuth));
            await frames(3);
            // (The dung list is made every 2 s of the page's clock: a moment more for it.)
            fake!.perf += 2100;
            fake!.date += 2100;
            await frames(3);
            const acts = debug
                .entries()
                .filter((e) => e.act)
                .map((e) => `${e.animal.id.slice(-3)} ${e.animal.model_slug} ${String(e.act!.meal ?? "-")} ${String(e.act!.state ?? "")}${e.act!.hidden ? " hidden" : ""}${e.act!.lying ? ` lying ${Number(e.act!.lying).toFixed(2)}` : ""}`);
            const status = (id: string) => handle.animalStatus?.(id)?.activity ?? "-";
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            return `+${s.toFixed(1)} s   card a: ${status(a)}   card b: ${status(b)}   dung marks: ${api.dung().length}\n${acts.concat(said).join("\n")}${scene.kind === "mob" ? `\n${JSON.stringify(debug.mobbing?.())} rigs ${JSON.stringify(scene.cast[0] ? Array.from({length: scene.cast[0].n}, (_, i) => (debug as unknown as {rigState: (id: string) => unknown}).rigState(castId(0, i))).concat((debug as unknown as {rigState: (id: string) => unknown}).rigState(foe)) : [])}` : ""}`;
        },
        handle
    };
    (window as unknown as {__behaviours: typeof api}).__behaviours = api;
}

main().catch((error) => {
    console.error("[behaviours]", error?.stack ?? error);
    (window as unknown as {__behavioursError?: string}).__behavioursError = String(error?.stack ?? error);
});
