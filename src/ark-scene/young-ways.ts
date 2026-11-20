/**
 * How a species' young are kept (sig-young lane; the owner's list: carrying young on the back, feeding chicks,
 * nursing, teaching, guarding, piggyback rides), read from the species' own stored text by the catalogue
 * (`scripts/ark-young-ways.mts` → `young-ways.json`, each way naming its sourced row).
 *
 *   ride     young carried on a parent: on the back, clinging to the belly, on the tail, beneath the tail; the father
 *            carries where the text says so (`by: "male"`), when the record has him
 *   line     young follow in a line along the parent's own path (ducklings, a skunk's kits, a tiger's cubs trailing)
 *   stay     young kept at one spot (lying hidden, at the den's mouth, in the nest) while the parent goes about her
 *            day, and who comes back in bouts: she walks (flies) to it, nurses or feeds it, and goes back; helpers of
 *            the kind (a wolf pack, a crow's helpers) come too where the text says so
 *   cluster  the young of the kind gather in a clump while the adults go about their day
 *
 * Only real young: a young one the record has aboard (`born_ark_day`, its parent by the record when it has said, else the
 * scene's seeded pick, `young-care.ts`), within the days its way lasts (`stayDaysOf`). No young, nothing drawn. Pure:
 * ids and the shared clock in, places out; nothing here decides a birth, a meal or a death, or touches the renderer.
 */

import table from "@/ark-scene/young-ways.json";
import {unit} from "@/lib/ark-clock";

export type RideStyle = "back" | "belly" | "tail" | "under";
export type WayKind = "ride" | "line" | "stay" | "visit" | "cluster";
export type Ways = {
    ride?: RideStyle;
    by?: "male";
    line?: boolean;
    follow?: boolean;
    stay?: "hide" | "den" | "nest";
    visit?: "nurse" | "feed";
    helpers?: boolean;
    hours?: "dawn_dusk";
    days?: number;
    cluster?: boolean;
};
export type YoungWays = Ways & {
    /** The catalogue row's own English log sentence by way ("{aAnimal} …"), said only for the ways the row's words are true of. */
    lines: Partial<Record<WayKind, string>>;
};

const SPECIES = (table as unknown as {species: Record<string, {ways: Ways; lines: YoungWays["lines"]}>}).species;

/** The species' ways of keeping its young, or null (nearly every species). */
export function waysOf(slug: string | null | undefined): YoungWays | null {
    const row = slug ? SPECIES[slug] : null;
    return row ? {...row.ways, lines: row.lines} : null;
}

/** The slugs that have ways (the tests and the coverage read this). */
export function waysSlugs(): string[] {
    return Object.keys(SPECIES);
}

/** How many Ark days a young one stays at its spot: the text's number, else a share of the days it is dependent for. */
export function stayDaysOf(ways: Ways, independentDays: number): number {
    if (ways.days) return ways.days;
    const share = ways.stay === "hide" ? 0.2 : ways.stay === "den" ? 0.5 : 0.6;
    return Math.max(independentDays * share, 2);
}

/** The father among a young one's recorded parents (the one drawn male, still aboard), or null: the mother's pick then stands. */
export function fatherAmong(parents: readonly string[], male: (id: string) => boolean | null | undefined, aboard: (id: string) => boolean = () => true): string | null {
    return parents.find((id) => id && aboard(id) && male(id) === true) ?? null;
}

// MARK: Line

export type Pt = {x: number; z: number};

/** How far behind its leader the young one of this rank follows (m): her length at her tail, then each one's own length and a gap. */
export function lineDistance(leaderLength: number, youngLength: number, rank: number): number {
    return Math.max(leaderLength, 0.04) * 0.5 + Math.max(youngLength, 0.02) * (0.9 + 1.35 * rank);
}

/**
 * Where on the leader's own path a follower `behind` metres back is. `trail` is the leader's recent places, newest
 * first (its first is where she is now); past the oldest, the path goes on straight back from it, so a leader who has
 * stood a while has a queue lined up behind her heading, and one who sets off carries it on without a jump. The heading is
 * the path's: toward the leader.
 */
export function lineBehind(trail: readonly Pt[], behind: number, leaderYaw: number): {x: number; z: number; yaw: number} {
    let left = behind;
    for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        if (seg < 1e-4) continue;
        if (left <= seg) {
            const k = left / seg;
            return {x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(a.x - b.x, a.z - b.z)};
        }
        left -= seg;
    }
    // (The path ran out: straight on back from its end, along its last stretch, or from her heading if she has not moved.)
    const last = trail[trail.length - 1] ?? {x: 0, z: 0};
    const before = trail.length > 1 ? trail[trail.length - 2] : null;
    const run = before ? Math.hypot(last.x - before.x, last.z - before.z) : 0;
    const dx = before && run > 0.05 ? (last.x - before.x) / run : -Math.sin(leaderYaw);
    const dz = before && run > 0.05 ? (last.z - before.z) / run : -Math.cos(leaderYaw);
    return {x: last.x + dx * left, z: last.z + dz * left, yaw: Math.atan2(-dx, -dz)};
}

// MARK: Stay and the visits

/** The family's spot moves on this often (ms): three visit slots. */
export const STAY_SLOT_MS = 720_000;
export const VISIT_SLOT_MS = 240_000;
/** The first seconds of a stay slot are the young one's move to its new spot. */
export const STAY_MOVE_MS = 12_000;
/** A visit's window (s) and how long she stays with the young (s). */
export const VISIT_WINDOW_S = 110;
export const VISIT_HOLD_S = 26;
/** The farthest she sets out from (m): a family farther apart than this has no visit now. */
export const VISIT_REACH = 70;
/** Chances of a visit in a slot, by who comes. */
export const PARENT_CHANCE = 0.8;
export const HELPER_CHANCE = 0.45;

const smooth = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};

/** A family's own clock: its offset, the stay slot and the visit slot at `ms`. */
export function familyClock(familyKey: string, ms: number): {offset: number; stay: number; stayStart: number; visit: number; visitStart: number} {
    const offset = unit(familyKey, "stay-offset") * STAY_SLOT_MS;
    const stay = Math.floor((ms - offset) / STAY_SLOT_MS);
    const visit = Math.floor((ms - offset) / VISIT_SLOT_MS);
    return {offset, stay, stayStart: stay * STAY_SLOT_MS + offset, visit, visitStart: visit * VISIT_SLOT_MS + offset};
}

/** Whether `hours` (the island's) is inside the species' visiting hours: any, or the hours round dawn and dusk. */
export function inVisitHours(hours: number, window: Ways["hours"]): boolean {
    if (!window) return true;
    return (hours >= 5 && hours < 8.5) || (hours >= 16.5 && hours < 20);
}

export type VisitPlan = {key: string; visitorId: string; familyKey: string; slot: number; /** ms of the shared clock. */ start: number; end: number};

/** The visit of `visitorId` to the family in the visit slot of `ms`, or null (no visit in this slot). */
export function visitPlan(visitorId: string, familyKey: string, ms: number, chance: number): VisitPlan | null {
    const clock = familyClock(familyKey, ms);
    if (unit(visitorId, "visit", clock.visit) >= chance) return null;
    const free = VISIT_SLOT_MS - STAY_MOVE_MS - 4_000 - VISIT_WINDOW_S * 1000;
    const start = clock.visitStart + STAY_MOVE_MS + 4_000 + free * unit(visitorId, "visit-at", clock.visit);
    return {key: `visit:${visitorId}:${clock.visit}`, visitorId, familyKey, slot: clock.visit, start, end: start + VISIT_WINDOW_S * 1000};
}

export type VisitState = {phase: "go" | "hold" | "back"; /** 0 at where she was … 1 with the young. */ level: number; /** Seconds into the hold. */ held: number};

/**
 * Where a visit is at `ms`, for a walk of `go` seconds each way (her pace over the distance, kept inside the window:
 * the hold is VISIT_HOLD_S, the two walks fill the rest at most); null before it starts and after it is over.
 */
export function visitState(plan: VisitPlan, ms: number, go: number): VisitState | null {
    const s = (ms - plan.start) / 1000;
    const g = Math.min(Math.max(go, 2), (VISIT_WINDOW_S - VISIT_HOLD_S) / 2);
    if (s < 0 || s >= 2 * g + VISIT_HOLD_S) return null;
    if (s < g) return {phase: "go", level: smooth(s / g), held: 0};
    if (s < g + VISIT_HOLD_S) return {phase: "hold", level: 1, held: s - g};
    return {phase: "back", level: 1 - smooth((s - g - VISIT_HOLD_S) / g), held: VISIT_HOLD_S};
}

/** The seconds a walk of `distance` metres takes at `pace` m/s, at least 3 s. */
export function walkSeconds(distance: number, pace: number): number {
    return Math.max(distance / Math.max(pace, 0.3), 3);
}

export type VisitMotion = {x: number; z: number; /** Height over the ground (a bird's flight there). */ lift: number; moving: boolean; aloft: boolean; /** Her heading: the way she goes while she goes, her head to the young with them (the caller blends in the turn). */ way: number};

/**
 * Where she is on a visit: out from where she set off (`anchor`) to the place beside the young, the hold, and back to where
 * her own day has her now (`sched`, which moves on meanwhile), so she is never somewhere her day is not at either end. A
 * flier goes in an arc over the way.
 */
export function visitMotion(state: VisitState, anchor: Pt, place: Pt, sched: Pt, flies: boolean): VisitMotion {
    const L = state.level;
    const from = state.phase === "back" ? sched : anchor;
    const x = from.x + (place.x - from.x) * L;
    const z = from.z + (place.z - from.z) * L;
    const moving = state.phase !== "hold" && L > 0.02 && L < 0.98;
    const reach = Math.hypot(place.x - from.x, place.z - from.z);
    const lift = flies && moving ? Math.sin(Math.PI * L) * Math.min(reach * 0.2, 5) : 0;
    const way = state.phase === "back" ? Math.atan2(sched.x - place.x, sched.z - place.z) : Math.atan2(place.x - anchor.x, place.z - anchor.z);
    return {x, z, lift, moving, aloft: flies && moving, way};
}

/** Where she stands with the young: beside its spot on her own seeded side, at a body's reach, her head toward it. */
export function visitPlace(visitorId: string, spot: Pt, visitorLength: number, youngLength: number): {x: number; z: number; yaw: number} {
    const angle = unit(visitorId, "visit-side") * Math.PI * 2;
    const reach = Math.max(visitorLength, 0.04) * 0.5 + Math.max(youngLength, 0.02) * 0.6;
    const x = spot.x + Math.sin(angle) * reach;
    const z = spot.z + Math.cos(angle) * reach;
    return {x, z, yaw: Math.atan2(spot.x - x, spot.z - z)};
}

/** Where a family's young lie, off the place `anchor` its parent was at when the slot began: near her, on a seeded side. */
export function familySpot(familyKey: string, slot: number, anchor: Pt, parentLength: number): Pt {
    const angle = unit(familyKey, "stay-angle", slot) * Math.PI * 2;
    const r = 2 + Math.max(parentLength, 0.05) * (0.8 + 1.4 * unit(familyKey, "stay-r", slot));
    return {x: anchor.x + Math.sin(angle) * r, z: anchor.z + Math.cos(angle) * r};
}

/** A little place of its own round the family's spot, so siblings lie together but not on one another. */
export function siblingOffset(youngId: string, youngLength: number): Pt {
    const angle = unit(youngId, "sib-angle") * Math.PI * 2;
    const r = Math.max(youngLength, 0.02) * (0.5 + 0.9 * unit(youngId, "sib-r"));
    return {x: Math.sin(angle) * r, z: Math.cos(angle) * r};
}

// MARK: Cluster

/** The `index`th of `count` young in a clump round `centre`: a sunflower pack (golden angle), every one clear of the others. */
export function clumpSpot(centre: Pt, index: number, count: number, youngLength: number): Pt {
    const L = Math.max(youngLength, 0.02);
    const r = L * 0.85 * Math.sqrt(index + 0.6);
    const angle = index * 2.399963;
    void count;
    return {x: centre.x + Math.sin(angle) * r, z: centre.z + Math.cos(angle) * r};
}

/** Mixes a spot at a slot with the one before it: the young one's walk to its new spot in the first moments of the slot. */
export function moveBlend(prev: Pt, next: Pt, sinceSlotMs: number): {x: number; z: number; moving: boolean; yaw: number | null} {
    if (sinceSlotMs >= STAY_MOVE_MS) return {x: next.x, z: next.z, moving: false, yaw: null};
    const k = smooth(sinceSlotMs / STAY_MOVE_MS);
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    return {x: prev.x + dx * k, z: prev.z + dz * k, moving: Math.hypot(dx, dz) > 0.05 && k < 0.98, yaw: Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : null};
}
