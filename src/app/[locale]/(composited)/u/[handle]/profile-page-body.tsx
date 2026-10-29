import {notFound, permanentRedirect} from "next/navigation";
import ProfileContent from "@/app/[locale]/(composited)/u/[handle]/profile-content";
import ShareProfileButton from "@/app/[locale]/(composited)/u/[handle]/share-profile-button";
import {getCurrencyPreference} from "@/data/account-settings";
import {getAppCaptures} from "@/data/authenticated-app";
import {getInstagramDisplayText, getPublicProfileCard, normalizePublicHandle, type PublicProfileCapture} from "@/data/public-profiles";
import {
    buildOwnerCompletedSets,
    getMemberListedPacks,
    getOwnerTradeUnlockSummary,
    getProfileCreditsSummary,
    getProfileSocialState,
    getProfileViewerState
} from "@/data/profile-authenticated";
import {getCollectionBinders} from "@/data/collection-binders";
import {getScopedTranslator} from "@/loaders/translation";
import {getCompanionWords} from "@/loaders/companion-words";
import {formatDiscoveryDistance} from "@/lib/format-discovery-distance";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {animalLevel} from "@/lib/animal-level";
import {getMyWildlifeGuidePurchases, getVirtualGuideProfile} from "@/data/virtual-wildlife-guides";
import {PROFILE_SHOP_LABEL_KEYS} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-labels";

function profilePath(handle: string) {
    return `/u/${encodeURIComponent(handle)}`;
}

/**
 * The owner's own library for History, as iOS reads it (`owned_capture_manifest_v1`,
 * every card, private ones included) — not the 48 newest public Discover rows a
 * visitor sees. Cards open on the web app's card page.
 */
async function getOwnerHistoryCaptures(): Promise<PublicProfileCapture[]> {
    const captures = await getAppCaptures().catch(() => []);
    return captures.map((capture) => ({
        id: capture.captureId,
        animalName: capture.displayName,
        speciesSlug: capture.speciesSlug,
        score: capture.score,
        capturedAt: capture.capturedAt,
        contextLabel: capture.contextLabel,
        href: `/app/capture/${encodeURIComponent(capture.captureId)}`,
        imageSrc: capture.imageSrc,
        dominance: capture.gameStats?.dominance ?? 0,
        speed: capture.gameStats?.speed ?? 0,
        size: capture.gameStats?.size ?? 0,
        intelligence: capture.gameStats?.intelligence ?? 0,
        rarity: capture.gameStats?.rarity ?? 0,
        isIndexed: Boolean(capture.speciesProfileId),
        identityKind: null,
        animalDexNumber: capture.indexNumber,
        speciesProfileId: capture.speciesProfileId?.toLowerCase() ?? null,
        isMovingMedia: false,
        // `owned_capture_manifest_v1.total_progression_xp` arrives as the summary's score.
        level: animalLevel(capture.score)
    }));
}

export async function ProfilePageBody({
    locale,
    handle,
    surface = "marketing"
}: {
    locale: string;
    handle: string;
    surface?: "marketing" | "app";
}) {
    const requestedHandle = normalizePublicHandle(handle);
    if (!requestedHandle) notFound();

    const profile = await getPublicProfileCard(requestedHandle);
    if (!profile) notFound();

    if (profile.username.toLowerCase() !== requestedHandle) {
        permanentRedirect(getLocalePath(locale, profilePath(profile.username)));
    }

    const viewer = await getProfileViewerState(profile.userId);
    const localePrefix = `/${locale}`;
    const t = await getScopedTranslator(locale, "profile");
    // "My Companions" is on the owner's own profile only.
    const companionWords = viewer.isOwner ? await getCompanionWords(locale) : undefined;
    const pageUrl = getAbsoluteUrl(locale, profilePath(profile.username));
    const joinedAtLabel = profile.joinedAt
        ? new Date(profile.joinedAt).toLocaleDateString(locale, {month: "short", year: "numeric"})
        : null;

    let ownerExtras = null;

    if (viewer.isOwner) {
        const completedSets = buildOwnerCompletedSets(profile.powerSetCompletions);
        const [credits, tradeUnlock, collection, historyCaptures] = await Promise.all([
            getProfileCreditsSummary(),
            getOwnerTradeUnlockSummary(profile.collectorScore),
            // The owner's real binders, as on iOS (`collectionBinders.filter(\.isComplete)`).
            // Binder progress is built from the viewer's own captures, so only the owner has it.
            getCollectionBinders().catch(() => null),
            getOwnerHistoryCaptures()
        ]);

        ownerExtras = {
            credits,
            tradeUnlock,
            completedSets,
            completedSetsCount: completedSets.length,
            completedBinders: collection
                ? collection.binders.filter((binder) => binder.isComplete).map((binder) => ({
                    key: binder.definition.id,
                    title: binder.definition.title,
                    shortTitle: binder.definition.shortTitle,
                    found: binder.collectedCount,
                    total: binder.totalCount,
                    accentHex: binder.definition.accentHex,
                    primaryHex: binder.definition.primaryHex,
                    secondaryHex: binder.definition.secondaryHex,
                    href: binder.href
                }))
                : null,
            historyCaptures
        };
    }

    const listedPacksPromise = getMemberListedPacks(profile.userId);
    const virtualGuidesPromise = getVirtualGuideProfile(profile.userId, viewer.isOwner);
    const boughtGuidesPromise = viewer.isOwner ? getMyWildlifeGuidePurchases().catch(() => []) : Promise.resolve([]);
    const [listedPacks, social, virtualGuides, boughtGuides] = await Promise.all([
        listedPacksPromise,
        // Also records this visit as a profile view for a signed-in non-owner.
        getProfileSocialState(profile.userId),
        virtualGuidesPromise,
        boughtGuidesPromise
    ]);
    // iOS gates location surfaces on `canViewLocations`; the web can settle the
    // owner and "everyone" cases without a follow graph, and stays private otherwise.
    const canViewLocations = viewer.isOwner || profile.locationVisibility === "everyone";
    // iOS converts the collection value (USD) to the display currency chosen in Settings.
    const displayCurrency = getCurrencyPreference().currency;

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

    const articleClass =
        surface === "app"
            ? "mx-auto w-full max-w-3xl bg-[#07100B] px-0 py-0"
            : "mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16";

    return (
        <article className={articleClass}>
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
                    animalPowersEarned: profile.animalPowersEarned,
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
                    pets: profile.pets,
                    canViewLocations,
                    captureGridSort: profile.captureGridSort
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
                    tabShop: t("tabShop"),
                    settingsActivity: t("settingsActivity"),
                    earnings: t("earnings"),
                    settingsEndorsements: t("settingsEndorsements"),
                    settingsEndorsementsDetail: t("settingsEndorsementsDetail"),
                    settingsMissions: t("settingsMissions"),
                    settingsMissionsDetail: t("settingsMissionsDetail"),
                    settingsCreditsUnlocks: t("settingsCreditsUnlocks"),
                    settingsCreditsUnlocksCount: t("settingsCreditsUnlocksCount"),
                    settingsCreditsDetail: t("settingsCreditsDetail"),
                    settingsEarningsDetail: t("settingsEarningsDetail"),
                    settingsWidgets: t("settingsWidgets"),
                    settingsWidgetsDetail: t("settingsWidgetsDetail"),
                    settingsLanguage: t("settingsLanguage"),
                    settingsLanguageDetail: t("settingsLanguageDetail"),
                    settingsLanguageValue: t("settingsLanguageValue"),
                    settingsCurrency: t("settingsCurrency"),
                    settingsCurrencyDetail: t("settingsCurrencyDetail"),
                    settingsCurrencyValue: t("settingsCurrencyValue"),
                    settingsLocationPrivacyDetail: t("settingsLocationPrivacyDetail"),
                    settingsDataUploadsDetail: t("settingsDataUploadsDetail"),
                    settingsDone: t("settingsDone"),
                    settingsClose: t("settingsClose"),
                    manageShop: t("manageShop"),
                    settingsPreferences: t("settingsPreferences"),
                    settingsNotifications: t("settingsNotifications"),
                    settingsPrivacyData: t("settingsPrivacyData"),
                    settingsLocationPrivacy: t("settingsLocationPrivacy"),
                    settingsDataUploads: t("settingsDataUploads"),
                    settingsSupportAbout: t("settingsSupportAbout"),
                    settingsHelpSupport: t("settingsHelpSupport"),
                    settingsPrivacyPolicy: t("settingsPrivacyPolicy"),
                    settingsTerms: t("settingsTerms"),
                    settingsAccount: t("settingsAccount"),
                    settingsAccountDetail: t("settingsAccountDetail"),
                    settingsActivityDetail: t("settingsActivityDetail"),
                    settingsConnectedServices: t("settingsConnectedServices"),
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
                companionWords={companionWords}
                locale={locale}
                localePrefix={localePrefix}
                viewer={viewer}
                viewerAvatarUrl={viewer.viewerAvatarUrl}
                ownerExtras={ownerExtras}
                listedPacks={listedPacks}
                virtualGuides={virtualGuides}
                boughtGuides={boughtGuides}
                shopLabels={Object.fromEntries(PROFILE_SHOP_LABEL_KEYS.map((key) => [key, t(`shop.${key}`)]))}
                social={social}
                signInHref={`/account?next=${encodeURIComponent(profilePath(profile.username))}`}
                surface={surface}
                displayCurrency={displayCurrency}
                shareButton={
                    <ShareProfileButton
                        url={pageUrl}
                        title={`${profile.displayName} on AnimalDex`}
                        text={`View @${profile.username}'s AnimalDex collector card.`}
                        compact
                    />
                }
            />
        </article>
    );
}
