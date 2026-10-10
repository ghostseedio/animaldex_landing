import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {isNavHrefActive, isNavSectionActive, stripNavLocale} from "@/lib/nav-active";
import {animalWisdomLinks, exploreAnimalLinks, resourceLinks, START_COLLECTION_HREF} from "@/data/public-navigation";

test("strips the locale prefix the header links are rendered with", () => {
    assert.equal(stripNavLocale("/id"), "/");
    assert.equal(stripNavLocale("/id/animals"), "/animals");
    assert.equal(stripNavLocale("/animals"), "/animals");
    assert.equal(stripNavLocale("/idea"), "/idea");
});

test("a nav href is active on its own page and inside its family", () => {
    assert.ok(isNavHrefActive("/animals", "/animals"));
    assert.ok(isNavHrefActive("/animals/lion", "/animals"));
    assert.ok(isNavHrefActive("/id/animals/lion", "/animals"));
    assert.ok(isNavHrefActive("/animals/", "/animals"));
    assert.ok(!isNavHrefActive("/animal-wisdom", "/animals"));
    assert.ok(!isNavHrefActive("/animals-of-kenya", "/animals"));
    assert.ok(!isNavHrefActive(null, "/animals"));
});

test("home only matches home, and in-page anchors never take the marker", () => {
    assert.ok(isNavHrefActive("/", "/"));
    assert.ok(isNavHrefActive("/id", "/"));
    assert.ok(!isNavHrefActive("/animals", "/"));
    assert.ok(!isNavHrefActive("/", START_COLLECTION_HREF));
    assert.ok(!isNavHrefActive("/", "/#features"));
});

test("a dropdown is active when any of its links is", () => {
    const lessons = animalWisdomLinks.map((link) => link.href);
    const explore = exploreAnimalLinks.map((link) => link.href);
    // Animal Symbolism sits under Resources now, not with the lesson pages.
    const resources = resourceLinks.map((link) => link.href);

    assert.ok(isNavSectionActive("/animal-symbolism/owl", resources));
    assert.ok(!isNavSectionActive("/animal-symbolism/owl", explore));
    assert.ok(!isNavSectionActive("/animal-symbolism/owl", lessons));
    assert.ok(isNavSectionActive("/animal-powers/patience", lessons));
    assert.ok(isNavSectionActive("/comparisons/lion-vs-tiger", explore));
    assert.ok(!isNavSectionActive("/blog", lessons));
});

test("the locale prefixes stripped here match the routing config", () => {
    const i18n = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "i18n.ts"), "utf8");
    const navSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "nav-active.ts"), "utf8");
    const configured = i18n.match(/locales:\s*\[([^\]]*)\]/)?.[1];
    const stripped = navSource.match(/NAV_LOCALE_PREFIXES = \[([^\]]*)\]/)?.[1];

    assert.ok(configured, "i18n.ts should declare a locales array");
    assert.deepEqual(
        stripped?.split(",").map((value) => value.trim().replace(/['"]/g, "")),
        configured.split(",").map((value) => value.trim().replace(/['"]/g, ""))
    );
});
