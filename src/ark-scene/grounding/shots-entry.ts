/**
 * Grounding's shots page script (development only; `scripts/ark-grounding-shots.mjs` builds and serves it, nothing
 * deploys it): the live scene on a snapshot the harness serves (the real one, read in place), with
 * `window.__arkGroundShots`:
 *
 *   find(kind)       the animals drawn now that show a kind of grounding: "slope" (a big walker on a steep drawn
 *                    slope), "perch" (on a branch or a limb), "cling" (bark, a wall, a rock face), "hang" (under a
 *                    limb), "cliff" (where the drawn ground is far off the analytic one), nearest the island's middle
 *   frame(id, d, polar, side)  the camera on it from its side (`side` radians round from its heading), `d` m off
 *   rules(r)         "legacy" or "grounded" (`grounding/hook.ts`), on the running scene
 *   report()/reset() the runtime check's tallies
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import {drawnGround, drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {groundingCheck, setGroundingRules} from "@/ark-scene/grounding/hook";
import {heightAt} from "@/ark-scene/world";
import {modelBase} from "@/ark-scene/grounding/base";
import {Raycaster, Vector3, type Camera, type Object3D} from "three";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Entry = {
    animal: {id: string; model_slug: string};
    place: {perch?: {tag: string}; micro?: unknown; hamlet?: unknown; water?: boolean};
    middle?: {x: number; y: number; z: number} | null;
    drawnHeight: number;
    length: number;
    air: number;
    level?: string;
    yawNow?: number;
    sched?: {pose?: {x: number; y: number; z: number; ny: number; moving: boolean; aloft: boolean} | null; trip?: {to: {point: string | null}} | null} | null;
};
type Debug = {entries: () => Entry[]; controls: {minDistance: number}; camera: Camera & {position: Vector3}; scene: Object3D};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const raw = await (await fetch("/snapshot.json")).json();
    const snapshot = decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("the snapshot did not decode");
    let ready = false;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: Number(params.get("hour") ?? 10), onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0.4});
    groundingCheck.on = true;
    const debug = () => (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const settle = async (maxMs = 90_000) => {
        const until = performance.now() + maxMs;
        let quiet = 0;
        while (performance.now() < until) {
            await wait(100);
            if (!ready || handle.loading()) quiet = 0;
            else if (!quiet) quiet = performance.now();
            else if (performance.now() - quiet > 1500) return true;
        }
        return false;
    };
    let tracking = 0;
    const api = {
        ready: () => ready,
        settle,
        rules: (r: "legacy" | "grounded") => setGroundingRules(r),
        report: () => groundingCheck.report(),
        reset: () => groundingCheck.reset(),
        view: (x: number, z: number, distance: number, azimuth: number, polar = 1.15, lift = 0.5) => {
            tracking++;
            debug().controls.minDistance = 0.3;
            handle.setView({target: {x, y: Math.max(heightAt(x, z), 0) + lift, z}, distance, polar, azimuth});
        },
        find: (kind: string, count = 8) => {
            const rows: Array<{id: string; slug: string; score: number; x: number; z: number; tag: string; length: number; yaw: number; nx: number; nz: number}> = [];
            for (const e of debug().entries()) {
                const at = e.sched?.pose;
                if (!at || at.aloft || e.air > 0.01 || e.place.hamlet) continue;
                const tag = e.place.perch?.tag ?? "";
                const point = e.sched?.trip?.to.point ?? "";
                const pointTag = point.split(":")[0];
                const ground = heightAt(at.x, at.z);
                if (ground <= 0.05) continue;
                let score = 0;
                if (kind === "slope") {
                    const n = drawnGround(at.x, at.z);
                    const slope = Math.sqrt(1 - n.ny * n.ny) / n.ny;
                    const plan = modelBase(e.animal.model_slug)?.plan;
                    if (plan === "mammal" && e.length > 0.5 && slope > 0.2 && slope < 0.9 && Math.abs(at.y - ground) < 0.1 && pointTag !== "shade") score = slope * Math.min(e.length, 3);
                } else if (kind === "perch") {
                    if (!at.moving && (pointTag === "branch" || pointTag === "limb") && at.y > ground + 0.8 && e.length < 0.8) score = 1 + e.length;
                } else if (kind === "cling") {
                    if (!at.moving && ["bark", "house_wall", "rock_face"].includes(pointTag)) score = 1 + e.length;
                } else if (kind === "hang") {
                    if (!at.moving && pointTag === "canopy_hang") score = 1 + e.length;
                } else if (kind === "cliff") {
                    const off = Math.abs(drawnGroundHeight(at.x, at.z) - ground);
                    if (Math.abs(at.y - ground) < 0.1 && !at.moving) score = off;
                }
                const pose = at as unknown as {yaw: number; nx: number; nz: number};
                if (score > 0) rows.push({id: e.animal.id, slug: e.animal.model_slug, score, x: at.x, z: at.z, tag: pointTag || tag, length: e.length, yaw: pose.yaw, nx: pose.nx, nz: pose.nz});
            }
            return rows.sort((a, b) => b.score - a.score).slice(0, count);
        },
        /** The first side (of eight round it) from which nothing stands between the camera and the animal. */
        clearSide: async (id: string, distance: number, polar: number, around: number) => {
            const ray = new Raycaster();
            const entry = () => debug().entries().find((e) => e.animal.id === id);
            for (const turn of [0, 0.5, -0.5, 1, -1, Math.PI, Math.PI - 0.6, Math.PI + 0.6]) {
                const side = around + turn;
                const at = handle.locate(id);
                if (!at) return around;
                handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth: side});
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const from = debug().camera.position.clone();
                const to = new Vector3(at.x, at.y, at.z);
                const length = from.distanceTo(to);
                ray.set(from, to.clone().sub(from).normalize());
                ray.far = Math.max(length - (entry()?.length ?? 0.5) * 0.7, 0.1);
                ray.camera = debug().camera;
                let blocked = false;
                debug().scene.traverseVisible((object) => {
                    if (blocked || !(object as {isMesh?: boolean}).isMesh) return;
                    try {
                        if (ray.intersectObject(object, false).length) blocked = true;
                    } catch {
                        // (A special mesh the ray cannot test.)
                    }
                });
                if (!blocked) return side;
            }
            return around;
        },
        /** The camera on it from a fixed side (azimuth: radians round from +z), following it if it moves. */
        frame: (id: string, distance: number, polar: number, azimuth: number) => {
            const token = ++tracking;
            debug().controls.minDistance = 0.3;
            const step = () => {
                if (token !== tracking) return;
                const at = handle.locate(id);
                if (at) handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth});
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
    };
    (window as unknown as {__arkGroundShots: typeof api}).__arkGroundShots = api;
}

const el = document.getElementById("ark");
if (el)
    mount(el).catch((error) => {
        (window as unknown as {__arkGroundShotsError: string}).__arkGroundShotsError = String(error);
    });
