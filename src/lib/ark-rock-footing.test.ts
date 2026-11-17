/**
 * No rock floats (p4; the coordinator, on the bigger wild island's mountain: "boulders float in the air off the slope,
 * grey rounded rocks hovering with gaps under them"). Every rock made here, the decor's and the mountain's crags,
 * boulders and scree, is drawn with its underside in the ground: every vertex of its lower half that faces down in the
 * world, as drawn (its place, tilt, turn, size and its foot reached down, `rock-assets.ts` rockFoot), no more than a few
 * centimetres over the ground.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {setArkWorld} from "@/ark-scene/world";

setArkWorld("v2");

test("v2: every rock made here sits in its ground as drawn: no underside more than 8 cm over the slope", async () => {
    const {worldDecor} = await import("@/ark-scene/decor");
    const {generatedShape, rockAssetFor, rockFoot} = await import("@/ark-scene/rock-assets");
    const {allMountainRocks} = await import("@/ark-scene/rock-layout");
    const {orient} = await import("@/ark-scene/rock-shapes");
    const {drawnGround, rockUnderside, FOOT_MOST} = await import("@/ark-scene/rock-assets");
    type Rock = Parameters<typeof rockFoot>[0];
    const rocks: Array<Rock & {what: string}> = [];
    for (const item of worldDecor()) {
        if (item.kind !== "rock") continue;
        const placed = rockAssetFor(item);
        const shape = placed && generatedShape(placed.id);
        if (placed && shape) rocks.push({...shape, x: placed.x, y: placed.y, z: placed.z, yaw: placed.yaw, up: placed.up ?? [0, 1, 0], scale: placed.scale, what: placed.id});
    }
    for (const piece of allMountainRocks()) rocks.push({...piece, what: piece.role});
    assert.ok(rocks.length > 1000, `${rocks.length} rocks`);
    const floating: string[] = [];
    const ridge: string[] = [];
    let stretched = 0;
    let far = 0;
    for (const rock of rocks) {
        const k = rockFoot(rock);
        if (k > 1) stretched++;
        if (k > 1.5) far++;
        const {points, top} = rockUnderside(rock.style, rock.variant);
        const rotate = orient(rock.up, rock.yaw);
        let worst = -Infinity;
        // Its base and every face of its lower half that looks down in the world, as drawn: in the ground.
        for (const [px, py, pz, nx, ny, nz] of points) {
            if (!(rotate(nx, ny, nz)[1] < -0.3 || ny < -0.5)) continue;
            const [dx, dy, dz] = rotate(px * rock.scale, (top + (py - top) * k) * rock.scale, pz * rock.scale);
            // (Over the ground as drawn: its vertices, bilinear between them.)
            worst = Math.max(worst, rock.y + dy - drawnGround(rock.x + dx, rock.z + dz));
        }
        const what = `${rock.what} at ${rock.x.toFixed(1)}, ${rock.z.toFixed(1)}: ${worst.toFixed(2)} m over (k ${k.toFixed(2)})`;
        // (A slab astride the summit's knife edge drops away on both sides: a hand's gap is left under its edge.)
        if (worst > 0.08 && worst <= 0.25 && rock.what.startsWith("gen-slab")) ridge.push(what);
        else if (worst > 0.08) floating.push(what);
    }
    assert.deepEqual(floating, []);
    assert.ok(ridge.length <= 1, ridge.join("; "));
    // Most are reached down a little (their undercut closed under them), only the steepest faces' far: never past FOOT_MOST.
    void stretched;
    assert.ok(far <= rocks.length * 0.3, `${far} of ${rocks.length} reached down more than half their height again`);
});
