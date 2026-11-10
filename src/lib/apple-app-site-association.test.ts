import assert from "node:assert/strict";
import test from "node:test";
import {appleAppSiteAssociation, appleApplicationId} from "./apple-app-site-association";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const paths = (applicationId = "TEAM.app") => appleAppSiteAssociation(applicationId).applinks.details[0].components.map((component) => component["/"]);

test("the cards and posts stay first, as before", () => {
    assert.deepEqual(paths().slice(0, 2), ["/u/*", "/p/*"]);
});

test("the Ark opens in the app: /ark, /ark/*, /u/*/ark, and their /id twins (Ark 3.3)", () => {
    for (const path of ["/ark", "/ark/*", "/u/*/ark", "/id/ark", "/id/ark/*", "/id/u/*/ark"]) {
        assert.ok(paths().includes(path), path);
    }
});

test("every prefixed locale the site has is covered (src/i18n.ts)", () => {
    const config = readFileSync(fileURLToPath(new URL("../i18n.ts", import.meta.url)), "utf8");
    const list = config.match(/locales:\s*\[([^\]]*)\]/)?.[1] ?? "";
    const locales = list.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    const fallback = config.match(/defaultLocale:\s*['"]([a-z-]+)['"]/)?.[1];
    assert.ok(locales.length > 1 && fallback);
    for (const locale of locales.filter((locale) => locale !== fallback)) assert.ok(paths().includes(`/${locale}/ark`), locale);
});

test("the app id: the env's, else team + bundle, else the shipped one", () => {
    assert.equal(appleApplicationId({applicationId: " X.y "}), "X.y");
    assert.equal(appleApplicationId({teamId: "T", bundleId: "b.c"}), "T.b.c");
    assert.equal(appleApplicationId({}), "U87CQY25JC.com.lennybeadle.animaldexios");
    assert.deepEqual(appleAppSiteAssociation("A.b").applinks.details[0].appIDs, ["A.b"]);
    assert.deepEqual(appleAppSiteAssociation("A.b").applinks.apps, []);
});
