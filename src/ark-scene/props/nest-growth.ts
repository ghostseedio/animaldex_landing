/**
 * How far built a nest is (docs/ark/props.md, "Growing nests"): the input a
 * behaviour recipe (branch `ark-behaviour-recipes`: a bird carrying twigs,
 * grass or mud to its site, the nest growing over Ark days) reads and, if it
 * wants, drives.
 *
 *   nestStage(speciesId, siteId, t) → 0…1
 *
 * 0 is nothing yet, 1 finished (a nest with eggs or chicks in it is always
 * 1). `t` is the Ark day (fractional, as the server counts it:
 * `voyage_ark_day`, 1 Ark year = 14 real days, so 1 Ark day ≈ 55 real
 * minutes). The default schedule is the same for every viewer: building
 * starts a few days into the zone's breeding season (the day picked from
 * the species and site ids) and takes the form's `buildDays`; an eyrie
 * starts from what is left of last year's.
 *
 * A recipe may replace the schedule with `setNestStageSource(fn)`: return a
 * number to set the stage, null to keep the default. It must stay a pure
 * function of time and ids (no per-viewer randomness), like everything in
 * the shared layer.
 *
 * The props draw a nest's sticks, strands and pellets in build order (the
 * `aBuild` vertex attribute, 0…1) up to its stage, so the base goes down
 * first, then the walls, then the lining.
 */

import {hash32} from "@/lib/ark-clock";
import type {ArkZone} from "@/ark-scene/types";
import type {NestForm, NestProfile} from "@/ark-scene/props/nest-kinds";

/** One nest site the props drew: what the recipes lane needs to act out building it. */
export type NestSiteInfo = {
    /** The species (its kind for a breed): the snapshot's `kind_species_profile_id || species_profile_id`. */
    speciesId: string;
    /** Stable for the scenery: the attach point's id (`branch:decor12:3`), the ledge's, or `ground:<sitter id>`. */
    siteId: string;
    slug: string;
    zone: ArkZone;
    form: NestForm;
    /** Where the nest's middle is, its up, and its radius (m). */
    position: {x: number; y: number; z: number};
    up: {x: number; y: number; z: number};
    radius: number;
    /** The sitter, when this is its nest (not another of the colony). */
    sitter: string | null;
    eggs: number;
    chicks: number;
    buildDays: number;
    carriedOver: number;
};

/** The zone's breeding season on the Ark's year (days of the Ark year, northern seasons, as `presence.ts`). */
export function seasonWindow(zone: ArkZone): [number, number] {
    switch (zone) {
        case "polar":
            return [150, 240];
        case "rainforest":
        case "coral_reef":
            return [90, 320];
        case "desert":
        case "grassland":
            return [60, 200];
        case "seashore":
            return [110, 250];
        default:
            return [70, 190];
    }
}

/** The Ark's day of the year (0…365). */
export function dayOfArkYear(arkDay: number): number {
    return ((arkDay % 365) + 365) % 365;
}

/**
 * The default schedule: the stage of a nest at Ark day `t` (pure; the same
 * for every viewer). Before building starts in the season: 0 (or what is
 * left of last year's, for an eyrie). Eggs or chicks in it: 1.
 */
export function scheduledStage(site: Pick<NestSiteInfo, "speciesId" | "siteId" | "zone" | "eggs" | "chicks" | "buildDays" | "carriedOver" | "form">, t: number | null): number {
    if (site.eggs > 0 || site.chicks > 0) return 1;
    if (site.form === "hole" || site.form === "barn" || site.form === "none") return 1;
    if (t === null || !Number.isFinite(t)) return 1;
    const [from, to] = seasonWindow(site.zone);
    const day = dayOfArkYear(t);
    // Out of the season: a finished nest, if the props show one at all (presence.ts decides).
    if (day < from || day > to) return 1;
    const start = from + (hash32("nest-start", site.speciesId, site.siteId) % 1000) / 1000 * Math.min(6, (to - from) * 0.2);
    const days = Math.max(site.buildDays, 0.25);
    const built = Math.min(Math.max((day - start) / days, 0), 1);
    return site.carriedOver + (1 - site.carriedOver) * built;
}

export type NestStageSource = (speciesId: string, siteId: string, t: number) => number | null | undefined;

let source: NestStageSource | null = null;
const sites = new Map<string, NestSiteInfo>();

/** A recipe's own schedule (null to go back to the default). It must be a pure function of its inputs. */
export function setNestStageSource(next: NestStageSource | null) {
    source = next;
}

/** The props register the nests they draw (`homes.ts`), so a stage can be asked by ids alone. */
export function registerNestSites(list: NestSiteInfo[]) {
    sites.clear();
    for (const site of list) sites.set(`${site.speciesId}|${site.siteId}`, site);
}

/** The nests the props draw now: where, what, whose. */
export function nestSites(): NestSiteInfo[] {
    return Array.from(sites.values());
}

/** How far built the nest of `speciesId` at `siteId` is at Ark day `t` (0…1). */
export function nestStage(speciesId: string, siteId: string, t: number): number {
    const site = sites.get(`${speciesId}|${siteId}`);
    if (site && (site.eggs > 0 || site.chicks > 0)) return 1;
    const asked = source ? source(speciesId, siteId, t) : null;
    if (typeof asked === "number" && Number.isFinite(asked)) return Math.min(Math.max(asked, 0), 1);
    if (!site) return 1;
    return scheduledStage(site, t);
}

/** The build profile fields a site carries. */
export function buildOf(profile: NestProfile): Pick<NestSiteInfo, "buildDays" | "carriedOver" | "form"> {
    return {buildDays: profile.buildDays, carriedOver: profile.carriedOver, form: profile.form};
}
