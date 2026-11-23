import assert from "node:assert/strict";
import test from "node:test";
import {
    ANT_TICK_SECONDS,
    FADE_SECONDS,
    LOAD_LEAF,
    LOAD_NONE,
    LOAD_PIECE,
    antKindOf,
    colonyKeyOf,
    colonySteps,
    eats,
    raidNow,
    raiders,
    searchers,
    seedOf,
    trailNow,
    trailPath,
    trailWorkers,
    type AntFood,
    type AntSink,
    type Colony
} from "@/ark-scene/ants/colony";
import {antItems, antText} from "@/ark-scene/live/ant-lines";
import {ArkSeenMemory, type ArkLiveText, type ArkSeenAct} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import en from "@/data/locales/en.json";
import de from "@/data/locales/ark/de.json";

const flat = () => 0;
const T0 = 1_795_000_000;

function colony(slug: string, hungry = false): Colony {
    const kind = antKindOf(slug)!;
    const key = colonyKeyOf(slug, "wild", "rainforest", null, null)!;
    return {key, kind, members: ["a", "b"], name: slug, speciesId: slug, zone: "rainforest", nest: {x: 0, y: 0, z: 0}, trunk: null, seed: seedOf(key), hungry};
}

const body = (x: number, from = T0, life = 17 * 60): AntFood => ({key: `death:${x}`, kind: "carcass", x, y: 0, z: 0, from, until: from + life, label: "Field Cricket"});

function collect(): {sink: AntSink; ants: Array<{x: number; z: number; load: number}>} {
    const ants: Array<{x: number; z: number; load: number}> = [];
    return {ants, sink: (x, _y, z, _tx, _ty, _tz, _ux, _uy, _uz, _s, load) => (ants.push({x, z, load}), true)};
}

test("ant kinds: the 19 kinds; velvet ants and the mantis are not colonies", () => {
    assert.equal(antKindOf("panda-ant"), null);
    assert.equal(antKindOf("red-velvet-ant"), null);
    assert.equal(antKindOf("ant-mimic-mantis"), null);
    assert.equal(antKindOf("ghost-ant")!.form, "trail");
    assert.equal(antKindOf("sahara-desert-ant")!.form, "homing"); // "Foragers do not lay scent trails to recruit nestmates"
    assert.equal(antKindOf("bullet-ant")!.form, "solo"); // "Foragers usually travel alone rather than in columns."
    assert.equal(antKindOf("leafcutter-ant")!.form, "leafcut");
    assert.equal(antKindOf("eciton-army-ant")!.form, "column");
    assert.equal(antKindOf("red-harvester-ant")!.plants, "seeds");
    assert.equal(antKindOf("asian-weaver-ant")!.weave, true);
    // A held ant (a house's tank) is no colony.
    assert.equal(colonyKeyOf("ghost-ant", "town", "farm_garden", "house", "house-25#0"), null);
});

test("no fake events: with no real food a colony only searches (no trail, no find, no line)", () => {
    const c = colony("ghost-ant");
    assert.equal(trailNow(c, [], T0 + 500), null);
    const steps = colonySteps(c, [], Math.floor(T0 / ANT_TICK_SECONDS), () => true);
    assert.ok(steps.every((s) => s.kind === "search"), JSON.stringify(steps.map((s) => s.kind)));
    // Searchers carry nothing.
    const {sink, ants} = collect();
    searchers(c, T0, true, 60, {x: 0, z: 0, r: 5}, flat, sink);
    assert.ok(ants.length > 10);
    assert.ok(ants.every((a) => a.load === LOAD_NONE));
});

test("a trail only to food the kind takes: a body (dead insects), never plants for a hungry leafcutter colony", () => {
    assert.equal(eats(antKindOf("ghost-ant")!, {kind: "carcass", label: "x"}, false), true);
    assert.equal(eats(antKindOf("leafcutter-ant")!, {kind: "carcass", label: "x"}, false), false);
    assert.equal(eats(antKindOf("turtle-ant")!, {kind: "carcass", label: "x"}, false), false); // "It does not hunt live prey."
    assert.equal(eats(antKindOf("leafcutter-ant")!, {kind: "plant", label: "leaves"}, true), false);
    assert.equal(eats(antKindOf("leafcutter-ant")!, {kind: "plant", label: "leaves"}, false), true);
    assert.equal(eats(antKindOf("ghost-ant")!, {kind: "honeydew", label: "x", host: "potato-leafhopper"}, false), false);
    assert.equal(eats(antKindOf("ghost-ant")!, {kind: "honeydew", label: "x", host: "green-peach-aphid"}, false), true);
    assert.equal(eats(antKindOf("ghost-ant")!, {kind: "honeydew", label: "x"}, false), false);
});

test("the trail forms after the find, strengthens, and fades once the body has gone", () => {
    const c = colony("ghost-ant");
    const food = body(1.2);
    const plans = [T0 - 5, T0 + 20, T0 + 400, T0 + 900, food.until + FADE_SECONDS / 2, food.until + FADE_SECONDS + 1].map((t) => trailNow(c, [food], t));
    assert.equal(plans[0], null, "before the death");
    const found = trailNow(c, [food], food.until - 1)!.found;
    assert.ok(found > food.from && found < food.until);
    const later = trailNow(c, [food], found + 400)!;
    const early = trailNow(c, [food], found + 1)!;
    assert.equal(early.phase, "forming");
    assert.ok(later.strength > early.strength);
    assert.equal(plans[4]!.phase, "fading");
    assert.ok(plans[4]!.strength < 1);
    assert.equal(plans[5], null, "faded");
    // Out of reach: never found.
    assert.equal(trailNow(c, [body(40)], T0 + 600), null);
});

test("every viewer: the same ants in the same places, in any order", () => {
    const c = colony("black-ant");
    const food = body(2);
    const at = trailNow(c, [food], food.until - 60)!.found + 200;
    const plan = trailNow(c, [food], at)!;
    const path = trailPath(c, food, flat);
    const a = collect();
    const b = collect();
    trailWorkers(c, plan, path, at, {x: 1, z: 0, r: 0.6}, 0, [], a.sink);
    trailNow(c, [food], at + 50);
    trailWorkers(c, trailNow(c, [food], at)!, trailPath(c, food, flat), at, {x: 1, z: 0, r: 0.6}, 0, [], b.sink);
    assert.ok(a.ants.length > 20, `ants ${a.ants.length}`);
    assert.deepEqual(a.ants, b.ants);
    // Ants coming home carry pieces of the body; going out they carry nothing.
    assert.ok(a.ants.some((x) => x.load === LOAD_PIECE));
    assert.ok(a.ants.some((x) => x.load === LOAD_NONE));
});

test("a busier trail draws more ants than a forming one; only those in view are visited", () => {
    const c = colony("ghost-ant");
    const food = body(1.5);
    const found = trailNow(c, [food], food.until - 1)!.found;
    const count = (t: number, r = 3) => {
        const plan = trailNow(c, [food], t);
        if (!plan) return 0;
        const k = collect();
        trailWorkers(c, plan, trailPath(c, food, flat), t, {x: 0.7, z: 0, r}, 0, [], k.sink);
        return k.ants.length;
    };
    const forming = count(found + 100);
    const busy = count(found + 600);
    assert.ok(busy > forming * 2, `${forming} -> ${busy}`);
    assert.ok(count(found + 600, 0.05) < busy / 4);
});

test("leafcutters carry leaf pieces home along their highway on a fed day only", () => {
    const fed = colony("leafcutter-ant", false);
    const hungry = colony("leafcutter-ant", true);
    const plant: AntFood = {key: "plant:1", kind: "plant", x: 4, y: 0, z: 0, from: -Infinity, until: Infinity, label: "leaves"};
    assert.equal(trailNow(hungry, [plant], T0), null);
    const plan = trailNow(fed, [plant], T0)!;
    assert.equal(plan.phase, "busy");
    const k = collect();
    trailWorkers(fed, plan, trailPath(fed, plant, flat), T0, {x: 2, z: 0, r: 1}, 0, [], k.sink);
    assert.ok(k.ants.filter((a) => a.load === LOAD_LEAF).length > 10);
});

test("army ants: a raid out from the bivouac, a swarm front, then the bivouac moves at the day's end", () => {
    const c = colony("eciton-army-ant");
    const tick = Math.floor(T0 / ANT_TICK_SECONDS);
    const mid = raidNow(c, [], (tick + 0.5) * ANT_TICK_SECONDS, flat);
    const late = raidNow(c, [], (tick + 0.95) * ANT_TICK_SECONDS, flat);
    assert.ok(mid.front > 1 && mid.moving === 0);
    assert.ok(late.moving > 0);
    const next = raidNow(c, [], (tick + 1.01) * ANT_TICK_SECONDS, flat);
    assert.deepEqual([next.bivouac.x, next.bivouac.z], [late.next.x, late.next.z]);
    const k = collect();
    raiders(c, mid, (tick + 0.5) * ANT_TICK_SECONDS, {x: mid.bivouac.x + Math.cos(mid.heading) * mid.front, z: mid.bivouac.z + Math.sin(mid.heading) * mid.front, r: 1.5}, 3000, flat, k.sink, false);
    assert.ok(k.ants.length > 100, `front ${k.ants.length}`);
    assert.ok(k.ants.every((a) => a.load === LOAD_NONE), "no prey carried without a real body");
});

test("live log: the colony's line in the reader's words, once per episode; every locale has the keys", () => {
    const words = {live: (en as {ark: {live: unknown}}).ark.live, replay: (en as unknown as {ark: {replay: unknown}}).ark.replay} as unknown as ArkLiveText;
    assert.equal(antText("antTrailFound", "Ghost Ant", "Field Cricket", words, "en"), "A trail of Ghost Ants found a dead Field Cricket");
    assert.equal(antText("antTend", "Ghost Ant", "Green Peach Aphid", words, "en"), "Ghost Ants are collecting honeydew from the Green Peach Aphid");
    assert.equal(antText("antLeaves", "Leafcutter Ant", null, words, "en"), "Leafcutter Ants are carrying leaves along their highway");
    const german = {live: (de as {ark: {live: unknown}}).ark.live} as unknown as ArkLiveText;
    assert.equal(antText("antRaid", "Eciton-Wanderameise", null, german, "de"), "Eciton-Wanderameise: Raubzug in breiter Front");
    const act: ArkSeenAct = {id: "a", name: "Ghost Ant", speciesId: "s", zone: "farm_garden", recipe: "ant_colony", episode: "ants:x:death:1", block: "colony", fish: false, words: {key: "antTrailFound", other: "Field Cricket"}};
    const memory = new ArkSeenMemory();
    assert.equal(antItems([act], memory, words, "en").length, 1);
    assert.equal(antItems([act], memory, words, "en").length, 0);
    for (const key of ["antTrailFound", "antTend", "antLeaves", "antSeeds", "antRaid", "antBivouac", "antWeave"] as const) assert.ok(ARK_LIVE_ENGLISH[key]);
});
