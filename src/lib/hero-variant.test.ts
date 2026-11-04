import assert from "node:assert/strict";
import {describe, it} from "node:test";
import vm from "node:vm";
import {
    DEFAULT_HERO_SPLIT,
    firstTouchCookieValue,
    heroBootScript,
    heroVariantFromCookieValue,
    heroVariantFromQuery,
    heroVariantSplit,
    pickHeroVariant,
    resolveHeroAssignment,
    shownHeroVariant
} from "./hero-variant";
import {serializeFirstTouch} from "./first-touch";

/** Runs the inline script the way a browser would, against a stand-in page. */
function runBoot(script: string, page: {search: string; cookie: string; random: number}) {
    const attributes: Record<string, string> = {};
    const window: Record<string, unknown> = {};
    const math = Object.create(Math) as Math;
    math.random = () => page.random;
    vm.runInNewContext(script, {
        document: {documentElement: {setAttribute: (name: string, value: string) => (attributes[name] = value)}, cookie: page.cookie},
        location: {search: page.search},
        window,
        Math: math
    });
    // The script's object belongs to the other realm; its JSON is what compares.
    const boot = window.__adxHero === undefined ? undefined : JSON.parse(JSON.stringify(window.__adxHero)) as {variant: string; assigned: boolean; override: string | null};
    return {attributes, boot};
}

const touch = (extra: Record<string, unknown> = {}) => `adx_ft=${serializeFirstTouch({landing_path: "/", at: "2026-11-04T00:00:00.000Z", ...extra})}`;

describe("hero variant", () => {
    it("splits 50/50 unless HERO_VARIANT_SPLIT says otherwise, clamped to 0-100", () => {
        assert.equal(heroVariantSplit(undefined), DEFAULT_HERO_SPLIT);
        assert.equal(heroVariantSplit(""), 50);
        assert.equal(heroVariantSplit("0"), 0);
        assert.equal(heroVariantSplit("100"), 100);
        assert.equal(heroVariantSplit(" 25 "), 25);
        assert.equal(heroVariantSplit("101"), 50);
        assert.equal(heroVariantSplit("-5"), 50);
        assert.equal(heroVariantSplit("half"), 50);
        assert.equal(pickHeroVariant(50, 0.49), "b");
        assert.equal(pickHeroVariant(50, 0.5), "a");
        assert.equal(pickHeroVariant(0, 0), "a", "a split of 0 never draws B");
        assert.equal(pickHeroVariant(100, 0.999), "b", "a split of 100 always draws B");
    });

    it("reads the QA override and a kept variant, and ignores junk", () => {
        assert.equal(heroVariantFromQuery("?hero=b"), "b");
        assert.equal(heroVariantFromQuery("?utm_source=tiktok&hero=a"), "a");
        assert.equal(heroVariantFromQuery("?hero=c"), null);
        assert.equal(heroVariantFromQuery("?superhero=b"), null);
        assert.equal(heroVariantFromCookieValue(firstTouchCookieValue(touch({hero: "b"}))), "b");
        assert.equal(heroVariantFromCookieValue(firstTouchCookieValue(`other=1; ${touch({hero: "a"})}`)), "a");
        assert.equal(heroVariantFromCookieValue(firstTouchCookieValue(touch())), null);
        assert.equal(heroVariantFromCookieValue("not%20json"), null);
        assert.equal(firstTouchCookieValue("x_adx_ft=1"), null);
    });

    it("keeps a visitor's variant, draws one for a new visitor, and shows the override without keeping it", () => {
        assert.deepEqual(resolveHeroAssignment({search: "", cookie: touch({hero: "a"}), splitB: 100, random: 0}), {variant: "a", assigned: false, override: null});
        assert.deepEqual(resolveHeroAssignment({search: "", cookie: touch(), splitB: 50, random: 0.1}), {variant: "b", assigned: true, override: null});
        assert.deepEqual(resolveHeroAssignment({search: "", cookie: "", splitB: 50, random: 0.9}), {variant: "a", assigned: true, override: null});
        const qa = resolveHeroAssignment({search: "?hero=b", cookie: touch({hero: "a"}), splitB: 50, random: 0});
        assert.equal(shownHeroVariant(qa), "b");
        assert.equal(qa.variant, "a", "the visitor's own variant stays theirs");
    });

    it("the inline boot script follows the same rule and marks <html> before paint", () => {
        const cases = [
            {search: "", cookie: touch({hero: "b"}), random: 0.99},
            {search: "", cookie: touch(), random: 0.2},
            {search: "", cookie: "", random: 0.8},
            {search: "?hero=a", cookie: touch({hero: "b"}), random: 0.5},
            {search: "", cookie: "adx_ft=%7Bbroken", random: 0.1}
        ];
        for (const page of cases) {
            const {attributes, boot} = runBoot(heroBootScript(50), page);
            const expected = resolveHeroAssignment({search: page.search, cookie: page.cookie, splitB: 50, random: page.random});
            assert.deepEqual(boot, expected, JSON.stringify(page));
            assert.equal(attributes["data-hero"], shownHeroVariant(expected));
        }
        // The split is baked in at render time, clamped.
        assert.equal(runBoot(heroBootScript(0), {search: "", cookie: "", random: 0}).attributes["data-hero"], "a");
        assert.equal(runBoot(heroBootScript(400), {search: "", cookie: "", random: 0.99}).attributes["data-hero"], "b");
        // It never writes a cookie: the first-touch record is the client half's to write.
        assert.doesNotMatch(heroBootScript(50), /document\.cookie\s*=/);
    });
});
