import {Metadata} from "next";
import {notFound} from "next/navigation";
import BlogPostPage from "@/app/[locale]/(composited)/blog/[slug]/page";
import {getBlogPost} from "@/data/blog";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";

const SLUG = "capture-animals-app";
const PATHNAME = "/capture-animals-app";

type CaptureAnimalsAppPageProps = {
    params: {
        locale: string;
    };
};

export async function generateMetadata({params}: CaptureAnimalsAppPageProps): Promise<Metadata> {
    const {locale} = params;
    const post = getBlogPost(SLUG);

    if (!post) {
        return {};
    }

    return buildContentMetadata({
        locale,
        pathname: PATHNAME,
        title: post.title,
        description: post.description,
        keywords: [...post.searchIntents, ...post.tags],
        featuredImage: post.featuredImage,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        tags: post.tags,
        canonicalUrl: getAbsoluteUrl(locale, PATHNAME)
    });
}

export default async function CaptureAnimalsAppPage({params}: CaptureAnimalsAppPageProps) {
    const post = getBlogPost(SLUG);

    if (!post) {
        notFound();
    }

    return BlogPostPage({params: {locale: params.locale, slug: SLUG}});
}
