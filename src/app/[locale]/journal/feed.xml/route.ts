import {journalPosts} from "@/data/journal";
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
    const feedUrl = getAbsoluteUrl(locale, "/journal/feed.xml");
    const journalUrl = getAbsoluteUrl(locale, "/journal");

    const items = journalPosts
        .map((post) => {
            const postUrl = getAbsoluteUrl(locale, `/journal/${post.slug}`);
            return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <description>${escapeXml(post.description)}</description>
          <link>${postUrl}</link>
          <guid>${postUrl}</guid>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
          <category>${escapeXml(post.pillar)}</category>
        </item>`;
        })
        .join("");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AnimalDex Journal</title>
    <description>Fresh animal learning, spotting, collecting, and field-guide updates from AnimalDex.</description>
    <link>${journalUrl}</link>
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
