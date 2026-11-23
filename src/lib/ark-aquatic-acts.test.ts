import assert from "node:assert/strict";
import test from "node:test";
import partners from "@/ark-scene/aquatic-partners.json";
import signature from "../../data/ark/signature-recipes.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {AQUATIC_PERIOD, aquaticLinkOf, aquaticPose, aquaticWindows, hasAquaticAct, isAquaticRecipe, wireAquatic, type AquaticFrame, type AquaticWater, type AquaticWire} from "@/ark-scene/aquatic-acts";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {BLOOM_AMBIENT, bloomPoint, episodePose, forgetRecipes, speciesRecipes, swarmFlock, wireRecipes} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {recipeMarks, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {sceneSampler} from "@/ark-scene/world-sampler";

type Rule = {with: Record<string, unknown>; stage?: string; block: string; field: string; quote: string};
const RULES = (partners as unknown as {species: Record<string, Record<string, Rule>>}).species;
const ROWS = (table as {species: Record<string, string>}).species;
const additions = (signature as unknown as {additions: Array<{slug: string; recipe: string; field: string; quote: string}>}).additions;
const SPECIES_LINES = (lines as unknown as {species: Record<string, Record<string, string>>}).species;

test("every act of the water keeps its sentence: the held row it shows, its stored field and exact quote, its recipe on the species' row, its line", () => {
    let n = 0;
    for (const [slug, recipes] of Object.entries(RULES)) {
        for (const [recipe, rule] of Object.entries(recipes)) {
            n++;
            const row = additions.find((a) => a.slug === slug && a.recipe === recipe);
            assert.ok(row, `${slug} ${recipe}: no row in signature-recipes.json`);
            assert.equal(row!.field, rule.field, `${slug} ${recipe} field`);
            assert.equal(row!.quote, rule.quote, `${slug} ${recipe} quote`);
            assert.ok(speciesRecipes(slug).has.has(recipe), `${slug} has no ${recipe}`);
            assert.ok(SPECIES_LINES[slug]?.[recipe], `${slug} ${recipe}: no log line`);
            assert.ok(TEMPLATES[recipe], recipe);
            assert.ok(BLOCKS[rule.block], `${slug} ${recipe}: block ${rule.block}`);
            assert.ok(isAquaticRecipe(recipe), recipe);
        }
    }
    assert.equal(n, 6);
});

test("the water's own recipes: the held rows of the fish, eel and jelly plans are on their species' rows, and they are the only way a cleaner's act is named", () => {
    for (const [slug, recipe] of [["bluestreak-cleaner-wrasse", "clean_client"], ["gray-angelfish", "clean_client"], ["gray-angelfish", "pair_patrol"], ["yellow-tang", "clean_client"], ["giant-moray", "mixed_follow"], ["yellowfin-surgeonfish", "mixed_follow"], ["amazon-sailfin-catfish", "bed_tunnel_m"], ["threadfin-acara", "bed_tunnel"], ["moon-jellyfish", "bloom"]]) {
        assert.ok(speciesRecipes(slug).has.has(recipe), `${slug} ${recipe}`);
    }
    // A male-only digger, the male's text.
    assert.equal(TEMPLATES.bed_tunnel_m.sex, "male");
    assert.equal(TEMPLATES.bed_tunnel.sex, undefined);
    // None of the pair acts is run by the engine's generic pair meeting (a reef fish is in its crevice, where no episode is drawn).
    assert.ok(ROWS["gray-angelfish"].includes("pair_patrol"));
});

const wire = (id: string, slug: string, x: number, z: number, length: number, motion: AquaticWire["motion"] = "hole", young = false): AquaticWire => ({id, slug, x, z, length, young, motion});

test("who works with whom: a cleaner takes the nearest larger swimmer within 20 m; the tang only a green sea turtle; the young angelfish clean, the adults pair", () => {
    wireAquatic([
        wire("wrasse", "bluestreak-cleaner-wrasse", 0, 0, 0.12),
        wire("wrasse-far", "bluestreak-cleaner-wrasse", 90, 0, 0.12),
        wire("grouper", "giant-grouper", 9, 3, 1.6),
        wire("turtle", "green-sea-turtle", 5, -2, 1, "swim"),
        wire("tang", "yellow-tang", 30, 0, 0.15),
        wire("turtle-2", "green-sea-turtle", 36, 2, 1, "swim"),
        wire("grouper-2", "giant-grouper", 33, 1, 1.6),
        wire("juv", "gray-angelfish", -30, 0, 0.1, "hole", true),
        wire("adult-a", "gray-angelfish", 60, 40, 0.3),
        wire("adult-b", "gray-angelfish", 64, 43, 0.3),
        wire("adult-c", "gray-angelfish", 62, 46, 0.3, "hole", true),
        wire("duck", "mallard", 3, 3, 0.6, "float")
    ]);
    assert.equal(aquaticLinkOf("wrasse")?.recipe, "clean_client");
    assert.equal(aquaticLinkOf("wrasse")?.other, "turtle", "the nearest larger swimmer");
    assert.equal(aquaticLinkOf("wrasse-far"), null, "nothing within 20 m");
    // The tang's text names green sea turtles only: not the grouper beside it.
    assert.equal(aquaticLinkOf("tang")?.other, "turtle-2");
    // (The young one has no larger swimmer near: its recipe is the young's alone, never the adults' pair.)
    assert.equal(aquaticLinkOf("juv"), null);
    // An adult pair: each of the two, the same window and path.
    const a = aquaticLinkOf("adult-a")!;
    const b = aquaticLinkOf("adult-b")!;
    assert.equal(a.recipe, "pair_patrol");
    assert.equal(a.other, "adult-b");
    assert.equal(b.other, "adult-a");
    assert.equal(a.key, b.key);
    assert.equal(aquaticLinkOf("adult-c"), null, "a young one is no patrol pair's");
    assert.ok(!hasAquaticAct("duck") && !hasAquaticAct("grouper"));
});

test("a young angelfish with a larger swimmer near cleans it; an adult does not", () => {
    wireAquatic([wire("juv", "gray-angelfish", 0, 0, 0.1, "hole", true), wire("adult", "gray-angelfish", 40, 40, 0.3), wire("grouper", "giant-grouper", 6, 2, 1.6)]);
    assert.equal(aquaticLinkOf("juv")?.recipe, "clean_client");
    assert.equal(aquaticLinkOf("juv")?.other, "grouper");
    assert.equal(aquaticLinkOf("adult"), null);
});

test("a moray goes to a grouper, a surgeonfish to the other surgeonfishes (the family its text names), never to anything else", () => {
    wireAquatic([
        wire("moray", "giant-moray", 0, 0, 1.4),
        wire("mallard", "mallard", 2, 0, 0.6, "float"),
        wire("shark", "blacktip-reef-shark", 3, 1, 1.6, "swim"),
        wire("grouper", "giant-grouper", 12, 0, 1.6),
        wire("fin", "yellowfin-surgeonfish", 50, 0, 0.3),
        wire("wrasse", "bluestreak-cleaner-wrasse", 52, 0, 0.1),
        wire("tang", "blue-tang", 58, 3, 0.25),
        wire("unicorn", "bluespine-unicornfish", 56, -3, 0.5)
    ]);
    assert.equal(aquaticLinkOf("moray")?.other, "grouper");
    assert.equal(aquaticLinkOf("fin")?.recipe, "mixed_follow");
    assert.equal(aquaticLinkOf("fin")?.other, "unicorn");
});

const WATER: AquaticWater = {floorAt: () => -5, topAt: () => 0};
const day = () => 10;

/** A pair's act, sampled every tenth of a second through its window: the same for any viewer, no jump, out of the crevice and back. */
function through(id: string, partner: (t: number) => AquaticFrame, rest = {x: 0, y: -2, z: 0, yaw: 0.3, height: 0.04, length: 0.12}) {
    const t0 = Math.floor(Date.UTC(2026, 10, 20, 0) / 1000);
    const windows = aquaticWindows(id, t0, t0 + 6 * 3600, day);
    assert.ok(windows.length >= 5, `windows ${windows.length}`);
    const w = windows[0];
    const link = aquaticLinkOf(id)!;
    assert.ok(w.end - w.start <= AQUATIC_PERIOD && Math.abs(w.end - w.start - link.seconds) < 1e-6);
    const samples: Array<{t: number; at: NonNullable<ReturnType<typeof aquaticPose>>}> = [];
    for (let t = w.start - 1; t < w.end + 1; t += 0.1) {
        const at = aquaticPose(id, t, day, rest, () => partner(t), WATER);
        if (t < w.start || t >= w.end) assert.equal(at, null, `none outside the window at ${t - w.start}`);
        else {
            assert.ok(at, `act at ${(t - w.start).toFixed(1)} of ${link.seconds.toFixed(0)}`);
            // Pure: the same at the same time.
            const again = aquaticPose(id, t, day, rest, () => partner(t), WATER)!;
            assert.deepEqual(again, at);
            samples.push({t, at});
        }
    }
    return {w, samples, link, rest};
}

test("a cleaner: out of its crevice to the client's flank, back and forth along it, then home; never a jump, never under the floor or over the surface", () => {
    wireAquatic([wire("wrasse", "bluestreak-cleaner-wrasse", 0, 0, 0.12), wire("turtle", "green-sea-turtle", 5, -2, 1, "swim")]);
    const client = (_t: number): AquaticFrame => ({x: 5, y: -2.2, z: -2, yaw: 1.2, length: 1, height: 0.3});
    const {samples, link, rest} = through("wrasse", client);
    // From its crevice: at the start where it rests, at the end where it rests.
    assert.ok(Math.hypot(samples[0].at.x - rest.x, samples[0].at.z - rest.z) < 0.05);
    const last = samples[samples.length - 1].at;
    assert.ok(Math.hypot(last.x - rest.x, last.z - rest.z) < 0.06, `home ${Math.hypot(last.x - rest.x, last.z - rest.z)}`);
    let along = 0;
    let atClient = 0;
    for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1].at;
        const b = samples[i].at;
        // A tenth of a second: no further than a fish this size could swim (a few lengths a second), no turn over half a radian.
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 0.15, `step ${i}: ${Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)}`);
        const turn = Math.abs(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)));
        assert.ok(turn < 0.8, `turn ${i}: ${turn}`);
        assert.ok(b.y < 0 && b.y > -5, `inside the water at ${b.y}`);
        if (b.act.block === "clean") {
            atClient++;
            assert.equal(b.act.state, "groom_other");
            assert.equal(b.act.with, "turtle");
            // On the client's flank: within a client length of its middle, a body width or so beside it.
            const dx = b.x - 5;
            const dz = b.z + 2;
            assert.ok(Math.hypot(dx, dz) < 0.6, `at the flank ${Math.hypot(dx, dz)}`);
            if (b.x !== a.x) along++;
        } else assert.equal(b.act.block, "swim", "on the way");
    }
    assert.ok(atClient > (link.work * 10) * 0.7, `at the client ${atClient} of ${link.work * 10}`);
    assert.ok(along > atClient * 0.8, "it moves along the body");
    assert.equal(samples[Math.floor(samples.length / 2)].at.act.recipe, "clean_client");
});

test("a moray with a grouper, a pair of angelfish on patrol: each from its own crevice, the pair side by side over water", () => {
    wireAquatic([wire("moray", "giant-moray", 0, 0, 1.4), wire("grouper", "giant-grouper", 9, 0, 1.6)]);
    const grouper = (): AquaticFrame => ({x: 9, y: -3, z: 0, yaw: 0, length: 1.6, height: 0.5});
    const m = through("moray", grouper, {x: 0, y: -3, z: 0, yaw: 0, height: 0.2, length: 1.4});
    assert.ok(m.samples.some((s) => s.at.act.block === "patrol" && Math.hypot(s.at.x - 9, s.at.z) < 5), "alongside the grouper");
    wireAquatic([wire("a", "gray-angelfish", 0, 0, 0.3), wire("b", "gray-angelfish", 3, 2, 0.3)]);
    const nothing = (): AquaticFrame => ({x: 0, y: -2, z: 0, yaw: 0, length: 0.3, height: 0.2});
    const pa = through("a", nothing, {x: 0, y: -2, z: 0, yaw: 0, height: 0.2, length: 0.3});
    const pb = through("b", nothing, {x: 3, y: -2, z: 2, yaw: 0, height: 0.2, length: 0.3});
    assert.equal(pa.w.start, pb.w.start, "one window for the pair");
    // Together: side by side (a body or two apart) all through the patrol.
    let together = 0;
    let moving = 0;
    for (let i = 0; i < pa.samples.length; i++) {
        const x = pa.samples[i].at;
        const y = pb.samples[i].at;
        if (x.act.block === "patrol" && y.act.block === "patrol") {
            moving++;
            if (Math.hypot(x.x - y.x, x.z - y.z) < 0.6) together++;
        }
    }
    assert.ok(moving > 300, `patrolling ${moving}`);
    assert.ok(together > moving * 0.95, `together ${together} of ${moving}`);
});

test("by day only, and in two periods of three", () => {
    wireAquatic([wire("wrasse", "bluestreak-cleaner-wrasse", 0, 0, 0.12), wire("turtle", "green-sea-turtle", 5, -2, 1, "swim")]);
    const t0 = Math.floor(Date.UTC(2026, 10, 20, 0) / 1000);
    const night = aquaticWindows("wrasse", t0, t0 + 86_400, () => 2);
    assert.equal(night.length, 0);
    const days = aquaticWindows("wrasse", t0, t0 + 86_400, day);
    const periods = 86_400 / AQUATIC_PERIOD;
    assert.ok(days.length > periods * 0.5 && days.length < periods * 0.85, `${days.length} of ${periods}`);
});

// MARK: The engine's: a tunnel at the bed, a bloom of jellies

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

function fish(id: string, slug: string, home: {x: number; z: number}, length: number): {animal: ScheduleAnimal; profile: ReturnType<typeof behaviourProfile>; slug: string} {
    return {animal: {id, zone: "river_lake", home: {x: home.x, y: Math.max(world.sampler.heightAt(home.x, home.z), 0), z: home.z}, length, sea: false}, profile: behaviourProfile(slug), slug};
}

test("an acara digs its tunnel into the bed of the lake: down to the bed, head down digging, guarding between, a pit and a spoil heap left on the bed", () => {
    forgetRecipes();
    const f = fish("acara-1", "threadfin-acara", {x: -70, z: 22}, 0.18);
    wireRecipes([f]);
    const t0 = Math.floor(Date.UTC(2026, 10, 20, 0) / 1000);
    const trips = [];
    for (let t = t0; t < t0 + 48 * 3600; t += SLOT_SECONDS) trips.push(tripAt(world, f.profile, f.animal, t, hoursAt, "diurnal"));
    const digging = trips.filter((t) => t.recipe === "bed_tunnel");
    assert.ok(digging.length >= 1, `tunnel slots ${digging.length} of ${trips.length}`);
    let dug = 0;
    let guards = 0;
    for (const trip of digging) {
        const episode = tripEpisode(world, trip);
        if (!episode) continue;
        const dig = episode.keys.filter((k) => k.block.id === "dig_bed");
        if (!dig.length) continue;
        dug++;
        for (const k of dig) {
            // On the bed, under the water: the fish's body just above the floor, in water deeper than itself.
            const floor = world.sampler.heightAt(k.from.x, k.from.z);
            assert.ok(k.from.y >= floor - 1e-6 && k.from.y < floor + 0.5, `on the bed ${k.from.y} over ${floor}`);
            assert.ok(floor < 0 || floor < 5, "wet");
            assert.ok(k.t1 - k.t0 >= 3);
        }
        guards += episode.keys.filter((k) => k.block.id === "scan").length;
        // The pit and the spoil heap, on the bed, left where it dug (and kept for twenty minutes).
        const marks = recipeMarks(world, f.profile, f.animal, episode.t1 + 5, hoursAt, "diurnal").filter((m) => m.id.startsWith(episode.id));
        assert.ok(marks.some((m) => m.kind === "hole"), `marks ${JSON.stringify(marks.map((m) => m.kind))}`);
        if (dig.length > 1) assert.ok(marks.some((m) => m.kind === "mound"), "the spoil heap");
        for (const m of marks) assert.ok(Math.abs(m.y - world.sampler.heightAt(m.x, m.z)) < 1e-6, "on the bed");
    }
    assert.ok(dug >= 1, `dug ${dug}`);
    assert.ok(guards >= 1, "it keeps watch between its digs");
});

test("a moon jelly bloom: bells in a cloud a metre or two under the surface; a bloom's jelly itself near the surface; none for another jelly", () => {
    forgetRecipes();
    const at = {x: 100, y: 0, z: -60};
    const flock = swarmFlock("jelly-1", "moon-jellyfish", at, 1_000_000, 3)!;
    assert.equal(flock.kind, "bloom");
    assert.equal(swarmFlock("jelly-1", "moon-jellyfish", at, 1_000_000, 22)?.kind, "bloom", "all day and night");
    assert.equal(swarmFlock("jelly-2", "australian-box-jellyfish", at, 1_000_000, 12), null, "another jelly has no bloom");
    for (let i = 0; i < BLOOM_AMBIENT; i++) {
        const p = bloomPoint(flock.centre, flock.seed, i, 1_000_000);
        assert.ok(p.y < -0.5 && p.y > -3, `depth ${p.y}`);
        assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 10.5, "within a few metres of its middle");
        assert.ok(p.size > 0.2 && p.size < 0.5 && p.pulse >= 0 && p.pulse <= 1);
        assert.deepEqual(p, bloomPoint(flock.centre, flock.seed, i, 1_000_000), "pure");
    }
    // The cloud drifts together: a few seconds on, every bell has moved, and none has jumped.
    const a = bloomPoint(flock.centre, flock.seed, 3, 1_000_000);
    const b = bloomPoint(flock.centre, flock.seed, 3, 1_000_001);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 0.5);
    void episodePose;
});
