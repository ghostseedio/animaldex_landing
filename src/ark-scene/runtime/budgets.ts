/**
 * Memory budgets per quality tier (runtime lane, docs/ark/runtime.md).
 *
 * The scenery's cost is fixed per tier (the ground, trees and grass a tier
 * draws); what grows with the Ark is the animals: per species a near and a
 * far model, each with its own 512² skin. At 150 species that is ~400 MB of
 * textures if nothing is done, past what a phone's WebView keeps before it
 * loses the GPU context. So per tier:
 *
 * - skins are fitted on load (`nearTexture`, `farTexture`: the longest edge,
 *   a far model is a few dozen pixels on screen);
 * - the animal models' bytes have a ceiling (`textureMB`, `geometryMB`):
 *   past it, the near level of the species drawn near least recently is let
 *   go (the far one stands in, and the near one comes back when it is close
 *   again);
 * - the instance caps (`caps`) bound how many are drawn as models at all;
 * - the grass is built for the tier (`grass`), not for the highest one.
 *
 * Every drop is graceful: a level of detail, never an animal.
 */

import type {QualityTier} from "@/ark-scene/post";

export type ArkCaps = {near: number; nearSpecies: number; models: number};

export type ArkBudget = {
    /** The animal models' skins and meshes, MB (GPU, estimated by `memory.ts`). */
    textureMB: number;
    geometryMB: number;
    /** Longest edge of a skin, per level, after loading. */
    nearTexture: number;
    farTexture: number;
    caps: ArkCaps;
};

export const ARK_BUDGETS: Record<QualityTier, ArkBudget> = {
    high: {textureMB: 320, geometryMB: 96, nearTexture: 512, farTexture: 256, caps: {near: 150, nearSpecies: 60, models: 150}},
    medium: {textureMB: 128, geometryMB: 48, nearTexture: 512, farTexture: 256, caps: {near: 90, nearSpecies: 32, models: 120}},
    low: {textureMB: 64, geometryMB: 24, nearTexture: 256, farTexture: 128, caps: {near: 40, nearSpecies: 24, models: 80}}
};

/** Grass tufts built per tier (the tier's own count; a low device builds medium's so the lighter view can be turned off). */
export const GRASS_BUILD: Record<QualityTier, number> = {high: 56000, medium: 22000, low: 22000};

export function arkBudget(tier: QualityTier): ArkBudget {
    return ARK_BUDGETS[tier];
}

/** The instance caps for a tier (the lighter view uses the low tier's). */
export function arkCaps(tier: QualityTier): ArkCaps {
    return ARK_BUDGETS[tier].caps;
}

/** A skin's size after fitting: the longest edge at most `edge`, the aspect kept, powers of two kept. */
export function fittedSize(width: number, height: number, edge: number): {width: number; height: number} {
    const longest = Math.max(width, height);
    if (!(longest > edge) || edge <= 0) return {width, height};
    const scale = edge / longest;
    return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

export type LevelUse = {slug: string; level: "near" | "far"; bytes: number; texture: boolean; lastNear: number};

/**
 * Which near levels to let go so the models fit the budget: the ones drawn near least recently first, never one
 * drawn near within `keepSeconds`, never a far level (the animal would vanish). Pure: the library applies it.
 */
export function overBudget(levels: LevelUse[], budget: ArkBudget, now: number, keepSeconds = 3): Array<{slug: string; level: "near"}> {
    let textures = 0;
    let geometry = 0;
    for (const level of levels) {
        if (level.texture) textures += level.bytes;
        else geometry += level.bytes;
    }
    const textureLimit = budget.textureMB * 2 ** 20;
    const geometryLimit = budget.geometryMB * 2 ** 20;
    if (textures <= textureLimit && geometry <= geometryLimit) return [];
    const bySpecies = new Map<string, {texture: number; geometry: number; lastNear: number}>();
    for (const level of levels) {
        if (level.level !== "near") continue;
        const row = bySpecies.get(level.slug) ?? {texture: 0, geometry: 0, lastNear: level.lastNear};
        if (level.texture) row.texture += level.bytes;
        else row.geometry += level.bytes;
        row.lastNear = Math.max(row.lastNear, level.lastNear);
        bySpecies.set(level.slug, row);
    }
    const order = Array.from(bySpecies.entries()).filter(([, row]) => now - row.lastNear > keepSeconds).sort((a, b) => a[1].lastNear - b[1].lastNear || a[0].localeCompare(b[0]));
    const out: Array<{slug: string; level: "near"}> = [];
    for (const [slug, row] of order) {
        if (textures <= textureLimit && geometry <= geometryLimit) break;
        out.push({slug, level: "near"});
        textures -= row.texture;
        geometry -= row.geometry;
    }
    return out;
}
