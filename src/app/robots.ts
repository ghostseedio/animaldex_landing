import {MetadataRoute} from "next";
import {getSiteUrl} from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // Operator tooling. The pages already require a session and carry
            // noindex; this keeps crawlers off the paths as well, so the admin
            // surface is not advertised by a robots.txt fetch.
            // /compare: on-demand comparisons for pairs not yet published as
            // static pages (noindex; each view reads the database).
            disallow: ["/admin", "/api/admin", "/app", "/api/app", "/compare/"]
        },
        sitemap: `${getSiteUrl()}/sitemap.xml`
    };
}
