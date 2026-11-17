/**
 * Primates moving through the canopy (the owner, 2026-11-17: "need to see monkeys swinging on the trees"):
 * `canopy-travel.ts`. The kinds' ways from their stored text (`canopy-moves.json`, `scripts/ark-canopy-moves.mts`)
 * and the genus table; routes from hold to hold of the trees: a swinger's hand on its hold while it swings, a leap
 * landing on its hold, up in the crowns throughout, never in the air outside a leap, a flight or a bound, never sunk,
 * the same for every viewer. On a grove of made trees, then on the wild island's own rainforest trees.
 */

import assert from "node:assert/strict";
import test from "node:test";
import moves from "@/ark-scene/canopy-moves.json";
import {canopyKindOf, canopyPoseAt, excursionStart, gapOf, pivotOf, planRoute, type Anchor, type CanopyKind, type CanopyRoute, type TrunkDisc} from "@/ark-scene/canopy-travel";

const dist = (a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("each kind's way through the crowns: from its own stored text first, else its genus; the ground apes none", () => {
    const species = (moves as unknown as {species: Record<string, [string, number, string]>}).species;
    assert.equal(species["lar-gibbon"][0], "brachiate");
    assert.match(species["lar-gibbon"][2], /arm over arm/);
    assert.equal(canopyKindOf("siamang", "Symphalangus syndactylus")?.mode, "brachiate");
    assert.equal(canopyKindOf("bornean-orangutan", "Pongo pygmaeus")?.slow, true);
    assert.equal(canopyKindOf("mantled-guereza", "Colobus guereza")?.mode, "leap");
    assert.equal(canopyKindOf("white-faced-saki", "Pithecia pithecia")?.mode, "leap");
    // "It runs along branches on all fours and does not swing."
    assert.equal(canopyKindOf("squirrel-monkey", "Saimiri sciureus")?.mode, "run");
    const howler = canopyKindOf("mantled-howler-monkey", "Alouatta palliata");
    assert.ok(howler && howler.tail);
    // No row of its own: its genus.
    assert.equal(canopyKindOf("toque-macaque", "Macaca sinica")?.mode, "run");
    assert.equal(canopyKindOf("tufted-gray-langur", "Semnopithecus priam")?.mode, "leap");
    assert.equal(canopyKindOf("northern-white-cheeked-gibbon", "Nomascus leucogenys")?.mode, "brachiate");
    assert.equal(canopyKindOf("chimpanzee", "Pan troglodytes"), null);
    assert.equal(canopyKindOf("western-gorilla", "Gorilla gorilla"), null);
    assert.equal(canopyKindOf("red-deer", "Cervus elaphus"), null);
    // Every row's quote is a real sentence of text (never empty), every mode one of the three.
    for (const [slug, row] of Object.entries(species)) {
        assert.ok(["brachiate", "leap", "run"].includes(row[0]), slug);
        assert.ok(row[2].length > 10, slug);
    }
});

// A grove: five trees 4.5 m apart along x, each with a limb's top and a hang point under it, 10 m up, on flat ground.
const GROUND = 0;
const flat = () => GROUND;
function grove(): {anchors: Anchor[]; trunks: TrunkDisc[]} {
    const anchors: Anchor[] = [];
    const trunks: TrunkDisc[] = [];
    for (let i = 0; i < 5; i++) {
        const x = i * 4.5;
        trunks.push({tree: `decor${i}`, x, z: 0, r: 0.4, top: 18});
        for (const [k, side] of [[0, 1], [1, -1]] as const) {
            const lx = x + 1.6 * side;
            anchors.push({id: `limb:decor${i}:${k}`, tree: `decor${i}`, x: lx, y: 10 + 0.3 * k, z: 0.4, nx: 0, ny: 1, nz: 0, under: false});
            anchors.push({id: `canopy_hang:decor${i}:${k}`, tree: `decor${i}`, x: lx, y: 9.85 + 0.3 * k, z: 0.4, nx: 0, ny: -1, nz: 0, under: true});
        }
    }
    return {anchors, trunks};
}

function sample(route: CanopyRoute, step = 0.02) {
    const out = [];
    for (let t = 0; t <= route.seconds; t += step) out.push({t, pose: canopyPoseAt(route, t)!});
    return out;
}

function checkRoute(route: CanopyRoute, anchors: Anchor[], label: string, groundAt: (x: number, z: number) => number = flat) {
    const holds = new Map(anchors.map((a) => [a.id, a]));
    const frames = sample(route);
    let last: (typeof frames)[number] | null = null;
    for (const {t, pose} of frames) {
        assert.ok(pose, `${label}: no pose at ${t}`);
        const g = groundAt(pose.centre.x, pose.centre.z);
        // Up in the crowns, never sunk.
        assert.ok(pose.centre.y > g + 2, `${label} t ${t.toFixed(2)}: ${pose.centre.y.toFixed(2)} not up in the crowns`);
        // Its hand, when it holds, on a hold.
        if (pose.hand) assert.ok(anchors.some((a) => dist(pose.hand!, pivotOf(a)) < 1e-6), `${label} t ${t.toFixed(2)}: its hand on no hold`);
        // Never in the air outside a leap, a flight or a bound: else its hand on a hold, or it sits on one (or runs along one tree's wood).
        if (!pose.air && !pose.hand) {
            const near = Math.min(...anchors.map((a) => dist(pose.centre, a)));
            assert.ok(near < route.length * 0.5 + route.reach + 0.05 || pose.phase === "run", `${label} t ${t.toFixed(2)}: ${near.toFixed(2)} m from any hold, not in the air`);
        }
        // Unit, square frames.
        assert.ok(Math.abs(Math.hypot(pose.up.x, pose.up.y, pose.up.z) - 1) < 1e-6 && Math.abs(Math.hypot(pose.forward.x, pose.forward.y, pose.forward.z) - 1) < 1e-6);
        // No jump: never further in a step than a fast leap goes (9 m/s).
        if (last) assert.ok(dist(last.pose.centre, pose.centre) < 9 * (t - last.t) + 0.05, `${label} t ${t.toFixed(2)}: a jump of ${dist(last.pose.centre, pose.centre).toFixed(2)} m`);
        last = {t, pose};
    }
    // Every hop ends on its hold: a swinger's hand catches it, a leaper lands on it.
    for (const hop of route.hops) {
        const end = canopyPoseAt(route, 0.8 + hop.start + hop.seconds - 1e-4)!;
        if (hop.style === "swing") {
            const grab = canopyPoseAt(route, 0.8 + hop.start + hop.seconds + 1e-4)!;
            assert.ok(grab.hand && dist(grab.hand, pivotOf(hop.to)) < 1e-6, `${label}: the catch at ${hop.to.id}`);
            assert.ok(Math.abs(dist(grab.centre, pivotOf(hop.to)) - route.reach) < 1e-3, `${label}: its body an arm's reach under the hold`);
        } else {
            const to = holds.get(hop.to.id)!;
            assert.ok(dist({x: end.centre.x - end.up.x * route.length * 0.18, y: end.centre.y - end.up.y * route.length * 0.18, z: end.centre.z - end.up.z * route.length * 0.18}, to) < 0.05, `${label}: lands on ${hop.to.id}`);
        }
    }
    // Home again at the end.
    const final = canopyPoseAt(route, route.seconds)!;
    assert.ok(dist(final.centre, route.home) < route.reach + route.length, `${label}: back at its hold`);
}

test("a gibbon swings arm over arm from tree to tree and back: hand on the hold through each swing, a flight across each gap, caught", () => {
    const {anchors, trunks} = grove();
    const kind = canopyKindOf("lar-gibbon", "Hylobates lar")!;
    const route = planRoute(anchors[1], anchors, trunks, kind, 0.6, 12345, flat)!;
    assert.ok(route, "a route");
    assert.ok(route.hops.length >= 2 && route.hops.every((h) => h.style === "swing"));
    assert.ok(new Set(route.hops.map((h) => h.to.tree)).size >= 2, "through more than one tree");
    checkRoute(route, anchors, "gibbon");
    // Through each swing its body is an arm's reach from the hand: a pendulum.
    let swinging = 0;
    let flying = 0;
    for (const {pose} of sample(route)) {
        if (pose.phase === "swing") {
            swinging++;
            assert.ok(Math.abs(dist(pose.centre, pose.hand!) - route.reach) < 1e-6);
            assert.ok(pose.centre.y < pose.hand!.y, "hangs under its hand");
        }
        if (pose.phase === "flight") flying++;
    }
    assert.ok(swinging > 50 && flying > 10, `${swinging} swinging, ${flying} flying`);
});

test("a colobus leaps on an arc from crown to crown and lands on the hold; a squirrel monkey runs and bounds", () => {
    const {anchors, trunks} = grove();
    for (const [slug, scientific, length] of [["mantled-guereza", "Colobus guereza", 0.6], ["squirrel-monkey", "Saimiri sciureus", 0.3], ["toque-macaque", "Macaca sinica", 0.5]] as const) {
        const kind = canopyKindOf(slug, scientific)!;
        const route = planRoute(anchors[0], anchors, trunks, kind, length, 777, flat);
        assert.ok(route, slug);
        if (kind.mode === "leap") assert.ok(route.hops.some((h) => h.style === "leap"));
        checkRoute(route, anchors, slug);
        // A leap rises over the straight line between its holds.
        const leap = route.hops.find((h) => h.style === "leap");
        if (leap) {
            const mid = canopyPoseAt(route, 0.8 + leap.start + leap.seconds / 2)!;
            assert.ok(mid.air && mid.centre.y > (leap.from.y + leap.to.y) / 2 + 0.2, `${slug}: an arc`);
        }
    }
});

test("a route keeps clear of other trees' trunks, within its kind's gap, and is the same every time (pure)", () => {
    const {anchors, trunks} = grove();
    // A trunk standing between the first two trees: no line through it.
    const blocked = [...trunks, {tree: "decor9", x: 2.25, z: 0.4, r: 0.5, top: 20}];
    const kind = canopyKindOf("lar-gibbon", "Hylobates lar")!;
    const route = planRoute(anchors[1], anchors, blocked, kind, 0.6, 99, flat);
    for (const hop of route?.hops ?? []) {
        const crosses = (hop.from.x - 2.25) * (hop.to.x - 2.25) < 0;
        assert.ok(!crosses, `${hop.from.id} -> ${hop.to.id} through the trunk`);
        assert.ok(Math.hypot(hop.to.x - hop.from.x, hop.to.z - hop.from.z) <= gapOf(kind, 0.6) + 1e-9);
    }
    const a = planRoute(anchors[1], anchors, trunks, kind, 0.6, 4242, flat)!;
    const b = planRoute(anchors[1], anchors, trunks, kind, 0.6, 4242, flat)!;
    assert.deepEqual(a, b);
    for (let t = 0; t < a.seconds; t += 0.37) assert.deepEqual(canopyPoseAt(a, t), canopyPoseAt(b, t));
    // When in a stay: its seed's and slot's own, inside the stay with time to spare, or not this slot.
    let runs = 0;
    for (let slot = 0; slot < 200; slot++) {
        const start = excursionStart(a, 4242, slot, 80);
        if (start === null) continue;
        runs++;
        assert.ok(start >= 2 && start + a.seconds <= 80 - 2 + 1e-9);
    }
    assert.ok(runs > 60 && runs < 200, `${runs} of 200 slots`);
});

test("on the wild island's own rainforest trees: routes from their holds keep every rule", async () => {
    const {setArkWorld} = await import("@/ark-scene/world");
    setArkWorld("v2");
    const {allAttachPoints} = await import("@/ark-scene/sampler");
    const {placedTrunk, treeHostOf} = await import("@/ark-scene/tree-climb");
    const {heightAt, ZONE_SITES} = await import("@/ark-scene/world");
    const site = ZONE_SITES.rainforest;
    const points = allAttachPoints().filter((p) => Math.hypot(p.position.x - site.x, p.position.z - site.z) < 90);
    const anchors: Anchor[] = points.filter((p) => p.tag === "limb" || p.tag === "canopy_hang" || p.tag === "branch").map((p) => ({id: p.id, tree: treeHostOf(p.id)!, x: p.position.x, y: p.position.y, z: p.position.z, nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, under: p.tag === "canopy_hang"})).filter((a) => a.tree);
    const trunks: TrunkDisc[] = [];
    const seen = new Set<string>();
    for (const p of points) {
        const tree = treeHostOf(p.id);
        if (!tree || seen.has(tree) || !p.asset || !p.wind) continue;
        seen.add(tree);
        const t = placedTrunk(p.asset, p.wind);
        if (t) trunks.push({tree, x: t.x, z: t.z, r: t.r0, top: t.y + t.height});
    }
    assert.ok(anchors.length > 100, `${anchors.length} holds in the rainforest`);
    const kinds: Array<[string, CanopyKind, number]> = [["siamang", canopyKindOf("siamang", "Symphalangus syndactylus")!, 0.89], ["mantled-guereza", canopyKindOf("mantled-guereza", "Colobus guereza")!, 0.6], ["tufted-capuchin", canopyKindOf("tufted-capuchin", "Sapajus apella")!, 0.46]];
    let routes = 0;
    for (const [slug, kind, length] of kinds) {
        for (const home of anchors.filter((a) => !a.under).filter((_, i) => i % 13 === 0)) {
            const route = planRoute(home, anchors, trunks, kind, length, 31 + routes, heightAt);
            if (!route) continue;
            routes++;
            checkRoute(route, anchors, `${slug} from ${home.id} (seed ${31 + routes - 1})`, heightAt);
            // Never through another tree's trunk.
            for (const hop of route.hops) {
                for (const t of trunks) {
                    if (t.tree === hop.from.tree || t.tree === hop.to.tree || t.top < Math.min(hop.from.y, hop.to.y) - 1) continue;
                    const dx = hop.to.x - hop.from.x;
                    const dz = hop.to.z - hop.from.z;
                    const l2 = dx * dx + dz * dz || 1;
                    const k = Math.min(Math.max(((t.x - hop.from.x) * dx + (t.z - hop.from.z) * dz) / l2, 0), 1);
                    assert.ok(Math.hypot(hop.from.x + dx * k - t.x, hop.from.z + dz * k - t.z) >= t.r + 0.35 - 1e-9, `${slug}: ${hop.from.id} -> ${hop.to.id} through ${t.tree}`);
                }
            }
        }
    }
    assert.ok(routes >= 60, `${routes} routes planned`);
});
