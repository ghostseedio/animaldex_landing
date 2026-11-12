import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {AppCreditsProvider} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {PostShareBand, PostSharePanel, type PostShareLabels} from "@/app/[locale]/p/[postId]/post-share-cta";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import ShareReferralCapture from "@/components/store/share-referral-capture";
import {getDiscoverPostById} from "@/data/discover-timeline";
import {discoverPostJsonLd, discoverPostSeoFields} from "@/lib/discover-post-seo";
import {getSpeciesImageRoute} from "@/data/species-images";
import {
    discoverPostAnimal,
    discoverPostPath,
    normalizeDiscoverPostId,
    parseDiscoverPostId
} from "@/lib/discover-post";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type DiscoverPostPageProps = {
    params: {locale: string; postId: string};
};

/**
 * Search and link previews name the animal, never the person or the place (owner decision 247):
 * `discoverPostSeoFields`. The page below, for people who open the link, is unchanged.
 */
const postSeoFields = discoverPostSeoFields;

export async function generateMetadata({params}: DiscoverPostPageProps): Promise<Metadata> {
    const rawPostId = normalizeDiscoverPostId(params.postId);
    if (!rawPostId || !parseDiscoverPostId(rawPostId)) return {};

    const post = await getDiscoverPostById(rawPostId);
    if (!post) return {};

    const seo = postSeoFields(post);
    const pathname = discoverPostPath(post.id);
    const url = getAbsoluteUrl(params.locale, pathname);
    const imageUrl = getAbsoluteAssetUrl(seo.imageSrc);

    return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords,
        alternates: {canonical: getLocalePath(params.locale, pathname)},
        robots: {index: true, follow: true},
        other: {
            "apple-itunes-app": `app-id=6761607780, app-argument=${url}`
        },
        appLinks: {
            ios: {url, app_store_id: "6761607780", app_name: "AnimalDex"},
            android: {url, package: "app.animaldex", app_name: "AnimalDex"}
        },
        openGraph: {
            type: seo.video ? "video.other" : "article",
            url,
            title: seo.title,
            description: seo.description,
            siteName: "AnimalDex",
            publishedTime: seo.publishedAt,
            images: [{url: imageUrl, alt: seo.title}],
            videos: seo.video
                ? [{url: getAbsoluteAssetUrl(seo.video.url), type: seo.video.mimeType ?? undefined}]
                : undefined
        },
        twitter: {
            card: seo.video ? "player" : "summary_large_image",
            title: seo.title,
            description: seo.description,
            images: [imageUrl]
        }
    };
}

export default async function DiscoverPostPage({params}: DiscoverPostPageProps) {
    const rawPostId = normalizeDiscoverPostId(params.postId);
    const parsed = parseDiscoverPostId(rawPostId);
    if (!parsed) notFound();

    const post = await getDiscoverPostById(parsed.postId);
    if (!post) notFound();

    if (rawPostId !== post.id) {
        redirect(getLocalePath(params.locale, discoverPostPath(post.id)));
    }

    const seo = postSeoFields(post);
    const pageUrl = getAbsoluteUrl(params.locale, discoverPostPath(post.id));
    const imageUrl = getAbsoluteAssetUrl(seo.imageSrc);
    const videoUrl = seo.video ? getAbsoluteAssetUrl(seo.video.url) : null;

    const jsonLd = discoverPostJsonLd(seo, {pageUrl, imageUrl, videoUrl, siteUrl: getAbsoluteUrl(params.locale)});

    // Somebody who opened a shared link: the app, and the animal's own page and voice.
    const animal = discoverPostAnimal(post);
    const [t, askT, animalsT] = await Promise.all([
        getScopedTranslator(params.locale, "post"),
        getScopedTranslator(params.locale, "askAnimalDex"),
        getScopedTranslator(params.locale, "animals")
    ]);
    const shareLabels: PostShareLabels = {
        sharedFrom: t("sharedFrom"),
        appLine: t("appLine"),
        speak: animal ? askT("speakLauncher").replace("{animal}", animal.name) : "",
        moreAbout: animal ? t("moreAbout", {animal: animal.name}) : "",
        getApp: animalsT("getAnimalDex"),
        fieldGuide: animalsT("tabGuide")
    };
    // The animal's face in its chat is its icon art, never a capture photo.
    const shareAnimal = animal ? {...animal, avatarUrl: getSpeciesImageRoute(animal.slug)} : null;

    return (
        <AppCreditsProvider initialBalance={null}>
            <AppShell
                profile={null}
                isAuthenticated={false}
                unreadCount={0}
                unreadMessageCount={0}
                hydrateFromSession
            >
                {/* The feed rewrites the URL as it scrolls, so a shared `?ref=` is kept now. */}
                <ShareReferralCapture />
                {animal ? (
                    <AskSubjectBridge
                        scope="species"
                        slug={animal.slug}
                        name={animal.name}
                        title={animal.name}
                        avatarUrl={getSpeciesImageRoute(animal.slug)}
                    />
                ) : null}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd).replace(/</g, "\\u003c")}}
                />
                <DiscoverHome
                    locale={params.locale}
                    timeline={[post]}
                    timelineCursor={null}
                    featured={[]}
                    collectors={[]}
                    initialFocusPostId={post.id}
                    syncPostUrls
                    viewerUserId={null}
                    hydrateSignedInFeed
                    shareBand={<PostShareBand labels={shareLabels} animal={shareAnimal} />}
                    sharePanel={<PostSharePanel labels={shareLabels} animal={shareAnimal} />}
                />
            </AppShell>
        </AppCreditsProvider>
    );
}
