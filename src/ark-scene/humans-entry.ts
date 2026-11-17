/**
 * The humans harness's page (development only; `scripts/ark-forest-shots.mjs --page humans` builds and serves it,
 * nothing deploys it). The live scene with the town island beside the wild one, a cast of house dogs (a fixture: the
 * record's are 265) and people (a fixture of the record's 112), on a pinned island hour: `window.__humans.walk(hours)`
 * pins the hour, waits for the walked dogs to come out, and frames the first walker with a dog on the lead.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {DOG_KIND_ID} from "@/ark-scene/humans/dog-walks";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";
const BREEDS: Array<[string, string]> = [["labrador-retriever", "Labrador Retriever"], ["golden-retriever", "Golden Retriever"], ["border-collie", "Border Collie"], ["beagle", "Beagle"]];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });

async function main() {
    const params = new URLSearchParams(location.search);
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const dogs = Array.from({length: Number(params.get("dogs") ?? 60)}, (_, i) => ({...template, id: `0000d095-0000-4000-8000-${i.toString(16).padStart(12, "0")}`, species_profile_id: `5bec1e50-0000-4000-8000-00000000000${i % BREEDS.length}`, kind_species_profile_id: DOG_KIND_ID, kind_name: "Domestic Dog", name: BREEDS[i % BREEDS.length][1], scientific_name: "Canis lupus familiaris", model_slug: BREEDS[i % BREEDS.length][0], zone: "farm_garden", island: "town", area: "house", activity: "diurnal", sociality: "group", slot: 300 + i, slot_rank: 0, origin: "arrived"}));
    const people = Array.from({length: Number(params.get("humans") ?? 112)}, (_, i) => ({...template, id: `0000beef-0000-4000-8000-${i.toString(16).padStart(12, "0")}`, species_profile_id: "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", name: "Human", scientific_name: "Homo sapiens", model_slug: "human", zone: "farm_garden", island: "town", area: "house", slot: 200, slot_rank: i, origin: "arrived"}));
    let snapshot = decodeArkSnapshot({...fixture, animals: [...dogs, ...people]});
    if (!snapshot) throw new Error("fixture did not decode");
    snapshot = {...snapshot, animals: snapshot.animals.map((a) => ({...a, island: "town"}) as typeof a)};
    const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
    const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
    const town = await loadTownScene({tier: "high", animals: split(snapshot, "town").animals});
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: Number(params.get("hours") ?? 7.8), onReady: () => (ready = true), island: town, wildAnimals: split(snapshot, "wild").animals, openIsland: "town"} as never);
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const until = performance.now() + 150_000;
    while (performance.now() < until && (!ready || handle.loading())) await wait(200);
    type Walked = {id: string; walker: string; x: number; y: number; z: number; yaw: number; sniffing: boolean};
    const debug = (window as unknown as {__arkDebug: {dogWalks?: () => {walked: Walked[]; pins: string[]; live: string[]; pairs: number; home: number}}}).__arkDebug;
    const api = {
        state: () => debug.dogWalks?.() ?? null,
        /** The island hour pinned at `hours`; the first walked dog that is out (a live entry) framed from `distance`. */
        walk: async (hours: number, distance: number, polar = 1.25, turn = 0.9, nth = 0) => {
            handle.setHours(hours);
            for (let i = 0; i < 40; i++) {
                await wait(250);
                await frames(2);
                const s = debug.dogWalks?.();
                if (s && s.walked.length && s.walked.some((d) => s.live.includes(d.id))) break;
            }
            const s = debug.dogWalks?.();
            const out = s?.walked.filter((d) => s.live.includes(d.id)) ?? [];
            const d = out[Math.min(nth, out.length - 1)];
            if (!d) return JSON.stringify({hours, walked: s?.walked.length ?? 0, live: s?.live.length ?? 0, pairs: s?.pairs, home: s?.home});
            const rig = window as unknown as {__arkDebug: {controls: {minDistance: number}}};
            rig.__arkDebug.controls.minDistance = Math.min(rig.__arkDebug.controls.minDistance, distance);
            handle.setView({target: {x: d.x, y: d.y + 0.8, z: d.z}, distance, polar, azimuth: d.yaw + Math.PI + turn});
            await frames(10);
            await wait(1500);
            await frames(4);
            return JSON.stringify({hours, dog: d, walked: s!.walked.length, live: s!.live.length, pairs: s!.pairs, home: s!.home});
        }
    };
    (window as unknown as {__humans: typeof api}).__humans = api;
    (window as unknown as {__humansReady: boolean}).__humansReady = true;
}

void main();
