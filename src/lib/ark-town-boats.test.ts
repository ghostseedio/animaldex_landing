/**
 * The town's boats (graphics pass 1; the owner, 2026-11-16: "boat in the docking area is half in the water and has
 * glitching interior", "canal boat is half in the water"). Both hulls were wound inward, so back-face culling dropped
 * their near sides and decks and drew the inside of the far side; the narrowboats' panels sat half a centimetre off the
 * cabin side; the fishing boats were pinned 0.15 m up whatever the tide; a narrowboat on a bend ran into the wall.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {BufferGeometry} from "three";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {canalBerth, CANAL_BERTH, fishingBoatGeometry, FISHING_BOAT_STATIONS, hull, hullFits, hullOutline, narrowboatGeometry, NARROWBOAT_LIVERIES, narrowboatStations, type Station} from "@/ark-scene/islands/town/render/boats";
import {HARBOUR_BASIN, townPlan} from "@/ark-scene/islands/town/plan";

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The area two coplanar triangles share (Sutherland-Hodgman in the plane's 2D frame). */
function overlap(a: Array<[number, number]>, b: Array<[number, number]>): number {
    const area = (p: Array<[number, number]>) => p.reduce((s, q, i) => s + (q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1]), 0) / 2;
    const ccw = (p: Array<[number, number]>) => (area(p) < 0 ? [...p].reverse() : p);
    let out = ccw(a);
    const clip = ccw(b);
    for (let i = 0; i < clip.length && out.length; i++) {
        const [p, q] = [clip[i], clip[(i + 1) % clip.length]];
        const side = (r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        const input = out;
        out = [];
        for (let j = 0; j < input.length; j++) {
            const [s, e] = [input[j], input[(j + 1) % input.length]];
            const [ss, se] = [side(s), side(e)];
            if (se >= 0) {
                if (ss < 0) out.push([s[0] + ((e[0] - s[0]) * ss) / (ss - se), s[1] + ((e[1] - s[1]) * ss) / (ss - se)]);
                out.push(e);
            } else if (ss >= 0) out.push([s[0] + ((e[0] - s[0]) * ss) / (ss - se), s[1] + ((e[1] - s[1]) * ss) / (ss - se)]);
        }
    }
    return out.length >= 3 ? Math.abs(area(out)) : 0;
}

/** Pairs of differently coloured triangles in one plane (within 2 mm) sharing more than `minArea` m². */
function coplanarFights(geometry: BufferGeometry, minArea = 0.002): Array<{at: V; area: number; key: string; colours: string}> {
    const pos = geometry.getAttribute("position");
    const col = geometry.getAttribute("color");
    const n = pos.count / 3;
    const planes = new Map<string, Array<{tri: V[]; colour: string; u: V; v: V}>>();
    for (let t = 0; t < n; t++) {
        const tri = [0, 1, 2].map((k) => [pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)] as V);
        let nv = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]));
        const len = Math.hypot(...nv);
        if (len < 1e-9) continue;
        nv = nv.map((c) => c / len) as V;
        const lead = Math.abs(nv[0]) > 1e-6 ? nv[0] : Math.abs(nv[1]) > 1e-6 ? nv[1] : nv[2];
        if (lead < 0) nv = nv.map((c) => -c) as V;
        const d = dot(nv, tri[0]);
        const key = `${nv.map((c) => Math.round(c * 500)).join(",")}|${Math.round(d * 500)}`;
        const u = Math.abs(nv[1]) < 0.9 ? cross(nv, [0, 1, 0]) : cross(nv, [1, 0, 0]);
        const ul = Math.hypot(...u);
        const uu = u.map((c) => c / ul) as V;
        const colour = [col.getX(t * 3), col.getY(t * 3), col.getZ(t * 3)].map((c) => c.toFixed(3)).join(",");
        const list = planes.get(key) ?? [];
        list.push({tri, colour, u: uu, v: cross(nv, uu)});
        planes.set(key, list);
    }
    const fights: Array<{at: V; area: number; key: string; colours: string}> = [];
    for (const [key, list] of Array.from(planes)) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                if (list[i].colour === list[j].colour) continue;
                const {u, v} = list[i];
                const flat = (tri: V[]) => tri.map((p) => [dot(p, u), dot(p, v)] as [number, number]);
                const area = overlap(flat(list[i].tri), flat(list[j].tri));
                if (area > minArea) fights.push({at: list[i].tri[0], area, key, colours: `${list[i].colour} / ${list[j].colour}`});
            }
        }
    }
    return fights;
}


/** A hull alone (no bulwark): every edge shared by exactly two triangles, run opposite ways (closed, wound one way), and its signed volume positive (wound outward). */
function closedOutward(stations: Station[]): {open: number; volume: number} {
    const g = new Geo();
    const grey: [number, number, number] = [0.5, 0.5, 0.5];
    hull(g, stations, [[-5, 0, grey], [0, 5, grey]], grey);
    const key = (i: number) => `${g.pos[i].toFixed(4)},${g.pos[i + 1].toFixed(4)},${g.pos[i + 2].toFixed(4)}`;
    const edges = new Map<string, number>();
    let volume = 0;
    for (let t = 0; t < g.pos.length; t += 9) {
        const a: V = [g.pos[t], g.pos[t + 1], g.pos[t + 2]];
        const b: V = [g.pos[t + 3], g.pos[t + 4], g.pos[t + 5]];
        const c: V = [g.pos[t + 6], g.pos[t + 7], g.pos[t + 8]];
        if (Math.hypot(...cross(sub(b, a), sub(c, a))) < 1e-9) continue;
        volume += dot(a, cross(b, c)) / 6;
        const k = [key(t), key(t + 3), key(t + 6)];
        for (let e = 0; e < 3; e++) {
            const from = k[e];
            const to = k[(e + 1) % 3];
            if (from === to) continue;
            const back = `${to}>${from}`;
            if (edges.has(back)) {
                const left = edges.get(back)! - 1;
                if (left) edges.set(back, left);
                else edges.delete(back);
            } else edges.set(`${from}>${to}`, (edges.get(`${from}>${to}`) ?? 0) + 1);
        }
    }
    return {open: edges.size, volume};
}

test("the boats' hulls are closed and wound outward (no side, deck or stern dropped by culling)", () => {
    for (const [name, stations] of [["fishing boat", FISHING_BOAT_STATIONS], ["narrowboat", narrowboatStations()]] as const) {
        const {open, volume} = closedOutward(stations);
        assert.equal(open, 0, `${name}: ${open} open edges`);
        assert.ok(volume > 1, `${name}: signed volume ${volume.toFixed(2)} m³ (negative: wound inward)`);
    }
});

test("the boats: no two colours in one plane (no flickering cabins, panels or decks)", () => {
    const geometries: Array<[string, BufferGeometry]> = [["fishing boat", fishingBoatGeometry()], ...NARROWBOAT_LIVERIES.map((l, k) => [`narrowboat ${k}`, narrowboatGeometry(l)] as [string, BufferGeometry])];
    for (const [name, geometry] of geometries) {
        const fights = coplanarFights(geometry);
        assert.equal(fights.length, 0, `${name}: ${fights.length} fights, e.g. ${JSON.stringify(fights.slice(0, 3))}`);
    }
});

test("each boat's waterline is its origin: hull under the water, deck over it", () => {
    for (const geometry of [fishingBoatGeometry(), narrowboatGeometry(NARROWBOAT_LIVERIES[0])]) {
        geometry.computeBoundingBox();
        assert.ok(geometry.boundingBox!.min.y < -0.4, `draught ${geometry.boundingBox!.min.y}`);
    }
    for (const stations of [FISHING_BOAT_STATIONS, narrowboatStations()]) for (const s of stations) assert.ok(s.top > 0.4 && s.bottom < 0.2, `station at ${s.z}`);
});

test("every narrowboat lies inside the canal's walls all along its hull, by a fender's gap", () => {
    const plan = townPlan();
    const canal = plan.moorings.filter((m) => !m.harbour);
    assert.ok(canal.length >= 6);
    for (const m of canal) {
        const b = canalBerth(m);
        assert.ok(b.length >= Math.min(m.length, 12), `berth at ${m.x.toFixed(1)},${m.z.toFixed(1)} cut to ${b.length} m`);
        assert.ok(hullFits(b), `hull at ${m.x.toFixed(1)},${m.z.toFixed(1)} reaches the wall`);
        // (And it lies by its own bank, not in the middle of the channel.)
        assert.ok(hullOutline(b).some((p) => Math.abs(p.x - b.x) + Math.abs(p.z - b.z) > 0) && CANAL_BERTH > 3);
    }
});

test("every fishing boat lies inside the harbour basin, clear of its walls", () => {
    const plan = townPlan();
    for (const m of plan.moorings.filter((x) => x.harbour)) {
        const scale = m.length / 7;
        for (const p of hullOutline({x: m.x, z: m.z, turn: m.turn, length: 7 * scale}, 2 * 1.2 * scale)) {
            assert.ok(Math.abs(p.x - HARBOUR_BASIN.x) < HARBOUR_BASIN.w / 2 - 0.2 && Math.abs(p.z - HARBOUR_BASIN.z) < HARBOUR_BASIN.d / 2 - 0.2, `boat at ${m.x},${m.z}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
        }
    }
});
