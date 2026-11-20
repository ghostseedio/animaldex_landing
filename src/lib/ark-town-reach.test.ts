/**
 * The town's reach file (AnimalDex decision 416, "if animals can't reach each other, no mating"; AnimalDex docs/ark/town-reach.md):
 * `positions/town-reach.json` is what the drawn town generates (`islands/town/reach-file.ts`), its mask agrees with the town the
 * page draws (the ground, the canal, the ponds, the harbour, the buildings, the hedges, walls and fences, the zoo's fences, the
 * gates, the bridges and the breakwaters), the server's pick of a wildlife cluster's spot (`positions/town-reach.ts`) is the
 * scene's, and the pinned copies (`reach.ts`, `town-reach.ts`, `town-reach.json`) are the server's byte for byte.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {BAR, CLIMB, DECK, SMALL, cellOf, reachObstacles, townReachMask} from "@/ark-scene/islands/town/reach-mask";
import {townReachFile, type ReachAtlasLike} from "@/ark-scene/islands/town/reach-file";
import {canalBridges} from "@/ark-scene/islands/town/canal-bridges";
import {segmentDistance, inBox, inPoly, polyEdgeDistance} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {townGates} from "@/ark-scene/islands/town/obstacles";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {CANAL, HARBOUR_ARMS, HARBOUR_BASIN, MILLPOND, townPlan} from "@/ark-scene/islands/town/plan";
import {homeWayFrom, partCount, reachPart, townWayOf, wayOf} from "@/ark-scene/positions/reach";
import {decodeTownReach, townHome, townKindOf, type TownReach} from "@/ark-scene/positions/town-reach";
import * as P from "@/ark-scene/positions/positions";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import type {ArkAnimal, ArkZone} from "@/ark-scene/types";

const DIR = join(process.cwd(), "src/ark-scene/positions");
const read = (name: string) => readFileSync(join(DIR, name));
const sha = (name: string) => createHash("sha256").update(read(name)).digest("hex");
const atlasJson = JSON.parse(read("atlas.json").toString("utf8")) as ReachAtlasLike;
const fileText = read("town-reach.json").toString("utf8");
const town: TownReach = decodeTownReach(JSON.parse(fileText));
const mask = town.mask;
const plan = townPlan();

const at = (x: number, z: number) => mask.data[cellOf(mask, x, z)];
const med = (x: number, z: number) => at(x, z) & 3;
const WALKER = "1000n";
const SMALLWAY = "1000s";
const CLIMBER = "1000b";

test("pin: reach.ts, town-reach.ts and town-reach.json are the server's (AnimalDex _shared/ark-positions), byte for byte", () => {
    const pin = JSON.parse(read("PIN.json").toString("utf8")) as {townReach: {sha256: Record<string, string>}};
    for (const [name, want] of Object.entries(pin.townReach.sha256)) assert.equal(sha(name), want, `${name} changed: copy it to/from AnimalDex and re-pin in both repos`);
});

test("the file on disk is what the drawn town generates, and the server's pick of every sampled cluster's spot is the scene's", () => {
    const made = townReachFile(atlasJson);
    assert.deepEqual(made.misses, [], "the server's pick differs from the scene's");
    assert.ok(made.verified >= 4000, `verified ${made.verified}`);
    assert.equal(made.text, fileText, "positions/town-reach.json is not what the town generates: run npx tsx scripts/ark-town-reach.mts, copy it to AnimalDex and re-pin");
});

test("the file's cases are the scene's picks (placeTownAnimals), cluster by cluster", () => {
    assert.ok(town.cases.length >= 300, `${town.cases.length} cases`);
    const animals = town.cases.map(([slug, zone, slot], i) => ({id: `case-${i}`, species_profile_id: `case-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkZone, arrived_at: "2026-01-01T00:00:00Z", brought_by: {label: "reach", named: false}, mine: false, slot, slot_rank: 0, area: null, enclosure: null}) as unknown as ArkAnimal);
    for (let k = 0; k < animals.length; k += 200) {
        const part = animals.slice(k, k + 200);
        const placed = placeTownAnimals(part);
        part.forEach((a, j) => {
            const [slug, zone, slot, spot] = town.cases[k + j];
            const s = town.spots[spot];
            const info = placed.town.get(a.id)!;
            assert.equal(info.place, town.places[s.place], `${slug} ${zone} ${slot}`);
            assert.equal(info.where, town.wheres[s.where], `${slug} ${zone} ${slot}`);
            const home = townHome(town, slug, zone, slot)!;
            assert.equal(home.spot, spot);
        });
    }
});

test("the mask's media are the town's ground: the sea, the harbour's salt basin, the canal, the ponds and the zoo's pools", () => {
    let checked = 0;
    for (let j = 0; j < mask.nz; j += 7) {
        for (let i = 0; i < mask.nx; i += 5) {
            const x = mask.x0 + (i + 0.5) * mask.cell;
            const z = mask.z0 + (j + 0.5) * mask.cell;
            const g = sampleTownGround(x, z);
            const m = med(x, z);
            checked++;
            // (A building stands on land, whatever the ground under it: the lighthouse is in the sea.)
            if (plan.buildings.some((b) => inBox(b.at, x, z, 1))) continue;
            if (g.surface === "sea") assert.ok(m === 2 || m === 3, `sea at ${x},${z} is medium ${m}`);
            else if (g.surface === "water" && inBox(HARBOUR_BASIN, x, z, 0)) assert.ok(m === 2 || m === 3, `harbour at ${x},${z} is medium ${m}`);
            else if (g.surface === "water") assert.equal(m, 1, `fresh water at ${x},${z}`);
            else if (m !== 0) {
                // (Water that is not the ground's: a zoo's raised pool.)
                const pool = reachObstacles().some((o) => o.kind === "water" && o.fresh && (inPoly(o.poly, x, z) || polyEdgeDistance(o.poly, x, z) < 1.1));
                assert.ok(pool || (at(x, z) & DECK) !== 0 || plan.buildings.some((b) => inBox(b.at, x, z, 1)), `${g.surface} at ${x},${z} is medium ${m}`);
            }
        }
    }
    assert.ok(checked > 5000);
    // The canal's whole line is fresh water (a bridge's deck over it is still water under it), the millpond's middle too.
    for (let k = 0; k < CANAL.length; k++) assert.equal(med(CANAL[k].x, CANAL[k].z), 1, `canal point ${k}`);
    assert.equal(med(MILLPOND.x, MILLPOND.z), 1);
    assert.ok(med(HARBOUR_BASIN.x, HARBOUR_BASIN.z) >= 2, "the harbour is salt");
    assert.equal(med(300, 300), 3, "off the island, deep sea");
});

test("every building is a walled roof: its outline is a wall only a climber crosses, its inside is land of a part of its own", () => {
    for (const b of plan.buildings) {
        const c = cellOf(mask, b.at.x, b.at.z);
        assert.ok(c >= 0);
        assert.equal(mask.data[c] & 3, 0, `${b.id} stands on land`);
        // (Its corners' cells are on its outline.)
        const half = {x: b.at.w / 2, z: b.at.d / 2};
        const cos = Math.cos(b.at.rot);
        const sin = Math.sin(b.at.rot);
        let walls = 0;
        for (const [lx, lz] of [[-half.x, -half.z], [half.x, -half.z], [half.x, half.z], [-half.x, half.z]]) {
            const v = at(b.at.x + lx * cos - lz * sin, b.at.z + lx * sin + lz * cos);
            if (v & BAR) {
                walls++;
                assert.ok(!(v & SMALL) || (v & CLIMB) !== 0, `${b.id} outline lets a small body through`);
            }
        }
        assert.ok(walls >= 3, `${b.id}: ${walls} of 4 corners on its outline`);
    }
    // A walker on the street is not on any roof: the fire-engine's rule for every building bigger than a shed.
    for (const b of plan.buildings.filter((x) => x.at.w >= 5 && x.at.d >= 5)) {
        const inside = reachPart(mask, WALKER, b.at.x, b.at.z, 0.5);
        assert.ok(inside, `${b.id}'s roof is land`);
        const out = reachPart(mask, WALKER, b.at.x + (b.at.w / 2 + 6) * Math.cos(b.at.rot), b.at.z + (b.at.w / 2 + 6) * Math.sin(b.at.rot), 0.5);
        if (out) assert.notEqual(inside, out, `${b.id}: a walker is on its roof from the street`);
    }
});

test("every barrier line is on the mask with who gets through it (the town lane's `passable`), the zoo's fences let no body on the ground through", () => {
    const gates = townGates(plan);
    let lines = 0;
    for (const o of reachObstacles()) {
        if (o.kind !== "barrier") continue;
        const small = o.passable.includes("small");
        const climb = o.passable.includes("climber");
        for (let k = 1; k < o.line.length; k++) {
            const a = o.line[k - 1];
            const b = o.line[k];
            const x = (a.x + b.x) / 2;
            const z = (a.z + b.z) / 2;
            const v = at(x, z);
            // (A gate's gap, water under the line, and a deck are not barriers; a line crossing a building or another barrier keeps the stricter flags.)
            if ((v & 3) !== 0 || (v & DECK) !== 0 || gates.some((g) => Math.hypot(g.x - x, g.z - z) < 2.6)) continue;
            lines++;
            // (The line is drawn a cell wide on the cells nearest it: its middle's own cell or one beside it.)
            const near: number[] = [];
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) near.push(at(x + di * mask.cell, z + dj * mask.cell));
            const bars = near.filter((n) => n & BAR);
            assert.ok(bars.length > 0, `${o.id} (${o.barrier}) segment ${k} at ${x.toFixed(1)},${z.toFixed(1)} is not on the mask`);
            // Some barrier cell beside it is this one's: no more lenient than it says (a line crossing another keeps the stricter flags).
            const nearBuilding = plan.buildings.some((bd) => inBox(bd.at, x, z, 2));
            const mine = bars.some((n) => (!(n & SMALL) || small) && (!(n & CLIMB) || climb || nearBuilding));
            assert.ok(mine, `${o.id} (${o.barrier}) is on the mask more leniently than its passers say (${bars.join(",")})`);
            if (o.hard && !nearBuilding) assert.ok(bars.some((n) => !(n & SMALL) && !(n & CLIMB)), `${o.id}: a zoo fence is hard`);
        }
    }
    assert.ok(lines > 500, `${lines} barrier segments checked`);
});

test("the gates are gaps, the bridges are decks over the canal and the breakwaters are walkways over the sea", () => {
    const gates = townGates(plan);
    assert.equal(gates.length, plan.parcels.filter((p) => p.front).length);
    assert.ok(gates.length >= 60, `${gates.length} gates`);
    for (const g of gates) assert.equal(at(g.x, g.z) & (BAR | SMALL | CLIMB), 0, `${g.parcel}'s gate is open`);
    const bridges = canalBridges();
    assert.ok(bridges.length >= 4, `${bridges.length} bridges`);
    for (const b of bridges) {
        const v = at(b.x, b.z);
        assert.equal(v & 3, 1, `${b.street}'s bridge crosses the canal`);
        assert.ok(v & DECK, `${b.street}'s deck`);
        // A walker crosses on it: the land at both ends of the deck is one part.
        const end = (s: number) => reachPart(mask, WALKER, b.x + b.dx * s * (b.spanHalf + 8), b.z + b.dz * s * (b.spanHalf + 8), 4);
        assert.ok(end(1) && end(1) === end(-1), `${b.street}: a walker crosses the canal on the bridge`);
        // A fish goes under it: the canal is one water.
        assert.equal(reachPart(mask, "0100s", b.x, b.z, 1), reachPart(mask, "0100s", CANAL[0].x, CANAL[0].z, 1), `${b.street}: the canal under the bridge`);
    }
    for (const [a, e] of HARBOUR_ARMS) {
        const mid = {x: (a.x + e.x) / 2, z: (a.z + e.z) / 2};
        assert.ok((at(mid.x, mid.z) & DECK) !== 0 && med(mid.x, mid.z) >= 2, "a breakwater's walkway over the sea");
        assert.ok(segmentDistance(mid.x, mid.z, a.x, a.z, e.x, e.z) < 1e-9);
    }
    // The lighthouse at the east arm's end is reached along it (a climber goes up it): one part with the town.
    const lh = plan.buildings.find((b) => b.id === "lighthouse")!;
    assert.equal(reachPart(mask, CLIMBER, lh.at.x, lh.at.z, 3), reachPart(mask, CLIMBER, 0, 100, 3), "the lighthouse is joined to the land");
});

test("water: the canal and the millpond are one body, the farm pond, the country pond and each zoo pool another, the harbour's salt is not the canal's", () => {
    const fresh = (x: number, z: number) => reachPart(mask, "0100s", x, z, 1);
    assert.equal(fresh(MILLPOND.x, MILLPOND.z), fresh(CANAL[Math.floor(CANAL.length / 2)].x, CANAL[Math.floor(CANAL.length / 2)].z), "the millpond and the canal");
    const ponds = plan.waters.filter((w) => w.kind === "farm_pond");
    assert.ok(ponds.length >= 2);
    const seen = new Set<string | null>([fresh(MILLPOND.x, MILLPOND.z)]);
    for (const w of ponds) {
        const cx = w.poly.reduce((s, p) => s + p.x, 0) / w.poly.length;
        const cz = w.poly.reduce((s, p) => s + p.z, 0) / w.poly.length;
        const p = fresh(cx, cz);
        assert.ok(p, `${w.id} is water`);
        assert.ok(!seen.has(p), `${w.id} is a body of its own`);
        seen.add(p);
    }
    assert.ok(partCount(mask, "0100") >= 5, `${partCount(mask, "0100")} fresh waters`);
    // Salt: the harbour and the sea are one water; a canal fish is not in it.
    const salt = (x: number, z: number) => reachPart(mask, "0011s", x, z, 1);
    assert.equal(salt(HARBOUR_BASIN.x, HARBOUR_BASIN.z), salt(0, 300));
    assert.equal(partCount(mask, "0011"), 1);
    assert.equal(fresh(HARBOUR_BASIN.x, HARBOUR_BASIN.z), null, "no fresh water in the harbour");
});

test("who gets through what: a walker is kept in by a hedge, a small body slips through it, a climber goes over a wall and up a house, the zoo's fence stops all three", () => {
    const part = (way: string, x: number, z: number) => reachPart(mask, way, x, z, 2);
    const main = {x: 0, z: 100};
    assert.ok(part(WALKER, main.x, main.z));
    assert.equal(partCount(mask, "1000") >= 1, true);
    // The zoo's plots: the middle of every enclosure is a pocket for all three ways (a net, a zoo fence: nobody on the ground crosses).
    let plots = 0;
    for (const o of reachObstacles()) {
        if (o.kind !== "enclosure") continue;
        const cx = o.poly.reduce((s, p) => s + p.x, 0) / o.poly.length;
        const cz = o.poly.reduce((s, p) => s + p.z, 0) / o.poly.length;
        if (!inPoly(o.poly, cx, cz)) continue;
        for (const way of [WALKER, SMALLWAY, CLIMBER]) {
            const p = part(way, cx, cz);
            if (p) assert.notEqual(p, part(way, main.x, main.z), `${o.id} is a pocket for ${way}`);
        }
        plots++;
    }
    assert.ok(plots >= 10, `${plots} enclosures`);
    // Walled courtyards (a block of flats' courtyard, a terrace's back yard): a walker and a small body are kept in, a climber is not.
    const courts = town.spots.filter((s) => /-court$/.test(town.places[s.place]));
    assert.ok(courts.length > 20);
    let sealedForSmall = 0;
    let sealedForClimber = 0;
    for (const s of courts) {
        if (s.where === undefined || !s.ground) continue;
        if (part(SMALLWAY, s.x, s.z) !== part(SMALLWAY, main.x, main.z)) sealedForSmall++;
        if (part(CLIMBER, s.x, s.z) !== part(CLIMBER, main.x, main.z)) sealedForClimber++;
    }
    assert.ok(sealedForSmall > 20, `${sealedForSmall} courtyard spots are sealed for a small body that does not climb`);
    assert.ok(sealedForClimber < sealedForSmall / 4, `${sealedForClimber} are sealed for a climber`);
});

test("a kind's way: a flier is the air, a crow flies though its main way is to walk, a worm is a small walker, a gecko climbs; the way widens by the water the scene put it in", () => {
    const sheet = (slug: string) => P.sheetOf(P.decodeAtlas(atlasJson as never), slug)!;
    const flies = (slug: string) => townKindOf(town, slug)!.flies;
    assert.equal(flies("american-crow"), true, "a crow flies (the sheet's own `flies` says it walks)");
    assert.equal(P.sheetOf(P.decodeAtlas(atlasJson as never), "american-crow")!.flies, false);
    assert.equal(townWayOf(sheet("american-crow"), flies("american-crow"), false), "air");
    assert.equal(townKindOf(town, "indian-earthworm")!.climbs, false);
    assert.equal(townWayOf(sheet("indian-earthworm"), false, false), "1000s");
    assert.equal(townKindOf(town, "green-anole")!.climbs, true);
    assert.equal(townWayOf(sheet("green-anole"), false, true), "1000b");
    assert.equal(townWayOf(sheet("white-tailed-deer"), false, false), "1110n", "a big walker wades the canal and the shallows");
    for (const slug of Object.keys(town.kinds)) {
        const p = behaviourProfile(slug);
        const k = townKindOf(town, slug)!;
        assert.equal(k.flies, p.move === "fly" || p.moves.includes("fly"), slug);
    }
    // A land animal whose home the scene put in the harbour's salt water, with no land in its disc, takes the water too.
    const m = med(HARBOUR_BASIN.x, HARBOUR_BASIN.z);
    assert.ok(m === 2 || m === 3);
    assert.equal(homeWayFrom(mask, WALKER, HARBOUR_BASIN.x, HARBOUR_BASIN.z, 1), "1000".slice(0, m) + "1" + "1000".slice(m + 1) + "n");
    assert.equal(homeWayFrom(mask, WALKER, 0, 100, 1), WALKER, "a home on land keeps its way");
    assert.equal(wayOf(sheet("indian-earthworm")), "1000");
});

test("a wildlife home is a spot of the scene: every species' home is in a niche of its own, the town has no home for a species it does not know", () => {
    assert.equal(townHome(town, "no-such-animal", "woodland", 3), null);
    const crow = townHome(town, "american-crow", "woodland", 7)!;
    assert.ok(["roof", "tall", "park"].includes(crow.where), crow.where);
    const worm = townHome(town, "indian-earthworm", "farm_garden", 539)!;
    assert.equal(worm.place, "sw1-court");
    // Fish live in the water itself.
    const fish = Object.keys(town.kinds).find((s) => town.kinds[s].wet === 2)!;
    assert.ok(fish);
    const home = townHome(town, fish, "river_lake", 12)!;
    assert.ok(["millpond", "farm_pond", "canal"].includes(home.where), `${fish}: ${home.where}`);
    assert.equal(med(home.x, home.z), 1, `${fish} swims in fresh water at ${home.x},${home.z}`);
    // The mask is the file's: its cells decode to the byte count.
    assert.equal(mask.data.length, mask.nx * mask.nz);
    assert.deepEqual(Array.from(townReachMask(1).data.slice(0, 5000)), mask.data.slice(0, 5000));
});
