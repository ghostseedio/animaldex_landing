import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    ADVICE_FATIGUE_HREF,
    AI_AND_SAFETY_HREF,
    ANIMAL_FREQUENCIES_HREF,
    animalWisdomLinks,
    blogNavLink,
    ANIMAL_TRIALS_HREF,
    ARK_HREF,
    EARN_ON_ANIMALDEX_HREF,
    exploreAnimalLinks,
    FIND_YOUR_ANIMALS_HREF,
    footerColumns,
    footerLegalLinks,
    headerNavLinks,
    HOW_IT_WORKS_HREF,
    howItWorksNavLink,
    INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
    LOCATIONS_HREF,
    PINNED_DRAWER_HREFS,
    productLinks,
    resourceLinks,
    START_COLLECTION_HREF,
    TALK_HREF,
    WILDLIFE_GUIDES_HREF
} from "@/data/public-navigation";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("public navigation keeps existing SEO routes", () => {
    // Talking first (2026-10-31): the Talk page, how the animals work, the article, then the app.
    assert.deepEqual(productLinks.map((link) => link.href), [
        TALK_HREF,
        HOW_IT_WORKS_HREF,
        ADVICE_FATIGUE_HREF,
        "/use-cases",
        START_COLLECTION_HREF,
        INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
        EARN_ON_ANIMALDEX_HREF
    ]);
    assert.deepEqual(exploreAnimalLinks.map((link) => link.href), [
        "/animals",
        "/comparisons",
        "/tier-list",
        "/animal-hybrids",
        LOCATIONS_HREF,
        WILDLIFE_GUIDES_HREF
    ]);
    // /talk-to-animals (a search landing for /talk) no longer sits beside the real Talk page (WEB-33).
    assert.deepEqual(animalWisdomLinks.map((link) => link.href), [
        "/animal-wisdom",
        "/animal-powers",
        "/qualities",
        ANIMAL_FREQUENCIES_HREF,
        ANIMAL_TRIALS_HREF,
        "/what-animal-am-i"
    ]);
    assert.deepEqual(resourceLinks.map((link) => link.href), [
        "/blog",
        "/animal-symbolism",
        "/support",
        "/contact",
        "/sponsor-a-challenge",
        "/branding"
    ]);
    assert.equal(START_COLLECTION_HREF, "/#download");
    assert.equal(TALK_HREF, "/talk");
    assert.equal(HOW_IT_WORKS_HREF, "/how-it-works");
    assert.equal(ADVICE_FATIGUE_HREF, "/advice-fatigue");
    assert.equal(INSTAGRAM_WILDLIFE_ARCHIVE_HREF, "/use-cases/import-instagram-wildlife-photos");

    // Retired from public navigation by an explicit product decision: Creator
    // Rewards is reachable by URL and in-page links only. The in-person pages
    // (/become-a-wildlife-guide, /wildlife-experiences) were removed and now
    // redirect to /wildlife-guides, which returned to Explore Animals in Oct 2026
    // once guides became virtual.
    const everyNavHref = [
        ...productLinks, ...exploreAnimalLinks, ...animalWisdomLinks, ...resourceLinks,
        ...headerNavLinks, ...footerColumns.flatMap((column) => column.links ?? []), ...footerLegalLinks
    ].map((link) => link.href);
    for (const retired of ["/become-a-wildlife-guide", "/wildlife-experiences", "/creator-rewards"]) {
        assert.ok(!everyNavHref.includes(retired), `${retired} should not be in public navigation`);
    }
});

test("the header's primary action is Talk to an animal, with Get the app beside it (spec §4.5)", () => {
    const header = readRepo("src/app/[locale]/(composited)/_components/header.tsx");
    assert.match(header, /ctaHref=\{TALK_HREF\}/);
    assert.match(header, /t\("talkToAnAnimal"\)/);
    assert.match(header, /secondaryCtaHref=\{START_COLLECTION_HREF\}/);
    // Desktop: the get-the-app outline comes before the lime Talk button.
    const getApp = header.indexOf("{getAppLabel}");
    const talk = header.indexOf("<HeaderTalkLink");
    assert.ok(getApp > -1 && talk > getApp);
    assert.doesNotMatch(header, /meetYourFirstAnimal/);
    // On a species page the Talk button talks to that animal (JRN-5).
    const talkLink = readRepo("src/app/[locale]/(composited)/_components/header-talk-link.tsx");
    assert.match(talkLink, /speciesTalkHref/);
});

test("the header is Talk · Find your animals · Get the app (Nov 2026), with the search hubs in the footer", () => {
    // Talk and Get the app are the header's two buttons; Find your animals is its one link.
    // The Ark leads (SEO lane S3, 2026-11-12: the world was in no navigation), then Find your animals.
    assert.deepEqual(headerNavLinks.map((link) => link.href), [ARK_HREF, FIND_YOUR_ANIMALS_HREF]);
    assert.equal(FIND_YOUR_ANIMALS_HREF, "/what-animal-am-i");
    for (const hub of ["/comparisons", "/tier-list", "/pokemon-animals", "/talk-to-animals", HOW_IT_WORKS_HREF, "/animals", "/blog"]) {
        assert.ok(!headerNavLinks.some((link) => link.href === hub), `${hub} should not be in the header`);
    }
    // The pages stay live and in the footer: the search hubs most people arrive through.
    const footerHrefs = footerColumns.flatMap((column) => column.links ?? []).map((link) => link.href);
    for (const hub of ["/animals", "/comparisons", "/tier-list", "/animal-hybrids", FIND_YOUR_ANIMALS_HREF, HOW_IT_WORKS_HREF, ARK_HREF, "/ark/how-it-works", "/ark/food-chain", "/about"]) {
        assert.ok(footerHrefs.includes(hub), `${hub} should stay in the footer`);
    }
    assert.ok(!footerHrefs.includes("/talk-to-animals"), "one Talk entry in the footer");
    assert.equal(new Set(footerHrefs).size, footerHrefs.length, "the footer lists each page once");
    assert.ok(footerHrefs.length <= 16, "the footer is cut to essentials (12, plus the Ark's four)");
    // The legal row carries the AI & safety page (SPEC 3.1).
    assert.deepEqual(footerLegalLinks.map((link) => link.href), ["/legal/privacy", "/legal/terms", "/legal/refunds", AI_AND_SAFETY_HREF]);
    assert.equal(AI_AND_SAFETY_HREF, "/legal/ai-and-safety");
});

test("header and footer consume the shared public navigation data", () => {
    const header = readRepo("src/app/[locale]/(composited)/_components/header.tsx");
    const footer = readRepo("src/app/[locale]/(composited)/_components/footer.tsx");
    const dropdown = readRepo("src/app/[locale]/(composited)/_components/header-dropdown.tsx");
    assert.match(header, /headerNavLinks/);
    assert.match(header, /HeaderMobileNav/);
    assert.doesNotMatch(header, /mobileNavSections|headerDropdowns/);
    assert.match(footer, /footerColumns/);
    assert.match(footer, /footerLegalLinks/);
    assert.equal(footerColumns.length, 4);
    // The dropdown is out of the header, and kept accessible for when a menu returns.
    assert.match(dropdown, /aria-expanded/);
    assert.match(dropdown, /aria-haspopup/);
    assert.match(dropdown, /onPointerEnter=\{onRootPointerEnter\}/);
    assert.match(dropdown, /pointerType !== "mouse"/);
});

test("nav labels match the published category names", () => {
    const en = JSON.parse(readRepo("src/data/locales/en.json"));
    // Oct 2026: the category is "Animal Wisdom" again (it no longer holds a
    // Lessons page), and Blog is "Articles". Lessons → Powers, Traits →
    // Qualities, Behaviours → Frequencies, Challenge Yourself → Trials.
    // Sentence case (DECISIONS §1, 2026-11-01); Power and Trials stay capitalised.
    assert.equal(en.nav.animalWisdom, "Animal wisdom");
    assert.equal(en.nav.footerGroups.wisdom, "Animal wisdom");
    assert.equal(en.nav.blog, "Articles");
    assert.equal(en.nav.animalsNav, "Animals");
    assert.equal(en.nav.discoverAnimalWisdom, "Lessons from animals");
    assert.equal(en.nav.animalPowers, "Animal Powers");
    assert.equal(en.nav.animalQualities, "Animal qualities");
    assert.equal(en.nav.animalFrequencies, "Animal frequencies");
    assert.equal(en.nav.animalTrials, "Animal Trials");
    assert.equal(en.nav.instagramWildlifeArchive, "Import from Instagram");
    assert.equal(en.nav.animalSymbolism, "Animal symbolism");
    assert.equal(en.nav.support, "Help center");
    assert.equal(en.nav.compareAnimals, "Side by side");
    assert.equal(en.nav.wildlifeGuides, "Wildlife guides");
    assert.equal(en.nav.talkToAnAnimal, "Talk to an animal");
    assert.equal(en.nav.getTheApp, "Get the app");
    assert.equal(en.nav.adviceFatigue, "Advice fatigue");
    assert.equal(en.nav.howItWorks, "How it works");
    assert.equal(en.nav.findYourAnimals, "Find your animals");
    assert.equal(en.nav.aiAndSafety, "AI & safety");
    assert.equal(en.nav.footerGroups.help, "Help");
    assert.equal(en.nav.footerGroups.product, "AnimalDex");
    assert.notEqual(en.nav.animalWisdom, "Animal Guide");
    assert.equal(en.nav.moreNav, "More");

    // Every label key the navigation renders must exist in both locales.
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    const keys = [
        ...productLinks, ...exploreAnimalLinks, ...animalWisdomLinks, ...resourceLinks,
        ...headerNavLinks, howItWorksNavLink, ...footerColumns.flatMap((column) => column.links ?? []), ...footerLegalLinks
    ].map((link) => link.labelKey).concat(footerColumns.map((column) => column.titleKey.replace(/^footerGroups\./, "")));
    const label = (messages: {nav: Record<string, unknown> & {footerGroups: Record<string, unknown>}}, key: string) =>
        messages.nav[key] ?? messages.nav.footerGroups[key];
    for (const key of Array.from(new Set(keys))) {
        assert.equal(typeof label(en, key), "string", `en.nav.${key} is missing`);
        assert.equal(typeof label(id, key), "string", `id.nav.${key} is missing`);
    }
});

test("the mobile drawer shows every link exactly once", () => {
    // Find your animals at the top; Talk to an animal, then Get the app beside the account, pinned at the foot.
    const drawerHrefs = [...headerNavLinks.map((link) => link.href), ...PINNED_DRAWER_HREFS];
    assert.deepEqual(PINNED_DRAWER_HREFS, [TALK_HREF, START_COLLECTION_HREF]);
    assert.equal(new Set(drawerHrefs).size, drawerHrefs.length);
    assert.ok(productLinks.some((link) => link.href === START_COLLECTION_HREF));
    assert.ok(productLinks.some((link) => link.href === TALK_HREF));
    // Still reachable from the footer, the sitemap and in-page links, only not in the drawer.
    for (const href of [LOCATIONS_HREF, ANIMAL_FREQUENCIES_HREF, ANIMAL_TRIALS_HREF, blogNavLink.href, ADVICE_FATIGUE_HREF, EARN_ON_ANIMALDEX_HREF, INSTAGRAM_WILDLIFE_ARCHIVE_HREF]) {
        assert.ok(!drawerHrefs.includes(href), `${href} left the drawer`);
    }
    const header = readRepo("src/app/[locale]/(composited)/_components/header.tsx");
    assert.match(header, /topLinks=\{navLinks\}/);
    assert.match(header, /moreGroups=\{\[\]\}/);
});

test("mobile drawer uses an accessible accordion and pins Talk, then Get the app beside the account", () => {
    const mobileNav = readRepo("src/app/[locale]/(composited)/_components/header-mobile-nav.tsx");
    const menu = readRepo("src/app/[locale]/(composited)/_components/header-menu.tsx");
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    const pinnedCta = menu.indexOf("href={talkHref}");
    const pinnedAuth = menu.indexOf("{mobileAuth}", pinnedCta);

    assert.match(mobileNav, /aria-expanded/);
    assert.match(mobileNav, /aria-controls/);
    assert.match(mobileNav, /DEFAULT_MOBILE_ACCORDION_ID/);
    assert.match(mobileNav, /type="button"/);
    assert.ok(pinnedCta > -1);
    assert.ok(pinnedAuth > pinnedCta);
    assert.ok(menu.indexOf("href={secondaryCtaHref}", pinnedCta) > pinnedCta);
    assert.equal(id.nav.moreNav, "Lainnya");
    assert.equal(id.nav.talkToAnAnimal, "Bicara dengan hewan");
    assert.equal(id.nav.getTheApp, "Unduh aplikasi");
});
