import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import type {SpeciesEntry} from "@/data/species";
import {speciesCatalogIdentityKey} from "@/lib/catalog-species-dedupe";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

function syntheticSpeciesEntry(slug: string, identityKey?: string): SpeciesEntry {
    return {
        slug,
        name: slug.replace(/-/g, " "),
        normalizedIdentityKey: identityKey ?? slug,
        heroTitle: `${slug} — test`,
        publishedAt: "2026-01-01",
        updatedAt: "2026-01-01",
        featuredImage: {src: "/test.png", alt: slug, width: 1200, height: 630},
        searchIntents: [slug],
        analysis: {
            summary: slug,
            scientificName: slug,
            category: "Animal",
            identification: [slug],
            habitat: slug,
            nativeRange: slug,
            rarityScore: 50,
            rarityReason: "test"
        },
        premiumDetails: {
            behaviorTraits: [],
            whyInteresting: [],
            respectfulSpotting: [],
            lookalikes: []
        },
        relatedSpecies: []
    };
}

test("databaseByIdentityKey preserves first Array.find match when duplicate identity keys exist", () => {
    const entries: SpeciesEntry[] = [
        syntheticSpeciesEntry("aardvark"),
        syntheticSpeciesEntry("aardvark-duplicate", "aardvark"),
        syntheticSpeciesEntry("lion"),
        syntheticSpeciesEntry("lion-alias", "lion")
    ];

    const databaseByIdentityKey = new Map<string, SpeciesEntry>();
    for (const entry of entries) {
        const identityKey = speciesCatalogIdentityKey(entry);
        if (!databaseByIdentityKey.has(identityKey)) {
            databaseByIdentityKey.set(identityKey, entry);
        }
    }

    assert.equal(databaseByIdentityKey.get(speciesCatalogIdentityKey(entries[0]))?.slug, "aardvark");
    assert.equal(databaseByIdentityKey.get(speciesCatalogIdentityKey(entries[1]))?.slug, "aardvark");
    assert.equal(databaseByIdentityKey.get(speciesCatalogIdentityKey(entries[2]))?.slug, "lion");
    assert.equal(databaseByIdentityKey.get(speciesCatalogIdentityKey(entries[3]))?.slug, "lion");
    assert.equal(databaseByIdentityKey.get(speciesCatalogIdentityKey(syntheticSpeciesEntry("tiger"))), undefined);
});

test("direct slug match via databaseBySlug wins over identity key fallback", () => {
    const entries: SpeciesEntry[] = [
        syntheticSpeciesEntry("aardvark"),
        syntheticSpeciesEntry("aardvark-other", "aardvark"),
    ];

    const databaseBySlug = new Map(entries.map((e) => [e.slug, e]));

    const databaseByIdentityKey = new Map<string, SpeciesEntry>();
    for (const entry of entries) {
        const identityKey = speciesCatalogIdentityKey(entry);
        if (!databaseByIdentityKey.has(identityKey)) {
            databaseByIdentityKey.set(identityKey, entry);
        }
    }

    const staticEntry = syntheticSpeciesEntry("aardvark");
    const directMatch = databaseBySlug.get(staticEntry.slug);
    assert.equal(directMatch?.slug, "aardvark");
    assert.notEqual(directMatch?.slug, "aardvark-other");
});

test("missing identity returns null / undefined from Map lookup", () => {
    const entries: SpeciesEntry[] = [
        syntheticSpeciesEntry("aardvark"),
    ];

    const databaseByIdentityKey = new Map<string, SpeciesEntry>();
    for (const entry of entries) {
        const identityKey = speciesCatalogIdentityKey(entry);
        if (!databaseByIdentityKey.has(identityKey)) {
            databaseByIdentityKey.set(identityKey, entry);
        }
    }

    const missing = databaseByIdentityKey.get(speciesCatalogIdentityKey(syntheticSpeciesEntry("nonexistent")));
    assert.equal(missing, undefined);
});

test("databaseByIdentityKey is constructed in O(databaseEntries) not O(databaseEntries × staticEntries)", () => {
    const count = 2000;
    const entries: SpeciesEntry[] = [];
    for (let i = 0; i < count; i++) {
        entries.push(syntheticSpeciesEntry(`entry-${i}`));
    }

    let identityCalls = 0;
    const instrumentedIdentityKey = (entry: Pick<SpeciesEntry, "slug" | "normalizedIdentityKey">) => {
        identityCalls++;
        return speciesCatalogIdentityKey(entry);
    };

    const databaseByIdentityKey = new Map<string, SpeciesEntry>();
    for (const entry of entries) {
        const identityKey = instrumentedIdentityKey(entry);
        if (!databaseByIdentityKey.has(identityKey)) {
            databaseByIdentityKey.set(identityKey, entry);
        }
    }

    assert.equal(identityCalls, count,
        `Identity key called ${identityCalls} times for ${count} entries — should be O(n)`);

    identityCalls = 0;
    const staticCount = 100;
    for (let i = 0; i < staticCount; i++) {
        const staticEntry = syntheticSpeciesEntry(`static-${i}`);
        const directMatch = databaseByIdentityKey.get(identityCalls, speciesCatalogIdentityKey(staticEntry));
    }

    assert.equal(identityCalls, 0,
        `Identity key called ${identityCalls} times during static lookup — should be O(1) Map.get`);
});

test("generated chunk no longer contains databaseEntries.find for identity fallback in resolveDatabaseEntryForStatic", () => {
    const source = read("data/database-species-pages.ts");

    const fnStart = source.indexOf("function resolveDatabaseEntryForStatic");
    const fnEnd = source.indexOf("\n}", fnStart);
    const fnBody = source.slice(fnStart, fnEnd !== -1 ? fnEnd + 2 : undefined);

    assert.doesNotMatch(fnBody, /\.find\(/,
        "resolveDatabaseEntryForStatic should not use .find()");

    assert.match(fnBody, /databaseByIdentityKey\.get/,
        "resolveDatabaseEntryForStatic should use databaseByIdentityKey.get instead");

    assert.match(fnBody, /speciesCatalogIdentityKey/,
        "speciesCatalogIdentityKey should still be called for the static entry");

    assert.match(source, /databaseByIdentityKey\s*=\s*new Map/,
        "databaseByIdentityKey Map should be constructed in getUnifiedSpeciesEntries");

    assert.match(source, /databaseByIdentityKey\.has/,
        "databaseByIdentityKey.has should guard against overwriting first match");
});
