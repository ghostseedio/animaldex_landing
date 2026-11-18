/**
 * "Estimated time left" for a released animal still learning to find food (AnimalDex docs/ark/release-p1-8.md; the
 * hook decision 393 left for wild skill). Pure, and from odds only: it reads the animal's published wild skill and the
 * day it was released (`/api/ark/release`), and the rule's own numbers. It never reads or guesses a draw.
 *
 * The rule (ark-ecology `release.ts`): for 7 real days after its release its time is cut into bouts, each a quarter of
 * its kind's starvation time (never under 4 Ark days). In a bout it finds food with chance 0.4 + 0.6 x skill; four
 * missed in a row and it starves. The curve below is the exact chance that has not happened by each coming bout, with
 * its skill growing 0.02 a real day as it survives (a step its owner does later only makes it better than this).
 */

import {arkStats, massFromSize} from "@/ark-scene/stats";
import {STARVE} from "@/lib/ark-time-left-constants";
import type {ArkTimeLeftHook} from "@/lib/ark-time-left";

/** The engine's numbers (`DEFAULT_RELEASE`; `ark-release.test.ts` checks them against an AnimalDex checkout). */
export const ARK_RELEASE_RULE = {
    startSkill: 0.2,
    dailyGain: 0.02,
    stepGain: 0.2,
    learnRealDays: 7,
    findBase: 0.4,
    findSlope: 0.6,
    boutsToStarve: 4,
    minBoutDays: 4,
    hungryAfterBouts: 2,
    weakUntilSkill: 0.6,
    waryRealDays: 3
} as const;

export const ARK_DAYS_PER_REAL_DAY = 365 / 14;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** One bout in Ark days for a body mass: a quarter of the engine's `starveDays`, never under the floor. */
export function arkReleaseBoutDays(massKg: number): number {
    const starve = clamp(Math.round(STARVE.baseDays * massKg ** STARVE.massExponent), STARVE.minDays, STARVE.maxDays);
    return Math.max(1, ARK_RELEASE_RULE.minBoutDays, starve / ARK_RELEASE_RULE.boutsToStarve);
}

/**
 * The chance it has not starved, `days` Ark days from now, by the bout rule alone: 1 until its next bout ends, then a
 * step down at each bout, flat once its learning is over. `skill` is its wild skill now; `sinceDays` the Ark days since
 * its release. Null when its learning is already over.
 */
export function arkReleaseSurvival(input: {skill: number; sinceDays: number; boutDays: number}): ((days: number) => number) | null {
    const rule = ARK_RELEASE_RULE;
    const learn = rule.learnRealDays * ARK_DAYS_PER_REAL_DAY;
    const since = Math.max(0, input.sinceDays);
    if (!(input.boutDays > 0) || since >= learn) return null;
    const bout = input.boutDays;
    const k = rule.boutsToStarve;
    // The chance of each missed run so far is not published: start from "it found food in its last bout".
    let runs: number[] = Array.from({length: k}, (_, i) => (i === 0 ? 1 : 0));
    let dead = 0;
    const steps: Array<{at: number; alive: number}> = [];
    for (let end = (Math.floor(since / bout + 1e-9) + 1) * bout; end <= learn + 1e-9; end += bout) {
        const ahead = end - since;
        const skill = clamp(input.skill + rule.dailyGain * ahead / ARK_DAYS_PER_REAL_DAY, 0, 1);
        const find = clamp(rule.findBase + rule.findSlope * skill, 0, 1);
        const next: number[] = Array.from({length: k}, () => 0);
        const alive = runs.reduce((sum, p) => sum + p, 0);
        next[0] = find * alive;
        for (let r = 0; r + 1 < k; r++) next[r + 1] = (1 - find) * runs[r];
        dead += (1 - find) * runs[k - 1];
        runs = next;
        steps.push({at: ahead, alive: Math.max(0, 1 - dead)});
    }
    if (!steps.length) return null;
    return (days: number) => {
        let alive = 1;
        for (const step of steps) {
            if (step.at > days) break;
            alive = step.alive;
        }
        return alive;
    };
}

/**
 * The hook for one released animal (its public release: the day and its wild skill now), for `arkTimeLeft`: while it
 * lives free and is still learning it is at risk, and says why. Null for an animal back in care, or once it has learnt.
 */
export function arkReleaseTimeLeftHook(release: {releasedArkDay: number; wildSkill: number}): ArkTimeLeftHook {
    return (animal, world) => {
        if (animal.area || typeof world.arkDay !== "number" || !Number.isFinite(world.arkDay)) return null;
        if (!Number.isFinite(release.releasedArkDay) || !Number.isFinite(release.wildSkill)) return null;
        const mass = massFromSize(arkStats({model_slug: animal.model_slug, stats: animal.stats}).size);
        const survival = arkReleaseSurvival({skill: release.wildSkill, sinceDays: world.arkDay - release.releasedArkDay, boutDays: arkReleaseBoutDays(mass)});
        return survival ? {survival, reason: {kind: "skill"}} : null;
    };
}
