import assert from "node:assert/strict";
import test from "node:test";
import {
    APPLE_DISCLAIMER,
    DISCOVERY_GEOGRAPHY_COPY,
    applyVenueConstraints,
    assertSafeAdminDto,
    authorshipLabel,
    canArchiveCampaign,
    canReviewCampaign,
    canSubmitCampaign,
    containsForbiddenAdminDtoKeys,
    currentRulesVersion,
    groupCampaignsByStatus,
    historicalRulesVersions,
    isArchivedShownAsLive,
    isUnsupportedRewardType,
    lifecycleButtons,
    parseAdminRpcError,
    publishBlockedReason,
    serializeCampaignUpsert,
    serializeGeoCountries,
    serializeVenueUpsert,
    toListItem
} from "./sponsored-challenges-admin";

const draft = {
    slug: "jakarta-test",
    title: "AnimalDex Jakarta Test Challenge",
    publicSummary: "Capture 3 unique AnimalDex entries in a short window.",
    description: "A controlled AnimalDex-authored test Challenge for unique indexed entries.",
    presenterName: null,
    sponsorOrganizationId: null,
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-09-08T00:00:00.000Z",
    timezoneIdentifier: "Asia/Jakarta",
    objectiveType: "unique_indexed_entries",
    targetCount: 3,
    officialRules: `Follow the posted rules.\n\n${APPLE_DISCLAIMER}`,
    rewardTerms: "Completing the Challenge grants a deterministic achievement only.",
    liveOnly: false,
    externalImportsAllowed: true,
    discoveryRadiusM: 25000,
    geoMode: "unrestricted",
    hasVenue: false
};

test("campaign list groups every lifecycle status and never treats archived as live", () => {
    const groups = groupCampaignsByStatus([
        {status: "draft"},
        {status: "submitted"},
        {status: "approved"},
        {status: "scheduled"},
        {status: "live"},
        {status: "completed"},
        {status: "rejected"},
        {status: "archived"}
    ]);
    assert.equal(groups.draft.length, 1);
    assert.equal(groups.live.length, 1);
    assert.equal(groups.archived.length, 1);
    assert.equal(isArchivedShownAsLive("archived"), true);
    assert.equal(groups.live.some((row) => row.status === "archived"), false);
});

test("draft serialization matches the deployed upsert RPC contract", () => {
    const payload = serializeCampaignUpsert(draft);
    assert.deepEqual(Object.keys(payload).sort(), [
        "p_description",
        "p_discovery_radius_m",
        "p_ends_at",
        "p_external_imports_allowed",
        "p_geo_mode",
        "p_id",
        "p_live_only",
        "p_minimum_capture_grade",
        "p_objective_type",
        "p_official_rules",
        "p_presenter_name",
        "p_public_summary",
        "p_required_setting_tag",
        "p_required_type_tag",
        "p_reward_terms",
        "p_slug",
        "p_sponsor_organization_id",
        "p_starts_at",
        "p_target_count",
        "p_timezone_identifier",
        "p_title"
    ]);
    assert.equal(payload.p_sponsor_organization_id, null);
    assert.equal(payload.p_objective_type, "unique_indexed_entries");
    assert.equal(payload.p_target_count, 3);
    assert.equal(authorshipLabel(payload.p_sponsor_organization_id, payload.p_presenter_name), "AnimalDex-authored");
});

test("venue editor uses validation radius separately from discovery radius", () => {
    const venue = serializeVenueUpsert("11111111-1111-4111-8111-111111111111", {
        displayName: "Taman Safari",
        latitude: -6.125,
        longitude: 106.833,
        validationRadiusM: 400,
        countryCode: "id"
    });
    assert.equal(venue.p_validation_radius_m, 400);
    assert.equal("p_discovery_radius_m" in venue, false);
    assert.equal(serializeCampaignUpsert({...draft, hasVenue: true, discoveryRadiusM: 25000}).p_discovery_radius_m, 25000);
});

test("venue configuration forces live-only and import exclusion", () => {
    const constrained = applyVenueConstraints({...draft, hasVenue: true});
    assert.equal(constrained.liveOnly, true);
    assert.equal(constrained.externalImportsAllowed, false);
    const payload = serializeCampaignUpsert({...draft, hasVenue: true});
    assert.equal(payload.p_live_only, true);
    assert.equal(payload.p_external_imports_allowed, false);
});

test("discovery country UI is explicitly non-authoritative", () => {
    assert.match(DISCOVERY_GEOGRAPHY_COPY, /discovery only/i);
    assert.equal(DISCOVERY_GEOGRAPHY_COPY.toLowerCase().includes("participant eligibility"), false);
    const geo = serializeGeoCountries("11111111-1111-4111-8111-111111111111", ["id", "SG", "xx1"]);
    assert.deepEqual(geo.p_country_codes, ["ID", "SG"]);
});

test("non-venue restricted campaigns surface authoritative_country_unavailable", () => {
    assert.equal(publishBlockedReason("allowlist", false), "authoritative_country_unavailable");
    assert.equal(publishBlockedReason("denylist", false), "authoritative_country_unavailable");
    assert.equal(publishBlockedReason("allowlist", true), null);
    assert.equal(publishBlockedReason("unrestricted", false), null);
    const parsed = parseAdminRpcError("ERROR: authoritative_country_unavailable");
    assert.equal(parsed.code, "authoritative_country_unavailable");
    assert.match(parsed.message, /trusted server-side country source/);
});

test("rules history keeps current and accepted versions distinguishable", () => {
    const versions = [
        {rulesVersion: 1, officialRules: "v1", rewardTerms: "t1", appleDisclaimer: APPLE_DISCLAIMER, createdAt: "2026-09-01T00:00:00Z"},
        {rulesVersion: 2, officialRules: "v2", rewardTerms: "t2", appleDisclaimer: APPLE_DISCLAIMER, createdAt: "2026-09-02T00:00:00Z"}
    ];
    assert.equal(currentRulesVersion(versions, 2)?.officialRules, "v2");
    assert.deepEqual(historicalRulesVersions(versions, 2).map((row) => row.rulesVersion), [1]);
    assert.notEqual(currentRulesVersion(versions, 2)?.officialRules, historicalRulesVersions(versions, 2)[0].officialRules);
});

test("unsupported rewards cannot be configured", () => {
    assert.equal(isUnsupportedRewardType("achievement"), false);
    ["credits", "cash", "voucher", "sweepstakes", "prize_pool", "random"].forEach((type) => {
        assert.equal(isUnsupportedRewardType(type), true);
    });
});

test("lifecycle buttons map only to privileged admin RPCs", () => {
    assert.equal(lifecycleButtons("draft").submit?.rpc, "admin_submit_sponsored_campaign");
    assert.equal(lifecycleButtons("submitted").approve?.rpc, "admin_review_sponsored_campaign");
    assert.equal(lifecycleButtons("submitted").approve?.action, "approve");
    assert.equal(lifecycleButtons("submitted").reject?.action, "reject");
    assert.equal(lifecycleButtons("live").archive?.rpc, "admin_archive_sponsored_campaign");
    assert.equal(canSubmitCampaign("live"), false);
    assert.equal(canReviewCampaign("live"), false);
    assert.equal(canArchiveCampaign("draft"), false);
    assert.equal(lifecycleButtons("archived").archive, null);
});

test("admin DTOs contain no participant PII, GPS evidence, or service-role secrets", () => {
    const item = toListItem({
        id: "11111111-1111-4111-8111-111111111111",
        title: "AnimalDex Jakarta Test Challenge",
        slug: "jakarta-test",
        presenter_name: null,
        sponsor_organization_id: null,
        status: "draft",
        starts_at: draft.startsAt,
        ends_at: draft.endsAt,
        timezone_identifier: "Asia/Jakarta",
        objective_type: "unique_indexed_entries",
        target_count: 3,
        venue_name: "Taman Safari",
        reward_title: "Jakarta Test",
        rules_version: 1,
        updated_at: draft.startsAt
    });
    assert.deepEqual(containsForbiddenAdminDtoKeys(item), []);
    assertSafeAdminDto(item);
    const leaked = {
        ...item,
        user_id: "should-not-appear",
        location_evidence_source: "device_gps",
        SUPABASE_SERVICE_ROLE_KEY: "secret"
    };
    assert.deepEqual(
        containsForbiddenAdminDtoKeys(leaked).sort(),
        ["SUPABASE_SERVICE_ROLE_KEY", "location_evidence_source", "user_id"]
    );
});

test("list rows never include venue GPS or qualified-capture identifiers", () => {
    const item = toListItem({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Test",
        slug: "test",
        presenter_name: null,
        sponsor_organization_id: null,
        status: "live",
        starts_at: draft.startsAt,
        ends_at: draft.endsAt,
        timezone_identifier: "UTC",
        objective_type: "eligible_capture_count",
        target_count: 1,
        venue_name: "Taman Safari",
        reward_title: "Badge",
        rules_version: 2,
        updated_at: draft.startsAt
    });
    const json = JSON.stringify(item);
    assert.equal(json.includes("latitude"), false);
    assert.equal(json.includes("longitude"), false);
    assert.equal(json.includes("capture_id"), false);
    assert.equal(item.venueName, "Taman Safari");
});
