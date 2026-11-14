import assert from "node:assert/strict";
import test from "node:test";
import {equirectSkyLight, generatedSkyLight, skyRadiance, type Rgb} from "@/ark-scene/sky-light";
import {daylightAt, sunElevation} from "@/lib/ark-daylight";

const SKY = {turbidity: 3.2, rayleigh: 1.8, mieCoefficient: 0.003, mieDirectionalG: 0.82};
const HORIZON: Rgb = [0.033, 0.061, 0.156];
const ZENITH: Rgb = [0.005, 0.011, 0.037];

test("the generated sky's radiance is finite and positive in every direction, the sun up or down", () => {
    for (const elevation of [-30, -2, 0, 5, 12, 45, 80]) {
        for (const [x, y, z] of [[1, 0, 0], [0, 1, 0], [0, -1, 0], [-0.7, 0.1, 0.7], [0.5, 0.5, -0.7]]) {
            const length = Math.hypot(x, y, z);
            const c = skyRadiance(x / length, y / length, z / length, (elevation * Math.PI) / 180, SKY);
            for (const v of c) assert.ok(Number.isFinite(v) && v > 0, `${elevation}° toward ${x},${y},${z}: ${c}`);
        }
    }
});

test("the sky's light on the ground falls steadily as the sun goes down, and by a third or so every three degrees near the horizon", () => {
    let last = Infinity;
    for (let elevation = 40; elevation >= -2; elevation -= 1) {
        const light = generatedSkyLight(elevation, 0, HORIZON, ZENITH, SKY);
        assert.ok(light < last, `${elevation}°: ${light} under ${last}`);
        last = light;
    }
    // (Why a picture of the sky kept for three degrees stepped: the light it stands for has moved on this much.)
    const at = (elevation: number) => generatedSkyLight(elevation, 0, HORIZON, ZENITH, SKY);
    assert.ok(at(1.5) / at(4.5) < 0.75 && at(-1.5) / at(1.5) < 0.6);
    // A degree at a time (how often the picture is made again while the sun is low) it is a third at most, at the
    // horizon itself: the strength follows the sun between pictures, whatever the step.
    for (let elevation = 12; elevation >= -1; elevation -= 1) assert.ok(at(elevation - 1) / at(elevation) > (elevation > 2 ? 0.8 : 0.6), `${elevation}°`);
});

test("under the full night dome the sky's light is the dome's own, whatever the sun's depth", () => {
    const a = generatedSkyLight(-20, 1, HORIZON, ZENITH, SKY);
    const b = generatedSkyLight(-50, 1, HORIZON, ZENITH, SKY);
    assert.equal(a, b);
    assert.ok(a > 0 && a < generatedSkyLight(12, 0, HORIZON, ZENITH, SKY) / 5);
});

test("a photographed sky's light: a flat picture gives its own value, a bright sun high up counts for more than one at the horizon or under it", () => {
    const width = 64;
    const height = 32;
    const flat = new Float32Array(width * height * 4).fill(0.5);
    assert.ok(Math.abs(equirectSkyLight((i) => flat[i], width, height, 4) - 0.5) < 1e-6);
    const withSun = (row: number) => {
        const data = new Float32Array(width * height * 4).fill(0.5);
        for (let k = 0; k < 3; k++) data[(row * width + 10) * 4 + k] = 500;
        return equirectSkyLight((i) => data[i], width, height, 4);
    };
    assert.ok(withSun(4) > withSun(15) && withSun(15) > withSun(20) && withSun(20) > 0.5);
});

test("the two skies in one measure: a generated sky as bright all round as a flat picture reads the same", () => {
    // Full night, the dome one colour: a flat sky of that colour's luminance (plus the stars' 0.003).
    const grey: Rgb = [0.2, 0.2, 0.2];
    assert.ok(Math.abs(generatedSkyLight(-40, 1, grey, grey, SKY) - 0.203) < 1e-9);
});

test("the light that casts shadows fades to nothing where the sun hands over to the moon, and is unchanged away from it", () => {
    // The hour the sun is 2° under the horizon, evening and morning.
    for (const [from, to] of [[17.5, 18.8], [5.2, 6.5]]) {
        let last = daylightAt(from).light;
        let least = Infinity;
        for (let h = from; h <= to; h += 1 / 720) {
            const light = daylightAt(h).light;
            // Five seconds apart (the scene's light tick): never a jump in strength where the light changes side.
            if (Math.abs(light.azimuth - last.azimuth) > 90) assert.ok(light.intensity < 0.02 && last.intensity < 0.02, `swap at ${h}: ${last.intensity} → ${light.intensity}`);
            assert.ok(Math.abs(light.intensity - last.intensity) < 0.03, `at ${h}`);
            least = Math.min(least, light.intensity);
            last = light;
        }
        assert.ok(least < 0.01);
    }
    // From 1° up the sun is as it was (0.35 + 0.65 × its rise), from 5° under the moon is.
    const smooth = (t: number) => {
        const c = Math.min(Math.max(t, 0), 1);
        return c * c * (3 - 2 * c);
    };
    for (const h of [6.2, 7, 12, 17, 17.8]) {
        const e = sunElevation(h);
        assert.ok(e > 1);
        const day = daylightAt(h);
        const key = day.light.intensity / (0.35 + 0.65 * smooth((e + 2) / 6));
        assert.ok(key > 1.5 && key < 3, `${h}: ${key}`);
    }
    assert.equal(daylightAt(22).light.elevation, 38);
    assert.ok(Math.abs(daylightAt(22).light.intensity - 2.7) < 1e-9);
});
