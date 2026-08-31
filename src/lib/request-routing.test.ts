import assert from "node:assert/strict";
import test from "node:test";
import {
    isProtectedAppPath,
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
