import assert from "node:assert/strict";
import test from "node:test";
import {
    type AnimalPower,
    type CapturePlayEligibilityMap,
    EVERYDAY_APPLICATION_ORDER,
    OFFERED_APPLICATION_DOMAINS,
    allChallengersPowerLocked,
    applicationDomainShortlist,
    decodeAnimalPower,
    decodeCapturePlayEligibility,
    gateIsLocked,
    gatePermitsPlay,
    powerRefusalMessage
} from "@/lib/animal-powers";
import {
    type AnimalTrial,
    decodeAnimalTrial,
    primaryActionTitle,
    requiresText,
    verifierRefusalMessage
} from "@/lib/animal-trials";
import {resolveCaptureHeadlineDisplay} from "@/lib/capture-headline-display";
import {
    identityLabelHasProseLead,
    sanitizedIdentityDisplayLabel,
    sanitizedRefinementDisplayLabel
} from "@/lib/taxonomic-identity-labels";

const SPECIES = "742b057b-47c4-447a-a61c-53d0b28c5e00";

function power(overrides: Partial<AnimalPower> = {}): AnimalPower {
    const decoded = decodeAnimalPower({
        species_profile_id: SPECIES,
        species_display_name: "Cheetah",
        principle_name: "Spring-Loaded Spine",
        is_earned: false,
        has_trial: true,
        suggested_domains: []
    });
    assert.ok(decoded);
    return {...decoded, ...overrides};
}

function eligibility(rows: Array<[string, string]>): CapturePlayEligibilityMap {
    const map: CapturePlayEligibilityMap = {};
    for (const [captureId, status] of rows) {
        const decoded = decodeCapturePlayEligibility({capture_id: captureId, power_gate_status: status});
        assert.ok(decoded);
        map[decoded.captureId] = decoded;
    }
    return map;
}

test("only not_earned locks; both content-gap states permit play without being earned", () => {
    assert.equal(gatePermitsPlay("earned"), true);
    assert.equal(gatePermitsPlay("not_applicable_missing_power"), true);
    assert.equal(gatePermitsPlay("not_applicable_unresolved_species"), true);
    assert.equal(gatePermitsPlay("not_earned"), false);

    assert.equal(gateIsLocked("not_earned"), true);
    assert.equal(gateIsLocked("not_applicable_missing_power"), false);
    assert.equal(gateIsLocked("earned"), false);
});

test("an unrecognised gate status never reads as earned or as locked", () => {
    const decoded = decodeCapturePlayEligibility({capture_id: "ABC", power_gate_status: "something_new"});
    assert.ok(decoded);
    assert.equal(decoded.powerGateStatus, "not_applicable_unresolved_species");
    assert.equal(decoded.captureId, "abc");
    assert.equal(decoded.challengeHealth, 3);
});

test("the public Compare lock fails open wherever the answer is not known", () => {
    assert.equal(allChallengersPowerLocked(["a"], null), false, "no eligibility read yet");
    assert.equal(allChallengersPowerLocked([], eligibility([["a", "not_earned"]])), false, "no candidates");
    assert.equal(allChallengersPowerLocked(["missing"], eligibility([["a", "not_earned"]])), false, "candidate with no row");
});

test("the public Compare lock closes only when every challenger is unearned", () => {
    const allLocked = eligibility([["a", "not_earned"], ["b", "not_earned"]]);
    assert.equal(allChallengersPowerLocked(["a", "b"], allLocked), true);

    const oneEarned = eligibility([["a", "not_earned"], ["b", "earned"]]);
    assert.equal(allChallengersPowerLocked(["a", "b"], oneEarned), false);

    const oneGap = eligibility([["a", "not_earned"], ["b", "not_applicable_missing_power"]]);
    assert.equal(allChallengersPowerLocked(["a", "B"], oneGap), false, "a content gap still permits play");
});

test("a Power row decodes retired domains onto their successor and drops unknowns", () => {
    const decoded = decodeAnimalPower({
        species_profile_id: SPECIES,
        principle_name: "Hidden Strategy",
        is_earned: true,
        earned_via: "application",
        earned_at: "2026-09-27T10:00:00+00",
        has_trial: false,
        suggested_domains: ["CURRENCY_STYLE", "MONEY_FINANCE", "NOT_A_DOMAIN", "STRATEGY"]
    });
    assert.ok(decoded);
    assert.deepEqual(decoded.suggestedDomains, ["MONEY_FINANCE", "STRATEGY"]);
    assert.equal(decoded.isEarned, true);
    assert.equal(decoded.earnedVia, "application");
    assert.equal(decoded.hasTrial, false);
    assert.equal(decoded.speciesDisplayName, "This animal");
});

test("a row that names no Power is not a Power", () => {
    assert.equal(decodeAnimalPower({species_profile_id: SPECIES}), null);
    assert.equal(decodeAnimalPower({principle_name: "Orphan"}), null);
});

test("the shortlist is six everyday domains, the animal's own ranked first", () => {
    assert.deepEqual(applicationDomainShortlist(power()), EVERYDAY_APPLICATION_ORDER);

    const ranked = applicationDomainShortlist(power({suggestedDomains: ["STARS", "STRATEGY", "BUSINESS"]}));
    assert.equal(ranked.length, 6);
    assert.deepEqual(ranked.slice(0, 2), ["STRATEGY", "BUSINESS"]);
    assert.ok(!ranked.includes("STARS"), "things to learn about wait behind More");
});

test("all eighteen domains stay reachable and UNKNOWN is never offered", () => {
    assert.equal(OFFERED_APPLICATION_DOMAINS.length, 18);
    assert.equal(new Set(OFFERED_APPLICATION_DOMAINS).size, 18);
    assert.ok(!(OFFERED_APPLICATION_DOMAINS as string[]).includes("UNKNOWN"));
});

test("a grader outage is never phrased as a refusal", () => {
    assert.match(powerRefusalMessage("grading_unavailable"), /Nothing was used up/);
    assert.equal(powerRefusalMessage("unmapped_code", "Server said so."), "Server said so.");
});

function trial(overrides: Record<string, unknown>): AnimalTrial {
    const decoded = decodeAnimalTrial({
        species_profile_id: SPECIES,
        frequency: "LOW",
        title: "Identify Five Materials by Touch",
        primary_proof_type: "text",
        proof_types: ["text"],
        status: "active",
        ...overrides
    });
    assert.ok(decoded);
    return decoded;
}

test("a text Trial asks for writing, never for a camera", () => {
    const written = trial({});
    assert.equal(requiresText(written), true);
    assert.equal(primaryActionTitle(written), "WRITE YOUR ANSWER");

    const photo = trial({primary_proof_type: "photo", proof_types: ["photo"]});
    assert.equal(requiresText(photo), false);
    assert.equal(primaryActionTitle(photo), "ADD EVIDENCE");
});

test("text refusals have their own copy", () => {
    assert.match(verifierRefusalMessage("proof_text_required"), /answered in writing/);
    assert.match(verifierRefusalMessage("proof_text_too_short"), /little more/);
});

test("a label that opens like a sentence is prose; a real name is not", () => {
    for (const prose of ["n adult Asian Arowana", "clearly a Bactrian Camel", "an adult raccoon", "domestic varieties"]) {
        assert.equal(identityLabelHasProseLead(prose), true, prose);
    }
    for (const name of ["minute pirate bug", "Many-banded Krait", "Domestic Cat", "Common Raccoon", "Asian Arowana"]) {
        assert.equal(identityLabelHasProseLead(name), false, name);
    }
});

test("a prose lead is stripped down to the name it was wrapped around", () => {
    assert.equal(sanitizedIdentityDisplayLabel("n adult Asian Arowana"), "Asian Arowana");
    assert.equal(sanitizedIdentityDisplayLabel("clearly a Bactrian Camel"), "Bactrian Camel");
    assert.equal(sanitizedIdentityDisplayLabel("Asian Arowana"), "Asian Arowana");
});

test("a refinement that is still prose after repair is dropped", () => {
    assert.equal(sanitizedRefinementDisplayLabel("domestic varieties"), null);
    assert.equal(sanitizedRefinementDisplayLabel("it is a"), null);
    assert.equal(sanitizedRefinementDisplayLabel("n adult Asian Arowana"), "Asian Arowana");
});

test("a prose refinement never becomes a capture title", () => {
    const dropped = resolveCaptureHeadlineDisplay({
        animalName: "Chicken",
        refinedIdentity: "domestic varieties",
        breedConfidence: 0.95,
        confidence: 0.95
    });
    assert.equal(dropped.animalName, "Chicken");

    const repaired = resolveCaptureHeadlineDisplay({
        animalName: "Arowana",
        refinedIdentity: "n adult Asian Arowana",
        breedConfidence: 0.95,
        confidence: 0.95
    });
    assert.equal(repaired.animalName, "Asian Arowana");
});
