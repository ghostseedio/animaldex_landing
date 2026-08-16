import "server-only";

import {databaseSpeciesCanonicalSlug, getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {
    LIFE_STAGE_FORM_TOKENS,
    isStageWordSpeciesAllowlist,
    normalizeIdentityToken,
    resolveCanonicalSlugFromIdentity
} from "@/lib/species-life-stage-policy";

/**
 * Which catalog entries have a landing page of their own.
 *
 * An AnimalDex number does not by itself produce /animals/<slug>. The page list
 * is built by getUnifiedSpeciesEntries, which drops hidden entries, life-stage
 * forms, identity aliases, and — through the canonical dedupe — every entry but
 * one of any group resolving to the same identity. So an entry can be indexed,
 * complete, and still have nowhere of its own to send a visitor.
 *
 * Rather than restating those rules and letting the two drift, this asks the
 * page list itself which profile each published slug belongs to, and separates
 * "deliberately shares a page" from "has none at all" — only the second is a gap
 * worth filling, and publishing a second page for African Lion beside Lion would
 * be a duplicate rather than a fix.
 */

export type LandingPageState = "own" | "shared" | "none";

export type LandingPageHost = {name: string; number: number | null; slug: string; speciesProfileId: string | null};

export type LandingPageStatus = {
    state: LandingPageState;
    /** Slug this entry would publish at. */
    slug: string | null;
    /** Page that represents this entry, whether its own or the one it folds into. */
    path: string | null;
    hasPage: boolean;
    /** Why there is no page of its own, in the words an operator needs to act on. */
    reason: string | null;
    /** The entry publishing in its place. */
    hostedBy: LandingPageHost | null;
};

type CatalogRowLike = {
    species_profile_id?: unknown;
    animaldex_number?: unknown;
    display_name?: unknown;
    landing_page_slug?: unknown;
    normalized_identity_key?: unknown;
    catalog_status?: unknown;
};

export type CatalogLandingPageIndex = {
    resolve(row: CatalogRowLike): LandingPageStatus;
    /** Slugs already published, so a replacement slug can avoid them. */
    isSlugTaken(slug: string): boolean;
};

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The life-stage word an identity key ends on, when that is what makes it non-canonical. */
function lifeStageSuffix(identityKey: string | null) {
    if (!identityKey || isStageWordSpeciesAllowlist(identityKey)) return null;
    const parts = normalizeIdentityToken(identityKey).split("_").filter(Boolean);
    if (parts.length < 2) return null;
    const stage = parts[parts.length - 1];
    return LIFE_STAGE_FORM_TOKENS.has(stage) ? stage : null;
}

export async function getCatalogLandingPageIndex(): Promise<CatalogLandingPageIndex> {
    const entries = await getUnifiedSpeciesEntries();
    const bySpeciesProfileId = new Map<string, string>();
    const bySlug = new Map<string, LandingPageHost>();

    for (const entry of entries) {
        const profileId = entry.speciesProfileId?.toLowerCase() ?? null;
        if (profileId && !bySpeciesProfileId.has(profileId)) bySpeciesProfileId.set(profileId, entry.slug);
        bySlug.set(entry.slug, {
            name: entry.name,
            number: entry.databaseSource?.animalDexNumber ?? null,
            slug: entry.slug,
            speciesProfileId: profileId
        });
    }

    return {
        isSlugTaken(slug: string) {
            return bySlug.has(slug.trim().toLowerCase());
        },

        resolve(row: CatalogRowLike): LandingPageStatus {
            const profileId = text(row.species_profile_id)?.toLowerCase() ?? null;
            const published = profileId ? bySpeciesProfileId.get(profileId) ?? null : null;

            if (published) {
                return {
                    state: "own",
                    slug: published,
                    path: `/animals/${published}`,
                    hasPage: true,
                    reason: null,
                    hostedBy: null
                };
            }

            const number = typeof row.animaldex_number === "number" ? row.animaldex_number : null;
            const identityKey = text(row.normalized_identity_key);
            const slug = databaseSpeciesCanonicalSlug({
                landing_page_slug: text(row.landing_page_slug),
                normalized_identity_key: identityKey,
                animaldex_number: number
            }) || null;

            // An alias or a life-stage form is meant to fold into another entry,
            // so the page it folds into is the answer, not a missing page.
            const canonicalSlug = resolveCanonicalSlugFromIdentity(identityKey);
            const host = canonicalSlug && canonicalSlug !== slug ? bySlug.get(canonicalSlug) ?? null : null;

            if (host) {
                const stage = lifeStageSuffix(identityKey);

                return {
                    state: "shared",
                    slug,
                    path: `/animals/${host.slug}`,
                    hasPage: true,
                    reason: stage
                        ? `Publishes as the ${stage} form of ${host.name}${host.number ? ` (#${host.number})` : ""}.`
                        : `Folds into ${host.name}${host.number ? ` (#${host.number})` : ""}, which its identity key resolves to.`,
                    hostedBy: host
                };
            }

            const owner = slug ? bySlug.get(slug) ?? null : null;
            const status = text(row.catalog_status);

            if (owner && owner.speciesProfileId !== profileId) {
                return {
                    state: "shared",
                    slug,
                    path: `/animals/${owner.slug}`,
                    hasPage: true,
                    reason: `/animals/${slug} already publishes ${owner.name}${owner.number ? ` (#${owner.number})` : ""}. Give this entry its own slug to split them.`,
                    hostedBy: owner
                };
            }

            return {
                state: "none",
                slug,
                path: null,
                hasPage: false,
                reason: number == null
                    ? "Not indexed — an entry needs an AnimalDex number before it gets a page."
                    : status === "hidden"
                        ? "Hidden entries are left out of the published catalog."
                        : !slug
                            ? "No landing slug, and no identity key to derive one from."
                            : "Folded into another entry sharing its canonical identity.",
                hostedBy: null
            };
        }
    };
}
