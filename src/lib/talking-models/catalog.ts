/**
 * Where the talking 3D animals come from: the public talking-models bucket,
 * read the way the apps read it (`AnimalTalkingModelStore.swift`).
 *
 * `v1/manifest.json` says which animals have a model and its version, and
 * maps other names' slugs to a model (a card keyed `manta_ray` finds
 * `giant-oceanic-manta-ray`). The website reads glTF, which the manifest
 * offers once its `glb` key names the format (`v1/<slug>/<version>.<glb>.glb`,
 * with `glb_missing` listing animals whose file is not up yet); without that
 * key there is no call on the web. Each model's skin and rig sit beside it
 * (`.jpg`, `.json`), and `v1/habitats.json` names the scene behind each
 * animal (`v1/backgrounds/<name>/<version>.jpg`).
 *
 * `NEXT_PUBLIC_TALKING_MODELS_URL` points somewhere else in development (the
 * dev-only route that serves a local build, `api/dev/talking-models`).
 */

import type {TalkingBehaviour} from "@/lib/talking-models/behaviour";

export const TALKING_MODELS_BASE_URL = (process.env.NEXT_PUBLIC_TALKING_MODELS_URL?.trim()
    || "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1").replace(/\/+$/, "");

export type TalkingModelManifest = {
    version?: number;
    /** Slug → version. */
    models: Record<string, string>;
    /** Other names' slugs → the model's slug. */
    aliases?: Record<string, string>;
    /** The glTF layout the web and Android read ("g1"); absent until the GLBs are up. */
    glb?: string;
    /** Animals whose GLB is not up yet. */
    glb_missing?: string[];
};

/** talking.json: where the jaw hinges and how far it opens, in the model's own space (faces +z, y up). */
export type TalkingRig = {
    hinge: number[];
    max_open_degrees: number;
    cavity_center: number[];
    cavity_radii: number[];
    /** What the camera looks at. */
    head_center: number[];
    /** Where each eye sits on the head, when they were marked. */
    eyes?: number[][] | null;
    eye_radius?: number | null;
    /** How long the fur is, in model units; absent for an animal without fur. */
    fur_length?: number | null;
    /** A wet nose over the snout's tip (centre and radii), when marked. */
    nose?: number[] | null;
    nose_radii?: number[] | null;
    /** Radians higher than the usual three-quarter view to look from at rest: a flat animal is mostly its back. */
    rest_lift?: number | null;
    /** How it moves on its own between words. */
    behaviour?: TalkingBehaviour | null;
};

/** One animal's files. */
export type TalkingModelAsset = {
    slug: string;
    model: string;
    texture: string;
    rig: string;
};

/**
 * Lowercase words joined by hyphens ("Galápagos Tortoise" ->
 * galapagos-tortoise): storage keys refuse accents, and the build scripts
 * fold names the same way (`AnimalTalkingModelAsset.slug(for:)`).
 */
export function talkingModelSlug(name: string): string {
    return name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/'/g, "")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .join("-");
}

/** The first of these names that has a model, as its slug (`AnimalTalkingModelCatalog.slug(forAnyOf:)`). */
export function talkingModelSlugFor(manifest: TalkingModelManifest | null, names: Array<string | null | undefined>): string | null {
    if (!manifest) return null;
    for (const name of names) {
        if (!name) continue;
        const slug = talkingModelSlug(name);
        if (!slug) continue;
        if (manifest.models[slug]) return slug;
        const model = manifest.aliases?.[slug];
        if (model && manifest.models[model]) return model;
    }
    return null;
}

/** The animal's files on the web, or null when its glTF is not published (no call then). */
export function talkingModelAsset(manifest: TalkingModelManifest | null, slug: string | null): TalkingModelAsset | null {
    if (!manifest || !slug || !manifest.glb) return null;
    const version = manifest.models[slug];
    if (!version || manifest.glb_missing?.includes(slug)) return null;
    const folder = `${TALKING_MODELS_BASE_URL}/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`;
    return {slug, model: `${folder}.${manifest.glb}.glb`, texture: `${folder}.jpg`, rig: `${folder}.json`};
}

/** Fetched again after ten minutes, so animals published since appear the next time a chat opens. */
const MANIFEST_LIFETIME_MS = 10 * 60 * 1000;
let manifestCache: {at: number; manifest: TalkingModelManifest} | null = null;
let manifestLoading: Promise<TalkingModelManifest | null> | null = null;

function parseManifest(raw: unknown): TalkingModelManifest | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    if (!row.models || typeof row.models !== "object") return null;
    return {
        version: typeof row.version === "number" ? row.version : undefined,
        models: row.models as Record<string, string>,
        aliases: row.aliases && typeof row.aliases === "object" ? row.aliases as Record<string, string> : {},
        glb: typeof row.glb === "string" && row.glb.trim() ? row.glb.trim() : undefined,
        glb_missing: Array.isArray(row.glb_missing) ? row.glb_missing.filter((slug): slug is string => typeof slug === "string") : undefined
    };
}

/** Which animals have a talking model; the last good copy while offline. */
export async function loadTalkingModelManifest(): Promise<TalkingModelManifest | null> {
    if (manifestCache && Date.now() - manifestCache.at < MANIFEST_LIFETIME_MS) return manifestCache.manifest;
    manifestLoading ??= fetch(`${TALKING_MODELS_BASE_URL}/manifest.json`)
        .then((response) => (response.ok ? response.json() : null))
        .then((raw) => {
            const manifest = parseManifest(raw);
            if (manifest) manifestCache = {at: Date.now(), manifest};
            return manifest ?? manifestCache?.manifest ?? null;
        })
        .catch(() => manifestCache?.manifest ?? null)
        .finally(() => {
            manifestLoading = null;
        });
    return manifestLoading;
}

/** `v1/habitats.json`. */
type HabitatIndex = {backgrounds: Record<string, string>; animals: Record<string, string>};

const HABITAT_LIFETIME_MS = 60 * 60 * 1000;
let habitatCache: {at: number; index: HabitatIndex} | null = null;

/** The nature scene behind this model's animal, or null (none yet, or offline). */
export async function talkingModelSceneUrl(slug: string): Promise<string | null> {
    let index = habitatCache && Date.now() - habitatCache.at < HABITAT_LIFETIME_MS ? habitatCache.index : null;
    if (!index) {
        try {
            const response = await fetch(`${TALKING_MODELS_BASE_URL}/habitats.json`);
            const raw = response.ok ? await response.json() as Partial<HabitatIndex> : null;
            if (raw?.backgrounds && raw.animals) {
                index = {backgrounds: raw.backgrounds, animals: raw.animals};
                habitatCache = {at: Date.now(), index};
            }
        } catch {
            index = habitatCache?.index ?? null;
        }
    }
    const habitat = index?.animals[slug];
    const version = habitat ? index?.backgrounds[habitat] : null;
    if (!habitat || !version) return null;
    return `${TALKING_MODELS_BASE_URL}/backgrounds/${encodeURIComponent(habitat)}/${encodeURIComponent(version)}.jpg`;
}
