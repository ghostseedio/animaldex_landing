const path = require("path");
const withNextIntl = require('next-intl/plugin')();
const closedSeoNamespaceSlugs = require("./src/data/closed-seo-namespace-slugs.json");
const renamedSpeciesSlugs = require("./src/data/renamed-species-slugs.json");

// Mirrors src/lib/comparison-slug.ts, which next.config.js cannot import.
const COMPARISON_TYPE_SUFFIXES = ["speed", "strength", "intelligence", "stealth", "durability", "agility"];

function reversedComparisonSlug(slug) {
    for (const type of COMPARISON_TYPE_SUFFIXES) {
        const suffix = `-${type}`;
        if (slug.endsWith(suffix)) {
            const [a, b] = slug.slice(0, -suffix.length).split("-vs-");
            return a && b ? `${b}-vs-${a}${suffix}` : null;
        }
    }
    const [a, b] = slug.split("-vs-");
    return a && b ? `${b}-vs-${a}` : null;
}

/**
 * `/comparisons/cheetah-vs-leopard` → `/comparisons/leopard-vs-cheetah`.
 *
 * Comparison pages are a closed SSG namespace (`dynamicParams = false`), so a
 * reversed pair order 404s before the page's own redirect can run. Every
 * published slug whose reverse is not itself published gets a redirect here,
 * for both the bare and the `/id` URL.
 */
function reversedComparisonRedirects() {
    const published = new Set(closedSeoNamespaceSlugs.comparisons ?? []);
    const redirects = [];
    for (const slug of published) {
        const reversed = reversedComparisonSlug(slug);
        if (!reversed || published.has(reversed)) continue;
        for (const prefix of ["", "/id"]) {
            redirects.push({
                source: `${prefix}/comparisons/${reversed}`,
                destination: `/comparisons/${slug}`,
                permanent: true
            });
        }
    }
    return redirects;
}

if (process.env.NEXT_PHASE === "phase-production-build" || process.argv.includes("build")) {
    process.env.ADEX_SEO_SSG_NO_REMOTE = "1";
}

module.exports = withNextIntl({
    output: 'standalone',
    // No X-Powered-By: Next.js on every response (WEB-22).
    poweredByHeader: false,
    // Stable SEO pages SSG from checked-in snapshots. Sitemap stays a
    // request-time route so it does not block static generation.
    staticPageGenerationTimeout: 600,
    experimental: {
        // Keep sharp as a native Node dependency so /api/admin/assets can boot on Vercel.
        // satori (share cards, /api/og) loads its yoga layout wasm at runtime; keep it unbundled.
        serverComponentsExternalPackages: ["sharp", "satori"],
        // src/instrumentation.ts: logs every paid AI call for /admin/ai-spend.
        instrumentationHook: true
    },
    async redirects() {
        return [
            // Do NOT add /en → unprefixed redirects here. next-intl `as-needed`
            // rewrites unprefixed English to /en/... internally; a config
            // redirect on /en/:path* then 308s back to the same public URL
            // (self-redirect loop on standalone / next start). Middleware
            // collapses external /en URLs with 308 instead.
            {
                source: "/privacy",
                destination: "/legal/privacy",
                permanent: true
            },
            {
                source: "/terms",
                destination: "/legal/terms",
                permanent: true
            },
            // Oct 2026 rename: Animal Lessons → Animal Powers, Animal Powers
            // (traits) → Animal Qualities, Animal Behaviours → Animal
            // Frequencies, Challenge Yourself → Animal Trials. Each old URL
            // lands on its final destination in one hop.
            // Lesson detail pages are English-only (see the /id/...:slug block below).
            {
                source: "/id/animal-lessons/:slug",
                destination: "/animal-powers/:slug",
                permanent: true
            },
            // The Hybrid Lab used to page on the client at ?page=<n>; shared links
            // land on the matching /page/<n> URL now.
            ...["", "/id"].map((prefix) => ({
                source: `${prefix}/animal-hybrids`,
                has: [{type: "query", key: "page", value: "(?<page>[2-9]|[1-9]\\d+)"}],
                destination: `${prefix}/animal-hybrids/page/:page`,
                permanent: true
            })),
            // Page 1 of a paged hub (src/data/hub-pagination.ts) is the hub itself.
            ...[
                ["/animal-trials", "/animal-trials"],
                ["/animal-frequencies", "/animal-frequencies"],
                ["/tier-list", "/tier-list"],
                ["/animal-hybrids", "/animal-hybrids"],
                ["/challenge-yourself", "/animal-trials"],
                ["/animal-behaviours", "/animal-frequencies"]
            ].flatMap(([from, to]) => ["", "/id"].map((prefix) => ({
                source: `${prefix}${from}/page/1`,
                destination: `${prefix}${to}`,
                permanent: true
            }))),
            ...[
                ["/animal-meanings", "/animal-powers"],
                ["/animal-lessons", "/animal-powers"],
                ["/powers", "/qualities"],
                ["/principles", "/qualities"],
                ["/animal-behaviours", "/animal-frequencies"],
                ["/challenge-yourself", "/animal-trials"]
            ].flatMap(([from, to]) => ["", "/id"].flatMap((prefix) => [
                {source: `${prefix}${from}`, destination: `${prefix}${to}`, permanent: true},
                {source: `${prefix}${from}/:path*`, destination: `${prefix}${to}/:path*`, permanent: true}
            ])),
            // Oct 2026: Wildlife Guides are virtual only. The in-person experiences
            // directory and the seller application are gone; their indexed URLs
            // land on the virtual guides list in one hop.
            ...["/wildlife-experiences", "/become-a-wildlife-guide"].flatMap((from) => ["", "/id"].flatMap((prefix) => [
                {source: `${prefix}${from}`, destination: `${prefix}/wildlife-guides`, permanent: true},
                {source: `${prefix}${from}/:path*`, destination: `${prefix}/wildlife-guides`, permanent: true}
            ])),
            // 3.2: Debates replaced battles; the battles use case is the debates one.
            ...["", "/id"].map((prefix) => ({
                source: `${prefix}/use-cases/species-collecting-game-battles-trading-app`,
                destination: `${prefix}/use-cases/species-collecting-game-debates-trading-app`,
                permanent: true
            })),
            ...reversedComparisonRedirects(),
            // "tiger vs cheetah" has no battle page yet; the speed matchup is the
            // closest published answer (Search Console, Oct 2026).
            ...["", "/id"].map((prefix) => ({
                source: `${prefix}/comparisons/tiger-vs-cheetah`,
                destination: "/comparisons/tiger-vs-cheetah-speed",
                permanent: true
            })),
            // Indexed catalog species the collection alias table folds into a
            // parent species: they share its page instead of 404ing. Plus
            // species whose published slug was renamed or merged in a snapshot
            // refresh (lutra-lutra → european-otter), kept by
            // scripts/refreshRenamedSpeciesSlugs.mts.
            ...[
                ["african-lion", "lion"],
                ["egyptian-spiny-tailed-lizard", "spiny-tailed-lizard"],
                ...Object.entries(renamedSpeciesSlugs.redirects ?? {})
            ].flatMap(([from, to]) => ["", "/id"].map((prefix) => ({
                source: `${prefix}/animals/${from}`,
                destination: `/animals/${to}`,
                permanent: true
            }))),
            // Indexed misspellings of the mating-drive tier list (Search Console, Oct 2026).
            ...[
                "animals-highest-mating-drive",
                "animals-with-highest-le-mating-drive",
                "animals-highest-mating-drive-top-100-ranked",
                "animals-with-highest-mouse-mating-drive"
            ].flatMap((slug) => ["", "/id"].map((prefix) => ({
                source: `${prefix}/tier-list/${slug}`,
                destination: "/tier-list/animals-with-highest-mating-drive",
                permanent: true
            }))),
            {
                source: "/rankings",
                destination: "/tier-list",
                permanent: true
            },
            {
                source: "/rankings/:path*",
                destination: "/tier-list/:path*",
                permanent: true
            },
            {
                source: "/id/rankings",
                destination: "/id/tier-list",
                permanent: true
            },
            {
                // Straight to English: /id/tier-list/<slug> itself 308s there.
                source: "/id/rankings/:path*",
                destination: "/tier-list/:path*",
                permanent: true
            },
            {
                source: "/id/tier-list/:slug",
                destination: "/tier-list/:slug",
                permanent: true
            },
            {
                source: "/id/animals/:slug",
                destination: "/animals/:slug",
                permanent: true
            },
            {
                source: "/id/animal-powers/:slug",
                destination: "/animal-powers/:slug",
                permanent: true
            },
            {
                source: "/id/pokemon-animals/:slug",
                destination: "/pokemon-animals/:slug",
                permanent: true
            },
            {
                source: "/id/animal-hybrids/:slug",
                destination: "/animal-hybrids/:slug",
                permanent: true
            },
            {
                source: "/id/comparisons/:slug",
                destination: "/comparisons/:slug",
                permanent: true
            },
            {
                source: "/journal",
                destination: "/blog",
                permanent: true
            },
            {
                source: "/journal/feed.xml",
                destination: "/blog/feed.xml",
                permanent: true
            },
            {
                source: "/journal/how-to-identify-animals-from-a-photo",
                destination: "/blog/how-to-identify-animals-in-the-wild-2026-guide",
                permanent: true
            },
            {
                source: "/journal/:slug",
                destination: "/blog/:slug",
                permanent: true
            },
            {
                source: "/id/journal",
                destination: "/id/blog",
                permanent: true
            },
            {
                source: "/id/journal/feed.xml",
                destination: "/id/blog/feed.xml",
                permanent: true
            },
            {
                source: "/id/journal/how-to-identify-animals-from-a-photo",
                destination: "/id/blog/how-to-identify-animals-in-the-wild-2026-guide",
                permanent: true
            },
            {
                source: "/id/journal/:slug",
                destination: "/id/blog/:slug",
                permanent: true
            },
            {
                source: "/blog/legendary-earth-beasts",
                destination: "/legendary-earth-beasts",
                permanent: true
            },
            {
                source: "/id/blog/legendary-earth-beasts",
                destination: "/id/legendary-earth-beasts",
                permanent: true
            },
            {
                source: "/blog/capture-animals-app",
                destination: "/capture-animals-app",
                permanent: true
            },
            {
                source: "/id/blog/capture-animals-app",
                destination: "/id/capture-animals-app",
                permanent: true
            },
            {
                source: "/animal-identification-app",
                destination: "/animal-identifier-app",
                permanent: true
            },
            {
                source: "/id/animal-identification-app",
                destination: "/id/animal-identifier-app",
                permanent: true
            },
            {
                source: "/ai-animal-scanner",
                destination: "/animal-identifier-app",
                permanent: true
            },
            {
                source: "/id/ai-animal-scanner",
                destination: "/id/animal-identifier-app",
                permanent: true
            },
            {
                source: "/use-cases/ai-animal-scanner-identification-app",
                destination: "/animal-identifier-app",
                permanent: true
            },
            {
                source: "/id/use-cases/ai-animal-scanner-identification-app",
                destination: "/id/animal-identifier-app",
                permanent: true
            },
            {
                source: "/real-life-pokedex",
                destination: "/pokemon-like-animal-game",
                permanent: true
            },
            {
                source: "/id/real-life-pokedex",
                destination: "/id/pokemon-like-animal-game",
                permanent: true
            },
            {
                source: "/wildlife-spotting-app",
                destination: "/collect-real-animals-app",
                permanent: true
            },
            {
                source: "/id/wildlife-spotting-app",
                destination: "/id/collect-real-animals-app",
                permanent: true
            }
        ];
    },
    async headers() {
        // Baseline security headers for every response. CSP is intentionally
        // left out here: a wrong policy breaks GA, Supabase and Next's inline
        // runtime, so it should be rolled out separately in report-only first.
        const securityHeaders = [
            {key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload"},
            {key: "X-Content-Type-Options", value: "nosniff"},
            {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
            {key: "X-Frame-Options", value: "SAMEORIGIN"},
            // The web app uses the camera and microphone for in-browser capture
            // and geolocation for nearby wildlife, so these stay allowed for
            // same-origin; only the Topics API is switched off.
            {key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), browsing-topics=()"}
        ];

        return [
            {
                source: "/:path*",
                headers: securityHeaders
            },
            // The operations panel is never a search result or a shared cache
            // entry, whatever a page's own metadata says.
            ...["/admin", "/admin/:path*", "/api/admin/:path*"].map((source) => ({
                source,
                headers: [
                    {key: "X-Robots-Tag", value: "noindex, nofollow"},
                    {key: "Cache-Control", value: "private, no-store"}
                ]
            })),
            // No /api response is a page: JSON, streams, redirects and the
            // share-card images under /api/og. robots.ts disallows the prefix;
            // this covers anything a crawler already holds a link to (Search
            // Console, Nov 2026: 647 of 1,000 sampled crawled-not-indexed URLs
            // were /api). Handlers that set their own X-Robots-Tag keep it.
            {
                source: "/api/:path*",
                headers: [{key: "X-Robots-Tag", value: "noindex, nofollow"}]
            },
            // Signed-in and per-person pages (WEB-22). Next sends no Cache-Control
            // on these dynamic routes, and a CDN rule that caches HTML would then
            // fall back to its own default TTL and could serve one person's page
            // to another. Say it outright: never stored in a shared cache.
            ...[
                "/app", "/app/:path*", "/id/app", "/id/app/:path*",
                "/account", "/account/:path*", "/id/account", "/id/account/:path*",
                "/auth/:path*", "/checkout", "/checkout/:path*", "/id/checkout", "/id/checkout/:path*"
                // API routes set their own Cache-Control (the chat stream needs no-transform).
            ].map((source) => ({
                source,
                headers: [{key: "Cache-Control", value: "private, no-store"}]
            })),
            {
                // Static art under /public/images is not content-hashed, so keep
                // a one-week browser TTL with a long stale-while-revalidate
                // window rather than `immutable`. Lighthouse flags the current
                // 4h TTL as too short for these assets.
                source: "/images/:path*",
                headers: [
                    {key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000"}
                ]
            },
            {
                // The Ark's poster frames (the first thing /ark and the apps' Ark panel show while the world loads):
                // the same week, as they change only when re-rendered.
                source: "/ark/poster/:path*",
                headers: [
                    {key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000"}
                ]
            },
            // The Ark's scenery (trees, rocks, plants and forest floor: 308 small .glb files on a visit), its ground and
            // town textures, the sky and the texture transcoder. Next serves /public with `max-age=0`, and the CDN keeps
            // none of these types by default, so every visit asked the origin about every one of them again (measured
            // on the live site, a phone profile: 308 conditional requests on a second visit, the first frame no sooner
            // than on the first). They are not content-hashed and are redrawn in place now and then, so a day in the
            // browser and a month stale-while-revalidate rather than `immutable`: a returning reader (and the apps'
            // panel every time it opens) reads them from its own cache, and a changed file reaches them within a day.
            ...["/ark/assets/:path*", "/ark/graphics/:path*", "/ark/basis/:path*", "/ark/sound/:path*"].map((source) => ({
                source,
                headers: [
                    {key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000"}
                ]
            })),
            {
                // The positions atlas is asked for by its content hash (`?v=`, src/ark-scene/hunting.ts): the same
                // address is the same bytes for good.
                source: "/ark/positions-atlas.json",
                has: [{type: "query", key: "v"}],
                headers: [
                    {key: "Cache-Control", value: "public, max-age=31536000, immutable"}
                ]
            }
        ];
    },
    async rewrites() {
        return [
            {
                source: "/.well-known/apple-app-site-association",
                destination: "/api/apple-app-site-association"
            },
            {
                source: "/.well-known/assetlinks.json",
                destination: "/api/assetlinks"
            }
        ];
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            "react$": path.resolve(__dirname, "src/lib/react-with-cache.ts"),
        };
        config.module.rules.push({
            test: /\.md$/,
            use: 'raw-loader',
        });
        return config;
    },
    images: {
        // WebP only. AVIF is ~20% smaller for photographic content, but the
        // first encode of each variant measured 4-5x slower than WebP
        // (0.62 s vs 0.13 s for one 828 px variant on an M-series Mac, i.e.
        // multiple seconds on the 2 vCPU e2-small origin): a blog hero LCP
        // image took 7 s to load in production. WebP keeps the optimizer
        // cheap enough for a cold cache on this VM.
        formats: ['image/webp'],
        // Supabase storage answers with max-age=3600 (or no-cache), so without
        // a floor the optimizer re-fetched and re-encoded every variant at
        // least hourly. Image content is content-addressed or rarely changes,
        // so cache optimized variants for 30 days.
        minimumCacheTTL: 2592000,
        deviceSizes: [640, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'wwhsdzpczekgdlobwaej.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'static.wikia.nocookie.net',
            },
            {
                protocol: 'https',
                hostname: 'static0.thegamerimages.com',
            },
            {
                protocol: 'https',
                hostname: 'www.dexerto.com',
            },
            {
                protocol: 'https',
                hostname: 'comicbook.com',
            },
            {
                protocol: 'https',
                hostname: 'www.pokemon.com',
            },
            {
                protocol: 'https',
                hostname: 'media.tenor.com',
            },
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
            {
                protocol: 'https',
                hostname: 'img.jakpost.net',
            },
            {
                protocol: 'https',
                hostname: 'miro.medium.com',
            },
            {
                protocol: 'https',
                hostname: 'www.ujungkulon.net',
            },
            {
                protocol: 'https',
                hostname: 'thesevenseas.net',
            },
            {
                protocol: 'https',
                hostname: 'www.indonesia.travel',
            },
            {
                protocol: 'https',
                hostname: 'upload.wikimedia.org',
            },
            {
                protocol: 'https',
                hostname: 'www.regent-holidays.co.uk',
            },
            {
                protocol: 'https',
                hostname: 'a-z-animals.com',
            },
            {
                protocol: 'https',
                hostname: 'p.potaufeu.asahi.com',
            },
            {
                protocol: 'https',
                hostname: 'www.medibank.com.au',
            },
            {
                protocol: 'https',
                hostname: 'brazilgreentravel.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.wisemove.ca',
            },
            {
                protocol: 'https',
                hostname: 'j6m3f5v5.delivery.rocketcdn.me',
            },
            {
                protocol: 'https',
                hostname: 'images.christineabroad.com',
            },
            {
                protocol: 'https',
                hostname: 'www.machutravelperu.com',
            },
            {
                protocol: 'https',
                hostname: 'cheetahsafaris.com',
            },
            {
                protocol: 'https',
                hostname: 'encrypted-tbn0.gstatic.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.kimkim.com',
            },
            {
                protocol: 'https',
                hostname: 's7g10.scene7.com',
            },
            {
                protocol: 'https',
                hostname: 'a.storyblok.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn-imgix.headout.com',
            },
            {
                protocol: 'https',
                hostname: 'www.outlooktravelmag.com',
            },
            {
                protocol: 'https',
                hostname: 'www.nwf.org',
            },
            {
                protocol: 'https',
                hostname: 'chameleons101.com',
            },
            {
                protocol: 'https',
                hostname: 'plunketts.net',
            },
            {
                protocol: 'https',
                hostname: 'd4g0cdul6yygp.cloudfront.net',
            },
            {
                protocol: 'https',
                hostname: 'www.worldatlas.com',
            },
            {
                protocol: 'https',
                hostname: 'blog.padi.com',
            },
            {
                protocol: 'https',
                hostname: 'www.goeco.org',
            },
            {
                protocol: 'https',
                hostname: 'media.gadventures.com',
            },
            {
                protocol: 'https',
                hostname: 'www.campervaniceland.com',
            },
            {
                protocol: 'https',
                hostname: 'www.visitdubai.com',
            },
            {
                protocol: 'https',
                hostname: 'www.leonetwork.org',
            },
            {
                protocol: 'https',
                hostname: 'www.envpk.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.britannica.com',
            },
            {
                protocol: 'https',
                hostname: 'www.balitecturerealty.com',
            },
        ],
        dangerouslyAllowSVG: true
    }
});
