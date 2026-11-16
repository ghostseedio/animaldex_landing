/**
 * The zoo houses' cutaway shell never has two differently coloured faces in the same plane over the same area (the
 * owner, 2026-11-16: "the enclosure with the racoons and other small animals, the roof and walls are flashing"). The
 * nocturnal house's foot band (the roof's colour) shared the wall's inside plane, so the two fought in the depth buffer
 * and the cut-down wall flashed navy and cream as the view moved. The shell is drawn double-sided, so faces that point
 * opposite ways in one plane fight too.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {BufferGeometry, Mesh} from "three";
import {zooEnclosures} from "@/ark-scene/islands/town/areas";

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
export function coplanarFights(geometry: BufferGeometry, minArea = 0.002): Array<{at: V; area: number; key: string; colours: string}> {
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

test("the zoo houses' cutaway shell: no two colours in one plane (no flashing walls or roofs)", async () => {
    const {buildZooHouses} = await import("@/ark-scene/islands/town/render/zoo-houses");
    const enclosures = zooEnclosures();
    const built = buildZooHouses(enclosures);
    const shell = built.group.children.find((o) => o.name === "zoo-houses:shell") as Mesh | undefined;
    assert.ok(shell, "a shell is built");
    const fights = coplanarFights(shell.geometry);
    assert.equal(fights.length, 0, `coplanar fights: ${fights.length}, e.g. ${JSON.stringify(fights.slice(0, 3))}`);
    built.dispose();
});
