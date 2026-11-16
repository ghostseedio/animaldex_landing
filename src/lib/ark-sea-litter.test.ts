import assert from "node:assert/strict";
import {test} from "node:test";
import {seaBedAt} from "@/ark-scene/reef";
import {LITTER_CELL, LITTER_MIN_DEPTH, LITTER_PER_CELL, litterInCell} from "@/ark-scene/sea-litter";
import {ZONE_SITES} from "@/ark-scene/world";

test("sea-bed litter: only under 1.2 m of water or more, never on the reef's framework, inside its own cell, the same every time", () => {
    const reef = ZONE_SITES.coral_reef;
    let total = 0;
    const kinds = new Set<string>();
    for (let i = -40; i <= 40; i += 3) {
        for (let j = -40; j <= 40; j += 3) {
            const ci = Math.floor(reef.x / LITTER_CELL) + i;
            const cj = Math.floor(reef.z / LITTER_CELL) + j;
            const items = litterInCell(ci, cj);
            assert.equal(litterInCell(ci, cj), items);
            assert.ok(items.length <= LITTER_PER_CELL);
            for (const item of items) {
                total++;
                kinds.add(item.kind);
                assert.ok(item.x >= ci * LITTER_CELL && item.x < (ci + 1) * LITTER_CELL && item.z >= cj * LITTER_CELL && item.z < (cj + 1) * LITTER_CELL);
                const bed = seaBedAt(item.x, item.z);
                assert.ok(bed.depth >= LITTER_MIN_DEPTH && bed.substrate !== "reef" && bed.inland <= 0);
                assert.ok(Math.abs(item.y - bed.height) < 1e-9);
                assert.ok(Math.max(item.sx, item.sy, item.sz) < 0.4 && Math.min(item.sx, item.sy, item.sz) > 0.01);
                for (const c of [item.r, item.g, item.b]) assert.ok(c >= 0 && c <= 1);
            }
        }
    }
    assert.ok(total > 200, `${total} items`);
    assert.deepEqual(Array.from(kinds).sort(), ["coral", "pebble", "shell"]);
    // Dry land and the lake hold nothing.
    for (const site of [ZONE_SITES.mountains, ZONE_SITES.farm_garden, {x: -4, z: -4}]) assert.equal(litterInCell(Math.floor(site.x / LITTER_CELL), Math.floor(site.z / LITTER_CELL)).length, 0);
});
