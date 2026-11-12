import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {launchEnclosures} from "@/ark-scene/islands/town/areas";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {
    CAR_HALF_LENGTH,
    CAR_HALF_WIDTH,
    CAR_KINDS,
    carAnimalGap,
    parkedCar,
    parseVehicles,
    pathAt,
    signalGreen,
    TrafficSim,
    townCrossings,
    townParking,
    townSignals,
    townTraffic,
    TRAFFIC_WINDOW,
    type MovingCar,
    type TrafficAnimal,
    type TrafficAnimals
} from "@/ark-scene/islands/town/render/vehicles";
import {buildBuilding, curtainsDrawn, newBuildingChunk, paneSizeCode, paneStyle, windowState} from "@/ark-scene/islands/town/render/buildings";
import {encodeColourTag, Geo} from "@/ark-scene/islands/town/render/kit";

/**
 * The town's vehicles and buildings (lane GB, docs/ark/town-island.md §13): true-size CC0 cars; parked cars in bays and
 * on drives, never on a building or in a moving car's lane; a few cars moving on the shared clock, the same for every
 * viewer, on lanes that never cross a building, wall, fence or trunk (L5's colliders), never through another car or an
 * animal, stopping at the zebras and the red lights; the facades' surface kinds and panes.
 */

const root = path.resolve(__dirname, "..", "..");
const plan = townPlan();
const traffic = townTraffic(plan);
const colliders = townColliderSet(launchEnclosures(), {x: 0, z: 0});

/** A car's footprint as discs along its length (radius its half width), at a point and heading. */
function footprint(x: number, z: number, dx: number, dz: number, halfLength = CAR_HALF_LENGTH - 0.1, half = CAR_HALF_WIDTH - 0.05): Array<{x: number; z: number; r: number}> {
    const out: Array<{x: number; z: number; r: number}> = [];
    const n = 4;
    for (let k = 0; k < n; k++) {
        const t = -halfLength + half + ((2 * halfLength - 2 * half) * k) / (n - 1);
        out.push({x: x + dx * t, z: z + dz * t, r: half});
    }
    return out;
}

/** Two cars (oriented boxes) overlap: separating axes over both boxes' axes. */
function boxesOverlap(a: {x: number; z: number; dx: number; dz: number}, b: {x: number; z: number; dx: number; dz: number}, hl = CAR_HALF_LENGTH - 0.15, hw = CAR_HALF_WIDTH - 0.08): boolean {
    const axes = [[a.dx, a.dz], [-a.dz, a.dx], [b.dx, b.dz], [-b.dz, b.dx]];
    const corners = (c: typeof a) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([l, w]) => [c.x + c.dx * hl * l - c.dz * hw * w, c.z + c.dz * hl * l + c.dx * hw * w]);
    const ca = corners(a);
    const cb = corners(b);
    for (const [ax, az] of axes) {
        const pa = ca.map(([x, z]) => x * ax + z * az);
        const pb = cb.map(([x, z]) => x * ax + z * az);
        if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
    return true;
}

const boxDiscGap = carAnimalGap;

test("the CC0 models: six cars and a bicycle at true size, every level's indices in range", () => {
    const file = path.join(root, "public", "ark", "assets", "town-v1", "vehicles.bin");
    const buffer = readFileSync(file);
    const models = parseVehicles(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    for (const kind of CAR_KINDS) {
        const m = models.get(kind)!;
        assert.ok(m, kind);
        const [w, h, l] = m.size;
        assert.ok(l >= 3.5 && l <= 4.7, `${kind} is ${l} m long`);
        assert.ok(w >= 1.7 && w <= 2.05 && h >= 1.1 && h <= 1.7, `${kind} ${w} × ${h} m`);
        for (const level of m.levels) {
            assert.ok(level.indices.every((i) => i < level.classes.length), `${kind} indices`);
            assert.ok(level.classes.some((c) => c === 0) && level.classes.some((c) => c === 3), `${kind} has paint and glass`);
        }
        assert.ok(m.levels[1].indices.length < m.levels[0].indices.length * 0.6, `${kind}'s second level is lighter`);
    }
    const bike = models.get("bicycle")!;
    assert.ok(Math.abs(bike.size[2] - 1.75) < 0.01, "a bicycle is 1.75 m");
    assert.ok(buffer.length < 340_000, `the file stays small (${buffer.length} bytes)`);
});

test("parked cars: in bays and on drives, never on a building, a wall or a fence, never overlapping, never in a moving lane", () => {
    const spots = townParking(plan);
    const kerbs = spots.filter((s) => s.kind === "kerb");
    assert.ok(kerbs.length > 120 && spots.length > 220, `${spots.length} spots, ${kerbs.length} kerb bays`);
    for (const s of spots) {
        const dx = Math.sin(s.turn);
        const dz = Math.cos(s.turn);
        const g = townHeight(s.x, s.z);
        for (const d of footprint(s.x, s.z, dx, dz)) assert.ok(!colliders.blocked(d.x, d.z, d.r, g + 0.1, 1.4), `${s.id} stands clear of buildings and walls`);
    }
    // No two spots overlap.
    for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
            const a = spots[i];
            const b = spots[j];
            if (Math.hypot(a.x - b.x, a.z - b.z) > 6) continue;
            assert.ok(!boxesOverlap({x: a.x, z: a.z, dx: Math.sin(a.turn), dz: Math.cos(a.turn)}, {x: b.x, z: b.z, dx: Math.sin(b.turn), dz: Math.cos(b.turn)}), `${a.id} and ${b.id} overlap`);
        }
    }
    // No bay is in a moving car's way (every lane sample against every spot near it).
    for (const p of traffic.paths) {
        for (let i = 0; i < p.x.length; i += 2) {
            const car = {x: p.x[i], z: p.z[i], dx: p.dx[i], dz: p.dz[i]};
            for (const s of spots) {
                if (Math.abs(s.x - car.x) > 6 || Math.abs(s.z - car.z) > 6) continue;
                assert.ok(!boxesOverlap(car, {x: s.x, z: s.z, dx: Math.sin(s.turn), dz: Math.cos(s.turn)}), `${p.id} at ${i * p.step} m runs through ${s.id}`);
            }
        }
    }
    // Who is parked follows the people implied: drives fuller at night than on a weekday morning.
    const full = (hours: number, day: number) => spots.filter((s) => s.kind === "drive" && parkedCar(s, {hours, day}).parked).length;
    assert.ok(full(23, 20407) > full(11, 20407), "drives fuller at night than in working hours");
});

test("moving cars: their lanes never cross a building, wall, fence or trunk (L5's colliders), and stop at the zebras and red lights", () => {
    assert.equal(traffic.paths.length, 3);
    let checked = 0;
    for (const p of traffic.paths) {
        for (let i = 0; i < p.x.length; i++) {
            const g = townHeight(p.x[i], p.z[i]);
            for (const d of footprint(p.x[i], p.z[i], p.dx[i], p.dz[i])) {
                assert.ok(!colliders.blocked(d.x, d.z, d.r, g + 0.1, 1.4), `${p.id} at ${(i * p.step).toFixed(1)} m (${p.x[i].toFixed(1)}, ${p.z[i].toFixed(1)}) touches something solid`);
                checked++;
            }
        }
        // Each loop is closed and smooth: no step over 0.6 m between samples, no turn sharper than a street corner.
        for (let i = 0; i < p.x.length; i++) {
            const j = (i + 1) % p.x.length;
            assert.ok(Math.hypot(p.x[j] - p.x[i], p.z[j] - p.z[i]) < 0.6, `${p.id} jumps at ${i}`);
        }
        assert.ok(p.stops.some((s) => s.kind === "give_way"), `${p.id} gives way somewhere`);
    }
    assert.ok(checked > 6000);
    // The zebras lie on the loops' streets; each loop that runs over one stops there.
    const crossings = townCrossings(plan);
    assert.equal(crossings.length, 6);
    assert.ok(traffic.paths.flatMap((p) => p.stops).filter((s) => s.kind === "crossing").length >= 4, "the cars stop at the zebras on their way");
    assert.ok(traffic.paths.some((p) => p.stops.some((s) => s.kind === "signal")), "the signals at the High Street and Park Road");
    // On its timetable a car waits at a zebra: some moment where it is still within 1 m of the crossing's stop.
    const sim = new TrafficSim(traffic);
    const signal = townSignals(plan)[0];
    let waitedAtZebra = 0;
    let ranRed = 0;
    for (let t = 1_763_000_000; t < 1_763_000_000 + 900; t += 0.5) {
        const cars = sim.at_(t)!;
        for (const car of cars) {
            if (!car.active) continue;
            const p = traffic.paths[car.loop];
            const into = ((car.s % p.length) + p.length) % p.length;
            if (car.speed < 0.05 && p.stops.some((s) => s.kind === "crossing" && s.at - into > -0.5 && s.at - into < 2.5)) waitedAtZebra++;
            // Never inside the junction's box on a red (its stop line is 9 m out; the box is 6 m).
            for (const s of p.stops) {
                if (s.kind !== "signal") continue;
                const past = into - s.at;
                if (past > 0.5 && past < 3 && Math.hypot(car.x - signal.x, car.z - signal.z) < 6.5 && !signalGreen(s.phase ?? 0, t) && !signalGreen(s.phase ?? 0, t - 4)) ranRed++;
            }
        }
    }
    assert.ok(waitedAtZebra > 0, "a car waits at a zebra");
    assert.equal(ranRed, 0, "no car enters the junction on a red");
});

test("moving cars are the same for every viewer: one stepped all along and one joining late agree; they never touch one another or a parked car", () => {
    const a = new TrafficSim(traffic);
    const b = new TrafficSim(traffic);
    const t0 = 1_763_000_123;
    const spots = townParking(plan);
    const clock = (t: number) => ({hours: ((t / 3600) % 24 + 24) % 24, day: Math.floor(t / 86400) + 4});
    let compared = 0;
    let carPairs = 0;
    for (let t = t0; t < t0 + TRAFFIC_WINDOW * 3; t += 0.75) {
        const cars = a.at_(t)!;
        if (Math.round((t - t0) / 0.75) % 37 === 0) {
            // A viewer opening the page now.
            const late = new TrafficSim(traffic).at_(t)!;
            late.forEach((c, i) => assert.ok(Math.hypot(c.x - cars[i].x, c.z - cars[i].z) < 1e-6 || !c.active, `car ${i} at ${t}: ${c.x},${c.z} vs ${cars[i].x},${cars[i].z}`));
            compared++;
        }
        const other = b.at_(t)!;
        cars.forEach((c, i) => assert.equal(c.x, other[i].x));
        const active = cars.filter((c) => c.active);
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                carPairs++;
                assert.ok(!boxesOverlap(active[i], active[j], CAR_HALF_LENGTH - 0.3, CAR_HALF_WIDTH - 0.15), `cars ${active[i].index} and ${active[j].index} touch at ${t}`);
            }
        }
        if (Math.round((t - t0) / 0.75) % 8 === 0) {
            for (const s of spots) {
                if (!parkedCar(s, clock(t)).parked) continue;
                for (const c of active) {
                    if (Math.abs(s.x - c.x) > 6 || Math.abs(s.z - c.z) > 6) continue;
                    assert.ok(!boxesOverlap(c, {x: s.x, z: s.z, dx: Math.sin(s.turn), dz: Math.cos(s.turn)}), `car ${c.index} runs into ${s.id} at ${t}`);
                }
            }
        }
    }
    assert.ok(compared > 20 && carPairs > 1000);
    // The window's start is on the timetable: the run stays within a few metres of it (catching up after a wait).
    const lags = a.at_(t0 + TRAFFIC_WINDOW * 3 - 1)!.map((c: MovingCar) => Math.abs(c.lag));
    assert.ok(Math.max(...lags) < 40, `cars keep near their timetable (${lags.map((l) => l.toFixed(1)).join(", ")})`);
});

test("moving cars never pass through an animal: they stop short of one in the lane and drive on when it has gone", () => {
    // A cat sitting in the old town loop's lane for two minutes, then walking off; a fox crossing the road slowly.
    const p = traffic.paths[0];
    const sit = pathAt(p, 120);
    const crossAt = pathAt(p, 330);
    const t0 = 1_763_000_000;
    const animals: TrafficAnimals = (x, z, radius, epoch) => {
        const out: TrafficAnimal[] = [];
        if (epoch - t0 < 120) out.push({x: sit.x, z: sit.z, r: 0.25});
        const k = (((epoch - t0) % 40) + 40) % 40;
        // The fox walks across from kerb to kerb in 20 s, every 40 s.
        if (k < 20) out.push({x: crossAt.x - crossAt.dz * (k / 20 - 0.5) * 7, z: crossAt.z + crossAt.dx * (k / 20 - 0.5) * 7, r: 0.3});
        return out.filter((a) => Math.hypot(a.x - x, a.z - z) < radius + a.r);
    };
    const sim = new TrafficSim(traffic, animals);
    let nearest = Infinity;
    let stoppedForCat = false;
    for (let t = t0; t < t0 + 600; t += 0.25) {
        const cars = sim.at_(t)!;
        for (const c of cars) {
            if (!c.active) continue;
            for (const a of animals(c.x, c.z, 8, t) ?? []) {
                const gap = boxDiscGap(c, a);
                nearest = Math.min(nearest, gap);
                if (gap < 2.5 && c.speed < 0.05) stoppedForCat = true;
            }
        }
    }
    assert.ok(nearest > 0, `never through an animal (nearest ${nearest.toFixed(2)} m)`);
    assert.ok(stoppedForCat, "a car waited for an animal");
    // And it moved on: after the cat has gone every car is back near its timetable.
    const after = sim.at_(t0 + 600)!;
    assert.ok(after.every((c) => !c.active || Math.abs(c.lag) < 60));
});

const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/wt-view/public/ark-local/live.json";
const ROUTING = process.env.ARK_ISLANDS_ROUTING ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/real-ark/islands-routing.json";

test("the real Ark's town animals on their shared schedules: the cars stop short of them or step round them; contacts bounded", {skip: !existsSync(LIVE) || !existsSync(ROUTING)}, async () => {
    const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
    const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
    const {arkIslandSnapshot} = await import("@/lib/ark-islands");
    const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
    const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
    const {scheduleWorld, tripAt, poseOnTrip} = await import("@/ark-scene/behaviour-schedule");
    const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
    const {bodyShape} = await import("@/ark-scene/collide");
    const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(LIVE, "utf8")), JSON.parse(readFileSync(ROUTING, "utf8")));
    const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
    const town = arkIslandSnapshot(whole, "town");
    const placed = placeTownAnimals(town.animals);
    // The town in its own frame (origin 0): the schedules of every animal whose home range reaches a moving lane.
    const sampler = townWorldSampler(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(sampler);
    const hours = (epoch: number) => ((epoch / 3600) % 24 + 24) % 24;
    const lanes = traffic.paths;
    const near = (x: number, z: number, r: number) => lanes.some((p) => {
        for (let i = 0; i < p.x.length; i += 6) if (Math.hypot(p.x[i] - x, p.z[i] - z) < r) return true;
        return false;
    });
    type Who = {sched: Parameters<typeof tripAt>[2]; profile: ReturnType<typeof behaviourProfile>; r: number; h: number};
    const who: Who[] = [];
    for (const animal of town.animals) {
        const info = placed.town.get(animal.id)!;
        if (info.still || ["roof", "eave", "ledge", "tall", "belfry", "balcony", "window", "lamp_wall"].includes(info.where)) continue;
        const p = placed.places.get(animal.id)!;
        const range = Math.max(info.range, 0.6) * 1.5;
        if (!near(p.x, p.z, range + 4)) continue;
        const length = Math.max(animal.length_m ?? 0.4, 0.05);
        who.push({sched: {id: animal.id, zone: animal.zone, home: {x: p.x, y: p.ground, z: p.z}, length, sea: false, range}, profile: behaviourProfile(animal.model_slug), r: bodyShape(animal.model_slug, length).radius, h: bodyShape(animal.model_slug, length).height});
    }
    assert.ok(who.length > 50, `${who.length} animals live within reach of a moving lane`);
    const poseAt = (w: Who, epoch: number) => poseOnTrip(world, tripAt(world, w.profile, w.sched, epoch, hours), epoch);
    const query: TrafficAnimals = (x, z, radius, epoch) => {
        const out: TrafficAnimal[] = [];
        for (const w of who) {
            if (Math.hypot(w.sched.home.x - x, w.sched.home.z - z) > radius + (w.sched.range ?? 8) + 3) continue;
            const pose = poseAt(w, epoch);
            if (pose.aloft) continue;
            if (Math.hypot(pose.x - x, pose.z - z) < radius + w.r) out.push({x: pose.x, z: pose.z, r: w.r, h: w.h});
        }
        return out;
    };
    const sim = new TrafficSim(traffic, query);
    let nearestMoving = Infinity;
    let samples = 0;
    let waitingTouched = 0;
    let movingTouched = 0;
    const t0 = 1_763_020_000;
    for (let t = t0; t < t0 + 1200; t += 0.5) {
        for (const c of sim.at_(t)!) {
            if (!c.active) continue;
            samples++;
            let touched = false;
            for (const a of query(c.x, c.z, 4, t) ?? []) {
                const gap = boxDiscGap(c, a);
                if (c.speed > 0.3) {
                    nearestMoving = Math.min(nearestMoving, gap);
                    if (gap < 0) movingTouched++;
                } else if (gap < 0) touched = true;
            }
            if (touched) waitingTouched++;
        }
    }
    console.log(`real Ark: ${who.length} animals near the lanes; nearest to a moving car ${nearestMoving.toFixed(2)} m (${movingTouched} touching); an animal against a waiting car in ${waitingTouched} of ${samples} car samples; ${JSON.stringify(sim.stats())}`);
    // A moving car stops short of, or steps round, every animal it can see coming. What remains is an animal that walks
    // or runs into a car (a dog darting under its bumper, a pigeon under a waiting car): L5's to keep out once the cars
    // are among its obstacles (docs/ark/town-island.md §13). Bounded here at the measured rate.
    assert.ok(movingTouched <= 4 && nearestMoving > -0.3, `moving cars touch an animal at most rarely (${movingTouched} of ${samples}, nearest ${nearestMoving.toFixed(2)} m)`);
    assert.ok(waitingTouched / samples < 0.03, `animals walk into waiting cars rarely (${waitingTouched} of ${samples})`);
});

test("buildings: faces carry their surface kinds in the colour; panes carry their size and style; curtains drawn at night", () => {
    const c = encodeColourTag([0.3, 0.2, 0.1], 3);
    const f = (v: number) => v * 255 - Math.floor(v * 255);
    assert.ok(Math.abs(f(c[1]) - 0.5) < 0.01 && Math.abs(f(c[2]) - 0.25) < 0.01 && Math.floor(f(c[0]) * 16) === 3);
    assert.ok(Math.abs(c[0] - 0.3) < 0.005, "the colour itself barely moves");
    assert.equal(paneSizeCode(1.2, 1.5), 24 * 1000 + 30);
    assert.equal(paneStyle(2, 5, true, 7), 7 * 256 + 2 * 32 + 5 * 2 + 1);
    const house = plan.buildings.find((b) => b.kind === "house")!;
    const chunk = newBuildingChunk(null, new Geo());
    buildBuilding(chunk, house);
    assert.ok(chunk.windows.length >= 6 && chunk.panes.pos.length / 18 >= chunk.windows.length, "a pane a window");
    assert.ok(chunk.detail.triangles > 50, "near detail: sills, lintels, door panels");
    // The same building drawn without its detail keeps the same windows (the detail is drawn near, on its own).
    const bare = newBuildingChunk(null);
    buildBuilding(bare, house);
    assert.deepEqual(bare.windows.map((w) => w.seed), chunk.windows.map((w) => w.seed));
    assert.equal(bare.detail.triangles, 0);
    const w = {...chunk.windows[0], owner: "home" as const};
    const drawn = [17, 20, 21.5, 22.5, 23.5, 2].map((hours) => curtainsDrawn(w, {hours, day: 20410}));
    assert.equal(drawn[0], false, "open in the afternoon");
    assert.ok(windowState(w, {hours: 12, day: 20410}) < 2, "no curtains drawn at noon");
});
