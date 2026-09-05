import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import AppShell from "@/app/[locale]/(authenticated)/app/_components/app-shell";
import {AppCreditsProvider} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getDiscoverPostById, type DiscoverTimelineItem} from "@/data/discover-timeline";
import {
    discoverPostPath,
    discoverPostShareDescription,
    discoverPostShareTitle,
    normalizeDiscoverPostId,
    parseDiscoverPostId
} from "@/lib/discover-post";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getLocalePath} from "@/lib/site";

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type DiscoverPostPageProps = {
    params: {locale: string; postId: string};
};

function postSeoFields(item: DiscoverTimelineItem) {
    if (item.kind === "capture") {
        return {
            title: discoverPostShareTitle({
                kind: item.kind,
                animalName: item.animalName,
                collectorName: item.collector.name,
                contextLabel: item.contextLabel
            }),
            description: discoverPostShareDescription({
                kind: item.kind,
                animalName: item.animalName,
                collectorName: item.collector.name,
                collectorUsername: item.collector.username,
                contextLabel: item.contextLabel,
                locationLabel: item.locationLabel,
                hasVideoMedia: item.hasVideoMedia,
                scientificName: item.scientificName
            }),
            imageSrc: item.imageSrc,
            publishedAt: item.date,
            keywords: [
                item.animalName,
                item.scientificName,
                item.contextLabel ? `${item.animalName} ${item.contextLabel.toLowerCase()}` : null,
                item.contextLabel?.toLowerCase() === "wild" ? `${item.animalName} in the wild` : null,
                item.hasVideoMedia ? `${item.animalName} video` : null,
                "AnimalDex",
                "animal identification"
            ].filter((value): value is string => Boolean(value)),
            video: item.mediaAssets.find((asset) => asset.kind === "video" || asset.kind === "loop") ?? null
        };
    }

    if (item.kind === "alignment") {
        return {
            title: discoverPostShareTitle({
                kind: item.kind,
                animalName: item.rewardedAnimalName,
                collectorName: item.collector.name
            }),
            description: discoverPostShareDescription({
                kind: item.kind,
                animalName: item.rewardedAnimalName,
                collectorName: item.collector.name,
                collectorUsername: item.collector.username
            }),
            imageSrc: item.imageSrc,
            publishedAt: item.date,
            keywords: [item.rewardedAnimalName, "AnimalDex", "daily alignment"],
            video: null
        };
    }

    if (item.kind === "fusion") {
        return {
            title: discoverPostShareTitle({kind: item.kind, collectorName: item.collector.name}),
            description: discoverPostShareDescription({
                kind: item.kind,
                animalName: item.receiverAnimalName,
                collectorName: item.collector.name,
                collectorUsername: item.collector.username
            }),
            imageSrc: item.receiverImageSrc,
            publishedAt: item.date,
            keywords: [item.receiverAnimalName, item.donorAnimalName, "AnimalDex", "principle fusion"].filter(Boolean),
            video: null
        };
    }

    if (item.kind === "challenge") {
        return {
            title: discoverPostShareTitle({
                kind: item.kind,
                collectorName: item.attacker.displayName
            }),
            description: item.activitySummary || discoverPostShareDescription({
                kind: item.kind,
                animalName: item.attacker.animalName,
                collectorName: item.attacker.displayName,
                collectorUsername: item.attacker.username
            }),
            imageSrc: item.attacker.imageSrc,
            publishedAt: item.date,
            keywords: [item.attacker.animalName, item.defender.animalName, "AnimalDex", "challenge"].filter(Boolean),
            video: null
        };
    }

    return {
        title: discoverPostShareTitle({
            kind: item.kind,
            animalName: item.offerer.animalName,
            collectorName: item.offerer.name
        }),
        description: discoverPostShareDescription({
            kind: item.kind,
            animalName: item.offerer.animalName,
            collectorName: item.offerer.name,
            collectorUsername: item.offerer.username
        }),
        imageSrc: item.offerer.imageSrc,
        publishedAt: item.date,
        keywords: [item.offerer.animalName, item.receiver.animalName, "AnimalDex", "trade"].filter(Boolean),
        video: null
    };
}

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

    const jsonLd = [
        {
            "@context": "https://schema.org",
            "@type": "SocialMediaPosting",
            "@id": pageUrl,
            url: pageUrl,
            headline: seo.title,
            datePublished: seo.publishedAt,
            description: seo.description,
            image: imageUrl,
            author: {
                "@type": "Person",
                name: post.kind === "challenge"
                    ? post.attacker.displayName
                    : post.kind === "trade"
                        ? post.offerer.name
                        : "collector" in post
                            ? post.collector.name
                            : "AnimalDex collector"
            },
            isPartOf: {
                "@type": "WebSite",
                name: "AnimalDex",
                url: getAbsoluteUrl(params.locale)
            }
        },
        videoUrl
            ? {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: seo.title,
                description: seo.description,
                thumbnailUrl: [imageUrl],
                contentUrl: videoUrl,
                uploadDate: seo.publishedAt,
                publisher: {
                    "@type": "Organization",
                    name: "AnimalDex",
                    url: getAbsoluteUrl(params.locale)
                }
            }
            : null
    ].filter(Boolean);

    return (
        <AppCreditsProvider initialBalance={null}>
            <AppShell
                profile={null}
                isAuthenticated={false}
                unreadCount={0}
                unreadMessageCount={0}
                hydrateFromSession
            >
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd)}}
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
                />
            </AppShell>
        </AppCreditsProvider>
    );
}
