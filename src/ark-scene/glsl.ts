/**
 * Shader pieces every Ark material shares: one clock, the drifting cloud
 * shadows, and value noise in world space.
 */

import {Vector2, Vector3} from "three";

/** Seconds, for water, wind, clouds and anything else that moves on its own. */
export const ARK_TIME = {value: 0};
/** Where the sun is (normalised, pointing at it). */
export const ARK_SUN = {value: new Vector3(-0.8, 0.32, -0.5).normalize()};
/** Wind: direction and strength, for grass, reeds, trees and clouds. */
export const ARK_WIND = {value: new Vector2(0.8, 0.35)};

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
