import assert from "node:assert/strict";
import test from "node:test";
import {readdirSync, readFileSync} from "node:fs";
import {carersAt, roundVisits, type CarerPost} from "@/ark-scene/humans/carers";
import {carerPosts, ENCLOSURES_PER_KEEPER, keeperOf, PENS_PER_FARMER} from "@/ark-scene/islands/town/carer-posts";
import {zooLayout} from "@/ark-scene/islands/town/areas";
import type {TownPlace} from "@/ark-scene/islands/town/placement";

/**
 * Carers (AnimalDex decision 418): generic keepers, farmers and owners at work. The staffing mirrors the server's
 * (`_shared/ark-ecology/carers.ts`); the figures are a pure function of the hour and their posts.
 */

const flat = () => 0;
const ORIGIN = {x: 1000, z: -500};

test("carers: the staffing is the server's (keepers per section, a farmer per 4 pens)", () => {
    assert.deepEqual(ENCLOSURES_PER_KEEPER, {aquarium: 1, aviaries: 3, bears_wolves: 2, big_cats: 1, childrens_farm: 2, hoofstock_paddocks: 2, insect_house: 1, nocturnal_house: 1, penguin_seal_pools: 1, primate_house: 1, reptile_house: 1, savanna_paddocks: 2, small_mammals: 4});
    assert.equal(PENS_PER_FARMER, 4);
    assert.equal(keeperOf("aviaries-1"), keeperOf("aviaries-3"));
    assert.notEqual(keeperOf("aviaries-3"), keeperOf("aviaries-4"));
    assert.notEqual(keeperOf("big_cats-1"), keeperOf("big_cats-2"));
});

test("carers: a keeper walks in carrying the food, then works bent at the hatch (work clothes throughout); none out of hours", () => {
    const post: CarerPost = {carer: "keeper:x:0", kind: "keeper", x: 10, z: 20, yaw: 0, near: null, visits: [[9, 0.5]]};
    assert.equal(carersAt([post], 8.9, ORIGIN, flat).length, 0);
    const walk = carersAt([post], 9.05, ORIGIN, flat)[0];
    assert.equal(walk.pose, "carry");
    assert.ok(walk.z < 20 + ORIGIN.z, "walking in from behind the post");
    assert.equal(carersAt([post], 9.2, ORIGIN, flat)[0].pose, "plant");
    const watch = carersAt([post], 9.45, ORIGIN, flat)[0];
    assert.deepEqual([watch.pose, watch.x, watch.z], ["plant", 10 + ORIGIN.x, 20 + ORIGIN.z]);
    // An owner walks in and stands by the pet in their own clothes (no hi-vis: the work poses pick the work body).
    const owner = {...post, carer: "owner:h#0", kind: "owner" as const};
    assert.equal(carersAt([owner], 9.05, ORIGIN, flat)[0].pose, "walk");
    assert.equal(carersAt([owner], 9.3, ORIGIN, flat)[0].pose, "stand");
    assert.equal(carersAt([post], 9.5, ORIGIN, flat).length, 0);
    // The same carer is in one place at a time; the look is generic and the same for every viewer.
    const two = carersAt([post, {...post, x: 50}], 9.3, ORIGIN, flat);
    assert.equal(two.length, 1);
    assert.deepEqual(carersAt([post], 9.3, ORIGIN, flat)[0].look, two[0].look);
});

test("carers: a round's spots are visited in turn", () => {
    assert.deepEqual(roundVisits(2, [7, 16.5], 1), [[[7, 0.5], [16.5, 0.5]], [[7.5, 0.5], [17, 0.5]]]);
});

test("carers: every open enclosure with residents gets its keeper at its hatch (outside the fence) at feeding time", () => {
    const {enclosures} = zooLayout(["aviaries-1", "aviaries-2", "big_cats-1", "small_mammals-1"]);
    const kept = enclosures.map((e, i) => ({id: `a${i}`, x: e.feeding.x, z: e.feeding.z, place: {area: "zoo", where: "enclosure", place: e.id, enclosure: e, range: 5, still: false} as TownPlace}));
    const posts = carerPosts(kept, new Map());
    assert.equal(posts.length, enclosures.length);
    assert.equal(new Set(posts.map((p) => p.carer)).size, 3, "aviaries 1-2 share a keeper");
    for (const p of posts) {
        const e = enclosures.find((x) => keeperOf(x.id) === p.carer)!;
        const at = e.slot.at;
        // Outside: farther from the enclosure's middle than its hatch.
        assert.ok(Math.hypot(p.x - at.x, p.z - at.z) > Math.hypot(e.feeding.x - at.x, e.feeding.z - at.z) + 2, `${e.id}: the keeper stands outside`);
        assert.ok(p.visits.length >= 2, "feeding times and the morning round");
    }
    const seen = new Set<string>();
    for (let h = 0; h < 24; h += 0.05) for (const c of carersAt(posts, h, ORIGIN, flat)) seen.add(c.carer);
    assert.equal(seen.size, 3, "each keeper is seen at work during the day");
});

test("carers: a home's owner at its pet's tank, a farm's farmer by its residents; indoor pets are left to the room", () => {
    const tank = {id: "h1:tank", household: "h1", form: "tank" as const, x: 5, z: 5, rot: 0, w: 1, d: 0.5, floor: 0.8, top: 1.2};
    const kept = [
        {id: "fish", x: 5, z: 5, place: {area: "house", where: "window", place: "h1", enclosure: null, range: 0, still: true, display: tank} as TownPlace},
        {id: "cat", x: 9, z: 9, place: {area: "house", where: "lawn", place: "h1", enclosure: null, range: 5, still: false} as TownPlace},
        {id: "budgie", x: 0, z: 0, place: {area: "house", where: "indoor", place: "flat-1", enclosure: null, range: 0, still: true} as TownPlace},
        {id: "goat", x: 100, z: 100, place: {area: "farm", where: "paddock", place: "nowhere-farm", enclosure: null, range: 5, still: false} as TownPlace}
    ];
    const posts = carerPosts(kept, new Map());
    const owner = posts.filter((p) => p.kind === "owner");
    assert.equal(owner.length, 2, "the tank and the garden pet; not the indoor one");
    assert.ok(owner.every((p) => p.carer === "owner:h1"));
    const atTank = owner.find((p) => p.near !== null)!;
    assert.ok(Math.abs(atTank.z - (5 + 0.25 + 0.55)) < 1e-9, "in front of the tank's glass");
    assert.equal(posts.filter((p) => p.kind === "farmer").length, 1);
    // Owners feed in the morning and the evening only.
    for (let h = 0; h < 24; h += 0.05) for (const c of carersAt(posts, h, ORIGIN, flat)) if (c.kind === "owner") assert.ok((h >= 7 && h < 8.5) || (h >= 18 && h < 20), `owner at ${h}`);
});

test("carers: the scene asks the server's switch, and the card says who feeds a kept animal in every language", () => {
    const route = readFileSync("src/app/api/ark/carers/route.ts", "utf8");
    assert.match(route, /voyage_carers_v1/);
    const files = ["src/data/locales/en.json", "src/data/locales/id.json"];
    const dir = "src/data/locales/ark";
    for (const f of readdirSync(dir)) files.push(`${dir}/${f}`);
    assert.equal(files.length, 45);
    for (const f of files) {
        const card = JSON.parse(readFileSync(f, "utf8")).ark.card;
        for (const k of ["caredOwner", "caredFarmer", "caredKeeper"]) assert.ok(typeof card[k] === "string" && card[k].length > 3, `${f} ${k}`);
    }
});
