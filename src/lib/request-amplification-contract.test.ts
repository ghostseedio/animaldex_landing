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
    assert.match(supabaseMiddleware, /requestHasSupabaseAuthCookie/);
    assert.match(supabaseMiddleware, /auth\.getUser\(\)/);
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

test("catchall slug routing skips scanner database lookups", () => {
    const catchall = read("app/[locale]/[...catchall]/page.tsx");
    assert.match(catchall, /shouldLookupPublishedManagedPage/);
    assert.match(catchall, /getManagedPage/);
    assert.match(catchall, /export const revalidate = 300/);
    assert.doesNotMatch(catchall, /force-dynamic/);
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
});
