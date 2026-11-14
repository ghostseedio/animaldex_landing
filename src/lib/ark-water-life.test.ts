import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {breathRhythm, patrolRule, rhythmBreath, shoreSide, waterLife, type ArkWaterLife} from "@/ark-scene/water-life";
import {patrolLength, patrolRoute} from "@/ark-scene/water-patrol";
import table from "@/ark-scene/behaviours.json";
import {restingAtRoost, roostOf, scheduleWorld, sleepsAfloat, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {scheduleRoost} from "@/ark-scene/map/place";
import {validatorAnimals} from "@/ark-scene/map/validate";
import {placeAnimals} from "@/ark-scene/placement";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";

const life = (slug: string) => waterLife(slug, behaviourProfile(slug));

test("water life: each kind's way of life in the water, from its family or its profile", () => {
    const want: Array<[string, ArkWaterLife | null]> = [
        ["european-pilchard", "cruiser"], ["bluefin-tuna", "cruiser"], ["atlantic-mackerel", "cruiser"], ["great-white-shark", "cruiser"], ["giant-oceanic-manta-ray", "cruiser"],
        ["orca", "cetacean"], ["humpback-whale", "cetacean"], ["dugong", "sirenian"],
        ["european-perch", "rover"], ["neon-tetra", "rover"],
        ["northern-pike", "ambush"], ["giant-grouper", "ambush"], ["reef-stonefish", "ambush"], ["monkfish", "ambush"],
        ["blue-green-chromis", "reef"], ["common-seahorse", "reef"], ["blue-parrotfish", "reef"],
        ["european-plaice", "bottom"], ["common-stingray", "bottom"], ["nurse-shark", "bottom"],
        ["moon-jellyfish", "drifter"], ["giant-squid", "jet"], ["common-octopus", "den"],
        ["american-lobster", "walker"], ["blue-linckia-sea-star", "walker"],
        ["harbor-seal", "seal"], ["green-sea-turtle", "seaturtle"], ["american-crocodile", "croc"], ["red-eared-slider", "terrapin"],
        ["common-hippopotamus", "hippo"], ["european-otter", "otter"], ["north-american-beaver", "beaver"], ["capybara", "wallower"],
        ["wild-boar", "dipper"], ["axolotl", "aquatic"], ["whirligig-beetle", "skater"],
        // Not of the water: a land animal that does not swim, and the waterbirds (lane MA3's rules are theirs).
        ["lion", null], ["mallard", null], ["eurasian-coot", null], ["common-frog", null]
    ];
    const wrong = want.filter(([slug, expected]) => life(slug) !== expected).map(([slug, expected]) => `${slug}: ${life(slug)} (want ${expected})`);
    assert.deepEqual(wrong, []);
});

test("water life: the never-stop swimmers swim all slot (and have a slower pace for sleep); an ambusher and the animals of the shore have no patrol", () => {
    for (const slug of ["european-pilchard", "bluefin-tuna", "great-white-shark", "orca"]) {
        const rule = patrolRule(life(slug));
        assert.ok(rule && rule.share[0] === 1 && rule.asleep! > 0 && rule.asleep! < rule.pace, `${slug}: all slot, slower asleep`);
    }
    for (const slug of ["european-perch", "blue-green-chromis", "european-plaice", "green-sea-turtle"]) {
        const rule = patrolRule(life(slug));
        assert.ok(rule && rule.share[1] < 1 && rule.asleep === undefined, `${slug}: part of a slot, and it sleeps where it sleeps`);
    }
    for (const slug of ["northern-pike", "american-crocodile", "common-octopus", "wild-boar"]) assert.equal(patrolRule(life(slug)), null, slug);
});

test("breath rhythm: a dolphin rolls up about every half minute, a great whale blows a few times and dives for minutes, a seal bottles", () => {
    const breaths = (slug: string, length: number, seed: number, seconds: number) => {
        const rhythm = breathRhythm(life(slug), length, seed)!;
        const ups: number[] = [];
        let up = false;
        let high = 0;
        let most = 0;
        for (let t = 0; t < seconds; t += 0.25) {
            const b = rhythmBreath(rhythm, seed, t);
            most = Math.max(most, b);
            assert.ok(b >= 0 && b <= 1);
            if (b > 0.5) high += 0.25;
            if (b > 0.5 && !up) ups.push(t);
            up = b > 0.5;
        }
        const gaps = ups.slice(1).map((t, i) => t - ups[i]).sort((a, b) => a - b);
        return {rhythm, count: ups.length, gaps, share: high / seconds, most};
    };
    for (const seed of [0.07, 0.31, 0.5, 0.83]) {
        // A dolphin (2.5 m): every 20 to 45 s, a second or two at the surface each.
        const dolphin = breaths("spinner-dolphin", 2, seed, 3600);
        assert.ok(dolphin.gaps[0] >= 20 && dolphin.gaps[dolphin.gaps.length - 1] <= 45, `dolphin gaps ${dolphin.gaps[0]}-${dolphin.gaps[dolphin.gaps.length - 1]} s`);
        assert.ok(dolphin.share > 0.02 && dolphin.share < 0.12 && dolphin.most === 1, `dolphin at the surface ${dolphin.share}`);
        // A humpback (13 m): 3 to 5 blows 14 to 18 s apart, then under for 5 to 8 minutes.
        const whale = breaths("humpback-whale", 13, seed, 7200);
        assert.ok(whale.rhythm.blows >= 3 && whale.rhythm.blows <= 5, `blows ${whale.rhythm.blows}`);
        const short = whale.gaps.filter((g) => g < 30);
        const long = whale.gaps.filter((g) => g >= 30);
        assert.ok(short.length > long.length && short.every((g) => g >= 13 && g <= 19), "blows a quarter of a minute apart");
        assert.ok(long.length > 0 && long.every((g) => g >= 300 && g <= 600), `dives ${long[0]}-${long[long.length - 1]} s`);
        // A seal at sea: under for 2 to 4 minutes, then half a minute at the surface.
        const seal = breaths("harbor-seal", 1.6, seed, 7200);
        assert.ok(seal.gaps[0] >= 140 && seal.gaps[seal.gaps.length - 1] <= 300, `seal gaps ${seal.gaps[0]}-${seal.gaps[seal.gaps.length - 1]}`);
        assert.ok(seal.share > 0.08 && seal.share < 0.3, `seal at the surface ${seal.share}`);
        // A sea turtle: every 3 to 6 minutes.
        const turtle = breaths("green-sea-turtle", 1, seed, 7200);
        assert.ok(turtle.gaps[0] >= 180 && turtle.gaps[turtle.gaps.length - 1] <= 360, `turtle gaps ${turtle.gaps[0]}`);
    }
    // A penguin, a fish and a crocodile keep the old rules (the breathe trip, none, afloat).
    for (const slug of ["emperor-penguin", "european-perch", "american-crocodile"]) assert.equal(breathRhythm(life(slug), 1, 0.5), null, slug);
});

test("the shore: each animal keeps to one side of the water's edge for a bout, not a slot", () => {
    const DAY = Date.UTC(2026, 10, 12) / 1000;
    const day = (kind: ArkWaterLife, id: string) => {
        let changes = 0;
        let water = 0;
        let was: string | null = null;
        const byHour: string[] = [];
        // (Every 80 s, a slot, through an island day: the hour from the same clock.)
        for (let t = 0; t < 86400; t += 80) {
            const side = shoreSide(kind, id, (t / 3600) % 24, DAY + t)!;
            if (was && side !== was) changes++;
            if (side === "water") water++;
            if (t % 3600 === 0) byHour.push(side);
            was = side;
        }
        return {changes, water: water / (86400 / 80), byHour};
    };
    const ids = Array.from({length: 40}, (_, i) => `shore-animal-${i}`);
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    // A seal: at most 8 changes a day (3-hour bouts), about half its day at sea.
    const seals = ids.map((id) => day("seal", id));
    assert.ok(seals.every((d) => d.changes <= 8), `seal changes ${Math.max(...seals.map((d) => d.changes))}`);
    assert.ok(mean(seals.map((d) => d.water)) > 0.4 && mean(seals.map((d) => d.water)) < 0.75, `seals at sea ${mean(seals.map((d) => d.water))}`);
    // A crocodile: in the water at least three quarters of the day, on its bank in the morning, at most 4 changes.
    const crocs = ids.map((id) => day("croc", id));
    assert.ok(crocs.every((d) => d.water >= 0.75 && d.changes <= 4 && d.byHour[9] === "land" && d.byHour[0] === "water" && d.byHour[20] === "water"));
    // A hippo: in the water by day, ashore by night, two changes.
    const hippos = ids.map((id) => day("hippo", id));
    assert.ok(hippos.every((d) => d.changes === 2 && d.byHour[12] === "water" && d.byHour[0] === "land" && d.byHour[22] === "land"));
    // A terrapin: out only while the sun is up, in the water all night.
    const terrapins = ids.map((id) => day("terrapin", id));
    assert.ok(terrapins.every((d) => d.byHour[2] === "water" && d.byHour[22] === "water" && d.changes <= 10 && d.water >= 0.6));
    // A land animal that swims: in a few times a day, under a tenth of the day.
    const dippers = ids.map((id) => day("dipper", id));
    assert.ok(mean(dippers.map((d) => d.water)) < 0.08 && mean(dippers.map((d) => d.changes)) < 16, `dippers ${mean(dippers.map((d) => d.water))}, ${mean(dippers.map((d) => d.changes))} changes`);
    // A whirligig, a sea turtle and an axolotl never leave the water; a fish has no side.
    for (const kind of ["skater", "seaturtle", "aquatic"] as const) assert.ok(day(kind, "one").water === 1);
    assert.equal(shoreSide("rover", "one", 12, DAY), null);
    assert.equal(shoreSide(null, "one", 12, DAY), null);
    // Not all of a colony at once: at 9 in the morning some seals are hauled out and some at sea.
    const at9 = new Set(seals.map((d) => d.byHour[9]));
    assert.equal(at9.size, 2);
});

test("patrol route: as long as asked, over water all the way, off the way it faces and in on the heading it leaves by, its corners rounded", () => {
    let seed = 12345;
    const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
    // Open water, and a round lake 20 m across.
    const open = () => true;
    const lake = (x: number, z: number) => Math.hypot(x, z) < 10;
    const astray = [0, 0];
    for (const [wet, radius] of [[open, 20], [lake, 9]] as Array<[(x: number, z: number) => boolean, number]>) {
        for (let n = 0; n < 40; n++) {
            const from = {x: (random() - 0.5) * 8, z: (random() - 0.5) * 8};
            const to = {x: (random() - 0.5) * 8, z: (random() - 0.5) * 8};
            const fromYaw = random() * Math.PI * 2;
            const toYaw = random() * Math.PI * 2;
            const length = 30 + random() * 60;
            const path = patrolRoute({from, to, fromYaw, toYaw, centre: {x: 0, z: 0}, radius, length, body: 0.5, turn: n % 2 ? 1 : -1, random, wet});
            assert.ok(path, "a patrol is found");
            assert.deepEqual(path![0], from);
            assert.deepEqual(path![path!.length - 1], to);
            const total = patrolLength(path!);
            // (About as long as asked: from three quarters of it, where its round ends early behind its goal, to half as
            // much again, where it goes on to get there.)
            assert.ok(total >= length * 0.6 && total <= length * 1.75, `length ${total.toFixed(1)} of ${length.toFixed(1)}`);
            assert.ok(path!.every((p) => wet(p.x, p.z)), "over water");
            // It sets off the way it faces (its first step turns at most what a step may), and it comes in on the
            // heading it leaves by where its water has room for the run in.
            const off = Math.atan2(path![1].x - from.x, path![1].z - from.z);
            const end = Math.atan2(to.x - path![path!.length - 2].x, to.z - path![path!.length - 2].z);
            const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
            assert.ok(turn(off, fromYaw) < 0.41, "off the way it faces");
            if (turn(end, toYaw) > 0.3) astray[wet === open ? 0 : 1]++;
            // Rounded: the sharpest corner between two runs of the path.
            let sharpest = 0;
            for (let i = 1; i + 1 < path!.length; i++) sharpest = Math.max(sharpest, turn(Math.atan2(path![i + 1].x - path![i].x, path![i + 1].z - path![i].z), Math.atan2(path![i].x - path![i - 1].x, path![i].z - path![i - 1].z)));
            // (Swum with a turning circle: 0.4 rad a step at most, a little more where its last steps are eased onto its goal.)
            assert.ok(sharpest < 0.7, `sharpest corner ${sharpest.toFixed(2)} rad`);
        }
    }
    // (Measured: none of 40 in open water and 12 of 40 round a 20 m lake, several laps of it, come in more than 0.3 rad
    // off their heading, where the water behind the goal is too short for the run in. Not more.)
    assert.ok(astray[0] <= 2 && astray[1] <= 15, `patrols that come in off their heading: ${astray[0]} of 40 in open water, ${astray[1]} of 40 in a lake`);
    // No room (a puddle): no patrol; a way already as long as asked: none either.
    assert.equal(patrolRoute({from: {x: 0, z: 0}, to: {x: 0.5, z: 0}, fromYaw: 0, toYaw: 0, centre: {x: 0, z: 0}, radius: 5, length: 20, body: 0.3, turn: 1, random, wet: (x, z) => Math.hypot(x, z) < 0.2}), null);
    assert.equal(patrolRoute({from: {x: 0, z: 0}, to: {x: 10, z: 0}, fromYaw: null, toYaw: null, centre: {x: 5, z: 0}, radius: 8, length: 10.5, body: 0.3, turn: 1, random, wet: open}), null);
});

test("the ones that sleep afloat: their profile keeps their text's roost (the map and the server place their homes by it); they sleep in the water by rule, in sight", () => {
    // (The water lane wrote the roost "water" into these 24 profiles: the map then placed them as animals with no den,
    // and a siamese crocodile's home was 27 m from the server's positions module's: `ark-positions.test.ts`.)
    const afloat = Object.keys((table as {species: Record<string, string>}).species).filter((slug) => sleepsAfloat(behaviourProfile(slug)));
    assert.equal(afloat.length, 24, afloat.join(", "));
    for (const slug of afloat) assert.notEqual(behaviourProfile(slug).roost, "water", `${slug}: its roost is its text's, not the water`);
    for (const slug of ["nile-monitor", "european-otter", "capybara", "red-eared-slider", "harbor-seal", "common-frog"]) assert.equal(sleepsAfloat(behaviourProfile(slug)), false, slug);
    const world = scheduleWorld(sceneSampler());
    const animals = validatorAnimals().filter((a) => afloat.includes(a.model_slug));
    const places = placeAnimals(animals);
    const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    let wet = 0;
    let dens = 0;
    for (const a of animals) {
        const p = places.get(a.id)!;
        const profile = behaviourProfile(a.model_slug);
        const den = scheduleRoost(p, a.zone);
        if (den) dens++;
        const animal: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: false, roost: den};
        const roost = roostOf(world, profile, animal);
        // (With water within 80 m of its home: in it, afloat. A home further from any water keeps its den.)
        if (world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.4, 40)) {
            assert.ok(world.nav.swimmable(roost.x, roost.z, 0.3), `${a.model_slug}: its roost at ${roost.x.toFixed(1)}, ${roost.z.toFixed(1)} is not in the water`);
            wet++;
        }
        // (Asleep there it is in sight: never "in its den", which the runtime hides.)
        for (let h = 0; h < 24; h += 3) assert.equal(restingAtRoost(world, profile, animal, Date.UTC(2026, 10, 11, h) / 1000, hoursAt, a.activity).enclosed, false, `${a.model_slug} at ${h}:00`);
    }
    assert.ok(animals.length >= 40 && wet >= animals.length * 0.9, `${wet} of ${animals.length} roost in the water`);
    assert.ok(dens > 0, "the map gives some of them a den: the schedule's rule comes first");
});
