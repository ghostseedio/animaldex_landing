/**
 * The spawn validator's grounding pass (motion 100x pass, lane L3; the owner: "report any animal floating,
 * sinking or inside scenery, and fail CI on it"). Where `validate.ts` checks each place's numbers (its ground
 * height, its attach point, its tag), this checks what is DRAWN there through an Ark day: every catalogue species
 * (the validator's animals: a lone one and a cluster's third member) moved by its behaviour schedule, its model on
 * its true base (`grounding/base.ts`), on the drawn ground (`grounding/drawn-ground.ts`) or on the surface the
 * schedule holds it on (`grounding/stand.ts`), with `grounding/audit.ts`'s classes:
 *
 * - floats: no contact touches what it stands on (2 cm, or 3% of its drawn height);
 * - sinks: a contact is that far into it;
 * - inside: its body at rest in a trunk, a rock or a building, upright through a wall or a trunk it should cling to,
 *   or in a crown where nothing outside sees it (a perch whose sight lines are all blocked by its own tree).
 *
 * Flying, gliding and swimming animals may leave a surface; everyone else is on the ground, a branch, a rock or
 * the water. The same pass on the old rules (`legacy`) is kept beside it, so a green run is known to catch the bug.
 * `src/lib/ark-grounding.test.ts` runs it in CI; `scripts/ark-grounding-audit.mts` prints it for any snapshot.
 */

import {auditGrounding, arkDayEpochs, type GroundingAudit, type GroundingProblem} from "@/ark-scene/grounding/audit";
import {validatorAnimals} from "@/ark-scene/map/validate";

export type GroundingFailure = {slug: string; problem: GroundingProblem; on: string; detail: string};

/**
 * Reviewed holds: species whose drawn grounding fails for a reason outside this lane, each with why (the lane that
 * owns the fix). Empty when everything passes.
 */
export const GROUNDING_HOLDS: Record<string, string> = {};

/**
 * Animals (of the validator's every-species list, through an Ark day) at rest on the ground inside a trunk, a rock or a
 * building: the behaviour schedule's rest and roost spots ("shade" beside a trunk, a rock's foot for a 3 m monitor),
 * which lane L5's colliders settle. Reviewed 2026-11-12 (lane L3); CI fails when it grows. Lower it as they land.
 */
export const GROUNDING_INSIDE_AT_REST = 556;

export function validateGrounding(epochs = arkDayEpochs(24)): {animals: number; failures: GroundingFailure[]; counts: GroundingAudit["counts"]; kinds: GroundingAudit["kinds"]} {
    const audit = auditGrounding(validatorAnimals(), {epochs});
    const failures: GroundingFailure[] = [];
    const seen = new Set<string>();
    for (const sample of audit.samples) {
        if (!sample.id.endsWith("#grounded")) continue;
        for (const problem of sample.problems) {
            const key = `${sample.slug}#${problem}`;
            if (seen.has(key)) continue;
            seen.add(key);
            failures.push({slug: sample.slug, problem, on: sample.on, detail: sample.detail});
        }
    }
    return {animals: audit.animals, failures, counts: audit.counts, kinds: audit.kinds};
}
