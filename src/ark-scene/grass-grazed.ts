/**
 * Grazed grass (AnimalDex decision 417 (1), lane ARK-FOOD-B): the record's vegetation (`/api/ark/vegetation`, the
 * server's `voyage_vegetation_public_v1`: per island and zone the standing plant food as a share of what the ground
 * holds, 0-1) drawn on the grass tufts. Where it is overgrazed the tufts thin out (a share of them, by a hash of where
 * each stands, so the same ones go first and come back last), shorten and dry towards straw; as it regrows they come
 * back. Visual only, and only the record's own numbers.
 *
 * Lazy: nothing here touches the grass until a level comes in. Until then (vegetation off on the server, the function
 * missing, an old page) the grass material, its program and its buffers are exactly as before. On the first level the
 * tufts get one more per-instance float (their zone, `arkGrassZone`) and the material its define (one recompile).
 *
 * Words: `grassWord` gives the card's and the tap's "plenty / thinning / grazed bare" from the same thresholds as the
 * engine (vegetation.ts: plenty from half of what the ground holds, the point of fastest regrowth; bare under 0.15).
 */

import type {Material} from "three";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";

export const GRAZED_ZONES: readonly ArkZone[] = ARK_ZONES;
/** Each zone's level, by its index in `GRAZED_ZONES` (1 = as lush as the ground holds). */
export const ARK_GRAZED = {value: new Float32Array(16).fill(1)};

export type GrassWord = "plenty" | "thinning" | "bare";

/** The engine's thresholds (AnimalDex vegetation.ts THINNING_BELOW, BARE_BELOW). */
export function grassWord(level: number): GrassWord {
    return level < 0.15 ? "bare" : level < 0.5 ? "thinning" : "plenty";
}

/** The record's vegetation as the scene keeps it: each `island|zone`'s level (grass and browse), null while off. */
export type ArkVegetation = {day: number | null; levels: Map<string, number>};

/** The read's body (`{vegetation: {day, zones: {"wild|grassland": {level, grass?, ...}}} | null}`) decoded, or null. */
export function decodeVegetation(raw: unknown): ArkVegetation | null {
    if (!raw || typeof raw !== "object") return null;
    const zones = (raw as {zones?: unknown}).zones;
    if (!zones || typeof zones !== "object" || Array.isArray(zones)) return null;
    const levels = new Map<string, number>();
    for (const [key, value] of Object.entries(zones as Record<string, unknown>)) {
        const level = Number((value as {level?: unknown} | null)?.level);
        if (/^[a-z_]+\|[a-z_]+$/.test(key) && Number.isFinite(level)) levels.set(key, Math.min(Math.max(level, 0), 1));
    }
    if (!levels.size) return null;
    const day = Number((raw as {day?: unknown}).day);
    return {day: Number.isFinite(day) ? day : null, levels};
}

/** The wild island's levels laid into the uniform (zones without a patch stay lush). */
export function setGrazedLevels(vegetation: ArkVegetation | null) {
    const out = ARK_GRAZED.value;
    out.fill(1);
    if (!vegetation) return;
    GRAZED_ZONES.forEach((zone, i) => {
        const level = vegetation.levels.get(`wild|${zone}`);
        if (level !== undefined && i < out.length) out[i] = level;
    });
}

/**
 * Thins, shortens and dries a grass material's tufts by their zone's level, once `ARK_GRAZED` is defined on it
 * (`material.defines.ARK_GRAZED`; the tufts' `arkGrassZone` attribute then exists). Before that, nothing is injected.
 * Put after `withGrassPress` (it hooks the same place, after the press).
 */
export function withGrazing<M extends Material>(material: M): M {
    const base = material.onBeforeCompile.bind(material);
    const key = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => (material.defines?.ARK_GRAZED ? `${key()}-grazed` : key());
    material.onBeforeCompile = (shader, renderer) => {
        base(shader, renderer);
        if (!material.defines?.ARK_GRAZED) return;
        shader.uniforms.arkGrazed = ARK_GRAZED;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
uniform float arkGrazed[16];
attribute float arkGrassZone;`).replace("#include <project_vertex>", `#ifdef USE_INSTANCING
{
    float grazedLevel = arkGrazed[int(arkGrassZone + 0.5)];
    if (grazedLevel < 0.999) {
        vec2 grazedRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        float grazedHash = fract(sin(dot(grazedRoot, vec2(12.9898, 78.233))) * 43758.5453);
        // Lush (half of what the ground holds, or more): every tuft. Grazed bare: one in seven, cropped short.
        float grazedKeep = 0.15 + 0.85 * smoothstep(0.05, 0.5, grazedLevel);
        float grazedTall = mix(0.3, 1.0, smoothstep(0.08, 0.6, grazedLevel));
        transformed.y *= grazedTall;
        if (grazedHash > grazedKeep) transformed = vec3(0.0);
        #ifdef USE_COLOR
        vColor.rgb = mix(vColor.rgb, vColor.rgb * vec3(1.18, 1.0, 0.55) + vec3(0.06, 0.04, 0.0), 1.0 - smoothstep(0.1, 0.6, grazedLevel));
        #endif
    }
}
#endif
#include <project_vertex>`);
    };
    return material;
}
