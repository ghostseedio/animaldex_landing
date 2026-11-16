import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {LEAF_ATLAS_LEVELS, LEAF_ATLAS_SIZE, LEAF_CELLS, LEAF_CUT, buildLeafAtlas} from "@/ark-scene/leaf-atlas";

const atlas = buildLeafAtlas();
const alphaAt = (level: number, x: number, y: number) => {
    const s = LEAF_ATLAS_SIZE >> level;
    return atlas.levels[level][(y * s + x) * 4 + 3] / 255;
};
const share = (level: number, rect: readonly number[]) => {
    const k = 1 << level;
    let pass = 0;
    let all = 0;
    for (let y = rect[1] / k; y < (rect[1] + rect[3]) / k; y++) for (let x = rect[0] / k; x < (rect[0] + rect[2]) / k; x++, all++) if (alphaAt(level, x, y) >= LEAF_CUT) pass++;
    return pass / all;
};

test("leaf atlas: deterministic, 512² RGBA with its five levels, no drawing outside the cells' margins", () => {
    const again = buildLeafAtlas();
    assert.equal(atlas.levels.length, LEAF_ATLAS_LEVELS);
    atlas.levels.forEach((level, i) => {
        assert.equal(level.length, (LEAF_ATLAS_SIZE >> i) ** 2 * 4);
        assert.ok(Buffer.from(level).equals(Buffer.from(again.levels[i])), `level ${i} differs between two builds`);
    });
    for (const {rect} of LEAF_CELLS) {
        for (let k = 0; k < rect[2]; k++) {
            assert.equal(alphaAt(0, rect[0] + k, rect[1]), 0, "bottom margin");
            assert.equal(alphaAt(0, rect[0] + k, rect[1] + rect[3] - 1), 0, "top margin");
            assert.equal(alphaAt(0, rect[0], rect[1] + k), 0, "left margin");
            assert.equal(alphaAt(0, rect[0] + rect[2] - 1, rect[1] + k), 0, "right margin");
        }
    }
});

test("leaf atlas: where the attach points sit is leaf: a spray's middle, a single leaf's midrib at 0.45 of its length", () => {
    for (const {rect, spray, kind} of LEAF_CELLS) {
        // trees.py: a leaf mass's attach point is its card's middle; a single leaf's on its midrib at wpos (0.35 to 0.45).
        const points = spray ? [[0.5, 0.5]] : [[0.5, 0.35], [0.5, 0.45]];
        for (const [u, v] of points) assert.ok(alphaAt(0, Math.floor(rect[0] + u * rect[2]), Math.floor(rect[1] + v * rect[3])) >= LEAF_CUT, `${kind} ${spray ? "spray" : "leaf"} at ${u}, ${v}`);
    }
});

test("leaf atlas: each level keeps its cells' coverage (no crown thinning to sky far off), within 4 points", () => {
    for (const {rect, kind, spray} of LEAF_CELLS) {
        const full = share(0, rect);
        assert.ok(full > 0.18, `${kind} ${spray}: ${full}`);
        for (let level = 1; level < LEAF_ATLAS_LEVELS; level++) assert.ok(Math.abs(share(level, rect) - full) < 0.04, `${kind} level ${level}: ${share(level, rect).toFixed(3)} vs ${full.toFixed(3)}`);
    }
});

test("leaf atlas: trees.py's cell numbers are this atlas's cells", () => {
    const py = readFileSync(path.join(process.cwd(), "scripts/ark-assets/trees.py"), "utf8");
    const read = (name: string) => Object.fromEntries(Array.from(py.match(new RegExp(`${name} = dict\\(([^)]*)\\)`))![1].matchAll(/(\w+)=(\d+)/g)).map((m) => [m[1], Number(m[2])]));
    const sprays = read("LEAF_CELLS");
    const singles = read("LEAF_SINGLE");
    for (const [kind, cell] of Object.entries(sprays)) assert.deepEqual([LEAF_CELLS[cell].kind, LEAF_CELLS[cell].spray], [kind, true]);
    for (const [kind, cell] of Object.entries(singles)) assert.deepEqual([LEAF_CELLS[cell].kind, LEAF_CELLS[cell].spray], [kind, false]);
    assert.ok(LEAF_CELLS.length * 16 < 255, "a corner code never reaches 255 (no picture)");
});
