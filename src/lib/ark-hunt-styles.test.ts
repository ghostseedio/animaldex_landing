/**
 * How a due predator hunts on its forays (behaviours pass 2026-11, lane B1; docs/ark/behaviour-pass-2026-11/hunt.md):
 * each kind its own way of searching, at its own pace, at the server's waypoint at every step, with no jump or sprint
 * into a hunt or out of one. `src/ark-scene/hunting.ts`.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {ENCOUNTER_AGREE} from "@/ark-scene/acts";
import {HUNT_STATION_AGREE, HUNT_STEP_SECONDS, HUNT_WAIT_AGREE, HuntingLayer, LEAD_STEPS, huntBody, huntProgress, huntStyle, huntsTogether, type HuntPose, type HuntStyle} from "@/ark-scene/hunting";
import {ARK_DAY_MS, decodeAtlas, forayAt, homeOf, sheetOf, type Home} from "@/ark-scene/positions/positions";
import type {ArkAnimal} from "@/ark-scene/types";

const atlas = decodeAtlas(JSON.parse(readFileSync(join(process.cwd(), "src/ark-scene/positions/atlas.json"), "utf8")));
const START = Date.parse("2026-11-08T21:45:21.431Z");
const epochAt = (step: number) => (START + (step / 96) * ARK_DAY_MS) / 1000;
const ground = () => 0.5;
const sched = (x = 0, z = 0) => (): HuntPose => ({x, y: 0.5, z, yaw: 0, moving: false, aloft: false, nx: 0, ny: 1, nz: 0, beat: "rest", doing: "rest"});

function animalOf(slug: string, n = 0): {animal: ArkAnimal; home: Home} {
    const isl = atlas.islands.wild;
    const zone = atlas.zones[isl.species[slug][1]] as ArkAnimal["zone"];
    for (let slot = 3; slot < 40; slot++) {
        const animal: ArkAnimal = {id: `00000000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, species_profile_id: "00000000-0000-4000-8000-0000000000bb", name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot, slot_rank: 0, activity: "any"};
        const home = homeOf(atlas, {zone, slug, speciesId: animal.species_profile_id, slot, rank: 0});
        if (home) return {animal, home};
    }
    throw new Error(`no home for ${slug}`);
}
function layerFor(animals: ArkAnimal[], from = 0): HuntingLayer {
    const layer = new HuntingLayer();
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map(animals.map((a) => [a.id, from])), meals: []}, atlas, START);
    return layer;
}

const STYLES: Record<string, HuntStyle> = {
    "african-lion": "stalk",
    "sumatran-tiger": "stalk",
    "pine-marten": "stalk",
    "eurasian-wolf": "course",
    "spotted-hyena": "course",
    "saltwater-crocodile": "wait",
    "reticulated-python": "wait",
    "american-bullfrog": "wait",
    "veiled-chameleon": "wait",
    "wild-boar": "forage",
    "greylag-goose": "forage",
    "hamadryas-baboon": "forage",
    "common-buzzard": "soar",
    "osprey": "soar",
    "turkey-vulture": "soar",
    "common-kingfisher": "perch",
    "brown-shrike": "perch",
    "scarlet-skimmer": "perch",
    "wandering-glider": "hawk",
    "european-robin": "glean",
    "great-cormorant": "glean",
    "glossy-ibis": "glean",
    "great-egret": "wade",
    "great-blue-heron": "wade",
    "northern-pike": "lurk",
    "bull-shark": "cruise",
    "neon-tetra": "forage"
};

test("hunt styles: each kind searches its own way, by rule", () => {
    for (const [slug, style] of Object.entries(STYLES)) assert.equal(huntStyle(slug, sheetOf(atlas, slug)!), style, slug);
    // Every species of the atlas has one, and the catalogue's predators are not all one kind.
    const count: Partial<Record<HuntStyle, number>> = {};
    for (const slug of Object.keys(atlas.islands.wild.species)) {
        const style = huntStyle(slug, sheetOf(atlas, slug)!);
        count[style] = (count[style] ?? 0) + 1;
    }
    for (const style of ["wait", "stalk", "forage", "course", "lurk", "cruise", "soar", "quarter", "hawk", "perch", "wade", "glean"] as HuntStyle[]) assert.ok((count[style] ?? 0) > 0, `${style}: ${count[style] ?? 0} species`);
    // Who goes along with a hunting leader: the social hunters and foragers on foot.
    assert.ok(huntsTogether("eurasian-wolf", "course") && huntsTogether("african-lion", "stalk") && huntsTogether("smooth-coated-otter", "stalk"));
    assert.ok(!huntsTogether("sumatran-tiger", "stalk") && !huntsTogether("saltwater-crocodile", "wait") && !huntsTogether("common-buzzard", "soar"));
});

test("the encounter's agreement: at every step's moment it is at the server's waypoint (one that waits or perches, within HUNT_STATION_AGREE)", () => {
    assert.ok(HUNT_STATION_AGREE < ENCOUNTER_AGREE - 1.5 && HUNT_WAIT_AGREE <= ENCOUNTER_AGREE - 0.8, "room for the collisions' easing inside the chase's 5 m");
    let n = 0;
    for (const slug of Object.keys(STYLES)) {
        const {animal, home} = animalOf(slug, n++);
        const layer = layerFor([animal]);
        const style = STYLES[slug];
        let worst = 0;
        for (let k = 9000; k < 9200; k++) {
            const way = forayAt(atlas, home, animal.id, k);
            for (const at of [epochAt(k) + 1e-6, epochAt(k) - 1e-6]) {
                const pose = layer.pose(animal, at, home.sheet.len, ground, sched())!;
                worst = Math.max(worst, Math.hypot(pose.x - way.x, pose.z - way.z));
            }
        }
        // (One that waits holds its waiting place; a bird that comes down between flights does so where it can stand.)
        // (One that waits, or is too slow for its foray, keeps within HUNT_WAIT_AGREE on its home's side of the waypoint.)
        const pulls = huntBody(animal, home.sheet, home.sheet.len).pulls;
        const near = (style === "perch" || style === "wade" || style === "glean") && home.sheet.flies;
        assert.equal(pulls, style === "wait" || style === "lurk", `${slug}: none of these others is too slow for its foray`);
        assert.ok(worst <= (pulls ? HUNT_WAIT_AGREE + 1e-6 : near ? HUNT_STATION_AGREE + 1e-6 : 0.02), `${slug} (${style}): ${worst.toFixed(3)} m off its waypoint`);
    }
});

/** Its poses through whole hunting steps, every `dt` seconds. */
function walk(slug: string, steps: number, dt: number, n = 0) {
    const {animal, home} = animalOf(slug, n);
    const layer = layerFor([animal]);
    const body = huntBody(animal, home.sheet, home.sheet.len);
    const poses: HuntPose[] = [];
    for (let t = epochAt(9000); t < epochAt(9000 + steps); t += dt) poses.push(layer.pose(animal, t, home.sheet.len, ground, sched())!);
    const speeds: number[] = [];
    let moving = 0;
    let turnMost = 0;
    let jump = 0;
    for (let i = 1; i < poses.length; i++) {
        const v = Math.hypot(poses[i].x - poses[i - 1].x, poses[i].z - poses[i - 1].z) / dt;
        if (v > Math.max(0.02 * body.len, 0.003)) {
            moving++;
            speeds.push(v);
            turnMost = Math.max(turnMost, Math.abs(Math.atan2(Math.sin(poses[i].yaw - poses[i - 1].yaw), Math.cos(poses[i].yaw - poses[i - 1].yaw))) / dt);
        }
        jump = Math.max(jump, v);
    }
    speeds.sort((a, b) => a - b);
    return {body, home, poses, share: moving / (poses.length - 1), median: speeds[Math.floor(speeds.length / 2)] ?? 0, top: jump, turnMost, heights: poses.map((p) => p.y - 0.5)};
}

test("on foot: a stalker and a forager go at their own walk in bouts and stop between; a waiting hunter mostly waits; a courser trots", () => {
    for (const slug of ["african-lion", "sumatran-tiger", "south-american-coati", "hamadryas-baboon"]) {
        const w = walk(slug, 60, 0.25);
        const pace = w.body.walk * (w.body.style === "stalk" ? 0.5 : 0.65);
        console.log(`# ${slug}: ${w.body.style}, moving ${(100 * w.share).toFixed(0)}% of the time at ${w.median.toFixed(2)} m/s (its searching pace ${pace.toFixed(2)}), ${w.top.toFixed(2)} at most`);
        assert.ok(w.share > 0.03 && w.share < 0.7, `${slug}: moving ${(100 * w.share).toFixed(0)}% of the time`);
        assert.ok(w.median > 0.75 * pace && w.median < 1.3 * pace, `${slug}: ${w.median.toFixed(2)} m/s against its searching pace ${pace.toFixed(2)}`);
        assert.ok(w.top < 1.45 * pace, `${slug}: never over ${(1.45 * pace).toFixed(2)} m/s (${w.top.toFixed(2)})`);
        assert.ok(w.poses.some((p) => !p.moving && (p.beat === "scan" || p.beat === "bite" || p.beat === "chew" || p.beat === "pause")), `${slug} stops to look or feed`);
    }
    for (const slug of ["saltwater-crocodile", "american-bullfrog", "veiled-chameleon", "reticulated-python"]) {
        const w = walk(slug, 60, 0.25);
        console.log(`# ${slug}: waits, moving ${(100 * w.share).toFixed(0)}% of the time, ${w.top.toFixed(2)} m/s at most (walk ${w.body.walk.toFixed(2)}, trot ${w.body.trot.toFixed(2)})`);
        assert.ok(w.share < 0.4, `${slug}: waits (moving ${(100 * w.share).toFixed(0)}%)`);
        // (It moves on at its own pace, and hurries only when that would take over three tenths of the step: never past
        // its sprint on land, twice its cruise in the water, while the waypoint can be reached at that.)
        assert.ok(w.top < Math.max(w.body.sprint, w.body.swim * 2) * 1.3, `${slug}: no faster than its sprint between its waiting places (${w.top.toFixed(2)} m/s, its sprint ${w.body.sprint.toFixed(2)})`);
        console.log(`# ${slug}: sprint ${w.body.sprint.toFixed(2)}, swim ${w.body.swim.toFixed(2)}, median while moving ${w.median.toFixed(2)}`);
    }
    for (const slug of ["eurasian-wolf", "spotted-hyena"]) {
        const w = walk(slug, 60, 0.25);
        console.log(`# ${slug}: courses, moving ${(100 * w.share).toFixed(0)}% of the time at ${w.median.toFixed(2)} m/s (walk ${w.body.walk.toFixed(2)}, trot ${w.body.trot.toFixed(2)})`);
        assert.ok(w.share > 0.6 && w.share < 0.95, `${slug}: on the move ${(100 * w.share).toFixed(0)}% of the time, with a stop at each waypoint`);
        assert.ok(w.median > 0.5 * w.body.trot && w.median < 1.3 * w.body.trot, `${slug}: ${w.median.toFixed(2)} m/s against its trot ${w.body.trot.toFixed(2)}`);
        assert.ok(w.body.trot > w.body.walk, `${slug}: a trot is faster than its walk`);
    }
});

test("in the air: soarers circle high at their glide, hawkers loop fast, perch hunters and gleaners fly from place to place and sit; never all at one height", () => {
    const soar = walk("common-buzzard", 30, 0.25);
    assert.ok(Math.min(...soar.heights) >= 14 && Math.max(...soar.heights) <= 40, `a buzzard soars ${Math.min(...soar.heights).toFixed(0)}–${Math.max(...soar.heights).toFixed(0)} m up`);
    assert.ok(soar.share > 0.99 && soar.median > 0.8 * soar.body.fly && soar.median < 1.25 * soar.body.fly, `at its glide (${soar.median.toFixed(1)} against ${soar.body.fly.toFixed(1)} m/s)`);
    assert.ok(soar.poses.every((p) => p.aloft && p.beat === "glide" && p.doing === "soar"));
    // (Its circles: under a third of a turn a second, a bank it can hold.)
    assert.ok(soar.turnMost < 1.2, `turning at most ${(soar.turnMost * 57.3).toFixed(0)} degrees a second`);
    const hawk = walk("wandering-glider", 30, 0.1);
    assert.ok(hawk.share > 0.99 && hawk.median > 0.7 * hawk.body.fly && hawk.median < 1.3 * hawk.body.fly, `a dragonfly hawks at ${hawk.median.toFixed(1)} m/s`);
    assert.ok(Math.max(...hawk.heights) < 3, "low over the ground");
    for (const slug of ["common-kingfisher", "european-robin", "great-egret"]) {
        const w = walk(slug, 60, 0.25);
        assert.ok(w.share < 0.5, `${slug}: sits or stands most of the time (moving ${(100 * w.share).toFixed(0)}%)`);
        assert.ok(w.poses.some((p) => !p.aloft && !p.moving), `${slug} comes down between flights`);
        assert.ok(w.top < w.body.fly * 1.3 + 0.5, `${slug}: flies at most at its own pace (${w.top.toFixed(1)} against ${w.body.fly.toFixed(1)} m/s)`);
    }
    // Each kind at its own height, not one height for all.
    const heights = ["common-buzzard", "wandering-glider", "common-kingfisher", "osprey"].map((slug) => {
        const h = walk(slug, 20, 0.5).heights.sort((a, b) => a - b);
        return Math.round(h[Math.floor(h.length * 0.9)]);
    });
    assert.ok(new Set(heights).size >= 3, `heights ${heights.join(", ")} m`);
});

test("in the water: a pike lurks, a shark cruises at its own pace", () => {
    const pike = walk("northern-pike", 60, 0.25);
    console.log(`# pike: moving ${(100 * pike.share).toFixed(0)}%; `);
    assert.ok(pike.share < 0.4, `a pike hangs still (moving ${(100 * pike.share).toFixed(0)}%)`);
    const shark = walk("bull-shark", 40, 0.25);
    assert.ok(shark.share > 0.99, "a shark keeps swimming");
    assert.ok(shark.median > 0.5 * shark.body.swim && shark.median < 1.1 * shark.body.swim, `at ${shark.median.toFixed(2)} m/s against its cruise ${shark.body.swim.toFixed(2)}`);
});

test("no jump anywhere on a foray: step to step, wait to walk, loop to loop", () => {
    let n = 50;
    for (const slug of Object.keys(STYLES)) {
        const dt = 0.05;
        const w = walk(slug, 8, dt, n++);
        const most = Math.max(w.body.fly, w.body.trot, w.body.swim, w.body.walk, 45 / (0.7 * HUNT_STEP_SECONDS)) * 1.6;
        assert.ok(w.top <= most, `${slug} (${w.body.style}): ${w.top.toFixed(2)} m/s in one ${dt} s sample (its fastest pace ${most.toFixed(2)})`);
    }
});

test("into a hunt and out of one: on its schedule until it must leave, there as the hunt begins, back at its own pace; nothing in one frame", () => {
    const {animal, home} = animalOf("african-lion", 90);
    const from = 9000 / 96;
    const body = huntBody(animal, home.sheet, home.sheet.len);
    const first = forayAt(atlas, home, animal.id, 9000);
    // Its schedule has it asleep 12 m from its first waypoint: about nine seconds of its walk.
    const asleep = sched(first.x + 12, first.z);
    const layer = layerFor([animal], from);
    assert.equal(layer.pose(animal, epochAt(8999) + 1, home.sheet.len, ground, asleep), null, "still on its schedule a step before");
    assert.equal(layer.hunting(animal, epochAt(8999) + 1), false, "and its card does not say hunting yet");
    let last: HuntPose | null = null;
    let top = 0;
    let left = 0;
    for (let t = epochAt(8999); t < epochAt(9000); t += 0.1) {
        const pose = layer.pose(animal, t, home.sheet.len, ground, asleep);
        if (pose && !left) left = t;
        if (pose && last) top = Math.max(top, Math.hypot(pose.x - last.x, pose.z - last.z) / 0.1);
        last = pose;
    }
    assert.ok(left > epochAt(8999) + HUNT_STEP_SECONDS * 0.5, "it leaves late in the step");
    assert.ok(top > 0.6 * body.walk && top < 1.35 * body.walk, `at its walk (${top.toFixed(2)} against ${body.walk.toFixed(2)} m/s)`);
    assert.equal(layer.hunting(animal, epochAt(9000) - 1), true, "on its way: hunting");
    const arrived = layer.pose(animal, epochAt(9000) - 1e-4, home.sheet.len, ground, asleep)!;
    const begun = layer.pose(animal, epochAt(9000) + 1e-4, home.sheet.len, ground, asleep)!;
    assert.ok(Math.hypot(arrived.x - first.x, arrived.z - first.z) < 0.02 && Math.hypot(begun.x - arrived.x, begun.z - arrived.z) < 0.02, "it arrives as the hunt begins");
    // From far off (400 m) it has LEAD_STEPS steps: no faster than that needs.
    const far = sched(first.x + 400, first.z);
    const other = layerFor([animal], from);
    let farTop = 0;
    last = null;
    for (let t = epochAt(9000 - LEAD_STEPS); t < epochAt(9000); t += 0.1) {
        const pose = other.pose(animal, t, home.sheet.len, ground, far);
        if (pose && last) farTop = Math.max(farTop, Math.hypot(pose.x - last.x, pose.z - last.z) / 0.1);
        last = pose;
    }
    assert.ok(farTop < (400 / (LEAD_STEPS * HUNT_STEP_SECONDS)) * 1.3, `from 400 m: ${farTop.toFixed(2)} m/s at most`);
    // Fed while it was out (the next read moves its next hunt on): it finishes the leg it is on, then walks back.
    const now = epochAt(9010) + 10;
    const before = layer.pose(animal, now, home.sheet.len, ground, asleep)!;
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 5000]]), meals: []}, atlas, START, now * 1000);
    const after = layer.pose(animal, now, home.sheet.len, ground, asleep)!;
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 1e-6, "the read moves nothing in one frame");
    last = after;
    let backTop = 0;
    let home2: number | null = null;
    for (let t = now; t < epochAt(9011 + LEAD_STEPS + 1); t += 0.1) {
        const pose = layer.pose(animal, t, home.sheet.len, ground, asleep);
        if (!pose) {
            home2 ??= t;
            assert.ok(last === null || Math.hypot(last.x - (first.x + 12), last.z - first.z) < 0.3, "it is back at its schedule's place when the layer lets go");
            last = null;
            continue;
        }
        if (last) backTop = Math.max(backTop, Math.hypot(pose.x - last.x, pose.z - last.z) / 0.1);
        last = pose;
    }
    assert.ok(home2 !== null && home2 > epochAt(9011), "it goes back after its leg");
    assert.ok(backTop < Math.max(1.45 * body.walk, 45 / HUNT_STEP_SECONDS), `back at its own pace (${backTop.toFixed(2)} m/s)`);
    // Already out when the page's first read comes: it sets off from its schedule's place, not in one frame.
    const fresh = new HuntingLayer();
    fresh.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 0]]), meals: []}, atlas, START, (epochAt(9020) + 5) * 1000);
    const atOnce = fresh.pose(animal, epochAt(9020) + 5, home.sheet.len, ground, asleep);
    assert.ok(atOnce === null || Math.hypot(atOnce.x - (first.x + 12), atOnce.z - first.z) < 0.5, "it starts where its schedule has it");
    assert.ok(fresh.pose(animal, epochAt(9021 + LEAD_STEPS) + 1, home.sheet.len, ground, asleep), "and is out on its foray a few steps on");
    // (Even from 400 m: nothing in one frame.)
    const farFresh = new HuntingLayer();
    farFresh.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 0]]), meals: []}, atlas, START, (epochAt(9020) + 30) * 1000);
    assert.equal(farFresh.pose(animal, epochAt(9020) + 30, home.sheet.len, ground, far), null);
});

test("the same for every viewer; a companion keeps beside its hunting leader", () => {
    const {animal, home} = animalOf("eurasian-wolf", 120);
    const a = layerFor([animal]);
    const b = layerFor([animal]);
    for (const t of [epochAt(9003) + 3.3, epochAt(9040) + 20.1, epochAt(9100) + 33]) assert.deepEqual(a.pose(animal, t, home.sheet.len, ground, sched()), b.pose(animal, t, home.sheet.len, ground, sched()));
    const lead = a.pose(animal, epochAt(9003) + 20, home.sheet.len, ground, sched())!;
    const own = sched(lead.x + 30, lead.z + 30)();
    const beside = a.beside(lead, 1, 1, home.sheet.len, own, ground);
    const d = Math.hypot(beside.x - lead.x, beside.z - lead.z);
    assert.ok(d > 0.5 * home.sheet.len && d < 4 * home.sheet.len, `a body length or two from its leader (${d.toFixed(2)} m)`);
    assert.equal(beside.yaw, lead.yaw);
    const half = a.beside(lead, 0.5, 1, home.sheet.len, own, ground);
    assert.ok(Math.hypot(half.x - own.x, half.z - own.z) > 1 && Math.hypot(half.x - lead.x, half.z - lead.z) > 1, "eased from its own place as the leader sets out");
    assert.deepEqual(a.beside(lead, 0, 2, home.sheet.len, own, ground).x, own.x);
    assert.equal(huntProgress(0, 0, 0.15, 0.15), 0);
    assert.equal(huntProgress(1, 0.2, 0.1, 0), 1);
    assert.equal(huntProgress(0.1, 0.2, 0.1, 0), 0);
});
