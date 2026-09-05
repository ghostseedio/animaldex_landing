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

test("middleware no longer does uncached CMS lookups or unconditional auth", () => {
    const middleware = read("middleware.ts");
    const supabaseMiddleware = read("lib/supabase/middleware.ts");

    assert.match(middleware, /matcher:/);
    assert.match(middleware, /api\|admin\|_next/);
    assert.doesNotMatch(middleware, /admin_content_entries/);
    assert.doesNotMatch(middleware, /hasPublishedManagedPage/);
    assert.doesNotMatch(middleware, /managed-content/);
    assert.match(middleware, /middlewareShouldRefreshSession/);
    assert.match(middleware, /headers.delete\("set-cookie"\)/);
    assert.match(read("i18n.ts"), /localeDetection: false/);
    assert.match(supabaseMiddleware, /requestHasSupabaseAuthCookie/);
    assert.match(supabaseMiddleware, /auth\.getUser\(\)/);
});

test("public header and footer do not call next-intl request APIs", () => {
    const header = read("app/[locale]/(composited)/_components/header.tsx");
    const footer = read("app/[locale]/(composited)/_components/footer.tsx");
    const layout = read("app/[locale]/(composited)/layout.tsx");
    const tracker = read("components/analytics/google-analytics-route-tracker.tsx");
    const notFound = read("app/[locale]/not-found.tsx");
    const notFoundBody = read("app/[locale]/_components/not-found-body.tsx");

    assert.doesNotMatch(header, /next-intl/);
    assert.doesNotMatch(footer, /next-intl/);
    assert.match(header, /ScopedTranslator/);
    assert.match(footer, /ScopedTranslator/);
    assert.match(layout, /getScopedTranslator\(params\.locale, "nav"\)/);
    assert.match(layout, /<Footer t=\{t\}/);
    assert.doesNotMatch(tracker, /useSearchParams/);
    assert.doesNotMatch(notFound, /next-intl/);
    assert.doesNotMatch(notFoundBody, /next-intl/);
});

test("header auth is shared and skips anonymous session fetches", () => {
    const provider = read("app/[locale]/(composited)/_components/header-auth-provider.tsx");
    const link = read("app/[locale]/(composited)/_components/header-auth-link.tsx");
    const layout = read("app/[locale]/(composited)/layout.tsx");
    const sessionRoute = read("app/api/auth/session/route.ts");

    assert.match(layout, /HeaderAuthProvider/);
    assert.match(provider, /requestHasSupabaseAuthCookie\(document\.cookie\)/);
    assert.match(provider, /\/api\/auth\/session/);
    assert.doesNotMatch(link, /\/api\/auth\/session/);
    assert.match(link, /useHeaderAuth/);
    assert.match(sessionRoute, /hasAuthCookie\(\)/);
    assert.match(sessionRoute, /auth\.getUser\(\)/);
});

test("protected app layout and admin gate still authenticate on the server", () => {
    const appLayout = read("app/[locale]/(authenticated)/app/layout.tsx");
    const adminGate = read("app/admin/_components/admin-auth-gate.tsx");
    const routing = read("lib/request-routing.ts");

    assert.match(appLayout, /getAuthenticatedAppShellData/);
    assert.match(adminGate, /isSupportAdminCookieAuthorized\(cookies\(\)\)/);
    assert.match(routing, /\/app\/collection/);
    assert.match(routing, /\/app\/earnings/);
    assert.match(read("i18n.ts"), /locales: \['en', 'id'\]/);
    assert.doesNotMatch(routing, /getSession\(\)/);
});

test("public /p pages load one post and do not boot the authenticated discover shell", () => {
    const page = read("app/[locale]/p/[postId]/page.tsx");
    const timeline = read("data/discover-timeline.ts");
    const captureFn = timeline.slice(
        timeline.indexOf("async function mapCaptureRowsForKeys"),
        timeline.indexOf("const DISCOVER_POST_TTL_MS")
    );
    const postFn = timeline.slice(
        timeline.indexOf("async function resolveDiscoverPostByIdOnce"),
        timeline.indexOf("export async function getDiscoverPostById")
    );

    assert.match(page, /export const revalidate = 300/);
    assert.match(page, /generateStaticParams/);
    assert.doesNotMatch(page, /force-dynamic/);
    assert.doesNotMatch(page, /getAuthenticatedAppContext/);
    assert.doesNotMatch(page, /getDiscoverTimelineBundle/);
    assert.doesNotMatch(page, /getDiscoverCollectors/);
    assert.doesNotMatch(page, /getAppNotifications/);
    assert.doesNotMatch(page, /getAppCreditBalance/);
    assert.doesNotMatch(page, /getDirectMessageUnreadCount/);
    assert.match(page, /hydrateSignedInFeed/);
    assert.match(page, /hydrateFromSession/);
    assert.match(captureFn, /getCaptureCardCatalogEnrichment/);
    assert.doesNotMatch(captureFn, /getUnifiedSpeciesEntries|buildAnimalDexNumberIndex|createSupabaseServerClient/);
    assert.doesNotMatch(postFn, /createSupabaseServerClient/);
    assert.match(postFn, /createSupabasePublicClient/);
});

test("catchall slug routing skips scanner database lookups", () => {
    const catchall = read("app/[locale]/[...catchall]/page.tsx");
    assert.match(catchall, /shouldLookupPublishedManagedPage/);
    assert.match(catchall, /getManagedPage/);
    assert.match(catchall, /export const revalidate = 300/);
    assert.doesNotMatch(catchall, /force-dynamic/);
});

test("species slug pages resolve identity once and do not load the full catalog", () => {
    const speciesPage = read("app/[locale]/(composited)/animals/[slug]/page.tsx");
    const catalog = read("data/database-species-pages.ts");
    const images = read("data/species-images.ts");
    const rankings = read("data/species-rankings.ts");
    const growth = read("data/species-growth.ts");

    assert.match(speciesPage, /export const revalidate = 3600/);
    assert.match(speciesPage, /generateStaticParams/);
    assert.match(speciesPage, /dynamicParams = true/);
    assert.doesNotMatch(speciesPage, /force-dynamic/);
    assert.match(speciesPage, /getSpeciesPageData/);
    assert.doesNotMatch(speciesPage, /getUnifiedSpeciesEntries/);
    assert.doesNotMatch(speciesPage, /getDatabaseSpeciesEntries/);
    assert.doesNotMatch(speciesPage, /getPrincipleHubBySlug/);
    assert.doesNotMatch(speciesPage, /getDiscoverCaptureById/);
    assert.doesNotMatch(speciesPage, /getAutomaticRelatedSpecies/);
    assert.match(catalog, /getSpeciesPageData/);
    assert.match(catalog, /fetchSingleSpeciesFromCatalog/);
    assert.match(catalog, /catalog_status === "hidden"/);
    assert.match(catalog, /animalDexNumber < 1/);
    assert.match(catalog, /fetchCanonicalIdentityAlias/);
    assert.match(catalog, /depth < 3/);
    assert.match(catalog, /MAX_FETCH_PAGES = 40/);
    assert.doesNotMatch(catalog, /getDatabaseSpeciesEntries\(\);\s*\n\s*return cached/);
    assert.match(images, /primarySpeciesCaptureMatchCandidate/);
    assert.match(rankings, /primarySpeciesCaptureMatchCandidate/);
    assert.match(growth, /createSupabasePublicClient/);
    assert.match(growth, /principle\?:/);
});

test("public species pages do not read the authenticated viewer on the server", () => {
    const speciesPage = read("app/[locale]/(composited)/animals/[slug]/page.tsx");
    const growth = read("data/species-growth.ts");
    const comparisonPage = read("app/[locale]/(composited)/comparisons/[slug]/page.tsx");

    assert.match(speciesPage, /includeAuthenticatedViewer: false/);
    assert.doesNotMatch(speciesPage, /generate-applied-insight/);
    assert.doesNotMatch(speciesPage, /getViewerUserId/);
    assert.match(speciesPage, /SpeciesAskAnimalDex/);
    assert.match(growth, /includeAuthenticatedViewer/);
    assert.doesNotMatch(comparisonPage, /getViewerUserId/);
    assert.doesNotMatch(comparisonPage, /readGuestKey/);
    assert.match(comparisonPage, /export const revalidate = 300/);
    assert.match(comparisonPage, /generateStaticParams/);
    assert.match(comparisonPage, /getComparisonPageData/);
    assert.doesNotMatch(comparisonPage, /getUnifiedSpeciesEntries/);
    assert.doesNotMatch(comparisonPage, /listMergedChallengeEntries/);
    assert.match(read("data/comparison-animals.ts"), /getResolvedSpeciesBySlug/);
    assert.doesNotMatch(
        read("data/comparison-animals.ts").slice(
            read("data/comparison-animals.ts").indexOf("export async function findComparableAnimal"),
            read("data/comparison-animals.ts").indexOf("export async function isComparableAnimalSlug")
        ),
        /getUnifiedSpeciesEntries|getIndex\(/
    );
    assert.match(read("data/species-comparisons.ts"), /export async function getComparisonPageData/);
    assert.match(read("data/species-comparisons.ts"), /reversedStatic/);
    assert.doesNotMatch(
        read("data/species-comparisons.ts").slice(
            read("data/species-comparisons.ts").indexOf("export async function getRelatedMergedChallenges"),
            read("data/species-comparisons.ts").indexOf("export async function getMergedChallengesForSpecies")
        ),
        /listMergedChallengeEntries|fetchAllSpeciesComparisons/
    );
});
