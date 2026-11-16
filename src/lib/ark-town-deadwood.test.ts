/**
 * Graphics pass 2 (lane town2): the town's dead wood and the species that live at it (the owner: "often you find
 * caterpillars and rotting wood feeders on here too in real life which we should do on the ark too").
 */
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {deadwoodPlaces, leafPatchPlaces, townDeadwood} from "@/ark-scene/islands/town/deadwood";
import {DEADWOOD_SLUGS, LEAF_SLUGS, urbanNiche} from "@/ark-scene/islands/town/niche";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townTrees} from "@/ark-scene/islands/town/trees";
import {inTownSolid} from "@/ark-scene/islands/town/tanks";
import {polylineDistance} from "@/ark-scene/islands/town/geom";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {drawDeadwood, drawLeafPatch} from "@/ark-scene/islands/town/render/deadwood";

type Row = {slug: string};
const list = JSON.parse(readFileSync("data/ark/town-deadwood-species.json", "utf8")) as {deadwood: Row[]; leaves: Row[]; left_out: Row[]};
const profiles = (JSON.parse(readFileSync("data/ark/behaviour-profiles.json", "utf8")) as {profiles: Array<{slug: string; excluded: string | null; plan: string}>}).profiles;

test("the deadwood and leaf species are the committed list's, all in the catalogue and none invented", () => {
    assert.deepEqual(Array.from(DEADWOOD_SLUGS).sort(), list.deadwood.map((r) => r.slug).sort());
    assert.deepEqual(Array.from(LEAF_SLUGS).sort(), list.leaves.map((r) => r.slug).sort());
    const known = new Map(profiles.map((p) => [p.slug, p]));
    for (const slug of [...Array.from(DEADWOOD_SLUGS), ...Array.from(LEAF_SLUGS)]) {
        const p = known.get(slug);
        assert.ok(p, `${slug} is not in the catalogue export`);
        assert.equal(p.excluded, null, `${slug} is excluded from the Ark`);
    }
    for (const r of list.left_out) assert.ok(!DEADWOOD_SLUGS.has(r.slug) && !LEAF_SLUGS.has(r.slug), r.slug);
    // The caterpillars' list is moths and butterflies only; the deadwood list no birds, snakes or mammals.
    for (const slug of Array.from(LEAF_SLUGS)) assert.equal(known.get(slug)!.plan, "flying_insect", slug);
    for (const slug of Array.from(DEADWOOD_SLUGS)) assert.ok(["insect", "legless", "crustacean", "arachnid", "other"].includes(known.get(slug)!.plan), slug);
    assert.ok(DEADWOOD_SLUGS.size >= 15 && LEAF_SLUGS.size >= 10);
    assert.deepEqual(urbanNiche("woodlouse-hunter-spider", "farm_garden")[0], "deadwood");
    assert.deepEqual(urbanNiche("red-admiral", "farm_garden")[0], "leaves");
    // (Other moths keep their lamp-lit walls.)
    assert.deepEqual(urbanNiche("garden-tiger-moth-unknown", "farm_garden")[0], "lamp_wall");
});

test("logs and stumps lie on the ground, clear of buildings, trunks, streets and each other", () => {
    const plan = townPlan();
    const {items, patches} = townDeadwood(plan);
    assert.ok(items.length >= 40, `${items.length} logs and stumps`);
    assert.ok(items.filter((i) => i.place === "wood").length >= 8);
    assert.ok(patches.length >= 20, `${patches.length} patches`);
    const ids = [...items.map((i) => i.id), ...patches.map((p) => p.id)];
    assert.equal(new Set(ids).size, ids.length);
    const trees = townTrees(plan).filter((t) => !t.low);
    const bad: string[] = [];
    for (const item of items) {
        const pts = item.kind === "log" ? [-0.5, -0.25, 0, 0.25, 0.5].map((u) => ({x: item.x + Math.cos(item.rot) * u * item.length, z: item.z + Math.sin(item.rot) * u * item.length})) : [{x: item.x, z: item.z}];
        for (const p of pts) {
            if (inTownSolid(p.x, p.z, item.r)) bad.push(`${item.id} in a building, room or pond`);
            for (const t of trees) if (Math.hypot(t.x - p.x, t.z - p.z) < t.trunk + item.r) bad.push(`${item.id} in ${t.id}`);
            for (const s of plan.streets) if (polylineDistance(s.line, p.x, p.z) < s.width / 2 + s.pavement + item.r) bad.push(`${item.id} on ${s.id}`);
            const tile = townTileHeight(p.x, p.z);
            // Bedded, never floating: its underside at or under the ground; its top well over it.
            const bottom = item.kind === "log" ? item.base - item.r * 0.2 : item.base - 0.06;
            const top = item.kind === "log" ? item.base + item.r * 1.8 : item.base + item.length;
            if (bottom > tile + 0.01) bad.push(`${item.id} floats ${(bottom - tile).toFixed(2)} m`);
            if (top < tile + Math.min(0.2, item.r)) bad.push(`${item.id} buried`);
        }
        for (const o of items) if (o !== item && Math.hypot(o.x - item.x, o.z - item.z) < item.r + o.r + 0.3) bad.push(`${item.id} ~ ${o.id}`);
    }
    assert.deepEqual(bad.slice(0, 10), []);
});

test("each log and stump has its places and a deadwood spot; each patch its leaves and a spot", () => {
    const {items, patches} = townDeadwood();
    const spots = townAreas().spots;
    for (const item of items) {
        const places = deadwoodPlaces(item);
        assert.ok(places.some((p) => p.tag === "log_top") && places.some((p) => p.tag === "bark"), item.id);
        for (const p of places) assert.ok(p.y >= townTileHeight(p.x, p.z) - 0.05, `${item.id} ${p.tag} under the ground`);
        assert.ok(spots.some((s) => s.where === "deadwood" && s.place === item.id), item.id);
    }
    for (const patch of patches) {
        const places = leafPatchPlaces(patch);
        assert.ok(places.every((p) => p.tag === "leaf" && p.y > townTileHeight(p.x, p.z) + 0.3), patch.id);
        assert.ok(spots.some((s) => s.where === "leaves" && s.place === patch.id), patch.id);
    }
});

test("a log, a stump and a patch are drawn within their budgets", () => {
    const {items, patches} = townDeadwood();
    const log = items.find((i) => i.kind === "log" && i.r > 0.2)!;
    const stump = items.find((i) => i.kind === "stump")!;
    for (const [what, draw, most] of [["log", (g: Geo) => drawDeadwood(g, log), 600], ["stump", (g: Geo) => drawDeadwood(g, stump), 600], ["patch", (g: Geo) => drawLeafPatch(g, patches[0]), 700]] as const) {
        const geo = new Geo();
        draw(geo);
        const tris = geo.triangles;
        assert.ok(tris > 50 && tris <= most, `${what}: ${tris} triangles`);
    }
});
