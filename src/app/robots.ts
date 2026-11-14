import {MetadataRoute} from "next";
import {getSiteUrl} from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            // /api/og/: the share-card images pages name as og:image (/ark's among them). Twitterbot obeys
            // robots.txt, so a disallowed card image showed no picture; the longer allow rule wins over /api/.
            allow: ["/", "/api/og/"],
            // Operator tooling. The pages already require a session and carry
            // noindex; this keeps crawlers off the paths as well, so the admin
            // surface is not advertised by a robots.txt fetch.
            // /compare: on-demand comparisons for pairs not yet published as
            // static pages (noindex; each view reads the database).
            // /api/: JSON, streams and share-card images, never a page. Search
            // Console (Nov 2026) had 647 of 1,000 sampled crawled-not-indexed
            // URLs under /api; next.config.js also marks every /api response
            // noindex, nofollow.
            disallow: ["/admin", "/api/admin", "/app", "/api/app", "/api/", "/compare/"]
        },
        sitemap: [`${getSiteUrl()}/sitemap.xml`, `${getSiteUrl()}/video-sitemap.xml`]
    };
}
