const path = require("path");
const withNextIntl = require('next-intl/plugin')();

module.exports = withNextIntl({
    // Catalog pages still load the unified species catalog at build time.
    // Sitemap generation is served dynamically via /sitemap.xml so it no longer
    // blocks static page generation during deploys.
    staticPageGenerationTimeout: 180,
    experimental: {
        // Keep sharp as a native Node dependency so /api/admin/assets can boot on Vercel.
        serverComponentsExternalPackages: ["sharp"]
    },
    async redirects() {
        return [
            // next-intl `as-needed` uses 307 for /en → unprefixed English. Google can
            // keep ranking those URLs. Permanent redirects collapse them to the
            // canonical unprefixed paths before locale middleware runs.
            {
                source: "/en",
                destination: "/",
                permanent: true
            },
            {
                source: "/en/:path*",
                destination: "/:path*",
                permanent: true
            },
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
            {
                source: "/animal-meanings",
                destination: "/animal-lessons",
                permanent: true
            },
            {
                source: "/id/animal-meanings",
                destination: "/id/animal-lessons",
                permanent: true
            },
            {
                source: "/principles",
                destination: "/powers",
                permanent: true
            },
            {
                source: "/principles/:path*",
                destination: "/powers/:path*",
                permanent: true
            },
            {
                source: "/id/principles",
                destination: "/id/powers",
                permanent: true
            },
            {
                source: "/id/principles/:path*",
                destination: "/id/powers/:path*",
                permanent: true
            },
            {
                source: "/qualities",
                destination: "/powers",
                permanent: true
            },
            {
                source: "/qualities/:path*",
                destination: "/powers/:path*",
                permanent: true
            },
            {
                source: "/id/qualities",
                destination: "/id/powers",
                permanent: true
            },
            {
                source: "/id/qualities/:path*",
                destination: "/id/powers/:path*",
                permanent: true
            },
            {
                source: "/comparisons/lion-vs-tiger",
                destination: "/comparisons/tiger-vs-lion",
                permanent: true
            },
            {
                source: "/id/comparisons/lion-vs-tiger",
                destination: "/id/comparisons/tiger-vs-lion",
                permanent: true
            },
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
                source: "/id/rankings/:path*",
                destination: "/id/tier-list/:path*",
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
    async rewrites() {
        return [
            {
                source: "/.well-known/apple-app-site-association",
                destination: "/api/apple-app-site-association"
            },
            {
                source: "/.well-known/assetlinks.json",
                destination: "/api/assetlinks"
            },
            {
                source: "/powers",
                destination: "/qualities"
            },
            {
                source: "/powers/:path*",
                destination: "/qualities/:path*"
            },
            {
                source: "/:locale(en|id)/powers",
                destination: "/:locale/qualities"
            },
            {
                source: "/:locale(en|id)/powers/:path*",
                destination: "/:locale/qualities/:path*"
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
