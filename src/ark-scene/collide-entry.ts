/**
 * The collision recordings' page (development only; `scripts/ark-collide-clips.mjs` builds it into
 * `.ark-golden/collide/` and serves it, nothing deploys it): the live scene on a snapshot (`?snapshot=<url>`, the real
 * one read in place on this machine), on a controlled clock: `window.__collide.frame(epoch, view)` sets the world time
 * and the camera and waits for it to be drawn. The same page on the tree before the collisions and after records the
 * same moments (`scripts/ark-collide-shots.mts`).
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) => new Promise<void>((resolve) => {
    let left = n;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
});

async function main() {
    const params = new URLSearchParams(location.search);
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const raw = await (await fetch(params.get("snapshot") ?? "snapshot.json")).json();
    const snapshot = decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("snapshot did not decode");
    // (Names off in the recordings: nobody's username is drawn.)
    for (const animal of snapshot.animals) (animal as {brought_by?: unknown}).brought_by = {label: "", named: false};
    const start = Number(params.get("at") ?? Date.UTC(2026, 10, 12, 6) / 1000);
    let ready = false;
    const el = document.getElementById("ark")!;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.2, storm: 0, windDirection: 0.4});
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
    await setAt(start);
    const until = realPerfNow() + 180_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    (window as unknown as {__collide: unknown}).__collide = {
        /** The world at `epoch` (s), the camera at `view`, drawn. */
        frame: async (epoch: number, view: ArkCameraView) => {
            handle.setView(view);
            await setAt(epoch);
            handle.setView(view);
            await frames(2);
        },
        /** Wait for models in view to load (on the real clock). */
        settle: async (ms: number) => {
            const end = realPerfNow() + ms;
            while (realPerfNow() < end && handle.loading()) await wait(150);
            await wait(400);
        },
        locate: (id: string) => handle.locate(id),
        stats: () => handle.stats()
    };
}

void main();
