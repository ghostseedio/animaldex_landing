import {getIndexedBlogPosts} from "@/data/blog";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl} from "@/lib/site";

type RouteContext = {
    params: {
        locale: string;
    };
};

function escapeXml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export async function GET(_: Request, {params}: RouteContext) {
    const locale = localeConfig.locales.includes(params.locale) ? params.locale : localeConfig.defaultLocale;
    const feedUrl = getAbsoluteUrl(locale, "/blog/feed.xml");
    const blogUrl = getAbsoluteUrl(locale, "/blog");

    const items = getIndexedBlogPosts()
        .map((post) => {
            const postUrl = getAbsoluteUrl(locale, `/blog/${post.slug}`);
            const pubDate = new Date(post.publishedAt).toUTCString();
            const category = post.tags[0] || "AnimalDex";

            return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <description>${escapeXml(post.description)}</description>
          <link>${postUrl}</link>
          <guid>${postUrl}</guid>
          <pubDate>${pubDate}</pubDate>
          <category>${escapeXml(category)}</category>
        </item>`;
        })
        .join("");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AnimalDex Blog</title>
    <description>Animal discovery guides, wildlife spotting tips, and collection strategy from AnimalDex.</description>
    <link>${blogUrl}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <language>${locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

    return new Response(rss, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
        }
    });
}
