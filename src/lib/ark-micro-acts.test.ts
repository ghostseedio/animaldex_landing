import assert from "node:assert/strict";
import test from "node:test";
import additions from "../../data/ark/signature-recipes.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {setRecipeArkDay, sexLook, speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {MICRO_ACTS, flowerSpot, microActAt, microActWindows, microActsOf, playsInPlace, soilSpot} from "@/ark-scene/micro-acts";
import {TEMPLATES} from "@/ark-scene/recipe-templates";

const ROWS = (table as {species: Record<string, string>}).species;
const T0 = Date.UTC(2026, 10, 20, 11) / 1000;
const ON = {hours: 11, length: 0.01, soil: true, flower: true, resting: false};
const pair = (a: string, b: string) => ({key: [a, b].sort().join("#"), role: (a === [a, b].sort()[0] ? "a" : "b") as "a" | "b"});

test("every recipe a micro animal plays in place is a template of the engine, and every step a block it has", () => {
    for (const d of Object.values(MICRO_ACTS)) {
        assert.ok(TEMPLATES[d.id], `${d.id} is a template`);
        assert.ok(d.period > 60, `${d.id} period`);
        for (const step of d.steps) {
            assert.ok(BLOCKS[step.b], `${d.id}: ${step.b}`);
            assert.ok(step.s[0] > 0 && step.s[1] >= step.s[0], `${d.id}: ${step.b} seconds`);
        }
        // (A window must hold the act and its easing.)
        const longest = d.steps.reduce((n, s) => n + s.s[1], 0);
        assert.ok(longest + 1 < d.period, `${d.id}: its longest act fits its period`);
        if (d.pair) assert.equal(TEMPLATES[d.id].kind, "pair", `${d.id}: played by two, a pair template`);
    }
});

test("the wave's additions: each is in its species' row (or held with its reason), its sentence is for a recipe it has", () => {
    const list = (additions as unknown as {additions: Array<{slug: string; recipe: string; held?: string; line?: string; variant_of?: string; quote: string; field: string}>}).additions;
    const own = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
    let wave2 = 0;
    for (const a of list) {
        if (!a.line && !a.held && !a.variant_of) continue;
        wave2++;
        assert.ok(TEMPLATES[a.recipe], `${a.slug}: ${a.recipe} is a template`);
        const has = new Set((ROWS[a.slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf("."))));
        if (a.held) {
            assert.ok(a.held.length > 20, `${a.slug}: a held row says why`);
            assert.ok(!has.has(a.recipe), `${a.slug}: held ${a.recipe} is not in its row`);
            assert.ok(!own[a.slug]?.[a.recipe], `${a.slug}: a held row has no sentence`);
        } else {
            assert.ok(has.has(a.recipe), `${a.slug} has ${a.recipe}`);
            if (a.line) assert.equal(own[a.slug]?.[a.recipe], a.line, `${a.slug}: ${a.recipe} sentence`);
        }
        assert.ok(a.quote.length > 8 && a.field, `${a.slug}: its source is kept`);
    }
    assert.ok(wave2 >= 25, `${wave2} wave-2 rows`);
});

test("a species' micro recipes are its row's, in its row's order; one not in the table plays nothing", () => {
    assert.ok(playsInPlace("peterss-jumping-spider"));
    assert.equal(microActsOf("peterss-jumping-spider")[0].def.id, "spider_dance");
    assert.ok(!playsInPlace("red-deer"));
    assert.ok(!playsInPlace("not-a-species"));
    for (const [slug, row] of Object.entries(ROWS)) assert.equal(microActsOf(slug).length, row.split("|")[0].split(",").filter((r) => MICRO_ACTS[r.slice(0, r.lastIndexOf("."))]).length, slug);
});

test("a jumping spider's dance: only a male, only by day, only in season; the same act for every viewer", () => {
    setRecipeArkDay(() => 6.5 * (365 / 12)); // July: Peters's mating months (June to August)
    const males: string[] = [];
    for (let i = 0; i < 40 && males.length < 6; i++) if (sexLook(`s${i}`, "peterss-jumping-spider").sex === "male") males.push(`s${i}`);
    let windows = 0;
    for (const id of males) {
        const ws = microActWindows(id, "peterss-jumping-spider", T0, T0 + 4 * 3600, 11, 0.008, {soil: false, flower: false});
        windows += ws.length;
        for (const w of ws) {
            assert.equal(w.recipe, "spider_dance");
            assert.deepEqual(w.blocks.map((b) => b.block).filter((b, i, all) => all.indexOf(b) === i), ["leg_wave", "scan"]);
            assert.ok(w.end - w.start > 15 && w.end - w.start < 40, `${(w.end - w.start).toFixed(0)} s`);
        }
        // The same moment gives the same act, twice.
        const at = ws[0] ? ws[0].start + 3 : T0;
        assert.deepEqual(microActAt({id, slug: "peterss-jumping-spider", epoch: at, ...ON}), microActAt({id, slug: "peterss-jumping-spider", epoch: at, ...ON}));
    }
    assert.ok(windows >= 6, `${windows} dances`);
    // A female, the night, a resting spider: nothing.
    const female = Array.from({length: 40}, (_, i) => `s${i}`).find((id) => sexLook(id, "peterss-jumping-spider").sex === "female")!;
    assert.equal(microActWindows(female, "peterss-jumping-spider", T0, T0 + 4 * 3600, 11, 0.008, {soil: false, flower: false}).length, 0);
    assert.equal(microActWindows(males[0], "peterss-jumping-spider", T0, T0 + 4 * 3600, 23, 0.008, {soil: false, flower: false}).length, 0, "by day only");
    const w = microActWindows(males[0], "peterss-jumping-spider", T0, T0 + 4 * 3600, 11, 0.008, {soil: false, flower: false})[0];
    assert.equal(microActAt({id: males[0], slug: "peterss-jumping-spider", epoch: w.start + 5, ...ON, hours: 11, resting: true}), null, "a resting one does not dance");
    setRecipeArkDay(() => 1.5 * (365 / 12)); // January: out of season
    assert.equal(microActWindows(males[0], "peterss-jumping-spider", T0, T0 + 4 * 3600, 11, 0.008, {soil: false, flower: false}).length, 0);
    setRecipeArkDay(null);
});

test("a digger digs only on soil, a hover is only at a flower; the attitude is the block's, eased in and out", () => {
    const id = "digger-1";
    let found = 0;
    for (let k = 0; k < 400 && !found; k++) {
        const epoch = T0 + k * 400 + 150;
        const on = microActAt({id, slug: "vampire-crab", epoch, ...ON, hours: 21});
        if (!on) continue;
        found++;
        assert.equal(on.act.recipe, "dig_burrow");
        assert.ok(on.act.block === "dig" || on.act.block === "scan");
        assert.equal(microActAt({id, slug: "vampire-crab", epoch, ...ON, hours: 21, soil: false}), null, "not on a wall or a rock");
    }
    assert.ok(found, "it digs now and then");
    const w = microActWindows(id, "vampire-crab", T0, T0 + 6 * 3600, 21, 0.03, {soil: true, flower: false})[0];
    assert.ok(w);
    // Eased in: the first instant is not yet in the attitude, the middle of a dig is.
    const first = microActAt({id, slug: "vampire-crab", epoch: w.start + 0.05, ...ON, hours: 21, length: 0.03})!;
    const mid = microActAt({id, slug: "vampire-crab", epoch: w.start + 3, ...ON, hours: 21, length: 0.03})!;
    assert.equal(mid.act.block, "dig");
    assert.ok(Math.abs(first.pitch) < Math.abs(mid.pitch) * 0.5, "eases in");
    assert.ok(Math.abs(mid.pitch - BLOCKS.dig.pitch!) < 1e-6 || mid.act.pitch === mid.pitch);
    assert.equal(mid.mark, true, "a dig leaves its hole");
    // A hover: at a flower, lifted off it; not on a wall.
    const hover = microActWindows("moth-1", "coffee-hawk-moth", T0, T0 + 4 * 3600, 10, 0.05, {soil: false, flower: true})[0];
    assert.ok(hover, "a hawkmoth hangs at its flower");
    const up = microActAt({id: "moth-1", slug: "coffee-hawk-moth", epoch: hover.start + 3, ...ON, hours: 10, length: 0.05})!;
    assert.ok(up.heave > 0.05, `lifted ${up.heave.toFixed(3)} m`);
    assert.equal(up.act.state, "hover");
    assert.equal(microActWindows("moth-1", "coffee-hawk-moth", T0, T0 + 4 * 3600, 10, 0.05, {soil: false, flower: false}).length, 0, "no flower, no hover");
    assert.ok(soilSpot("leaf_litter") && !soilSpot("rocks") && flowerSpot("flower_head") && !flowerSpot("fence_post"));
});

test("a pair's recipe is played by the two of a cluster in one window, in opposite roles", () => {
    const [a, b] = ["ant-a", "ant-b"];
    const wa = microActWindows(a, "carpenter-ant", T0, T0 + 4 * 3600, 22, 0.02, {soil: true, flower: false}, pair(a, b));
    const wb = microActWindows(b, "carpenter-ant", T0, T0 + 4 * 3600, 22, 0.02, {soil: true, flower: false}, pair(b, a));
    assert.ok(wa.length > 2);
    assert.deepEqual(wa.map((w) => [w.start, w.end]), wb.map((w) => [w.start, w.end]), "the same windows");
    assert.equal(microActAt({id: a, slug: "carpenter-ant", epoch: wa[0].start + 6, ...ON, hours: 22, pair: pair(a, b)})!.pair, "a");
    assert.equal(microActAt({id: b, slug: "carpenter-ant", epoch: wa[0].start + 6, ...ON, hours: 22, pair: pair(b, a)})!.pair, "b");
    // Alone in its cluster, nothing.
    assert.equal(microActWindows(a, "carpenter-ant", T0, T0 + 4 * 3600, 22, 0.02, {soil: true, flower: false}, null).length, 0);
    assert.ok(speciesRecipes("carpenter-ant").has.has("border_spar"));
});
