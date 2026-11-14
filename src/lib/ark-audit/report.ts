/**
 * The behaviour audit's markdown: one tree's numbers, or two side by side
 * (before → after) with the target for each check.
 */

import type {AuditResult} from "./metrics";
import type {CameraResult} from "./types";

type Full = AuditResult & {static?: unknown; camera?: CameraResult | null};
/** Pass C's numbers, or "–" for a tree without the reactive layer (or a run from before pass C). */
const cam = (r: Full, pick: (c: CameraResult) => unknown) => (r.camera ? pick(r.camera) : "–");
const pc = (x: number | null) => (x === null ? "–" : `${x}%`);
type Row = {problem: string; check: string; target: string; value: (r: Full) => unknown};

const v = (x: unknown): string => {
    if (x === null || x === undefined) return "–";
    if (typeof x === "boolean") return x ? "yes" : "no";
    if (typeof x === "number") return Number.isInteger(x) ? x.toLocaleString("en-US") : String(x);
    if (typeof x === "object") return Object.entries(x as Record<string, unknown>).map(([k, val]) => `${k} ${v(val)}`).join(", ");
    return String(x);
};

const staticOf = (r: Full) => r.static as null | {flightRigs: {total: Record<string, number>}; headBones: {total: Record<string, number>; usedForLooking: boolean}};

export const ROWS: Row[] = [
    {problem: "1 Flight", check: "Species that ever fly (of catalogue flyers)", target: "all flyers", value: (r) => `${r.flight.speciesThatFly} / ${r.flight.flyingSpeciesInCatalogue}`},
    {problem: "1 Flight", check: "Airborne time with wings closed", target: "0%", value: (r) => (r.flight.airborneWingsClosedPct === null ? "– (none airborne)" : `${r.flight.airborneWingsClosedPct}%`)},
    {problem: "1 Flight", check: "Flight clips the scene may play", target: "yes", value: (r) => r.flight.flightClipsPlayable},
    {problem: "1 Flight", check: "Bird models with a wing shader", target: "> 0 or rigs", value: (r) => r.flight.wingShaderBirdSpecies},
    {problem: "1 Flight", check: "Flyer species with a working wing rig", target: "all rigged flyers", value: (r) => (staticOf(r) ? `${staticOf(r)!.flightRigs.total.working ?? 0} / ${staticOf(r)!.flightRigs.total.species ?? 0}` : "–")},
    {problem: "1 Flight", check: "…with a flap clip made / passed / held", target: "passed", value: (r) => (staticOf(r) ? `${staticOf(r)!.flightRigs.total.flapClip ?? 0} / ${staticOf(r)!.flightRigs.total.flapPassed ?? 0} / ${staticOf(r)!.flightRigs.total.flapHeld ?? 0}` : "–")},
    {problem: "2 Roaming", check: "Airborne time spent circling (≥1 full turn a minute inside 20 m)", target: "< 10%", value: (r) => (r.roaming.circlingPct === null ? "–" : `${r.roaming.circlingPct}%`)},
    {problem: "2 Roaming", check: "Full turns per airborne minute", target: "< 0.5", value: (r) => r.roaming.fullTurnsPerAirMinute},
    {problem: "2 Roaming", check: "…all but the hawkers and the thermal soarers: circling / turns a minute", target: "< 10% / < 0.5", value: (r) => (r.roaming.exceptHawking ? `${r.roaming.exceptHawking.circlingPct ?? "–"}% / ${r.roaming.exceptHawking.fullTurnsPerAirMinute ?? "–"}` : "–")},
    {problem: "2 Roaming", check: "…the hawkers (swallows, martins, swifts): circling / turns a minute", target: "by design", value: (r) => (r.roaming.hawking ? `${r.roaming.hawking.circlingPct ?? "–"}% / ${r.roaming.hawking.fullTurnsPerAirMinute ?? "–"} (${r.roaming.hawking.species} species)` : "–")},
    {problem: "2 Roaming", check: "…the thermal soarers (buzzards, eagles, vultures, storks): circling / turns a minute", target: "by design", value: (r) => (r.roaming.soaring ? `${r.roaming.soaring.circlingPct ?? "–"}% / ${r.roaming.soaring.fullTurnsPerAirMinute ?? "–"} (${r.roaming.soaring.species} species)` : "–")},
    {problem: "2 Roaming", check: "Flyers following another (≥50% of air time together)", target: "flocking species only", value: (r) => `${r.roaming.followers} (not flocking: ${r.roaming.followersNotFlockingSpecies}, other species: ${r.roaming.followersOfAnotherSpecies})`},
    {problem: "2 Roaming", check: "Height above ground in the air (m)", target: "varied by species", value: (r) => r.roaming.airHeightAboveGroundM},
    {problem: "2 Roaming", check: "Distinct cruise heights (2 m bands, species medians)", target: "many", value: (r) => r.roaming.distinctSpeciesCruiseHeights},
    {problem: "2 Roaming", check: "Landing spots per flyer (pass B)", target: "several", value: (r) => r.roaming.landingSpotsPerFlyerDay},
    {problem: "2 Roaming", check: "Distance per animal-day (m)", target: "> 0, by species", value: (r) => r.roaming.distanceMPerAnimalDay},
    {problem: "2 Roaming", check: "Rest spots per animal-day (2 m cells)", target: "several", value: (r) => r.roaming.restSpotsPerAnimalDay},
    {problem: "3 Grazing", check: "Grazer awake time labelled graze, at the grass", target: "majority", value: (r) => (r.grazing.grazeLabelAtGrassPct === null ? "–" : `${r.grazing.grazeLabelAtGrassPct}%`)},
    {problem: "3 Grazing", check: "Grazer awake time head-down grazing (drawn)", target: "majority", value: (r) => `${r.grazing.headDownGrazingPct ?? 0}%`},
    {problem: "3 Grazing", check: "Grazer awake time standing / walking", target: "minority", value: (r) => `${r.grazing.standingPct ?? 0}% / ${r.grazing.walkingPct ?? 0}%`},
    {problem: "3 Grazing", check: "Grazers that never grazed in the period", target: "0", value: (r) => `${r.grazing.grazersThatNeverGrazed} / ${r.grazing.grazerAnimals}`},
    {problem: "4 Land↔water", check: "Amphibious animals with any transition", target: "all", value: (r) => `${r.landWater.amphibiousWithATransition} / ${r.landWater.amphibiousAnimals}`},
    {problem: "4 Land↔water", check: "Transitions walked or swum / flown / in place / jumped", target: "walked > 0, jumped 0", value: (r) => `${r.landWater.transitions.walked} / ${r.landWater.transitions.flew} / ${r.landWater.transitions.inPlace ?? 0} / ${r.landWater.transitions.snapped}`},
    {problem: "4 Land↔water", check: "Ducks and kin: transitions (walked)", target: "> 0 each day", value: (r) => `${r.landWater.duckTransitions} (${r.landWater.duckWalkedTransitions}) over ${r.landWater.ducksAndKin} animals`},
    {problem: "4 Land↔water", check: "An entry/exit motion (wade, hop in, climb out)", target: "yes", value: (r) => r.landWater.entryExitClip},
    {problem: "5 Heads", check: "Rigged species with a neck or head bone (published)", target: "most", value: (r) => (staticOf(r) ? `neck ${staticOf(r)!.headBones.total.neck ?? 0}, head ${staticOf(r)!.headBones.total.head ?? 0} of ${staticOf(r)!.headBones.total.rigged ?? 0} rigged; published with one ${staticOf(r)!.headBones.total.publishedWithHead ?? 0}` : "–")},
    {problem: "5 Heads", check: "A head turns on its own (look-at)", target: "yes", value: (r) => r.features.headLook},
    {problem: "5 Heads", check: "Near the camera (pass C): awake animals that turn their heads; share of their time", target: "most", value: (r) => cam(r, (c) => `${pc(c.heads.turnedPct)} of ${c.heads.animals}; ${pc(c.heads.framesTurnedPct)}`)},
    {problem: "6 Predators", check: "Predators with prey aboard; nearest prey at spawn (m)", target: "min ≥ 20", value: (r) => `${r.predatorPrey.predatorsWithPreyAboard}; ${v(r.predatorPrey.spawnNearestPreyM)}`},
    {problem: "6 Predators", check: "Predators with prey spawned within 5 / 10 / 20 m", target: "0", value: (r) => `${r.predatorPrey.predatorsWithPreyWithinM["5"]} / ${r.predatorPrey.predatorsWithPreyWithinM["10"]} / ${r.predatorPrey.predatorsWithPreyWithinM["20"]}`},
    {problem: "6 Predators", check: `Encounters (awake prey within ${25} m of an awake predator that hunts it; checked once a minute)`, target: "–", value: (r) => r.predatorPrey.encounters},
    {problem: "6 Predators", check: "…of which the predator came within 6 m", target: "–", value: (r) => (r.predatorPrey as {encountersCloserThan6M?: number}).encountersCloserThan6M ?? "–"},
    {problem: "6 Predators", check: "…where the prey reacts at all (looks); flees", target: "most; most flee", value: (r) => `${r.predatorPrey.preyReactPct ?? 0}%; ${r.predatorPrey.encountersWithFlight}`},
    {problem: "6 Predators", check: "Median seconds to react", target: "< 3", value: (r) => r.predatorPrey.medianSecondsToLook},
    {problem: "6 Predators", check: "Near the camera (pass C): prey with a hunter within 25 m that react; flee", target: "most; most flee", value: (r) => cam(r, (c) => `${pc(c.hunts.reactPct)}; ${pc(c.hunts.fleePct)} of ${c.hunts.encounters}`)},
    {problem: "6 Predators", check: "Near the camera (pass C): median seconds to react", target: "< 3", value: (r) => cam(r, (c) => c.hunts.medianSecondsToReact)},
    {problem: "7 Variety", check: "Species with 3+ aboard: moments all in one state", target: "rarely", value: (r) => (r.variety.allSameStatePct === null ? "–" : `${r.variety.allSameStatePct}%`)},
    {problem: "7 Variety", check: "…counting only moments the whole group is awake", target: "rarely", value: (r) => pc((r.variety as {awakeAllSamePct?: number | null}).awakeAllSamePct ?? null)},
    {problem: "7 Variety", check: "Species always in the same state", target: "0", value: (r) => `${r.variety.speciesAlwaysInStep} / ${r.variety.speciesWith3Plus}`},
    {problem: "7 Variety", check: "Mean distinct states in a group of 4", target: "≥ 2", value: (r) => r.variety.meanDistinctStates},
    {problem: "7 Variety", check: "State changes made by the whole group in the same step", target: "low", value: (r) => (r.variety.stateChangesInStepPct === null ? "–" : `${r.variety.stateChangesInStepPct}%`)},
    {problem: "7 Variety", check: "Near the camera (pass C): a group of 3+ all taking the same action", target: "rarely", value: (r) => cam(r, (c) => pc(c.variety.allSamePct))},
    {problem: "Env", check: "On the wrong surface (animals; share of samples)", target: "0", value: (r) => `${r.environment.invalidSurface.animals}; ${r.environment.invalidSurface.sharePct}%`},
    {problem: "Env", check: "Floating / sinking (animals)", target: "0 / 0", value: (r) => `${r.environment.floating.animals} / ${r.environment.sinking.animals}`},
    {problem: "Env", check: "Overlapping another (animals; share of samples)", target: "0", value: (r) => `${r.environment.overlapping.animals}; ${r.environment.overlapping.sharePct}% (${v((r.environment.overlapping as {causes?: unknown}).causes)})`},
    {problem: "Env", check: "Grazers that reached grass / drinkers a water edge / perchers a perch (never)", target: "0 never", value: (r) => `${r.environment.interactions.grazersAtGrass.never} of ${r.environment.interactions.grazersAtGrass.animals} / ${r.environment.interactions.drinkersAtWaterEdge.never} of ${r.environment.interactions.drinkersAtWaterEdge.animals} / ${r.environment.interactions.perchersOnAPerch.never} of ${r.environment.interactions.perchersOnAPerch.animals}`}
];

export function renderOne(r: Full): string {
    const lines = [`# Ark behaviour audit: ${r.label} (${r.commit})`, "", `${r.period.animals} animals, ${r.period.species} species; ${r.period.days} days every ${r.period.stepSecondsA} s; flyers every 1 s for ${r.period.flightSecondsB / 3600} h.`, "", "| Problem | Check | Target | Value |", "|---|---|---|---|"];
    for (const row of ROWS) lines.push(`| ${row.problem} | ${row.check} | ${row.target} | ${v(row.value(r))} |`);
    lines.push("", `State mix: ${v(r.stateMix)}`);
    if (r.camera) lines.push("", `Pass C (${r.camera.stops} camera stops × ${r.camera.secondsPerStop} s at 10 fps, reactive tier ${r.camera.tier}): actions ${v(r.camera.actions)}`);
    return lines.join("\n") + "\n";
}

export function renderComparison(before: Full, after: Full): string {
    const lines = [
        `# Ark behaviour audit: ${before.label} (${before.commit}) → ${after.label} (${after.commit})`,
        "",
        `Same synthetic Ark on both: ${after.period.animals} animals, ${after.period.species} species (${before.period.animals} on ${before.label}); ${after.period.days} island days every ${after.period.stepSecondsA} s, flyers every second for ${after.period.flightSecondsB / 3600} h.`,
        "",
        `| Problem | Check | Target | ${before.label} | ${after.label} |`,
        "|---|---|---|---|---|"
    ];
    for (const row of ROWS) lines.push(`| ${row.problem} | ${row.check} | ${row.target} | ${v(row.value(before))} | ${v(row.value(after))} |`);
    lines.push("", `State mix, ${before.label}: ${v(before.stateMix)}`, "", `State mix, ${after.label}: ${v(after.stateMix)}`);
    return lines.join("\n") + "\n";
}
