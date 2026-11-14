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
 *
 * The far levels are never let go, and there is one per species seen: with the real Ark's 951 species their skins
 * alone pass the ceiling on the medium and high tiers (256² each: ~0.35 MB, 333 MB for all) once a reader has roamed
 * enough of the world (measured: 902 species loaded four minutes into a desktop session of zooming in and out). Past
 * that point no near level could ever bring the total back under, and every one was let go three seconds after it
 * was last drawn (measured: 5 a second, 801 in 160 s), so coming back to an animal cost its whole first visit again.
 * So, first, the GPU copy of a far skin whose kind has been out of view for half a minute is let go while the skins
 * are over the ceiling (`idleFarSkins`: the loaded picture is kept, and the renderer sends it again the frame the
 * kind is next drawn), which keeps the skins on the GPU to the kinds seen lately; and the near levels keep a floor
 * (`nearFloorMB`): while they hold less than that, none is let go for the skins' sake, whatever the far levels hold.
 */

import type {QualityTier} from "@/ark-scene/post";

export type ArkCaps = {near: number; nearSpecies: number; models: number};

export type ArkBudget = {
    /** The animal models' skins and meshes, MB (GPU, estimated by `memory.ts`). */
    textureMB: number;
    geometryMB: number;
    /** The near levels' skins are never let go below this many MB of them, whatever the far levels hold. */
    nearFloorMB: number;
    /** Longest edge of a skin, per level, after loading. */
    nearTexture: number;
    farTexture: number;
    caps: ArkCaps;
};

export const ARK_BUDGETS: Record<QualityTier, ArkBudget> = {
    high: {textureMB: 320, geometryMB: 96, nearFloorMB: 96, nearTexture: 512, farTexture: 256, caps: {near: 150, nearSpecies: 60, models: 150}},
    medium: {textureMB: 128, geometryMB: 48, nearFloorMB: 48, nearTexture: 512, farTexture: 256, caps: {near: 90, nearSpecies: 32, models: 120}},
    low: {textureMB: 64, geometryMB: 24, nearFloorMB: 16, nearTexture: 256, farTexture: 128, caps: {near: 40, nearSpecies: 24, models: 80}}
};

/** Grass tufts built per tier (the tier's own count; a low device builds medium's so the lighter view can be turned off). */
export const GRASS_BUILD: Record<QualityTier, number> = {high: 56000, medium: 22000, low: 22000};

export function arkBudget(tier: QualityTier): ArkBudget {
    // Development, for measuring the drops: `window.__arkBudgetMB = 8` before mounting sets every tier's skin ceiling.
    const forced = (globalThis as {__arkBudgetMB?: unknown}).__arkBudgetMB;
    if (typeof forced === "number" && forced > 0) return {...ARK_BUDGETS[tier], textureMB: forced};
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

/** A far skin on the GPU: its kind, its bytes, and the drawn frames since one of the kind was last in view. */
export type FarSkin = {slug: string; bytes: number; idleFrames: number};

/** A far skin's GPU copy may be let go once its kind has been out of view this many drawn frames (about half a minute). */
export const FAR_SKIN_IDLE_FRAMES = 900;

/**
 * Which far skins' GPU copies to let go so the skins fit the ceiling again (the far levels themselves are never let
 * go: the model and its picture stay loaded, and the renderer sends a skin again the frame its kind is next drawn):
 * the kinds longest out of view first, never one seen in the last `FAR_SKIN_IDLE_FRAMES`, until the skins are a tenth
 * under the ceiling (so the next few models in do not start it again). Pure.
 */
export function idleFarSkins(skins: FarSkin[], textureBytes: number, budget: ArkBudget, idleFrames = FAR_SKIN_IDLE_FRAMES): string[] {
    const limit = budget.textureMB * 2 ** 20;
    if (textureBytes <= limit) return [];
    const out: string[] = [];
    let left = textureBytes;
    for (const skin of [...skins].filter((s) => s.idleFrames >= idleFrames && s.bytes > 0).sort((a, b) => b.idleFrames - a.idleFrames || a.slug.localeCompare(b.slug))) {
        if (left <= limit * 0.9) break;
        out.push(skin.slug);
        left -= skin.bytes;
    }
    return out;
}

/**
 * Which near levels to let go so the models fit the budget: the ones drawn near least recently first, never one
 * drawn near within `keepSeconds`, never a far level (the animal would vanish), and for the skins' sake never below
 * the near levels' floor (`nearFloorMB`: the far levels alone may be over the ceiling). Pure: the library applies it.
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
    const nearFloor = (budget.nearFloorMB ?? 0) * 2 ** 20;
    let nearTextures = 0;
    bySpecies.forEach((row) => {
        nearTextures += row.texture;
    });
    for (const [slug, row] of order) {
        if (textures <= textureLimit && geometry <= geometryLimit) break;
        // (Over for the skins only, and the near skins at their floor: letting this one go would not be the last.)
        if (geometry <= geometryLimit && nearTextures - row.texture < nearFloor) continue;
        out.push({slug, level: "near"});
        textures -= row.texture;
        geometry -= row.geometry;
        nearTextures -= row.texture;
    }
    return out;
}
