/**
 * p3 (solid): the wild island (islands mode, world v2) over a stretch of the shared schedule with the collisions' layer:
 * how often a walker's body centre stands inside a shrub, a rock, a log, a trunk or a termite mound, per kind.
 * `--before`: with shrubs soft and no mounds, as they were. Prints JSON.
 */
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {setArkWorld} from "@/ark-scene/world";
import {setNoHamlet} from "@/ark-scene/no-hamlet";
import {hamletPlotsFor} from "@/ark-scene/map/hamlet";
import {buildColliders, colliderDistance, ColliderSet} from "@/ark-scene/collide/colliders";
import {buildSim} from "@/lib/ark-collide/sim";
import {resolvedPosesAt} from "@/lib/ark-collide/metrics";
import {collideFixture} from "@/lib/ark-collide/fixture";

const before = process.argv.includes("--before");
const hours = Number(process.argv.find((a) => a.startsWith("--hours="))?.slice(8) ?? 2);
const step = Number(process.argv.find((a) => a.startsWith("--step="))?.slice(7) ?? 10);
setNoHamlet(true);
setArkWorld("v2");
// (`--all`: the collisions fixture's every species, `lib/ark-collide/fixture.ts`, on the wild island.)
const list0 = process.argv.includes("--all") ? collideFixture(process.cwd(), {limit: 420}) : arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "wild").animals;
const wild = {animals: list0};
const sim = buildSim(wild.animals);
const plots = hamletPlotsFor(wild.animals);
const now = buildColliders(plots);
const list = before ? now.filter((c) => !c.id.startsWith("mound:")).map((c) => (c.kind === "shrub" ? {...c, gap: 0, soft: true} : c)) : now;
const set = new ColliderSet(list, `audit:${before}`);
const check = new ColliderSet(now.filter((c) => c.kind === "shrub" || c.kind === "mound" || c.kind === "rock" || c.kind === "log" || c.kind === "trunk"), "check");
const poses = resolvedPosesAt(sim, set);
const walkers = sim.animals.filter((s) => s.sched && s.profile.move !== "fly" && s.profile.move !== "swim" && s.profile.move !== "sessile");
const from = Math.floor(Date.UTC(2026, 10, 12, 5, 0) / 1000);
const byKind: Record<string, number> = {};
const pairs: Record<string, number> = {};
let samples = 0;
const t0 = Date.now();
for (let t = from; t < from + hours * 3600; t += step) {
    for (const {s, p} of poses(t, walkers)) {
        if (p.aloft || p.fixed || (p.attached && p.attached.length)) continue;
        samples++;
        for (const c of check.near(p.x, p.z, 0.01)) {
            if (c.gap > 0 && s.body.radius * 2 < c.gap) continue;
            if (p.y >= c.y1 - 0.05 || colliderDistance(c, p.x, p.z) >= 0) continue;
            const kind = c.id.startsWith("mound:") ? "mound" : c.kind;
            byKind[kind] = (byKind[kind] ?? 0) + 1;
            const key = `${s.a.model_slug} ${c.id}`;
            pairs[key] = Math.max(pairs[key] ?? 0, -colliderDistance(c, p.x, p.z));
            break;
        }
    }
}
const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(JSON.stringify({before, walkers: walkers.length, samples, byKind, worst: top, ms: Date.now() - t0}, null, 1));
