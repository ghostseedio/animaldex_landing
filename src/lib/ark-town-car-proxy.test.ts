/**
 * The far car (graphics pass 1; the owner, 2026-11-16: "cars look like several polygons"): past the middle distance
 * every car was a box with a box cabin and box wheels. `proxyGeometry` now lofts a body and a cabin from each model's
 * own box and glass line, with round wheels, lamps, grille and plate. Kept cheap (one instanced draw per kind).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {CAR_BOXES, proxyGeometry} from "@/ark-scene/islands/town/render/vehicles";

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

for (const [kind, box] of Object.entries(CAR_BOXES)) {
    test(`the far ${kind}: a car's shape inside its own box, round wheels, lamps at both ends facing out, cheap`, () => {
        const g = proxyGeometry(box);
        const pos = g.getAttribute("position");
        const lamp = g.getAttribute("aLamp");
        const paint = g.getAttribute("aPaint");
        const n = pos.count / 3;
        assert.ok(n >= 200 && n <= 400, `${n} triangles`);
        g.computeBoundingBox();
        const b = g.boundingBox!;
        const [w, h, l] = box.size;
        assert.ok(b.max.x - b.min.x <= w + 0.02 && b.max.y <= h + 0.01 && b.min.y >= -0.001 && b.max.z - b.min.z <= l + 0.05, `bounds ${JSON.stringify(b)}`);
        let head = 0;
        let tail = 0;
        let painted = 0;
        let roofs = 0;
        let volume = 0;
        for (let t = 0; t < n; t++) {
            const p = [0, 1, 2].map((k) => [pos.getX(t * 3 + k), pos.getY(t * 3 + k), pos.getZ(t * 3 + k)] as V);
            const normal = cross(sub(p[1], p[0]), sub(p[2], p[0]));
            volume += (p[0][0] * normal[0] + p[0][1] * normal[1] + p[0][2] * normal[2]) / 6;
            const kindOf = lamp.getX(t * 3);
            if (kindOf === 1) {
                head++;
                assert.ok(normal[2] > 0 && p[0][2] > 0, "a headlamp faces forward at the nose");
            }
            if (kindOf === 2) {
                tail++;
                assert.ok(normal[2] < 0 && p[0][2] < 0, "a tail lamp faces back at the tail");
            }
            if (paint.getX(t * 3) === 1) {
                painted++;
                if (normal[1] > 0 && p[0][1] > h * 0.8) roofs++;
            }
        }
        assert.equal(head, 4);
        assert.equal(tail, 4);
        assert.ok(painted > 60 && roofs >= 2, `${painted} painted, ${roofs} roof`);
        // (Wound outward overall: the open cabin floor and the wheels' insides are small against the body.)
        assert.ok(volume > 0.5 * w * h * l * 0.3, `signed volume ${volume.toFixed(2)}`);
    });
}
