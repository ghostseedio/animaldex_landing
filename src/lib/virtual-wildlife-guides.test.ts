import assert from "node:assert/strict";
import test from "node:test";
import {
    buildGuidePatch,
    formatGuidePrice,
    guideFormFrom,
    guideMonthRange,
    guidePath,
    guideValidationProblem,
    growingDetail,
    ownerGuideStatus,
    parseGuideRouteSegment,
    sanitizeGuidePatch,
    sanitizeSpeciesPatch,
    type GuideDetail
} from "./virtual-wildlife-guides";

const guide: GuideDetail = {
    id: "0b6f5c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e",
    slug: "ubud-monkey-forest",
    title: "Ubud Monkey Forest wildlife",
    summary: "Long-tailed macaques, monitor lizards and forest birds around Ubud.",
    overview: "A shaded ravine forest in central Bali with resident macaque troops and plenty of birds.",
    areaLabel: "Ubud, Bali",
    countryCode: "ID",
    currencyCode: "USD",
    amountMinor: 499,
    speciesCount: 5,
    rareSpeciesCount: 1,
    species: [],
    media: [],
    private: {contacts: [{name: "Wayan", role: "Driver"}], notes: "Go early."},
    owner: {status: "published", generationStatus: "ready", priceAuto: true, publiclyVisible: false}
};

test("routes are {slug}-{id} and parse back", () => {
    assert.equal(guidePath(guide), `/guides/ubud-monkey-forest-${guide.id}`);
    assert.equal(parseGuideRouteSegment(`ubud-monkey-forest-${guide.id}`)?.listingId, guide.id);
    assert.equal(parseGuideRouteSegment("ubud-monkey-forest"), null);
});

test("prices honour zero-decimal currencies", () => {
    assert.equal(formatGuidePrice(499, "USD", "en"), "$4.99");
    assert.match(formatGuidePrice(350000, "IDR", "id-ID"), /350\.000/);
});

test("month ranges read like the app", () => {
    assert.equal(guideMonthRange("2026-03", "2026-10"), "Mar – Oct 2026");
    assert.equal(guideMonthRange("2025-03", "2026-10"), "Mar 2025 – Oct 2026");
    assert.equal(guideMonthRange("2026-03", "2026-03"), "Mar 2026");
});

test("growing places say what is missing", () => {
    assert.equal(growingDetail({speciesCount: 2, speciesNeeded: 1}), "2 species · 1 more to make a guide");
    assert.equal(growingDetail({speciesCount: 4, speciesNeeded: 0}), "4 species · needs a public photo");
});

test("owner status follows the iOS order", () => {
    const mine = {publicEnabled: false, locationIsPublic: true};
    assert.equal(ownerGuideStatus({generationStatus: "pending", status: "published"}, mine).label, "Writing…");
    assert.equal(ownerGuideStatus({status: "paused", pausedBy: "author_off"}, mine).label, "Not shared");
    assert.equal(ownerGuideStatus({status: "paused", pausedBy: "moderation"}, mine).label, "Paused");
    assert.equal(ownerGuideStatus({status: "published", publiclyVisible: true}, mine).label, "Public");
    assert.equal(ownerGuideStatus({status: "published"}, mine).label, "Ready");
    assert.equal(ownerGuideStatus({status: "published"}, {publicEnabled: true, locationIsPublic: true}).label, "Not public");
});

test("the editor sends only what changed", () => {
    const form = guideFormFrom(guide);
    assert.deepEqual(buildGuidePatch(guide, form), {});
    assert.deepEqual(buildGuidePatch(guide, {...form, title: "  Ubud forest guide "}), {title: "Ubud forest guide"});
    assert.deepEqual(buildGuidePatch(guide, {...form, priceAuto: false, amountMinor: 999}), {amountMinor: 999});
    assert.deepEqual(buildGuidePatch(guide, {...form, isShared: false}), {visibility: "paused"});
    assert.deepEqual(
        buildGuidePatch(guide, {...form, contacts: [...form.contacts, {name: "Ketut", contact: " +62 812 "}]}),
        {contacts: [{name: "Wayan", role: "Driver"}, {name: "Ketut", contact: "+62 812"}], privateNotes: "Go early."}
    );
});

test("validation mirrors the server limits", () => {
    const form = guideFormFrom(guide);
    assert.equal(guideValidationProblem(form), null);
    assert.equal(guideValidationProblem({...form, title: "Ub"}), "The title needs 5 to 100 characters.");
    assert.equal(guideValidationProblem({...form, contacts: [{name: " "}]}), "Every contact needs a name.");
});

test("API patches are validated, and a species note can be cleared", () => {
    assert.deepEqual(sanitizeGuidePatch({amountMinor: 999}), {patch: {amountMinor: 999}});
    assert.ok("error" in sanitizeGuidePatch({amountMinor: 1000}));
    assert.ok("error" in sanitizeGuidePatch({contacts: [{role: "Ranger"}]}));
    assert.ok("error" in sanitizeGuidePatch({}));
    assert.deepEqual(sanitizeSpeciesPatch({note: null}), {patch: {note: null}});
    assert.deepEqual(sanitizeSpeciesPatch({note: "   "}), {patch: {note: null}});
    assert.deepEqual(sanitizeSpeciesPatch({hidden: true}), {patch: {hidden: true}});
    assert.ok("error" in sanitizeSpeciesPatch({note: "x".repeat(1001)}));
});
