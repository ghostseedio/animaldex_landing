import assert from "node:assert/strict";
import {test} from "node:test";
import {worldDecor} from "@/ark-scene/decor";
import {reefGrowth, seaBedAt} from "@/ark-scene/reef";
import {ROCK_VARIANTS} from "@/ark-scene/rock-shapes";
import {seaVents} from "@/ark-scene/sea-bubbles";
import {CAVE_LIMIT, CAVE_MAX_DEPTH, CAVE_MIN_DEPTH, CAVE_ROOF_CLEAR, CAVE_SPACING, caveMiddle, caveVents, seaCaves} from "@/ark-scene/sea-caves";
import {heightAt} from "@/ark-scene/world";

const caves = seaCaves();

test("caves: some, on the sea bed in 3.5–9 m of water, spaced, the same every time", () => {
    assert.ok(caves.length >= 4 && caves.length <= CAVE_LIMIT, `${caves.length} caves`);
    assert.equal(seaCaves(), caves);
    for (let i = 0; i < caves.length; i++) {
        const cave = caves[i];
        assert.ok(cave.depth >= CAVE_MIN_DEPTH && cave.depth <= CAVE_MAX_DEPTH, `cave ${i} in ${cave.depth} m`);
        assert.ok(Math.abs(cave.y - heightAt(cave.x, cave.z)) < 1e-6);
        assert.notEqual(seaBedAt(cave.x, cave.z).substrate, "reef");
        assert.ok(cave.height >= 1.5 && cave.width >= 2.4 && cave.length >= 3);
        for (const other of caves.slice(0, i)) assert.ok(Math.hypot(cave.x - other.x, cave.z - other.z) >= CAVE_SPACING);
    }
});

test("caves: nothing of the reef, no drawn rock and no vent stands in a cave's footprint", () => {
    const growth = reefGrowth().filter((item) => item.kind !== "seagrass" && item.kind !== "encrusting");
    const rocks = worldDecor().filter((item) => item.kind === "rock");
    for (const cave of caves) {
        const middle = caveMiddle(cave);
        // Every rock of the cave is within its reach, so "outside the reach" is "outside the cave".
        for (const rock of cave.rocks) assert.ok(Math.hypot(rock.x - middle.x, rock.z - middle.z) + Math.max(rock.sx, rock.sz) / 2 <= cave.reach + 0.3, `${rock.part} within its cave's reach`);
        for (const item of growth) assert.ok(Math.hypot(item.x - middle.x, item.z - middle.z) >= cave.reach, `${item.kind} in a cave`);
        for (const item of rocks) assert.ok(Math.hypot(item.x - middle.x, item.z - middle.z) >= cave.reach, "a drawn rock in a cave");
        for (const vent of seaVents()) assert.ok(Math.hypot(vent.x - middle.x, vent.z - middle.z) >= cave.reach, "a vent in a cave");
    }
});

test("caves: built of the island's own rock shapes, walls and back reaching the roof, the roof under the surface", () => {
    for (const cave of caves) {
        const parts = new Map<string, number>();
        let roofUnder = Infinity;
        let top = -Infinity;
        for (const rock of cave.rocks) {
            parts.set(rock.part, (parts.get(rock.part) ?? 0) + 1);
            assert.ok(rock.variant >= 0 && rock.variant < ROCK_VARIANTS[rock.style], `${rock.style} ${rock.variant}`);
            assert.ok(rock.sx > 0.2 && rock.sy > 0.2 && rock.sz > 0.2);
            if (rock.part === "roof" || rock.part === "lintel") roofUnder = Math.min(roofUnder, rock.y);
            top = Math.max(top, rock.y + rock.sy);
        }
        assert.deepEqual([parts.get("wall"), parts.get("back"), parts.get("roof"), parts.get("lintel"), parts.get("cap"), parts.get("spill")], [6, 2, 2, 1, 1, 6]);
        // Head room: the roof's underside is about the cave's height over its floor at the mouth, or more.
        assert.ok(roofUnder - cave.y >= cave.height * 0.95, `head room ${roofUnder - cave.y}`);
        assert.ok(cave.floor >= cave.y && cave.floor - cave.y < 2.3 && roofUnder - cave.floor >= cave.height * 0.95);
        for (const rock of cave.rocks) if (rock.part === "wall" || rock.part === "back") assert.ok(rock.y + rock.sy >= roofUnder, `${rock.part} reaches the roof`);
        assert.ok(top <= -0.3, `the cave's top at ${top} m is under the surface at the lowest tide`);
        assert.ok(cave.depth - cave.height >= CAVE_ROOF_CLEAR);
    }
});

test("caves: each lets go a thin stream of bubbles from over its roof, under the surface", () => {
    const vents = caveVents();
    assert.equal(vents.length, caves.length);
    for (let i = 0; i < vents.length; i++) {
        assert.ok(vents[i].y < -0.3 && vents[i].y > caves[i].y + caves[i].height, "from over the roof");
        assert.ok(Math.abs(vents[i].depth + vents[i].y) < 1e-9);
        assert.ok(Math.hypot(vents[i].x - caves[i].x, vents[i].z - caves[i].z) < caves[i].length);
    }
});
