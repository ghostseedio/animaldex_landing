import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    animalWisdomLinks,
    blogNavLink,
    earnLinks,
    experienceLinks,
    exploreAnimalLinks,
    footerColumns,
    headerDropdowns,
    INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
    LOCATIONS_HREF,
    mobileAccordionSections,
    mobileExperienceLinks,
    moreNavGroups,
    productLinks,
    resourceLinks,
    START_COLLECTION_HREF
} from "@/data/public-navigation";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("public navigation keeps existing SEO routes", () => {
    assert.deepEqual(exploreAnimalLinks.map((link) => link.href), [
        "/animals",
        "/comparisons",
        "/tier-list",
        "/locations",
        INSTAGRAM_WILDLIFE_ARCHIVE_HREF,
        "/what-animal-am-i"
    ]);
    assert.deepEqual(animalWisdomLinks.map((link) => link.href), [
        "/animal-wisdom",
        "/powers",
        "/animal-lessons",
        "/animal-symbolism"
    ]);
    assert.deepEqual(experienceLinks.map((link) => link.href), [
        "/wildlife-experiences",
        "/wildlife-guides",
        "/locations"
    ]);
    assert.deepEqual(earnLinks.map((link) => link.href), [
        "/earn-on-animaldex",
        "/become-a-wildlife-guide",
        "/creator-rewards"
    ]);
    assert.equal(START_COLLECTION_HREF, "/#download");
    assert.equal(INSTAGRAM_WILDLIFE_ARCHIVE_HREF, "/use-cases/import-instagram-wildlife-photos");
    assert.ok(productLinks.some((link) => link.href === "/use-cases"));
    assert.ok(resourceLinks.some((link) => link.href === "/sponsor-a-challenge"));
    assert.ok(!headerDropdowns.some((section) => section.links.some((link) => link.href === "/sponsor-a-challenge")));
    assert.ok(!earnLinks.some((link) => link.href === "/sponsor-a-challenge"));
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
    assert.equal(footerColumns.length, 5);
    assert.match(dropdown, /aria-expanded/);
    assert.match(dropdown, /aria-haspopup/);
    assert.doesNotMatch(dropdown, /onMouseEnter/);
});

test("nav labels no longer use retired public category names", () => {
    const en = JSON.parse(readRepo("src/data/locales/en.json"));
    assert.equal(en.nav.animalWisdom, "Animal Wisdom");
    assert.equal(en.nav.blog, "Blog");
    assert.equal(en.nav.compareAnimals, "Compare Animals");
    assert.equal(en.nav.animalAbilities, "Animal Abilities");
    assert.equal(en.nav.startYourCollection, "Start Your Collection");
    assert.equal(en.nav.footerGroups.wisdom, "Animal Wisdom");
    assert.equal(en.nav.footerGroups.product, "AnimalDex");
    assert.notEqual(en.nav.animalWisdom, "Animal Guide");
    assert.notEqual(en.nav.blog, "Articles");
    assert.equal(en.nav.moreNav, "More");
    assert.equal(en.nav.instagramWildlifeArchive, "Instagram Wildlife Archive");
});

test("mobile accordion presentation filters desktop-only overlaps", () => {
    const explore = mobileAccordionSections.find((section) => section.id === "explore");
    const experiences = mobileAccordionSections.find((section) => section.id === "experiences");
    const earn = mobileAccordionSections.find((section) => section.id === "earn");
    const moreHrefs = moreNavGroups.flat().map((link) => link.href);
    const mobileHrefs = [
        ...mobileAccordionSections.flatMap((section) => section.links.map((link) => link.href)),
        blogNavLink.href,
        ...moreHrefs
    ];

    assert.ok(explore?.links.some((link) => link.href === LOCATIONS_HREF));
    assert.deepEqual(mobileExperienceLinks.map((link) => link.href), [
        "/wildlife-experiences",
        "/wildlife-guides"
    ]);
    assert.ok(!experiences?.links.some((link) => link.href === LOCATIONS_HREF));
    assert.ok(experienceLinks.some((link) => link.href === LOCATIONS_HREF));
    assert.ok(!earn?.links.some((link) => link.href === "/sponsor-a-challenge"));
    assert.ok(!earnLinks.some((link) => link.href === "/sponsor-a-challenge"));
    assert.ok(moreHrefs.includes("/sponsor-a-challenge"));
    assert.ok(!moreHrefs.includes("/blog"));
    assert.ok(!moreHrefs.includes(START_COLLECTION_HREF));
    assert.equal(blogNavLink.href, "/blog");
    assert.ok(!mobileAccordionSections.some((section) => section.id === "blog"));
    assert.equal(mobileHrefs.filter((href) => href === LOCATIONS_HREF).length, 1);
    assert.equal(new Set(mobileHrefs).size, mobileHrefs.length);
    assert.ok(productLinks.some((link) => link.href === START_COLLECTION_HREF));
    assert.deepEqual(moreNavGroups[0].map((link) => link.href), ["/#more", "/#features", "/use-cases"]);
    assert.deepEqual(moreNavGroups[1].map((link) => link.href), [
        "/support",
        "/contact",
        "/sponsor-a-challenge",
        "/branding"
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
