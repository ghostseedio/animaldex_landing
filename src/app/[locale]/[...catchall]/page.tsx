import {Metadata} from "next";
import {notFound} from "next/navigation";
import {getManagedPage} from "@/lib/admin-content";
import {buildContentMetadata} from "@/lib/content-metadata";
import ManagedContentRenderer from "@/app/[locale]/_components/managed-content-renderer";

type ManagedPageProps = {
    params: {locale: string; catchall: string[]};
};

async function resolvePage(params: ManagedPageProps["params"]) {
    if (params.catchall.length !== 1) return null;
    return getManagedPage(params.catchall[0]);
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

    return <ManagedContentRenderer locale={params.locale} page={page} />;
}

export const dynamic = "force-dynamic";
