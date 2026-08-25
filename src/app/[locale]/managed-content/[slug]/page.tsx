import {Metadata} from "next";
import {notFound} from "next/navigation";
import {getManagedPage} from "@/lib/admin-content";
import {buildContentMetadata} from "@/lib/content-metadata";
import ManagedContentRenderer from "@/app/[locale]/_components/managed-content-renderer";

type ManagedPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

export async function generateMetadata({params}: ManagedPageProps): Promise<Metadata> {
    const page = await getManagedPage(params.slug);
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

export default async function ManagedRoutePage({params}: ManagedPageProps) {
    const page = await getManagedPage(params.slug);
    if (!page) notFound();

    return <ManagedContentRenderer locale={params.locale} page={page} />;
}

export const revalidate = 300;
export const dynamicParams = true;
