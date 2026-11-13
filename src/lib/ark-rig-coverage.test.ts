/**
 * The rig set's clip coverage against what the scene asks of each species (movement audit MA4, its CI table;
 * docs/ark/movement-audit-2026-11-13.md finding 8): flight-approved flyers with frozen wings (no flap and no open-wing
 * clip: they hold the take-off's last frame all flight), approved birds and bats with no take-off or landing clip,
 * species that fly on the schedule without approval (they fade out of their rig in the air), and swimmers with legs
 * that have no stroke (paddle or swim) or no way into and out of the water.
 *
 * Read from `tests/ark-motion/rig-coverage-<version>.json` (`scripts/ark-rig-coverage.mts`, the publish set's
 * `detail.json`) for the set the scene reads (`rig-clips.ts` ARK_RIG_VERSION). Held at no worse than the live v2 set
 * (`COVERAGE_MOST`); the audit's target is 0 for the flyers, which MA2's v3 set reaches (1 / 0 / 0) once it is uploaded.
 * The swimmers' gaps wait on a rigging pass (decision 281's queue).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {ARK_RIG_VERSION} from "@/ark-scene/rig-clips";
import {recordMotionMetric} from "@/lib/ark-motion-metrics";

type Coverage = {version: string; clips: string[]; species: Record<string, string>};
const load = (version: string): Coverage => JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/ark-motion", `rig-coverage-${version}.json`), "utf8"));

/** The most each gap may be: the live v2 set's own counts (2026-11-13). Lower them as rigs are fixed; never raise them. */
export const COVERAGE_MOST = {frozenWings: 18, noTakeoffLanding: 7, fliesUnapproved: 12, swimmersNoStroke: 70, swimmersNoEntry: 108};

const BIRDISH = new Set(["flying_bird", "walking_bird", "flightless_bird", "bat"]);
const NO_LEGS = new Set(["fish", "legless", "cephalopod_jelly", "other"]);

export function coverageGaps(cov: Coverage): Record<keyof typeof COVERAGE_MOST, string[]> {
    const rows = Object.entries(cov.species).map(([slug, row]) => {
        const [plan, flags, bits] = row.split("|");
        return {slug, plan, flags, has: (clip: string) => bits[cov.clips.indexOf(clip)] === "1"};
    });
    const approved = rows.filter((r) => r.flags.includes("a"));
    const flies = (slug: string) => {
        const p = behaviourProfile(slug);
        return p.move === "fly" || p.moves.includes("fly");
    };
    const swims = (slug: string) => {
        const p = behaviourProfile(slug);
        return p.move === "swim" || p.moves.includes("swim");
    };
    // (A sitting rest pose keeps its idle whatever it does: no movement clip ever plays, `rig-clips.ts`.)
    const swimmers = rows.filter((r) => !NO_LEGS.has(r.plan) && !r.flags.includes("s") && swims(r.slug));
    return {
        frozenWings: approved.filter((r) => !r.has("flap") && !r.has("glide") && !r.has("soar") && !r.has("hover")).map((r) => r.slug),
        noTakeoffLanding: approved.filter((r) => BIRDISH.has(r.plan) && (!r.has("takeoff") || !r.has("land"))).map((r) => r.slug),
        fliesUnapproved: rows.filter((r) => BIRDISH.has(r.plan) && !r.flags.includes("a") && !r.flags.includes("s") && flies(r.slug)).map((r) => r.slug),
        swimmersNoStroke: swimmers.filter((r) => !r.has("paddle") && !r.has("swim")).map((r) => r.slug),
        swimmersNoEntry: swimmers.filter((r) => !r.has("enter_water") || !r.has("exit_water")).map((r) => r.slug)
    };
}

test("MA4 metric: rig coverage: no more flyers with frozen wings, without take-off or landing, or flying unapproved; no more swimmers without a stroke or a way into the water", () => {
    const cov = load(ARK_RIG_VERSION);
    assert.equal(cov.version, ARK_RIG_VERSION);
    assert.ok(Object.keys(cov.species).length > 2000);
    const gaps = coverageGaps(cov);
    const over: string[] = [];
    for (const [key, list] of Object.entries(gaps) as Array<[keyof typeof COVERAGE_MOST, string[]]>) {
        recordMotionMetric("ma4", `rig_${key}`, list.length);
        if (list.length > COVERAGE_MOST[key]) over.push(`${key} ${list.length} > ${COVERAGE_MOST[key]}: ${list.join(", ")}`);
    }
    assert.deepEqual(over, []);
    // (The audit's own examples on v2: the great cormorant's frozen wings, the red-tailed hawk's missing take-off, the barn owl flying unapproved.)
    if (ARK_RIG_VERSION === "v2") {
        assert.ok(gaps.frozenWings.includes("great-cormorant"));
        assert.ok(gaps.noTakeoffLanding.includes("red-tailed-hawk"));
        assert.ok(gaps.fliesUnapproved.includes("barn-owl"));
    }
});

test("MA4: the v3 bird rigs (MA2, built, awaiting upload) close the flyer gaps", () => {
    const file = path.join(process.cwd(), "tests/ark-motion/rig-coverage-v3.json");
    if (!fs.existsSync(file)) return;
    const gaps = coverageGaps(load("v3"));
    // (The tent-making bat is a bat with no flap of its own: not a bird rig, so v3 does not touch it.)
    assert.deepEqual(gaps.frozenWings, ["tent-making-bat"]);
    assert.deepEqual(gaps.noTakeoffLanding, []);
    assert.deepEqual(gaps.fliesUnapproved, []);
});
