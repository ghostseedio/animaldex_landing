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
type Scene = {zone: string; hours: number; cast: Cast[]; kind: "birth" | "mating" | "dung" | "defence"};

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
    // 3.3 batch (A): defence moves. The first cast is the species with the move, the second a predator of it by the ecology's own food
    // links, which the harness stands next to it (`threat`): the reactive layer does the rest.
    curl: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "european-hedgehog", name: "European Hedgehog", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pangolin: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "sunda-pangolin", name: "Sunda Pangolin", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pill: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "pill-millipede", name: "Pill Millipede", n: 2}, {slug: "common-frog", name: "Common Frog", n: 1}]},
    coil: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "ball-python", name: "Ball Python", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    millipede: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-millipede", name: "Giant African Millipede", n: 2}, {slug: "cane-toad", name: "Cane Toad", n: 1}]},
    shell: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "greek-tortoise", name: "Greek Tortoise", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    snail: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-land-snail", name: "Giant African Land Snail", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    hermit: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "rugose-hermit-crab", name: "Rugose Hermit Crab", n: 2}, {slug: "asian-small-clawed-otter", name: "Asian Small-clawed Otter", n: 1}]},
    puff: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "southern-toad", name: "Southern Toad", n: 2}, {slug: "common-raccoon", name: "Common Raccoon", n: 1}]},
    monitor: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "savannah-monitor", name: "Savannah Monitor", n: 2}, {slug: "coyote", name: "Coyote", n: 1}]},
    puffer: {zone: "coral_reef", hours: 10, kind: "defence", cast: [{slug: "stars-and-stripes-pufferfish", name: "Stars and Stripes Pufferfish", n: 2}, {slug: "blacktip-reef-shark", name: "Blacktip Reef Shark", n: 1}]},
    flash: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "scarlet-tiger-moth", name: "Scarlet Tiger Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    eyes: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "polyphemus-moth", name: "Polyphemus Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    peacock: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "peacock-butterfly", name: "Peacock Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    owl: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "owl-butterfly", name: "Owl Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    harnessed: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "harnessed-moth", name: "Harnessed Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    blotched: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "green-blotched-moth", name: "Green-blotched Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    lubber: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-lubber-grasshopper", name: "Eastern Lubber Grasshopper", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    tail: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    salamander: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-red-backed-salamander", name: "Eastern Red-backed Salamander", n: 2}, {slug: "common-rat-snake", name: "Common Rat Snake", n: 1}]},
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
    type Debug = {births: () => Array<Record<string, unknown>>; matings: () => Array<Record<string, unknown>>; traces: () => Array<{kind: string; x: number; z: number; alpha: number}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const a = castId(0, 0);
    const b = castId(0, 1);
    if (scene.kind === "birth") handle.addBirths?.([{key: "birth:harness", parents: [a, b], young: youngIds, t0}]);
    if (scene.kind === "mating") handle.addMatings?.([{key: "mated:harness", a, b, t0}]);
    await setAt(t0 + 0.05);
    await frames(4);
    const at0 = handle.locate(a);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.5, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    const api = {
        info: () => ({births: debug.births(), matings: debug.matings(), young: youngIds, a, b}),
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
            return `+${s.toFixed(1)} s   card a: ${status(a)}   card b: ${status(b)}   dung marks: ${api.dung().length}\n${acts.join("\n")}`;
        },
        /**
         * 3.3 batch (A): the predator (the second cast) stood `gap` body lengths of the first cast's animal from it, or
         * taken away again (null): its shared pose pinned there (`pinShared`), so the reactive layer sees a real predator.
         */
        threat: (gap: number | null) => {
            const pin = (debug as unknown as {pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void}).pinShared;
            const predator = castId(1, 0);
            const at = handle.locate(a);
            if (gap === null || !at) return void pin(predator, null);
            const length = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number};
            const x = at.x + Math.max(gap * length.length, 0.25);
            pin(predator, () => ({x, y: Math.max(handle.heightAt(x, at.z), 0), z: at.z, yaw: -Math.PI / 2, moving: false, aloft: false, doing: "watch"}));
        },
        /** 3.3 batch (A): the world run on for `seconds` (a tenth of a second a frame), then the first cast's animal framed from `lengths` of its body away. */
        run: async (seconds: number, lengths: number, azimuth = 0.7, polar = 1.1) => {
            for (let i = 0; i < Math.round(seconds * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = handle.locate(a) ?? at0;
            const drawn = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const length = drawn.length;
            // (Its drawn middle: a moth is on a wall, a pufferfish under the water, not on the ground at its place.)
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : {x: who.x, y: Math.max(handle.heightAt(who.x, who.z), 0) + length * 0.3, z: who.z};
            // (Closer than the page lets a visitor come: these are small animals, and the move is in the body's shape.)
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            for (let i = 0; i < 3; i++) {
                controls.minDistance = 0.08;
                handle.setView({target, distance: Math.max(lengths * length, 0.12), polar, azimuth});
                await frames(1);
            }
            return `${api.defence()}   length ${length.toFixed(3)} m`;
        },
        /** What the first cast's animal does now: the reactive layer's action, its move, and what the scene reports as seen. */
        defence: () => {
            const d = (debug as unknown as {defence: (id: string) => {amount: number; tail: number; shed: number; episode: number} | null}).defence(a);
            const micro = (debug.entries().find((e) => e.animal.id === a) as unknown as {place: {micro?: unknown}; defenceNear?: number; level?: string});
            const seen = handle.seen?.().acts.filter((act) => act.recipe.startsWith("defence_")).map((act) => act.line) ?? [];
            return `action: ${micro.place.micro ? `(at its microhabitat) predator beside it ${micro.defenceNear ?? 0}` : handle.reactive?.(a)?.action ?? "-"}   move: ${d ? `amount ${d.amount.toFixed(2)} tail ${d.tail.toFixed(2)} shed ${d.shed.toFixed(1)} episode ${d.episode}` : "-"}   seen: ${seen.join(" / ") || "-"}   drawn as: ${micro.level ?? "-"}`;
        },
        handle
    };
    (window as unknown as {__behaviours: typeof api}).__behaviours = api;
}

main().catch((error) => {
    console.error("[behaviours]", error?.stack ?? error);
    (window as unknown as {__behavioursError?: string}).__behavioursError = String(error?.stack ?? error);
});
