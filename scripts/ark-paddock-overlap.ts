/**
 * The town paddocks' bodies inside each other (lane TOWNOVERLAP, 2026-11-24: horses in rural-paddock-2 ran and stood
 * inside each other and the donkeys). No browser: a snapshot's town (the live Ark's public one, saved by
 * `curl https://animaldex.app/api/ark/voyage`), placed as the town places it, each resident of the asked pens on its
 * own day (the behaviour schedule, its recipes included: play runs, rolls, grooming), through the scene's collisions
 * layer (`collide/layer.ts`) frame by frame, 60 a second, as the scene asks it. Measures, for every pair, how long they
 * stand inside each other as drawn (their collision bodies more than `INSIDE` deep beyond touching) and the biggest
 * step the collisions' push takes in a frame.
 *
 *   npx tsx scripts/ark-paddock-overlap.ts --snapshot public/ark-local/live.json [--pens rural-paddock-2,rural-paddock-1]
 *        [--from <epoch s>] [--minutes 20] [--fps 60]
 *
 * Prints each pen's worst pairs and a total; exits 1 with `--gate` when any pair is inside the other for more than a second.
 */
import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townWorldOrigin} from "@/ark-scene/islands";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {CollideLayer} from "@/ark-scene/collide/layer";
import {overlapOf, SEPARATION_EASE, SEPARATION_SLACK, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";
import {displayLength} from "@/ark-scene/sizes";

const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
/** Deeper than this beyond touching (m) is inside the other, as the eye reads it. */
const INSIDE = 0.08;

const raw = JSON.parse(readFileSync(arg("snapshot", "public/ark-local/live.json"), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
const pens = new Set(arg("pens", "rural-paddock-2,rural-paddock-1").split(","));
const fps = Number(arg("fps", "60"));
const minutes = Number(arg("minutes", "20"));
const from = Number(arg("from", "1796032800"));

const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

type Item = {id: string; slug: string; pen: string; sched: ScheduleAnimal; profile: ReturnType<typeof behaviourProfile>; body: ResolveBody; last: {x: number; z: number; at: number} | null};
const items: Item[] = [];
for (const a of town.animals) {
    const info = placed.town.get(a.id);
    const p = placed.places.get(a.id);
    if (!info || !p || !pens.has(info.place)) continue;
    const length = displayLength(a);
    const profile = behaviourProfile(a.model_slug);
    const shape = bodyShape(a.model_slug, length);
    // (As the scene schedules a kept town animal: `index.ts` makeSched, `islands/scene.ts` rangeOf.)
    const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5, kept: true};
    items.push({id: a.id, slug: a.model_slug, pen: info.place, sched, profile, body: {id: a.id, radius: shape.radius, half: shape.half, height: shape.height, group: p.leader ?? a.id}, last: null});
}
const baseOf = (it: Item, epoch: number): ResolvePose & {moving: boolean} => {
    const pose = poseOnTrip(world, tripAt(world, it.profile, it.sched, epoch, hours), epoch);
    return {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, aloft: pose.aloft, asleep: pose.beat === "sleep", still: !pose.aloft && !pose.moving, moving: pose.moving};
};
const layer = new CollideLayer<Item>({colliders: () => set, body: (it) => it.body, base: (it, epoch) => baseOf(it, epoch), everyone: () => items, last: (it) => it.last, speed: () => 7});

const inside = new Map<string, {now: number; longest: number; total: number; deepest: number}>();
let step = 0;
let stepAt = "";
const push = new Map<Item, {x: number; z: number}>();
const frames = Math.round(minutes * 60 * fps);
for (let f = 0; f < frames; f++) {
    const epoch = from + f / fps;
    const drawn = items.map((it) => {
        const base = baseOf(it, epoch);
        const at = layer.apply(it, epoch, base);
        it.last = {x: at.x, z: at.z, at: epoch};
        const now = {x: at.x - base.x, z: at.z - base.z};
        const was = push.get(it);
        const d = was ? Math.hypot(now.x - was.x, now.z - was.z) : 0;
        if (d > step) {
            step = d;
            stepAt = `${it.slug} ${it.id.slice(0, 8)} at +${(f / fps).toFixed(1)} s`;
        }
        push.set(it, now);
        return {it, pose: {...base, x: at.x, z: at.z}};
    });
    for (let i = 0; i < drawn.length; i++) {
        for (let j = i + 1; j < drawn.length; j++) {
            const a = drawn[i];
            const b = drawn[j];
            if (a.it.pen !== b.it.pen || (a.pose.asleep && b.pose.asleep)) continue;
            const deep = overlapOf(a.it.body, a.pose, b.it.body, b.pose).depth - SEPARATION_SLACK * Math.min(a.it.body.radius, b.it.body.radius);
            const key = `${a.it.pen} ${a.it.slug} ${a.it.id.slice(0, 8)} | ${b.it.slug} ${b.it.id.slice(0, 8)}`;
            const s = inside.get(key) ?? {now: 0, longest: 0, total: 0, deepest: 0};
            if (deep > INSIDE) {
                s.now += 1 / fps;
                s.total += 1 / fps;
                s.longest = Math.max(s.longest, s.now);
                s.deepest = Math.max(s.deepest, deep);
                inside.set(key, s);
            } else if (s.now) s.now = 0;
        }
    }
}
const rows = Array.from(inside.entries()).sort((a, b) => b[1].longest - a[1].longest);
const total = rows.reduce((n, [, s]) => n + s.total, 0);
const overSecond = rows.filter(([, s]) => s.longest > 1).length;
console.log(`SEPARATION_EASE ${SEPARATION_EASE} s; ${items.length} residents of ${Array.from(pens).join(", ")}; ${minutes} min at ${fps} fps from ${from}`);
console.log(`pairs ever inside each other: ${rows.length}; inside for over a second at a time: ${overSecond}; pair-seconds inside, all told: ${total.toFixed(1)}`);
for (const [key, s] of rows.slice(0, 10)) console.log(`  ${key}: longest ${s.longest.toFixed(2)} s, all told ${s.total.toFixed(1)} s, ${s.deepest.toFixed(2)} m deep`);
console.log(`biggest push step in a frame: ${step.toFixed(3)} m (${stepAt})`);
if (process.argv.includes("--gate") && overSecond) process.exit(1);
