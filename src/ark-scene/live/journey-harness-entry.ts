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
        pairs: (n: number) => {
            const by = new Map<string, ArkAnimal[]>();
            for (const a of wild()) {
                const k = a.kind_species_profile_id || a.species_profile_id;
                const l = by.get(k);
                if (l) l.push(a);
                else by.set(k, [a]);
            }
            const out: Pair[] = [];
            for (const list of by.values()) {
                if (list.length < 2) continue;
                const sheet = sheetOf(atlas, list[0].model_slug, "wild");
                if (!sheet || sheet.move === "sessile" || displayLength(list[0].model_slug, null) < 0.08) continue;
                const way = sheet.flies ? "air" : sheet.aquatic && !sheet.amphibious ? "water" : "ground";
                let best: Pair | null = null;
                for (const a of list) for (const b of list) {
                    if (a === b) continue;
                    const pa = handle.locate(a.id), pb = handle.locate(b.id);
                    if (!pa || !pb) continue;
                    const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
                    if (d >= 18 && d <= 300 && (!best || d > best.d)) best = {mover: a, partner: b, d, way};
                }
                if (best) out.push(best);
            }
            // (A flier and walkers first, the biggest bodies: what a picture shows.)
            out.sort((x, y) => (x.way === "air" ? 0 : 1) - (y.way === "air" ? 0 : 1) || displayLength(y.mover.model_slug, null) - displayLength(x.mover.model_slug, null));
            const air = out.filter((p) => p.way === "air").slice(0, 1), rest = out.filter((p) => p.way === "ground").slice(0, Math.max(n - 1, 1));
            chosen = [...air, ...rest].slice(0, n);
            const located = wild().filter((a) => handle.locate(a.id)).length;
            const sheets = wild().filter((a) => sheetOf(atlas, a.model_slug, "wild")).length;
            console.log(`[journey] wild ${wild().length} located ${located} sheets ${sheets} kinds ${by.size} candidates ${out.length}`);
            return chosen.map((p) => ({name: p.mover.name, way: p.way, d: Math.round(p.d)}));
        },
        start: (i: number) => {
            current = chosen[i];
            const a = handle.locate(current.mover.id)!, b = handle.locate(current.partner.id)!;
            const k = Math.max(0, (current.d - 1.5) / current.d);
            const to = {x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k};
            handle.addJourneys?.([{key: `harness:${i}`, id: current.mover.id, from: {x: a.x, z: a.z}, to, distance: current.d, way: current.way, t0: epoch + 0.5}]);
            handle.follow(current.mover.id);
            return {name: current.mover.name, partner: current.partner.name, d: Math.round(current.d), way: current.way};
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
