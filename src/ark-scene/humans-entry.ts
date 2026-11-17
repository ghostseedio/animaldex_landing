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
import {HUMAN_SKIN_TONES, humanLook, type HumanInstance} from "@/ark-scene/humans/figures";
import {PeopleFigures} from "@/ark-scene/humans/people-figures";
import {townWorldOrigin} from "@/ark-scene/islands";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {Raycaster, Vector3, type Object3D} from "three";

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

/** p6 (people, skin): people the harness adds to the town's (the skin-tone line-up). */
let extra: HumanInstance[] = [];
const ownSetFrame = PeopleFigures.prototype.setFrame;
PeopleFigures.prototype.setFrame = function (list, camera, seconds) {
    return ownSetFrame.call(this, extra.length ? [...list, ...extra] : list, camera, seconds);
};

async function main() {
    const params = new URLSearchParams(location.search);
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    // p6 (people): `?people=procedural`: the p5 figures, for before/after frames.
    if (params.get("people") === "procedural") (globalThis as {__arkPeople?: string}).__arkPeople = "procedural";
    const template = fixture.animals[0];
    const dogs = Array.from({length: Number(params.get("dogs") ?? 60)}, (_, i) => ({...template, id: `0000d095-0000-4000-8000-${i.toString(16).padStart(12, "0")}`, species_profile_id: `5bec1e50-0000-4000-8000-00000000000${i % BREEDS.length}`, kind_species_profile_id: DOG_KIND_ID, kind_name: "Domestic Dog", name: BREEDS[i % BREEDS.length][1], scientific_name: "Canis lupus familiaris", model_slug: BREEDS[i % BREEDS.length][0], zone: "farm_garden", island: "town", area: "house", activity: "diurnal", sociality: "group", slot: 300 + i, slot_rank: 0, origin: "arrived"}));
    const people = Array.from({length: Number(params.get("humans") ?? 112)}, (_, i) => ({...template, id: `0000beef-0000-4000-8000-${i.toString(16).padStart(12, "0")}`, species_profile_id: "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", name: "Human", scientific_name: "Homo sapiens", model_slug: "human", zone: "farm_garden", island: "town", area: "house", slot: 200, slot_rank: i, origin: "arrived"}));
    const decoded = decodeArkSnapshot({...fixture, animals: [...dogs, ...people]});
    if (!decoded) throw new Error("fixture did not decode");
    const snapshot = {...decoded, animals: decoded.animals.map((a) => ({...a, island: "town"}) as typeof a)};
    const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
    const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
    const town = await loadTownScene({tier: "high", animals: split(snapshot, "town").animals});
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug: string) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: Number(params.get("hours") ?? 7.8), onReady: () => (ready = true), island: town, wildAnimals: split(snapshot, "wild").animals, openIsland: "town"} as never);
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
            const rig = window as unknown as {__arkDebug: {controls: {minDistance: number}; scene: Object3D}};
            rig.__arkDebug.controls.minDistance = Math.min(rig.__arkDebug.controls.minDistance, distance);
            // Quality pass: a view with nothing between the eye and the walker (no wall, awning or eave across it): the
            // asked one first, then turned round and raised by steps until the line of sight is clear.
            const target = new Vector3(d.x, d.y + 0.8, d.z);
            const ray = new Raycaster();
            const clear = (az: number, p: number) => {
                const eye = new Vector3(Math.sin(p) * Math.sin(az), Math.cos(p), Math.sin(p) * Math.cos(az)).multiplyScalar(distance).add(target);
                // (A margin round the eye too: the camera's near plane cuts through anything within half a metre.)
                ray.set(target, eye.clone().sub(target).normalize());
                ray.far = distance + 0.6;
                ray.near = 1.2;
                const hits = ray.intersectObject(rig.__arkDebug.scene, true).filter((h) => h.object.visible && (h.object as {isMesh?: boolean}).isMesh && !String(h.object.name).startsWith("humans") && h.object.userData.kind !== "human");
                return hits.length === 0;
            };
            let azimuth = d.yaw + Math.PI + turn;
            let polarNow = polar;
            search: for (const lift of [0, 0.15, 0.3]) {
                for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
                    if (clear(d.yaw + Math.PI + turn + k * 0.5, polar - lift)) {
                        azimuth = d.yaw + Math.PI + turn + k * 0.5;
                        polarNow = polar - lift;
                        break search;
                    }
                }
            }
            handle.setView({target: {x: d.x, y: d.y + 0.8, z: d.z}, distance, polar: polarNow, azimuth});
            await frames(10);
            await wait(1500);
            await frames(4);
            return JSON.stringify({hours, dog: d, walked: s!.walked.length, live: s!.live.length, pairs: s!.pairs, home: s!.home});
        }
    };
    /** Quality pass: the first hour (morning or evening walks, by 3 minutes) with a walked dog out on the beach's sand, or null. */
    const beachHour = async (): Promise<{hours: number; nth: number} | null> => {
        const o = townWorldOrigin();
        for (const [from, to] of [[6.7, 9.6], [17.1, 20]]) {
            for (let h = from; h < to; h += 0.05) {
                handle.setHours(h);
                await frames(3);
                const s = debug.dogWalks?.();
                const live = s?.walked.filter((w) => s.live.includes(w.id)) ?? [];
                const k = live.findIndex((w) => sampleTownGround(w.x - o.x, w.z - o.z).surface === "sand" && w.z - o.z > 120);
                if (k >= 0) return {hours: h, nth: k};
            }
        }
        return null;
    };
    (api as unknown as {beachHour: typeof beachHour}).beachHour = beachHour;
    /**
     * p6 (people): the town's people of a kind (`what`: beach, paddle, bench, car, boat, pavement, dogwalk; or a pose)
     * at a pinned hour, the `nth` framed from `distance` (a clear line of sight as `walk` finds it). Waits until the
     * rigged bodies (or, with `?people=procedural`, the p5 figures) draw.
     */
    type Drawn = {id: string; what: string; pose: string; x: number; y: number; z: number; yaw: number};
    const peopleDebug = () => (window as unknown as {__arkDebug: {people: () => {rigged: boolean; drawn: {near: number; far: number}; out: Drawn[]}}}).__arkDebug.people();
    const framePeople = async (hours: number, kind: string, distance: number, polar = 1.2, turn = 0.6, nth = 0) => {
        handle.setHours(hours);
        for (let i = 0; i < 60; i++) {
            await wait(250);
            await frames(2);
            const s = peopleDebug();
            if ((s.rigged || params.get("people") === "procedural") && s.out.some((h) => h.what === kind || h.pose === kind)) break;
        }
        const s = peopleDebug();
        const all = s.out.filter((h) => h.what === kind || h.pose === kind);
        const h = all[Math.min(nth, all.length - 1)];
        if (!h) return JSON.stringify({hours, kind, none: true, kinds: Array.from(new Set(s.out.map((o) => `${o.what}/${o.pose}`)))});
        const rig = window as unknown as {__arkDebug: {controls: {minDistance: number}; scene: Object3D}};
        rig.__arkDebug.controls.minDistance = Math.min(rig.__arkDebug.controls.minDistance, distance);
        const target = new Vector3(h.x, h.y + 0.7, h.z);
        const ray = new Raycaster();
        const clear = (az: number, p: number) => {
            const eye = new Vector3(Math.sin(p) * Math.sin(az), Math.cos(p), Math.sin(p) * Math.cos(az)).multiplyScalar(distance).add(target);
            ray.set(target, eye.clone().sub(target).normalize());
            ray.far = distance + 0.6;
            ray.near = 1.2;
            return ray.intersectObject(rig.__arkDebug.scene, true).filter((x) => x.object.visible && (x.object as {isMesh?: boolean}).isMesh && x.object.userData.kind !== "human" && !String(x.object.name).startsWith("humans")).length === 0;
        };
        let azimuth = h.yaw + turn;
        let polarNow = polar;
        search: for (const lift of [0, 0.15, 0.3, 0.45]) {
            for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, 6]) {
                if (clear(h.yaw + turn + k * 0.5, polar - lift)) {
                    azimuth = h.yaw + turn + k * 0.5;
                    polarNow = polar - lift;
                    break search;
                }
            }
        }
        handle.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: polarNow, azimuth});
        await frames(10);
        await wait(1500);
        await frames(4);
        return JSON.stringify({hours, kind, of: all.length, person: h, rigged: s.rigged, drawn: s.drawn});
    };
    (api as unknown as {people: typeof framePeople}).people = framePeople;
    /**
     * p6 (people, skin): every skin tone lined up on the beach's sand at a pinned hour: a row of swimmers (paddling) in
     * front, the same tones in day clothes behind, deep to light from the left, facing the camera. Harness only: the
     * row is added to what the town's people renderer draws.
     */
    const lineup = async (hours: number, distance = 9.5) => {
        await framePeople(hours, "sun", distance);
        const s = peopleDebug();
        const h = s.out.find((o) => o.what === "sun");
        if (!h) return JSON.stringify({hours, none: true});
        const n = HUMAN_SKIN_TONES.length;
        const x0 = h.x - ((n - 1) * 0.95) / 2;
        const z0 = h.z + 3.5;
        extra = HUMAN_SKIN_TONES.flatMap((skin, i) => {
            const front = humanLook(`lineup-front-${i}`);
            const back = humanLook(`lineup-back-${i}`);
            return [
                {x: x0 + i * 0.95, y: h.y, z: z0 + 1.2, yaw: 0, pose: "paddle", phase: i * 0.37, look: {...front, skin, child: false, height: 1.7, swim: 1}},
                {x: x0 + i * 0.95, y: h.y, z: z0, yaw: 0, pose: "stand", phase: i * 0.41, look: {...back, skin, child: false, height: 1.75, bald: 0}}
            ] as HumanInstance[];
        });
        handle.setView({target: {x: h.x, y: h.y + 1, z: z0 + 0.6}, distance, polar: 1.42, azimuth: 0});
        await frames(10);
        await wait(1500);
        await frames(4);
        return JSON.stringify({hours, at: {x: h.x, z: z0}, rigged: s.rigged});
    };
    (api as unknown as {lineup: typeof lineup}).lineup = lineup;
    (window as unknown as {__humans: typeof api}).__humans = api;
    (window as unknown as {__humansReady: boolean}).__humansReady = true;
}

void main();
