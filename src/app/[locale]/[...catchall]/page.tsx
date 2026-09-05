import {Metadata} from "next";
import {notFound} from "next/navigation";
import {getManagedPage} from "@/lib/admin-content";
import {CLOSED_SEO_NAMESPACE_FAMILIES} from "@/lib/english-detail-routes";
import {shouldLookupPublishedManagedPage} from "@/lib/managed-page-slugs";
import {buildContentMetadata} from "@/lib/content-metadata";
import ManagedContentRenderer from "@/app/[locale]/_components/managed-content-renderer";

type ManagedPageProps = {
    params: {locale: string; catchall: string[]};
};

async function resolvePage(params: ManagedPageProps["params"]) {
    // Closed SEO namespaces must never become CMS vanity lookups, even if
    // middleware is skipped. Unknown /animals/foo is a cheap 404, not catchall.
    if ((CLOSED_SEO_NAMESPACE_FAMILIES as readonly string[]).includes(params.catchall[0] ?? "")) {
        return null;
    }
    if (params.catchall.length !== 1) return null;
    const slug = params.catchall[0];
    if (!shouldLookupPublishedManagedPage(slug)) return null;
    return getManagedPage(slug);
}

export async function generateMetadata({params}: ManagedPageProps): Promise<Metadata> {
    const page = await resolvePage(params);
    if (!page) return {};

    return buildContentMetadata({
        locale: params.locale,
        pathname: `/${page.slug}`,
        title: page.title,
        description: page.description,
        keywords: [...page.searchIntents, ...page.tags],
        featuredImage: page.featuredImage,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
        tags: page.tags,
        canonicalUrl: page.canonicalUrl
    });
}

export default async function ManagedContentPage({params}: ManagedPageProps) {
    const page = await resolvePage(params);
    if (!page) notFound();

    return ManagedContentRenderer({locale: params.locale, page});
}

export const revalidate = 86400;
export const dynamicParams = true;
