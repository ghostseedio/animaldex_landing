import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    ADVICE_FATIGUE_HREF,
    ANIMAL_FREQUENCIES_HREF,
    animalWisdomLinks,
    blogNavLink,
    ANIMAL_TRIALS_HREF,
    EARN_ON_ANIMALDEX_HREF,
    exploreAnimalLinks,
    footerColumns,
    headerAnimalLinks,
    headerArticleLinks,
    headerDropdowns,
    HOW_IT_WORKS_HREF,
    howItWorksNavLink,
    INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
    LOCATIONS_HREF,
    mobileAccordionSections,
    moreNavGroups,
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
        ...headerDropdowns.flatMap((section) => section.links), ...moreNavGroups.flat()
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

test("the header is How it works, Animals and Articles (JRN-35), with the search hubs in the footer", () => {
    assert.equal(howItWorksNavLink.href, HOW_IT_WORKS_HREF);
    assert.deepEqual(headerDropdowns.map((section) => section.titleKey), ["animalsNav", "blog"]);
    const headerHrefs = [howItWorksNavLink, ...headerAnimalLinks, ...headerArticleLinks].map((link) => link.href);
    for (const hub of ["/comparisons", "/tier-list", "/pokemon-animals", "/talk-to-animals", "/what-animal-am-i"]) {
        assert.ok(!headerHrefs.includes(hub), `${hub} should not be in the header`);
    }
    const footerHrefs = footerColumns.flatMap((column) => column.links ?? []).map((link) => link.href);
    for (const hub of ["/comparisons", "/tier-list", "/animal-hybrids", "/what-animal-am-i"]) {
        assert.ok(footerHrefs.includes(hub), `${hub} should stay in the footer`);
    }
    assert.ok(!footerHrefs.includes("/talk-to-animals"), "one Talk entry in the footer");
});

test("header and footer consume the shared public navigation data", () => {
    const header = readRepo("src/app/[locale]/(composited)/_components/header.tsx");
    const footer = readRepo("src/app/[locale]/(composited)/_components/footer.tsx");
    const dropdown = readRepo("src/app/[locale]/(composited)/_components/header-dropdown.tsx");
    assert.match(header, /headerDropdowns/);
    assert.match(header, /mobileAccordionSections/);
    assert.match(header, /HeaderMobileNav/);
    assert.match(header, /moreNavGroups/);
    assert.doesNotMatch(header, /mobileNavSections/);
    assert.match(footer, /footerColumns/);
    assert.equal(footerColumns.length, 4);
    assert.match(dropdown, /aria-expanded/);
    assert.match(dropdown, /aria-haspopup/);
    // Desktop dropdowns open on mouse hover (a deliberate product change), but
    // only for a mouse: touch and keyboard users still open them with the button.
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
    assert.equal(en.nav.footerGroups.product, "AnimalDex");
    assert.notEqual(en.nav.animalWisdom, "Animal Guide");
    assert.equal(en.nav.moreNav, "More");

    // Every label key the navigation renders must exist in both locales.
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    const keys = [
        ...productLinks, ...exploreAnimalLinks, ...animalWisdomLinks, ...resourceLinks,
        ...headerAnimalLinks, ...headerArticleLinks, howItWorksNavLink, ...moreNavGroups.flat()
    ].map((link) => link.labelKey).concat(headerDropdowns.map((section) => section.titleKey));
    for (const key of Array.from(new Set(keys))) {
        assert.equal(typeof en.nav[key], "string", `en.nav.${key} is missing`);
        assert.equal(typeof id.nav[key], "string", `id.nav.${key} is missing`);
    }
});

test("the mobile drawer shows every link exactly once", () => {
    const animals = mobileAccordionSections.find((section) => section.id === "explore");
    const articles = mobileAccordionSections.find((section) => section.id === "articles");
    const moreHrefs = moreNavGroups.flat().map((link) => link.href);
    const mobileHrefs = [
        howItWorksNavLink.href,
        ...mobileAccordionSections.flatMap((section) => section.links.map((link) => link.href)),
        ...moreHrefs
    ];

    assert.ok(animals?.links.some((link) => link.href === LOCATIONS_HREF));
    assert.ok(animals?.links.some((link) => link.href === ANIMAL_FREQUENCIES_HREF));
    assert.ok(animals?.links.some((link) => link.href === ANIMAL_TRIALS_HREF));
    assert.ok(articles?.links.some((link) => link.href === blogNavLink.href));
    assert.ok(articles?.links.some((link) => link.href === ADVICE_FATIGUE_HREF));

    // The drawer pins Talk to an animal, and Get the app beside the account, at its foot.
    assert.ok(!moreHrefs.includes(START_COLLECTION_HREF));
    assert.ok(!moreHrefs.includes(TALK_HREF));
    assert.ok(moreHrefs.includes(EARN_ON_ANIMALDEX_HREF));
    assert.ok(productLinks.some((link) => link.href === START_COLLECTION_HREF));
    assert.ok(productLinks.some((link) => link.href === TALK_HREF));

    // How it works, the accordions and More render together, so a repeat is
    // a duplicate tap target rather than a shortcut.
    assert.equal(new Set(mobileHrefs).size, mobileHrefs.length);
    assert.deepEqual(moreHrefs, [
        "/use-cases",
        INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
        EARN_ON_ANIMALDEX_HREF,
        "/contact"
    ]);
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
    assert.equal(id.nav.getTheApp, "Dapatkan aplikasinya");
});
