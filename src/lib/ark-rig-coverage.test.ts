/**
 * The rig set's clip coverage against what the scene asks of each species (movement audit MA4, its CI table;
 * docs/ark/movement-audit-2026-11-13.md finding 8): flight-approved flyers with frozen wings (no flap and no open-wing
 * clip: they hold the take-off's last frame all flight), approved birds and bats with no take-off or landing clip,
 * species that fly on the schedule without approval (they fade out of their rig in the air), and swimmers with legs
 * that have no stroke (paddle or swim) or no way into and out of the water.
 *
 * Read from `tests/ark-motion/rig-coverage-<version>.json` (`scripts/ark-rig-coverage.mts`, the publish set's
 * `detail.json`) for the set the scene reads (`rig-clips.ts` ARK_RIG_VERSION). Each set is held at no worse than its own
 * counts (`COVERAGE_MOST`, keyed by the fixture's version, decision 296); the audit's target is 0 for the flyers, which
 * MA2's v3 set (uploaded, decision 289) reaches (1 / 0 / 0). The swimmers' gaps wait on a rigging pass (decision 281's
 * queue).
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

type Gap = "frozenWings" | "noTakeoffLanding" | "fliesUnapproved" | "swimmersNoStroke" | "swimmersNoEntry";
/**
 * The most each gap may be, per rig set (the fixture's version; decision 296): each set's own counts (2026-11-13). Lower
 * them as rigs are fixed; never raise a version's own numbers.
 */
export const COVERAGE_MOST: Record<string, Record<Gap, number>> = {
    v2: {frozenWings: 18, noTakeoffLanding: 7, fliesUnapproved: 12, swimmersNoStroke: 70, swimmersNoEntry: 108},
    // v3 (MA2's bird re-rig). swimmersNoEntry 109 (and swimmersNoStroke 70 with it): the red-necked phalarope is new in
    // v3, one of the 5 birds v2 left out that MA2 put in (decision 277, row 10); in v2 it played a v1 file with no
    // flight, so this is coverage that grew, not a lost clip. Its water entry/exit and stroke clips are queued for the
    // next rigging pass.
    v3: {frozenWings: 1, noTakeoffLanding: 0, fliesUnapproved: 0, swimmersNoStroke: 70, swimmersNoEntry: 109}
};

const BIRDISH = new Set(["flying_bird", "walking_bird", "flightless_bird", "bat"]);
const NO_LEGS = new Set(["fish", "legless", "cephalopod_jelly", "other"]);

export function coverageGaps(cov: Coverage): Record<Gap, string[]> {
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
    const most = COVERAGE_MOST[cov.version];
    assert.ok(most, `no coverage limits for rig set ${cov.version}`);
    const gaps = coverageGaps(cov);
    const over: string[] = [];
    for (const [key, list] of Object.entries(gaps) as Array<[Gap, string[]]>) {
        recordMotionMetric("ma4", `rig_${key}`, list.length);
        if (list.length > most[key]) over.push(`${key} ${list.length} > ${most[key]}: ${list.join(", ")}`);
    }
    assert.deepEqual(over, []);
    // (The audit's own examples on v2: the great cormorant's frozen wings, the red-tailed hawk's missing take-off, the barn owl flying unapproved.)
    if ((ARK_RIG_VERSION as string) === "v2") {
        assert.ok(gaps.frozenWings.includes("great-cormorant"));
        assert.ok(gaps.noTakeoffLanding.includes("red-tailed-hawk"));
        assert.ok(gaps.fliesUnapproved.includes("barn-owl"));
    }
});

test("MA4: the v3 bird rigs (MA2, uploaded, decision 289) close the flyer gaps", () => {
    const file = path.join(process.cwd(), "tests/ark-motion/rig-coverage-v3.json");
    if (!fs.existsSync(file)) return;
    const gaps = coverageGaps(load("v3"));
    // (The tent-making bat is a bat with no flap of its own: not a bird rig, so v3 does not touch it.)
    assert.deepEqual(gaps.frozenWings, ["tent-making-bat"]);
    assert.deepEqual(gaps.noTakeoffLanding, []);
    assert.deepEqual(gaps.fliesUnapproved, []);
});
