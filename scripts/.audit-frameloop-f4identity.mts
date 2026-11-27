/**
 * PERF-WEB audit, FRAME-4 identity verifier (2026-11-27). Untracked helper; not part of the tree. Read-only.
 *
 * FRAME-4 moves the start's sliced builds (world, spacing, props homes/areas, attach points, the town join, people bake)
 * from rAF / idle callbacks into one deadline-task runner. Their products do not depend on slicing; the question here is
 * how much of the COMPOSED state depends on the ORDER in which those builds finish relative to the town join:
 *
 *  P  The props' presence (props/presence.ts) for the mount's wild snapshot and for each join batch's partial snapshot
 *     (attachIsland: wild + town[0:450k], sorted by arrived_at; humans removed as setSnapshot does): how many nest plans,
 *     how many with a sitter, how many with eggs/chicks (sitterIntent: their every slot goes to the props nest), whether
 *     the presence key changes per batch (each change starts another full homes build, `rebuildHomes`, that later calls
 *     registerNestSites itself).
 *  T  The town's plan for each join batch's town animals vs the whole list (placeTownAnimals): a kept town animal's
 *     schedule home is its place when its schedule is made (makeSched), and setSnapshot keeps an entry's schedule.
 *
 *   npx tsx scripts/.audit-frameloop-f4identity.mts [--snapshot <voyage.json>]
 */
import {readFileSync, existsSync} from "node:fs";
import path from "node:path";
import {setArkWorld} from "@/ark-scene/world";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] !== undefined && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
setArkWorld("v2");

const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot, arkTwoIslands, arkIslandOf} = await import("@/lib/ark-islands");
const {propsPresence, presenceKey} = await import("@/ark-scene/props/presence");
const {isHumanAnimal} = await import("@/ark-scene/humans/town-humans");
const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");

type ArkAnimal = import("@/ark-scene/types").ArkAnimal;
type ArkSnapshot = import("@/ark-scene/types").ArkSnapshot;

const raw = JSON.parse(readFileSync(arg("snapshot", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/real/voyage.json"), "utf8"));
const whole = decodeArkSnapshot(raw.snapshot ?? raw)! as ArkSnapshot;
const two = arkTwoIslands(whole);
const plansDir = path.join(process.env.HOME ?? "", "animaldex-talking-models");
const planCache = new Map<string, string | undefined>();
const planOf = (slug: string): string | undefined => {
    if (!planCache.has(slug)) {
        let plan: string | undefined;
        try {
            const file = path.join(plansDir, "ark", slug, "ark.json");
            if (existsSync(file)) plan = (JSON.parse(readFileSync(file, "utf8")) as {behaviour?: {plan?: string}}).behaviour?.plan;
        } catch {
            plan = undefined;
        }
        planCache.set(slug, plan);
    }
    return planCache.get(slug);
};
const rest = (s: ArkSnapshot): ArkSnapshot => ({...s, animals: s.animals.filter((a) => !isHumanAnimal(a))});
const townOf = (a: ArkAnimal) => arkIslandOf(a, two) === "town";

const summary = (s: ArkSnapshot) => {
    const p = propsPresence(s, planOf);
    const withSitter = p.nests.filter((n) => n.sitter);
    const sitting = withSitter.filter((n) => n.eggs > 0 || n.chicks > 0);
    const byId = new Map(s.animals.map((a) => [a.id, a]));
    return {
        key: presenceKey(p),
        nests: p.nests.length,
        withSitter: withSitter.length,
        sittersWithEggsOrChicks: sitting.length,
        townSitters: withSitter.filter((n) => n.sitter && byId.get(n.sitter) && townOf(byId.get(n.sitter)!)).length,
        groups: Array.from(p.groups.entries()).map(([g, list]) => `${g}:${list.length}`).join(" ")
    };
};

const mountWild = rest(arkIslandSnapshot(whole, "wild"));
const wildAnimals = whole.animals.filter((a) => !townOf(a));
const townAnimals = whole.animals.filter((a) => townOf(a));
console.log(`two islands ${two}; animals ${whole.animals.length} (wild ${wildAnimals.length}, town ${townAnimals.length}); humans ${whole.animals.filter(isHumanAnimal).length}; nests rows ${whole.nests?.length ?? 0}`);

const t0 = performance.now();
const m = summary(mountWild);
console.log(`P mount (wild snapshot): nests ${m.nests}, with sitter ${m.withSitter}, sitters with eggs/chicks ${m.sittersWithEggsOrChicks}; groups ${m.groups}`);
let lastKey = m.key;
let keyChanges = 0;
let joined = 0;
let batch = 0;
const batchKeys: string[] = [];
for (;;) {
    joined = Math.min(joined + 450, townAnimals.length);
    const done = joined >= townAnimals.length;
    const part: ArkSnapshot = done ? whole : {...whole, animals: [...wildAnimals, ...townAnimals.slice(0, joined)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))};
    const s = summary(rest(part));
    batch++;
    const changed = s.key !== lastKey;
    if (changed) keyChanges++;
    batchKeys.push(s.key);
    console.log(`P join batch ${batch} (${joined} town): nests ${s.nests}, with sitter ${s.withSitter} (town ${s.townSitters}), sitters with eggs/chicks ${s.sittersWithEggsOrChicks}, key ${changed ? "CHANGED" : "same"}`);
    lastKey = s.key;
    if (done) break;
}
console.log(`P presence key changes over the join: ${keyChanges} of ${batch} batches (each a new full homes build in rebuildHomes, besides the placements part of its key); ${((performance.now() - t0) / 1000).toFixed(1)} s`);

// T: the town's plan for partial join lists vs the whole list.
const t1 = performance.now();
const full = placeTownAnimals(townAnimals);
const open = full.open;
let compared = 0;
let placeDiffs = 0;
let infoDiffs = 0;
let maxM = 0;
let batches = 0;
const firstSeenDiff = new Set<string>();
for (let n = 450; n < townAnimals.length; n += 450) {
    batches++;
    const part = [...wildAnimals, ...townAnimals.slice(0, n)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at)).filter((a) => townOf(a));
    const got = placeTownAnimals(part, open);
    got.places.forEach((p, id) => {
        const w = full.places.get(id);
        compared++;
        if (!w) {
            placeDiffs++;
            return;
        }
        if (p.x !== w.x || p.z !== w.z || p.ground !== w.ground || p.yaw !== w.yaw) {
            placeDiffs++;
            firstSeenDiff.add(id);
            maxM = Math.max(maxM, Math.hypot(p.x - w.x, p.z - w.z));
        }
        const a = got.town.get(id);
        const b = full.town.get(id);
        if (JSON.stringify({r: a?.range, e: a?.enclosure?.id, pen: a?.pen, w: a?.where, s: a?.still}) !== JSON.stringify({r: b?.range, e: b?.enclosure?.id, pen: b?.pen, w: b?.where, s: b?.still})) infoDiffs++;
    });
}
console.log(`T town plan, partial (450 a batch, ${batches} partial batches) vs whole: ${compared} animal-batches compared, place differs ${placeDiffs} (${firstSeenDiff.size} distinct animals, max ${maxM.toFixed(2)} m), range/enclosure/pen/where/still differs ${infoDiffs}; ${((performance.now() - t1) / 1000).toFixed(1)} s`);
