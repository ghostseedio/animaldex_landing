import "@/lib/ark-world-v2-first";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {CORAL_TEXELS, coralCover, linearOf} from "@/ark-scene/coral-cover";
import {reefGrowth} from "@/ark-scene/reef";
import {PASS_SECONDS, SEA_FLIGHT_CLEAR, passAt, seaFlightAt, seaFlightKinds, seaFlightSpec, seaHome} from "@/ark-scene/sea-flight";
import {CRUISE_CYCLE, surfaceCruiseAt, surfaceCruiseKinds, surfaceCruiseSpec} from "@/ark-scene/surface-cruise";
import {RING_SECONDS, signRings, splashHeight, surfaceState, trackSurface, wakeLength, type SurfaceSample} from "@/ark-scene/surface-signs";
import {leapSpec} from "@/ark-scene/water-leaps";
import {fitInWater, type WaterSpec} from "@/ark-scene/sea-depth";
import {heightAt, TERRAIN_HALF} from "@/ark-scene/world";

const EPOCH = 1_795_521_600; // 2026-11-24 12:00 UTC
const root = path.resolve(__dirname, "..", "..");

// MARK: The rows come from the stored text

test("sea rows: only kinds whose own stored text says so, each with its quote", () => {
    assert.deepEqual(seaFlightKinds(), ["magnificent-frigatebird"]);
    assert.match(seaFlightSpec("magnificent-frigatebird")!.quote, /rode thermals by night as well as by day/);
    assert.equal(seaFlightSpec("herring-gull"), null);
    assert.deepEqual(surfaceCruiseKinds(), ["giant-oceanic-manta-ray"]);
    assert.match(surfaceCruiseSpec("giant-oceanic-manta-ray")!.quote, /spends much time near the surface/);
    const cruise = surfaceCruiseSpec("giant-oceanic-manta-ray")!;
    assert.deepEqual(cruise.depth, [0.3, 1.0]);
    // No breach: the manta's stored text never says it leaves the water (no leap row; the cruise row's file says why).
    assert.equal(leapSpec("giant-oceanic-manta-ray"), null);
    const about = JSON.parse(readFileSync(path.join(root, "src/ark-scene/surface-cruise.json"), "utf8")).about as string;
    assert.match(about, /never says it leaves the water/);
});

// MARK: The manta at the top

test("manta: at the top for its share of the time, its back 0.3–1 m under, easing in and out; the same for every viewer", () => {
    const id = "f9abebf2-manta";
    let up = 0;
    let jumps = 0;
    let last = surfaceCruiseAt(id, "giant-oceanic-manta-ray", EPOCH).k;
    for (let t = 0; t < CRUISE_CYCLE * 4; t += 1) {
        const at = surfaceCruiseAt(id, "giant-oceanic-manta-ray", EPOCH + t);
        assert.ok(at.k >= 0 && at.k <= 1);
        if (at.k > 0.99) {
            up++;
            assert.ok(at.depth >= 0.3 - 1e-9 && at.depth <= 1.0 + 1e-9, `depth ${at.depth}`);
        }
        if (Math.abs(at.k - last) > 0.1) jumps++;
        last = at.k;
        assert.deepEqual(at, surfaceCruiseAt(id, "giant-oceanic-manta-ray", EPOCH + t));
    }
    const share = up / (CRUISE_CYCLE * 4);
    assert.ok(share > 0.25 && share < 0.4, `share at the top ${share.toFixed(2)}`);
    assert.equal(jumps, 0, "it eases up and down, never jumps");
    assert.equal(surfaceCruiseAt(id, "blue-whale", EPOCH).k, 0);
    // In the water's fit (the scene fits it again at its drawn height): up at the top its middle is `depth` under, so the
    // wingtips of a 2 m tall drawn manta break the surface; in its band it stays under.
    const band: WaterSpec = {motion: "swim", floorY: -40, depth: 4, aboveFloor: false, breath: 0};
    assert.ok(fitInWater(band, 2).base + 2 < 0);
    const top = fitInWater({...band, cruise: {k: 1, depth: 0.5}}, 2);
    assert.ok(Math.abs(top.middle + 0.5) < 1e-9 && top.base + 2 > 0);
});

// MARK: The frigatebird on the wing

test("frigatebird: soars over open water, climbs and glides, passes low only over water, moves every second", () => {
    const spec = seaFlightSpec("magnificent-frigatebird")!;
    const id = "2f58f271-frigate";
    // Its live place (the census, 2026-11-24): 205, 15, 18 m of water a little off the east coast.
    const home = seaHome({x: 205, z: 15}, heightAt);
    for (let k = 0; k < 16; k++) assert.ok(heightAt(home.x + Math.cos((k / 16) * Math.PI * 2) * SEA_FLIGHT_CLEAR, home.z + Math.sin((k / 16) * Math.PI * 2) * SEA_FLIGHT_CLEAR) < -1, "open water all round its home");
    const water = (x: number, z: number) => heightAt(x, z) < -0.5;
    let low = 0;
    let lowOverLand = 0;
    let highest = 0;
    let lowest = Infinity;
    let prev = seaFlightAt(id, spec, home, EPOCH, water);
    for (let t = 1; t < 3600; t++) {
        const at = seaFlightAt(id, spec, home, EPOCH + t, water);
        const moved = Math.hypot(at.x - prev.x, at.z - prev.z);
        assert.ok(moved > 3 && moved < 12, `moved ${moved.toFixed(2)} m in a second`);
        highest = Math.max(highest, at.altitude);
        lowest = Math.min(lowest, at.altitude);
        if (at.low > 0.99) {
            low++;
            if (!water(at.x, at.z)) lowOverLand++;
        }
        prev = at;
    }
    assert.ok(highest > 40 && lowest < 1, `${lowest.toFixed(1)}–${highest.toFixed(1)} m`);
    assert.ok(low > 0, "it passes low over the water");
    assert.ok(lowOverLand <= 2, "a low pass is over the water");
    // A pass: down, along, up; then nothing until the next.
    const pass = Array.from({length: 400}, (_, t) => passAt(id, spec, EPOCH + t).low);
    assert.ok(pass.some((v) => v === 1) && pass.filter((v) => v > 0).length <= 3 * PASS_SECONDS);
});

// MARK: The signs on the surface

const sample = (top: number, x = 0, length = 1): SurfaceSample => ({x, z: 0, yaw: 0, top, bottom: top - 0.5, surface: 0, length, breathes: true});

test("surface signs: a break as it comes up (and a blow for a breather), a ring as it goes down, a wake only swimming at the top", () => {
    assert.equal(surfaceState(-0.5, -1, 0), "under");
    assert.equal(surfaceState(0.2, -0.3, 0), "at");
    assert.equal(surfaceState(1.2, 0.6, 0), "air");
    let step = trackSurface(null, sample(-0.4), EPOCH);
    assert.equal(step.event, null);
    step = trackSurface(step.track, sample(0.1), EPOCH + 0.1);
    assert.equal(step.event?.kind, "break");
    assert.equal(step.event?.blow, true);
    assert.ok(splashHeight(step.event!, 0.3) > 0.2);
    assert.equal(signRings(step.event!, RING_SECONDS + 0.1).length, 0);
    assert.equal(signRings(step.event!, 1).length, 2);
    // Swimming along the top at 0.8 m/s: a wake; held still: none.
    let track = step.track;
    let wake = 0;
    for (let i = 1; i <= 20; i++) {
        const next = trackSurface(track, sample(0.1, i * 0.08), EPOCH + 0.1 + i * 0.1);
        track = next.track;
        wake = next.wake;
    }
    assert.ok(wake > 0.5, `wake ${wake}`);
    // A second look in the same frame keeps its speed (the wake does not flicker off).
    const again = trackSurface(track, sample(0.1, 20 * 0.08), EPOCH + 0.1 + 20 * 0.1);
    assert.equal(again.track.speed, track.speed);
    assert.ok(again.wake > 0.5);
    for (let i = 0; i < 20; i++) {
        const next = trackSurface(track, sample(0.1, 1.6), EPOCH + 2.2 + i * 0.1);
        track = next.track;
        wake = next.wake;
    }
    assert.ok(wake < 0.05, `still: wake ${wake}`);
    const down = trackSurface(track, sample(-0.4, 1.6), EPOCH + 4.3);
    assert.equal(down.event?.kind, "dive");
    // A gap (not drawn, out of range): starts over, nothing told about it.
    assert.equal(trackSurface(down.track, sample(0.1, 1.6), EPOCH + 9).event, null);
    assert.ok(wakeLength(4.5, 1) <= 10 && wakeLength(1, 0.5) >= 1.4);
});

// MARK: The reef from above

test("coral cover: the reef's own growths where they grow, their own colours, nothing over land", () => {
    const items = reefGrowth();
    const cover = coralCover(items, TERRAIN_HALF);
    assert.equal(cover.length, CORAL_TEXELS * CORAL_TEXELS * 4);
    const texel = (2 * TERRAIN_HALF) / CORAL_TEXELS;
    let covered = 0;
    for (let i = 0; i < CORAL_TEXELS * CORAL_TEXELS; i++) {
        if (!cover[i * 4 + 3]) continue;
        covered++;
        const x = -TERRAIN_HALF + ((i % CORAL_TEXELS) + 0.5) * texel;
        const z = -TERRAIN_HALF + (Math.floor(i / CORAL_TEXELS) + 0.5) * texel;
        assert.ok(heightAt(x, z) < 0.5, `cover over land at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    }
    assert.ok(covered > 500, `covered texels ${covered}`);
    // Its colours are the reef's own (each texel's a mix of the growths' there, softened at their edges: within their range).
    const own = items.map((item) => linearOf(item.color).map((c) => Math.round(Math.min(c, 1) * 255)));
    for (let c = 0; c < 3; c++) {
        const low = Math.min(...own.map((rgb) => rgb[c]));
        const high = Math.max(...own.map((rgb) => rgb[c]));
        for (let i = 0; i < CORAL_TEXELS * CORAL_TEXELS; i += 7) if (cover[i * 4 + 3]) assert.ok(cover[i * 4 + c] >= low - 1 && cover[i * 4 + c] <= high + 1);
    }
    assert.deepEqual(coralCover(items, TERRAIN_HALF), cover, "the same for every viewer");
});
