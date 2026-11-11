/**
 * Who is outside, and who is resting out of sight (runtime lane; the captures-backfill scale, AnimalDex
 * docs/ark/captures-backfill-dry-run.md §5.5). With captures bringing animals aboard the Ark holds ~3,100 animals
 * at launch and ~9,400 in a year; the scene's per-frame work is linear in the animals drawn one by one. So at most a
 * tier's budget of them are outside at once, the rest resting (a den, a burrow, the shade: out of sight), and the
 * counts stay complete (the snapshot, the HUD and the herds are untouched).
 *
 * The rotation is the same for every viewer: it depends only on the shared clock (epoch seconds), the animals' ids
 * and the budget, never on the camera. Pure, so the map and behaviour lanes can drive it later (`arkOutside` is the
 * one place that says who is out).
 *
 * - Every kind keeps at least one outside (when the budget allows), the rest of the budget shared by size: a kind
 *   with 40 aboard has more out than a kind with 2.
 * - Within a kind, its animals stand on a ring ordered by a hash of their ids; a window of the kind's quota is out,
 *   and every `ARK_REST_STEP_SECONDS` (on the shared clock, at the same instant everywhere) the window moves on by
 *   one: one animal goes in to rest, the next comes out. Each is out for quota × step, then rests.
 * - Nested across tiers: what is out on a smaller budget is out on a larger one too (the window starts at the same
 *   place; a larger quota only extends it), so a phone and a desktop agree on everyone the phone shows.
 * - Pinned animals (the reader's own, a selected or followed one, a replay's) are always out, on top of the budget.
 */

import type {QualityTier} from "@/ark-scene/post";

/** Animals drawn one by one, at most, per tier (from the scale runs: 60 fps desktop, 30 fps phone). */
export const ARK_LIVE_BUDGET: Record<QualityTier, number> = {high: 1200, medium: 400, low: 200};

/** How often the rotation moves on (s): the same instant for every viewer. */
export const ARK_REST_STEP_SECONDS = 300;

export type ArkLiveCandidate = {id: string; /** The kind (a herd's key, else the species): quotas are per kind. */ group: string};

/** A stable 32-bit hash of a string (FNV-1a), for the ring order. */
export function arkHash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Per kind, how many are out: at least one each (budget allowing), the rest in proportion to the kind's size, never
 * more than it has. Monotone in the budget (a larger budget never takes one out of a kind).
 */
export function arkQuotas(sizes: Map<string, number>, budget: number): Map<string, number> {
    const quotas = new Map<string, number>();
    let total = 0;
    sizes.forEach((n) => {
        total += n;
    });
    if (total <= budget) {
        sizes.forEach((n, key) => quotas.set(key, n));
        return quotas;
    }
    // q(k) = min(n, 1 + floor((n − 1) · k)): the largest k whose sum fits (bisection; the sum only grows with k).
    const sum = (k: number) => {
        let s = 0;
        sizes.forEach((n) => {
            s += Math.min(n, 1 + Math.floor((n - 1) * k));
        });
        return s;
    };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (sum(mid) <= budget) lo = mid;
        else hi = mid;
    }
    sizes.forEach((n, key) => quotas.set(key, Math.min(n, 1 + Math.floor((n - 1) * lo))));
    return quotas;
}

/** The rotation's step number now (the same for everyone). */
export function arkRestStep(epochSeconds: number): number {
    return Math.floor(epochSeconds / ARK_REST_STEP_SECONDS);
}

/**
 * Who is outside at `epochSeconds` within `budget` (plus `pinned`). Candidates are the animals that would be drawn
 * one by one (the herds' representatives included); anyone not returned rests out of sight.
 */
export function arkOutside(candidates: readonly ArkLiveCandidate[], budget: number, epochSeconds: number, pinned: ReadonlySet<string> = new Set()): Set<string> {
    const out = new Set<string>();
    if (candidates.length <= budget) {
        for (const candidate of candidates) out.add(candidate.id);
        pinned.forEach((id) => out.add(id));
        return out;
    }
    const groups = new Map<string, ArkLiveCandidate[]>();
    for (const candidate of candidates) {
        const list = groups.get(candidate.group);
        if (list) list.push(candidate);
        else groups.set(candidate.group, [candidate]);
    }
    const step = arkRestStep(epochSeconds);
    // More kinds than the budget: the kinds themselves take turns (one each out), on their own ring.
    let kinds = Array.from(groups.keys());
    if (kinds.length > budget) {
        const ring = kinds.map((key) => ({key, h: arkHash(`kind:${key}`)})).sort((a, b) => a.h - b.h || (a.key < b.key ? -1 : 1));
        const start = step % ring.length;
        kinds = [];
        for (let i = 0; i < Math.max(budget, 0); i++) kinds.push(ring[(start + i) % ring.length].key);
    }
    const sizes = new Map<string, number>();
    for (const key of kinds) sizes.set(key, groups.get(key)!.length);
    const quotas = arkQuotas(sizes, Math.max(budget, 0));
    for (const key of kinds) {
        const members = groups.get(key)!;
        const quota = quotas.get(key) ?? 0;
        if (quota >= members.length) {
            for (const member of members) out.add(member.id);
            continue;
        }
        const ring = members.map((member) => ({id: member.id, h: arkHash(member.id)})).sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : 1));
        // The window's start: the step, offset per kind so kinds don't share a phase.
        const start = (step + (arkHash(`phase:${key}`) % ring.length)) % ring.length;
        for (let i = 0; i < quota; i++) out.add(ring[(start + i) % ring.length].id);
    }
    pinned.forEach((id) => out.add(id));
    return out;
}
