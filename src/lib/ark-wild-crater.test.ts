/**
 * The old volcano behind the waterfall (p5 CRATER, `src/ark-scene/islands/wild/crater.ts`): its crater lake stands only
 * where the ground is under it, held by the rim all round but at the breach; the water is level or falling all the way
 * from the lake through the outlet to the falls' lip, the plunge pool and the river's spring; the caldera is warm ground
 * (its snow line higher, in the sampler as in the shader); and it is habitat by the map's own rules: a lake with reeds
 * and shallows, an alpine bench, cliffs, where the validator's water and mountain animals are placed with no failures.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {setArkWorld} from "@/ark-scene/world";

setArkWorld("v2");

const load = async () => {
    const crater = await import("@/ark-scene/islands/wild/crater");
    const ground = await import("@/ark-scene/islands/wild/ground");
    const falls = await import("@/ark-scene/islands/wild/falls");
    const {RIVER_UPPER} = await import("@/ark-scene/islands/wild/fields");
    return {...crater, ...ground, falls, RIVER_UPPER};
};

test("crater: the water is level or falling all the way: lake ≥ outlet ≥ lip > pool > spring", async () => {
    const C = await load();
    assert.equal(C.OUTLET[0].level, C.CRATER.level, "the outlet leaves the lake at the lake's level");
    for (let i = 1; i < C.OUTLET.length; i++) assert.ok(C.OUTLET[i].level < C.OUTLET[i - 1].level, `the outlet climbs at ${i}`);
    const end = C.OUTLET[C.OUTLET.length - 1];
    // The falls' sheet starts on the lip's curl (0.32 m over the lip), a metre and a half back from the lip's line.
    const lipTop = C.falls.curtainPoint(0.5, 0);
    assert.ok(end.level >= lipTop.y - 0.05 && end.level - lipTop.y < 0.3, `the outlet meets the sheet: ${end.level} m to ${lipTop.y.toFixed(2)} m`);
    assert.ok(Math.abs(end.z - lipTop.z) < 1.2 && Math.abs(end.x - lipTop.x) < 0.5, `the outlet ends where the sheet begins (${end.z} to ${lipTop.z.toFixed(1)})`);
    assert.ok(end.width * 2 >= C.falls.CURTAIN_TOP, "the sill is as wide as the sheet");
    assert.ok(C.falls.FALLS_LIP > C.falls.POOL.level + 26 && C.falls.POOL.level > C.RIVER_UPPER[0].level);
    // Along the stream (dense): real fresh water at its own level, never over the lake's, never climbing; banks hold it.
    let last = C.CRATER.level;
    for (let i = 1; i < C.OUTLET.length; i++) {
        const a = C.OUTLET[i - 1];
        const b = C.OUTLET[i];
        for (let t = 0.05; t <= 0.951; t += 0.05) {
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            const s = C.sampleWildGround(x, z);
            if (s.crater.shore < 0.6) continue;
            assert.equal(C.underWater(s), "fresh", `the outlet is dry at ${x.toFixed(1)}, ${z.toFixed(1)}`);
            assert.ok(s.freshLevel! <= last + 1e-9, `the outlet's water climbs at ${x.toFixed(1)}, ${z.toFixed(1)}`);
            last = s.freshLevel!;
            const hit = C.outletAt(x, z);
            for (const side of [-1, 1]) {
                const bx = x + side * -hit.dz * (hit.width + 3);
                const bz = z + side * hit.dx * (hit.width + 3);
                assert.ok(C.wildHeight(bx, bz) > s.freshLevel!, `the outlet's bank at ${bx.toFixed(1)}, ${bz.toFixed(1)} is under its water`);
            }
        }
    }
    assert.ok(last >= C.falls.FALLS_LIP);
});

test("crater: the lake stands only where the ground is under it, held by the rim but at the breach; its shelves, its deep middle, its island", async () => {
    const C = await load();
    let wet = 0;
    let deepest = 0;
    let shelf = 0;
    for (let x = C.CRATER.x - 60; x <= C.CRATER.x + 60; x += 1.5) {
        for (let z = C.CRATER.z - 60; z <= C.CRATER.z + 60; z += 1.5) {
            const s = C.sampleWildGround(x, z);
            if (s.freshLevel === C.CRATER.level && s.fresh >= 0.5) {
                assert.ok(s.crater.shore < 0.7, `lake water outside its shore at ${x}, ${z}`);
                if (s.height < s.freshLevel) {
                    wet++;
                    deepest = Math.max(deepest, s.freshLevel - s.height);
                    if (s.freshLevel - s.height < 1.6) shelf++;
                }
            } else if (s.crater.shore < -1.5) assert.fail(`no water inside the lake's shore at ${x}, ${z}`);
            // Dry ground inside the rim stands over the lake (but the outlet's bed).
            if (s.crater.rim < -1 && s.crater.shore > 1.5 && !(s.outlet && s.outlet.d < s.outlet.width + 2)) assert.ok(s.height > C.CRATER.level, `the caldera's floor at ${x}, ${z} is under the lake (${s.height.toFixed(2)} m)`);
        }
    }
    const across = 2 * Math.sqrt((wet * 2.25) / Math.PI);
    assert.ok(across > 55 && across < 100, `the lake is ${across.toFixed(0)} m across`);
    assert.ok(deepest > 7 && deepest < 12, `its middle is ${deepest.toFixed(1)} m deep`);
    assert.ok(shelf / wet > 0.25, `${((100 * shelf) / wet).toFixed(0)}% of it is shelf`);
    for (const isle of C.CRATER_ISLANDS) assert.ok(C.wildHeight(isle.x, isle.z) > C.CRATER.level + 0.5, "an island stands out of the lake");
    // Round the rim: its crest stands well over the lake everywhere but at the breach, the outlet's.
    let breach = 0;
    for (let k = 0; k < 180; k++) {
        const a = (k / 180) * Math.PI * 2;
        let crest = -Infinity;
        let cx = 0;
        let cz = 0;
        for (let d = C.CRATER.shore - 6; d < C.CRATER.rim + 8; d += 0.75) {
            const x = C.CRATER.x + Math.cos(a) * d;
            const z = C.CRATER.z + Math.sin(a) * d;
            const h = C.wildHeight(x, z);
            if (h > crest) {
                crest = h;
                cx = x;
                cz = z;
            }
        }
        if (crest < C.CRATER.level + 4) {
            breach++;
            assert.ok(C.outletAt(cx, cz).d < 26, `the rim is down to ${crest.toFixed(1)} m at ${cx.toFixed(0)}, ${cz.toFixed(0)}, away from the outlet`);
        }
    }
    assert.ok(breach >= 1 && breach < 30, `${breach} of 180 bearings are the breach`);
});

test("crater: the caldera is warm ground: no snow on its bench in the sampler (as the shader draws), snow on the rim and outside", async () => {
    const C = await load();
    const {snowCover} = await import("@/ark-scene/snow");
    assert.equal(C.craterWarmth(C.CRATER.x, C.CRATER.z), 1);
    assert.equal(C.craterWarmth(C.CRATER.x + C.CRATER.rim + 2, C.CRATER.z), 0);
    const bench = C.sampleWildGround(C.CRATER.x + 33.5, C.CRATER.z - 8);
    assert.ok(bench.crater.shore > 0.5 && bench.warm > 0.9 && bench.height > 52, JSON.stringify({shore: bench.crater.shore, warm: bench.warm, height: bench.height}));
    assert.ok(snowCover(bench.height - C.CRATER_SNOW_LIFT * bench.warm, 0.05, 0, 0).mean < 0.05, "the bench is snow-free");
    assert.ok(snowCover(bench.height, 0.05, 0, 0).mean > 0.5, "the same height outside the caldera is snow");
});

test("crater: habitat by the map's own rules: a lake with reeds and shallows, an alpine bench, cliffs, a mountain stream", async () => {
    const C = await load();
    const {mapPoints} = await import("@/ark-scene/map/place");
    const sampler = mapPoints().sampler;
    const middle = sampler.ground(C.CRATER.x - 6, C.CRATER.z + 4);
    assert.equal(middle.water, "fresh");
    assert.equal(middle.zone, "river_lake");
    assert.ok(middle.tags.includes("lake") && middle.depth > 5);
    const seen = new Set<string>();
    let shallows = 0;
    for (let x = C.CRATER.x - 50; x <= C.CRATER.x + 50; x += 2) {
        for (let z = C.CRATER.z - 50; z <= C.CRATER.z + 50; z += 2) {
            const s = C.sampleWildGround(x, z);
            if (s.crater.rim > 0) continue;
            const g = sampler.ground(x, z);
            for (const tag of g.tags) seen.add(`${g.water ? "water" : "land"}:${tag}`);
            if (g.water && g.tags.includes("pond") && g.tags.includes("marsh_reeds")) shallows++;
        }
    }
    for (const tag of ["water:lake", "water:pond", "water:marsh_reeds", "land:lake", "land:marsh_reeds", "land:mountain_alpine", "land:flower_meadow", "land:cliffs", "land:open_sky"]) assert.ok(seen.has(tag), `no ${tag} in the caldera (${Array.from(seen).join(" ")})`);
    assert.ok(shallows > 20, `${shallows} cells of reedy shallows`);
    const stream = sampler.ground(C.OUTLET[2].x, C.OUTLET[2].z);
    assert.ok(stream.water === "fresh" && stream.tags.includes("stream_river") && stream.tags.includes("waterfall_rapids"), JSON.stringify(stream.tags));
    // The falls' plunge pool is real water too (the first pass drew it over dry ground, a home under it).
    const pool = sampler.ground(C.falls.POOL.x, C.falls.POOL.z);
    assert.ok(pool.water === "fresh" && pool.depth > 1.5, JSON.stringify(pool));
});

test("crater: the validator's animals live up there with no failures: water kinds on the lake, mountain kinds on the bench and the rim", async () => {
    const C = await load();
    const {validateMap, validatorAnimals} = await import("@/ark-scene/map/validate");
    const {failures, placed} = validateMap();
    assert.deepEqual(failures.slice(0, 5), []);
    const lake: string[] = [];
    const inside: string[] = [];
    const cone: string[] = [];
    for (const a of validatorAnimals()) {
        const p = placed.get(a.id);
        if (!p || p.host) continue;
        const s = C.sampleWildGround(p.x, p.z);
        if (s.crater.shore < 3 && s.crater.d < 60) lake.push(`${a.model_slug} (${a.zone})`);
        else if (s.crater.rim < 0) inside.push(`${a.model_slug} (${a.zone})`);
        else if (s.crater.volcanic > 0.5) cone.push(`${a.model_slug} (${a.zone})`);
    }
    assert.ok(lake.length >= 5, `on and by the lake: ${lake.join(", ")}`);
    assert.ok(lake.every((name) => /river_lake|wetland|mountains|polar/.test(name)), lake.join(", "));
    assert.ok(inside.length + cone.length >= 5, `on the bench, the walls and the cone: ${[...inside, ...cone].join(", ")}`);
});
