import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {locationPages} from "@/data/locations";
import {buildArtworkIndex, isSpeciesArtwork, resolveArtworkFileInIndex} from "@/data/species-artwork-resolution";
import snapshot from "@/data/species-artwork-snapshot.json";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("species artwork snapshot is a sorted, de-duplicated listing of species icons", () => {
    assert.ok(snapshot.files.length >= 2500, "snapshot looks truncated; rerun scripts/refreshSpeciesArtworkSnapshot.mts");
    assert.deepEqual(snapshot.files, [...snapshot.files].sort((a, b) => a.localeCompare(b)));
    assert.equal(new Set(snapshot.files).size, snapshot.files.length);
    assert.ok(snapshot.files.every(isSpeciesArtwork), "matchup composites (*-vs-*) and non-webp objects must be filtered out");
});

test("artwork resolution: exact file, alias, letters-only spelling, closest relative", () => {
    const index = buildArtworkIndex([
        "bengal-tiger.webp",
        "tiger-swallowtail.webp",
        "pallass-cat.webp",
        "secretarybird.webp",
        "lion-vs-gorilla.webp",
        "lion.webp",
        "notes.txt"
    ]);

    assert.equal(resolveArtworkFileInIndex(index, "lion"), "lion.webp");
    assert.equal(resolveArtworkFileInIndex(index, " Lion "), "lion.webp");
    assert.equal(resolveArtworkFileInIndex(index, "pallas-cat"), "pallass-cat.webp");
    assert.equal(resolveArtworkFileInIndex(index, "secretary-bird"), "secretarybird.webp");
    // A real tiger beats a butterfly that borrows the word.
    assert.equal(resolveArtworkFileInIndex(index, "tiger"), "bengal-tiger.webp");
    // The matchup composite never stands in for a single animal.
    assert.equal(resolveArtworkFileInIndex(index, "gorilla"), null);
    assert.equal(resolveArtworkFileInIndex(index, "aardvark"), null);
    assert.equal(resolveArtworkFileInIndex(index, ""), null);
    assert.equal(buildArtworkIndex([]).bySlug.size, 0);
});

test("the snapshot resolves the static location rosters", () => {
    const index = buildArtworkIndex(snapshot.files);
    const slugs = Array.from(new Set(locationPages.flatMap((location) => location.animalsToSpot.map((animal) => animal.speciesSlug))));
    const unresolved = slugs.filter((slug) => !resolveArtworkFileInIndex(index, slug)).sort();

    // Slugs with no icon in the bucket keep the redirect route (as today); the
    // speedup only holds while nearly every roster animal resolves directly.
    assert.ok(
        unresolved.length <= Math.ceil(slugs.length * 0.03),
        `too many roster slugs fall back to /api/species-artwork; refresh the snapshot or upload icons:\n${unresolved.join("\n")}`
    );
});

test("static location pages resolve artwork from the snapshot, never a bucket listing", () => {
    const index = read("data/species-artwork-index.ts");
    const helper = index.slice(index.indexOf("export async function getSpeciesArtworkDirectUrls"));
    assert.ok(helper.length > 0);
    // The gate: during SEO SSG (ADEX_SEO_SSG_NO_REMOTE / production build) the
    // helper reads the committed snapshot, so no `next.revalidate` fetch can
    // lower a `revalidate = false` page to ISR and no remote read runs at build.
    assert.match(helper, /isSeoSsgRemoteForbidden\(\)/);
    assert.match(helper, /getSnapshotIndex\(\)/);
    assert.match(index, /species-artwork-snapshot\.json/);

    for (const file of [
        "app/[locale]/(composited)/locations/[slug]/page.tsx",
        "app/[locale]/(composited)/locations/[slug]/_components/location-places-route.tsx"
    ]) {
        const source = read(file);
        assert.match(source, /getSpeciesArtworkDirectUrls\(/);
        assert.doesNotMatch(source, /resolveSpeciesArtworkFiles?\(|getResolvedSpeciesArtwork|buildSpeciesArtworkSrc|listBucketFiles/);
        // Unresolved slugs still get a working image via the route.
        assert.match(source, /\?\? getSpeciesArtworkRoute\(/);
    }
    assert.match(read("app/[locale]/(composited)/locations/[slug]/page.tsx"), /export const revalidate = false/);
});
