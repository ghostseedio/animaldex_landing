/**
 * What the audit reads besides the code: the local model set
 * (`~/animaldex-talking-models/ark/<slug>/ark.json`, for each model's plan and
 * shader motion) and the rig run (`rig/manifest.json` per-species clips,
 * `rig/publish/manifest.json` = what the web build serves, and each rig's
 * bone names in `rig/<slug>/<slug>.rig.json`). Every file is optional: without
 * them (CI) the plans fall back to the profiles' and rig checks are skipped.
 */

import {existsSync, readdirSync, readFileSync} from "node:fs";
import path from "node:path";

export type RigBones = {plan: string; state: string; bones: string[]; flightClips: Record<string, {pass: boolean; held: string | null}>; clips: string[]};

export type SceneData = {
    modelsDir: string | null;
    modelPlan: Map<string, string>;
    /** Birds (plan "bird") whose model has a "flap" shader motion. */
    wingShaderSpecies: number;
    /** The published build's per-species rig entries (clips with pass flags), or null. */
    rigManifest: Record<string, unknown> | null;
    /** Bone names and flight clips per rigged species (all rigs, published or not). */
    rigBones: Map<string, RigBones>;
    publishedRigs: Set<string>;
};

function readJson<T>(file: string): T | null {
    try {
        return JSON.parse(readFileSync(file, "utf8")) as T;
    } catch {
        return null;
    }
}

export function loadSceneData(root: string | null, slugs: string[]): SceneData {
    const modelPlan = new Map<string, string>();
    let wingShaderSpecies = 0;
    const rigBones = new Map<string, RigBones>();
    let rigManifest: Record<string, unknown> | null = null;
    const publishedRigs = new Set<string>();
    if (!root || !existsSync(root)) return {modelsDir: null, modelPlan, wingShaderSpecies, rigManifest, rigBones, publishedRigs};
    for (const slug of slugs) {
        const ark = readJson<{behaviour?: {plan?: string; motion?: {kind?: string}}}>(path.join(root, "ark", slug, "ark.json"));
        const plan = ark?.behaviour?.plan;
        if (plan) modelPlan.set(slug, plan);
        if (plan === "bird" && ark?.behaviour?.motion?.kind === "flap") wingShaderSpecies++;
    }
    const full = readJson<{species: Record<string, {state?: string; plan?: string; clips?: Record<string, {pass?: boolean; held?: string}> | string[]}>}>(path.join(root, "rig", "manifest.json"));
    const published = readJson<{species: Record<string, string>}>(path.join(root, "rig", "publish", "manifest.json"));
    if (published) for (const slug of Object.keys(published.species ?? {})) publishedRigs.add(slug);
    if (full) {
        rigManifest = {};
        for (const [slug, entry] of Object.entries(full.species)) {
            // The web reads only published rigs.
            if (publishedRigs.size && !publishedRigs.has(slug)) continue;
            rigManifest[slug] = entry;
        }
        for (const slug of slugs) {
            const entry = full.species[slug];
            if (!entry) continue;
            const rig = readJson<{bones?: string[]}>(path.join(root, "rig", slug, `${slug}.rig.json`));
            const clips = entry.clips && !Array.isArray(entry.clips) ? entry.clips : {};
            const flightClips: RigBones["flightClips"] = {};
            for (const name of ["flap", "glide", "takeoff", "land"]) if (clips[name]) flightClips[name] = {pass: Boolean(clips[name].pass), held: clips[name].held ?? null};
            rigBones.set(slug, {plan: entry.plan ?? "", state: entry.state ?? "", bones: rig?.bones ?? [], flightClips, clips: Object.keys(clips)});
        }
    }
    return {modelsDir: root, modelPlan, wingShaderSpecies, rigManifest, rigBones, publishedRigs};
}

/** The model folder, if this machine has one. */
export function defaultModelsDir(): string | null {
    const home = process.env.HOME ?? "";
    const dir = process.env.TALKING_MODELS_DEV_DIR?.trim() || path.join(home, "animaldex-talking-models");
    return existsSync(path.join(dir, "ark")) && readdirSync(path.join(dir, "ark")).length ? dir : null;
}
