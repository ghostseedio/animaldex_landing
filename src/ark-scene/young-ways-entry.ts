/**
 * The young-ways harness's page (development only; `scripts/ark-young-ways-clips.mjs` builds it into `.ark-golden/young-ways/`
 * and serves it, nothing deploys it). The live scene with a cast-only snapshot (`?scene=<name>`): a few adults of a kind and
 * their young (born today, so newborns) on a controlled clock, left to the scene's own pose layers: nothing is made up for
 * them, no event is handed in. `window.__ways.shot(s, distance, who)` sets the world time to `s` seconds after the start and
 * frames the animal.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {arkDayAt} from "@/lib/ark-clock";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; young: number; /** Grown, born on the Ark (`generation`): a father the record has. */ born?: number};
type Scene = {zone: string; hours: number; cast: Cast; kind: "ride" | "line" | "stay" | "cluster"; distance: number; /** Days old at the start (the Ark day's fraction counts). */ age?: number};

export const SCENES: Record<string, Scene> = {
    // Riding: on the back, the chest, the tail, beneath the tail.
    grebe: {zone: "river_lake", hours: 10, kind: "ride", distance: 1.6, cast: {slug: "great-crested-grebe", name: "Great Crested Grebe", n: 2, young: 3}},
    swan: {zone: "river_lake", hours: 10, kind: "ride", distance: 2.4, cast: {slug: "mute-swan", name: "Mute Swan", n: 2, young: 3}},
    wolfspider: {zone: "farm_garden", hours: 10, kind: "ride", distance: 0.12, cast: {slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 2, young: 4}},
    scorpion: {zone: "rainforest", hours: 10, kind: "ride", distance: 0.3, cast: {slug: "giant-forest-scorpion", name: "Giant Forest Scorpion", n: 2, young: 4}},
    opossum: {zone: "woodland", hours: 10, kind: "ride", distance: 1.2, cast: {slug: "common-opossum", name: "Common Opossum", n: 2, young: 3}},
    pangolin: {zone: "rainforest", hours: 10, kind: "ride", distance: 1.3, cast: {slug: "sunda-pangolin", name: "Sunda Pangolin", n: 2, young: 1}},
    flyingfox: {zone: "rainforest", hours: 10, kind: "ride", distance: 1.2, cast: {slug: "large-flying-fox", name: "Large Flying Fox", n: 2, young: 1}},
    hippo: {zone: "river_lake", hours: 10, kind: "ride", distance: 6, cast: {slug: "common-hippopotamus", name: "Common Hippopotamus", n: 2, young: 1}},
    crayfish: {zone: "river_lake", hours: 10, kind: "ride", distance: 0.35, cast: {slug: "redclaw-crayfish", name: "Redclaw Crayfish", n: 2, young: 4}},
    titi: {zone: "rainforest", hours: 10, kind: "ride", distance: 1.0, cast: {slug: "coppery-titi-monkey", name: "Coppery Titi Monkey", n: 3, young: 1}},
    // Lines.
    duck: {zone: "river_lake", hours: 10, kind: "line", distance: 3, cast: {slug: "domestic-duck", name: "Domestic Duck", n: 2, young: 5}},
    goose: {zone: "river_lake", hours: 10, kind: "line", distance: 3.5, cast: {slug: "domestic-goose", name: "Domestic Goose", n: 2, young: 4}},
    skunk: {zone: "woodland", hours: 17, kind: "line", distance: 2.6, cast: {slug: "striped-skunk", name: "Striped Skunk", n: 2, young: 4}},
    tiger: {zone: "rainforest", hours: 10, kind: "line", distance: 7, cast: {slug: "bengal-tiger", name: "Bengal Tiger", n: 2, young: 2}},
    turkey: {zone: "woodland", hours: 10, kind: "line", distance: 3, cast: {slug: "wild-turkey", name: "Wild Turkey", n: 2, young: 4}},
    // Stays and visits.
    deer: {zone: "tundra", hours: 10, kind: "stay", distance: 7, cast: {slug: "white-tailed-deer", name: "White-tailed Deer", n: 3, young: 2}},
    elk: {zone: "tundra", hours: 10, kind: "stay", distance: 8, cast: {slug: "red-deer", name: "Red Deer", n: 3, young: 2}},
    fox: {zone: "tundra", hours: 10, kind: "stay", distance: 5, cast: {slug: "red-fox", name: "Red Fox", n: 2, young: 3}},
    wolf: {zone: "tundra", hours: 10, kind: "stay", distance: 7, cast: {slug: "gray-wolf", name: "Gray Wolf", n: 4, young: 3}},
    sparrow: {zone: "tundra", hours: 10, kind: "stay", distance: 2.4, cast: {slug: "andean-sparrow", name: "Andean Sparrow", n: 3, young: 2}},
    crow: {zone: "tundra", hours: 10, kind: "stay", distance: 3, cast: {slug: "carrion-crow", name: "Carrion Crow", n: 4, young: 2}},
    rabbit: {zone: "tundra", hours: 6.5, kind: "stay", distance: 3, cast: {slug: "eastern-cottontail", name: "Eastern Cottontail", n: 2, young: 3}},
    // Clumps.
    penguin: {zone: "tundra", hours: 10, kind: "cluster", distance: 4, cast: {slug: "african-penguin", name: "African Penguin", n: 3, young: 5}},
    nymph: {zone: "farm_garden", hours: 10, kind: "cluster", distance: 0.25, cast: {slug: "shield-stink-bug", name: "Shield & Stink Bug", n: 2, young: 5}},
    eland: {zone: "grassland", hours: 10, kind: "cluster", distance: 8, cast: {slug: "common-eland", name: "Common Eland", n: 3, young: 4}}
};

const castId = (i: number) => `0000feed-0000-4000-8000-${(0x100 + i).toString(16).padStart(12, "0")}`;
const speciesId = `5bec1e50-0000-4000-8000-${(0x77).toString(16).padStart(12, "0")}`;

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

type Debug = {
    controls: {minDistance: number};
    camera: {near: number; updateProjectionMatrix: () => void};
    entries: () => Array<{animal: {id: string}; length: number; sched?: {pose?: {doing?: string; moving?: boolean}} | null; act?: unknown; riding?: boolean; ridingOn?: {id: string}}>;
    liveliness: {
        parentOf: (id: string) => string | null;
        ageOf: (e: unknown) => {stage: string; staying: boolean; carried: boolean; ride: string | null; line: boolean; ways: unknown} | null;
        wayNowOf: Map<string, {way: string; key: string; speciesLine: string | null}>;
        visitNow: (visitor: string, ms: number) => {state: {phase: string; level: number; held: number}; run: {place: {x: number; z: number}; kind: string; go: number; flies: boolean}} | null;
    };
    seenNow?: () => Array<{name: string; line?: string}>;
};

async function main() {
    const params = new URLSearchParams(location.search);
    const scene = SCENES[params.get("scene") ?? "grebe"];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    // The Ark day the scene's own clock will have at the start (it counts from the voyage's start, not the fixture's day).
    const startAt = Date.UTC(2026, 10, 20, Math.floor(scene.hours), (scene.hours % 1) * 60) / 1000 + 60;
    const day = arkDayAt(startAt * 1000, Date.parse(fixture.voyage.started_at));
    const ids = {adults: [] as string[], young: [] as string[]};
    const animals: Raw[] = [];
    const c = scene.cast;
    for (let i = 0; i < c.n + c.young; i++) {
        const young = i >= c.n;
        (young ? ids.young : ids.adults).push(castId(i));
        animals.push({...template, id: castId(i), species_profile_id: speciesId, name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: "diurnal", sociality: "group", slot: 90, slot_rank: i, origin: young ? "born" : "arrived", born_ark_day: young ? day - (scene.age ?? 0.2) : 0} as Raw);
    }
    const decoded = decodeArkSnapshot({...fixture, animals});
    if (!decoded) throw new Error("fixture did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot: decoded, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const t0 = Date.UTC(2026, 10, 20, Math.floor(scene.hours), (scene.hours % 1) * 60) / 1000 + 60;
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
    console.log("[ways] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const at0 = handle.locate(ids.adults[0]);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.3, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    const entryOf = (id: string) => debug.entries().find((e) => e.animal.id === id);
    const note = () => {
        const parts = [...ids.adults.slice(0, 2), ...ids.young.slice(0, 3)].map((id) => {
            const e = entryOf(id);
            const w = debug.liveliness.wayNowOf.get(id);
            const age = e ? debug.liveliness.ageOf(e) : null;
            const role = ids.young.includes(id) ? `y${id.slice(-2)}` : `a${id.slice(-2)}`;
            const parentId = debug.liveliness.parentOf(id);
            const at = handle.locate(id);
            const pat = parentId ? handle.locate(parentId) : null;
            const gap = at && pat ? Math.hypot(at.x - pat.x, at.z - pat.z).toFixed(2) : "?";
            const ride = ids.young.includes(id) ? ` {riding ${e?.riding ? "yes" : "no"}${e?.ridingOn ? ` on ${e.ridingOn.id.slice(-2)}` : ""}, ${gap} m from its parent, parent act ${parentId ? (entryOf(parentId)?.act ? "yes" : "no") : "-"} sched ${parentId ? (entryOf(parentId)?.sched ? "yes" : "no") : "-"}}` : "";
            return `${role}:${e?.sched?.pose?.doing ?? "-"}${e?.sched?.pose?.moving ? "*" : ""}${ride}${age ? ` [${age.staying ? "stay " : ""}${age.carried ? `carried ${age.ride ?? "default"} ` : ""}${age.line ? "line " : ""}${age.stage}]` : ""}${w ? ` <${w.way}>` : ""}`;
        });
        const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
        return `${parts.join(" | ")}${said.length ? `\n${said.join(" / ")}` : ""}`;
    };
    const api = {
        info: () => ({scene: params.get("scene"), kind: scene.kind, distance: scene.distance, ids, parents: Object.fromEntries(ids.young.map((y) => [y.slice(-2), debug.liveliness.parentOf(y)?.slice(-2) ?? null])), t0}),
        /** The visits of the adults to their young in the next `seconds`: [visitor, goes at, with them from, back from, ends] (s after the start). */
        visits: (seconds = 800) => {
            const out: Array<{visitor: string; go: number; hold: number; back: number; end: number; kind: string; flies: boolean}> = [];
            for (const id of ids.adults) {
                let open: {visitor: string; go: number; hold: number; back: number; end: number; kind: string; flies: boolean} | null = null;
                for (let s = 0; s < seconds; s += 1) {
                    const v = debug.liveliness.visitNow(id, (t0 + s) * 1000);
                    if (v && !open) open = {visitor: id.slice(-2), go: s, hold: -1, back: -1, end: -1, kind: v.run.kind, flies: v.run.flies};
                    if (v && open && open.hold < 0 && v.state.phase === "hold") open.hold = s;
                    if (v && open && open.back < 0 && v.state.phase === "back") open.back = s;
                    if (!v && open) {
                        open.end = s;
                        out.push(open);
                        open = null;
                    }
                }
            }
            return out.sort((p, q) => p.go - q.go);
        },
        /** The world at `s` seconds after the start (run up a tenth of a second at a time into it), framed from `distance` on `who`, from `azimuth` off its heading. */
        shot: async (s: number, distance: number, who: string, azimuth = 0.7, polar = 1.2) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            debug.controls.minDistance = Math.min(debug.controls.minDistance, distance);
            debug.camera.near = 0.02;
            debug.camera.updateProjectionMatrix();
            const at = handle.locate(who) ?? at0;
            handle.setView({target: {x: at.x, y: at.y + Math.min(at.length * 0.3, 1), z: at.z}, distance, polar, azimuth: azimuth + (at.yaw ?? 0)});
            await frames(4);
            return `+${s.toFixed(1)} s   ${note()}`;
        },
        /** Two animals framed together (the parent and a young one): the camera on their middle, back far enough for both. */
        pair: async (s: number, a: string, b: string, pad = 2, azimuth = 0.7, polar = 0.95) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const pa = handle.locate(a);
            const pb = handle.locate(b);
            if (!pa || !pb) return `+${s.toFixed(1)} s   not placed`;
            const apart = Math.hypot(pa.x - pb.x, pa.z - pb.z);
            const distance = Math.max(apart * 1.25 + pad * Math.max(pa.length, pb.length), pa.length * 2.2);
            debug.controls.minDistance = Math.min(debug.controls.minDistance, distance);
            debug.camera.near = 0.02;
            debug.camera.updateProjectionMatrix();
            handle.setView({target: {x: (pa.x + pb.x) / 2, y: Math.max(handle.heightAt((pa.x + pb.x) / 2, (pa.z + pb.z) / 2), 0) + 0.3, z: (pa.z + pb.z) / 2}, distance, polar, azimuth});
            await frames(4);
            return `+${s.toFixed(1)} s   apart ${apart.toFixed(2)} m   ${note()}`;
        },
        handle
    };
    (window as unknown as {__ways: typeof api}).__ways = api;
}

main().catch((error) => {
    console.error("[ways]", error?.stack ?? error);
    (window as unknown as {__waysError?: string}).__waysError = String(error?.stack ?? error);
});
