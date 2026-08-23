import assert from "node:assert/strict";
import test from "node:test";
import {
    CAMPAIGN_TEMPLATES,
    CONTINUOUS_AUTO_FIELDS,
    applyTemplateDefaults,
    blankDraft,
    currentGeneratedCopy,
    emptyFieldOrigins,
    generateBuilderCopy,
    generateDescription,
    generateOfficialRules,
    generatePresenterName,
    generatePublicSummary,
    generateRewardTerms,
    isFormSubstantiallyModified,
    isValidCampaignSlug,
    isValidDateRange,
    markManual,
    nextAutoValues,
    nextSensibleStart,
    slugifyTitle,
    templateDurationDays,
    timezoneFromVenueCountry,
    toDatetimeLocalValue,
    addDurationDays,
    type BuilderSource
} from "./sponsored-challenge-builder";
import {
    cardAuthorship,
    cardObjectiveLine,
    formatPreviewDateRange,
    previewCampaignKeys,
    previewProgress,
    previewShowsUnsupportedReward,
    qualificationBullets,
    rewardLabel,
    simulatedJoinedProgress,
    toPreviewCampaign
} from "./sponsored-challenge-preview";
import {evaluateReadiness} from "./sponsored-challenge-readiness";
import {
    APPLE_DISCLAIMER,
    FORBIDDEN_ADMIN_DTO_KEYS,
    backendSettingMatches,
    backendTypeTagMatches,
    containsForbiddenAdminDtoKeys,
    serializeCampaignUpsert,
    settingTagDisplayLabel,
    typeTagDisplayLabel,
    type CampaignDraftInput
} from "./sponsored-challenges-admin";

const now = new Date("2026-08-23T10:20:00");

function source(overrides: Partial<BuilderSource> = {}): BuilderSource {
    const draft = overrides.draft ?? applyTemplateDefaults("venue_collector", blankDraft(now), now);
    return {
        templateId: "venue_collector",
        draft,
        venueName: "",
        venueCountry: "",
        sponsorDisplayName: null,
        achievementSlug: "",
        achievementTitle: "",
        achievementDetail: "",
        now,
        ...overrides
    };
}

function readyDraft(): CampaignDraftInput {
    return {
        ...applyTemplateDefaults("venue_collector", blankDraft(now), now),
        title: "BXSea Ocean Collector",
        slug: "bxsea-ocean-collector",
        publicSummary: "Capture 15 different qualifying AnimalDex entries at BXSea.",
        description: "Explore BXSea and build your AnimalDex collection by capturing 15 different qualifying entries during the Challenge period.",
        presenterName: "BXSea",
        sponsorOrganizationId: "org-1",
        officialRules: `Rules\n\n${APPLE_DISCLAIMER}`,
        rewardTerms: generateRewardTerms("BXSea Ocean Collector"),
        timezoneIdentifier: "Asia/Jakarta",
        hasVenue: true
    };
}

test("templates persist canonical backend tags, not display-only casing", () => {
    const venue = applyTemplateDefaults("venue_collector", blankDraft(now), now);
    const bird = applyTemplateDefaults("bird_challenge", blankDraft(now), now);
    const venuePayload = serializeCampaignUpsert({...venue, slug: "venue", title: "Venue", publicSummary: "s", description: "d", officialRules: APPLE_DISCLAIMER, rewardTerms: "r"});
    const birdPayload = serializeCampaignUpsert({...bird, slug: "bird", title: "Bird", publicSummary: "s", description: "d", officialRules: APPLE_DISCLAIMER, rewardTerms: "r"});
    assert.equal(venue.requiredSettingTag, "Zoo");
    assert.equal(bird.requiredTypeTag, "Bird");
    assert.equal(venuePayload.p_required_setting_tag, "Zoo");
    assert.equal(birdPayload.p_required_type_tag, "Bird");
    assert.equal(backendSettingMatches("Zoo", venuePayload.p_required_setting_tag!), true);
    assert.equal(backendTypeTagMatches("Bird", birdPayload.p_required_type_tag!), true);
    assert.equal(settingTagDisplayLabel(venue.requiredSettingTag), "Zoo");
    assert.equal(typeTagDisplayLabel(bird.requiredTypeTag), "Bird");
});

test("Venue Collector defaults stay on supported backend fields", () => {
    const defaults = CAMPAIGN_TEMPLATES.venue_collector.defaults;
    const draft = applyTemplateDefaults("venue_collector", blankDraft(now), now);
    assert.equal(defaults.objectiveType, "unique_indexed_entries");
    assert.equal(defaults.targetCount, 15);
    assert.equal(defaults.liveOnly, true);
    assert.equal(defaults.externalImportsAllowed, false);
    assert.equal(defaults.requiredSettingTag, "Zoo");
    assert.equal(defaults.requiredTypeTag, "");
    assert.equal(defaults.minimumCaptureGrade, null);
    assert.equal(templateDurationDays("venue_collector"), 30);
    assert.equal(draft.hasVenue, false);
    assert.equal(draft.objectiveType, "unique_indexed_entries");
    assert.equal(draft.targetCount, 15);
});

test("Bird Challenge defaults", () => {
    const draft = applyTemplateDefaults("bird_challenge", blankDraft(now), now);
    assert.equal(draft.objectiveType, "unique_indexed_entries");
    assert.equal(draft.targetCount, 20);
    assert.equal(draft.requiredTypeTag, "Bird");
    assert.equal(draft.requiredSettingTag, "");
    assert.equal(draft.liveOnly, true);
    assert.equal(draft.externalImportsAllowed, false);
    assert.equal(draft.minimumCaptureGrade, null);
    assert.equal(templateDurationDays("bird_challenge"), 30);
});

test("Photography Quality defaults", () => {
    const draft = applyTemplateDefaults("photography_quality", blankDraft(now), now);
    assert.equal(draft.objectiveType, "eligible_capture_count");
    assert.equal(draft.targetCount, 5);
    assert.equal(draft.minimumCaptureGrade, 8);
    assert.equal(draft.liveOnly, true);
    assert.equal(draft.externalImportsAllowed, false);
    assert.equal(templateDurationDays("photography_quality"), 30);
});

test("Activity Streak defaults", () => {
    const draft = applyTemplateDefaults("activity_streak", blankDraft(now), now);
    assert.equal(draft.objectiveType, "active_capture_days");
    assert.equal(draft.targetCount, 5);
    assert.equal(draft.liveOnly, true);
    assert.equal(draft.externalImportsAllowed, false);
    assert.equal(draft.minimumCaptureGrade, null);
    assert.equal(templateDurationDays("activity_streak"), 14);
});

test("Blank defaults are minimal and safe", () => {
    const draft = blankDraft(now);
    assert.equal(draft.objectiveType, "unique_indexed_entries");
    assert.equal(draft.targetCount, 1);
    assert.equal(draft.liveOnly, true);
    assert.equal(draft.externalImportsAllowed, false);
    assert.equal(draft.requiredTypeTag, "");
    assert.equal(draft.requiredSettingTag, "");
    assert.equal(draft.minimumCaptureGrade, null);
    assert.equal(draft.geoMode, "unrestricted");
    assert.equal(draft.hasVenue, false);
    assert.equal(templateDurationDays("blank"), 7);
    assert.equal(isValidDateRange(draft.startsAt, draft.endsAt), true);
});

test("slug is generated from title and stays put after a manual edit", () => {
    assert.equal(slugifyTitle("BXSea Ocean Collector 2026"), "bxsea-ocean-collector-2026");
    assert.equal(slugifyTitle("  Hello---World!!  "), "hello-world");
    assert.equal(isValidCampaignSlug("bxsea-ocean-collector-2026"), true);
    assert.equal(isValidCampaignSlug("-leading"), false);
    const draft = {...applyTemplateDefaults("blank", blankDraft(now), now), title: "BXSea Ocean Collector 2026"};
    const titleManual = markManual(emptyFieldOrigins("auto"), "title");
    const generated = generateBuilderCopy(source({
        templateId: "blank",
        draft,
        sponsorDisplayName: "BXSea"
    }), titleManual);
    assert.equal(generated.slug, "bxsea-ocean-collector-2026");
    const origins = markManual(titleManual, "slug");
    const current = currentGeneratedCopy(source({
        draft: {...draft, slug: "custom-slug", title: "BXSea Ocean Collector 2026"}
    }));
    const next = nextAutoValues(current, generated, origins);
    assert.equal((next ?? current).slug, "custom-slug");
});

test("sponsored presenter autofill uses the organization display name", () => {
    assert.equal(generatePresenterName("org-1", "BXSea"), "BXSea");
    const generated = generateBuilderCopy(source({
        draft: {...applyTemplateDefaults("venue_collector", blankDraft(now), now), sponsorOrganizationId: "org-1"},
        sponsorDisplayName: "BXSea"
    }));
    assert.equal(generated.presenterName, "BXSea");
});

test("AnimalDex-authored presenter autofill does not invent a sponsor", () => {
    assert.equal(generatePresenterName(null, null), "AnimalDex");
    const generated = generateBuilderCopy(source({
        draft: {...applyTemplateDefaults("bird_challenge", blankDraft(now), now), sponsorOrganizationId: null},
        sponsorDisplayName: null
    }));
    assert.equal(generated.presenterName, "AnimalDex");
    assert.equal(generated.presenterName.toLowerCase().includes("sponsored"), false);
});

test("summary generation stays plain and factual", () => {
    const venue = source({
        venueName: "BXSea",
        sponsorDisplayName: "BXSea",
        draft: applyTemplateDefaults("venue_collector", blankDraft(now), now)
    });
    assert.equal(generatePublicSummary(venue), "Capture 15 different qualifying AnimalDex entries at BXSea.");
    const bird = source({
        templateId: "bird_challenge",
        draft: applyTemplateDefaults("bird_challenge", blankDraft(now), now)
    });
    assert.equal(generatePublicSummary(bird), "Capture 20 different qualifying bird entries during the Challenge.");
    const grade = source({
        templateId: "photography_quality",
        draft: applyTemplateDefaults("photography_quality", blankDraft(now), now)
    });
    assert.equal(generatePublicSummary(grade), "Complete 5 qualifying captures graded 8 or higher.");
    const days = source({
        templateId: "activity_streak",
        draft: applyTemplateDefaults("activity_streak", blankDraft(now), now)
    });
    assert.equal(generatePublicSummary(days), "Make qualifying AnimalDex captures on 5 different days.");
});

test("description generation stays concise", () => {
    const withVenue = source({
        venueName: "BXSea",
        draft: applyTemplateDefaults("venue_collector", blankDraft(now), now)
    });
    assert.equal(
        generateDescription(withVenue),
        "Explore BXSea and build your AnimalDex collection by capturing 15 different qualifying entries during the Challenge period."
    );
    const bird = source({
        templateId: "bird_challenge",
        draft: applyTemplateDefaults("bird_challenge", blankDraft(now), now)
    });
    assert.equal(
        generateDescription(bird),
        "Build your AnimalDex collection during this time-limited Challenge by completing 20 different qualifying bird entries."
    );
});

test("official rules reflect configured backend fields only", () => {
    const rules = generateOfficialRules(source({
        venueName: "BXSea",
        draft: {
            ...applyTemplateDefaults("venue_collector", blankDraft(now), now),
            hasVenue: true,
            minimumCaptureGrade: null
        }
    }));
    assert.match(rules, /collect 15 different qualifying indexed AnimalDex entries/);
    assert.match(rules, /belong to the participating AnimalDex account/);
    assert.match(rules, /published Challenge window/);
    assert.match(rules, /live AnimalDex captures/);
    assert.match(rules, /configured BXSea venue using trusted device-location evidence/);
    assert.match(rules, /satisfy the Zoo setting requirement/);
    assert.match(rules, /indexed AnimalDex entry/);
    assert.match(rules, /Each indexed AnimalDex entry counts once/);
    assert.match(rules, /Imported or external captures do not qualify/);
    assert.match(rules, new RegExp(APPLE_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(rules.toLowerCase().includes("graded"), false);
    assert.equal(rules.toLowerCase().includes("bird"), false);
    assert.equal(rules.toLowerCase().includes("guaranteed"), false);
    assert.equal(rules.toLowerCase().includes("voucher"), false);
});

test("grade and type constraints appear in rules only when configured", () => {
    const bird = generateOfficialRules(source({
        templateId: "bird_challenge",
        draft: applyTemplateDefaults("bird_challenge", blankDraft(now), now)
    }));
    assert.match(bird, /indexed AnimalDex Bird entry/);
    assert.equal(bird.includes("venue"), false);
    assert.equal(bird.toLowerCase().includes("graded"), false);
    const grade = generateOfficialRules(source({
        templateId: "photography_quality",
        draft: applyTemplateDefaults("photography_quality", blankDraft(now), now)
    }));
    assert.match(grade, /be graded 8 or higher/);
    assert.equal(grade.includes("Each indexed AnimalDex entry counts once"), false);
});

test("imports language follows the configured backend flag", () => {
    const blocked = generateOfficialRules(source({
        draft: {...applyTemplateDefaults("blank", blankDraft(now), now), externalImportsAllowed: false, hasVenue: false}
    }));
    assert.match(blocked, /Imported or external captures do not qualify/);
    const allowed = generateOfficialRules(source({
        templateId: "blank",
        draft: {...applyTemplateDefaults("blank", blankDraft(now), now), externalImportsAllowed: true, liveOnly: false, hasVenue: false}
    }));
    assert.match(allowed, /External or imported captures may qualify/);
    assert.equal(allowed.includes("Imported or external captures do not qualify"), false);
});

test("reward terms use the achievement title and stay Phase 1 only", () => {
    const terms = generateRewardTerms("BXSea Ocean Collector");
    assert.match(terms, /“BXSea Ocean Collector” AnimalDex achievement/);
    assert.match(terms, /deterministic/);
    assert.match(terms, /No cash, Credits, sweepstakes, random drawing, or prize of chance/);
    assert.equal(terms.toLowerCase().includes("voucher"), false);
});

test("manual fields are not rewritten when source fields change", () => {
    const origins = markManual(emptyFieldOrigins("auto"), "publicSummary");
    assert.equal(isFormSubstantiallyModified(origins), true);
    assert.equal(isFormSubstantiallyModified(emptyFieldOrigins("auto")), false);
    const current = currentGeneratedCopy(source({
        draft: {...applyTemplateDefaults("venue_collector", blankDraft(now), now), publicSummary: "Operator written summary."}
    }));
    const generated = generateBuilderCopy(source({venueName: "BXSea"}));
    const next = nextAutoValues(current, generated, origins);
    assert.equal((next ?? current).publicSummary, "Operator written summary.");
    assert.equal(CONTINUOUS_AUTO_FIELDS.includes("startsAt"), false);
});

test("date defaults follow template duration and validate end after start", () => {
    const start = nextSensibleStart(now);
    assert.equal(start, toDatetimeLocalValue(new Date("2026-08-23T11:00:00")));
    const venueEnd = addDurationDays(start, 30);
    const streakEnd = addDurationDays(start, 14);
    const blankEnd = addDurationDays(start, 7);
    assert.equal(isValidDateRange(start, venueEnd), true);
    assert.equal(isValidDateRange(venueEnd, start), false);
    assert.ok(new Date(streakEnd).getTime() < new Date(venueEnd).getTime());
    assert.ok(new Date(blankEnd).getTime() < new Date(streakEnd).getTime());
    const draft = applyTemplateDefaults("activity_streak", blankDraft(now), now);
    assert.equal(draft.startsAt, start);
    assert.equal(draft.endsAt, streakEnd);
});

test("timezone is inferred only from an explicit unambiguous country", () => {
    assert.equal(timezoneFromVenueCountry("SG"), "Asia/Singapore");
    assert.equal(timezoneFromVenueCountry("id"), "Asia/Jakarta");
    assert.equal(timezoneFromVenueCountry("US"), null);
    assert.equal(timezoneFromVenueCountry(""), null);
});

test("sponsored card disclosure and AnimalDex-authored card stay distinct", () => {
    const sponsored = toPreviewCampaign({
        title: "BXSea Ocean Collector",
        publicSummary: "Capture 15 different qualifying AnimalDex entries at BXSea.",
        description: "Explore BXSea.",
        presenterName: "BXSea",
        sponsorOrganizationId: "org-1",
        sponsorDisplayName: "BXSea",
        startsAt: "2026-09-01T00:00",
        endsAt: "2026-09-30T00:00",
        timezoneIdentifier: "Asia/Jakarta",
        objectiveType: "unique_indexed_entries",
        targetCount: 15,
        liveOnly: true,
        externalImportsAllowed: false,
        venueName: "BXSea",
        rewardTitle: "BXSea Ocean Collector",
        officialRules: APPLE_DISCLAIMER
    });
    const sponsoredCard = cardAuthorship(sponsored);
    assert.equal(sponsoredCard.showSponsored, true);
    assert.equal(sponsoredCard.presentedBy, "BXSea");
    assert.equal(cardObjectiveLine(sponsored), "Capture 15 different AnimalDex entries");
    assert.equal(formatPreviewDateRange(sponsored.startsAt, sponsored.endsAt), "Sep 1 – Sep 30");
    assert.equal(rewardLabel(sponsored.rewardTitle), "BXSea Ocean Collector achievement");
    assert.ok(qualificationBullets(sponsored).includes("Must be recorded at BXSea"));
    assert.ok(qualificationBullets(sponsored).includes("Each indexed AnimalDex entry counts once"));
    assert.ok(qualificationBullets(sponsored).includes("Imported captures do not qualify"));
    const tagged = toPreviewCampaign({
        ...sponsored,
        requiredTypeTag: "bird",
        requiredSettingTag: "zoo"
    });
    assert.equal(cardObjectiveLine(tagged), "Capture 15 different Bird entries");
    assert.ok(qualificationBullets(tagged).includes("Must qualify as Bird"));
    assert.ok(qualificationBullets(tagged).includes("Must satisfy the Zoo setting"));

    const firstParty = toPreviewCampaign({
        ...sponsored,
        sponsorOrganizationId: null,
        sponsorDisplayName: null,
        presenterName: "AnimalDex"
    });
    const authored = cardAuthorship(firstParty);
    assert.equal(authored.showSponsored, false);
    assert.equal(authored.presentedBy, null);
    assert.equal(authored.authorLabel, "AnimalDex");
});

test("joined preview stays incomplete for every supported target", () => {
    assert.equal(simulatedJoinedProgress(1), 0);
    assert.equal(simulatedJoinedProgress(2), 1);
    assert.equal(simulatedJoinedProgress(3), 2);
    assert.equal(simulatedJoinedProgress(15), 3);
    for (const target of [1, 2, 3, 15]) {
        const joined = previewProgress(target, "joined");
        const completed = previewProgress(target, "completed");
        assert.ok(joined.current < joined.target);
        assert.notEqual(joined.current, joined.target);
        assert.deepEqual(completed, {current: target, target});
    }
});

test("preview does not display unsupported reward types", () => {
    const label = rewardLabel("BXSea Ocean Collector");
    assert.equal(previewShowsUnsupportedReward(label), false);
    assert.equal(label.toLowerCase().includes("credit"), false);
    assert.equal(label.toLowerCase().includes("cash"), false);
    assert.equal(label.toLowerCase().includes("voucher"), false);
    assert.equal(label.toLowerCase().includes("sweepstake"), false);
});

test("missing venue blocks venue-ready state", () => {
    const result = evaluateReadiness({
        draft: readyDraft(),
        templateId: "venue_collector",
        venueName: "",
        venueLat: "",
        venueLng: "",
        venueRadius: "400",
        achievementSlug: "bxsea-ocean-collector",
        achievementTitle: "BXSea Ocean Collector",
        achievementDetail: "Complete the BXSea Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: []
    });
    assert.equal(result.ready, false);
    assert.ok(result.blocking.some((check) => check.id === "venue_name"));
    assert.match(result.fieldWarnings.venue ?? "", /no venue saved/);
});

test("invalid date range blocks readiness", () => {
    const result = evaluateReadiness({
        draft: {...readyDraft(), startsAt: "2026-09-30T00:00", endsAt: "2026-09-01T00:00"},
        templateId: "venue_collector",
        venueName: "BXSea",
        venueLat: "-6.1",
        venueLng: "106.8",
        venueRadius: "400",
        achievementSlug: "bxsea-ocean-collector",
        achievementTitle: "BXSea Ocean Collector",
        achievementDetail: "Complete the BXSea Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: []
    });
    assert.ok(result.blocking.some((check) => check.id === "dates"));
    assert.match(result.fieldWarnings.dates ?? "", /ends before it starts/);
});

test("missing reward blocks readiness", () => {
    const result = evaluateReadiness({
        draft: readyDraft(),
        templateId: "venue_collector",
        venueName: "BXSea",
        venueLat: "-6.1",
        venueLng: "106.8",
        venueRadius: "400",
        achievementSlug: "",
        achievementTitle: "",
        achievementDetail: "",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: []
    });
    assert.ok(result.blocking.some((check) => check.id === "achievement"));
    assert.match(result.fieldWarnings.reward ?? "", /No achievement reward configured/);
});

test("non-venue geo restriction blocks readiness", () => {
    const result = evaluateReadiness({
        draft: {...readyDraft(), hasVenue: false, geoMode: "allowlist", sponsorOrganizationId: null, presenterName: "AnimalDex"},
        templateId: "bird_challenge",
        venueName: "",
        venueLat: "",
        venueLng: "",
        venueRadius: "400",
        achievementSlug: "bird-challenge",
        achievementTitle: "Bird Challenge",
        achievementDetail: "Complete the bird Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: ["ID"]
    });
    assert.ok(result.blocking.some((check) => check.id === "geo_authority"));
    assert.match(result.fieldWarnings.geo ?? "", /cannot be enforced/);
});

test("sponsored campaign without sponsor presenter blocks readiness", () => {
    const result = evaluateReadiness({
        draft: {...readyDraft(), presenterName: ""},
        templateId: "venue_collector",
        venueName: "BXSea",
        venueLat: "-6.1",
        venueLng: "106.8",
        venueRadius: "400",
        achievementSlug: "bxsea-ocean-collector",
        achievementTitle: "BXSea Ocean Collector",
        achievementDetail: "Complete the BXSea Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: []
    });
    assert.ok(result.blocking.some((check) => check.id === "presenter"));
});

test("venue country targeting is a discovery-only warning", () => {
    const result = evaluateReadiness({
        draft: {...readyDraft(), geoMode: "allowlist"},
        templateId: "venue_collector",
        venueName: "BXSea",
        venueLat: "-6.1",
        venueLng: "106.8",
        venueRadius: "400",
        achievementSlug: "bxsea-ocean-collector",
        achievementTitle: "BXSea Ocean Collector",
        achievementDetail: "Complete the BXSea Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: ["ID"]
    });
    assert.equal(result.blocking.some((check) => check.id === "geo_authority"), false);
    assert.ok(result.warnings.some((check) => check.id === "geo_discovery"));
    assert.match(result.fieldWarnings.geo ?? "", /discovery-only/);
});

test("a complete valid campaign reaches ready state", () => {
    const result = evaluateReadiness({
        draft: readyDraft(),
        templateId: "venue_collector",
        venueName: "BXSea",
        venueLat: "-6.1",
        venueLng: "106.8",
        venueRadius: "400",
        achievementSlug: "bxsea-ocean-collector",
        achievementTitle: "BXSea Ocean Collector",
        achievementDetail: "Complete the BXSea Challenge.",
        hasPersistedDraft: true,
        persistedRulesVersion: 1,
        hasHistoricalRules: false,
        discoveryCountries: []
    });
    assert.equal(result.ready, true);
    assert.equal(result.blocking.length, 0);
    assert.equal(result.passed, result.total);
});

test("preview props contain no service-role key or participant PII model", () => {
    const preview = toPreviewCampaign({
        title: "BXSea Ocean Collector",
        publicSummary: "Capture 15 different qualifying AnimalDex entries at BXSea.",
        description: "Explore BXSea.",
        presenterName: "BXSea",
        sponsorOrganizationId: "org-1",
        sponsorDisplayName: "BXSea",
        startsAt: "2026-09-01T00:00",
        endsAt: "2026-09-30T00:00",
        timezoneIdentifier: "Asia/Jakarta",
        objectiveType: "unique_indexed_entries",
        targetCount: 15,
        liveOnly: true,
        externalImportsAllowed: false,
        venueName: "BXSea",
        rewardTitle: "BXSea Ocean Collector",
        officialRules: APPLE_DISCLAIMER
    });
    assert.deepEqual(containsForbiddenAdminDtoKeys(preview), []);
    const json = JSON.stringify(preview);
    assert.equal(json.includes("service_role"), false);
    assert.equal(json.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    for (const key of FORBIDDEN_ADMIN_DTO_KEYS) {
        assert.equal(Object.prototype.hasOwnProperty.call(preview, key), false);
    }
    assert.deepEqual([...previewCampaignKeys()].sort(), Object.keys(preview).sort());
    assert.equal("user_id" in preview, false);
    assert.equal("email" in preview, false);
    assert.equal("capture_id" in preview, false);
    assert.equal("participant_id" in preview, false);
    assert.equal("latitude" in preview, false);
    assert.equal("longitude" in preview, false);
});
