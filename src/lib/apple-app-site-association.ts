/**
 * iOS Universal Links: the `applinks` the site serves at
 * `/.well-known/apple-app-site-association`, so links to animaldex.app open
 * the app when it is installed (and the page otherwise).
 *
 * Paths, in order (iOS takes the first match):
 * - `/u/*`: public collector cards, and `/u/{handle}/ark` (Ark 3.3);
 * - `/p/*`: shared Discover posts;
 * - `/ark`, `/ark/*` (with `?focus=` passed through): the shared Ark (Ark 3.3,
 *   docs/ark-next.md Part 3), and its Indonesian twins under `/id/`, which
 *   the apps read as the same place.
 *
 * Android verifies the whole domain from `assetlinks.json` (lib/assetlinks);
 * which paths it opens is the app's own intent filter.
 */

/** The non-default locales the site prefixes (`src/i18n.ts`); English has no prefix. */
export const PREFIXED_LOCALES = ["id"] as const;

export const ARK_APP_LINK_PATHS = ["/ark", "/ark/*", "/u/*/ark"] as const;

export function appleApplicationId(env: {applicationId?: string; teamId?: string; bundleId?: string}): string {
    const direct = env.applicationId?.trim();
    if (direct) return direct;
    const team = env.teamId?.trim();
    const bundle = env.bundleId?.trim();
    return team && bundle ? `${team}.${bundle}` : "U87CQY25JC.com.lennybeadle.animaldexios";
}

type Component = {"/": string; comment: string};

export function appleAppSiteAssociation(applicationId: string) {
    const ark: Component[] = ARK_APP_LINK_PATHS.flatMap((path) => [
        {"/": path, comment: "Open the shared Ark in the app (Ark 3.3)."},
        ...PREFIXED_LOCALES.map((locale) => ({"/": `/${locale}${path}`, comment: "Open the shared Ark in the app (Ark 3.3), from a localized page."}))
    ]);
    const components: Component[] = [
        {"/": "/u/*", comment: "Open public AnimalDex collector cards in the app."},
        {"/": "/p/*", comment: "Open shared AnimalDex discover posts in the app."},
        ...ark
    ];
    return {applinks: {apps: [] as string[], details: [{appIDs: [applicationId], components}]}};
}
