/**
 * Ark Lite (owner, 2026-11-15, after a Galaxy A02s took about 250 s to its first frame: "maybe we need a low device
 * alternative"): the Ark without the 3D world, for a phone that cannot build it in a time anyone waits. Pure: what is
 * shown and who gets it. The page (`src/ark-scene/lite/lite-view.ts`) draws it, in the apps' embed and on /ark.
 *
 * What it shows, all from the reads the 3D Ark already makes (no new server work):
 * - the reader's own animals (where they live, how they came aboard, their hearts where the page has them, Talk);
 * - where everyone is: each region with its count, a bar against the biggest, and its biggest kinds' icons;
 * - the live log (the scene's own DOM log, `mountArkLiveHud`, with no scene behind it: the server's record).
 *
 * Who gets it (decision 358):
 * - asked for (`?view=lite|3d`, the host's), else the reader's last choice on this device, else
 * - a device that says it has 2 GB of memory or less (Chromium's `deviceMemory`, or the app's own `?mem=`), or whose
 *   one-off CPU score is far past the low tier's slow line: Lite, with "Open the 3D Ark" on it;
 * - everyone else: the 3D Ark, and "Switch to Ark Lite" on the loading card once it has waited `ARK_LITE_OFFER_MS`.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkPopulation} from "@/lib/ark-population";
import {arkBarCeiling, arkBarShare} from "@/lib/ark-live-bars";

export type ArkView = "lite" | "3d";

/** The reader's choice on this device (localStorage; never sent anywhere). */
export const ARK_VIEW_KEY = "animaldex:ark:view";
/** The loading card offers Ark Lite after this long without the 3D Ark's first frame. */
export const ARK_LITE_OFFER_MS = 20_000;
/** At or under this much memory (GB), a device opens on Lite. */
export const ARK_LITE_MEMORY_GB = 2;
/** A CPU score (ms, `arkCpuScore`) past this opens on Lite: about three times the low tier's slow line (9.5 ms). */
export const ARK_LITE_CPU_MS = 30;

export type ArkViewSignals = {
    /** `?view=` (the page's or the host's), when it names one. */
    asked?: string | null;
    /** The reader's last choice on this device. */
    stored?: string | null;
    memoryGB?: number | null;
    cpuMs?: number | null;
};

export type ArkViewChoice = {view: ArkView; why: "asked" | "stored" | "memory" | "cpu" | "default"};

export function arkReadView(value: unknown): ArkView | null {
    return value === "lite" || value === "3d" ? value : null;
}

/** The view a visit opens on, and why. */
export function arkChooseView(signals: ArkViewSignals): ArkViewChoice {
    const asked = arkReadView(signals.asked);
    if (asked) return {view: asked, why: "asked"};
    const stored = arkReadView(signals.stored);
    if (stored) return {view: stored, why: "stored"};
    const memory = signals.memoryGB;
    if (typeof memory === "number" && memory > 0 && memory <= ARK_LITE_MEMORY_GB) return {view: "lite", why: "memory"};
    const cpu = signals.cpuMs;
    if (typeof cpu === "number" && Number.isFinite(cpu) && cpu > ARK_LITE_CPU_MS) return {view: "lite", why: "cpu"};
    return {view: "3d", why: "default"};
}

// MARK: What it shows

export type ArkLiteMine = {
    id: string;
    name: string;
    slug: string;
    /** No model of its own: no icon, no Talk. */
    placeholder: boolean;
    region: string;
    zone: string;
    origin: "arrived" | "born";
    arrivedAt: string;
    hearts: number | null;
};

export type ArkLiteRegion = {
    region: string;
    animals: number;
    /** 0–1, against the biggest region (log scale, as the bars). */
    share: number;
    /** Its biggest kinds, the reader's first: name, icon slug, count, and how many are the reader's. */
    kinds: Array<{key: string; name: string; slug: string; count: number; mine: number}>;
    /** How many kinds live there. */
    species: number;
    mine: number;
};

export type ArkLiteModel = {
    animals: number;
    species: number;
    mine: ArkLiteMine[];
    regions: ArkLiteRegion[];
};

/** Kinds shown per region. */
export const ARK_LITE_KINDS = 6;
/** The reader's own animals listed (newest first). */
export const ARK_LITE_MINE_MAX = 40;

function isPlaceholder(animal: Pick<ArkAnimal, "placeholder" | "model_slug">): boolean {
    return animal.placeholder === true || !animal.model_slug || animal.model_slug.startsWith("placeholder--");
}

/** What Ark Lite shows for a snapshot (and the reader's hearts by animal id, where the page has them). */
export function arkLiteModel(snapshot: ArkSnapshot | null, hearts: Readonly<Record<string, number>> | null = null): ArkLiteModel {
    if (!snapshot) return {animals: 0, species: 0, mine: [], regions: []};
    const population = arkPopulation(snapshot);
    const regionOf = new Map<string, string>();
    for (const group of population.regions) for (const row of group.species) for (const animal of row.animals) regionOf.set(animal.id, group.region);
    const mine = snapshot.animals
        .filter((animal) => animal.mine)
        .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id))
        .slice(0, ARK_LITE_MINE_MAX)
        .map((animal): ArkLiteMine => ({
            id: animal.id,
            name: animal.name,
            slug: animal.model_slug,
            placeholder: isPlaceholder(animal),
            region: regionOf.get(animal.id) ?? "",
            zone: animal.zone,
            origin: animal.origin === "born" ? "born" : "arrived",
            arrivedAt: animal.arrived_at,
            hearts: hearts && typeof hearts[animal.id] === "number" ? hearts[animal.id] : null
        }));
    const ceiling = arkBarCeiling(Math.max(0, ...population.regions.map((group) => group.animals)));
    const regions = population.regions
        .filter((group) => group.animals > 0)
        .map((group): ArkLiteRegion => {
            const kinds = [...group.species]
                .sort((a, b) => Number(b.mine > 0) - Number(a.mine > 0) || b.count - a.count || a.name.localeCompare(b.name))
                .slice(0, ARK_LITE_KINDS)
                .map((row) => ({key: row.key, name: row.name, slug: row.slug, count: row.count, mine: row.mine}));
            return {
                region: group.region,
                animals: group.animals,
                share: arkBarShare(group.animals, ceiling),
                kinds,
                species: group.species.length,
                mine: group.species.reduce((sum, row) => sum + row.mine, 0)
            };
        });
    return {animals: snapshot.counts.animals, species: snapshot.counts.species, mine, regions};
}

// MARK: Words

export type ArkLiteViewWords = {
    title: string;
    subtitle: string;
    open3d: string;
    slowNote: string;
    switchLite: string;
    ready3d: string;
    where: string;
    kindsMore: string;
};

/** English, key by key under any language's missing words (the same as en.json's `ark.liteView`, a test says). */
export const ARK_LITE_ENGLISH: ArkLiteViewWords = {
    title: "Ark Lite",
    subtitle: "A lighter Ark for this device",
    open3d: "Open the 3D Ark",
    slowNote: "It can take a few minutes on this device",
    switchLite: "Switch to Ark Lite",
    ready3d: "The 3D Ark is ready",
    where: "Where they are",
    kindsMore: "+{count} more kinds"
};

export function arkLiteWords(raw: Partial<Record<keyof ArkLiteViewWords, unknown>> | null | undefined): ArkLiteViewWords {
    const out = {...ARK_LITE_ENGLISH};
    if (raw && typeof raw === "object") for (const key of Object.keys(out) as Array<keyof ArkLiteViewWords>) {
        const value = raw[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}
