/**
 * The forestry harness's page (development only; `scripts/ark-forest-shots.mjs` builds and serves it, nothing deploys
 * it). The live scene with the v2 fixture's real roster plus a few humans aboard (the fixture has none: stand-ins for the
 * record's 112, so the crews have someone to be), the record's forestry switched on so that logging 0 begins half an Ark
 * day before the pinned moment, a made-up `deforested` row for the body, and `window.__forest.at(dayOffset, view)` to
 * frame the stand at any Ark day of its cycle.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import stands from "@/ark-scene/positions/forest-stands.json";
import {arkDayNow} from "@/ark-scene/props";
import {ARK_DAY_MS} from "@/lib/ark-clock";
import {forestUnit, JITTER_DAYS, loggingAt, cutDay, type StandTable} from "@/ark-scene/positions/forestry";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

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
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    // p6 (people): `?people=procedural`: the p5 figures, for before/after frames.
    if (params.get("people") === "procedural") (globalThis as {__arkPeople?: string}).__arkPeople = "procedural";
    const template = fixture.animals[0];
    // (p6 people: `?humanbase=12`: another six of the fixture's humans, whose feller swings an axe.)
    const humanBase = Number(params.get("humanbase") ?? 0);
    const humans = Array.from({length: 6}, (_, i) => ({...template, id: `0000beef-0000-4000-8000-${(i + humanBase).toString(16).padStart(12, "0")}`, species_profile_id: "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", name: "Human", scientific_name: "Homo sapiens", model_slug: "human", zone: "farm_garden", island: "town", area: "house", slot: 200, slot_rank: i, origin: "arrived"}));
    const snapshot = decodeArkSnapshot({...fixture, animals: [...fixture.animals, ...humans]});
    if (!snapshot) throw new Error("fixture did not decode");
    const hours = Number(params.get("hours") ?? 10);
    const t0 = Date.UTC(2026, 10, 20, hours) / 1000;
    const day0 = arkDayNow(snapshot, t0 * 1000) ?? 0;
    // Logging 0 begins half an Ark day before t0 (its jitter taken off).
    const fromDay = day0 - 0.5 - JITTER_DAYS * forestUnit("forestry#start#0");
    const table = stands as unknown as StandTable;
    const g = loggingAt(table, fromDay, 0)!;
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
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
    const until = realPerfNow() + 150_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    handle.setForestry?.({fromDay, v: 1});
    // The body of an Ark-born animal of the fixture whose home the front reaches (made up here: the server's row).
    const victim = snapshot.animals.find((a) => a.island !== "town" && (a.zone === "rainforest" || a.zone === "woodland"))!;
    const spot = {x: g.stand.x + g.stand.r * 0.3, z: g.stand.z - g.stand.r * 0.2};
    const dieDay = cutDay(g, spot.x, spot.z);
    const dieAt = (t0 + (dieDay - day0) * (ARK_DAY_MS / 1000)) * 1000;
    handle.addDeaths?.([{key: "death:forest", animal: {id: victim.id, species_profile_id: victim.species_profile_id, name: victim.name, model_slug: victim.model_slug, zone: victim.zone, arrived_at: null, origin: "born", generation: 1, slot: victim.slot ?? null, slot_rank: victim.slot_rank ?? null, activity: null, sociality: null, status: null, area: null}, t0: dieAt / 1000, at: spot}]);
    const debug = (window as unknown as {__arkDebug: {forest?: () => unknown}}).__arkDebug;
    const api = {
        stand: () => ({stand: g.stand, bearing: g.bearing, start: g.start, fromDay, day0, dieDay, spot, victim: victim.name}),
        /** The world at Ark day start + `offset`, the stand framed from `distance` (azimuth, polar). */
        at: async (offset: number, distance: number, azimuth = 0.7, polar = 1.1, dx = 0, dz = 0) => {
            const epoch = t0 + (g.start + offset - day0) * (ARK_DAY_MS / 1000);
            await setAt(epoch - 3);
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const x = g.stand.x + dx, z = g.stand.z + dz;
            handle.setView({target: {x, y: Math.max(handle.heightAt(x, z), 0) + 1, z}, distance, polar, azimuth});
            await frames(8);
            return JSON.stringify(debug.forest?.() ?? null);
        }
    };
    (window as unknown as {__forest: typeof api}).__forest = api;
    (window as unknown as {__forestReady: boolean}).__forestReady = true;
}

void main();
