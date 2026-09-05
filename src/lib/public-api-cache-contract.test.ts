import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("anonymous species images use public artwork instead of a Function per card", () => {
    const helper = read("lib/species-image-public.ts");
    const images = read("app/api/species-images/[slug]/route.ts");

    assert.match(helper, /getSpeciesArtworkRoute/);
    assert.doesNotMatch(helper, /return `\/api\/species-images\/\$\{slug\}`/);
    assert.match(images, /getSpeciesArtworkRoute/);
    assert.match(images, /export const revalidate = 86400/);
    assert.doesNotMatch(images, /force-dynamic/);
    assert.doesNotMatch(images, /getDatabaseSpeciesBySlug|getSpeciesRepresentativeImageReference/);
});

test("anonymous animals directory does not walk the live catalog or cookies", () => {
    const directory = read("app/api/animals/directory/route.ts");

    assert.match(directory, /requestHasSupabaseAuthCookie/);
    assert.match(directory, /speciesEntries/);
    assert.match(directory, /s-maxage=3600/);
    assert.doesNotMatch(directory, /force-dynamic/);
    assert.doesNotMatch(directory, /cookies\(/);
});
