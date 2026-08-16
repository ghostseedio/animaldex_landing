import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import ProfileContent from "@/app/[locale]/(composited)/u/[handle]/profile-content";
import ProfileSignOutButton from "@/app/[locale]/(composited)/u/[handle]/profile-sign-out-button";
import ShareProfileButton from "@/app/[locale]/(composited)/u/[handle]/share-profile-button";
import {getInstagramDisplayText, getPublicProfileCard, normalizePublicHandle} from "@/data/public-profiles";
import {
    buildOwnerCompletedSets,
    getMemberListedPacks,
    getOwnerTradeUnlockSummary,
    getProfileCreditsSummary,
    getProfileViewerState
} from "@/data/profile-authenticated";
import {getScopedTranslator} from "@/loaders/translation";
import {formatDiscoveryDistance} from "@/lib/format-discovery-distance";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {appStoreUrl} from "@/lib/store-links";

export const dynamic = "force-dynamic";

type PublicProfilePageProps = {
    params: {locale: string; handle: string};
};

function profilePath(handle: string) {
    return `/u/${encodeURIComponent(handle)}`;
}

export async function generateMetadata({params}: PublicProfilePageProps): Promise<Metadata> {
    const handle = normalizePublicHandle(params.handle);
    if (!handle) return {};

    const profile = await getPublicProfileCard(handle);
    if (!profile) return {};

    const pathname = profilePath(profile.username);
    const url = getAbsoluteUrl(params.locale, pathname);
    const title = `${profile.displayName} (@${profile.username})`;
    const description = `${profile.displayName}'s public AnimalDex card: ${profile.captureCount} captures, ${profile.speciesCount} species, and a collector score of ${profile.collectorScore}.`;

    return {
        title,
        description,
        alternates: {canonical: getLocalePath(params.locale, pathname)},
        robots: {index: false, follow: true},
        other: {
            "apple-itunes-app": `app-id=6761607780, app-argument=${url}`
        },
        appLinks: {
            ios: {url, app_store_id: "6761607780", app_name: "AnimalDex"},
            android: {url, package: "app.animaldex", app_name: "AnimalDex"}
        },
        openGraph: {
            type: "profile",
            url,
            title,
            description,
            siteName: "AnimalDex",
            images: profile.avatarUrl ? [{url: profile.avatarUrl, alt: `${profile.displayName}'s AnimalDex profile`}]: undefined
        },
        twitter: {
            card: profile.avatarUrl ? "summary" : "summary_large_image",
            title,
            description,
            images: profile.avatarUrl ? [profile.avatarUrl] : undefined
        }
    };
}

export default async function PublicProfilePage({params}: PublicProfilePageProps) {
    return ProfilePageBody({locale: params.locale, handle: params.handle});
}

async function ProfilePageBody({locale, handle}: {locale: string; handle: string}) {
    const requestedHandle = normalizePublicHandle(handle);
    if (!requestedHandle) notFound();

    const profile = await getPublicProfileCard(requestedHandle);
    if (!profile) notFound();

    if (profile.username.toLowerCase() !== requestedHandle) {
        redirect(getLocalePath(locale, profilePath(profile.username)));
    }

    const viewer = await getProfileViewerState(profile.userId);
    const localePrefix = `/${locale}`;
    const t = await getScopedTranslator(locale, "profile");
    const pageUrl = getAbsoluteUrl(locale, profilePath(profile.username));
    const joinedAtLabel = profile.joinedAt
        ? new Date(profile.joinedAt).toLocaleDateString(locale, {month: "short", year: "numeric"})
        : null;

    let ownerExtras = null;

    if (viewer.isOwner) {
        const completedSets = buildOwnerCompletedSets(profile.powerSetCompletions);
        const [credits, tradeUnlock] = await Promise.all([
            getProfileCreditsSummary(),
            getOwnerTradeUnlockSummary(profile.collectorScore)
        ]);

        ownerExtras = {
            credits,
            tradeUnlock,
            completedSets,
            completedSetsCount: completedSets.length,
            signOutButton: (
                <ProfileSignOutButton label={t("signOut")} loadingLabel={t("signingOut")} />
            )
        };
    }

    const listedPacks = await getMemberListedPacks(profile.userId);
    // iOS gates location surfaces on `canViewLocations`; the web can settle the
    // owner and "everyone" cases without a follow graph, and stays private otherwise.
    const canViewLocations = viewer.isOwner || profile.locationVisibility === "everyone";

    const schema = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: {
            "@type": "Person",
            name: profile.displayName,
            alternateName: `@${profile.username}`,
            url: pageUrl,
            ...(profile.avatarUrl ? {image: profile.avatarUrl} : {})
        }
    };

    return (
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <ProfileContent
                profile={{
                    userId: profile.userId,
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarUrl: profile.avatarUrl,
                    bio: profile.bio,
                    instagramUrl: profile.instagramUrl,
                    instagramDisplay: getInstagramDisplayText(profile.instagramUrl),
                    isPro: profile.isPro,
                    joinedAtLabel,
                    chromePreset: profile.chromePreset,
                    collectorScore: profile.collectorScore,
                    collectionArchetype: profile.collectionArchetype,
                    captureCount: profile.captureCount,
                    speciesCount: profile.speciesCount,
                    indexedSpeciesCount: profile.indexedSpeciesCount,
                    catalogSpeciesCount: profile.catalogSpeciesCount,
                    unindexedCount: profile.unindexedCount,
                    wildCount: profile.wildCount,
                    zooCount: profile.zooCount,
                    domesticCount: profile.domesticCount,
                    farmCount: profile.farmCount,
                    tradesMade: profile.tradesMade,
                    missionsCompleted: profile.missionsCompleted,
                    challengeWins: profile.challengeWins,
                    challengeLosses: profile.challengeLosses,
                    discoveryDistanceLabel: canViewLocations && profile.discoveryDistanceMeters != null
                        ? formatDiscoveryDistance(profile.discoveryDistanceMeters)
                        : null,
                    collectionValueUsd: profile.collectionValueUsd,
                    averageTraits: profile.averageTraits,
                    battleTierCounts: profile.battleTierCounts,
                    bestForTagScores: profile.bestForTagScores,
                    powerSetCompletions: profile.powerSetCompletions,
                    wildIdentity: profile.wildIdentity,
                    insights: profile.insights,
                    wildInsights: profile.wildInsights,
                    locationVisits: profile.locationVisits,
                    topCaptures: profile.topCaptures,
                    recentCaptures: profile.recentCaptures,
                    canViewLocations
                }}
                labels={{
                    profileTitle: t("title"),
                    editProfile: t("editProfile"),
                    shareProfile: t("shareProfile"),
                    openApp: t("openApp"),
                    collectorSince: t("collectorSince"),
                    proBadge: t("proBadge"),
                    tabStats: t("tabStats"),
                    tabHistory: t("tabHistory"),
                    netWorthFootnote: t("netWorthFootnote"),
                    keepScanning: t("keepScanning"),
                    wildProfileTitle: t("wildProfileTitle"),
                    wildProfilePublic: t("wildProfilePublic"),
                    originLabel: t("originLabel"),
                    apexLabel: t("apexLabel"),
                    activeLabel: t("activeLabel"),
                    locationsTitle: t("locationsTitle"),
                    locationsEmpty: t("locationsEmpty"),
                    locationCaptures: t("locationCaptures"),
                    userIdLabel: t("userIdLabel"),
                    noPublicCapturesTitle: t("noPublicCapturesTitle"),
                    noPublicCapturesDescription: t("noPublicCapturesDescription"),
                    signOut: t("signOut"),
                    signingOut: t("signingOut"),
                    discoverWildProfileTitle: t("discoverWildProfileTitle"),
                    discoverWildProfileDetail: t("discoverWildProfileDetail"),
                    packMarketplaceEmpty: t("packMarketplaceEmpty"),
                    packListedBy: t("packListedBy"),
                    packBuyInApp: t("packBuyInApp"),
                    viewSignedInAs: t("viewSignedInAs")
                }}
                locale={locale}
                localePrefix={localePrefix}
                viewer={viewer}
                viewerAvatarUrl={viewer.viewerAvatarUrl}
                ownerExtras={ownerExtras}
                listedPacks={listedPacks}
                appStoreUrl={appStoreUrl}
                shareButton={
                    <ShareProfileButton
                        url={pageUrl}
                        title={`${profile.displayName} on AnimalDex`}
                        text={`See ${profile.displayName}'s animal collection on AnimalDex`}
                        compact
                    />
                }
            />
        </article>
    );
}
