/**
 * Powers you can see (decision 420): development's contact-sheet page (`scripts/ark-power-sheets.mjs` builds it into
 * `.ark-golden/powers/` and serves it; nothing deploys it). A saved read of the real Ark, with two animals of one kind
 * per mechanism given the bands to compare (one prime, one ordinary: the read's own animals, only their band changed),
 * filmed by day and by night with the development flag `__arkPowerDemo` on (every animal showing a Power is taken as
 * threatened, and a predator near a prime one it could eat as searching), since the live read has no prime animals and
 * no hunts yet.
 *
 *   __ps.picks                     per mechanism: the kind and the two animals
 *   __ps.shoot(id, hours, settle)  the camera face to face with one animal at that hour, the clock run on `settle` s; a JPEG
 *   __ps.pass(hours)               a prime animal and a predator that passes it over, framed together, at the pass's look and turn
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {arkPowerOf, ARK_POWER_MECHANISMS, type ArkPowerMechanism} from "@/ark-scene/power-table";
import {installRecordClock} from "@/ark-scene/record-clock";
import {pinArkClock} from "@/ark-scene/shared-clock";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal, ArkSceneHandle} from "@/ark-scene/types";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";
const FPS = 30;

async function main() {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality") ?? "high";
    (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const read = (await fetch("/data/voyage.json").then((r) => r.json())) as {snapshot?: unknown};
    const real = decodeArkSnapshot(read.snapshot ?? read);
    if (!real) throw new Error("the saved read did not decode");
    // Only the wild island (the town is another lane's): every animal ordinary, then the pairs' bands.
    const animals: ArkAnimal[] = real.animals.filter((a) => (a.island ?? "wild") === "wild" && !a.area).map((a) => ({...a, thrive: "ordinary", state: undefined}));
    const byKind = new Map<string, ArkAnimal[]>();
    for (const a of animals) {
        const power = arkPowerOf(a);
        if (!power) continue;
        const key = `${power.mechanism}|${a.model_slug}`;
        byKind.set(key, [...(byKind.get(key) ?? []), a]);
    }
    const wanted = (params.get("kinds") ?? "").split(",").filter(Boolean);
    // (`species=a,b`: those species, one animal each, whatever their mechanism: the Blender Power clips' pictures.)
    const only = (params.get("species") ?? "").split(",").filter(Boolean);
    const picks: Array<{mechanism: ArkPowerMechanism; slug: string; prime: string; ordinary: string; name: string; group: string[]}> = [];
    for (const slug of only) {
        const a = animals.find((x) => x.model_slug === slug && arkPowerOf(x));
        if (a) picks.push({mechanism: arkPowerOf(a)!.mechanism, slug, prime: a.id, ordinary: a.id, name: a.name, group: [a.id]});
    }
    for (const mechanism of only.length ? [] : ARK_POWER_MECHANISMS) {
        // The largest drawn kind of the mechanism with two animals aboard (it reads in a close-up), or the one asked for.
        // (One animal is enough: it is filmed twice at the same spot, prime and then ordinary. A group needs its own kind round it.)
        const options = Array.from(byKind.entries()).filter(([key, list]) => key.startsWith(`${mechanism}|`) && list.length >= (mechanism === "group" && !wanted.includes(key.split("|")[1]) ? 4 : 1));
        options.sort((a, b) => (mechanism === "group" ? b[1].length - a[1].length : 0) || displayLength(b[1][0].model_slug, null) - displayLength(a[1][0].model_slug, null));
        const chosen = options.find(([key]) => wanted.includes(key.split("|")[1])) ?? options.find(([, list]) => displayLength(list[0].model_slug, null) < 4) ?? options[0];
        if (!chosen) continue;
        const [a] = chosen[1];
        // (A fixture herd, never a production write: a group asked for by name with fewer than five aboard gets copies of
        // its first animal beside it, so the ranks have something to close.)
        if (mechanism === "group") for (let i = chosen[1].length; i < 5; i++) {
            const copy = {...a, id: `${a.id}-herd${i}`};
            animals.push(copy);
            chosen[1].push(copy);
        }
        // (A group: all of its kind there share the band, so its ranks close together.)
        picks.push({mechanism, slug: a.model_slug, prime: a.id, ordinary: a.id, name: a.name, group: mechanism === "group" ? chosen[1].map((x) => x.id) : [a.id]});
    }
    // (The pass's page: every animal of a kind with a Power is prime, so a predator is found near one.)
    // (Only kinds big enough to read at phone size: an insect passed over is a speck.)
    if (params.get("allprime") === "1") for (const a of animals) if (arkPowerOf(a) && displayLength(a.model_slug, null) >= 0.5) a.thrive = "prime";
    // (One animal of a Power kind away from the picks is good from the start, so the scene loads its Power layer at once.)
    const taken = new Set(picks.flatMap((p) => p.group));
    const loader = animals.find((a) => arkPowerOf(a) && !taken.has(a.id));
    if (loader) loader.thrive = "good";
    let snapshot = {...real, animals};
    const el = document.getElementById("ark")!;
    const clock = installRecordClock(window);
    (globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo = true;
    let epoch = Date.parse(real.as_of ?? "") / 1000 || Date.now() / 1000;
    pinArkClock(epoch);
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug: string) => ICONS + encodeURIComponent(slug) + ".webp", recording: true});
    const canvas = () => el.querySelector("canvas");
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const run = (seconds: number) => {
        for (let left = seconds; left > 1e-6; left -= 1 / FPS) {
            epoch += 1 / FPS;
            pinArkClock(epoch);
            clock.tick(1000 / FPS);
        }
    };
    const settleLoading = async () => {
        for (let i = 0; i < 400 && handle.loading(); i++) {
            await pause(100);
            clock.tick(0);
        }
    };
    const api = {
        ready: true,
        picks,
        stats: () => handle.stats().powers ?? null,
        /**
         * The same animal at the same spot, with its band set (and its group's): the camera comes to it and settles with
         * nothing threatening it, is left parked there, then a threat (the demo's) for `settle` s: what moves, moves in the
         * picture (a dart, a duck, a turn, ranks closing), and the coat shows as it does.
         */
        shoot: async (ids: string[], hours: number, band: "prime" | "ordinary", keep = false, settle = 2.5, look = 0.86) => {
            const set = new Set(ids);
            snapshot = {...snapshot, animals: snapshot.animals.map((a) => (set.has(a.id) ? {...a, thrive: band} : a))};
            handle.update(snapshot);
            handle.setHours(hours);
            handle.setEnvironment({rain: 0, fog: 0, storm: 0, cloud: 0.2, wetness: 0, snow: 0});
            (globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo = false;
            handle.select(ids[0], true);
            run(0.5);
            await settleLoading();
            run(3);
            // (An act in place stays looked at, so the leaves in its way fold as in the focus view; a dart or a herd's
            // ranks closing are watched from a parked camera.)
            if (!keep) handle.select(null);
            run(0.3);
            (globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo = true;
            // (In steps, the page's fetches let through between them: a Power clip's list and bin arrive as they would.)
            for (let left = settle; left > 1e-6; left -= 0.25) {
                run(Math.min(0.25, left));
                await pause(40);
            }
            await pause(50);
            run(1 / FPS);
            const image = canvas()?.toDataURL("image/jpeg", look) ?? "";
            (api as {shotClips?: string[]}).shotClips = handle.stats().powers?.clips ?? [];
            (globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo = false;
            run(4);
            return image;
        },
        pass: async (hours: number) => {
            handle.setHours(hours);
            handle.select(null);
            // A predator near a prime one: shown once the layer has found one (the stats' last pass).
            (globalThis as {__arkPowerDemo?: boolean}).__arkPowerDemo = true;
            let pair: [string, string] | null = null;
            for (let i = 0; i < 60 && !pair; i++) {
                run(0.5);
                await pause(20);
                pair = handle.stats().powers?.pass ?? null;
            }
            if (!pair) return {pair: null, images: []};
            handle.selectPair?.(pair[1], pair[0]);
            run(1);
            await settleLoading();
            run(2);
            // (The pair stays framed: the free camera parked among trees hid them.)
            const images: string[] = [];
            for (let i = 0; i < 9; i++) {
                run(1.5);
                images.push(canvas()?.toDataURL("image/jpeg", 0.86) ?? "");
            }
            return {pair, images};
        }
    };
    (window as unknown as {__ps: typeof api}).__ps = api;
}

main().catch((error) => {
    (window as unknown as {__psError: string}).__psError = String(error?.stack ?? error);
});
