/**
 * The aviary's roof is one consistent frame (the owner, 2026-11-16: "the aviary roof needs fixing looks like random
 * bars"): every arch rib lands on a post top of the long walls, its tubes join end to end, it spans the short side, the
 * vault stays under the height the enclosure's trees and birds are kept to, and the drawn frame's members all touch
 * another member (no loose bar floating in the air).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {zooEnclosures} from "@/ark-scene/islands/town/areas";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {AVIARY, aviaryFrame, zooBarrier} from "@/ark-scene/islands/town/render/zoo-barriers";
import {Geo} from "@/ark-scene/islands/town/render/kit";

const aviaries = zooEnclosures().filter((e) => e.type === "aviaries" && !e.shared);
const near = (a: number[], b: number[], tol = 1e-6) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < tol;

test("there are open aviaries to check", () => {
    assert.ok(aviaries.length >= 1);
});

test("every rib springs from a post top on each long wall and spans the short side", () => {
    for (const e of aviaries) {
        const f = aviaryFrame(e.slot.at);
        assert.equal(f.span, Math.min(e.slot.at.w, e.slot.at.d), e.id);
        const [left, right] = f.walls;
        assert.equal(f.ribs.length, left.length, `${e.id}: one rib per post pair`);
        f.ribs.forEach((rib, j) => {
            assert.ok(near(rib[0], f.top(left[j])), `${e.id} rib ${j} left foot on its post`);
            assert.ok(near(rib[rib.length - 1], f.top(right[j])), `${e.id} rib ${j} right foot on its post`);
            assert.equal(rib.length, AVIARY.segments + 1);
            // Rises to the crown and back: up then down, never a step.
            const crown = rib[Math.round(AVIARY.segments / 2)][1];
            assert.ok(Math.abs(crown - ((rib[0][1] + rib[rib.length - 1][1]) / 2 + AVIARY.rise)) < 1e-6, `${e.id} rib ${j} arches`);
            const rises = rib.map((p, i) => p[1] - (rib[0][1] + ((rib[rib.length - 1][1] - rib[0][1]) * i) / AVIARY.segments));
            for (let i = 1; i < rises.length; i++) assert.ok(i <= AVIARY.segments / 2 ? rises[i] > rises[i - 1] : rises[i] < rises[i - 1], `${e.id} rib ${j} a smooth arch`);
            for (let i = 1; i < rib.length; i++) assert.ok(Math.hypot(rib[i][0] - rib[i - 1][0], rib[i][2] - rib[i - 1][2]) < f.span / AVIARY.segments + 1e-6, "ribs are a chain of short tubes");
        });
    }
});

test("the vault stays under the aviary's height for its trees and birds (ground + 8.5 m)", () => {
    for (const e of aviaries) {
        const f = aviaryFrame(e.slot.at);
        for (const rib of f.ribs) for (const p of rib) assert.ok(p[1] <= townHeight(p[0], p[2]) + 8.5, `${e.id} under 8.5 m`);
    }
});

test("no loose bar: every drawn steel member touches another one", () => {
    const e = aviaries[0];
    const parts = {solid: new Geo(), net: new Geo()};
    zooBarrier(parts, e);
    // Each strut is 4 quads = 8 triangles = 24 vertices; take each member's two end centres from its vertex ring.
    const pos = parts.solid.pos;
    const members: Array<{a: number[]; b: number[]}> = [];
    const verts = pos.length / 3;
    // (Struts are emitted as quads r0[i], r0[j], r1[j] / r0[i], r1[j], r1[i]: the first vertex of each pair of triangles is on end a.)
    for (let v = 0; v + 24 <= verts; v += 24) {
        const ends: number[][] = [];
        for (let q = 0; q < 4; q++) {
            const base = (v + q * 6) * 3;
            ends.push([pos[base], pos[base + 1], pos[base + 2]], [pos[base + 6], pos[base + 7], pos[base + 8]]);
        }
        const a = [0, 1, 2].map((k) => (ends[0][k] + ends[2][k] + ends[4][k] + ends[6][k]) / 4);
        const b = [0, 1, 2].map((k) => (ends[1][k] + ends[3][k] + ends[5][k] + ends[7][k]) / 4);
        members.push({a, b});
    }
    // Only the frame's tubes are checked (the sign's boxes have 36 vertices a box and are not on 24-vertex boundaries
    // after the frame; the frame is drawn first). Every member's end lies within 0.3 m of another member's segment.
    const segDist = (p: number[], a: number[], b: number[]) => {
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
        const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2));
        return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t);
    };
    const f = aviaryFrame(e.slot.at);
    const frameCount = f.walls.reduce((s, w) => s + w.length + (w.length - 1) * 3, 0) + f.ribs.length * AVIARY.segments + (f.ribs.length - 1) * 3;
    const frame = members.slice(0, frameCount);
    frame.forEach((m, i) => {
        const touches = (p: number[]) => frame.some((o, k) => k !== i && segDist(p, o.a, o.b) < 0.3) || p[1] <= townHeight(p[0], p[2]) + 0.3;
        assert.ok(touches(m.a) && touches(m.b), `member ${i} of ${frame.length} is attached at both ends`);
    });
});
