import assert from "node:assert/strict";
import test from "node:test";
import {
    appDestinationHref,
    blockerTitle,
    candidateBlocker,
    catalogStatusLine,
    connectionStatusLabel,
    hasConfirmedLocation,
    screeningCostLabel,
    materializationCostLabel,
    humanizeImportError,
    INSTAGRAM_IMPORT_PATH,
    INSTAGRAM_IMPORT_USE_CASE_PATH,
    instagramImportAccountHref,
    instagramWebImportCtaLabel,
    archiveIntentHero,
    isAllowedInstagramMediaHost,
    isImportable,
    isInstagramWebImportLive,
    parseConnectQuery,
    pickInstagramConnection,
    primaryReviewAction,
    reviewCandidates,
    reviewHint,
    selectionBlocker,
    speciesChoices,
    summaryHeadline,
    titleText,
    uniqueCtaEvents,
    type ExternalImportCandidateRow
} from "./instagram-import";

function candidate(overrides: Partial<ExternalImportCandidateRow> = {}): ExternalImportCandidateRow {
    return {
        candidate_id: "11111111-1111-4111-8111-111111111111",
        source_post_id: "p",
        review_state: "needs_identity",
        media: [],
        ...overrides
    };
}

const barnOwlId = "22222222-2222-4222-8222-222222222222";

test("unknown animal is reserved for a genuine miss", () => {
    const empty = candidate();
    assert.equal(titleText(empty), "Unknown animal");

    const pending = candidate({
        catalog_state: "pending",
        identified_display_name: "Blue Jay",
        identified_scientific_name: "Cyanocitta cristata"
    });
    assert.equal(titleText(pending), "Blue Jay");
    assert.notEqual(titleText(pending), "Unknown animal");
    assert.equal(catalogStatusLine(pending), "Preparing AnimalDex entry");
});

test("title falls back to screening evidence when listing columns are empty", () => {
    // Production instagram-candidate-screen (Aug 22) still writes the model
    // name into identity_evidence only. Identified_* columns stay null until
    // the newer screening function is deployed.
    const fromEvidence = candidate({
        catalog_state: null,
        identified_display_name: null,
        identified_scientific_name: null,
        identity_evidence: {
            vision_animal_name: "Orangutan",
            catalog_display_name: "Bornean Orangutan",
            catalog_state: "pending"
        }
    });
    assert.equal(titleText(fromEvidence), "Bornean Orangutan");
    assert.equal(catalogStatusLine(fromEvidence), "Preparing AnimalDex entry");

    const visionOnly = candidate({
        identity_evidence: {vision_animal_name: "Saltwater Crocodile"}
    });
    assert.equal(titleText(visionOnly), "Saltwater Crocodile");
    assert.notEqual(titleText(visionOnly), "Unknown animal");
});

test("broad and needs-review keep the model's name", () => {
    const broad = candidate({
        catalog_state: "broad",
        identified_display_name: "Python"
    });
    assert.equal(titleText(broad), "Python");
    assert.equal(catalogStatusLine(broad), "Needs a more specific species");

    const review = candidate({
        catalog_state: "needs_review",
        identified_display_name: "Monitor lizard"
    });
    assert.equal(catalogStatusLine(review), "Needs catalog review");
});

test("location confirmation is required and unknown does not unblock import", () => {
    const unknown = candidate({
        review_state: "needs_location",
        species_profile_id: barnOwlId,
        location_state: "unknown"
    });
    assert.equal(hasConfirmedLocation(unknown), false);
    assert.equal(isImportable(unknown), false);
    assert.equal(candidateBlocker(unknown), "needsLocation");
    assert.match(selectionBlocker([unknown])?.message ?? "", /confirmed capture location/);

    const confirmed = candidate({
        review_state: "ready",
        species_profile_id: barnOwlId,
        location_state: "confirmed",
        location_lat: -8.34,
        location_lng: 115.51
    });
    assert.equal(isImportable(confirmed), true);
    assert.equal(candidateBlocker(confirmed), null);
});

test("species confirmation precedes import", () => {
    const rows = [
        candidate({
            review_state: "needs_identity",
            location_state: "confirmed",
            location_lat: 1,
            location_lng: 2,
            proposed_index_match: {
                species_profile_id: barnOwlId,
                display_name: "Barn Owl",
                animaldex_number: 134
            }
        })
    ];
    assert.equal(primaryReviewAction(rows), "confirmSpecies");
    assert.equal(reviewHint("confirmSpecies", rows), "Location is set. Confirm the species next.");
    assert.equal(blockerTitle(candidateBlocker(rows[0])!), "Confirm species");
});

test("species choices keep the suggested match first and drop duplicates", () => {
    const altId = "33333333-3333-4333-8333-333333333333";
    const row = candidate({
        proposed_index_match: {species_profile_id: barnOwlId, display_name: "Barn Owl", animaldex_number: 134},
        identity_alternatives: [
            {species_profile_id: barnOwlId, display_name: "Barn Owl", animaldex_number: 134},
            {species_profile_id: altId, display_name: "Grass Owl", animaldex_number: 201}
        ]
    });
    const choices = speciesChoices(row);
    assert.equal(choices.length, 2);
    assert.equal(choices[0].display_name, "Barn Owl");
    assert.equal(choices[1].display_name, "Grass Owl");
});

test("review grid hides finished and no-animal posts", () => {
    const shown = reviewCandidates([
        candidate({review_state: "ready"}),
        candidate({review_state: "needs_identity"}),
        candidate({review_state: "approved"}),
        candidate({review_state: "no_animal"}),
        candidate({review_state: "skipped"}),
        candidate({review_state: "failed"})
    ]);
    assert.equal(shown.length, 2);
});

test("summary keeps partial success distinct from total failure", () => {
    assert.equal(summaryHeadline(3, 0), "3 animals added to your Dex");
    assert.equal(summaryHeadline(1, 0), "1 animal added to your Dex");
    assert.equal(summaryHeadline(2, 1), "2 added · 1 couldn't be imported");
    assert.equal(summaryHeadline(0, 2), "Nothing could be imported");
});

test("humanize maps backend codes and never leaks internals", () => {
    assert.equal(humanizeImportError("instagram_reauthorization_required"), "Instagram needs you to sign in again.");
    assert.equal(humanizeImportError("candidate_accuracy_attestation_required"), "Confirm these details are accurate before importing.");
    assert.equal(humanizeImportError("poster_unavailable"), "We couldn't get a cover image for this video.");
    assert.doesNotMatch(humanizeImportError("poster_unavailable"), /HMAC|token|secret/i);
    assert.match(humanizeImportError("invalid_thumbnail_screen_scope"), /could not continue|resume/i);
    assert.match(humanizeImportError("invalid_frame_target_scope"), /could not continue|resume/i);
    assert.doesNotMatch(humanizeImportError("invalid_thumbnail_screen_scope"), /importing this post/i);
    assert.equal(
        humanizeImportError("import_stage_busy"),
        "Checking your wildlife posts is taking a little longer because your archive is large."
    );
    assert.doesNotMatch(humanizeImportError("import_stage_busy"), /rate limited|queue|concurrency/i);
    assert.equal(humanizeImportError("insufficient_credits"), "You do not have enough Credits. Your selected posts are still here — buy Credits or Go Pro, then continue.");
    assert.doesNotMatch(humanizeImportError("insufficient_credits"), /\$|earnings|cash/i);
    assert.equal(humanizeImportError("entitlement_changed"), "Your Pro status changed. Refresh this import and try again.");
    assert.match(humanizeImportError("import_quote_price_changed"), /cost changed/i);
});

test("connection label and signed-out CTA preserve the import path", () => {
    assert.equal(connectionStatusLabel(null), "Not connected");
    assert.equal(connectionStatusLabel({
        connection_id: "c",
        provider: "instagram",
        status: "active",
        provider_username: "fieldherper"
    }), "Connected as @fieldherper");
    assert.equal(connectionStatusLabel({
        connection_id: "c",
        provider: "instagram",
        status: "reauthorization_required",
        provider_username: "fieldherper"
    }), "Reauthorization required");
    assert.equal(parseConnectQuery("cancelled"), "cancelled");
    assert.equal(
        pickInstagramConnection([
            {connection_id: "old", provider: "instagram", status: "reauthorization_required"},
            {connection_id: "live", provider: "instagram", status: "active", provider_username: "ok"}
        ])?.connection_id,
        "live"
    );
    assert.equal(
        instagramImportAccountHref(""),
        `/account?next=${encodeURIComponent(INSTAGRAM_IMPORT_PATH)}`
    );
    assert.equal(instagramImportAccountHref("", true), INSTAGRAM_IMPORT_PATH);
    assert.equal(
        instagramImportAccountHref("/id"),
        `/id/account?next=${encodeURIComponent(`/id${INSTAGRAM_IMPORT_PATH}`)}`
    );
    assert.equal(instagramImportAccountHref("/id", true), `/id${INSTAGRAM_IMPORT_PATH}`);
});

test("media proxy host allowlist rejects arbitrary URLs", () => {
    assert.equal(isAllowedInstagramMediaHost("scontent.cdninstagram.com"), true);
    assert.equal(isAllowedInstagramMediaHost("xx.fbcdn.net"), true);
    assert.equal(isAllowedInstagramMediaHost("evil.example"), false);
    assert.equal(isAllowedInstagramMediaHost("animaldex.app"), false);
});

test("isInstagramWebImportLive is only true for the string true", () => {
    assert.equal(isInstagramWebImportLive(undefined), false);
    assert.equal(isInstagramWebImportLive(""), false);
    assert.equal(isInstagramWebImportLive("false"), false);
    assert.equal(isInstagramWebImportLive("FALSE"), false);
    assert.equal(isInstagramWebImportLive("1"), false);
    assert.equal(isInstagramWebImportLive("yes"), false);
    assert.equal(isInstagramWebImportLive("true"), true);
    assert.equal(isInstagramWebImportLive(), process.env.NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE === "true");
});

test("web-first CTA label is curiosity-led", () => {
    assert.equal(instagramWebImportCtaLabel(false), "Check my Instagram");
    assert.equal(instagramWebImportCtaLabel(true), "Check my Instagram");
    assert.equal(archiveIntentHero(null).title, "How many animals have you already seen?");
    assert.match(archiveIntentHero("birder").title, /birds/i);
    assert.equal(archiveIntentHero("unknown").title, archiveIntentHero("casual").title);
});

test("signed-out /app destinations go through account; public use-case paths do not", () => {
    assert.equal(
        appDestinationHref("", INSTAGRAM_IMPORT_PATH),
        `/account?next=${encodeURIComponent(INSTAGRAM_IMPORT_PATH)}`
    );
    assert.equal(appDestinationHref("", INSTAGRAM_IMPORT_PATH, true), INSTAGRAM_IMPORT_PATH);
    assert.equal(appDestinationHref("", INSTAGRAM_IMPORT_USE_CASE_PATH), INSTAGRAM_IMPORT_USE_CASE_PATH);
    assert.equal(appDestinationHref("/id", INSTAGRAM_IMPORT_USE_CASE_PATH), `/id${INSTAGRAM_IMPORT_USE_CASE_PATH}`);
});

test("CTA extra events do not fire the same event twice", () => {
    assert.deepEqual(uniqueCtaEvents("instagram_import_cta", ["casual_archive_to_import"]), [
        "instagram_import_cta",
        "casual_archive_to_import"
    ]);
    assert.deepEqual(uniqueCtaEvents("instagram_import_cta", ["instagram_import_cta"]), [
        "instagram_import_cta"
    ]);
});

test("screening and materialization labels distinguish Pro, free allowance, and meter carry", () => {
    assert.equal(screeningCostLabel({
        operation_id: "o", quote_id: "q", billing_status: "quoted", total_posts_seen: 3,
        posts_requiring_processing: 3, credit_cost: 0, pro_included: true,
        pricing_explanation: "", balance: 0, sufficient_credits: true, zero_cost_reason: "pro"
    }), "Included with Pro");
    assert.equal(screeningCostLabel({
        operation_id: "o", quote_id: "q", billing_status: "quoted", total_posts_seen: 3,
        posts_requiring_processing: 3, credit_cost: 0, pro_included: false,
        pricing_explanation: "", balance: 4, sufficient_credits: true, zero_cost_reason: "lifetime_free"
    }), "On us");
    assert.equal(screeningCostLabel({
        operation_id: "o", quote_id: "q", billing_status: "quoted", total_posts_seen: 3,
        posts_requiring_processing: 3, credit_cost: 0, pro_included: false,
        pricing_explanation: "", balance: 4, sufficient_credits: true, zero_cost_reason: "meter_carry"
    }), "0 Credits");
    assert.equal(materializationCostLabel({
        quote_id: "q", photo_equivalent_count: 2, video_equivalent_count: 0,
        credit_cost: 2, pro_included: false, pricing_explanation: "", balance: 9, sufficient_credits: true
    }), "2 Credits");
    assert.equal(materializationCostLabel({
        quote_id: "q", photo_equivalent_count: 1, video_equivalent_count: 1,
        credit_cost: 0, pro_included: true, pricing_explanation: "", balance: 0, sufficient_credits: true
    }), "Included with Pro");
});
