import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/recipes.json";
import full from "../../data/ark/behaviour-recipes.json";
import {ARK_RECIPE_STATES, BLOCKS} from "@/ark-scene/behaviour-blocks";
import {AFTER_STYLES, ENTRY_STYLES, EXIT_STYLES, POSTURES, TEMPLATES, type PreyKind} from "@/ark-scene/recipe-templates";
import {coatOf as _coatOf, decodeRecipeRow, emergencePoint, forgetRecipes, microMurmuration, molehillsOf, setNestSource, sexDim, swarmFlock, swarmPoint, murmurationPoint, MURMURATION_HOURS, nestStageAt, pairLinksOf, PAIR_PERIOD, setRecipesEnabled, sexLook, speciesRecipes, wireRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile, freeBodyLengthsPerSecond} from "@/ark-scene/behaviour-profile";
import {basePoseOnTrip, poseOnTrip, recipeCoat, roostOf, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
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

test("a plunge dive never goes through the ground: a clear drop from its perch, else it hovers out over the water first", () => {
    // (The home area grew and a kingfisher's perch ended up on a bank 11 m over the lake, 5 m back: its dives went through the bank.)
    forgetRecipes();
    const day = Math.floor(Date.UTC(2026, 6, 14, 6) / 1000);
    let dives = 0;
    let hovered = 0;
    for (const [slug, length] of [["common-kingfisher", 0.17], ["osprey", 0.6]] as const) {
        for (const [hx, hz] of [[-70, 22], [-85, 5], [-55, 15], [-75, -5]]) {
            const a = animal(`plunge-${slug}-${hx}-${hz}`, slug, {x: hx, z: hz}, length);
            for (let t = day; t < day + 4 * 3600; t += SLOT_SECONDS) {
                const trip = tripAt(world, a.profile, a.animal, t, hoursAt, "diurnal");
                if (trip.recipe !== "perch_plunge" && trip.recipe !== "talon_grab") continue;
                const episode = tripEpisode(world, trip);
                const i = episode ? episode.keys.findIndex((k) => k.block.id === "dive_air" || k.block.id === "dive_feet") : -1;
                if (!episode || i < 0) continue;
                dives++;
                if (episode.keys[i - 1]?.block.id === "hover") hovered++;
                const dive = episode.keys[i];
                for (const u of [0.2, 0.4, 0.6, 0.8]) {
                    const p = poseOnTrip(world, trip, dive.t0 + (dive.t1 - dive.t0) * u) as RecipePose;
                    assert.ok(p.y > Math.max(world.sampler.heightAt(p.x, p.z), 0) + 0.05, `${slug} at ${hx},${hz}: under the ground ${u} into its dive`);
                }
                assert.ok(world.sampler.heightAt(dive.to.x, dive.to.z) < -0.25, "into open water");
            }
        }
    }
    assert.ok(dives >= 20, `dives ${dives}`);
    assert.ok(hovered >= 1, `none hovered (${dives} dives)`);
});

test("a recipe's legs go no faster than its clips carry it: a seal chases fish at its own swimming pace", () => {
    // (The release's rig check: harbour seals swam their chase at 2.1 times their clip's pace, a fixed 0.3 m/s.)
    forgetRecipes();
    const day = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
    for (const [slug, length] of [["harbor-seal", 1.6], ["emperor-penguin", 1.29], ["mallard", 0.79]] as const) {
        const a = animal(`pace-${slug}`, slug, {x: -70, z: 22}, length);
        const swim = freeBodyLengthsPerSecond(a.profile) * length * 1.4;
        let legs = 0;
        for (let start = day; start < day + 24 * 3600; start += SLOT_SECONDS) {
            const trip = tripAt(world, a.profile, a.animal, start, hoursAt, null);
            const episode = trip.recipe ? tripEpisode(world, trip) : null;
            if (!episode || episode.other) continue;
            for (const k of episode.keys) {
                if (!["swim", "dive", "surface"].includes(k.block.id) || k.toBase) continue;
                const flat = Math.hypot(k.to.x - k.from.x, k.to.z - k.from.z);
                if (flat < 0.05) continue;
                legs++;
                // Along its curve (at least the straight way) it takes at least as long as its swimming pace allows.
                assert.ok(Math.hypot(flat, k.to.y - k.from.y) / (k.t1 - k.t0) <= swim * 1.001, `${slug} ${k.block.id}: ${(Math.hypot(flat, k.to.y - k.from.y) / (k.t1 - k.t0)).toFixed(2)} m/s over ${swim.toFixed(2)}`);
            }
        }
        assert.ok(legs >= 3, `${slug}: ${legs} swimming legs`);
    }
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

test("no spinning (behaviour's rule): a chase or a forage goes on forward and turns at its own rate; nothing snaps round", () => {
    // (The owner: "animals moving in circles". Episodes snapped to every leg's heading and picked their spots anywhere
    // round the anchor, so a seal chasing fish turned 21 times a minute.)
    forgetRecipes();
    const TAU = Math.PI * 2;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const cases: Array<[string, string, number]> = [
        ["harbor-seal", "chase_fish", 1.6],
        ["mallard", "dabble", 0.58],
        ["grey-heron", "wade_spear", 0.95],
        ["atlantic-puffin", "surface_dive", 0.3],
        ["red-fox", "pounce", 0.9],
        ["meerkat", "root_dig", 0.3]
    ];
    const day = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
    for (const [slug, recipe, length] of cases) {
        const a = animal(`spin-${slug}`, slug, {x: -70, z: 22}, length);
        let episodes = 0;
        for (let start = day; start < day + 24 * 3600 && episodes < 6; start += SLOT_SECONDS) {
            const trip = tripAt(world, a.profile, a.animal, start, hoursAt, null);
            if (trip.recipe !== recipe) continue;
            const episode = tripEpisode(world, trip);
            if (!episode) continue;
            episodes++;
            let last = poseOnTrip(world, trip, episode.t0);
            const turns: number[] = [];
            for (let t = episode.t0 + 0.2; t <= episode.t1; t += 0.2) {
                const p = poseOnTrip(world, trip, t);
                const d = Math.abs(wrap(p.yaw - last.yaw));
                assert.ok(d < 0.9, `${slug} ${recipe}: snapped ${d.toFixed(2)} rad in 0.2 s (${(p as RecipePose).act?.block})`);
                turns.push(d);
                last = p;
            }
            for (let i = 0; i + 100 <= turns.length; i += 5) {
                const sum = turns.slice(i, i + 100).reduce((x, y) => x + y, 0);
                assert.ok(sum < TAU, `${slug} ${recipe}: ${(sum / TAU).toFixed(2)} full turns in 20 s`);
            }
        }
        assert.ok(episodes >= 1, `${slug}: no ${recipe} episode in a day`);
    }
});

test("on the spot the body holds still: a dig, a peck or a scrape is the head's and the clip's, not the body shuffling", () => {
    // (A foraging meerkat's way turned 22-36 times a minute: its digs shuffled its body back and forth twice a second.)
    forgetRecipes();
    const a = animal("still-meerkat", "meerkat", {x: 40, z: -60}, 0.3);
    a.animal.zone = "desert";
    const day = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
    let holds = 0;
    for (let start = day; start < day + 24 * 3600; start += SLOT_SECONDS) {
        const trip = tripAt(world, a.profile, a.animal, start, hoursAt, null);
        const episode = trip.recipe ? tripEpisode(world, trip) : null;
        if (!episode) continue;
        for (const k of episode.keys) {
            if (k.block.motion !== "hold" || k.block.id === "strike" || k.t1 - k.t0 < 1) continue;
            holds++;
            const first = poseOnTrip(world, trip, k.t0 + 0.05);
            for (let t = k.t0 + 0.3; t < k.t1 - 0.05; t += 0.25) {
                const p = poseOnTrip(world, trip, t);
                assert.ok(Math.hypot(p.x - first.x, p.z - first.z) < 1e-6, `${k.block.id} moved ${Math.hypot(p.x - first.x, p.z - first.z).toFixed(3)} m`);
            }
        }
    }
    assert.ok(holds >= 3, `holds ${holds}`);
});

test("no in-place episode turns more than once in any minute: a dabbling duck pivots, a hunting fox swings round once, nothing spins", () => {
    // (Behaviour's measure on the release: a mallard dabbling turned 44 times a minute, a puffin, a heron and a meerkat
    // over once; the facing summed over every minute of a recipe's stay, its last turn to the way it sets off included.)
    forgetRecipes();
    const TAU = Math.PI * 2;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const day = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
    const cases: Array<[string, string, number]> = [
        ["harbor-seal", "chase_fish", 1.6],
        ["mallard", "dabble", 0.58],
        ["grey-heron", "wade_spear", 0.95],
        ["atlantic-puffin", "surface_dive", 0.3],
        ["atlantic-puffin", "chase_fish", 0.3],
        ["red-fox", "pounce", 0.9],
        ["domestic-cat", "pounce", 0.45],
        ["meerkat", "root_dig", 0.3],
        ["american-alligator", "root_dig", 3.2]
    ];
    let stays = 0;
    for (const [slug, recipe, length] of cases) {
        const a = animal(`minute-${slug}-${recipe}`, slug, {x: -70, z: 22}, length);
        for (let start = day; start < day + 24 * 3600; start += SLOT_SECONDS) {
            const trip = tripAt(world, a.profile, a.animal, start, hoursAt, null);
            if (trip.recipe !== recipe || !tripEpisode(world, trip)) continue;
            stays++;
            const turns: number[] = [];
            let last = poseOnTrip(world, trip, trip.arrive + 0.5);
            for (let t = trip.arrive + 1; t < trip.end; t += 0.5) {
                const p = poseOnTrip(world, trip, t);
                turns.push(Math.abs(wrap(p.yaw - last.yaw)));
                last = p;
            }
            let sum = 0;
            for (let k = 0; k < turns.length; k++) {
                sum += turns[k] - (k >= 120 ? turns[k - 120] : 0);
                assert.ok(sum < TAU, `${slug} ${recipe}: ${(sum / TAU).toFixed(2)} turns in a minute`);
            }
        }
    }
    assert.ok(stays >= 20, `stays ${stays}`);
});

test("setting off after a recipe stay it has already turned on the spot: it holds still through its schedule's turn, never turning on the move", () => {
    forgetRecipes();
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const day = Math.floor(Date.UTC(2026, 6, 14, 0) / 1000);
    let setOffs = 0;
    for (const [slug, length] of [["harbor-seal", 1.6], ["mallard", 0.58], ["grey-heron", 0.95], ["red-fox", 0.9], ["meerkat", 0.3]] as const) {
        const a = animal(`setoff-${slug}`, slug, {x: -70, z: 22}, length);
        for (let start = day + SLOT_SECONDS; start < day + 24 * 3600; start += SLOT_SECONDS) {
            const trip = tripAt(world, a.profile, a.animal, start, hoursAt, null);
            const before = tripAt(world, a.profile, a.animal, trip.start - 0.01, hoursAt, null);
            const held = before !== trip ? tripEpisode(world, before) : null;
            if (!held || held.endYaw === undefined || held.endYaw === null) continue;
            setOffs++;
            // Through its schedule's own turn on the spot (or its first moment on its way) and just after it: no turning
            // on the move (after that, its schedule's way is behaviour's).
            const first = trip.legs[0];
            const hold = first && first.mode === "pause" && first.turn ? first.seconds : 0.85;
            const facing = poseOnTrip(world, trip, trip.start).yaw;
            for (let t = trip.start + 0.1; t < trip.start + hold; t += 0.1) assert.ok(Math.abs(wrap(poseOnTrip(world, trip, t).yaw - facing)) < 1e-6, `${slug}: turned during its set-off`);
            let last = poseOnTrip(world, trip, trip.start + hold);
            let moving = 0;
            for (let t = trip.start + hold + 0.1; t < trip.start + hold + 1.5; t += 0.1) {
                const p = poseOnTrip(world, trip, t);
                if (Math.hypot(p.x - last.x, p.z - last.z) > 0.005) moving += Math.abs(wrap(p.yaw - last.yaw));
                last = p;
            }
            assert.ok(moving < 1, `${slug}: turned ${moving.toFixed(2)} rad on its way off`);
        }
    }
    assert.ok(setOffs >= 5, `set-offs ${setOffs}`);
});

test("only real cachers cache: squirrels, jays, nutcrackers, hoarding rodents, mustelids; not a camel's fat or a wader's buried prey", () => {
    for (const slug of ["red-squirrel", "eurasian-jay", "clarks-nutcracker", "merriams-kangaroo-rat", "stoat"]) assert.ok(speciesRecipes(slug).recipes.some((r) => r.id === "cache_food"), slug);
    for (const slug of ["dromedary-camel", "african-sacred-ibis", "short-billed-dowitcher", "himalayan-monal", "black-rat", "javan-myna", "red-river-hog", "fat-tailed-dunnart"]) {
        assert.ok(!speciesRecipes(slug).recipes.some((r) => r.id === "cache_food"), slug);
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

// MARK: Round 2

test("swarms: bees round their spot by day, mayflies at dusk, bugs in a crawling cluster; ambient, pure in the time", () => {
    const at = {x: 5, y: 1, z: 5};
    const t = Math.floor(Date.UTC(2026, 5, 10, 12) / 1000);
    assert.equal(swarmFlock("bee", "asian-honey-bee", at, t, 12)?.kind, "swarm");
    assert.equal(swarmFlock("bee", "asian-honey-bee", at, t, 23), null, "not at night");
    assert.equal(swarmFlock("fly", "giant-burrowing-mayfly", at, t, 12), null, "mayflies dance at dusk");
    assert.equal(swarmFlock("fly", "giant-burrowing-mayfly", at, t, 17.8)?.kind, "swarm");
    assert.equal(swarmFlock("bug", "firebug", at, t, 12)?.kind, "cluster");
    for (let i = 0; i < 60; i++) {
        const p = swarmPoint(at, 9, i, t);
        assert.ok(Math.hypot(p.x - at.x, p.z - at.z) < 2.2 && p.y > at.y + 0.4 && p.y < at.y + 2.6, `insect ${i}`);
        assert.deepEqual(p, swarmPoint(at, 9, i, t));
        const c = swarmPoint(at, 9, i, t, true);
        assert.ok(Math.abs(c.y - at.y) < 0.02 && Math.hypot(c.x - at.x, c.z - at.z) < 0.35);
    }
});

test("bats hang under limbs by day (canopy_hang) and stream out of the roost at dusk", () => {
    const hangs = world.sampler.attachPoints("canopy_hang");
    assert.ok(hangs.length > 100, `hang points ${hangs.length}`);
    const point = hangs[Math.floor(hangs.length / 2)];
    const bat = animal("bat-1", "kuhls-pipistrelle-bat", {x: point.x + 2, z: point.z + 1}, 0.08);
    const roost = roostOf(world, bat.profile, bat.animal);
    assert.ok(roost.point && hangs.some((p) => p.id === roost.point), `roost ${roost.point}`);
    // By day it sleeps there, hanging (its posture rolls it upside down).
    const noon = Math.floor(Date.UTC(2026, 5, 10, 12) / 1000);
    const day = poseOnTrip(world, tripAt(world, bat.profile, bat.animal, noon, hoursAt, "nocturnal"), noon) as RecipePose;
    assert.ok(Math.hypot(day.x - roost.x, day.y - roost.y, day.z - roost.z) < 0.05, "at its hang point");
    assert.ok(day.act && Math.abs(day.act.pitch - Math.PI / 2) < 1e-6, "head down from its feet");
    // At dusk its roost-mates stream out (the stream is pure in the time; each bat leaves and is gone by 60 m).
    const dusk = Math.floor(Date.UTC(2026, 5, 10, 17, 50) / 1000);
    const pose = poseOnTrip(world, tripAt(world, bat.profile, bat.animal, dusk, hoursAt, "nocturnal"), dusk) as RecipePose;
    assert.equal(pose.flock?.kind, "bats");
    const out = Array.from({length: 180}, (_, i) => emergencePoint(roost, 3, i, dusk)).filter(Boolean);
    assert.ok(out.length > 30, `in the air ${out.length}`);
    for (const p of out) assert.ok(Math.hypot(p!.x - roost.x, p!.z - roost.z) < 66);
});

test("a sitter with eggs sits on its nest (the props lane's nests), awake and asleep; without eggs it goes about", () => {
    const duck = animal("duck-1", "mallard", {x: -60, z: 30}, 0.55);
    const site = {x: -58, y: Math.max(world.sampler.heightAt(-58, 31), 0), z: 31};
    let eggs = 4;
    setNestSource((id) => (id === "duck-1" ? {...site, stage: 1, eggs} : null));
    try {
        const t0 = Math.floor(Date.UTC(2026, 4, 10, 6) / 1000);
        for (let k = 0; k < 30; k++) {
            const t = t0 + k * 1777;
            const trip = tripAt(world, duck.profile, duck.animal, t, hoursAt, "diurnal");
            assert.equal(trip.recipe, "incubate_sit");
            assert.ok(Math.hypot(trip.to.x - site.x, trip.to.z - site.z) < 1e-6);
            if (t >= trip.arrive + 1) {
                const p = poseOnTrip(world, trip, t);
                assert.ok(Math.hypot(p.x - site.x, p.z - site.z) < 0.05, "on the nest");
            }
        }
        eggs = 0;
        forgetRecipes();
        const free = [0, 1, 2, 3, 4, 5].map((k) => tripAt(world, duck.profile, duck.animal, t0 + 90000 + k * 997, hoursAt, "diurnal"));
        assert.ok(free.every((trip) => trip.recipe !== "incubate_sit"));
    } finally {
        setNestSource(null);
    }
});

test("molehills appear round a mole's burrow and fade; pure, and none for other species", () => {
    const at = {x: 10, y: 0.5, z: 10};
    const t = Math.floor(Date.UTC(2026, 3, 2, 10) / 1000);
    const ground = () => 0.5;
    const hills = molehillsOf("mole-1", "star-nosed-mole", at, t, ground);
    assert.ok(hills.length >= 5 && hills.length <= 10, `hills ${hills.length}`);
    for (const h of hills) {
        assert.ok(h.kind === "mound" && h.from <= t && h.to >= t);
        assert.ok(Math.hypot(h.x - at.x, h.z - at.z) < 3.1);
    }
    assert.deepEqual(hills, molehillsOf("mole-1", "star-nosed-mole", at, t, ground));
    assert.equal(molehillsOf("rabbit", "european-rabbit", at, t, ground).length, 0);
});

test("a wallow leaves the coat muddy (wet and dusty), drying over twenty minutes", () => {
    forgetRecipes();
    const pig = animal("pig-1", "domestic-pig", {x: -66, z: 25}, 1.1);
    const t0 = Math.floor(Date.UTC(2026, 6, 14, 6) / 1000);
    let checked = 0;
    for (let t = t0; t < t0 + 14 * 3600 && checked < 2; t += SLOT_SECONDS) {
        const trip = tripAt(world, pig.profile, pig.animal, t, hoursAt, "diurnal");
        if (trip.recipe !== "wallow") continue;
        const ep = tripEpisode(world, trip);
        const key = ep?.keys.find((k) => k.block.id === "wallow");
        if (!key) continue;
        const coat = recipeCoat(world, pig.profile, pig.animal, key.t1 + 30, hoursAt, "diurnal");
        assert.ok(coat.dust > 0.6 && coat.wet > 0.15, `muddy ${JSON.stringify(coat)}`);
        // Drying: only where it has not wallowed again since.
        let again = false;
        for (let u = trip.end; u < key.t1 + 1500; u += SLOT_SECONDS) {
            const next = tripAt(world, pig.profile, pig.animal, u, hoursAt, "diurnal");
            if (next.recipe === "wallow" || tripEpisode(world, next)?.keys.some((k) => k.block.id === "wallow" || k.block.id === "dust_bathe")) again = true;
        }
        if (again) continue;
        const later = recipeCoat(world, pig.profile, pig.animal, key.t1 + 1500, hoursAt, "diurnal");
        assert.ok(later.dust < coat.dust * 0.3, `dried ${JSON.stringify(later)}`);
        checked++;
    }
    assert.ok(checked >= 1, "found a wallow");
    void _coatOf;
});

test("mixed flocks: a blue tit joins another species' flock for a while, at its side", () => {
    forgetRecipes();
    const tit = animal("tit-1", "blue-tit", {x: -40, z: -26}, 0.12);
    const flock = animal("finch-1", "european-starling", {x: -36, z: -24}, 0.2);
    wireRecipes([tit, flock]);
    const t0 = Math.floor(Date.UTC(2026, 6, 14, 9) / 1000);
    let joined = 0;
    for (let t = t0; t < t0 + 6 * 3600 && joined < 20; t += 7) {
        const p = poseOnTrip(world, tripAt(world, tit.profile, tit.animal, t, hoursAt, "diurnal"), t) as RecipePose;
        if (p.act?.recipe !== "mixed_follow" || p.act.u < 0.2 || p.act.u > 0.8) continue;
        const other = basePoseOnTrip(world, tripAt(world, flock.profile, flock.animal, t, hoursAt, "diurnal"), t);
        assert.ok(Math.hypot(p.x - other.x, p.z - other.z) < 5, `beside it (${Math.hypot(p.x - other.x, p.z - other.z).toFixed(2)} m)`);
        joined++;
    }
    assert.ok(joined >= 5, `with the flock ${joined}`);
});

test("the duller sex is drawn a little greyer (additive dim), the brighter not", () => {
    const ids = Array.from({length: 400}, (_, i) => `duck-${i}`);
    for (const id of ids) {
        const sex = sexLook(id, "mallard").sex;
        const dim = sexDim(id, "mallard");
        if (sex === "female") assert.ok(dim > 0.2 && dim <= 0.4, `${id} ${dim}`);
        else assert.equal(dim, 0);
    }
    assert.equal(sexDim("x", "acorn-barnacle"), 0);
});
