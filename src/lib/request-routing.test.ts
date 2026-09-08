import assert from "node:assert/strict";
import test from "node:test";
import {
    isProtectedAppPath,
    matchDefaultLocalePrefixedPath,
    middlewareShouldRefreshSession,
    splitLocalePath
} from "./request-routing";

test("splitLocalePath handles default and prefixed locales", () => {
    assert.deepEqual(splitLocalePath("/animals/lion"), {locale: "en", appPath: "/animals/lion"});
    assert.deepEqual(splitLocalePath("/id/animals/lion"), {locale: "id", appPath: "/animals/lion"});
    assert.deepEqual(splitLocalePath("/"), {locale: "en", appPath: "/"});
    assert.deepEqual(splitLocalePath("/id"), {locale: "id", appPath: "/"});
    assert.deepEqual(splitLocalePath("/id/"), {locale: "id", appPath: "/"});
});

test("matchDefaultLocalePrefixedPath collapses /en to unprefixed canonicals", () => {
    assert.equal(matchDefaultLocalePrefixedPath("/en"), "/");
    assert.equal(matchDefaultLocalePrefixedPath("/en/"), "/");
    assert.equal(matchDefaultLocalePrefixedPath("/en/animals/aardvark"), "/animals/aardvark");
    assert.equal(matchDefaultLocalePrefixedPath("/en/animal-lessons/aardvark"), "/animal-lessons/aardvark");
    assert.equal(matchDefaultLocalePrefixedPath("/en/pokemon-animals/generation-i"), "/pokemon-animals/generation-i");
    assert.equal(matchDefaultLocalePrefixedPath("/animals/aardvark"), null);
    assert.equal(matchDefaultLocalePrefixedPath("/animal-lessons/aardvark"), null);
    assert.equal(matchDefaultLocalePrefixedPath("/pokemon-animals/generation-i"), null);
    assert.equal(matchDefaultLocalePrefixedPath("/id/animals/tiger"), null);
    assert.equal(matchDefaultLocalePrefixedPath("/english"), null);
    assert.equal(matchDefaultLocalePrefixedPath("/"), null);
});

test("unprefixed English SEO paths must never be treated as /en collapse targets", () => {
    // Regression: next.config /en/:path* + next-intl rewrite caused self-308s.
    for (const path of [
        "/animals/aardvark",
        "/animal-lessons/aardvark",
        "/pokemon-animals/generation-i",
        "/animals/mata-mata"
    ]) {
        assert.equal(matchDefaultLocalePrefixedPath(path), null);
        assert.equal(splitLocalePath(path).locale, "en");
        assert.equal(splitLocalePath(path).appPath, path);
    }
});

test("protected app paths include nested routes and both locales", () => {
    assert.equal(isProtectedAppPath("/app/import/instagram"), true);
    assert.equal(isProtectedAppPath("/id/app/import/instagram"), true);
    assert.equal(isProtectedAppPath("/app/collection"), true);
    assert.equal(isProtectedAppPath("/app/credits"), true);
    assert.equal(isProtectedAppPath("/app/billing/return"), true);
    assert.equal(isProtectedAppPath("/app/collection/binders/1"), true);
    assert.equal(isProtectedAppPath("/id/app/train"), true);
    assert.equal(isProtectedAppPath("/app"), false);
    assert.equal(isProtectedAppPath("/animals/lion"), false);
    assert.equal(isProtectedAppPath("/account"), false);
    assert.equal(isProtectedAppPath("/admin"), false);
});

test("anonymous public routes do not require session refresh", () => {
    assert.equal(middlewareShouldRefreshSession("/animals/lion", false), false);
    assert.equal(middlewareShouldRefreshSession("/id/blog", false), false);
    assert.equal(middlewareShouldRefreshSession("/comparisons/lion-vs-tiger", false), false);
    assert.equal(middlewareShouldRefreshSession("/wp-admin", false), false);
});

test("auth cookies or protected paths still require session refresh", () => {
    assert.equal(middlewareShouldRefreshSession("/animals/lion", true), true);
    assert.equal(middlewareShouldRefreshSession("/app/collection", false), true);
    assert.equal(middlewareShouldRefreshSession("/id/app/messages", true), true);
});
