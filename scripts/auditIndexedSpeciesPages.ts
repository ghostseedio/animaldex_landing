/**
 * Audits whether every indexed species (one with an AnimalDex number) resolves to a
 * landing page slug.
 *
 * The catalog loader drops a species when its slug is blank or already claimed by an
 * earlier row, so collisions silently remove animals from the website. This reports each
 * dropped species and why.
 *
 * Usage: npx tsx scripts/auditIndexedSpeciesPages.ts
 */
import "dotenv/config";

import {isNonCanonicalLifeStageCatalogIdentity} from "../src/lib/species-life-stage-policy";
import {resolveCollectionIdentityToken} from "../src/lib/collection-identity-aliases";

// database-species-pages is server-only, so the slug rule is mirrored here. Kept in sync
// with databaseSpeciesCanonicalSlug().
function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function stripCatalogNumberSuffix(slug: string, animalDexNumber: number | null) {
    if (animalDexNumber === null) return slug;
    return slug.replace(new RegExp(`-${animalDexNumber}$`), "");
}

function databaseSpeciesCanonicalSlug(row: {landing_page_slug: string | null; normalized_identity_key: string; animaldex_number: number | null}) {
    const landingSlug = clean(row.landing_page_slug);
    const identitySlug = clean(row.normalized_identity_key)?.replace(/_/g, "-") ?? "";
    const normalizedLanding = landingSlug ? stripCatalogNumberSuffix(landingSlug, row.animaldex_number) : "";
    const value = normalizedLanding || identitySlug;
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type CatalogRow = {
    species_profile_id: string;
    animaldex_number: number | null;
    display_name: string | null;
    normalized_identity_key: string;
    landing_page_slug: string | null;
};

type ProfileRow = {
    id: string;
    animaldex_number: number | null;
    catalog_status: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function fetchAll<T>(table: string, select: string, filter = ""): Promise<T[]> {
    const rows: T[] = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
        const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}&limit=${pageSize}&offset=${offset}`;
        const response = await fetch(url, {
            headers: {apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`}
        });

        if (!response.ok) {
            throw new Error(`${table} ${response.status}: ${await response.text()}`);
        }

        const batch = await response.json() as T[];
        rows.push(...batch);

        if (batch.length < pageSize) {
            return rows;
        }
    }
}

async function main() {
    const [profiles, catalog] = await Promise.all([
        fetchAll<ProfileRow>("species_profiles", "id,animaldex_number,catalog_status", "&animaldex_number=not.is.null"),
        fetchAll<CatalogRow>("species_catalog_v1", "species_profile_id,animaldex_number,display_name,normalized_identity_key,landing_page_slug", "&animaldex_number=not.is.null&order=animaldex_number.asc")
    ]);

    const indexedNumbers = new Map(
        profiles.filter((row) => row.catalog_status !== "hidden").map((row) => [row.id, row.animaldex_number])
    );

    const bySlug = new Map<string, CatalogRow>();
    const dropped: Array<{row: CatalogRow; reason: string; detail?: string}> = [];

    for (const row of catalog) {
        if (isNonCanonicalLifeStageCatalogIdentity(row.normalized_identity_key)) {
            // Either a life stage (caterpillar) or an alias of another canonical species
            // (grizzly_bear -> brown_bear). Both are reachable via a redirect to the
            // canonical slug rather than owning a page.
            const canonical = resolveCollectionIdentityToken(row.normalized_identity_key);
            dropped.push({
                row,
                reason: canonical !== row.normalized_identity_key ? "alias of canonical species" : "life stage",
                detail: canonical !== row.normalized_identity_key ? `redirects to ${canonical.replace(/_/g, "-")}` : undefined
            });
            continue;
        }

        if (indexedNumbers.get(row.species_profile_id) === undefined) {
            dropped.push({row, reason: "no visible indexed profile"});
            continue;
        }

        const slug = databaseSpeciesCanonicalSlug(row);

        if (!slug) {
            dropped.push({row, reason: "blank slug"});
            continue;
        }

        const claimed = bySlug.get(slug);

        if (claimed) {
            dropped.push({row, reason: "slug collision", detail: `${slug} already used by #${claimed.animaldex_number} ${claimed.display_name}`});
            continue;
        }

        bySlug.set(slug, row);
    }

    const byReason = new Map<string, typeof dropped>();
    for (const item of dropped) {
        const list = byReason.get(item.reason) ?? [];
        list.push(item);
        byReason.set(item.reason, list);
    }

    console.log(`catalog rows with an AnimalDex number: ${catalog.length}`);
    console.log(`species that produce a page:           ${bySlug.size}`);
    console.log(`species with no page:                  ${dropped.length}\n`);

    for (const [reason, items] of Array.from(byReason.entries()).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`${reason}: ${items.length}`);
        for (const item of items.slice(0, 40)) {
            console.log(`   #${item.row.animaldex_number} ${item.row.display_name} (${item.row.normalized_identity_key})${item.detail ? ` — ${item.detail}` : ""}`);
        }
        if (items.length > 40) console.log(`   … ${items.length - 40} more`);
        console.log("");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
