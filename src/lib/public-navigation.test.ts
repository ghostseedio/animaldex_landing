import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    ANIMAL_FREQUENCIES_HREF,
    animalWisdomLinks,
    blogNavLink,
    ANIMAL_TRIALS_HREF,
    EARN_ON_ANIMALDEX_HREF,
    exploreAnimalLinks,
    footerColumns,
    headerDropdowns,
    headerResourceLinks,
    INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
    LOCATIONS_HREF,
    mobileAccordionSections,
    moreNavGroups,
    productLinks,
    resourceLinks,
    START_COLLECTION_HREF,
    WILDLIFE_EXPERIENCES_HREF
} from "@/data/public-navigation";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("public navigation keeps existing SEO routes", () => {
    assert.deepEqual(productLinks.map((link) => link.href), [
        "/#more",
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
        WILDLIFE_EXPERIENCES_HREF
    ]);
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
    assert.equal(INSTAGRAM_WILDLIFE_ARCHIVE_HREF, "/use-cases/import-instagram-wildlife-photos");

    // Retired from public navigation by an explicit product decision: the Guide
    // and Creator Rewards pages are reachable by URL and in-page links only.
    const everyNavHref = [
        ...productLinks, ...exploreAnimalLinks, ...animalWisdomLinks, ...resourceLinks,
        ...headerDropdowns.flatMap((section) => section.links), ...moreNavGroups.flat()
    ].map((link) => link.href);
    for (const retired of ["/wildlife-guides", "/become-a-wildlife-guide", "/creator-rewards"]) {
        assert.ok(!everyNavHref.includes(retired), `${retired} should not be in public navigation`);
    }
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
    assert.equal(en.nav.startYourCollection, "Start Your Collection");
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
    assert.ok(explore?.links.some((link) => link.href === WILDLIFE_EXPERIENCES_HREF));
    assert.ok(lessons?.links.some((link) => link.href === ANIMAL_FREQUENCIES_HREF));
    assert.ok(lessons?.links.some((link) => link.href === ANIMAL_TRIALS_HREF));

    // Articles keeps its own slot, so the Resources dropdown drops it.
    assert.equal(blogNavLink.href, "/blog");
    assert.ok(!headerResourceLinks.some((link) => link.href === "/blog"));
    assert.ok(resourceLinks.some((link) => link.href === "/blog"));
    assert.ok(!moreHrefs.includes("/blog"));
    assert.ok(!moreHrefs.includes(START_COLLECTION_HREF));
    assert.ok(moreHrefs.includes(EARN_ON_ANIMALDEX_HREF));
    assert.ok(productLinks.some((link) => link.href === START_COLLECTION_HREF));
    assert.ok(!mobileAccordionSections.some((section) => section.id === "blog"));

    // The drawer renders accordions, Articles and More together, so a repeat is
    // a duplicate tap target rather than a shortcut.
    assert.equal(new Set(mobileHrefs).size, mobileHrefs.length);
    assert.deepEqual(moreNavGroups[0].map((link) => link.href), [
        "/#more",
        "/#features",
        "/use-cases",
        INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
        EARN_ON_ANIMALDEX_HREF
    ]);
});

test("mobile drawer uses an accessible accordion and pinned collection CTA", () => {
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
    assert.equal(id.nav.moreNav, "Lainnya");
    assert.equal(id.nav.startYourCollection, "Mulai Koleksimu");
});
