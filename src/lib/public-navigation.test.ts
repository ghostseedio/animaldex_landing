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
    headerDropdowns,
    headerResourceLinks,
    HOW_IT_WORKS_HREF,
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
        "/#features",
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
    assert.deepEqual(animalWisdomLinks.map((link) => link.href), [
        "/animal-wisdom",
        "/talk-to-animals",
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
    const talk = header.indexOf("href={TALK_HREF}");
    assert.ok(getApp > -1 && talk > getApp);
    assert.doesNotMatch(header, /meetYourFirstAnimal/);
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
    assert.equal(en.nav.animalWisdom, "Animal Wisdom");
    assert.equal(en.nav.footerGroups.wisdom, "Animal Wisdom");
    assert.equal(en.nav.blog, "Articles");
    assert.equal(en.nav.discoverAnimalWisdom, "Lessons from Animals");
    assert.equal(en.nav.animalPowers, "Animal Powers");
    assert.equal(en.nav.animalQualities, "Animal Qualities");
    assert.equal(en.nav.animalFrequencies, "Animal Frequencies");
    assert.equal(en.nav.animalTrials, "Animal Trials");
    assert.equal(en.nav.instagramWildlifeArchive, "Import from Instagram");
    assert.equal(en.nav.animalSymbolism, "Animal Symbolism Articles");
    assert.equal(en.nav.support, "Help Center");
    assert.equal(en.nav.compareAnimals, "Compare Animals");
    assert.equal(en.nav.wildlifeGuides, "Wildlife Guides");
    assert.equal(en.nav.talkToAnAnimal, "Talk to an Animal");
    assert.equal(en.nav.getTheApp, "Get the App");
    assert.equal(en.nav.adviceFatigue, "Advice Fatigue");
    assert.equal(en.nav.howAnimalDexWorks, "How AnimalDex Works");
    assert.equal(en.nav.footerGroups.product, "AnimalDex");
    assert.notEqual(en.nav.animalWisdom, "Animal Guide");
    assert.equal(en.nav.moreNav, "More");

    // Every label key the navigation renders must exist in both locales.
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    const keys = [
        ...productLinks, ...exploreAnimalLinks, ...animalWisdomLinks, ...resourceLinks
    ].map((link) => link.labelKey);
    for (const key of Array.from(new Set(keys))) {
        assert.equal(typeof en.nav[key], "string", `en.nav.${key} is missing`);
        assert.equal(typeof id.nav[key], "string", `id.nav.${key} is missing`);
    }
});

test("the mobile drawer shows every link exactly once", () => {
    const explore = mobileAccordionSections.find((section) => section.id === "explore");
    const lessons = mobileAccordionSections.find((section) => section.id === "lessons");
    const moreHrefs = moreNavGroups.flat().map((link) => link.href);
    const mobileHrefs = [
        ...mobileAccordionSections.flatMap((section) => section.links.map((link) => link.href)),
        blogNavLink.href,
        ...moreHrefs
    ];

    assert.ok(explore?.links.some((link) => link.href === LOCATIONS_HREF));
    assert.ok(lessons?.links.some((link) => link.href === ANIMAL_FREQUENCIES_HREF));
    assert.ok(lessons?.links.some((link) => link.href === ANIMAL_TRIALS_HREF));

    // Articles keeps its own slot, so the Resources dropdown drops it.
    assert.equal(blogNavLink.href, "/blog");
    assert.ok(!headerResourceLinks.some((link) => link.href === "/blog"));
    assert.ok(resourceLinks.some((link) => link.href === "/blog"));
    assert.ok(!moreHrefs.includes("/blog"));
    // The drawer pins Talk to an animal, and Get the app beside Web app, at its foot.
    assert.ok(!moreHrefs.includes(START_COLLECTION_HREF));
    assert.ok(!moreHrefs.includes(TALK_HREF));
    assert.ok(moreHrefs.includes(EARN_ON_ANIMALDEX_HREF));
    assert.ok(productLinks.some((link) => link.href === START_COLLECTION_HREF));
    assert.ok(productLinks.some((link) => link.href === TALK_HREF));
    assert.ok(!mobileAccordionSections.some((section) => section.id === "blog"));

    // The drawer renders accordions, Articles and More together, so a repeat is
    // a duplicate tap target rather than a shortcut.
    assert.equal(new Set(mobileHrefs).size, mobileHrefs.length);
    assert.deepEqual(moreNavGroups[0].map((link) => link.href), [
        HOW_IT_WORKS_HREF,
        ADVICE_FATIGUE_HREF,
        "/#features",
        "/use-cases",
        INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
        EARN_ON_ANIMALDEX_HREF
    ]);
});

test("mobile drawer uses an accessible accordion and pins Talk, then Get the app beside the account", () => {
    const mobileNav = readRepo("src/app/[locale]/(composited)/_components/header-mobile-nav.tsx");
    const menu = readRepo("src/app/[locale]/(composited)/_components/header-menu.tsx");
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    const pinnedCta = menu.indexOf("href={ctaHref}");
    const pinnedAuth = menu.indexOf("{mobileAuth}", pinnedCta);

    assert.match(mobileNav, /aria-expanded/);
    assert.match(mobileNav, /aria-controls/);
    assert.match(mobileNav, /DEFAULT_MOBILE_ACCORDION_ID/);
    assert.match(mobileNav, /type="button"/);
    assert.ok(pinnedCta > -1);
    assert.ok(pinnedAuth > pinnedCta);
    assert.ok(menu.indexOf("href={secondaryCtaHref}", pinnedCta) > pinnedCta);
    assert.equal(id.nav.moreNav, "Lainnya");
    assert.equal(id.nav.talkToAnAnimal, "Bicara dengan Seekor Hewan");
    assert.equal(id.nav.getTheApp, "Dapatkan Aplikasinya");
});
