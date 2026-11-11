/**
 * The audit's checks that need no clock: which flyers have a working wing
 * rig, and which species have a neck or head bone a look-at could turn. From
 * the rig run's files (`scene-data.ts`); without them, null.
 */

import type {AuditProfile} from "./fixture";
import type {AuditFeatures} from "./types";
import type {SceneData} from "./scene-data";

const FLYING_PLANS = new Set(["flying_bird", "bat", "flying_insect"]);

export function staticChecks(profiles: AuditProfile[], data: SceneData, features: AuditFeatures) {
    if (!data.rigBones.size) return null;
    const flyers = profiles.filter((p) => !p.excluded && (FLYING_PLANS.has(p.plan) || p.move === "fly"));
    const byPlan = new Map<string, {species: number; rigged: number; published: number; flapClip: number; flapPassed: number; flapHeld: number; working: number; fallback: number}>();
    const perSpecies: Array<{slug: string; plan: string; rig: string; published: boolean; flap: string; working: boolean}> = [];
    for (const p of flyers) {
        const row = byPlan.get(p.plan) ?? {species: 0, rigged: 0, published: 0, flapClip: 0, flapPassed: 0, flapHeld: 0, working: 0, fallback: 0};
        row.species++;
        const rig = data.rigBones.get(p.slug);
        const published = data.publishedRigs.has(p.slug);
        let flap = "no rig";
        let working = false;
        if (rig) {
            row.rigged++;
            if (rig.state === "fallback") row.fallback++;
            if (published) row.published++;
            const clip = rig.flightClips.flap;
            if (clip) {
                row.flapClip++;
                if (clip.pass) row.flapPassed++;
                if (clip.held) row.flapHeld++;
                flap = clip.pass ? "passed" : clip.held ? "held (wing cards await owner review)" : "failed";
                working = clip.pass && published && features.flightClips;
            } else flap = rig.state === "fallback" ? "fallback rig" : "no flap clip";
        }
        if (working) row.working++;
        byPlan.set(p.plan, row);
        perSpecies.push({slug: p.slug, plan: p.plan, rig: rig?.state ?? "none", published, flap, working});
    }
    const heads = new Map<string, {species: number; rigged: number; neck: number; head: number; published: number; publishedWithHead: number}>();
    for (const p of profiles) {
        if (p.excluded) continue;
        const row = heads.get(p.plan) ?? {species: 0, rigged: 0, neck: 0, head: 0, published: 0, publishedWithHead: 0};
        row.species++;
        const rig = data.rigBones.get(p.slug);
        if (rig?.bones.length) {
            row.rigged++;
            const neck = rig.bones.some((b) => /neck/i.test(b));
            const head = rig.bones.some((b) => /^head|_head|head$/i.test(b));
            if (neck) row.neck++;
            if (head) row.head++;
            if (data.publishedRigs.has(p.slug)) {
                row.published++;
                if (head || neck) row.publishedWithHead++;
            }
        }
        heads.set(p.plan, row);
    }
    const total = (map: Map<string, Record<string, number>>) => {
        const out: Record<string, number> = {};
        for (const row of Array.from(map.values())) for (const [k, v] of Object.entries(row)) out[k] = (out[k] ?? 0) + (v as number);
        return out;
    };
    return {
        flightRigs: {byPlan: Object.fromEntries(byPlan), total: total(byPlan as never), perSpecies},
        headBones: {byPlan: Object.fromEntries(heads), total: total(heads as never), usedForLooking: features.headLook}
    };
}
