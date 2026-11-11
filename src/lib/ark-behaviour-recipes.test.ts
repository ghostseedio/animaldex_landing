import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/recipes.json";
import full from "../../data/ark/behaviour-recipes.json";
import {ARK_RECIPE_STATES, BLOCKS} from "@/ark-scene/behaviour-blocks";
import {AFTER_STYLES, ENTRY_STYLES, EXIT_STYLES, POSTURES, TEMPLATES, type PreyKind} from "@/ark-scene/recipe-templates";
import {decodeRecipeRow, forgetRecipes, microMurmuration, murmurationPoint, MURMURATION_HOURS, nestStageAt, pairLinksOf, PAIR_PERIOD, setRecipesEnabled, sexLook, speciesRecipes, wireRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {basePoseOnTrip, poseOnTrip, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const ROWS = (table as {species: Record<string, string>}).species;
const AMBIENT: PreyKind[] = ["fish", "insect", "worm", "shellfish", "nut", "seed"];

/** A schedule animal of a species at a home. */
function animal(id: string, slug: string, home: {x: number; z: number}, length: number): {animal: ScheduleAnimal; profile: ReturnType<typeof behaviourProfile>; slug: string} {
    return {animal: {id, zone: "river_lake", home: {x: home.x, y: Math.max(world.sampler.heightAt(home.x, home.z), 0), z: home.z}, length, sea: false}, profile: behaviourProfile(slug), slug};
}

test("every species row decodes; every recipe is a template and every step a block the engine has", () => {
    assert.ok(Object.keys(ROWS).length > 2400);
    for (const [slug, row] of Object.entries(ROWS)) {
        const r = decodeRecipeRow(slug, row);
        for (const {id, weight} of r.recipes) {
            assert.ok(TEMPLATES[id], `${slug}: ${id}`);
            assert.ok(weight > 0 && weight <= 1, `${slug}: ${id} weight`);
        }
        assert.ok((ENTRY_STYLES as readonly string[]).includes(r.entry), `${slug} entry ${r.entry}`);
        assert.ok((EXIT_STYLES as readonly string[]).includes(r.exit), `${slug} exit ${r.exit}`);
        assert.ok((AFTER_STYLES as readonly string[]).includes(r.after), `${slug} after ${r.after}`);
        if (r.posture) assert.ok((POSTURES as readonly string[]).includes(r.posture), `${slug} posture`);
        assert.ok(r.sex.maleShare >= 0 && r.sex.maleShare <= 1);
        for (const m of [...r.mating, ...r.nesting]) assert.ok(m >= 1 && m <= 12);
    }
    for (const t of Object.values(TEMPLATES)) {
        for (const step of [...t.steps, ...(t.tail ?? [])]) assert.ok(BLOCKS[step.b], `${t.id}: ${step.b}`);
        if (t.loop !== undefined) assert.ok(t.loop >= 0 && t.loop < t.steps.length, t.id);
    }
});

test("every block has its named states (for the rig player) and a beat to fall back to far away", () => {
    for (const b of Object.values(BLOCKS)) {
        assert.ok(b.states.length >= 1, b.id);
        assert.ok(b.beat, b.id);
        if (b.motion === "travel") assert.ok(b.curve, b.id);
    }
    assert.ok(ARK_RECIPE_STATES.length >= 50);
});

test("behaviour-only catches are ambient creatures only: never a catalogue animal", () => {
    for (const t of Object.values(TEMPLATES)) for (const step of [...t.steps, ...(t.tail ?? [])]) if (step.catch) assert.ok(AMBIENT.includes(step.catch), `${t.id} catches ${step.catch}`);
    // Nothing a template can catch is a catalogue species' slug.
    for (const kind of AMBIENT) assert.ok(!(kind in ROWS), kind);
});

test("every recipe keeps its source: a stored phrase, a taxon rule, or a flagged body-plan default", () => {
    const species = (full as {species: Array<{slug: string; excluded: string | null; recipes: Array<{id: string; src: Record<string, string>}>; defaults: string[]}>}).species;
    let phrases = 0;
    for (const s of species) {
        for (const r of s.recipes) {
            const src = r.src;
            assert.ok(src.phrase || src.rule || src.default, `${s.slug} ${r.id}`);
            if (src.phrase) {
                phrases++;
                // Whole words: the clipper never cuts into a word at either end.
                assert.ok(/^[\p{L}\p{N}"“'(‘]/u.test(src.phrase), `${s.slug} ${r.id}: "${src.phrase.slice(0, 30)}"`);
            }
            if (src.default) assert.ok(s.defaults.includes(r.id), `${s.slug}: default ${r.id} is flagged`);
        }
    }
    assert.ok(phrases > 2000);
});

test("seeded sex: the stored ratio, a size that keeps the species' mean, none for a hermaphrodite", () => {
    const ids = Array.from({length: 4000}, (_, i) => `animal-${i}`);
    const males = ids.filter((id) => sexLook(id, "red-deer").sex === "male").length / ids.length;
    assert.ok(males > 0.46 && males < 0.54, `red deer males ${males}`);
    assert.equal(sexLook("x", "acorn-barnacle").sex, null);
    const workers = Object.keys(ROWS).find((slug) => speciesRecipes(slug).sex.system === "workers")!;
    assert.ok(ids.filter((id) => sexLook(id, workers).sex === "male").length / ids.length < 0.05, workers);
    // Stags bigger than hinds, the mean drawn size unchanged.
    const deer = ids.slice(0, 1000).map((id) => sexLook(id, "red-deer"));
    assert.ok(deer.filter((d) => d.sex === "male").every((d) => d.scale > 1) && deer.filter((d) => d.sex === "female").every((d) => d.scale < 1));
    const logMean = deer.reduce((s, d) => s + Math.log(d.scale), 0) / deer.length;
    assert.ok(Math.abs(logMean) < 0.02, `${logMean}`);
    // The same id is the same sex every time.
    assert.deepEqual(sexLook("animal-7", "mallard"), sexLook("animal-7", "mallard"));
});

/** A kingfisher by the lake, and a day of its slots. */
function kingfisherDay() {
    const k = animal("kingfisher-1", "common-kingfisher", {x: -70, z: 22}, 0.17);
    const day = Math.floor(Date.UTC(2026, 6, 14, 6) / 1000);
    const trips = [];
    for (let t = day; t < day + 12 * 3600; t += SLOT_SECONDS) trips.push(tripAt(world, k.profile, k.animal, t, hoursAt, "diurnal"));
    return {k, trips};
}

test("a kingfisher fishes from a perch by the water: a steep dive under the surface, then back to its perch", () => {
    forgetRecipes();
    const {trips} = kingfisherDay();
    const fishing = trips.filter((t) => t.recipe === "perch_plunge");
    assert.ok(fishing.length >= 5, `fishing slots ${fishing.length} of ${trips.length}`);
    let dives = 0;
    for (const trip of fishing) {
        const episode = tripEpisode(world, trip);
        if (!episode) continue;
        const dive = episode.keys.find((k) => k.block.id === "dive_air");
        if (!dive) continue;
        dives++;
        // Under the surface at the end of the dive, nose down, from the air; back at its perch when the episode ends.
        const at = poseOnTrip(world, trip, dive.t1 + 0.02) as RecipePose;
        assert.ok(at.y < 0, `under at ${at.y}`);
        const down = poseOnTrip(world, trip, dive.t1 - 0.05) as RecipePose;
        assert.ok(down.act && down.act.pitch > 1, `nose down ${down.act?.pitch}`);
        const mid = poseOnTrip(world, trip, (dive.t0 + dive.t1) / 2) as RecipePose;
        assert.ok(mid.aloft, "in the air on the way down");
        const end = poseOnTrip(world, trip, episode.t1 + 0.01);
        const base = basePoseOnTrip(world, trip, episode.t1 + 0.01);
        assert.ok(Math.hypot(end.x - base.x, end.y - base.y, end.z - base.z) < 1e-6, "back in its schedule's pose");
        assert.ok(Math.hypot(trip.to.x - base.x, trip.to.z - base.z) < 1e-6, "on its perch");
        assert.ok(world.sampler.heightAt(dive.to.x, dive.to.z) < -0.25, "into open water");
    }
    assert.ok(dives >= 5, `dives ${dives}`);
});

test("episodes are deterministic and continuous: the same poses from a fresh world, no jumps between frames", () => {
    forgetRecipes();
    const a = kingfisherDay();
    const trip = a.trips.find((t) => t.recipe === "perch_plunge")!;
    const samples: RecipePose[] = [];
    for (let t = trip.start; t < trip.end; t += 0.05) samples.push(poseOnTrip(world, trip, t));
    const fresh = scheduleWorld(sceneSampler());
    forgetRecipes();
    const again = tripAt(fresh, a.k.profile, a.k.animal, trip.start + 1, hoursAt, "diurnal");
    for (let i = 0, t = trip.start; t < trip.end; t += 0.05, i++) {
        const p = poseOnTrip(fresh, again, t);
        assert.ok(Math.hypot(p.x - samples[i].x, p.y - samples[i].y, p.z - samples[i].z) < 1e-9, `t=${t}`);
    }
    // Frame to frame (20 fps) it never moves further than a fast dive could.
    for (let i = 1; i < samples.length; i++) {
        const step = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y, samples[i].z - samples[i - 1].z);
        assert.ok(step < 1.4, `step ${step.toFixed(2)} m at ${i}`);
    }
});

test("stags in the rut meet, face each other and clash antlers; both run one timeline", () => {
    forgetRecipes();
    // Two stags on the grassland, 14 m apart; a hind for the courtship pairing.
    const ids = Array.from({length: 60}, (_, i) => `deer-${i}`);
    const stags = ids.filter((id) => sexLook(id, "red-deer").sex === "male").slice(0, 2);
    assert.equal(stags.length, 2);
    const a = animal(stags[0], "red-deer", {x: 36, z: -12}, 2);
    const b = animal(stags[1], "red-deer", {x: 46, z: -4}, 2);
    a.animal.zone = b.animal.zone = "grassland";
    wireRecipes([a, b]);
    assert.ok(pairLinksOf(a.animal).some((l) => l.template === "antler_clash" && l.other === b.animal.id));
    // October dawns and dusks: find a window where they fight.
    let fights = 0;
    const start = Math.floor(Date.UTC(2026, 9, 3) / 1000);
    for (let t = start; t < start + 3 * 86400 && fights < 3; t += 2) {
        const ta = tripAt(world, a.profile, a.animal, t, hoursAt, "crepuscular");
        const tb = tripAt(world, b.profile, b.animal, t, hoursAt, "crepuscular");
        const pa = poseOnTrip(world, ta, t) as RecipePose;
        const pb = poseOnTrip(world, tb, t) as RecipePose;
        if (pa.act?.block === "fight" && pb.act?.block === "fight") {
            fights++;
            const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
            assert.ok(d < 2.2, `apart ${d.toFixed(2)} m while fighting`);
            const facing = Math.abs(Math.atan2(Math.sin(pa.yaw - pb.yaw), Math.cos(pa.yaw - pb.yaw)));
            assert.ok(facing > 2.4, `head to head (${facing.toFixed(2)} rad)`);
            t += PAIR_PERIOD / 2;
        }
    }
    assert.ok(fights >= 2, `fights ${fights}`);
});

test("a nest grows over the first days of its season and is gone after it", () => {
    const slug = Object.keys(ROWS).find((s) => speciesRecipes(s).nest && speciesRecipes(s).nesting.length && speciesRecipes(s).recipes.some((r) => r.id === "nest_build"))!;
    const months = speciesRecipes(slug).nesting;
    const year = 2026;
    const first = Date.UTC(year, months[0] - 1, 1) / 1000;
    assert.equal(nestStageAt(slug, first - 86400 * 40 * (months.length < 12 ? 1 : 0)) <= 1, true);
    const stages = [0, 1, 2, 3, 4, 5, 6].map((d) => nestStageAt(slug, first + d * 86400 + 3600));
    for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], `${slug} ${stages}`);
    assert.ok(stages[0] < 0.1 && stages[6] === 1, `${slug} ${stages}`);
    const outside = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !months.includes(m));
    if (outside) assert.equal(nestStageAt(slug, Date.UTC(year, outside - 1, 15) / 1000), 0);
});

test("starlings at dusk: a murmuration over the roost, each bird its own place in it", () => {
    const centre = {x: 0, y: 2, z: 0};
    const t = Math.floor(Date.UTC(2026, 10, 11, 17, 50) / 1000);
    const points = Array.from({length: 200}, (_, i) => murmurationPoint(centre, 77, i, t));
    for (const p of points) assert.ok(p.y > centre.y + 4 && p.y < centre.y + 40 && Number.isFinite(p.x));
    const spread = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    assert.ok(spread > 10 && spread < 80, `spread ${spread}`);
    // It moves smoothly: a tenth of a second on, no bird has jumped.
    for (let i = 0; i < 50; i++) {
        const a = murmurationPoint(centre, 77, i, t);
        const b = murmurationPoint(centre, 77, i, t + 0.1);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 2.5);
    }
    assert.ok(MURMURATION_HOURS[0] > 17 && MURMURATION_HOURS[1] < 19);
});

test("turned off, the schedule's own pose stands", () => {
    const {trips} = kingfisherDay();
    const trip = trips.find((t) => t.recipe === "perch_plunge")!;
    setRecipesEnabled(false);
    try {
        const t = (trip.arrive + trip.end) / 2;
        const p = poseOnTrip(world, trip, t);
        const base = basePoseOnTrip(world, trip, t);
        assert.deepEqual({x: p.x, y: p.y, z: p.z}, {x: base.x, y: base.y, z: base.z});
    } finally {
        setRecipesEnabled(true);
    }
});

test("house starlings (off the schedule) fly their flock's murmuration over their spot at dusk, and only then", () => {
    const ground = () => 1;
    const t = Math.floor(Date.UTC(2026, 10, 11, 17, 50) / 1000);
    const a = microMurmuration("starling-a", "european-starling", {x: 10, y: 1, z: 12}, t, 17.85, ground);
    const b = microMurmuration("starling-b", "european-starling", {x: 13, y: 1, z: 9}, t, 17.85, ground);
    assert.ok(a && b);
    assert.deepEqual(a!.act.flock!.centre, b!.act.flock!.centre, "one flock for the starlings at one spot");
    assert.ok(a!.y > 5 && b!.y > 5, "up in it");
    assert.ok(Math.hypot(a!.x - b!.x, a!.y - b!.y, a!.z - b!.z) > 0.1, "each its own place");
    assert.equal(microMurmuration("starling-a", "european-starling", {x: 10, y: 1, z: 12}, t, 12, ground), null, "not at noon");
    assert.equal(microMurmuration("sparrow", "house-sparrow", {x: 10, y: 1, z: 12}, t, 17.85, ground), null, "not a species without it");
});
