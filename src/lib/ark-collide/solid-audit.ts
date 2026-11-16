/**
 * p3 (solid): the town's walkers over the shared schedule, as the scene draws them (the schedule, the collisions' layer,
 * the scene's hard bound: a pen's rails or an enclosure's mask), and how often a body centre stands inside a solid prop
 * (`islands/town/solids.ts`, and the shrubs), per kind of prop. `before`: the colliders as they were (no solids, shrubs
 * soft, no clearance in the bound). The fixture's town, with more farm animals and pets cloned from its own (test
 * animals, never shown): horses, sheep, pigs, donkeys and hens; dogs, cats and rabbits.
 */
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {clearWithin, keepInPen, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {centroid, inPoly} from "@/ark-scene/islands/town/geom";
import {townColliderList, townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townSolids, solidDistance} from "@/ark-scene/islands/town/solids";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townWorldOrigin} from "@/ark-scene/islands";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {ColliderSet} from "@/ark-scene/collide/colliders";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {attachedOn, tripPhase} from "@/ark-scene/collide/attach";
import {CollideLayer} from "@/ark-scene/collide/layer";
import {displayLength} from "@/ark-scene/sizes";


export type SolidAudit = {before: boolean; items: number; samples: number; props: number; kinds: string[]; byKind: Record<string, number>; byArea: Record<string, number>; pairs: Record<string, number>; examples: string[]; ms: number};

/** `trace`: each walker's drawn pose at each sample (world frame), for the frames (`scripts/ark-solid-frames.mts`). */
export function townSolidAudit(options: {hours: number; step: number; before?: boolean; trace?: (id: string, slug: string, x: number, z: number, radius: number) => void}): SolidAudit {
    const before = options.before === true;
    const hoursArg = options.hours;
    const stepArg = options.step;
    const origin = townWorldOrigin();
    const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
    // (The fixture's town has six goats and four dogs; a fuller farm and more gardens, cloned from them: horses, sheep, pigs,
    // donkeys, hens on the farms, dogs, cats and rabbits in the gardens. Test animals, never shown.)
    const EXTRA: Array<[string, string, number]> = [["farm", "domestic-horse", 8], ["farm", "domestic-sheep", 6], ["farm", "domestic-pig", 3], ["farm", "domestic-donkey", 3], ["farm", "domestic-chicken", 6], ["house", "domestic-dog", 12], ["house", "domestic-cat", 6], ["house", "domestic-rabbit", 3]];
    const animals = [...town.animals];
    for (const [area, slug, n] of EXTRA) {
        const like = town.animals.find((a) => a.area === area)!;
        for (let k = 0; k < n; k++) animals.push({...like, id: `00000000-0000-4000-8000-${(slug + k).split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(12, "0")}`, model_slug: slug, name: slug, slot: k, arrived_at: `2026-11-0${1 + (k % 9)}T0${k % 10}:00:00Z`});
    }
    town.animals = animals;
    const placed = placeTownAnimals(town.animals);
    const solids = townSolids(placed.open);
    const solidIds = new Set(solids.map((s) => `town:${s.id}`));
    let list = townColliderList(placed.open, origin);
    if (before) list = list.filter((c) => !solidIds.has(c.id)).map((c) => (c.kind === "shrub" ? {...c, gap: 0, soft: true} : c));
    const set = before ? new ColliderSet(list, `before:${list.length}`) : townColliderSet(placed.open, origin, list);
    // The props to check: the solids, and the shrubs (`obstacles.ts` low trees).
    type Prop = {id: string; kind: string; d: (x: number, z: number) => number; gap: number; cx: number; cz: number; reach: number; top: number};
    const props: Prop[] = solids.map((s) => ({id: s.id, kind: s.kind, gap: s.gap, top: s.top, d: (x: number, z: number) => solidDistance(s, x - origin.x, z - origin.z), cx: (s.shape === "segment" ? (s.ax + s.bx) / 2 : s.x) + origin.x, cz: (s.shape === "segment" ? (s.az + s.bz) / 2 : s.z) + origin.z, reach: s.shape === "circle" ? s.r : s.shape === "box" ? Math.hypot(s.hw, s.hd) : Math.hypot(s.bx - s.ax, s.bz - s.az) / 2 + s.r}));
    for (const o of townObstacles(undefined, placed.open)) if (o.kind === "tree" && o.soft) props.push({id: o.id, kind: "shrub", gap: 0.16, top: Infinity, d: (x, z) => Math.hypot(x - origin.x - o.x, z - origin.z - o.z) - o.r, cx: o.x + origin.x, cz: o.z + origin.z, reach: o.r});
    // (A 4 m grid of props for the look-ups.)
    const grid = new Map<string, Prop[]>();
    for (const p of props) for (let i = Math.floor((p.cx - p.reach) / 4); i <= Math.floor((p.cx + p.reach) / 4); i++) for (let j = Math.floor((p.cz - p.reach) / 4); j <= Math.floor((p.cz + p.reach) / 4); j++) (grid.get(`${i},${j}`) ?? grid.set(`${i},${j}`, []).get(`${i},${j}`)!).push(p);
    const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
    const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const STILL_WHERE = new Set(["window", "indoor", "pool"]);
    type Item = {id: string; slug: string; where: string; area: string; profile: ReturnType<typeof behaviourProfile>; sched: ScheduleAnimal; body: ReturnType<typeof bodyShape>; last: {x: number; z: number; at: number} | null};
    const items: Item[] = [];
    for (const a of town.animals) {
        const info = placed.town.get(a.id);
        const p = placed.places.get(a.id);
        if (!info || !p || info.still || STILL_WHERE.has(info.where)) continue;
        const length = displayLength(a);
        const profile = behaviourProfile(a.model_slug);
        if (profile.move === "sessile") continue;
        const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5};
        items.push({id: a.id, slug: a.model_slug, where: info.where, area: info.area, profile, sched, body: bodyShape(a.model_slug, length), last: null});
    }
    const baseOf = (it: Item, epoch: number) => {
        const trip = tripAt(world, it.profile, it.sched, epoch, hours);
        const pose = poseOnTrip(world, trip, epoch);
        const attached = attachedOn(trip, epoch);
        const phase = tripPhase(trip, epoch);
        const fixed = !pose.aloft && pose.y > Math.max(world.sampler.heightAt(pose.x, pose.z), 0) + 0.3 && (phase === "stay" || phase === "pause") && Boolean(attached);
        return {pose, attached, fixed};
    };
    const layer = new CollideLayer<Item>({
        colliders: () => set,
        body: (it) => ({id: it.id, radius: it.body.radius, half: it.body.half, height: it.body.height, group: it.id}),
        base: (it, epoch) => {
            const {pose, attached, fixed} = baseOf(it, epoch);
            return {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, aloft: pose.aloft, asleep: pose.beat === "sleep", attached, fixed};
        },
        everyone: () => items,
        last: (it) => it.last,
        speed: () => 6
    });
    const bound = (id: string, pose: {x: number; z: number}) => {
        const info = placed.town.get(id);
        if (info?.pen) return keepInPen(info.pen, info.penMargin ?? 0, pose, origin.x, origin.z, before ? null : set);
        const mask = info?.enclosure?.mask;
        if (!mask) return;
        const lx = pose.x - origin.x;
        const lz = pose.z - origin.z;
        if (inPoly(mask, lx, lz)) return;
        const c = centroid(mask);
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 8; k++) {
            const m = (lo + hi) / 2;
            if (inPoly(mask, c.x + (lx - c.x) * m, c.z + (lz - c.z) * m)) lo = m;
            else hi = m;
        }
        pose.x = origin.x + c.x + (lx - c.x) * lo;
        pose.z = origin.z + c.z + (lz - c.z) * lo;
        // (As the scene's bound: off what stands inside the mask, its whole body whichever way it faces.)
        const it = before ? undefined : byId.get(id);
        if (it) clearWithin(pose, it.body.radius + it.body.half, set, (x, z) => inPoly(mask, x - origin.x, z - origin.z));
    };
    const byId = new Map(items.map((it) => [it.id, it]));
    const from = 1_763_000_000;
    let samples = 0;
    const byKind: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    const examples: string[] = [];
    const pairs: Record<string, number> = {};
    const t0 = Date.now();
    for (let t = from; t < from + hoursArg * 3600; t += stepArg) {
        const now = items.map((it) => ({it, ...baseOf(it, t)}));
        for (const n of now) n.it.last = {x: n.pose.x, z: n.pose.z, at: t};
        for (const {it, pose, attached, fixed} of now) {
            if (pose.aloft) continue;
            const at = {...layer.apply(it, t, {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, aloft: pose.aloft, asleep: pose.beat === "sleep", attached, fixed})};
            bound(it.id, at);
            samples++;
            options.trace?.(it.id, it.slug, at.x, at.z, it.body.radius);
            if (fixed) continue;
            for (const p of grid.get(`${Math.floor(at.x / 4)},${Math.floor(at.z / 4)}`) ?? []) {
                if (p.gap > 0 && it.body.radius * 2 < p.gap) continue;
                // (On top of it, a cat on a garden room's roof, a lizard on a rock: on it, not in it.)
                if (p.d(at.x, at.z) >= 0 || pose.y >= p.top - 0.05) continue;
                byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
                byArea[it.area] = (byArea[it.area] ?? 0) + 1;
                const key = `${it.slug}#${it.id.slice(-4)} ${it.where} ${p.id}`;
                pairs[key] = Math.max(pairs[key] ?? 0, -p.d(at.x, at.z));
                if (examples.length < 40) examples.push(`${it.slug}(${it.area}/${it.where}) in ${p.id} by ${(-p.d(at.x, at.z)).toFixed(2)} at ${t}`);
                break;
            }
        }
    }
    return {before, items: items.length, samples, props: props.length, kinds: Array.from(new Set(props.map((p) => p.kind))).sort(), byKind, byArea, pairs, examples: examples.slice(0, 6), ms: Date.now() - t0};
}
