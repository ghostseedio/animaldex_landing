#!/usr/bin/env -S npx tsx
/**
 * Picks the collision recordings' moments (motion pass L5): on a tree (run it on the tree BEFORE the collisions, so
 * the moments are ones where an animal went through something), the first moment of each kind in a window where a
 * moving animal on the ground passes through: a fence, a rock, a trunk in a wood, a building, and a cliff face.
 * Writes the shots (who, when, where) for `scripts/ark-collide-clips.mjs`, which records the same moments on both trees.
 *
 *   npx tsx scripts/ark-collide-shots.mts --snapshot <snapshot.json> --from <epoch s> --hours 6 --out <shots.json>
 */

import {readFileSync, writeFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {buildSim} from "@/lib/ark-collide/sim";
import {bodyHit, rawPosesAt} from "@/lib/ark-collide/metrics";
import {colliderSetFor} from "@/ark-scene/collide/colliders";
import {hamletPlotsFor} from "@/ark-scene/map/hamlet";
import {maxSlopeOf} from "@/ark-scene/behaviour-schedule";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(opt("snapshot")!, "utf8")))!;
const from = Number(opt("from", String(Math.floor(Date.UTC(2026, 10, 12, 1, 0) / 1000))));
const hours = Number(opt("hours", "6"));
const sim = buildSim(snapshot.animals);
const set = colliderSetFor(hamletPlotsFor(snapshot.animals));
const posesAt = rawPosesAt(sim, false);
type Shot = {kind: string; id: string; slug: string; t: number; x: number; y: number; z: number; length: number; source: string; collider: string};
const wanted = (opt("kinds") ?? "fence,rock,forest,building,cliff").split(",");
/** Open ground round a spot (no trunk within 6 m): a camera sees it, not leaves. */
const open = (x: number, z: number) => !set.list.some((c) => c.kind === "trunk" && Math.hypot(c.cx - x, c.cz - z) < 6);
const shots = new Map<string, Shot>();
const used = new Set<string>();
// (Walking or running on the ground, a body big enough to see; not a climb, which is a climber's own way up.)
const walking = (source: string) => /^(ground|hamlet:door|shadow|stay):(walk|run|step|stalk)?/.test(source) && !source.startsWith("surface");
for (let t = from + 60; t < from + hours * 3600 && shots.size < wanted.length; t += 2) {
    for (const {s, p} of posesAt(t, sim.animals)) {
        if (p.aloft || !p.moving || used.has(s.a.id) || s.body.length < 0.6 || !walking(p.source)) continue;
        let kind: string | null = null;
        let collider = "";
        const hit = bodyHit(set, s, p);
        if (hit && hit.depth > s.body.radius * 0.6) {
            kind = hit.collider.kind === "fence" ? "fence" : hit.collider.kind === "trunk" ? "forest" : hit.collider.kind === "rock" ? "rock" : hit.collider.kind === "building" ? "building" : null;
            collider = hit.collider.id;
        } else if (s.sched && !p.source.startsWith("surface") && !p.attached && s.profile.move === "walk") {
            const ground = sim.world.sampler.heightAt(p.x, p.z);
            if (Math.abs(p.y - ground) < 0.1 && sim.world.sampler.slope(p.x, p.z) > maxSlopeOf(s.sched) * 1.6) {
                kind = "cliff";
                collider = "slope";
            }
        }
        if (!kind || shots.has(kind) || !wanted.includes(kind) || (kind !== "forest" && !open(p.x, p.z))) continue;
        shots.set(kind, {kind, id: s.a.id, slug: s.a.model_slug, t, x: p.x, y: p.y, z: p.z, length: s.length, source: p.source, collider});
        used.add(s.a.id);
    }
}
writeFileSync(opt("out", "collide-shots.json")!, JSON.stringify(Array.from(shots.values()), null, 1));
console.log(Array.from(shots.values()).map((s) => `${s.kind}: ${s.slug} at ${s.t} (${s.source}, ${s.collider})`).join("\n"));
