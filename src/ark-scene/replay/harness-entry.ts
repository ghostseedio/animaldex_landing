/**
 * The replay harness's page (development only; `scripts/ark-replay-shots.mjs` builds it into `.ark-golden/replay/` and
 * serves it, nothing deploys it). The recording page's own parts (`ark-record-view.tsx`: the recorder's clock, the
 * director, both islands in one world on the live wild island) over a saved read of the real Ark and its real public
 * event log, so a recorded event is replayed exactly as `/ark?record=1&replay=<event id>` films it, many in one load.
 *
 *   __replay.events(kind)            the log's replayable events of a kind, newest first
 *   __replay.make(kind, n)           a harness event of a kind production has none of yet (meal, escaped, last_stand,
 *                                    released), built from animals really aboard: its id
 *   __replay.prepare(id, options)    plan it (`planArkReplayShot`) and have the director prepare it
 *   __replay.frame(quality, step)    the director's next frame
 *   __replay.report()                the shot's own account, and where each of the cast is now
 *   __replay.gone(id, index)         film a recorded event as if one of its animals had left the Ark since (it is taken
 *                                    out of the read, so it must stand in from the event's own record): the record's
 *                                    own events with a stand-in are all insects so far
 *   __replay.card(id)                the event as Ark Lite shows it (words), drawn over the page
 *
 * The world is chosen by the page before this script (`__ARK_WORLD__ = "v2"`, as `runtime/measure-world.ts` does).
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {createArkDirector, type ArkDirector} from "@/ark-scene/director";
import {eats} from "@/ark-scene/food-links";
import {installRecordClock} from "@/ark-scene/record-clock";
import {arkReplayableEvents, planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {arkReplayText, renderArkReplayCard} from "@/ark-scene/replay/text";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {Raycaster, Vector3, type Material, type Mesh, type Object3D} from "three";
import {planArkReplayShot} from "@/lib/ark-clips/replay-shots";
import {arkIslandSnapshot, arkTwoIslands} from "@/lib/ark-islands";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";
const iconUrl = (slug: string) => ICONS + encodeURIComponent(slug) + ".webp";

type Row = Record<string, unknown>;

/** An animal aboard as an event row names one (`voyage_event_animal`). */
function rowAnimal(animal: ArkAnimal, over: Partial<Row> = {}): Row {
    return {id: animal.id, species_profile_id: animal.species_profile_id, name: animal.name, model_slug: animal.model_slug, zone: animal.zone, island: animal.island ?? null, area: animal.area ?? null, enclosure: animal.enclosure ?? null, slot: animal.slot ?? null, slot_rank: animal.slot_rank ?? null, origin: animal.origin ?? "arrived", generation: animal.generation ?? 0, activity: animal.activity ?? null, sociality: animal.sociality ?? null, arrived_at: animal.arrived_at, status: "present", thrive: animal.thrive ?? "ordinary", placeholder: false, ...over};
}

async function main() {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality") ?? "high";
    (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const [read, log] = await Promise.all([fetch("/data/voyage.json").then((r) => r.json()), fetch("/data/events.json").then((r) => r.json())]) as [{snapshot?: unknown}, {events: Row[]}];
    const real = decodeArkSnapshot(read.snapshot ?? read);
    if (!real) throw new Error("the saved read did not decode");
    // "Now" is the saved read's moment: nothing after it is replayed.
    const now = Date.parse(real.as_of ?? "") || Date.now();
    const rows: Row[] = [...log.events];
    let snapshot: ArkSnapshot = real;
    const el = document.getElementById("ark")!;
    const two = arkTwoIslands(real);
    const town = two ? await (await import("@/ark-scene/islands/scene")).loadTownScene({tier: quality === "low" ? "low" : quality === "medium" ? "medium" : "high", animals: arkIslandSnapshot(real, "town").animals}) : null;
    const clock = installRecordClock(window);
    const handle: ArkSceneHandle = mountArk(el, {snapshot: real, modelBase: MODELS, iconUrl, recording: true, hours: 10.5, ...(params.get("lite") === "1" ? {lite: true} : {}), ...(town ? {island: town, wildAnimals: arkIslandSnapshot(real, "wild").animals} : {})});
    const canvas = () => el.querySelector("canvas");
    let director: ArkDirector = createArkDirector({handle, clock, canvas, info: {snapshot, fixture: false, events: rows}});
    clock.tick(0);

    const wild = () => real.animals.filter((animal) => (animal.island ?? "wild") === "wild" && !animal.area);
    /** Big enough to read in a picture, on land, awake by day or at any hour. */
    const filmable = (animal: ArkAnimal, min = 0.5) => displayLength(animal.model_slug, null) >= min && !["open_ocean", "coral_reef", "river_lake", "seashore", "wetland"].includes(animal.zone);
    let serial = 900_000;
    let current: ReturnType<typeof planArkEventReplay> | null = null;
    const tracing = params.get("trace") === "1";
    const traced: Array<{t: number; view: number[]; cast: Array<Array<number | string> | null>}> = [];
    const made = new Map<string, {remove: string[]; move: ArkAnimal | null; sample: boolean}>();

    /** Harness events of the kinds production has none of yet, from animals really aboard (never a made-up animal). */
    const make = (kind: string, n: number): string[] => {
        const ids: string[] = [];
        const at = new Date(now - 20 * 60_000).toISOString();
        const push = (row: Row, extra: {remove?: string[]; move?: ArkAnimal | null} = {}) => {
            const id = String(++serial);
            rows.push({id: Number(id), at, ark_day: real.ark_day ?? null, clutch: null, phrase: null, source: null, thrive: null, parents: [], bringers: [], from_egg: false, species: (row.animal as Row).name, species_profile_id: (row.animal as Row).species_profile_id, other: null, ...row});
            made.set(id, {remove: extra.remove ?? [], move: extra.move ?? null, sample: true});
            ids.push(id);
        };
        if (kind === "meal" || kind === "escaped") {
            // Real pairs of the food chain on the wild island, nearest first: a hunter and one of its own prey kinds aboard.
            const land = wild().filter((animal) => filmable(animal, 0.3));
            const used = new Set<string>();
            const pairs: Array<{hunter: ArkAnimal; prey: ArkAnimal; d: number}> = [];
            for (const hunter of land) for (const prey of land) {
                if (hunter === prey || hunter.model_slug === prey.model_slug || !eats(hunter.model_slug, prey.model_slug)) continue;
                const a = handle.locate(hunter.id);
                const b = handle.locate(prey.id);
                if (a && b) pairs.push({hunter, prey, d: Math.hypot(a.x - b.x, a.z - b.z)});
            }
            pairs.sort((x, y) => x.d - y.d || x.hunter.id.localeCompare(y.hunter.id));
            // (A species once while there are pairs for it; then an animal once: the wild island has few filmable pairs yet.
            // The nearest pairs first: the hunter's foray is put within reach of its prey's home, as the server's are.)
            const order = [...pairs, ...pairs];
            for (let index = 0; index < order.length; index++) {
                const pair = order[index];
                const pass = index < order.length / 2 ? 0 : 1;
                if (ids.length >= n) break;
                if (used.has(pair.hunter.id) || used.has(pair.prey.id)) continue;
                if (pass === 0 && (used.has(pair.hunter.model_slug) || used.has(pair.prey.model_slug))) continue;
                used.add(pair.hunter.model_slug).add(pair.prey.model_slug).add(pair.hunter.id).add(pair.prey.id);
                // The encounter as the server writes it: the hunter's waypoint within a foray's reach (22 m) of the prey's home disc.
                const a = handle.locate(pair.hunter.id)!;
                const b = handle.locate(pair.prey.id)!;
                const k = pair.d > 22 ? 22 / pair.d : 1;
                const encounter = {t: Date.parse(at) / 1000, step: 0, island: "wild", predator: {x: b.x + (a.x - b.x) * k, z: b.z + (a.z - b.z) * k}, prey: {x: b.x, z: b.z, r: 0.5}, d: Math.min(pair.d, 22)};
                if (kind === "meal") push({kind: "meal", animal: rowAnimal(pair.hunter), other: rowAnimal(pair.prey, {status: "eaten"}), encounter, payload: {when: "encounter", encounter}}, {remove: [pair.prey.id]});
                else push({kind: "escaped", animal: rowAnimal(pair.prey), other: rowAnimal(pair.hunter), payload: {when: "encounter", rate: [0.2, 0.3], encounter}});
            }
        } else if (kind === "last_stand") {
            // The only one of its kind on the wild island, and a hunter of its kind aboard there when there is one.
            const counts = new Map<string, number>();
            for (const animal of wild()) counts.set(animal.species_profile_id, (counts.get(animal.species_profile_id) ?? 0) + 1);
            const lone = wild().filter((animal) => counts.get(animal.species_profile_id) === 1 && filmable(animal, 0.6)).sort((a, b) => displayLength(b.model_slug, null) - displayLength(a.model_slug, null) || a.id.localeCompare(b.id));
            const withHunter = lone.map((animal) => {
                const at2 = handle.locate(animal.id);
                // (A hunter of its kind in its own region, D8's "a predator of it present": within 80 m of it.)
                const hunters = wild().filter((other) => other.id !== animal.id && filmable(other) && eats(other.model_slug, animal.model_slug)).map((other) => ({other, where: handle.locate(other.id)})).filter((item) => item.where && at2).map((item) => ({other: item.other, d: Math.hypot(item.where!.x - at2!.x, item.where!.z - at2!.z)})).filter((item) => item.d <= 80).sort((x, y) => x.d - y.d);
                return {animal, hunter: hunters[0]?.other ?? null};
            });
            for (const item of [...withHunter.filter((x) => x.hunter), ...withHunter.filter((x) => !x.hunter)].slice(0, n)) push({kind: "last_stand", animal: rowAnimal(item.animal), other: item.hunter ? rowAnimal(item.hunter) : null});
        } else if (kind === "released") {
            // A zoo resident, as the server would have it after a release: on the wild island, in its own habitat zone.
            const zoo = real.animals.filter((animal) => animal.area === "zoo" && filmable(animal, 0.8)).sort((a, b) => displayLength(b.model_slug, null) - displayLength(a.model_slug, null) || a.id.localeCompare(b.id));
            const seen = new Set<string>();
            for (const animal of zoo) {
                if (ids.length >= n) break;
                if (seen.has(animal.model_slug)) continue;
                seen.add(animal.model_slug);
                const slot = Math.max(0, ...real.animals.filter((other) => other.zone === animal.zone && (other.island ?? "wild") === "wild").map((other) => other.slot ?? 0)) + 1 + ids.length;
                const free: ArkAnimal = {...animal, area: null, island: "wild", enclosure: null, slot, slot_rank: 0};
                push({kind: "released", animal: rowAnimal(free), payload: {from: rowAnimal(animal)}}, {move: free});
            }
        }
        return ids;
    };

    /** The Ark's read as the event's world needs it: a harness meal's prey gone from it, a released animal moved. */
    const worldFor = (id: string): ArkSnapshot => {
        const own = made.get(id);
        if (!own || (!own.remove.length && !own.move)) return real;
        const gone = new Set(own.remove);
        return {...real, animals: real.animals.filter((animal) => !gone.has(animal.id)).map((animal) => (own.move && animal.id === own.move.id ? own.move : animal))};
    };

    const api = {
        ready: true,
        now,
        counts: () => ({animals: real.animals.length, wild: wild().length, events: rows.length, loading: handle.loading()}),
        events: (kind: string, limit = 200) => arkReplayableEvents(rows, now).filter((event) => event.kind === kind).slice(0, limit).map((event) => {
            // (How big its animals are drawn: the harness films the ones a picture can show.)
            const row = rows.find((r) => String(r.id) === event.id)!;
            const names = [row.animal, row.other].map((a) => (a as Row | null)?.model_slug).filter((s): s is string => typeof s === "string");
            return {...event, length: names.length ? Math.max(...names.map((slug) => displayLength(slug, null))) : 0, zone: String((row.animal as Row | null)?.zone ?? ""), island: String((row.animal as Row | null)?.island ?? "")};
        }),
        make,
        plan: (id: string) => planArkEventReplay(id, rows, worldFor(id), {now}),
        prepare: async (id: string, options: {mount?: "cutaway" | "show"; hour?: number | null; nightGain?: number | null} = {}) => {
            const world = worldFor(id);
            if (world !== snapshot) {
                // (A moved animal leaves the roster first: an entry kept across reads keeps the day of its old home.)
                const moved = made.get(id)?.move;
                if (moved) handle.update({...world, animals: world.animals.filter((animal) => animal.id !== moved.id)});
                snapshot = world;
                handle.update(world);
                director = createArkDirector({handle, clock, canvas, info: {snapshot, fixture: false, events: rows}});
            }
            const plan = planArkReplayShot(id, {snapshot, rawEvents: rows, fixture: Boolean(made.get(id)?.sample), now: new Date(now), mount: options.mount, hour: options.hour ?? null, nightGain: options.nightGain ?? null});
            // (Who of the cast the scene had before it was brought in: the rest were outside the live budget, or gone.)
            const before = Object.fromEntries(plan.direction.replay!.cast.map((member) => [member.record.id, Boolean(handle.locate(member.record.id))]));
            const prepared = await director.prepare(plan.direction);
            const replay = plan.direction.replay!;
            current = replay;
            return {models: prepared.models, kind: replay.kind, at: replay.at, t0: replay.t0, hook: plan.hookText, cues: plan.cues.map((cue) => cue.text), cast: replay.cast.map((member) => ({id: member.record.id, role: member.role, name: member.record.name, slug: member.record.model_slug, aboard: member.aboard, inSceneBefore: before[member.record.id], zone: member.record.zone, island: member.record.island ?? null})), notes: replay.notes};
        },
        frame: (quality = 0.85, step = 1) => {
            const frame = director.frame(quality, step);
            // (`?trace=1`: where the camera and each of the cast were at every frame, for the summary.)
            if (tracing && current) {
                const view = handle.view();
                traced.push({t: Math.round(frame.t * 100) / 100, view: [view.target.x, view.target.y, view.target.z, view.distance, view.polar, view.azimuth].map((n) => Math.round(n * 100) / 100), cast: current.cast.map((member) => {
                    const at = handle.locate(member.record.id);
                    return at ? [Math.round(at.x * 100) / 100, Math.round(at.y * 100) / 100, Math.round(at.z * 100) / 100, at.shown ? 1 : 0, at.act ?? ""] : null;
                })});
            }
            return frame;
        },
        trace: () => traced.splice(0),
        /** What the camera's line to each of the cast meets first, whatever it is (a probe: why is it not seen?). */
        probe: () => {
            const debug = (window as unknown as {__arkDebug?: {scene: Object3D; camera: {position: Vector3}}}).__arkDebug;
            if (!debug || !current) return [];
            const ray = new Raycaster();
            return current.cast.map((member) => {
                const at = handle.locate(member.record.id);
                if (!at) return {role: member.role, hits: []};
                const to = new Vector3(at.x, at.y, at.z);
                const span = debug.camera.position.distanceTo(to);
                ray.set(debug.camera.position, to.clone().sub(debug.camera.position).normalize());
                ray.far = span;
                const hits = ray.intersectObject(debug.scene, true).slice(0, 8).map((hit) => {
                    const mesh = hit.object as Mesh;
                    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
                    return `${hit.distance.toFixed(2)}/${span.toFixed(2)} ${mesh.name || "-"}|${String(mesh.userData.kind ?? "-")}|${mesh.parent?.name || "-"} t${material?.transparent ? 1 : 0} o${material?.opacity ?? "?"} dw${material?.depthWrite ? 1 : 0} s${material?.side ?? "?"} i${(mesh as unknown as {count?: number}).count ?? "-"} a${mesh.userData.arkAnimal ? 1 : 0}`;
                });
                return {role: member.role, at: [at.x, at.y, at.z].map((n) => Math.round(n * 100) / 100), shown: at.shown, under: at.under, met: handle.sightMet?.(), hits};
            });
        },
        marks: () => director.marks(),
        report: () => {
            const report = director.replayReport();
            return report ? {...report, where: Object.fromEntries(Object.keys(report.seen).map((id) => [id, handle.locate(id)])), acts: handle.liveActs?.() ?? null, view: handle.view(), stats: handle.stats()} : null;
        },
        /** A recorded event filmed as if one of its cast had left the Ark since: that animal is out of the read for it. */
        gone: (id: string, index = 1) => {
            const who = planArkEventReplay(id, rows, real, {now}).cast[index]?.record.id;
            if (who) made.set(id, {remove: [who], move: null, sample: false});
            return who ?? null;
        },
        /** The scene's own layers' account of the event being replayed (by its keys), and whether one has taken it up. */
        acting: () => {
            const live = handle.liveActs?.();
            const feed = current?.feed;
            if (!live || !feed) return null;
            const mating = feed.matings ? live.matings.find((m) => m.key === feed.matings![0].key) ?? null : undefined;
            const birth = feed.births ? live.births.find((b) => b.key === feed.births![0].key) ?? null : undefined;
            const death = feed.deaths ? live.deaths.find((d) => d.key === feed.deaths![0].key) ?? null : undefined;
            const meal = feed.meals ? live.meals[0] ?? null : undefined;
            const escape = feed.escapes ? live.escapes.find((e) => e.key === feed.escapes![0].key) ?? null : undefined;
            const up = Boolean(mating?.phase === "acting" || birth?.phase === "acting" || death?.drawn || (meal && meal.catchAt > 0) || (escape && escape.missAt !== null));
            return {up, mating, birth, death, meal: meal ? {key: meal.key, catchAt: meal.catchAt, style: meal.style} : meal, escape};
        },
        /** The event in words, as Ark Lite shows it (over the page; removed by the next call). */
        card: (id: string) => {
            document.getElementById("lite-card")?.remove();
            const plan = planArkEventReplay(id, rows, worldFor(id), {now});
            const host = document.createElement("div");
            host.id = "lite-card";
            host.style.cssText = "position:fixed;inset:0;z-index:20;display:flex;align-items:center;padding:16px;background:#0b1422";
            document.body.append(host);
            const text = arkReplayText(plan, null, "en", {sample: Boolean(made.get(id)?.sample) || plan.provisional});
            renderArkReplayCard(host, plan, text, iconUrl);
            return text;
        },
        handle
    };
    (window as unknown as {__replay: typeof api}).__replay = api;
}

main().catch((error) => {
    console.error("[replay]", error?.stack ?? error);
    (window as unknown as {__replayError?: string}).__replayError = String(error?.stack ?? error);
});
