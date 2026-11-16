/**
 * The behaviours harness's page (development only; `scripts/ark-behaviours-clips.mjs` builds it into
 * `.ark-golden/behaviours/` and serves it, nothing deploys it). The live scene with a cast-only snapshot
 * (`?scene=birth|den|contest|dung`) on a controlled clock, and made-up record events (a litter, a mating) handed to
 * `addBirths` / `addMatings` exactly as the events controller would: the live world acts them from their time.
 * `window.__behaviours.shot(s, distance, follow)` sets the world time to `s` seconds after the event and frames it.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import {NURSE_SLOT_MS, nursingBout} from "@/ark-scene/young-care";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; young?: number};
type Scene = {zone: string; hours: number; cast: Cast[]; kind: "birth" | "mating" | "dung" | "nurse" | "look" | "carry"; /** 3.3 batch (C): the young born `bornAgo` Ark days before the scene's clock (default 2), not on the fixture's day. */ young?: "new"; bornAgo?: number};

const lookCast = (name: string): Cast => ({slug: name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-"), name, n: 1, young: 1});
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
    // 3.3 batch (C): a foal at its recorded mother's heel (a birth of an hour ago), coming to her flank to suckle.
    nurse: {zone: "grassland", hours: 9, kind: "nurse", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 3, young: 1}]},
    // 3.3 batch (C): juvenile coats (`young-coat.ts`): one adult and one young of each, the young two Ark days old.
    coats: {zone: "grassland", hours: 10, kind: "look", young: "new", cast: ["Wild Boar", "South American Tapir", "Baird's Tapir", "Collared Peccary", "African Lion", "Francois' Langur", "Blue Wildebeest", "Mantled Guereza"].map(lookCast)},
    coats2: {zone: "wetland", hours: 10, kind: "look", young: "new", cast: ["Saltwater Crocodile", "Spectacled Caiman", "Leopard Gecko", "Red Tegu", "Black Spiny-tailed Iguana", "Emerald Tree Boa", "Eastern Rat Snake", "Southeastern Five-lined Skink", "Little Blue Heron", "Scarlet Ibis", "Sun Conure", "Ring-billed Gull"].map(lookCast)},
    coats4: {zone: "grassland", hours: 10, kind: "look", young: "new", cast: ["Saltwater Crocodile", "Spectacled Caiman", "Leopard Gecko", "Red Tegu", "Eastern Rat Snake", "Southeastern Five-lined Skink", "African Lion", "Collared Peccary", "Zebra Shark", "Gray Angelfish"].map(lookCast)},
    coats3: {zone: "coral_reef", hours: 10, kind: "look", young: "new", cast: ["Gray Angelfish", "Blue Tang", "Zebra Shark", "Brownbanded Bamboo Shark", "Bluestreak Cleaner Wrasse", "Blueface Angelfish", "Greater Amberjack", "Goldfish", "Iridescent Shark", "Boeseman's Rainbowfish"].map(lookCast)},
    // 3.3 batch (C): a hatching of the record: a crocodile mother carries her hatchlings to the water at her jaw; a
    // mouthbrooder's fry come and go at the parent's mouth (`mouth-carry.ts`).
    carry: {zone: "wetland", hours: 10, kind: "carry", young: "new", bornAgo: 0, cast: [{slug: "saltwater-crocodile", name: "Saltwater Crocodile", n: 2, young: 4}]},
    brood: {zone: "river_lake", hours: 10, kind: "carry", young: "new", bornAgo: 0, cast: [{slug: "nile-tilapia", name: "Nile Tilapia", n: 2, young: 6}]},
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
    // 3.3 batch (C): a young one born two Ark days before the scene's own clock (the fixture's day is weeks before it).
    const bornDay = scene.kind === "nurse" || scene.young === "new" ? (Date.UTC(2026, 10, 20, scene.hours) - Date.parse(fixture.voyage.started_at)) / ((86_400_000 * 14) / 365) - (scene.bornAgo ?? 2) : day;
    const animals: Raw[] = [];
    const youngIds: string[] = [];
    scene.cast.forEach((c, k) => {
        for (let i = 0; i < c.n + (c.young ?? 0); i++) {
            const young = i >= c.n;
            if (young) youngIds.push(castId(k, i));
            animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: "diurnal", sociality: "group", slot: 90 + k, slot_rank: i, origin: young ? "born" : "arrived", born_ark_day: young ? bornDay : 0} as Raw);
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
    if (scene.kind === "carry") handle.addHatchings?.([{key: "hatch:harness", parents: [a, b], young: youngIds, t0}]);
    // 3.3 batch (C): the record told this birth an hour ago (too old to act out): the young one's parents are the two
    // adults its seeded pick is NOT, so the frames show the record's mother, not the pick.
    const live = (debug as unknown as {liveliness: {parentOf: (id: string) => string | null; nursing: Map<string, {mother: string; key: string; at: number}>}}).liveliness;
    const nurseInfo: {picked: string | null; parents: string[]; mother: string | null; bout: number | null} = {picked: null, parents: [], mother: null, bout: null};
    if (scene.kind === "nurse") {
        const adults = [0, 1, 2].map((i) => castId(0, i));
        nurseInfo.picked = live.parentOf(youngIds[0]);
        nurseInfo.parents = adults.filter((id) => id !== nurseInfo.picked).slice(0, 2);
        handle.addBirths?.([{key: "birth:harness-old", parents: nurseInfo.parents, young: youngIds, t0: t0 - 3600}]);
        nurseInfo.mother = live.parentOf(youngIds[0]);
    }
    await setAt(t0 + 0.05);
    await frames(4);
    const at0 = handle.locate(a);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.5, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    const laneCScene = scene.kind === "nurse" || scene.kind === "look" || scene.kind === "carry";
    const schedPoint = (id: string): {x: number; z: number} | null => {
        const e = (debug.entries() as unknown as Array<{animal: {id: string}; act?: {x: number; z: number} | null; sched?: {pose?: {x: number; z: number} | null}}>).find((x) => x.animal.id === id);
        const p = e?.act ?? e?.sched?.pose;
        return p ? {x: p.x, z: p.z} : null;
    };
    /** 3.3 batch (C): what the frame should show of the young one and its mother (their distance in her lengths, its card). */
    const laneC = (): string => {
        if (scene.kind === "carry") {
            const h = (debug as unknown as {hatchings: () => Array<{carrier: string | null; kind: string | null; phase: string; said: string | null}>}).hatchings()[0];
            const seen = handle.seen?.().acts.filter((x) => x.recipe === "mouth_carry").map((x) => x.line) ?? [];
            return `\n${h ? `${h.kind} ${h.phase}, said: ${h.said ?? "-"}` : "no hatching"}   log: ${seen[0] ?? "-"}`;
        }
        if (scene.kind !== "nurse" || !nurseInfo.mother) return "";
        const m = schedPoint(nurseInfo.mother);
        const y = schedPoint(youngIds[0]);
        const sched = (id: string) => (debug.entries() as unknown as Array<{animal: {id: string}; length: number; sched?: {pose?: {doing?: string; moving?: boolean}}}>).find((e) => e.animal.id === id);
        const fresh = live.nursing.get(youngIds[0]);
        return `\nyoung ${m && y ? (Math.hypot(m.x - y.x, m.z - y.z) / (sched(nurseInfo.mother)?.length || 1)).toFixed(2) : "?"} of her lengths from its mother   young: ${sched(youngIds[0])?.sched?.pose?.doing} card ${handle.animalStatus?.(youngIds[0])?.activity ?? "-"}   mother: ${sched(nurseInfo.mother)?.sched?.pose?.doing}${sched(nurseInfo.mother)?.sched?.pose?.moving ? " moving" : ""}   suckling ${fresh && Math.abs(fresh.at - Date.now()) < 1500 ? "yes" : "no"}`;
    };
    const api = {
        info: () => ({births: debug.births(), matings: debug.matings(), hatchings: (debug as unknown as {hatchings: () => Array<Record<string, unknown>>}).hatchings(), young: youngIds, a, b, nurse: nurseInfo, cast: scene.cast.map((c, k) => ({name: c.name, adult: castId(k, 0), young: castId(k, c.n)}))}),
        /** 3.3 batch (C): a young one of the cast and its kind's adult side by side in the frame (the adult brought beside it for the picture). */
        pair: async (k: number) => {
            const young = castId(k, scene.cast[k].n);
            type Drawn = {animal: {id: string}; youngCoat?: {steps: number}; level?: string; length: number; middle?: {x: number; y: number; z: number} | null; sched?: {pose?: {x: number; y: number; z: number} | null}};
            const entry = () => (debug.entries() as unknown as Drawn[]).find((x) => x.animal.id === young);
            let text = `${scene.cast[k].name}: not placed`;
            // (Three passes: the camera to where its schedule has it, then to where it is drawn once it is in view.)
            for (let pass = 0; pass < 3; pass++) {
                const e = entry();
                const p = e?.sched?.pose;
                if (!e || !p) return text;
                const near = e.middle && Math.hypot(e.middle.x - p.x, e.middle.z - p.z) < 3 ? e.middle : p;
                handle.setView({target: {x: near.x, y: near.y, z: near.z}, distance: Math.max(e.length * 3, 0.3), polar: 0.95, azimuth: 0.7});
                for (let i = 0; i < 12; i++) {
                    fake!.perf += 100;
                    fake!.date += 100;
                    await frames(1);
                }
                text = `${scene.cast[k].name}: young coat steps ${e.youngCoat?.steps ?? "-"} (${e.level ?? "?"}, ${e.length.toFixed(2)} m)`;
            }
            await frames(4);
            return text;
        },
        /** 3.3 batch (C): the young one's first nursing bout after the scene's start (s after t0), from the shared clock. */
        nurseBout: () => {
            const id = youngIds[0];
            for (let slot = Math.floor((t0 * 1000) / NURSE_SLOT_MS), n = 0; n < 40; slot++, n++) {
                let start = -1;
                let end = -1;
                for (let ms = slot * NURSE_SLOT_MS; ms < (slot + 1) * NURSE_SLOT_MS; ms += 250) {
                    if (!nursingBout(id, ms)) continue;
                    if (start < 0) start = ms;
                    end = ms;
                }
                if (start / 1000 < t0 + 20) continue;
                nurseInfo.bout = start / 1000 - t0;
                return {start: nurseInfo.bout, length: (end - start) / 1000};
            }
            return null;
        },
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
            // 3.3 batch (C): lane C's scenes frame where its schedule has it now (`locate` is where it was last drawn).
            const who = point ?? (laneCScene ? schedPoint(follow ?? a) : null) ?? handle.locate(follow ?? a) ?? at0;
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
            return `+${s.toFixed(1)} s   card a: ${status(a)}   card b: ${status(b)}   dung marks: ${api.dung().length}\n${acts.join("\n")}${laneC()}`;
        },
        handle
    };
    (window as unknown as {__behaviours: typeof api}).__behaviours = api;
}

main().catch((error) => {
    console.error("[behaviours]", error?.stack ?? error);
    (window as unknown as {__behavioursError?: string}).__behavioursError = String(error?.stack ?? error);
});
