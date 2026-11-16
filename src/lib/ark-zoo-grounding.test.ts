/**
 * The zoo's residents on the ground their enclosure draws (p3, lane ZOOFIX; the owner, 2026-11-17: "still seeing camel
 * and ostrich sunk into the ground in the zoo").
 *
 * Pass 2's habitats (`render/zoo-habitat.ts`) lay patches of ground cover (grass, sand, leaf litter, mud round the
 * waterholes) 12 cm over the floor, 6 cm over the enclosure's paving, in the solid mesh; the residents stood on the paving
 * (the walk surfaces knew nothing of the patches), so a hoof or a toe on a patch was 6 cm under what is drawn. And they
 * wandered through the termite mounds, rockwork and logs, which only kept clear of their resting spots.
 *
 * - Every point of every outdoor enclosure's floor: the ground a resident is stood on (`townDrawnHeight`, the walk
 *   surfaces as the scene builds them) is never under the flat cover the zoo draws there (read from the drawn solids'
 *   own triangles, independently of the walk surfaces).
 * - The real species of the paddocks and aviaries (camel, ostrich, emu, rhea, giraffe, elephant, rhinos, zebra, flamingo,
 *   kangaroo, the big cats, the bears), placed and scheduled through an Ark day as the scene does: none sinks or floats.
 * - The habitats' items are colliders where they are drawn, and a body put in one is pushed out of it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {launchEnclosures, zooLayout, zooSpotsOf} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {buildZooScenery} from "@/ark-scene/islands/town/render/scenery";
import {paddockItems, HABITAT_ITEMS} from "@/ark-scene/islands/town/render/zoo-habitat";
import {setTownWalkSurfaces, townDrawnHeight, townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {townSurfacesFor, townDayEpochs, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {townColliderList, townColliderSet} from "@/ark-scene/islands/town/colliders";
import {pushOut} from "@/ark-scene/collide/resolve";
import {inPoly, local, toLocal} from "@/ark-scene/islands/town/geom";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";

const open = launchEnclosures();
const layout = zooLayout(open);
const outdoor = layout.enclosures.filter((e) => !e.shared && (ZOO_TYPES[e.type].form === "paddock" || ZOO_TYPES[e.type].form === "aviary"));

/** The flat, upward cover the zoo's solids draw low over its floors (patches, mud, a waterhole's bed): x0 z0 x1 z1 x2 z2 y. */
function drawnCover(): Float32Array[] {
    const zoo = buildZooScenery(layout);
    const out: Float32Array[] = [];
    zoo.chunks.forEach((c) => {
        const p = c.solid.pos;
        for (let i = 0; i < p.length; i += 9) {
            const ux = p[i + 3] - p[i];
            const uy = p[i + 4] - p[i + 1];
            const uz = p[i + 5] - p[i + 2];
            const vx = p[i + 6] - p[i];
            const vy = p[i + 7] - p[i + 1];
            const vz = p[i + 8] - p[i + 2];
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const l = Math.hypot(nx, ny, nz);
            if (!l || ny / l < 0.97) continue;
            const y = (p[i + 1] + p[i + 4] + p[i + 7]) / 3;
            const cx = (p[i] + p[i + 3] + p[i + 6]) / 3;
            const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
            // (Low over the floor: what a hoof stands on, not a log's or a deck's top.)
            if (y - townTileHeight(cx, cz) > 0.3) continue;
            out.push(Float32Array.of(p[i], p[i + 2], p[i + 3], p[i + 5], p[i + 6], p[i + 8], p[i + 1], p[i + 4], p[i + 7]));
        }
    });
    return out;
}

/** The cover's height at a point (−Infinity: none there). */
function coverAt(tris: readonly Float32Array[], x: number, z: number): number {
    let best = -Infinity;
    for (const t of tris) {
        const ax = t[0], az = t[1], bx = t[2], bz = t[3], cx = t[4], cz = t[5], ay = t[6], by = t[7], cy = t[8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const c = 1 - a - b;
        if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
        best = Math.max(best, a * ay + b * by + c * cy);
    }
    return best;
}

test("every outdoor enclosure's floor: the ground a resident stands on is never under the cover drawn there", () => {
    const tris = drawnCover();
    assert.ok(tris.length > 500, `the habitats' cover is drawn (${tris.length} flat triangles)`);
    const surfaces = townSurfacesFor(open, []);
    let worst = 0;
    let where = "";
    let points = 0;
    let onCover = 0;
    for (const e of outdoor) {
        const s = e.slot.at;
        const items = paddockItems(e, zooSpotsOf(e));
        for (let lx = -s.w / 2 + 1.2; lx <= s.w / 2 - 1.2; lx += 0.5) {
            for (let lz = -s.d / 2 + 1.2; lz <= s.d / 2 - 1.2; lz += 0.5) {
                const p = local(s, lx, lz);
                // (Inside an item's footprint a resident does not stand: they are colliders, below.)
                if (items.some((it) => Math.hypot(it.x - p.x, it.z - p.z) < it.r)) continue;
        if (e.pool && inPoly(e.pool, p.x, p.z)) continue;
                // (Nor in its own pool: a raised one, swum in.)
                if (e.pool && inPoly(e.pool, p.x, p.z)) continue;
                const cover = coverAt(tris, p.x, p.z);
                points++;
                if (cover === -Infinity) continue;
                onCover++;
                const gap = townDrawnHeight(p.x, p.z, surfaces) - cover;
                if (gap < worst) {
                    worst = gap;
                    where = `${e.id} (${lx.toFixed(1)}, ${lz.toFixed(1)})`;
                }
            }
        }
    }
    setTownWalkSurfaces(null);
    console.log(`zoo floors: ${points} points, ${onCover} on cover; worst ${(worst * 100).toFixed(1)} cm under it ${where}`);
    assert.ok(onCover > points * 0.15, "a good share of the floors is cover");
    assert.ok(worst > -0.01, `a resident stood ${(-worst * 100).toFixed(1)} cm under the cover at ${where}`);
});

/** A zoo resident (deterministic ids; the fields placement and the scene read), in its kind's enclosure. */
function resident(i: number, slug: string, zone: string): ArkAnimal {
    const enclosure = `${zooTypeOfSlug(slug)}-1`;
    return {id: `zf-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

test("the paddocks' and aviaries' residents through an Ark day: none sinks into its enclosure's ground or floats over it", () => {
    const kinds: Array<[string, string]> = [
        ["dromedary-camel", "desert"], ["ostrich", "grassland"], ["emu", "grassland"], ["greater-rhea", "grassland"], ["giraffe", "grassland"], ["asian-elephant", "grassland"],
        ["rhinoceros", "grassland"], ["black-rhinoceros", "grassland"], ["indian-rhinoceros", "grassland"], ["plains-zebra", "grassland"], ["greater-flamingo", "wetland"],
        ["red-kangaroo", "grassland"], ["african-lion", "grassland"], ["tiger", "rainforest"], ["brown-bear", "woodland"]
    ];
    const animals: ArkAnimal[] = [];
    let i = 0;
    for (const [slug, zone] of kinds) for (let k = 0; k < 2; k++) animals.push(resident(i++, slug, zone));
    const types = new Set(animals.map((a) => a.enclosure!.replace(/-\d+$/, "")));
    assert.ok(types.has("savanna_paddocks") && types.has("aviaries"), `the paddocks and the aviaries: ${Array.from(types).join(", ")}`);
    const check = validateTownAnimals(animals, {epochs: townDayEpochs(16)});
    setTownWalkSurfaces(null);
    const zooSamples = check.samples;
    console.log(`zoo residents: ${animals.length} animals, ${zooSamples} samples ${JSON.stringify(check.kinds)}; sinks ${check.counts.sinks}, floats ${check.counts.floats}`);
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
});

test("the habitats' rocks, mounds, logs, hay racks and shelters are colliders where they are drawn; a body in one is pushed out", () => {
    const list = townColliderList(open, {x: 0, z: 0});
    const set = townColliderSet(open, {x: 0, z: 0}, list);
    let items = 0;
    for (const e of outdoor) {
        for (const it of paddockItems(e, zooSpotsOf(e))) {
            const c = list.find((x) => x.id === `town:zoo:${it.id}`);
            assert.ok(c && c.shape === "circle", `${it.id} is a collider`);
            assert.equal(c.kind, HABITAT_ITEMS[it.what].kind);
            // (Inside its enclosure, drawn where the dressing put it.)
            const l = toLocal(e.slot.at, it.x, it.z);
            assert.ok(Math.abs(l.x) < e.slot.at.w / 2 && Math.abs(l.z) < e.slot.at.d / 2, `${it.id} in its enclosure`);
            items++;
            if (c.soft) continue;
            // A two-metre body standing on the item's middle (slightly off it, to give the push a way).
            const out = pushOut(set, {id: "probe", radius: 0.5, half: 1.0, height: 1.6}, {x: it.x + 0.05, y: townTileHeight(it.x, it.z), z: it.z + 0.03, yaw: 0.4, aloft: false, still: false, attached: null, fixed: false});
            assert.ok(Math.hypot(out.x - it.x, out.z - it.z) > it.r * 0.9, `${it.id} (${it.what}, r ${it.r.toFixed(2)}): pushed only ${Math.hypot(out.x - it.x, out.z - it.z).toFixed(2)} m`);
        }
    }
    console.log(`zoo habitat colliders: ${items}`);
    assert.ok(items > 60, `${items} items`);
});
