import assert from "node:assert/strict";
import test from "node:test";
import {
    animalPersonality,
    animalVariation,
    ARK_DAY_MS,
    ARK_VARIATION_STRIDE,
    ARK_WEATHER_KINDS,
    arkDayAt,
    dawnChorus,
    dawnDusk,
    hash32,
    islandHours,
    lightningAt,
    M2_HOURS,
    moonAt,
    seaLevelAt,
    shoreAt,
    tideAt,
    unit,
    variationAttributes,
    weatherAt,
    weatherOfPeriod,
    type ArkWeatherKind
} from "@/lib/ark-clock";
import {sunElevation} from "@/lib/ark-daylight";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const START = Date.UTC(2026, 10, 1, 0, 0);
const CLOCK = {voyageStartMs: START, seed: "ark"};

/** Runs `body` with Math.random and Date.now poisoned: the clock must not read either. */
function withoutViewerState<T>(body: () => T): T {
    const random = Math.random;
    const now = Date.now;
    Math.random = () => {
        throw new Error("Math.random read");
    };
    Date.now = () => {
        throw new Error("Date.now read");
    };
    try {
        return body();
    } finally {
        Math.random = random;
        Date.now = now;
    }
}

test("ark-clock: the same moment and ids give the same answers, without Math.random or the viewer's clock", () => {
    const moments = [START + 5 * HOUR, Date.UTC(2026, 11, 24, 6, 30), Date.UTC(2027, 5, 21, 18, 5)];
    const first = withoutViewerState(() => moments.map((ms) => [weatherAt(ms, CLOCK), tideAt(ms), moonAt(ms), lightningAt(ms, 1)]));
    const second = withoutViewerState(() => moments.map((ms) => [weatherAt(ms, CLOCK), tideAt(ms), moonAt(ms), lightningAt(ms, 1)]));
    assert.deepEqual(first, second);
    const ids = ["a1b2c3", "8f2e-11", "ffffffff-ffff-ffff-ffff-ffffffffffff"];
    assert.deepEqual(
        withoutViewerState(() => ids.map((id) => [animalVariation(id), animalPersonality(id)])),
        withoutViewerState(() => ids.map((id) => [animalVariation(id), animalPersonality(id)]))
    );
    // A fresh module instance (another viewer's page) agrees too: no module state.
    assert.equal(hash32("x", 3), hash32("x", 3));
    assert.notEqual(hash32("x", 3), hash32("x", 4));
    assert.notEqual(hash32("a", "b"), hash32("ab"));
});

test("ark-clock: hashes spread evenly", () => {
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) bins[Math.floor(unit("spread", i) * 10)]++;
    for (const n of bins) assert.ok(n > 1800 && n < 2200, `bin ${n}`);
});

test("ark-clock: Ark days count like the server (1 Ark year = 14 real days)", () => {
    assert.equal(arkDayAt(START, START), 0);
    assert.equal(arkDayAt(START + 14 * DAY, START), 365);
    assert.ok(Math.abs(ARK_DAY_MS / 60000 - 55.23) < 0.01);
    assert.equal(islandHours(Date.UTC(2026, 10, 11, 7, 30)), 7.5);
    assert.equal(islandHours(Date.UTC(2026, 10, 11, 23, 0), 2), 1);
});

test("ark-clock: dawn and dusk sit on the scene's own sun", () => {
    const d = dawnDusk();
    assert.ok(Math.abs(d.sunrise - 6) < 1e-9 && Math.abs(d.sunset - 18) < 1e-9);
    assert.ok(Math.abs(sunElevation(d.dawn) + 6) < 1e-6 && Math.abs(sunElevation(d.dusk) + 6) < 1e-6);
    assert.ok(d.dawn < d.sunrise && d.dusk > d.sunset);
    assert.equal(dawnChorus(12), 0);
    assert.equal(dawnChorus(0), 0);
    assert.ok(dawnChorus(d.sunrise) > 0.5);
});

test("ark-clock: the moon follows the real synodic month", () => {
    // The 2024-04-08 eclipse's new moon (18:21 UTC) and the 2025-03-14 eclipse's full moon (06:55 UTC).
    const newMoon = moonAt(Date.UTC(2024, 3, 8, 18, 21));
    assert.ok(newMoon.phase < 0.03 || newMoon.phase > 0.97, `new ${newMoon.phase}`);
    const full = moonAt(Date.UTC(2025, 2, 14, 6, 55));
    assert.ok(Math.abs(full.phase - 0.5) < 0.03, `full ${full.phase}`);
    assert.ok(full.illumination > 0.99 && newMoon.illumination < 0.01, `${full.illumination} ${newMoon.illumination}`);
});

test("ark-clock: about two highs and two lows a day, 50 minutes later each day, springs bigger than neaps", () => {
    const from = Date.UTC(2026, 10, 9, 0, 0);
    let highs = 0;
    let lows = 0;
    let prev = tideAt(from).height;
    let prevDelta = 0;
    const highTimes: number[] = [];
    for (let m = 1; m <= 24 * 60 * 3; m++) {
        const ms = from + m * 60000;
        const h = tideAt(ms).height;
        const delta = h - prev;
        if (prevDelta > 0 && delta <= 0) {
            highs++;
            highTimes.push(ms);
        }
        if (prevDelta < 0 && delta >= 0) lows++;
        prev = h;
        prevDelta = delta;
    }
    assert.ok(highs >= 5 && highs <= 6, `highs ${highs} in 3 days`);
    assert.ok(lows >= 5 && lows <= 6, `lows ${lows} in 3 days`);
    // Highs about 12 h 25 min apart.
    const gap = (highTimes[1] - highTimes[0]) / HOUR;
    assert.ok(Math.abs(gap - M2_HOURS) < 0.05, `gap ${gap}`);
    // nextHigh agrees with the scan.
    const before = tideAt(highTimes[1] - 30 * 60000);
    assert.ok(Math.abs(before.nextHigh - highTimes[1]) < 2 * 60000);
    assert.equal(before.rising, true);
    // Springs (a day or two after new/full moon) beat neaps (after the quarters).
    const spring = tideAt(Date.UTC(2026, 10, 10, 18, 0));
    const neap = tideAt(Date.UTC(2026, 10, 18, 12, 0));
    assert.ok(spring.amplitude > 0.95 && neap.amplitude < 0.62, `${spring.amplitude} ${neap.amplitude}`);
    assert.ok(spring.spring > 0.9 && neap.spring < 0.15);
});

test("ark-clock: the sea-level adapter and the shore at low and high water", () => {
    const config = {mean: -0.2, springRange: 0.6};
    for (let h = 0; h < 48; h += 0.5) {
        const ms = Date.UTC(2026, 10, 10, 0, 0) + h * HOUR;
        const level = seaLevelAt(ms, config);
        assert.ok(level >= -0.5 - 1e-9 && level <= 0.1 + 1e-9);
    }
    assert.ok(shoreAt({height: -0.9}).shoreFeeding && !shoreAt({height: -0.9}).avoidWaterline);
    assert.ok(shoreAt({height: 0.9}).avoidWaterline && shoreAt({height: 0.9}).poolsExposed === 0);
    assert.ok(!shoreAt({height: 0}).shoreFeeding && !shoreAt({height: 0}).avoidWaterline);
});

test("ark-clock: weather per Ark day, every kind seen, spells and seasons, the same for everyone", () => {
    const counts = new Map<ArkWeatherKind, number>();
    let repeats = 0;
    let prev: ArkWeatherKind | null = null;
    for (let i = 0; i < 4000; i++) {
        const kind = weatherOfPeriod(i, CLOCK);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
        if (kind === prev) repeats++;
        prev = kind;
    }
    for (const kind of ARK_WEATHER_KINDS) assert.ok((counts.get(kind) ?? 0) > 0, `never ${kind}`);
    assert.ok((counts.get("clear") ?? 0) > (counts.get("storm") ?? 0) * 4, "storms are occasional");
    assert.ok(repeats / 4000 > 0.3, `spells: ${repeats / 4000}`);
    // Another voyage (another seed) has its own weather.
    let differ = 0;
    for (let i = 0; i < 200; i++) if (weatherOfPeriod(i, CLOCK) !== weatherOfPeriod(i, {...CLOCK, seed: "other"})) differ++;
    assert.ok(differ > 60);
});

test("ark-clock: fog only in the early morning; storms never straight out of a clear sky", () => {
    const [from, to] = dawnDusk().mist;
    for (let i = 0; i < 3000; i++) {
        const kind = weatherOfPeriod(i, CLOCK);
        const mid = START + (i + 0.5) * ARK_DAY_MS;
        if (kind === "fog") {
            const h = islandHours(mid);
            assert.ok(h >= from && h <= to, `fog at ${h}`);
        }
    }
});

test("ark-clock: weather turns smoothly, wet ground lags and dries, rainbows follow rain", () => {
    let maxStep = 0;
    let prev = weatherAt(START, CLOCK);
    let sawRainbow = false;
    let sawPuddles = false;
    let sawDryingAfterRain = false;
    for (let s = 60; s < 30 * DAY / 1000; s += 60) {
        const w = weatherAt(START + s * 1000, CLOCK);
        maxStep = Math.max(maxStep, Math.abs(w.cloud - prev.cloud), Math.abs(w.rain - prev.rain), Math.abs(w.wind - prev.wind), Math.abs(w.wetness - prev.wetness));
        if (w.rainbow > 0.2) {
            sawRainbow = true;
            assert.ok(w.rain < 0.2);
        }
        if (w.puddles > 0.3) sawPuddles = true;
        if (w.rain === 0 && w.wetness > 0.2) sawDryingAfterRain = true;
        for (const key of ["cloud", "rain", "wind", "fog", "storm", "wetness", "puddles", "rainbow", "cold", "insects"] as const) {
            assert.ok(w[key] >= 0 && w[key] <= 1, `${key} ${w[key]}`);
        }
        prev = w;
    }
    // One minute never jumps more than a sixth of the range.
    assert.ok(maxStep < 0.17, `step ${maxStep}`);
    assert.ok(sawRainbow && sawPuddles && sawDryingAfterRain);
});

test("ark-clock: snow on the mountain when cold, behaviour hints follow the weather", () => {
    let winterSnow = 0;
    let summerSnow = 0;
    for (let i = 0; i < 400; i++) {
        winterSnow = Math.max(winterSnow, weatherAt(Date.UTC(2027, 0, 10) + i * ARK_DAY_MS, CLOCK).mountainSnowfall);
        summerSnow = Math.max(summerSnow, weatherAt(Date.UTC(2027, 6, 10) + i * ARK_DAY_MS, CLOCK).mountainSnowfall);
    }
    assert.ok(winterSnow > 0.5 && summerSnow < 0.05, `${winterSnow} ${summerSnow}`);
    assert.ok(weatherAt(Date.UTC(2027, 0, 10), CLOCK).mountainSnowCover > weatherAt(Date.UTC(2027, 6, 10), CLOCK).mountainSnowCover);
    // A storm period grounds the birds and sends animals to cover.
    for (let i = 0; i < 3000; i++) {
        if (weatherOfPeriod(i, CLOCK) !== "storm") continue;
        const w = weatherAt(START + (i + 0.8) * ARK_DAY_MS, CLOCK);
        assert.ok(w.hints.birdsGrounded && w.hints.seekCover && w.insects < 0.2);
        assert.ok(lightningAt(START, 0) === 0);
        return;
    }
    assert.fail("no storm in 3000 periods");
});

test("ark-clock: lightning flashes now and then in a storm only", () => {
    let flashes = 0;
    for (let ms = 0; ms < 10 * 60000; ms += 50) if (lightningAt(START + ms, 1) > 0.5) flashes++;
    assert.ok(flashes > 3, `${flashes}`);
    for (let ms = 0; ms < 60000; ms += 50) assert.equal(lightningAt(START + ms, 0), 0);
});

test("ark-clock: each animal varies a little, never so much the species changes", () => {
    const sizes: number[] = [];
    const labels = new Map<string, number>();
    const attributes = new Float32Array(ARK_VARIATION_STRIDE * 2000);
    for (let i = 0; i < 2000; i++) {
        const id = `animal-${i}`;
        const v = animalVariation(id);
        sizes.push(v.size);
        assert.ok(v.size >= 0.92 && v.size <= 1.08);
        assert.ok(Math.abs(v.hue) <= 0.02 && Math.abs(v.saturation - 1) <= 0.07 && Math.abs(v.brightness - 1) <= 0.08);
        assert.ok(v.idleRate >= 0.88 && v.idleRate <= 1.12 && v.idlePhase >= 0 && v.idlePhase < 1);
        variationAttributes(id, attributes, i * ARK_VARIATION_STRIDE);
        assert.ok(Math.abs(attributes[i * ARK_VARIATION_STRIDE] - v.size) < 1e-6);
        const p = animalPersonality(id);
        labels.set(p.label, (labels.get(p.label) ?? 0) + 1);
        assert.ok(p.personalSpace > 0.6 && p.personalSpace < 1.4 && p.fleeDistance > 0.6 && p.fleeDistance < 1.4);
        assert.ok(p.glanceRate >= 0.6 && p.glanceRate <= 1.8 && p.fleeDelay >= 0.1 && p.fleeDelay <= 0.6);
        if (p.label === "bold") assert.ok(p.personalSpace < 1 && p.fleeDistance < 1);
        if (p.label === "shy") assert.ok(p.personalSpace > 1 && p.fleeDistance > 1);
    }
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    assert.ok(Math.abs(mean - 1) < 0.01);
    const looks = new Set(Array.from({length: 2000}, (_, i) => {
        const v = animalVariation(`animal-${i}`);
        return [v.size, v.hue, v.brightness, v.idlePhase].map((n) => n.toFixed(3)).join("/");
    }));
    assert.equal(looks.size, 2000, "no two alike");
    for (const label of ["bold", "shy", "curious", "steady"]) assert.ok((labels.get(label) ?? 0) > 100, `${label}: ${labels.get(label)}`);
});
