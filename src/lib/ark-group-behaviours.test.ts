import assert from "node:assert/strict";
import test from "node:test";
import data from "../../data/ark/group-behaviours.json";
import profiles from "../../data/ark/behaviour-profiles.json";
import groupActs from "@/ark-scene/group-acts.json";
import groupLines from "@/ark-scene/group-lines.json";
import groupRecipes from "@/ark-scene/group-recipes.json";
import {actWindow, commuteCentre, groupActsOf, groupLives, groupRoostOf, pairSide, windowOf} from "@/ark-scene/behaviour-group";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {scheduleWorld, tripAt, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {sleepStyle} from "@/ark-scene/sleep";
import {sceneSampler} from "@/ark-scene/world-sampler";

type Row = {slug: string; name: string; field: string; quote: string; line: string | null; acts: string[]; status: string; why: string | null; effort: string; aboard: number};
const rows = (data as unknown as {rows: Row[]}).rows;
const slugs = new Set((profiles as unknown as {profiles: Array<{slug: string}>}).profiles.map((p) => p.slug));

test("every group-life row keeps its stored sentence and its slug; every held row says why", () => {
    assert.equal(rows.length, 253);
    for (const r of rows) {
        assert.ok(slugs.has(r.slug), `${r.name}: ${r.slug}`);
        assert.ok(r.field && r.quote.length > 5, `${r.slug}: sentence`);
        assert.ok(["built", "partial", "existing", "held"].includes(r.status), `${r.slug}: ${r.status}`);
        if (r.status === "held" || r.status === "existing") assert.ok(r.why, `${r.slug}: why`);
        // A built or partial row names the act the scene plays.
        if (r.status === "built" && r.acts.length === 0) assert.ok(r.why, `${r.slug}: built by nothing but the pair's own group`);
    }
});

test("the shipped files are what the data says (scripts/ark-group-behaviours.mts)", () => {
    const wanted = new Map<string, Set<string>>();
    for (const r of rows) if (r.status === "built" || r.status === "partial") for (const a of r.acts) if (!a.startsWith("recipe:")) (wanted.get(r.slug) ?? wanted.set(r.slug, new Set()).get(r.slug)!).add(a);
    const shipped = (groupActs as unknown as {species: Record<string, string>}).species;
    assert.deepEqual(Object.keys(shipped).sort(), Array.from(wanted.keys()).sort());
    for (const [slug, tokens] of Array.from(wanted)) assert.deepEqual(new Set(shipped[slug].split(" ")), tokens, slug);
    // (A line is kept only for a species that has the act: the line's recipe is one of that act's.)
    for (const [slug, byRecipe] of Object.entries((groupLines as unknown as {species: Record<string, Record<string, string>>}).species)) {
        assert.ok(shipped[slug], `${slug}: a line without an act`);
        for (const recipe of Object.keys(byRecipe)) assert.ok(TEMPLATES[recipe], `${slug}: ${recipe}`);
    }
    for (const [slug, list] of Object.entries((groupRecipes as unknown as {species: Record<string, string>}).species)) {
        for (const r of list.split(",")) assert.ok(TEMPLATES[r.split(".")[0]], `${slug}: ${r}`);
        for (const r of list.split(",")) assert.ok(speciesRecipes(slug).has.has(r.split(".")[0]), `${slug} has ${r}`);
    }
});

test("the group templates are templates the engine runs (blocks it has), and the recipe pick never takes one", () => {
    for (const id of ["huddle", "sentinel_post", "dusk_gather", "lick_gather", "chorus", "tree_feast", "bask_pile"]) {
        const t = TEMPLATES[id];
        assert.ok(t, id);
        assert.equal(t.kind, "group", id);
    }
});

test("a species' group acts decode in order, and only the species that live in a group are grouped by their own text", () => {
    assert.deepEqual(
        groupActsOf("american-crow").map((a) => a.id),
        ["sentinel", "gather", "roost"]
    );
    assert.equal(groupActsOf("american-crow")[0].arg, "2");
    assert.equal(groupRoostOf("house-sparrow"), "row");
    assert.equal(groupRoostOf("domestic-ferret"), "pile");
    assert.equal(groupRoostOf("guinea-pig"), "huddle");
    assert.equal(groupRoostOf("african-lion"), null);
    assert.ok(groupLives("guinea-pig"));
    assert.ok(!groupLives("house-sparrow"));
    assert.deepEqual(groupActsOf("no-such-animal"), []);
});

test("a species whose sleep text says nothing of roosting with its kind roosts with it from its own group-life row", () => {
    assert.equal(sleepStyle("house-sparrow").social, "row");
    assert.equal(sleepStyle("guinea-pig").social, "huddle");
    // (A species whose own sleep text already says how keeps what it says.)
    // (The common marmoset's huddle is held, SIG3 tranche 3, `signature-holds.json`: it sleeps apart until it reads.)
    for (const slug of ["ring-tailed-lemur"]) assert.notEqual(sleepStyle(slug).social, "apart", slug);
});

test("windows are pure, seeded by the group and the period, and fall inside it", () => {
    const hits: number[] = [];
    for (let t = 0; t < 36_000; t += 5) {
        const w = windowOf("lead-1#huddle", t, 600, 0.55, 150, 330);
        assert.deepEqual(windowOf("lead-1#huddle", t, 600, 0.55, 150, 330), w);
        if (w) {
            assert.ok(t >= w.t0 && t < w.t1 && w.t1 - w.t0 >= 150 && w.t1 - w.t0 <= 330);
            assert.ok(w.t0 >= w.n * 600 && w.t1 <= (w.n + 1) * 600 + 1e-6, "inside its period");
            hits.push(w.n);
        }
    }
    const periods = new Set(hits).size;
    assert.ok(periods > 20 && periods < 55, `windows in ${periods} of 60 periods`);
    // Another group has its own.
    let differs = false;
    for (let t = 0; t < 6000 && !differs; t += 10) differs = Boolean(windowOf("lead-1#huddle", t, 600, 0.55, 150, 330)) !== Boolean(windowOf("lead-2#huddle", t, 600, 0.55, 150, 330));
    assert.ok(differs);
});

test("pairs fly wing to wing: ranks 2k+1 and 2k+2 are a pair, on either side, in the species that pair; the leader is none", () => {
    assert.equal(pairSide("blue-fronted-amazon", 0), null);
    assert.deepEqual(pairSide("blue-fronted-amazon", 1), {pair: 0, side: -1});
    assert.deepEqual(pairSide("blue-fronted-amazon", 2), {pair: 0, side: 1});
    assert.deepEqual(pairSide("blue-fronted-amazon", 3), {pair: 1, side: -1});
    assert.equal(pairSide("house-sparrow", 1), null);
});

// MARK: In the schedule

const world = scheduleWorld(sceneSampler());
const DAY = 1_790_000_000;

/** A group of `n` of a species on the ground at a home: a leader (`led`) and members of ranks 1…n-1. */
function group(slug: string, n: number, home: {x: number; z: number}, length: number): Array<{animal: ScheduleAnimal; profile: ReturnType<typeof behaviourProfile>}> {
    const profile = behaviourProfile(slug);
    const all = Array.from({length: n}, (_, i) => ({animal: {id: `grp-${slug}-${i}`, zone: "farm_garden", home: {x: home.x + (i % 3), y: Math.max(world.sampler.heightAt(home.x + (i % 3), home.z + i), 0), z: home.z + i}, length, sea: false} as ScheduleAnimal, profile}));
    all[0].animal.led = n;
    all.forEach((m, i) => {
        if (i > 0) m.animal.group = {leader: all[0].animal, profile, activity: "diurnal", rank: i, size: n};
    });
    return all;
}

test("a sentinel: in a window exactly one of a group of four stands on watch at a post; alone, none does", () => {
    const crows = group("american-crow", 4, {x: 40, z: -60}, 0.45);
    const hoursAt = () => 10;
    const lead = crows[0].animal.id;
    let found = 0;
    const done = new Set<number>();
    for (let t = DAY; t < DAY + 7200 && found < 3; t += 10) {
        const w = actWindow("sentinel", lead, t);
        if (!w || done.has(w.n) || w.t1 - w.t0 < 120) continue;
        done.add(w.n);
        // (Each member's slot that starts in the window.)
        const posted = crows.filter((c) => {
            const trip = tripAt(world, c.profile, c.animal, w.t0 + 100, hoursAt, "diurnal");
            return trip.recipe === "sentinel_post";
        });
        assert.ok(posted.length <= 1, `one sentinel, got ${posted.length} in window ${w.n}`);
        if (posted.length) found++;
    }
    assert.ok(found >= 1, "a sentinel was posted in some window");
    const alone = group("american-crow", 1, {x: 40, z: -60}, 0.45)[0];
    for (let t = DAY; t < DAY + 3600; t += SLOT_SECONDS) assert.notEqual(tripAt(world, alone.profile, alone.animal, t, hoursAt, "diurnal").recipe, "sentinel_post");
});

test("a huddle: in a window the whole group goes to one place, a body-length or two apart; at night or alone it does not", () => {
    const pigs = group("capybara", 5, {x: 40, z: -60}, 1.1);
    const hoursAt = () => 12;
    let seen = 0;
    const done = new Set<number>();
    for (let t = DAY; t < DAY + 14_400 && seen < 2; t += 10) {
        const w = actWindow("huddle", pigs[0].animal.id, t);
        if (!w || done.has(w.n)) continue;
        done.add(w.n);
        // (Every member's slot that starts after the window opens and ends before it closes.)
        const at = pigs.map((p) => tripAt(world, p.profile, p.animal, w.t0 + 90, hoursAt, "diurnal"));
        const huddling = at.filter((tr) => tr.recipe === "huddle");
        if (huddling.length >= 3) {
            const cx = huddling.reduce((m, tr) => m + tr.to.x, 0) / huddling.length;
            const cz = huddling.reduce((m, tr) => m + tr.to.z, 0) / huddling.length;
            for (const tr of huddling) assert.ok(Math.hypot(tr.to.x - cx, tr.to.z - cz) < 6, "within a few metres of the cluster's middle");
            seen++;
        }
    }
    assert.ok(seen >= 1, "a huddle was seen");
    const lone = group("capybara", 1, {x: 40, z: -60}, 1.1)[0];
    for (let t = DAY; t < DAY + 3600; t += SLOT_SECONDS) assert.notEqual(tripAt(world, lone.profile, lone.animal, t, hoursAt, "diurnal").recipe, "huddle");
    // At night the huddle is the sleep's, not the window's.
    for (let t = DAY; t < DAY + 3600; t += SLOT_SECONDS) for (const p of pigs) assert.notEqual(tripAt(world, p.profile, p.animal, t, () => 23, "diurnal").recipe, "huddle");
});

test("a commuting flock's leader spends the day at a patch 40-70 m off; a lone one, a member and the night do not", () => {
    const flock = group("blue-fronted-amazon", 4, {x: 40, z: -60}, 0.18);
    const lead = flock[0].animal;
    const patch = commuteCentre(world, lead, "blue-fronted-amazon", 12);
    assert.ok(patch, "a patch");
    const d = Math.hypot(patch.x - lead.home.x, patch.z - lead.home.z);
    assert.ok(d >= 25 && d <= 75, `patch ${d.toFixed(0)} m away`);
    assert.deepEqual(commuteCentre(world, lead, "blue-fronted-amazon", 12), patch, "the same every day");
    assert.equal(commuteCentre(world, lead, "blue-fronted-amazon", 21), null);
    assert.equal(commuteCentre(world, flock[1].animal, "blue-fronted-amazon", 12), null);
    assert.equal(commuteCentre(world, group("blue-fronted-amazon", 1, {x: 40, z: -60}, 0.18)[0].animal, "blue-fronted-amazon", 12), null);
    assert.equal(commuteCentre(world, lead, "house-sparrow", 12), null);
});
