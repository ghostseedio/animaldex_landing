import assert from "node:assert/strict";
import test from "node:test";
import data from "../../data/ark/egg-dip.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {waterSurfaceOf} from "@/ark-scene/behaviour-water";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetRecipes, sexLook, speciesRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {poseOnTrip, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {DIP_RATE, DIP_RING_SECONDS, DipRipples, dipDepth, dipRing, dipsBy} from "@/ark-scene/egg-dip";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {sceneSampler} from "@/ark-scene/world-sampler";

type Row = {slug: string; name: string; quote: string; line: string; mode: string; drawn: boolean; held?: string; lineHeld?: string};
const SPECIES = (data as {species: Row[]}).species;
const ROWS = (table as {species: Record<string, string>}).species;
const LINES = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
const recipesOf = (slug: string) => (ROWS[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf(".")));

test("the dip: a quick tap once a cycle, pure in the time; its taps counted as they touch", () => {
    assert.equal(dipDepth(-1), 0);
    assert.equal(dipDepth(0), 0);
    const period = 1 / DIP_RATE;
    assert.ok(Math.abs(dipDepth(period / 2) - 1) < 1e-9, "on the water at the cycle's middle");
    assert.ok(dipDepth(period) < 1e-9, "up again");
    // Most of a cycle is spent up: under a third of it below half way down.
    let low = 0;
    let n = 0;
    for (let t = 0; t < period * 4; t += period / 400) {
        const d = dipDepth(t);
        assert.ok(d >= 0 && d <= 1);
        n++;
        if (d > 0.5) low++;
    }
    assert.ok(low / n < 0.34 && low / n > 0.15, `down ${low / n} of the time`);
    assert.equal(dipsBy(0), 0);
    assert.equal(dipsBy(period * 0.49), 0);
    assert.equal(dipsBy(period * 0.51), 1);
    assert.equal(dipsBy(period * 3.6), 4);
    assert.equal(dipDepth(1.2345), dipDepth(1.2345));
});

test("each tap leaves one ring where she is, spreading and fading; none twice, none after it is gone", () => {
    assert.equal(dipRing(-0.1, 0.05), null);
    assert.equal(dipRing(DIP_RING_SECONDS, 0.05), null);
    const young = dipRing(0.1, 0.05)!;
    const old = dipRing(1.5, 0.05)!;
    assert.ok(old.radius > young.radius * 2 && old.alpha < young.alpha && old.alpha > 0);
    assert.ok(old.radius < 0.3, "a small ring for a small body");
    const ripples = new DipRipples();
    const period = 1 / DIP_RATE;
    const at = {x: 3, y: 0.01, z: 4};
    const drawn = (now: number) => {
        const out: Array<{x: number; radius: number; alpha: number}> = [];
        ripples.each(now, (x, _y, _z, radius, alpha) => out.push({x, radius, alpha}));
        return out;
    };
    // Frame by frame through three taps of one hold.
    for (let since = 0; since <= period * 3.2; since += 1 / 60) ripples.note("a", "hold-1", since, at, 0.05, 1000 + since);
    assert.equal(ripples.size, 3);
    const rings = drawn(1000 + period * 3.2);
    assert.ok(rings.length >= 2 && rings.length <= 3 && rings.every((r) => r.x === 3));
    assert.ok(new Set(rings.map((r) => r.radius.toFixed(4))).size === rings.length, "each at its own age");
    // The same frame again adds none; the next hold starts its own count; gone after the ring's time.
    ripples.note("a", "hold-1", period * 3.2, at, 0.05, 1000 + period * 3.2);
    assert.equal(ripples.size, rings.length);
    ripples.note("a", "hold-2", period * 0.6, {x: 5, y: 0.01, z: 4}, 0.05, 1010);
    assert.ok(drawn(1010.1).some((r) => r.x === 5));
    assert.deepEqual(drawn(1010 + DIP_RING_SECONDS + 1), []);
    assert.equal(ripples.size, 0);
});

test("the data: only species whose catalogue row says the female dips her abdomen to the water; a tandem pair is held back", () => {
    assert.equal(SPECIES.length, 7);
    const drawn = SPECIES.filter((s) => s.drawn).map((s) => s.slug);
    assert.deepEqual(drawn, ["broad-bodied-chaser", "common-flangetail", "scarlet-skimmer", "wandering-glider"]);
    for (const s of SPECIES) {
        assert.match(s.quote, /abdomen|tapping the water|lay eggs in tandem/i, s.slug);
        assert.ok(s.line.startsWith("{aAnimal} ") || s.line.startsWith("{animals} "), s.slug);
        const has = recipesOf(s.slug).includes("dip_lay");
        assert.equal(has, s.drawn, `${s.slug}: dip_lay in its recipes`);
        if (s.mode === "tandem") assert.ok(!s.drawn && s.held, `${s.slug}: a pair is not drawn as one female`);
        // Its own sentence only where the recipe shows what it says.
        assert.equal(Boolean(LINES[s.slug]?.dip_lay), s.drawn && !s.lineHeld, `${s.slug}: its sentence`);
    }
    // No other species has the recipe.
    for (const slug of Object.keys(ROWS)) if (recipesOf(slug).includes("dip_lay")) assert.ok(drawn.includes(slug), slug);
    assert.equal(LINES["broad-bodied-chaser"].dip_lay, "{aAnimal} is hovering and flicking its abdomen tip into the water to lay");
});

test("the template: a female's, by day, in its breeding months, from the water's edge; its hold is the dip", () => {
    const t = TEMPLATES.dip_lay;
    assert.equal(t.sex, "female");
    assert.equal(t.hours, "day");
    assert.equal(t.season, "mating");
    assert.equal(t.goal, "edge");
    assert.deepEqual(t.steps.map((s) => s.b), ["fly", "dip_tail", "fly", "dip_tail"]);
    assert.ok(BLOCKS.dip_tail.aloft && BLOCKS.dip_tail.motion === "hold" && BLOCKS.dip_tail.rate === DIP_RATE);
    assert.ok(speciesRecipes("broad-bodied-chaser").recipes.some((r) => r.id === "dip_lay"));
    assert.ok(!speciesRecipes("common-darter").recipes.some((r) => r.id === "dip_lay"));
});

test("on the schedule: a female chaser by the water lays in her season: low over open water, her tip to the surface and never under it; a male never", () => {
    forgetRecipes();
    const world = scheduleWorld(sceneSampler());
    const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const slug = "broad-bodied-chaser";
    const length = 0.05;
    // (Model plans in the scene; the profile is the species' own.)
    const profile = behaviourProfile(slug);
    const homes = [{x: -70, z: 22}, {x: -62, z: 30}, {x: -76, z: 14}];
    const ids = Array.from({length: 40}, (_, i) => `chaser-${i}`);
    const females = ids.filter((id) => sexLook(id, slug).sex === "female");
    const males = ids.filter((id) => sexLook(id, slug).sex === "male");
    assert.ok(females.length >= 5 && males.length >= 5);
    const day = (month: number) => Math.floor(Date.UTC(2026, month, 14, 7) / 1000);
    const tripsOf = (id: string, from: number, home: {x: number; z: number}) => {
        const animal: ScheduleAnimal = {id, zone: "river_lake", home: {x: home.x, y: Math.max(world.sampler.heightAt(home.x, home.z), 0), z: home.z}, length, sea: false};
        const out = [];
        for (let t = from; t < from + 10 * 3600; t += SLOT_SECONDS) out.push(tripAt(world, profile, animal, t, hoursAt, "diurnal"));
        return out;
    };
    let holds = 0;
    let lowest = Infinity;
    let highest = -Infinity;
    let laying = 0;
    females.slice(0, 8).forEach((id, i) => {
        for (const trip of tripsOf(id, day(5), homes[i % homes.length])) {
            if (trip.recipe !== "dip_lay") continue;
            laying++;
            const episode = tripEpisode(world, trip);
            if (!episode) continue;
            for (const key of episode.keys) {
                if (key.block.id !== "dip_tail") continue;
                holds++;
                for (let t = key.t0 + 0.01; t < key.t1; t += 1 / 30) {
                    const at = poseOnTrip(world, trip, t) as RecipePose;
                    if (at.act?.block !== "dip_tail") continue;
                    const top = waterSurfaceOf(world.sampler, at.x, at.z);
                    assert.ok(world.sampler.heightAt(at.x, at.z) < top, `over water at ${at.x.toFixed(1)}, ${at.z.toFixed(1)}`);
                    lowest = Math.min(lowest, at.y - top);
                    highest = Math.max(highest, at.y - top);
                    assert.ok(at.aloft, "on the wing");
                    assert.ok(at.act.since !== undefined && at.act.since >= 0 && at.act.since <= key.t1 - key.t0 + 1e-6);
                    assert.ok(at.act.pitch < 0, "tail down");
                }
            }
        }
    });
    assert.ok(laying >= 3, `laying slots ${laying}`);
    assert.ok(holds >= 3, `dip holds ${holds}`);
    assert.ok(lowest >= 0.05 && lowest < 0.08, `her lowest: ${lowest} m over the water`);
    assert.ok(highest > lowest + 0.04 && highest < 0.6, `her hover: ${highest} m over the water`);
    // A male never lays; nor does she out of her months (the chaser's are May to August).
    for (const id of males.slice(0, 5)) assert.ok(tripsOf(id, day(5), homes[0]).every((t) => t.recipe !== "dip_lay"), `${id} (male)`);
    for (const id of females.slice(0, 5)) assert.ok(tripsOf(id, day(11), homes[0]).every((t) => t.recipe !== "dip_lay"), `${id} in December`);
});

test("at her pond (off the schedule): now and then she leaves her spot, taps the water at a few places near it and comes back; pure, over the water, never under it", async () => {
    const {MICRO_BOUT_EVERY, MICRO_BOUT_SECONDS, microDipAt} = await import("@/ark-scene/egg-dip");
    const spot = {x: 10, y: 0.02, z: -4, yaw: 0.3};
    const length = 0.05;
    // (Open water within a metre of her spot's west side only: the east is the bank.)
    const surface = (x: number, z: number) => (x <= 10.2 && Math.hypot(x - 10, z + 4) < 3 ? 0 : null);
    assert.equal(microDipAt("f1", spot, 5000, length, 0, surface), null, "out of her season: never");
    let bouts = 0;
    let windows = 0;
    for (let w = 0; w < 400; w++) {
        const id = `f${w % 7}`;
        const from = w * MICRO_BOUT_EVERY + 100000;
        let laid = false;
        let taps = 0;
        let lastDepth = Infinity;
        const stations = new Set<number>();
        let first: ReturnType<typeof microDipAt> = null;
        let last: ReturnType<typeof microDipAt> = null;
        for (let t = from; t < from + MICRO_BOUT_EVERY; t += 1 / 30) {
            const at = microDipAt(id, spot, t, length, 0.5, surface);
            if (!at) continue;
            laid = true;
            first ??= at;
            last = at;
            // (The water is at 0 here; her spot a little over it.)
            assert.ok(at.y >= 0.005, `over the water: ${at.y}`);
            assert.ok(at.y < 0.2, "low");
            assert.ok(Math.hypot(at.x - spot.x, at.z - spot.z) <= 1.4 + 1e-9, "near her spot");
            if (at.block === "dip_tail") {
                assert.notEqual(surface(at.x, at.z), null, "she lays over open water");
                stations.add(at.station);
                const depth = dipDepth(at.since);
                if (depth > 0.9 && lastDepth <= 0.9) taps++;
                lastDepth = depth;
                assert.ok(at.pitch < -0.3, "tail down");
            }
            assert.deepEqual(microDipAt(id, spot, t, length, 0.5, surface), at);
        }
        windows++;
        if (!laid) continue;
        bouts++;
        assert.equal(stations.size, 4);
        assert.equal(taps, 12, "three taps at each of four places");
        // She leaves from her spot and is back on it at the end.
        assert.ok(Math.hypot(first!.x - spot.x, first!.z - spot.z) < 0.1 && Math.abs(first!.y - spot.y) < 0.03);
        assert.ok(Math.hypot(last!.x - spot.x, last!.z - spot.z) < 0.02 && Math.abs(last!.y - spot.y) < 0.01);
    }
    assert.ok(bouts / windows > 0.38 && bouts / windows < 0.62, `she lays in ${bouts} of ${windows} windows at chance 0.5`);
    assert.ok(MICRO_BOUT_SECONDS < MICRO_BOUT_EVERY / 4, "most of her time on her spot");
});
