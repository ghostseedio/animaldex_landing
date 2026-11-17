/**
 * p5 (humans): people walking the town's pavements (the owner, 2026-11-17: "walking along sidewalks in general").
 * The pavement graph comes from the plan's own streets; a walk is pure in the shared clock and the person's id; no
 * one walks through a wall, a fence, a tree or the water, or along a carriageway (they cross kerb to kerb at the
 * junctions and the zebra crossings).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {KEEP_LEFT, nodeFor, onWalkedGround, pavementGraph, PavementWalks, walkFix, walkSeconds, type WalkFix} from "@/ark-scene/humans/pavements";
import {TownHumans, walkGround} from "@/ark-scene/humans/town-humans";
import {bridgeAt} from "@/ark-scene/islands/town/canal-bridges";
import {inBox, polylineAt, polylineLength, polylineNearest, polylineWithin} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {CROSSINGS} from "@/ark-scene/islands/town/render/streets";
import {solidDistance, townSolids} from "@/ark-scene/islands/town/solids";

const plan = townPlan();
const graph = pavementGraph();
const ROADS = plan.streets.filter((s) => ["high", "road", "lane", "track"].includes(s.kind));
const roadsAt = (x: number, z: number, inset = 0) => ROADS.filter((s) => polylineWithin(s.line, x, z, s.width / 2 - inset));
const ROSTER = Array.from({length: 112}, (_, i) => `fixture-human-${String(i).padStart(3, "0")}`);
const SATURDAY = 20411;
const MONDAY = 20413;
const at = (day: number, hours: number) => ((day - 4) * 24 + hours) * 3600 * 1000;
const newFix = (): WalkFix => ({x: 0, z: 0, yaw: 0, paused: false, kind: "pavement", done: false});
const rhythmOf = (worker: boolean) => ({wake: 6.8, back: 17.5, worker});

/** Every point a walker can be on an edge: its line every half metre, on the line and `KEEP_LEFT` to each side. */
function edgePoints(e: (typeof graph.edges)[number]): Array<{x: number; z: number}> {
    const out: Array<{x: number; z: number}> = [];
    for (let s = 0; s <= e.length; s += 0.5) {
        let k = 1;
        while (k < e.line.length - 1 && e.at[k] < s) k++;
        const p = e.line[k - 1];
        const q = e.line[k];
        const span = e.at[k] - e.at[k - 1] || 1;
        const u = Math.min(Math.max((s - e.at[k - 1]) / span, 0), 1);
        const dx = (q.x - p.x) / span;
        const dz = (q.z - p.z) / span;
        const x = p.x + (q.x - p.x) * u;
        const z = p.z + (q.z - p.z) * u;
        const sides = e.kind === "pavement" || e.kind === "path" ? [-KEEP_LEFT, 0, KEEP_LEFT] : [0];
        for (const side of sides) out.push({x: x + dz * side, z: z - dx * side});
    }
    return out;
}

test("the graph covers both kerbs of every street with a pavement, and hangs together", () => {
    assert.ok(graph.nodes.length > 100 && graph.nodes.length < 600, `${graph.nodes.length} nodes`);
    assert.ok(graph.main.length >= graph.nodes.length * 0.95, `${graph.main.length} of ${graph.nodes.length} joined`);
    for (const s of plan.streets) {
        if (!(s.pavement > 0) || !ROADS.includes(s)) continue;
        const walked = graph.edges.filter((e) => e.kind === "pavement" && e.street === s.id).reduce((sum, e) => sum + e.length, 0);
        assert.ok(walked > polylineLength(s.line) * 2 * 0.7, `${s.id}: ${walked.toFixed(0)} m of pavement walked of ${(2 * polylineLength(s.line)).toFixed(0)}`);
    }
    // Every zebra crossing is a way across.
    const zebras = graph.edges.filter((e) => e.kind === "zebra");
    assert.equal(zebras.length, CROSSINGS.length);
    for (const c of CROSSINGS) {
        const s = plan.streets.find((q) => q.id === c.street)!;
        const {point} = polylineAt(s.line, c.at);
        assert.ok(zebras.some((e) => Math.hypot((e.line[0].x + e.line[e.line.length - 1].x) / 2 - point.x, (e.line[0].z + e.line[e.line.length - 1].z) / 2 - point.z) < 1.5), `a zebra edge at ${c.street} ${c.at}`);
    }
});

test("pavements keep to the pavement; a carriageway is only ever crossed, kerb to kerb, one at a time", () => {
    for (const e of graph.edges) {
        const points = edgePoints(e);
        if (e.kind === "pavement") {
            const s = plan.streets.find((q) => q.id === e.street)!;
            for (const p of points) {
                const d = polylineNearest(s.line, p.x, p.z).distance;
                assert.ok(d >= s.width / 2 + 0.15 && d <= s.width / 2 + s.pavement, `${e.street}: ${d.toFixed(2)} m from the middle`);
                assert.equal(roadsAt(p.x, p.z).length, 0, `${e.street}'s pavement in a carriageway at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
            }
        } else if (e.kind === "crossing" || e.kind === "zebra") {
            assert.ok(e.length <= 10.5, `a crossing of ${e.length.toFixed(1)} m`);
            for (const p of points) assert.ok(roadsAt(p.x, p.z, 0.4).length <= 1, "never a junction's diagonal");
            // Straight across: it starts and ends off the road.
            for (const p of [e.line[0], e.line[e.line.length - 1]]) assert.equal(roadsAt(p.x, p.z).length, 0);
        } else {
            for (const p of points) assert.equal(roadsAt(p.x, p.z).length, 0, `${e.kind} of ${e.street} in a carriageway`);
        }
    }
});

test("no way goes through a wall, a fence, a tree, a lamp or the water", () => {
    const solids = townSolids([]);
    for (const e of graph.edges) {
        for (const p of edgePoints(e)) {
            for (const b of plan.buildings) assert.ok(!inBox(b.at, p.x, p.z, 0.2), `${e.kind} ${e.street} in ${b.id}`);
            for (const s of solids) assert.ok(solidDistance(s, p.x, p.z) > 0.2, `${e.kind} ${e.street} in a solid at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
            if (!bridgeAt(p.x, p.z)) {
                const g = sampleTownGround(p.x, p.z);
                assert.ok(g.surface !== "water" && g.height > 0.35, `${e.kind} ${e.street} in the water`);
            }
        }
    }
});

test("a walk is the same for every viewer, starts and ends at its stops, and never jumps", () => {
    const home = nodeFor(graph, "a#door");
    const stops = [home, nodeFor(graph, "a#1", home, 150, 600), nodeFor(graph, "a#2", home, 150, 600), home];
    const pause = () => 30;
    const total = walkSeconds(graph, stops, 1.3, pause);
    assert.ok(total > 200 && total < 3600);
    const a = newFix();
    const b = newFix();
    let last: {x: number; z: number} | null = null;
    let paused = 0;
    for (let t = 0; t < total; t += 2) {
        walkFix(graph, stops, t, 1.3, pause, a);
        walkFix(graph, stops, t, 1.3, pause, b);
        assert.deepEqual(a, b);
        assert.ok(!a.done);
        // (Two seconds' walk, and the step from one side of the line to the other at a turn.)
        if (last) assert.ok(Math.hypot(a.x - last.x, a.z - last.z) <= 1.3 * 2 + 2 * KEEP_LEFT + 0.6, `a jump of ${Math.hypot(a.x - last.x, a.z - last.z).toFixed(1)} m at ${t}s`);
        last = {x: a.x, z: a.z};
        paused += a.paused ? 1 : 0;
    }
    assert.ok(paused >= 25 && paused <= 35, `stood ${paused * 2}s at two stops`);
    walkFix(graph, stops, 0, 1.3, pause, a);
    assert.ok(Math.hypot(a.x - graph.nodes[home].x, a.z - graph.nodes[home].z) < 1);
    walkFix(graph, stops, total + 1, 1.3, pause, a);
    assert.ok(a.done && Math.hypot(a.x - graph.nodes[home].x, a.z - graph.nodes[home].z) < 1e-6);
});

test("workers walk to work on a weekday morning and are home at the day's end; not at the weekend", () => {
    const walks = new PavementWalks();
    let morning = 0;
    for (const id of ROSTER) {
        for (let h = 7.5; h < 9.4; h += 0.005) {
            if (walks.at(id, h, MONDAY, MONDAY % 7, h < 9 ? "home" : "work", false, rhythmOf(true))) {
                assert.equal(walks.why, "commute");
                morning++;
                break;
            }
        }
        assert.equal(walks.at(id, 8.6, MONDAY, MONDAY % 7, "home", false, rhythmOf(false)), null, "not a worker: no commute");
        assert.equal(walks.at(id, 8.6, SATURDAY, SATURDAY % 7, "home", false, rhythmOf(true)), null, "no commute on a Saturday");
        // The walk home ends at `back`, at the door.
        const nearly = walks.at(id, 17.5 - 1 / 3600, MONDAY, MONDAY % 7, "work", false, rhythmOf(true));
        assert.ok(nearly, "walking home just before `back`");
        const door = graph.nodes[nodeFor(graph, `${id}#door`)];
        assert.ok(Math.hypot(nearly.x - door.x, nearly.z - door.z) < 3, "at the door");
        assert.equal(walks.at(id, 12, MONDAY, MONDAY % 7, "work", false, rhythmOf(true)), null, "at work at noon");
    }
    assert.equal(morning, ROSTER.length, "every worker walks in between 7:30 and 9:24");
});

test("an evening stroll for some, out and home again; errands by day for those about, home before the block ends", () => {
    const walks = new PavementWalks();
    let strollers = 0;
    for (const id of ROSTER) {
        let seen = false;
        for (let h = 19.5; h < 21.6; h += 0.02) seen = Boolean(walks.at(id, h, SATURDAY, SATURDAY % 7, "home", false, rhythmOf(false))) || seen;
        strollers += seen ? 1 : 0;
        assert.equal(walks.at(id, 22.5, SATURDAY, SATURDAY % 7, "home", false, rhythmOf(false)), null, "home by 22:30");
    }
    assert.ok(strollers > ROSTER.length * 0.15 && strollers < ROSTER.length * 0.45, `${strollers} strollers`);
    // Errands: walking for most of the block (13:30–15:00), gone in by its end; not when they are somewhere else.
    for (const id of ROSTER.slice(0, 40)) {
        let walking = 0;
        for (let h = 13.5; h < 15; h += 0.01) walking += walks.at(id, h, SATURDAY, SATURDAY % 7, "out", true, rhythmOf(false)) ? 1 : 0;
        assert.ok(walking > 150 * 0.45, `${id} on foot ${(walking * 0.6).toFixed(0)} of 90 minutes`);
        assert.equal(walks.at(id, 14.99, SATURDAY, SATURDAY % 7, "out", true, rhythmOf(false)), null, "indoors as the block ends");
        assert.equal(walks.at(id, 14.2, SATURDAY, SATURDAY % 7, "out", false, rhythmOf(false)), null, "on a bench or the beach: not on the pavement");
    }
});

test("in the town: the people about are on the pavements, each on walked ground or a crossing, at its height", () => {
    const make = (pavements?: boolean) => {
        const humans = new TownHumans({origin: {x: 0, z: 0}, pavements});
        humans.setRoster(ROSTER.map((id) => ({id})));
        return humans;
    };
    const humans = make();
    let seen = 0;
    for (const [day, hours] of [[SATURDAY, 14], [SATURDAY, 10.4], [MONDAY, 8.5], [MONDAY, 17.2], [SATURDAY, 20.1], [MONDAY, 12.3]] as const) {
        const list = humans.frame(at(day, hours), null, 6);
        assert.equal(new Set(list.map((h) => h.id)).size, list.length, "each person once");
        const walkers = list.filter((h) => h.what === "pavement");
        seen += walkers.length;
        for (const h of walkers) {
            assert.ok(h.pose === "walk" || h.pose === "stand");
            const ground = onWalkedGround(plan, h.x, h.z);
            const roads = roadsAt(h.x, h.z);
            assert.ok(ground || roads.length <= 1, "on a pavement, a path or a crossing");
            const floor = bridgeAt(h.x, h.z) ? walkGround(h.x, h.z, "pavement") : townHeight(h.x, h.z);
            assert.ok(h.y >= floor - 0.01 && h.y <= floor + 0.3, `feet on the ground (${(h.y - floor).toFixed(2)})`);
        }
        assert.deepEqual(make().frame(at(day, hours), null, 6).filter((h) => h.what === "pavement").map((h) => [h.id, h.x, h.z]), walkers.map((h) => [h.id, h.x, h.z]), "the same for every viewer");
    }
    assert.ok(seen > 40, `${seen} walkers seen over six moments`);
    assert.equal(make(false).frame(at(SATURDAY, 14), null, 6).filter((h) => h.what === "pavement").length, 0);
});
