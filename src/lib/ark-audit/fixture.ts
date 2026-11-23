/**
 * The behaviour audit's synthetic Ark (visual audit only; nothing here is
 * the server's): every catalogue species from `data/ark/behaviour-profiles.json`,
 * one animal for a solitary species, two for a pair, four for a social one
 * (herd, flock, school, troop, pack, group, colony, swarm), in their stored
 * zones.
 *
 * Each species' cluster has its own slot (`slot`, `slot_rank`: the server's
 * fields, which `placement.ts` keeps as given), from its slug's own hash in a
 * fixed table per zone (`FIXTURE_ZONE_SLOTS`; even slots, odd ones for predators).
 * So adding a species moves no one else (SPECIES-ANIM-B2, 2026-11-24: the
 * slots were the arrival rank among everyone, so 36 new species moved 1,321
 * of 5,328 animals and the checks moved with the catalogue's growth). The
 * order is the fixture's one lever on who stands next to whom:
 *   - "shuffled": every cluster at its own hash slot (a plausible real Ark);
 *   - "adjacent": the same, but each predator's group takes the first free
 *     slot after a group of one of its prey in its zone (the owner's "wolves
 *     next to deer"), so every predator has prey a slot away.
 *
 * Pure and deterministic: the same files give the same Ark on every tree.
 */

import type {ArkAnimal} from "@/ark-scene/types";

export type AuditProfile = {
    slug: string;
    id: string;
    name: string;
    zone: ArkAnimal["zone"];
    excluded: string | null;
    plan: string;
    rig: string | null;
    gait: number | null;
    move: string;
    moves: string[];
    activity: "diurnal" | "nocturnal" | "crepuscular" | "any";
    roost: string;
    social: string;
    diet: string;
    size: number | null;
    speed: number | null;
    dominance: number | null;
    behaviours: Record<string, number>;
    interactions: string[];
    altitude: string | null;
    breathes: boolean;
    seabed: boolean;
};

export type AuditFixtureOrder = "shuffled" | "adjacent";

export const GROUPED_SOCIAL: ReadonlySet<string> = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
/** Social species that move as one on purpose: following another of its kind is right for these. */
export const FLOCKING_SOCIAL: ReadonlySet<string> = new Set(["flock", "school", "colony", "swarm"]);

/**
 * The fixture's slot table per zone: a cluster's slot is its slug's hash in it. Fixed, so adding a species moves no one
 * else; about 1.5 times the zone's species on 2026-11-24, rounded up to 64. Raise a zone's (a deliberate re-baseline of
 * every fixture check) when its species pass 0.85 of it: `ark-audit-fixture.test.ts` fails first.
 */
export const FIXTURE_ZONE_SLOTS: Readonly<Record<string, number>> = {
    rainforest: 768,
    farm_garden: 640,
    woodland: 576,
    grassland: 384,
    river_lake: 384,
    open_ocean: 256,
    wetland: 256,
    desert: 256,
    coral_reef: 256,
    seashore: 192,
    mountains: 192,
    polar: 64
};
export function fixtureZoneSlots(zone: string): number {
    return FIXTURE_ZONE_SLOTS[zone] ?? 256;
}

export function groupSize(social: string): number {
    return GROUPED_SOCIAL.has(social) ? 4 : social === "pair" ? 2 : 1;
}

function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** A stable uuid-shaped id for the n-th animal of a species. */
export function auditAnimalId(slug: string, n: number): string {
    const parts = [hash(`${slug}#${n}#a`), hash(`${slug}#${n}#b`), hash(`${slug}#${n}#c`), hash(`${slug}#${n}#d`)].map((v) => v.toString(16).padStart(8, "0"));
    const hex = parts.join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Decodes `data/ark/audit-predator-prey.json` (prey as base-36 indices into the profiles) to slug → prey slugs. */
export function decodePreyTable(raw: {prey: Record<string, string>}, profiles: AuditProfile[]): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    for (const [predator, list] of Object.entries(raw.prey)) {
        const prey = new Set<string>();
        for (const token of list.split(".")) {
            const profile = profiles[parseInt(token, 36)];
            if (profile) prey.add(profile.slug);
        }
        out.set(predator, prey);
    }
    return out;
}

export type AuditFixture = {
    animals: ArkAnimal[];
    profileOf: Map<string, AuditProfile>;
    /** Species in the fixture, in arrival order. */
    order: string[];
};

/** The synthetic Ark. `profiles` is `behaviour-profiles.json`'s `profiles` (excluded ones are left out). */
export function auditFixture(profiles: AuditProfile[], preyOf: Map<string, Set<string>>, order: AuditFixtureOrder = "adjacent", start = Date.UTC(2026, 9, 26)): AuditFixture {
    const kept = profiles.filter((p) => !p.excluded && p.zone);
    const profileOf = new Map(kept.map((p) => [p.slug, p]));
    const shuffled = Array.from(kept).sort((a, b) => hash(`${a.slug}#order`) - hash(`${b.slug}#order`) || a.slug.localeCompare(b.slug));
    let sequence = shuffled.map((p) => p.slug);
    const after = new Map<string, string[]>();
    if (order === "adjacent") {
        // Each predator goes straight after the first of its prey (in shuffled order) that lives in its zone.
        const moved = new Set<string>();
        const position = new Map(sequence.map((slug, i) => [slug, i]));
        for (const predator of sequence) {
            const prey = preyOf.get(predator);
            if (!prey) continue;
            const zone = profileOf.get(predator)!.zone;
            const target = Array.from(prey).filter((slug) => profileOf.get(slug)?.zone === zone && !preyOf.has(slug)).sort((a, b) => position.get(a)! - position.get(b)!)[0];
            if (!target) continue;
            after.set(target, [...(after.get(target) ?? []), predator]);
            moved.add(predator);
        }
        const out: string[] = [];
        for (const slug of sequence) {
            if (moved.has(slug)) continue;
            out.push(slug);
            for (const predator of after.get(slug) ?? []) out.push(predator);
        }
        sequence = out;
    }
    // The slots: every cluster not placed by its prey on an even slot, 2k, k its own hash in the zone's table (double
    // hashing, its own step, in hash order: a cluster another leaves moves only the ones whose probe it was on); each
    // predator on the odd slot just after its prey's, 2k + 1 (else the next odd one free), so the lead clusters never
    // move a predator's and a predator never moves a lead cluster.
    const slotOf = new Map<string, number>();
    const taken = new Map<string, Set<number>>();
    const usedIn = (zone: string) => {
        let used = taken.get(zone);
        if (!used) taken.set(zone, (used = new Set<number>()));
        return used;
    };
    const preyFirst = new Map<string, string>();
    if (order === "adjacent") after.forEach((predators, prey) => predators.forEach((predator) => preyFirst.set(predator, prey)));
    const leads = Array.from(sequence).filter((slug) => !preyFirst.has(slug)).sort((a, b) => hash(`${a}#slot`) - hash(`${b}#slot`) || a.localeCompare(b));
    for (const slug of leads) {
        const zone = profileOf.get(slug)!.zone;
        const size = fixtureZoneSlots(zone);
        const used = usedIn(zone);
        let step = 1 + (hash(`${slug}#step`) % (size - 1));
        while (gcd(step, size) !== 1) step++;
        let k = hash(`${slug}#slot`) % size;
        for (let tries = 0; used.has(2 * k); tries++) {
            if (tries >= size) throw new Error(`auditFixture: ${zone} has more species than FIXTURE_ZONE_SLOTS (${size}); raise it (a re-baseline)`);
            k = (k + step) % size;
        }
        used.add(2 * k);
        slotOf.set(slug, 2 * k);
    }
    for (const slug of sequence) {
        const prey = preyFirst.get(slug);
        if (!prey) continue;
        const zone = profileOf.get(slug)!.zone;
        const size = fixtureZoneSlots(zone);
        const used = usedIn(zone);
        let k = slotOf.get(prey)! / 2;
        for (let tries = 0; used.has(2 * k + 1); tries++) {
            if (tries >= size) throw new Error(`auditFixture: ${zone} has more predators than FIXTURE_ZONE_SLOTS (${size}); raise it`);
            k = (k + 1) % size;
        }
        used.add(2 * k + 1);
        slotOf.set(slug, 2 * k + 1);
    }
    const animals: ArkAnimal[] = [];
    for (const slug of sequence) {
        const profile = profileOf.get(slug)!;
        const count = groupSize(profile.social);
        // (Its arrival, for what reads one: its own, from its slug, as stable as its slot.)
        const arrival = start + (hash(`${slug}#arrival`) % 10_000_000) * 1000;
        for (let n = 0; n < count; n++) {
            animals.push({
                id: auditAnimalId(slug, n),
                species_profile_id: profile.id,
                name: profile.name,
                scientific_name: null,
                model_slug: slug,
                zone: profile.zone,
                arrived_at: new Date(arrival + n).toISOString(),
                slot: slotOf.get(slug)!,
                slot_rank: n,
                brought_by: {label: "A voyager", named: false},
                mine: false,
                activity: profile.activity,
                sociality: GROUPED_SOCIAL.has(profile.social) ? "group" : profile.social === "pair" ? "pair" : "solitary"
            });
        }
    }
    return {animals, profileOf, order: sequence};
}
