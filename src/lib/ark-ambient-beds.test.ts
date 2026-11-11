import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
    AMBIENT_BEDS,
    AMBIENT_MAX_BEDS,
    AMBIENT_THUNDER,
    AMBIENT_PATH,
    AMBIENT_UNDERWATER_LOWPASS_HZ,
    ambientCredits,
    ambientGains,
    approachGain,
    lightningFlashes,
    loopOffset,
    panToward,
    selectAmbientBeds,
    thunderClaps,
    timeCurves,
    zoneFactor,
    type AmbientBedDef,
    type AmbientInput
} from "@/ark-scene/ambient-beds";
import {ARK_ZONES} from "@/ark-scene/types";
import {islandHours, lightningAt, tideAt, weatherAt} from "@/lib/ark-clock";

/** Every bed as if its files were in: the selection logic is tested whatever is shipped. */
const ALL: AmbientBedDef[] = AMBIENT_BEDS.map((bed) => ({...bed, ready: true, loopSeconds: bed.loopSeconds ?? 30}));

const DRY = {rain: 0, wind: 0.2, storm: 0, insects: 1, cold: 0.3};

function input(over: Partial<AmbientInput> = {}): AmbientInput {
    return {zone: "grassland", weather: DRY, hour: 12, tide: 0, cameraPos: {x: 0, y: 2, z: 0}, nearWater: {}, ...over};
}

function gainOf(id: string, inp: AmbientInput, beds: AmbientBedDef[] = ALL): number {
    return ambientGains(inp, beds).find((g) => g.bed.id === id)?.gain ?? 0;
}

test("the table: unique ids, known zones, waters, weather and times", () => {
    const ids = AMBIENT_BEDS.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
    const zones = new Set<string>([...ARK_ZONES, "*"]);
    for (const bed of AMBIENT_BEDS) {
        assert.match(bed.id, /^[a-z_]+$/);
        assert.ok(bed.level > 0 && bed.level <= 1, bed.id);
        assert.ok(bed.ramp > 0, bed.id);
        assert.ok(Object.keys(bed.time).length > 0, bed.id);
        for (const key of Object.keys(bed.time)) assert.ok(["any", "day", "night", "dawn", "dusk"].includes(key), `${bed.id} time ${key}`);
        for (const key of Object.keys(bed.zones ?? {})) assert.ok(zones.has(key), `${bed.id} zone ${key}`);
        for (const rule of bed.near ?? []) {
            assert.ok(["sea", "river", "rapids", "waterfall", "pond", "lake"].includes(rule.water), `${bed.id} water ${rule.water}`);
            assert.ok(rule.full >= 0 && rule.silent > rule.full, `${bed.id} near ${rule.water}`);
        }
        for (const key of [...Object.keys(bed.weather ?? {}), ...Object.keys(bed.quiet ?? {})]) assert.ok(["rain", "wind", "storm", "insects", "cold"].includes(key), `${bed.id} weather ${key}`);
        assert.ok(bed.zones || bed.near || bed.altitude, `${bed.id} belongs somewhere`);
    }
    // The brief's beds are all in the table.
    for (const id of ["rain", "storm", "night_insects", "night_frogs", "dawn_chorus", "mountain_wind", "surf", "rapids", "waterfall", "wind_trees"]) assert.ok(ids.includes(id), id);
});

test("ready beds have both files, small, a loop length and credited free licences", () => {
    const dir = path.join(process.cwd(), "public", AMBIENT_PATH);
    for (const bed of AMBIENT_BEDS.filter((b) => b.ready)) {
        assert.ok(typeof bed.loopSeconds === "number" && bed.loopSeconds >= 10 && bed.loopSeconds <= 90, `${bed.id} loopSeconds`);
        for (const ext of ["webm", "m4a"]) {
            const file = path.join(dir, `${bed.id}.${ext}`);
            assert.ok(fs.existsSync(file), `${bed.id}.${ext} missing`);
            assert.ok(fs.statSync(file).size <= 150 * 1024, `${bed.id}.${ext} is over 150 KB`);
        }
        assert.ok(bed.sources.length > 0, `${bed.id} has no credits`);
        for (const s of bed.sources) {
            // CC0, public domain, or a recordist's own Public Domain Mark: nothing NC, ND or SA (docs/ark-credits.md).
            assert.ok(["CC0 1.0", "Public domain", "Public Domain Mark 1.0"].includes(s.license), `${bed.id}: ${s.license}`);
            assert.ok(Array.isArray(s.segment) && s.segment[1] > s.segment[0], `${bed.id} segment`);
            assert.ok(s.recordist && s.source && /^https:\/\//.test(s.page), `${bed.id} credit`);
        }
    }
});

test("the thunder one-shots, when ready, have their files and credits", () => {
    const dir = path.join(process.cwd(), "public", AMBIENT_PATH);
    if (!AMBIENT_THUNDER.ready) return;
    for (const shot of [AMBIENT_THUNDER.near, AMBIENT_THUNDER.far]) {
        assert.ok(shot.seconds > 3 && shot.seconds < 30, shot.id);
        for (const ext of ["webm", "m4a"]) assert.ok(fs.existsSync(path.join(dir, `${shot.id}.${ext}`)), `${shot.id}.${ext} missing`);
    }
    assert.ok(AMBIENT_THUNDER.sources.length > 0);
    for (const s of AMBIENT_THUNDER.sources) assert.ok(["CC0 1.0", "Public domain", "Public Domain Mark 1.0"].includes(s.license));
});

test("beds that are not ready are never selected", () => {
    const notReady = AMBIENT_BEDS.map((bed) => ({...bed, ready: false}));
    assert.deepEqual(selectAmbientBeds(input({weather: {rain: 1, wind: 1, storm: 1}}), notReady), []);
});

test("the same inputs give the same beds, gains, pans and offsets", () => {
    const inp = input({zone: {woodland: 0.6, grassland: 0.4}, hour: 5.6, weather: {rain: 0.3, wind: 0.5, storm: 0, insects: 0.6}, cameraPos: {x: 3, y: 4, z: -2, yaw: 1}, nearWater: {sea: {distance: 20, x: 30, z: 0}}, nowMs: 1_800_000_000_000});
    assert.deepEqual(selectAmbientBeds(inp, ALL), selectAmbientBeds(inp, ALL));
});

test("rain rises with the rain and is silent when dry; the storm bed comes with the storm", () => {
    assert.equal(gainOf("rain", input()), 0);
    const light = gainOf("rain", input({weather: {...DRY, rain: 0.35}}));
    const heavy = gainOf("rain", input({weather: {...DRY, rain: 0.85}}));
    assert.ok(light > 0 && heavy > light, `${light} ${heavy}`);
    assert.equal(gainOf("storm", input({weather: {...DRY, rain: 0.85}})), 0);
    assert.ok(gainOf("storm", input({weather: {rain: 1, wind: 1, storm: 1}})) > 0.7);
});

test("night insects at night in the grass, not at noon or in the cold", () => {
    assert.ok(gainOf("night_insects", input({hour: 1})) > 0.3);
    assert.equal(gainOf("night_insects", input({hour: 12})), 0);
    assert.ok(gainOf("night_insects", input({hour: 1, weather: {...DRY, cold: 1}})) < gainOf("night_insects", input({hour: 1})));
    assert.equal(gainOf("night_insects", input({hour: 1, zone: "polar"})), 0);
});

test("frogs by the water at night, even outside the wetland zone", () => {
    assert.equal(gainOf("night_frogs", input({hour: 23, zone: "desert"})), 0);
    assert.ok(gainOf("night_frogs", input({hour: 23, zone: "desert", nearWater: {pond: 3}})) > 0.3);
    assert.ok(gainOf("night_frogs", input({hour: 23, zone: "wetland"})) > 0.3);
    assert.equal(gainOf("night_frogs", input({hour: 12, zone: "wetland"})), 0);
});

test("the dawn chorus belongs to dawn, and rain quietens it", () => {
    const dawn = input({zone: "woodland", hour: 5.9});
    assert.ok(gainOf("dawn_chorus", dawn) > 0.5);
    assert.equal(gainOf("dawn_chorus", input({zone: "woodland", hour: 12})), 0);
    assert.equal(gainOf("dawn_chorus", input({zone: "woodland", hour: 0})), 0);
    assert.ok(gainOf("dawn_chorus", {...dawn, weather: {...DRY, rain: 0.9}}) < gainOf("dawn_chorus", dawn) * 0.5);
});

test("mountain wind high up or in the mountains, and stronger in wind", () => {
    assert.equal(gainOf("mountain_wind", input({zone: "woodland", cameraPos: {x: 0, y: 1, z: 0}})), 0);
    assert.ok(gainOf("mountain_wind", input({zone: "woodland", cameraPos: {x: 0, y: 30, z: 0}})) > 0.15);
    const calm = gainOf("mountain_wind", input({zone: "mountains", weather: {...DRY, wind: 0.1}}));
    const gale = gainOf("mountain_wind", input({zone: "mountains", weather: {...DRY, wind: 1}}));
    assert.ok(calm > 0 && gale > calm * 1.5, `${calm} ${gale}`);
});

test("surf by the sea: louder closer, absent inland, louder in wind and at high tide", () => {
    const at = (d: number, over: Partial<AmbientInput> = {}) => gainOf("surf", input({nearWater: {sea: d}, ...over}));
    assert.ok(at(5) > at(40) && at(40) > at(90));
    assert.equal(at(200), 0);
    assert.equal(gainOf("surf", input()), 0);
    assert.ok(at(20, {weather: {...DRY, wind: 1}}) > at(20, {weather: {...DRY, wind: 0}}));
    assert.ok(at(20, {tide: 1}) > at(20, {tide: -1}));
    assert.ok(at(20, {tide: tideAt(Date.UTC(2026, 10, 11)), weather: weatherAt(Date.UTC(2026, 10, 11))}) > 0);
});

test("rapids and the waterfall only near them, and not from high above", () => {
    assert.equal(gainOf("waterfall", input()), 0);
    assert.ok(gainOf("waterfall", input({nearWater: {waterfall: 10}})) > 0.6);
    assert.ok(gainOf("waterfall", input({nearWater: {waterfall: 10}, eyeDistance: 250})) === 0);
    assert.ok(gainOf("rapids", input({nearWater: {rapids: 5}})) > gainOf("rapids", input({nearWater: {river: 5}})));
    assert.ok(gainOf("rapids", input({nearWater: {river: 5}})) > 0);
});

test("pan: toward the water on the listener's side, centred when right on it", () => {
    // Facing +z with y up, +x is on the left and -x on the right.
    assert.ok(panToward({x: 0, z: 0, yaw: 0}, {x: -50, z: 0}, 50, 4) > 0.5);
    assert.ok(panToward({x: 0, z: 0, yaw: 0}, {x: 50, z: 0}, 50, 4) < -0.5);
    assert.equal(panToward({x: 0, z: 0, yaw: 0}, {x: 0, z: 50}, 50, 4), 0);
    assert.equal(panToward({x: 0, z: 0, yaw: 0}, {x: -2, z: 0}, 2, 4), 0);
    assert.equal(panToward({x: 0, z: 0}, {x: -50, z: 0}, 50, 4), 0);
    const sea = selectAmbientBeds(input({nearWater: {sea: {distance: 30, x: -30, z: 0}}, cameraPos: {x: 0, y: 2, z: 0, yaw: 0}}), ALL).find((b) => b.id === "surf");
    assert.ok(sea && typeof sea.pan === "number" && sea.pan > 0);
});

test("underwater: only beds heard underwater, through a low-pass", () => {
    const beds = selectAmbientBeds(input({hour: 1, weather: {rain: 0.9, wind: 0.6, storm: 0, insects: 1}, nearWater: {sea: 0, underwater: true}}), ALL);
    assert.ok(beds.length > 0);
    for (const b of beds) {
        assert.equal(b.lowpassHz, AMBIENT_UNDERWATER_LOWPASS_HZ);
        assert.ok((ALL.find((d) => d.id === b.id)?.underwater ?? 0) > 0, b.id);
    }
});

test("the cap keeps the loudest beds, loudest first, and the URLs and offsets are well formed", () => {
    const busy = input({zone: {woodland: 0.5, wetland: 0.5}, hour: 5.8, weather: {rain: 0.5, wind: 0.7, storm: 0.2, insects: 0.8}, nearWater: {sea: 10, river: 4, pond: 6}, cameraPos: {x: 0, y: 12, z: 0}, nowMs: 1_800_000_000_000});
    const all = selectAmbientBeds({...busy, maxBeds: 99}, ALL);
    const capped = selectAmbientBeds(busy, ALL);
    assert.ok(all.length > AMBIENT_MAX_BEDS);
    assert.equal(capped.length, AMBIENT_MAX_BEDS);
    assert.deepEqual(capped.map((b) => b.id), all.slice(0, AMBIENT_MAX_BEDS).map((b) => b.id));
    for (let i = 1; i < capped.length; i++) assert.ok(capped[i - 1].gain >= capped[i].gain);
    assert.equal(selectAmbientBeds({...busy, maxBeds: 2}, ALL).length, 2);
    for (const b of capped) {
        assert.equal(b.url, `/ark/sound/ambient/${b.id}.webm`);
        assert.equal(b.fallbackUrl, `/ark/sound/ambient/${b.id}.m4a`);
        assert.equal(b.loopStart, 0.5);
        assert.ok(typeof b.offset === "number" && b.offset >= b.loopStart && b.offset < b.loopStart + b.loopSeconds);
        assert.ok(b.gain > 0 && b.gain <= 1);
    }
    const m4a = selectAmbientBeds({...busy, format: "m4a", baseUrl: "https://animaldex.app/"}, ALL)[0];
    assert.equal(m4a.url, `https://animaldex.app/ark/sound/ambient/${m4a.id}.m4a`);
});

test("gains change smoothly with the hour, the weather and the distance (no jumps for the engine to click on)", () => {
    const ids = ALL.map((b) => b.id);
    const sample = (inp: AmbientInput) => ids.map((id) => gainOf(id, inp));
    const maxStep = (frames: AmbientInput[]) => {
        let worst = 0;
        for (let i = 1; i < frames.length; i++) {
            const a = sample(frames[i - 1]);
            const b = sample(frames[i]);
            a.forEach((v, k) => {
                worst = Math.max(worst, Math.abs(v - b[k]));
            });
        }
        return worst;
    };
    const base = input({zone: {woodland: 0.5, wetland: 0.5}, weather: {rain: 0.2, wind: 0.4, storm: 0, insects: 0.8}, nearWater: {sea: 30, river: 20, pond: 15}});
    const hours = Array.from({length: 24 * 20 + 1}, (_, i) => ({...base, hour: i / 20}));
    assert.ok(maxStep(hours) < 0.06, `hour step ${maxStep(hours)}`);
    const rain = Array.from({length: 101}, (_, i) => ({...base, weather: {rain: i / 100, wind: 0.4 + i / 250, storm: Math.max(0, i - 50) / 50, insects: 1 - i / 120}}));
    assert.ok(maxStep(rain) < 0.06, `weather step ${maxStep(rain)}`);
    const walk = Array.from({length: 241}, (_, i) => ({...base, nearWater: {sea: i * 0.5, river: 120 - i * 0.5, waterfall: Math.abs(60 - i * 0.5), rapids: 30 + i * 0.25}}));
    assert.ok(maxStep(walk) < 0.06, `distance step ${maxStep(walk)}`);
    const zones = Array.from({length: 101}, (_, i) => ({...base, hour: 23, zone: {grassland: 1 - i / 100, polar: i / 100}}));
    assert.ok(maxStep(zones) < 0.06, `zone step ${maxStep(zones)}`);
});

test("the time curves: day at noon, night at midnight, dawn round sunrise, dusk round sunset", () => {
    const noon = timeCurves(12);
    const midnight = timeCurves(0);
    assert.equal(noon.day, 1);
    assert.equal(noon.night, 0);
    assert.equal(midnight.night, 1);
    assert.equal(midnight.day, 0);
    assert.ok(timeCurves(5.8).dawn > 0.5);
    assert.ok(timeCurves(18.6).dusk > 0.5);
    assert.equal(timeCurves(12).dusk, 0);
    assert.deepEqual(timeCurves(25), timeCurves(1));
    assert.ok(timeCurves(islandHours(Date.UTC(2026, 10, 11, 12))).day > 0.9);
});

test("zone factor: weighted, partial and the default", () => {
    assert.equal(zoneFactor({woodland: 1, "*": 0}, {woodland: 1}), 1);
    assert.equal(zoneFactor({woodland: 1, "*": 0}, {woodland: 0.5, grassland: 0.5}), 0.5);
    assert.equal(zoneFactor({woodland: 1, "*": 0}, {woodland: 0.4}), 0.4);
    assert.equal(zoneFactor({"*": 1}, {}), 1);
    assert.equal(zoneFactor({woodland: 1}, {}), 0);
});

test("loop offsets are shared, inside the loop, and move with time", () => {
    const a = loopOffset("rain", 32, 1_800_000_000_000);
    assert.equal(a, loopOffset("rain", 32, 1_800_000_000_000));
    assert.ok(a >= 0.5 && a < 32.5);
    assert.ok(Math.abs(((loopOffset("rain", 32, 1_800_000_005_000) - a + 32) % 32) - 5) < 0.002);
    assert.equal(loopOffset("rain", 32, Number.NaN), 0.5);
    assert.ok(loopOffset("rain", 32, 1_800_000_000_000, 0) < 32);
    assert.notEqual(loopOffset("surf", 32, 1_800_000_000_000), a);
});

test("approachGain eases toward the target and settles", () => {
    let g = 0;
    for (let i = 0; i < 60; i++) g = approachGain(g, 1, 0.1, 3);
    assert.ok(g > 0.99);
    assert.ok(approachGain(0, 1, 0.1, 3) < 0.2);
    assert.equal(approachGain(0.3, 0.8, 0.1, 0), 0.8);
});

test("credits for the beds heard, deduplicated", () => {
    const beds: AmbientBedDef[] = [
        {...ALL[0], id: "a", sources: [{title: "t", recordist: "R", license: "CC0 1.0", source: "Wikimedia Commons", page: "https://x/1"}]},
        {...ALL[1], id: "b", sources: [{title: "t", recordist: "R", license: "CC0 1.0", source: "Wikimedia Commons", page: "https://x/1"}, {title: "u", recordist: "NPS", license: "Public domain", source: "nps.gov", page: "https://x/2"}]}
    ];
    assert.deepEqual(ambientCredits(["a", "b"], beds).map((c) => c.recordist), ["R", "NPS"]);
    assert.deepEqual(ambientCredits(["b"], beds).length, 2);
    assert.deepEqual(ambientCredits([], beds), []);
});

test("lightning flashes are lightningAt's flashes, both ways", () => {
    const from = Date.UTC(2026, 10, 11, 3);
    const to = from + 20 * 60_000;
    const flashes = lightningFlashes(from, to, 1);
    // "A couple a minute" in a full storm.
    assert.ok(flashes.length > 20 && flashes.length < 80, `${flashes.length} flashes in 20 minutes`);
    for (const f of flashes) assert.ok(lightningAt(f.at + 30, 1) > 0, `flash at ${f.at}`);
    // Every lit moment belongs to a flash that started at most 420 ms before.
    for (let t = from + 500; t < to; t += 37) {
        if (lightningAt(t, 1) > 0) assert.ok(flashes.some((f) => f.at <= t && t - f.at <= 420), `lit at ${t}`);
    }
    assert.deepEqual(lightningFlashes(from, to, 0.04), []);
    assert.ok(lightningFlashes(from, to, 0.3).length < flashes.length);
});

test("thunder follows each flash by its distance, the same for everyone, once per window", () => {
    const def = {...AMBIENT_THUNDER, ready: true};
    const from = Date.UTC(2026, 10, 11, 3);
    const span = 30 * 60_000;
    const whole = thunderClaps({fromMs: from, toMs: from + span, storm: 1}, def);
    assert.ok(whole.length > 30, `${whole.length} claps`);
    assert.deepEqual(whole, thunderClaps({fromMs: from, toMs: from + span, storm: 1}, def));
    const windows: typeof whole = [];
    for (let t = from; t < from + span; t += 1000) windows.push(...thunderClaps({fromMs: t, toMs: t + 1000, storm: 1}, def));
    assert.deepEqual(windows, whole);
    for (const c of whole) {
        assert.ok(c.at >= from && c.at < from + span);
        assert.ok(Math.abs(c.at - c.flashAt - (c.distanceKm / 0.343) * 1000) <= 1);
        assert.ok(c.distanceKm >= 0.6 && c.distanceKm <= 8);
        assert.equal(c.id, c.distanceKm < def.nearKm ? "thunder_near" : "thunder_far");
        assert.equal(c.url, `/ark/sound/ambient/${c.id}.webm`);
        assert.ok(c.gain > 0 && c.gain <= 1);
        assert.equal(c.pan, undefined);
    }
    const near = whole.filter((c) => c.id === "thunder_near");
    const far = whole.filter((c) => c.id === "thunder_far");
    assert.ok(near.length > 0 && far.length > near.length);
    assert.ok(Math.min(...near.map((c) => c.gain)) > Math.max(...far.map((c) => c.gain)) * 0.99);
    assert.ok(thunderClaps({fromMs: from, toMs: from + span, storm: 1, yaw: 0.4}, def).some((c) => typeof c.pan === "number"));
    assert.deepEqual(thunderClaps({fromMs: from, toMs: from + span, storm: 0}, def), []);
    assert.deepEqual(thunderClaps({fromMs: from, toMs: from + span, storm: 1}, {...def, ready: false}), []);
});
