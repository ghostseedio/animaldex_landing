import {test} from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {closedSeoRedirectPath} from "./closed-seo-namespaces";
import publishedSeoSlugs from "../data/published-seo-slugs.json";
import {analyticsEventParameters} from "./analytics";

// Oct 2026 Search Console: 1,322 404s, mostly retired /qualities slugs and
// lesson URLs that kept their catalog number. They now 308 to a live page.

test("retired qualities go to the hub, numbered animal and lesson slugs to their base", () => {
    assert.equal(closedSeoRedirectPath("/qualities/distinctive-design"), "/qualities");
    assert.equal(closedSeoRedirectPath("/id/qualities/acceleration"), "/id/qualities");
    const lesson = publishedSeoSlugs.lessons.find((slug) => !/-\d+$/.test(slug))!;
    assert.equal(closedSeoRedirectPath(`/animal-powers/${lesson}-1674`), `/animal-powers/${lesson}`);
    const animal = publishedSeoSlugs.animals.find((slug) => !/-\d+$/.test(slug))!;
    assert.equal(closedSeoRedirectPath(`/animals/${animal}-42`), `/animals/${animal}`);
    assert.equal(closedSeoRedirectPath("/animals/no-such-animal-at-all"), null);
    assert.equal(closedSeoRedirectPath(`/animals/${animal}`), null);
});


test("UI labels never reach GA4 as traffic-source parameters", () => {
    assert.deepEqual(analyticsEventParameters({source: "drawer", species: "cheetah", medium: "x"}), {ui_source: "drawer", species: "cheetah", ui_medium: "x"});
});

// getAbsoluteUrl(locale, path): a path passed as the only argument is read as
// the locale and comes out as "https://animals/lion", or throws on "/" (every
// /videos watch page 500'd on Oct 28 2026). The path is optional, so tsc allows it.
test("getAbsoluteUrl always gets a locale first", () => {
    const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [join(dir, entry.name)] : []);
    const misuse = walk(join(__dirname, "..")).flatMap((file) =>
        Array.from(readFileSync(file, "utf8").matchAll(/getAbsoluteUrl\((?:["'`]\/|path\)|articlePath\)|sourcePath\()/g), () => file));
    assert.deepEqual(misuse, []);
});
