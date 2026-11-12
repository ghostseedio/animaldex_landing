import assert from "node:assert/strict";
import {existsSync, statSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {TOWN_HALF, townPlan} from "@/ark-scene/islands/town/plan";
import {corners} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, surfaceWeights, TOWN_SURFACES, townSurfaceWeights} from "@/ark-scene/islands/town/ground";
import {buildScenery} from "@/ark-scene/islands/town/render/scenery";
import {groundGrid} from "@/ark-scene/islands/town/render/index";
import {readTag, SURF, surfaceTag} from "@/ark-scene/islands/town/render/surface-tags";
import {lampMapData} from "@/ark-scene/islands/town/render/furniture";
import {TOWN_LAMP_REACH, TOWN_LAMP_TEXELS} from "@/ark-scene/islands/town/render/materials";
import {TOWN_LAYER_MEANS, TOWN_LAYER_METRES} from "@/ark-scene/islands/town/render/textures";

/**
 * The town's ground, streets, lamps and furniture (lane GA, docs/ark/town-island.md §11): the owner's bug 4 ("the
 * ground looks like giant pixels") stays fixed, every street surface is tagged for its material, the furniture is
 * placed the same every time, and the lamp map lights the street but not the garden behind a house.
 */

test("tags: a decal's surface, rows and across read back as the shader reads them", () => {
    for (const surface of Object.values(SURF)) {
        for (const rows of [false, true]) {
            for (const across of [-1, -0.5, 0, 0.73, 1]) {
                const read = readTag(surfaceTag(surface, rows, across));
                assert.equal(read.surface, surface);
                assert.equal(read.alongZ, rows);
                assert.ok(Math.abs(read.across - across) < 1e-6, `${surface} ${rows} ${across}`);
            }
        }
    }
});

test("bug 4: no decal draws a pattern in flat-coloured cells, and the ground has no per-vertex speckle", () => {
    const scenery = buildScenery(townPlan());
    // Every drape and street piece is tagged with a textured surface; a tagged triangle's three vertices share their
    // colour (the texture carries the variety, not a colour per cell).
    let tagged = 0;
    let untagged = 0;
    scenery.chunks.forEach((c) => {
        const extra = c.decal.extra;
        for (let t = 0; t < extra.length / 3; t++) {
            const surface = readTag(extra[t * 3]).surface;
            if (surface === SURF.plain) untagged++;
            else tagged++;
        }
    });
    assert.equal(untagged, 0, "every town decal is tagged");
    assert.ok(tagged > 20000, `decal triangles (${tagged})`);
    // The square's setts: one colour over the whole drape (before: two greys in 1.6 m bands, the giant pixels).
    const sq = townPlan().square;
    const colours = new Set<string>();
    scenery.chunks.forEach((c) => {
        for (let t = 0; t < c.decal.extra.length / 3; t++) {
            if (readTag(c.decal.extra[t * 3]).surface !== SURF.setts) continue;
            const x = c.decal.pos[t * 9];
            const z = c.decal.pos[t * 9 + 2];
            if (Math.abs(x - sq.x) < sq.w / 2 - 1 && Math.abs(z - sq.z) < sq.d / 2 - 1) colours.add(c.decal.col.slice(t * 9, t * 9 + 3).map((v) => v.toFixed(4)).join());
        }
    });
    assert.equal(colours.size, 1, "the square's setts are one tint");
    // The ground grid: along a row of lawn the colour only drifts with the smooth mottle (no random shade per vertex,
    // which made a 1.1 m speckle): its second difference stays tiny.
    const grid = groundGrid();
    const step = (TOWN_HALF * 2) / (grid.size - 1);
    let worst = 0;
    let checked = 0;
    for (let row = 7; row < grid.size; row += 13) {
        for (let column = 1; column < grid.size - 2; column += 7) {
            const kinds = [0, 1, 2].map((k) => sampleTownGround(-TOWN_HALF + (column + k) * step, -TOWN_HALF + row * step).surface);
            if (kinds[0] !== "lawn" || kinds[1] !== "lawn" || kinds[2] !== "lawn") continue;
            const g = (k: number) => grid.colours[(row * grid.size + column + k) * 3 + 1];
            worst = Math.max(worst, Math.abs(g(0) - 2 * g(1) + g(2)) / g(1));
            checked++;
        }
    }
    assert.ok(checked > 50, `lawn samples (${checked})`);
    assert.ok(worst < 0.02, `lawn colour's second difference (the old random shade reached ~0.1) ${worst}`);
});

test("the ground's texture weights: every surface known, softened over the grid, the same every time", () => {
    for (const s of TOWN_SURFACES) assert.equal(surfaceWeights(s).length, 8);
    // A lone farmyard vertex in a lawn: softened to a ninth of its soil, its neighbours too.
    const size = 5;
    const index = new Uint8Array(size * size).fill(TOWN_SURFACES.indexOf("lawn"));
    index[12] = TOWN_SURFACES.indexOf("farmyard");
    const w = townSurfaceWeights(size, index);
    assert.equal(w[12 * 8], Math.round(255 / 9));
    assert.equal(w[11 * 8], Math.round(255 / 9));
    assert.equal(w[0 * 8], 0);
    assert.equal(w[0 * 8 + 4], 255, "lawn stays lawn away from it");
    assert.deepEqual(Array.from(townSurfaceWeights(size, index)), Array.from(w));
});

test("streets: asphalt kerb to kerb, slab pavements, granite kerbs with a face, paint, crossings, covers and gratings", () => {
    const scenery = buildScenery(townPlan());
    const count: Record<number, number> = {};
    let faces = 0;
    scenery.chunks.forEach((c) => {
        for (let t = 0; t < c.decal.extra.length / 3; t++) {
            const read = readTag(c.decal.extra[t * 3]);
            count[read.surface] = (count[read.surface] ?? 0) + 1;
            if (read.surface === SURF.kerb && Math.abs(c.decal.nor[t * 9 + 1]) < 0.5) faces++;
        }
    });
    for (const s of [SURF.asphalt, SURF.paint, SURF.slabs, SURF.kerb, SURF.setts, SURF.gravel, SURF.blocks, SURF.earth, SURF.crop, SURF.manhole, SURF.grate, SURF.flags]) assert.ok((count[s] ?? 0) > 0, `surface ${s}`);
    assert.ok(faces > 1000, `kerb faces (${faces})`);
    // The carriageway's across runs edge to edge: both kerbs' sides are there.
    let lo = 0;
    let hi = 0;
    scenery.chunks.forEach((c) => {
        for (let v = 0; v < c.decal.extra.length; v++) {
            const read = readTag(c.decal.extra[v]);
            if (read.surface !== SURF.asphalt) continue;
            if (read.across < -0.99) lo++;
            if (read.across > 0.99) hi++;
        }
    });
    assert.ok(lo > 100 && hi > 100);
});

test("furniture: the lamps, signals, beacons, shelters, bins, benches, planters and bikes, the same every time", () => {
    const a = buildScenery(townPlan());
    const b = buildScenery(townPlan());
    const f = a.furniture!;
    assert.ok(f, "furniture built");
    assert.deepEqual(f.counts, b.furniture!.counts);
    assert.deepEqual(Array.from(f.heads), Array.from(b.furniture!.heads));
    const lamps = (f.counts.lamp_heritage ?? 0) + (f.counts.lamp_column ?? 0);
    assert.equal(lamps, a.lamps.length, "every lamp spot has its lamp");
    assert.ok((f.counts.lamp_heritage ?? 0) > 20 && (f.counts.lamp_column ?? 0) > 10, JSON.stringify(f.counts));
    for (const kind of ["bus_stop", "signal", "beacon", "bin", "bench", "planter", "bollard", "bike_stand", "bike", "give_way", "name_plate", "no_vehicles"]) assert.ok((f.counts[kind] ?? 0) > 0, kind);
    assert.equal(f.counts.signal, 4);
    // Lamp heads at a lamp's height (true scale: 4.2 m lanterns, 5.8 m columns) over the town.
    for (let h = 0; h < f.heads.length; h += 4) {
        const up = f.heads[h + 1];
        assert.ok(up > 2 && up < 14, `head ${up}`);
        assert.ok(Math.abs(f.heads[h]) < TOWN_HALF && Math.abs(f.heads[h + 2]) < TOWN_HALF);
    }
    assert.ok(f.lights.triangles > 0);
});

test("the lamp map: lit under each lamp, dark past its reach and behind a building", () => {
    const plan = townPlan();
    const n = TOWN_LAMP_TEXELS;
    const cell = (TOWN_HALF * 2) / n;
    // One lamp on the high street's pavement; the house behind it on the north side blocks its light.
    const house = plan.buildings.find((b) => b.kind === "terrace" && Math.abs(b.at.z - 20) < 8 && b.at.x > -120 && b.at.x < -60)!;
    assert.ok(house, "a terrace on the high street's north side");
    const zs = corners(house.at).map((p) => p.z);
    const lampX = house.at.x;
    const lampZ = Math.max(...zs) + 4;
    const map = lampMapData(plan, Float32Array.from([lampX, 6.8, lampZ, 0]));
    const at = (x: number, z: number) => {
        const column = Math.floor((x + TOWN_HALF) / cell);
        const row = Math.floor((z + TOWN_HALF) / cell);
        const i = (row * n + column) * 4;
        return {dx: ((map[i] - 127.5) / 127.5) * TOWN_LAMP_REACH, dz: ((map[i + 1] - 127.5) / 127.5) * TOWN_LAMP_REACH, seen: map[i + 3] / 255};
    };
    const under = at(lampX + 1, lampZ + 1);
    assert.equal(under.seen, 1, "the pavement under it sees it");
    assert.ok(Math.abs(under.dx - (lampX - (-TOWN_HALF + (Math.floor((lampX + 1 + TOWN_HALF) / cell) + 0.5) * cell))) < 0.15);
    assert.equal(at(lampX, Math.min(...zs) - 3).seen, 0, "the back garden behind the house does not");
    assert.equal(at(lampX + 20, lampZ).seen, 0, "nothing past its reach");
});

test("the paving textures: committed, compressed, sized, and the layers' means and true sizes known", () => {
    const root = path.resolve(__dirname, "..", "..");
    for (const [file, most] of [["town-albedo.ktx2", 800], ["town-normal.ktx2", 1800]] as const) {
        const p = path.join(root, "public/ark/graphics", file);
        assert.ok(existsSync(p), file);
        assert.ok(statSync(p).size / 1024 < most, `${file} under ${most} KB`);
    }
    assert.equal(TOWN_LAYER_MEANS.length, 6);
    assert.equal(TOWN_LAYER_METRES.length, 6);
    for (const m of TOWN_LAYER_METRES) assert.ok(m > 1 && m < 4);
});
