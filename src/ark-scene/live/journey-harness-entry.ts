/**
 * MATE-FINDING's picture harness (development only; `scripts/ark-journey-shots.mjs` builds it into `.ark-golden/journey/`,
 * nothing deploys it): a saved read of the real Ark, mounted, and for a few real pairs of one kind far apart on the wild
 * island a `mate_found` trip handed to the scene exactly as the live log hands the record's (`addJourneys`), the camera
 * following the traveller on a stepped clock. Walkers and fliers both, chosen by the atlas's own sheets.
 *
 *   __journey.pairs(n)            the pairs to film
 *   __journey.start(i)            the trip begins now (its old home to beside its partner)
 *   __journey.frame(seconds)      the clock runs on; the frame, the traveller's place and pose
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {installRecordClock} from "@/ark-scene/record-clock";
import {pinArkClock} from "@/ark-scene/shared-clock";
import {displayLength} from "@/ark-scene/sizes";
import {decodeAtlas, sheetOf} from "@/ark-scene/positions/positions";
import atlasJson from "@/ark-scene/positions/atlas.json";
import type {ArkAnimal, ArkSceneHandle} from "@/ark-scene/types";
import {arkIslandSnapshot, arkTwoIslands} from "@/lib/ark-islands";
import {attachArkSeen} from "@/ark-scene/seen";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";
const iconUrl = (slug: string) => ICONS + encodeURIComponent(slug) + ".webp";

async function main() {
    const read = await fetch("/data/voyage.json").then((r) => r.json()) as {snapshot?: unknown};
    const real = decodeArkSnapshot(read.snapshot ?? read);
    if (!real) throw new Error("the saved read did not decode");
    const now = Date.parse(real.as_of ?? "") || Date.now();
    const el = document.getElementById("ark")!;
    const two = arkTwoIslands(real);
    const town = two ? await (await import("@/ark-scene/islands/scene")).loadTownScene({tier: "high", animals: arkIslandSnapshot(real, "town").animals}) : null;
    const clock = installRecordClock(window);
    const handle: ArkSceneHandle = mountArk(el, {snapshot: real, modelBase: MODELS, iconUrl, recording: true, ...(town ? {island: town, wildAnimals: arkIslandSnapshot(real, "wild").animals} : {})});
    const atlas = decodeAtlas(atlasJson);
    // Daylight (the saved read's own hour may be night), and the seen layer: the card line comes from the record's row.
    handle.setHours(11);
    const seen = attachArkSeen({handle, aspect: () => el.clientWidth / Math.max(el.clientHeight, 1), host: el, epochMs: () => epoch * 1000});
    seen.snapshot(real);
    let epoch = now / 1000;
    pinArkClock(epoch);
    clock.tick(0);
    const canvas = () => el.querySelector("canvas");
    const wild = () => real.animals.filter((a) => (a.island ?? "wild") === "wild" && !a.area);
    type Pair = {mover: ArkAnimal; partner: ArkAnimal; d: number; way: "air" | "water" | "ground"};
    let chosen: Pair[] = [];
    let current: Pair | null = null;
    const api = {
        ready: true,
        loading: () => handle.loading(),
        /** One trip per way of moving: a real pair of one kind when the read has one far apart, else (marked) the nearest animal of the same way 40-200 m off as the far end. */
        pairs: () => {
            const located = wild().map((a) => ({a, at: handle.locate(a.id), sheet: sheetOf(atlas, a.model_slug, "wild")})).filter((x) => x.at && x.sheet && x.sheet.move !== "sessile");
            const wayOf = (sh: NonNullable<ReturnType<typeof sheetOf>>): Pair["way"] => (sh.flies ? "air" : sh.aquatic && !sh.amphibious ? "water" : "ground");
            chosen = [];
            const info: Array<{name: string; way: string; d: number; sameKind: boolean}> = [];
            for (const way of ["ground", "air", "water"] as const) {
                const mine = located.filter((x) => wayOf(x.sheet!) === way).sort((x, y) => displayLength(y.a.model_slug, null) - displayLength(x.a.model_slug, null));
                let best: (Pair & {same: boolean}) | null = null;
                for (const x of mine) for (const y of mine) {
                    if (x === y) continue;
                    const d = Math.hypot(x.at!.x - y.at!.x, x.at!.z - y.at!.z);
                    if (d < 40 || d > 200) continue;
                    const same = x.a.species_profile_id === y.a.species_profile_id;
                    const score = (same ? 1000 : 0) + displayLength(x.a.model_slug, null) * 10;
                    const was = best ? (best.same ? 1000 : 0) + displayLength(best.mover.model_slug, null) * 10 : -1;
                    if (score > was) best = {mover: x.a, partner: y.a, d, way, same};
                }
                if (best) {
                    chosen.push(best);
                    info.push({name: best.mover.name, way, d: Math.round(best.d), sameKind: best.same});
                }
            }
            return info;
        },
        start: (i: number) => {
            current = chosen[i];
            const a = handle.locate(current.mover.id)!, b = handle.locate(current.partner.id)!;
            const k = Math.max(0, (current.d - 1.5) / current.d);
            const to = {x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k};
            handle.addJourneys?.([{key: `harness:${i}`, id: current.mover.id, from: {x: a.x, z: a.z}, to, distance: current.d, way: current.way, t0: epoch + 0.5}]);
            handle.follow(current.mover.id);
            // The record's row, as the public log hands it to the seen layer (its card line).
            seen.note([{id: 990000 + i, kind: "mate_found", at: new Date(epoch * 1000).toISOString(), animal: {id: current.mover.id, species_profile_id: current.mover.species_profile_id, name: current.mover.name}, other: {id: current.partner.id}, journey: {distance: Math.round(current.d), way: current.way}}], real);
            return {name: current.mover.name, partner: current.partner.name, d: Math.round(current.d), way: current.way};
        },
        /** The traveller selected, close: its card with the line. */
        card: () => {
            if (current) handle.select(current.mover.id, true);
            for (let s = 0; s < 40; s++) clock.tick(50);
            return canvas()?.toDataURL("image/jpeg", 0.9) ?? "";
        },
        frame: (seconds: number) => {
            const steps = Math.max(1, Math.round(seconds * 10));
            for (let s = 0; s < steps; s++) {
                epoch += seconds / steps;
                pinArkClock(epoch);
                clock.tick((seconds / steps) * 1000);
            }
            const at = current ? handle.locate(current.mover.id) : null;
            // (Close on the traveller, its partner's way ahead: the picture of the trip, not the whole island.)
            if (at) {
                handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance: Math.max(6, at.length * 14), polar: 1.0, azimuth: 0.6});
                for (let s = 0; s < 3; s++) clock.tick(16);
            }
            const partner = current ? handle.locate(current.partner.id) : null;
            return {image: canvas()?.toDataURL("image/jpeg", 0.86) ?? "", at, partner: partner ? {x: partner.x, z: partner.z} : null};
        }
    };
    (window as unknown as {__journey: typeof api}).__journey = api;
}

main().catch((e) => {
    (window as unknown as {__journeyError: string}).__journeyError = String(e?.stack ?? e);
});
