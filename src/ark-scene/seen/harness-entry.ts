/**
 * V1's harness page (development only; `scripts/ark-seen-shots.mjs` builds it into `.ark-golden/seen/` and serves it,
 * nothing deploys it): the LIVE path over a saved read of the real Ark and its real public event log. For each line it
 * does what a viewer's page does: the record arrives (the row handed to the live log's own controller a little after
 * its release), its cast is brought in, the layers are fed, the line is tapped, and the act is watched
 * (`seen/watch.ts`) on a running clock at the event's own time. Frames are stepped, so a clip is an exact 30 fps.
 *
 *   __seen.lines(kind, n)      the lines to film: the record's own (mated, birth, death), and harness events from
 *                              animals really aboard for the kinds production has none of yet (meal, escaped)
 *   __seen.prepare(id)         the record arrives, the clock runs on to a little before the act, the line is tapped
 *   __seen.frame(quality, step) the next frame; `done` once the watch has ended
 *   __seen.report()            the watch's own account, the layers', the cast's
 *   __seen.lite(id)            the line in words, as Ark Lite's feed says it
 *   __seen.depart(n)           an animal leaves the Ark between two reads (it is taken out of the read): its fade
 *   __seen.mark(what)          the marks on a real animal, from a FIXTURE of the reads that are not live yet: "last" (an
 *                              open crisis of the crises read's shape, E4) and "lone" (E3's field): the ring, the box's line
 *
 * The world is chosen by the page before this script (`__ARK_WORLD__ = "v2"`, as `runtime/measure-world.ts` does).
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {eats} from "@/ark-scene/food-links";
import {escapeItems, escapeText} from "@/ark-scene/live/escape-lines";
import {ArkLive, arkLiveTextOf} from "@/ark-scene/live/controller";
import {installRecordClock} from "@/ark-scene/record-clock";
import {arkReplayableEvents, planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {arkPinnedMs, pinArkClock} from "@/ark-scene/shared-clock";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandSnapshot, arkTwoIslands} from "@/lib/ark-islands";
import {decodeArkEvents} from "@/lib/ark-life";
import {arkLiveLineText, arkLiveServerItems} from "@/lib/ark-live-log";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";
const iconUrl = (slug: string) => ICONS + encodeURIComponent(slug) + ".webp";
const FPS = 30;
const WATER = ["open_ocean", "coral_reef", "river_lake", "seashore", "wetland"];

type Row = Record<string, unknown>;

/** An animal aboard as an event row names one (`voyage_event_animal`). */
function rowAnimal(animal: ArkAnimal, over: Partial<Row> = {}): Row {
    return {id: animal.id, species_profile_id: animal.species_profile_id, name: animal.name, model_slug: animal.model_slug, zone: animal.zone, island: animal.island ?? null, area: animal.area ?? null, enclosure: animal.enclosure ?? null, slot: animal.slot ?? null, slot_rank: animal.slot_rank ?? null, origin: animal.origin ?? "arrived", generation: animal.generation ?? 0, activity: animal.activity ?? null, sociality: animal.sociality ?? null, arrived_at: animal.arrived_at, status: "present", thrive: animal.thrive ?? "ordinary", placeholder: false, ...over};
}

async function main() {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality") ?? "high";
    const trace = params.get("trace") === "1";
    (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const [read, log] = await Promise.all([fetch("/data/voyage.json").then((r) => r.json()), fetch("/data/events.json").then((r) => r.json())]) as [{snapshot?: unknown}, {events: Row[]}];
    const real = decodeArkSnapshot(read.snapshot ?? read);
    if (!real) throw new Error("the saved read did not decode");
    // "Now" is the saved read's moment: nothing after it is ever a line.
    const now = Date.parse(real.as_of ?? "") || Date.now();
    const rows: Row[] = [...log.events];
    let snapshot: ArkSnapshot = real;
    const el = document.getElementById("ark")!;
    const host = document.getElementById("log") as HTMLDivElement;
    const two = arkTwoIslands(real);
    const town = two ? await (await import("@/ark-scene/islands/scene")).loadTownScene({tier: quality === "low" ? "low" : quality === "medium" ? "medium" : "high", animals: arkIslandSnapshot(real, "town").animals}) : null;
    const clock = installRecordClock(window);
    const handle: ArkSceneHandle = mountArk(el, {snapshot: real, modelBase: MODELS, iconUrl, recording: true, ...(town ? {island: town, wildAnimals: arkIslandSnapshot(real, "wild").animals} : {})});
    const canvas = () => el.querySelector("canvas");
    clock.tick(0);

    const wild = () => real.animals.filter((animal) => (animal.island ?? "wild") === "wild" && !animal.area);
    const filmable = (animal: ArkAnimal, min = 0.5) => displayLength(animal.model_slug, null) >= min && !WATER.includes(animal.zone);
    let serial = 900_000;
    const made = new Map<string, {remove: string[]}>();
    let live: ArkLive | null = null;
    /** The running clock at the event's own time (epoch s), and the clip's (s since the tap). */
    let epoch = now / 1000;
    let clip = 0;
    let index = 0;
    let departing: {until: number; id: string} | null = null;
    let current: {id: string; kind: string; plan: ReturnType<typeof planArkEventReplay>; tapped: boolean; text: string; ended: string | null} | null = null;

    /** Harness events of the kinds production has none of yet, from animals really aboard (never a made-up animal). */
    const make = (kind: "meal" | "escaped", n: number): string[] => {
        const ids: string[] = [];
        const at = new Date(now - 20 * 60_000).toISOString();
        // Real pairs of the food chain on the wild island: a hunter and one of its own prey kinds aboard, nearest first.
        const land = wild().filter((animal) => filmable(animal, 0.3));
        const pairs: Array<{hunter: ArkAnimal; prey: ArkAnimal; d: number}> = [];
        for (const hunter of land) for (const prey of land) {
            if (hunter === prey || hunter.model_slug === prey.model_slug || !eats(hunter.model_slug, prey.model_slug)) continue;
            const a = handle.locate(hunter.id);
            const b = handle.locate(prey.id);
            if (a && b) pairs.push({hunter, prey, d: Math.hypot(a.x - b.x, a.z - b.z)});
        }
        pairs.sort((x, y) => x.d - y.d || x.hunter.id.localeCompare(y.hunter.id));
        // (A species once while there are pairs for it; then an animal once; then a pair of kinds once: the wild island
        // has few filmable pairs yet. Each line is filmed in its own world, so an animal may be in two.)
        const used = new Set<string>();
        for (let pass = 0; pass < 3 && ids.length < n; pass++) for (const pair of pairs) {
            if (ids.length >= n) break;
            const kinds = `${pair.hunter.model_slug}>${pair.prey.model_slug}`;
            const both = `${pair.hunter.id}>${pair.prey.id}`;
            if (used.has(both)) continue;
            if (pass === 0 && (used.has(pair.hunter.model_slug) || used.has(pair.prey.model_slug))) continue;
            if (pass === 1 && (used.has(pair.hunter.id) || used.has(pair.prey.id))) continue;
            if (pass === 2 && used.has(kinds)) continue;
            used.add(pair.hunter.model_slug).add(pair.prey.model_slug).add(pair.hunter.id).add(pair.prey.id).add(kinds).add(both);
            // The encounter as the server writes it: the hunter's waypoint within a foray's reach (22 m) of the prey's home disc.
            const a = handle.locate(pair.hunter.id)!;
            const b = handle.locate(pair.prey.id)!;
            const k = pair.d > 22 ? 22 / pair.d : 1;
            const encounter = {t: Date.parse(at) / 1000, step: 0, island: "wild", predator: {x: b.x + (a.x - b.x) * k, z: b.z + (a.z - b.z) * k}, prey: {x: b.x, z: b.z, r: 0.5}, d: Math.min(pair.d, 22)};
            const id = String(++serial);
            const base = {id: Number(id), at, ark_day: real.ark_day ?? null, clutch: null, phrase: null, source: null, thrive: null, parents: [], bringers: [], from_egg: false};
            if (kind === "meal") {
                rows.push({...base, kind: "meal", species: pair.hunter.name, species_profile_id: pair.hunter.species_profile_id, animal: rowAnimal(pair.hunter), other: rowAnimal(pair.prey, {status: "eaten"}), encounter, payload: {when: "encounter", encounter}});
                made.set(id, {remove: [pair.prey.id]});
            } else {
                rows.push({...base, kind: "escaped", species: pair.prey.name, species_profile_id: pair.prey.species_profile_id, animal: rowAnimal(pair.prey), other: rowAnimal(pair.hunter), payload: {when: "encounter", rate: [0.2, 0.3], encounter}});
                made.set(id, {remove: []});
            }
            ids.push(id);
        }
        return ids;
    };

    /** The record's own lines of a kind: what a picture can show first (the wild island's land, the bigger animals), a species at most twice. */
    const own = (kind: "mated" | "birth" | "death" | "extinct", n: number): string[] => {
        const all = arkReplayableEvents(rows, now).filter((event) => event.kind === kind);
        const seen = new Map<string, number>();
        const litters = new Set<string>();
        const ranked = all.map((event) => {
            const row = rows.find((r) => String(r.id) === event.id)!;
            const animal = row.animal as Row | null;
            const slugs = [row.animal, row.other].map((a) => (a as Row | null)?.model_slug).filter((s): s is string => typeof s === "string");
            const length = slugs.length ? Math.max(...slugs.map((slug) => displayLength(slug, null))) : 0;
            const zone = String(animal?.zone ?? "");
            const held = animal?.area === "house" && WATER.includes(zone);
            // (A live birth is the acted one: before a hatching of the same size class.)
            return {event, row, length, born: kind === "birth" && row.from_egg !== true ? 1 : 0, rank: (animal?.island === "wild" ? 1 : 0) + (WATER.includes(zone) ? 0 : 3) - (held ? 4 : 0)};
        }).sort((a, b) => Number(b.length >= 0.25) - Number(a.length >= 0.25) || b.born - a.born || b.rank - a.rank || b.length - a.length || Date.parse(b.event.at) - Date.parse(a.event.at));
        const ids: string[] = [];
        for (const item of ranked) {
            if (ids.length >= n) break;
            const times = seen.get(item.event.species) ?? 0;
            if (times >= 2) continue;
            // (A litter once, whichever of its rows comes first; a pair on two islands is one the layer itself skips.)
            const litter = `${String(item.row.at)}|${[...((item.row.parents as string[] | null) ?? [])].sort().join(",")}`;
            if (kind === "birth" && litters.has(litter)) continue;
            const other = item.row.other as Row | null;
            if (kind === "mated" && other && other.island !== (item.row.animal as Row | null)?.island) continue;
            try {
                planArkEventReplay(item.event.id, rows, real, {now});
            } catch {
                continue;
            }
            litters.add(litter);
            seen.set(item.event.species, times + 1);
            ids.push(item.event.id);
        }
        return ids;
    };

    /** ARK-MATING-SHOWN: the record's `laid` rows whose parents are aboard: the bigger mothers first, a species at most twice. */
    const ownLaid = (n: number): string[] => {
        const aboard = new Set(real.animals.map((animal) => animal.id));
        const laid = rows.filter((row) => row.kind === "laid" && Date.parse(String(row.at)) <= now && ((row.parents as string[] | null) ?? []).some((p) => aboard.has(p)));
        const ranked = laid.map((row) => ({row, length: displayLength(String((row.animal as Row | null)?.model_slug ?? ""), null), wild: (row.animal as Row | null)?.island === "wild" ? 1 : 0})).sort((a, b) => Number(b.length >= 0.05) - Number(a.length >= 0.05) || b.wild - a.wild || b.length - a.length || Date.parse(String(b.row.at)) - Date.parse(String(a.row.at)));
        const times = new Map<string, number>();
        const ids: string[] = [];
        for (const item of ranked) {
            if (ids.length >= n) break;
            const species = String(item.row.species ?? "");
            if ((times.get(species) ?? 0) >= 2) continue;
            times.set(species, (times.get(species) ?? 0) + 1);
            ids.push(String(item.row.id));
        }
        return ids;
    };
    /** ARK-MATING-SHOWN: a laying's line: the record (its mating's row with it) arrives, the clock runs to her laying, its line is tapped. */
    const prepareLaid = async (id: string) => {
        live?.dispose();
        departing = null;
        handle.clearLiveActs?.();
        handle.select(null);
        if (snapshot !== real) {
            snapshot = real;
            handle.update(real);
        }
        const row = rows.find((r) => String(r.id) === id)!;
        const pair = JSON.stringify([...((row.parents as string[] | null) ?? [])].sort());
        const set = rows.filter((r) => r.at === row.at && (r === row || (r.kind === "mated" && JSON.stringify([...((r.parents as string[] | null) ?? [])].sort()) === pair)));
        epoch = Date.parse(String(row.at)) / 1000 + 20;
        pinArkClock(epoch);
        handle.setHours(null);
        handle.setView(handle.homeView());
        clock.tick(0);
        live = new ArkLive({host, scene: () => handle, words: null, locale: "en", eventsUrl: null, storageKey: null});
        live.snapshot(real);
        live.events(set);
        const t0 = Date.parse(String(row.at)) / 1000;
        current = {id, kind: "laid", plan: {kind: "laid", t0, at: String(row.at), cast: [], feed: {}} as unknown as ReturnType<typeof planArkEventReplay>, tapped: false, text: "", ended: null};
        reads = [];
        jumps = [];
        lastAt.clear();
        clip = 0;
        index = 0;
        laidMother = null;
        const parents = (row.parents as string[] | null) ?? [];
        await handle.preload(Array.from(new Set(real.animals.filter((a) => parents.includes(a.id)).map((a) => a.model_slug))));
        for (let i = 0; i < 120; i++) {
            await pause(50);
            clock.tick(0);
            if (!handle.loading() && parents.some((p) => handle.locate(p))) break;
        }
        run(1);
        const key = `laid:${id}`;
        // (Run on to a little before her eggs come: the mating, if acted, first.)
        let laying = handle.liveActs?.().clutches?.layings.find((l) => l.key === key) ?? null;
        for (let i = 0; i < 400 && laying && laying.start === null; i++) {
            run(1);
            laying = handle.liveActs?.().clutches?.layings.find((l) => l.key === key) ?? null;
        }
        if (laying?.start != null && laying.start - 0 > epoch) run(Math.max(laying.start + 2 - epoch, 0), 0.5);
        laidMother = laying?.mother ?? null;
        await pause(700);
        const line = live.lines.find((l) => String(l.id).replace(/^event:/, "") === id) ?? null;
        if (line) {
            current.text = liteOf(id)[0] ?? "";
            live.focus(line);
        }
        // (And the mother chosen, as a viewer taps her: her close-up, the clutch she lays beside her.)
        if (laidMother) handle.select(laidMother, true);
        current.tapped = true;
        return {kind: "laid", at: String(row.at), t0, tapAt: Math.round((epoch - t0) * 10) / 10, line: line ? {id: line.id, kind: line.kind} : null, lines: live.lines.length, watching: true, skipped: false, seen: null, laying, cast: parents.map((p) => ({id: p, role: "parent", name: String((row.animal as Row | null)?.name ?? ""), slug: String((row.animal as Row | null)?.model_slug ?? ""), aboard: Boolean(real.animals.find((a) => a.id === p)), located: Boolean(handle.locate(p))}))};
    };

    const worldFor = (id: string): ArkSnapshot => {
        const gone = new Set(made.get(id)?.remove ?? []);
        return gone.size ? {...real, animals: real.animals.filter((animal) => !gone.has(animal.id))} : real;
    };
    /** Every row of the event's act: a litter's, an extinction's with the row that ended the kind. */
    const rowsOf = (id: string): Row[] => {
        const row = rows.find((r) => String(r.id) === id);
        if (!row) return [];
        if (row.kind === "birth") return rows.filter((r) => r.kind === "birth" && r.at === row.at && JSON.stringify([...((r.parents as string[] | null) ?? [])].sort()) === JSON.stringify([...((row.parents as string[] | null) ?? [])].sort()));
        if (row.kind === "extinction") return rows.filter((r) => r.at === row.at && (r === row || r.species_profile_id === row.species_profile_id || (r.other as Row | null)?.species_profile_id === row.species_profile_id));
        return [row];
    };
    /** Frames nobody sees: the clock runs on (`seconds` in steps of `each`). */
    const run = (seconds: number, each = 0.5) => {
        for (let left = seconds; left > 1e-6; left -= each) {
            const step = Math.min(each, left);
            epoch += step;
            pinArkClock(epoch);
            clock.tick(step * 1000);
        }
    };
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const since = () => (current ? epoch - current.plan.t0 : 0);

    /**
     * ARK-MATING-SHOWN (decision 416): the readability measure, every filmed frame of a tapped mating or birth. A member
     * is READ in a frame when it is drawn (`shown`), its middle is inside the picture (9/10 of each half), its body is at
     * least `READ_PX` long on the screen, the scene's lines of sight from the camera to it are clear (the ground, what is
     * drawn solid and the leaves: `sightOf` with `leaves`, past the shot's near cut), and it is not under the water while
     * the camera is above it. A mating's frame reads when both of the pair are read and they are together (their middles
     * within their two lengths and a half metre); a birth's when the mother and at least one young are read, near her.
     * The line reads when such frames run unbroken for `READ_SECONDS`. And the walk: no one of the pair moves more than
     * `JUMP` of its own lengths (and a metre) between two frames a tenth of a second apart (no teleport).
     */
    const READ_PX = 22;
    const READ_SECONDS = {mated: 2, birth: 1.5, laid: 2} as Record<string, number>;
    const LAID_FILM = 32;
    let laidMother: string | null = null;
    const JUMP = 3;
    type Read = {t: number; ok: boolean; why: string};
    let reads: Read[] = [];
    let jumps: Array<{id: string; t: number; d: number}> = [];
    const lastAt = new Map<string, {x: number; z: number; t: number}>();
    const camOf = () => (window as unknown as {__arkDebug?: {camera: {position: {x: number; y: number; z: number; clone: () => {x: number; y: number; z: number; project: (c: unknown) => {x: number; y: number; z: number}}}; near: number}}}).__arkDebug?.camera ?? null;
    const readOne = (id: string): {ok: boolean; why: string; p: {x: number; y: number; z: number; length: number} | null} => {
        const at = handle.locate(id) as (ReturnType<ArkSceneHandle["locate"]> & {shown?: boolean; under?: number}) | null;
        if (!at) return {ok: false, why: "none", p: null};
        const p = {x: at.x, y: at.y, z: at.z, length: at.length};
        if (at.shown === false) return {ok: false, why: "hidden", p};
        const camera = camOf();
        if (!camera) return {ok: false, why: "camera", p};
        const v = camera.position.clone();
        const project = (x: number, y: number, z: number) => {
            Object.assign(v, {x, y, z});
            const q = v.project(camera);
            return {x: q.x, y: q.y, z: q.z};
        };
        const m = project(at.x, at.y, at.z);
        if (!(Math.abs(m.x) <= 0.9 && Math.abs(m.y) <= 0.9 && m.z < 1)) return {ok: false, why: "out", p};
        const yaw = at.yaw ?? 0;
        const h = at.length / 2;
        const a = project(at.x + Math.sin(yaw) * h, at.y, at.z + Math.cos(yaw) * h);
        const b = project(at.x - Math.sin(yaw) * h, at.y, at.z - Math.cos(yaw) * h);
        // (On the screen, in pixels of a 720 by 1280 picture: its length, or its height for one seen end on.)
        const tall = project(at.x, at.y + (at.height ?? at.length * 0.4) / 2, at.z);
        const size = Math.max(Math.hypot((a.x - b.x) * 360, (a.y - b.y) * 640), Math.abs(tall.y - m.y) * 1280);
        if (size < READ_PX) return {ok: false, why: "small", p};
        if ((at.under ?? 0) > Math.max(0.25, (at.height ?? 0.3) * 0.6) && camera.position.y > at.y + (at.under ?? 0)) return {ok: false, why: "underwater", p};
        if (handle.sightOf) {
            const view = handle.view();
            // (Its middle, or its back: a beetle on a twig, its middle a few millimetres over the bark, shows its back.)
            const ask = (y: number) => handle.sightOf!(view.target, {distance: view.distance, polar: view.polar, azimuth: view.azimuth}, [{x: at.x, y, z: at.z, slack: Math.min(at.length * 0.3, 0.5)}], false, camera.near > 0.5 ? camera.near : 0, true);
            if (ask(at.y) > 0 && ask(at.y + (at.height ?? at.length * 0.3) * 0.5) > 0) return {ok: false, why: `blocked:${handle.sightMet?.() || "?"}`, p};
        }
        return {ok: true, why: "", p};
    };
    /** ARK-MATING-SHOWN: a laying's frame reads when its mother is read and her clutch is in the picture, `CLUTCH_PX` across and in sight. */
    const CLUTCH_PX = 8;
    const clutchRead = (key: string): {ok: boolean; why: string} => {
        // (Or, on a build without the live layer, the tap's own clutch: `__arkDebug.liveClutch`.)
        const tapped = (window as unknown as {__arkDebug?: {liveClutch?: () => {key: string; at: {x: number; y: number; z: number; size: number} | null} | null}}).__arkDebug?.liveClutch?.() ?? null;
        const kept = handle.liveActs?.().clutches?.kept.find((c) => c.key === key)?.at ?? (tapped?.key === key ? tapped.at : null);
        if (!kept) return {ok: false, why: "no-clutch"};
        const camera = camOf();
        if (!camera) return {ok: false, why: "camera"};
        const v = camera.position.clone();
        const q = (x: number, y: number, z: number) => {
            Object.assign(v, {x, y, z});
            return v.project(camera);
        };
        const m = {...q(kept.x, kept.y + kept.size * 0.1, kept.z)};
        if (!(Math.abs(m.x) <= 0.9 && Math.abs(m.y) <= 0.9 && m.z < 1)) return {ok: false, why: "clutch-out"};
        const edge = {...q(kept.x + kept.size / 2, kept.y + kept.size * 0.1, kept.z)};
        const px = Math.hypot((edge.x - m.x) * 360, (edge.y - m.y) * 640) * 2;
        if (px < CLUTCH_PX) return {ok: false, why: "clutch-small"};
        // (Its eggs over the rim: a ray to the base's own middle meets the twigs of the nest it is in.)
        if (handle.sightOf) {
            const view = handle.view();
            if (handle.sightOf(view.target, {distance: view.distance, polar: view.polar, azimuth: view.azimuth}, [{x: kept.x, y: kept.y + kept.size * 0.3, z: kept.z, slack: kept.size * 0.3}], false, camera.near > 0.5 ? camera.near : 0, true) > 0) return {ok: false, why: "clutch-blocked"};
        }
        return {ok: true, why: ""};
    };
    const measure = (t: number) => {
        if (current?.kind === "laid") {
            const key = `laid:${current.id}`;
            const mother = handle.liveActs?.().clutches?.layings.find((l) => l.key === key)?.mother ?? laidMother;
            const a = mother ? readOne(mother) : {ok: false, why: "no-mother"};
            const c = clutchRead(key);
            reads.push({t, ok: a.ok && c.ok, why: [a.why, c.why].filter(Boolean).join(",")});
            return;
        }
        if (!current || (current.kind !== "mated" && current.kind !== "birth")) return;
        const cast = current.plan.cast;
        let ids: string[];
        let young: string[] = [];
        if (current.kind === "mated") ids = cast.filter((m) => m.role === "pair").map((m) => m.record.id).slice(0, 2);
        else {
            const acts = handle.liveActs?.();
            const mother = (acts?.births ?? []).map((b) => b.mother).find((id) => id && cast.some((m) => m.record.id === id)) ?? cast.find((m) => m.role === "parent")?.record.id ?? null;
            ids = mother ? [mother] : [];
            young = cast.filter((m) => m.role === "young").map((m) => m.record.id);
        }
        // (A hatching's young come out of their clutch: they are what is read, with or without a parent by them; a
        // newborn's coming into view is no jump, so only a parent's moves are watched for one.)
        const hatching = current.kind === "birth" && rows.find((r) => String(r.id) === current!.id)?.from_egg === true;
        for (const id of ids) {
            const at = handle.locate(id);
            const was = lastAt.get(id);
            if (at && was && t - was.t > 0 && t - was.t <= 0.2) {
                const d = Math.hypot(at.x - was.x, at.z - was.z);
                if (d > at.length * JUMP + 1) jumps.push({id, t: Math.round(t * 10) / 10, d: Math.round(d * 10) / 10});
            }
            if (at) lastAt.set(id, {x: at.x, z: at.z, t});
        }
        if (hatching) {
            const out = young.map(readOne).filter((g) => g.ok);
            reads.push({t, ok: out.length > 0, why: out.length ? "" : young.map(readOne).map((g) => g.why).join(",") || "no-young"});
            return;
        }
        const got = ids.map(readOne);
        let ok = got.length === (current.kind === "mated" ? 2 : 1) && got.every((g) => g.ok);
        let why = got.map((g) => g.why).filter(Boolean).join(",") || (ok ? "" : "cast");
        if (ok && current.kind === "mated") {
            const [a, b] = got.map((g) => g.p!);
            if (Math.hypot(a.x - b.x, a.z - b.z) > a.length + b.length + 0.5) {
                ok = false;
                why = "apart";
            }
        } else if (ok) {
            const mother = got[0].p!;
            const seenYoung = young.map(readOne).filter((g) => g.ok && Math.hypot(g.p!.x - mother.x, g.p!.z - mother.z) <= mother.length * 2.5 + 1);
            if (!seenYoung.length) {
                ok = false;
                why = "no-young";
            }
        }
        reads.push({t, ok, why});
    };
    const readability = () => {
        if (!current) return null;
        const need = READ_SECONDS[current.kind] ?? 2;
        let best = 0;
        let from: number | null = null;
        for (const r of reads) {
            if (r.ok) {
                from ??= r.t;
                best = Math.max(best, r.t - from);
            } else from = null;
        }
        const why: Record<string, number> = {};
        for (const r of reads) if (!r.ok) why[r.why] = (why[r.why] ?? 0) + 1;
        return {readable: best >= need && jumps.length === 0, best: Math.round(best * 10) / 10, need, frames: reads.length, okFrames: reads.filter((r) => r.ok).length, why, jumps: jumps.slice(0, 5)};
    };

    const liteOf = (id: string): string[] => {
        const set = rowsOf(id);
        const text = arkLiveTextOf(null);
        const escaped = escapeItems(set, -Infinity, () => false).map((item) => escapeText(item, text));
        const said = arkLiveServerItems(decodeArkEvents(set, worldFor(id))).map((item) => arkLiveLineText(item, text, "en"));
        return [...escaped, ...said].filter((line): line is string => Boolean(line));
    };

    const api = {
        ready: true,
        now,
        counts: () => ({animals: real.animals.length, wild: wild().length, events: rows.length, loading: handle.loading()}),
        // (A mating's lines with a few to spare: one the layer itself skips, one of the two on the wing, is counted and passed over.)
        lines: (kind: string, n: number): string[] => (kind === "meal" || kind === "escaped" ? make(kind, n) : kind === "mated" ? own(kind, n + 4) : kind === "birth" || kind === "death" || kind === "extinct" ? own(kind, n) : kind === "laid" ? ownLaid(n) : []),
        plan: (id: string) => planArkEventReplay(id, rows, worldFor(id), {now}),
        /** The record arrives, the clock runs on to a little before the act's telling part, the line is tapped. */
        prepare: async (id: string) => {
            live?.dispose();
            departing = null;
            handle.clearLiveActs?.();
            handle.select(null);
            const world = worldFor(id);
            if (world !== snapshot) {
                snapshot = world;
                handle.update(world);
            }
            const plan = planArkEventReplay(id, rows, world, {now});
            const row = rows.find((r) => String(r.id) === id)!;
            // The viewer's page reads the record twenty seconds after its release.
            epoch = Date.parse(String(row.at)) / 1000 + 20;
            pinArkClock(epoch);
            handle.setHours(null);
            handle.setView(handle.homeView());
            clock.tick(0);
            live = new ArkLive({host, scene: () => handle, words: null, locale: "en", eventsUrl: null, storageKey: null});
            live.snapshot(world);
            live.events(rowsOf(id));
            current = {id, kind: plan.kind, plan, tapped: false, text: "", ended: null};
            reads = [];
            jumps = [];
            lastAt.clear();
            clip = 0;
            index = 0;
            // The cast's models (a stand-in's, a far animal's): asked for, then waited for.
            await handle.preload(Array.from(new Set(plan.cast.map((member) => member.record.model_slug))));
            // (And for the line itself: the log lets a line through on its own half-second beat.)
            const lineNow = () => live!.lines.find((l) => String(l.id).replace(/^event:/, "") === id || (plan.kind === "birth" && (l.kind === "birth" || l.kind === "hatched"))) ?? null;
            for (let i = 0; i < 120; i++) {
                await pause(50);
                clock.tick(0);
                if (live.seenNow && !handle.loading() && plan.cast.every((member) => handle.locate(member.record.id)) && lineNow()) break;
            }
            run(4);
            // When a viewer taps: a little before a held act begins; for a mating, as the two are about to meet (its walk
            // can be minutes); a birth as it starts.
            const acts = handle.liveActs?.();
            const mating = plan.feed.matings ? acts?.matings.find((m) => m.key === plan.feed.matings![0].key) : null;
            const tapAt = plan.kind === "mated" ? (mating && typeof mating.meet === "number" ? Math.max(mating.meet - 8, 24) : 24) : plan.kind === "birth" ? (plan.feed.play ? 24 : -8) : plan.kind === "death" || plan.kind === "extinct" ? -6 : -11;
            if (tapAt > since()) run(tapAt - since(), 0.5);
            // (A pair the mating layer itself does not act, one of the two on the wing at that moment: said, not filmed.)
            const taken = plan.feed.matings ? handle.liveActs?.().matings.find((m) => m.key === plan.feed.matings![0].key) : null;
            if (plan.feed.matings && (!taken || taken.phase === "skipped")) return {kind: plan.kind, at: plan.at, t0: plan.t0, tapAt: Math.round(since() * 10) / 10, line: null, lines: live.lines.length, watching: false, skipped: true, seen: null, cast: []};
            // (A real half second for the log's own beat: a line whose time is up has gone, as on a viewer's page.)
            await pause(700);
            const line = lineNow();
            const before = live.seenNow?.report() ?? null;
            if (line) {
                current.text = liteOf(id)[0] ?? "";
                live.focus(line);
                current.tapped = Boolean(live.seenNow?.watching());
            }
            return {kind: plan.kind, at: plan.at, t0: plan.t0, tapAt: Math.round(since() * 10) / 10, line: line ? {id: line.id, kind: line.kind} : null, lines: live.lines.length, watching: current.tapped, skipped: false, seen: before, cast: plan.cast.map((member) => ({id: member.record.id, role: member.role, name: member.record.name, slug: member.record.model_slug, aboard: member.aboard, zone: member.record.zone, island: member.record.island ?? null, length: displayLength(member.record.model_slug, null), located: Boolean(handle.locate(member.record.id))}))};
        },
        frame: (quality = 0.86, step = 1) => {
            const frames = Math.max(Math.round(step), 1);
            const dt = frames / FPS;
            epoch += dt;
            pinArkClock(epoch);
            clock.tick(dt * 1000);
            const t = clip;
            clip += dt;
            // (`?trace=1`: where each of the cast is, once a second, to the console: the script prints it.)
            if (trace && current && Math.floor(clip) !== Math.floor(t)) {
                const acts = handle.liveActs?.();
                console.log(`[seen] ${current.kind} ${current.id} clip ${clip.toFixed(1)} since ${since().toFixed(1)} ${current.plan.cast.map((member) => { const at = handle.locate(member.record.id); return `${member.role}:${at ? `${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)} L${at.length.toFixed(2)} ${at.shown ? "shown" : "hid"} ${at.act ?? "-"}` : "none"}`; }).join(" | ")} view d${handle.view().distance.toFixed(2)} ${JSON.stringify((current.kind === "mated" ? acts?.matings : acts?.births) ?? [])}`);
                // (And, for a death or an extinction, how the scene has each of them: its level, its stand-in, the camera.)
                const debug = (window as unknown as {__arkDebug?: {entries: () => Array<{animal: {id: string}; level?: string; ghost?: boolean; held?: boolean; micro?: unknown; act?: {state?: string; hidden?: boolean; base?: number} | null; length: number; trueLength: number; middle?: {x: number; y: number; z: number} | null}>; camera: {position: {x: number; y: number; z: number}; near: number}}}).__arkDebug;
                if (debug && (current.kind === "death" || current.kind === "extinct")) {
                    const ids = new Set(current.plan.cast.map((member) => member.record.id));
                    const c = debug.camera;
                    console.log(`[seen] entries ${JSON.stringify(debug.entries().filter((entry) => ids.has(entry.animal.id)).map((entry) => ({level: entry.level, ghost: Boolean(entry.ghost), held: Boolean(entry.held), micro: Boolean(entry.micro), act: entry.act ? `${entry.act.state}${entry.act.hidden ? " hidden" : ""} base ${entry.act.base?.toFixed(4)}` : null, length: entry.length, metres: entry.trueLength, middle: entry.middle ? [entry.middle.x, entry.middle.y, entry.middle.z].map((v) => Number(v.toFixed(4))) : null})))} camera ${[c.position.x, c.position.y, c.position.z].map((v) => v.toFixed(4)).join(",")} near ${c.near.toFixed(4)} target ${JSON.stringify(handle.view().target)}`);
                }
            }
            if (departing) return {index: index++, t, done: clip > departing.until, image: quality > 0 ? canvas()?.toDataURL("image/jpeg", quality) ?? "" : ""};
            if (current && current.tapped) measure(t);
            if (current?.kind === "laid") {
                // (ARK-MATING-SHOWN: a laying has no watch: the line's own tap, filmed for `LAID_FILM` seconds.)
                const image = quality > 0 ? canvas()?.toDataURL("image/jpeg", quality) ?? "" : "";
                return {index: index++, t, done: clip > LAID_FILM, image};
            }
            const watching = Boolean(live?.seenNow?.watching());
            if (current && current.tapped && !watching && !current.ended) current.ended = "ended";
            const image = quality > 0 ? canvas()?.toDataURL("image/jpeg", quality) ?? "" : "";
            return {index: index++, t, done: !watching || clip > 170, image};
        },
        report: () => {
            const watch = live?.seenNow?.current() ?? null;
            const report = lastReport ?? watch?.report() ?? null;
            return {watch: report, read: readability(), clock: {clip, since: since()}, acts: handle.liveActs?.() ?? null, seen: live?.seenNow?.report() ?? null, where: Object.fromEntries((current?.plan.cast ?? []).map((member) => [member.record.id, handle.locate(member.record.id)])), view: handle.view(), stats: handle.stats(), pinned: arkPinnedMs()};
        },
        /** The watch's own account, kept as the frames go (it is gone once the watch ends). */
        keep: () => {
            const watch = live?.seenNow?.current();
            if (watch?.running()) lastReport = watch.report();
            return lastReport;
        },
        /** An animal that leaves the Ark between two reads: framed where it stands, then taken out of the read. Frames follow (`frame`), five seconds. */
        depart: async (n: number) => {
            live?.dispose();
            live = null;
            current = null;
            handle.clearLiveActs?.();
            handle.select(null);
            if (snapshot !== real) handle.update(real);
            pinArkClock(null);
            handle.setHours(11);
            // (One that is drawn: chosen as a viewer would choose it, the scene's own close-up; the next when it is not out now.)
            const candidates = wild().filter((animal) => filmable(animal, 0.6) && handle.locate(animal.id)).sort((a, b) => a.id.localeCompare(b.id)).slice(n * 9 + 2);
            let pick: ArkAnimal | null = null;
            for (const candidate of candidates.slice(0, 6)) {
                handle.select(candidate.id, true);
                for (let i = 0; i < 70; i++) {
                    await pause(30);
                    clock.tick(1000 / FPS);
                }
                if (handle.locate(candidate.id)?.shown && !handle.loading()) {
                    pick = candidate;
                    break;
                }
            }
            if (!pick) return null;
            const gone = pick.id;
            snapshot = {...real, animals: real.animals.filter((animal) => animal.id !== gone)};
            departing = {until: 5.5, id: pick.id};
            clip = 0;
            index = 0;
            // (One frame of it as it stood, then the read without it.)
            clock.tick(1000 / FPS);
            handle.update(snapshot);
            return {id: pick.id, name: pick.name, slug: pick.model_slug};
        },
        /** The marks from a fixture of the reads that are not live yet, on a real animal of the wild island: chosen, so its box shows. */
        mark: async (what: "last" | "lone") => {
            live?.dispose();
            current = null;
            departing = null;
            handle.clearLiveActs?.();
            pinArkClock(null);
            handle.setHours(11);
            const pick = wild().filter((animal) => filmable(animal, 0.8) && handle.locate(animal.id)).sort((a, b) => a.id.localeCompare(b.id))[what === "last" ? 3 : 11] ?? null;
            if (!pick) return null;
            const world: ArkSnapshot = what === "lone" ? {...real, animals: real.animals.map((animal) => (animal.id === pick.id ? {...animal, lone: true} : animal))} : real;
            snapshot = world;
            handle.update(world);
            live = new ArkLive({host, scene: () => handle, words: null, locale: "en", eventsUrl: null, storageKey: null});
            live.snapshot(world);
            // (`seen/` is loaded for a lone founder in the read, or for an open crisis: here asked for both ways.)
            const seen = await live.seenReady();
            if (!seen) return null;
            seen.snapshot(world);
            if (what === "last") seen.setCrises({available: true, crises: [{id: "0000c715-0000-4000-8000-000000000001", status: "open", band: "last", species_profile_id: pick.species_profile_id, wild_count: 1, last_animal_ids: [pick.id]}]});
            handle.select(pick.id, true);
            for (let i = 0; i < 90; i++) {
                await pause(40);
                clock.tick(1000 / FPS);
            }
            return {id: pick.id, name: pick.name, label: document.querySelector("[data-ark-bars-mark]")?.textContent ?? null, seen: seen.report()};
        },
        /** The line in words, as Ark Lite's feed says it (its own sentence; both animals named). */
        lite: (id: string) => liteOf(id),
        text: () => current?.text ?? "",
        handle
    };
    let lastReport: ReturnType<NonNullable<ReturnType<NonNullable<ArkLive["seenNow"]>["current"]>>["report"]> | null = null;
    const prepare = api.prepare;
    api.prepare = async (id: string) => {
        lastReport = null;
        const row = rows.find((r) => String(r.id) === id);
        if (row?.kind === "laid") return prepareLaid(id) as unknown as ReturnType<typeof prepare>;
        return prepare(id);
    };
    (window as unknown as {__seen: typeof api}).__seen = api;
}

main().catch((error) => {
    console.error("[seen]", error?.stack ?? error);
    (window as unknown as {__seenError?: string}).__seenError = String(error?.stack ?? error);
});
