/**
 * Shader pieces every Ark material shares: one clock, the drifting cloud
 * shadows, and value noise in world space.
 */

import {Color, Vector2, Vector3} from "three";

/** Seconds, for water, wind, clouds and anything else that moves on its own. */
export const ARK_TIME = {value: 0};
/** Where the sun is (normalised, pointing at it). */
export const ARK_SUN = {value: new Vector3(-0.8, 0.32, -0.5).normalize()};
/**
 * The light of the hour (`daylight.ts`), for the materials that light
 * themselves: the water's sky and body, the icons. 1 at full day, about 0.2
 * at night.
 */
export const ARK_DAYLIGHT = {value: 1};
/** The sky's horizon and zenith as the water reflects them, and the glint's colour (the sun's, or the moon's). */
export const ARK_SKY_HORIZON = {value: new Color("#e3d4bf")};
export const ARK_SKY_ZENITH = {value: new Color("#7fa2c0")};
export const ARK_GLINT = {value: new Color("#fff0d6")};
/** The warm rim on the animals (`animal-material.ts`): its colour times its strength this hour. */
export const ARK_RIM = {value: new Color(1.0, 0.82, 0.6).multiplyScalar(0.22)};
/** Wind: direction and strength, for grass, reeds, trees and clouds. */
export const ARK_WIND = {value: new Vector2(0.8, 0.35)};
/**
 * The weather and tide the scene is drawn with (graphics pass; the island clock `src/lib/ark-clock.ts` drives them,
 * `ArkSceneHandle.setEnvironment` pins them): sea level (m), ground wetness, snow cover, wind and storm (0–1), rain.
 */
export const ARK_ENV = {seaLevel: {value: 0}, wetness: {value: 0}, snow: {value: 0}, wind: {value: 0.35}, storm: {value: 0}, cloud: {value: 0.3}, /** Rain falling now, 0–1 (the town's puddles ripple). */ rain: {value: 0}};

export const NOISE_GLSL = `
float arkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float arkNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(arkHash(i), arkHash(i + vec2(1.0, 0.0)), f.x), mix(arkHash(i + vec2(0.0, 1.0)), arkHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float arkFbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        sum += amplitude * arkNoise(p);
        p = p * 2.03 + vec2(17.3, -9.1);
        amplitude *= 0.5;
    }
    return sum / 0.9375;
}
`;

/** Cloud shadows drifting over the world: 1 in sun, about 0.8 under a cloud. */
export const CLOUD_GLSL = `
uniform float arkTime;
uniform vec2 arkWind;
float arkCloudShade(vec3 world) {
    vec2 p = world.xz * 0.011 - arkWind * arkTime * 0.016;
    float cloud = smoothstep(0.5, 0.85, arkFbm(p));
    return 1.0 - 0.2 * cloud;
}
`;

/**
 * The far markers' light for the hour (the dots over animals too small or too far to see and over the other island's
 * animals, `marks.ts` FindDots; the icon tokens, `icons.ts`): `arkMarkerLight(daylight)` times their colour, from
 * `ARK_DAYLIGHT` (1 by day, 0.34 deep in the night, smooth through dusk and dawn). They are drawn unlit, so without it
 * they kept their day brightness at night: cream dots brighter than the street lamps and the lit windows, in swarms
 * over the town and the forest, the brightest things in a night picture. By day they are as they were; at night a pale
 * moonlit blue about a third as bright: still the lightest marks on the dark ground, never as light as a lamp or a
 * lit window.
 */
export const MARKER_LIGHT_GLSL = `
vec3 arkMarkerLight(float daylight) {
    // (From the blue hour's level up: the land is at its darkest between sunset and moonlight, daylight 0.34 to 0.46,
    // and the markers hold their night level through it.)
    return mix(vec3(0.28, 0.325, 0.42), vec3(1.0), smoothstep(0.46, 1.0, daylight));
}
`;
