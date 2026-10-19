"use client";

import Image from "next/image";
import {useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import ProfileHeadToHeadSheet from "@/app/[locale]/(composited)/u/[handle]/profile-head-to-head";
import ProfileFollowListSheet from "@/app/[locale]/(composited)/u/[handle]/profile-follow-list";
import ProfileWeeklyStatsCard from "@/app/[locale]/(composited)/u/[handle]/profile-weekly-stats-card";
import {formatDisplayMoney} from "@/lib/account-settings";
import ProfileLocationsMap from "@/app/[locale]/(composited)/u/[handle]/profile-locations-map";
import {buildProfileGridItems, formatAnimalDexNumber, type ProfileGridItem} from "@/lib/profile-capture-grid";
import MyAnimalPowersSection from "@/components/animal-detail/animal-powers/my-animal-powers-section";
import {
    AverageTraitsCard,
    BestForTagsChartCard,
    CollectorScoreCard,
    CompletedBindersSection,
    ProfileInsightsSection,
    SettingComparisonCard,
    StatChipScroller,
    StatTile,
    StatsPanel,
    THEME,
    TierDistributionCard,
    type ProfileBinder,
    type ProfileStatChip
} from "@/app/[locale]/(composited)/u/[handle]/profile-stats-panels";
import type {
    ProfileBattleTierCounts,
    ProfileBestForTag,
    ProfileInsight,
    ProfileLocationVisit,
    ProfilePowerSetCompletion,
    PublicProfileCapture,
    PublicProfilePet,
    PublicWildIdentity
} from "@/data/public-profiles";
import type {
    ProfileCompletedSet,
    ProfileCreditsSummary,
    ProfileListedPack,
    ProfileSocialState,
    ProfileViewStats,
    ProfileViewerState
} from "@/data/profile-authenticated";
import ProfileSocialControls from "@/app/[locale]/(composited)/u/[handle]/profile-social-controls";
import {formatAppInteger} from "@/lib/format-numbers";
import {OwnerShopGuides, PublicShopGuides, type ProfileShopLabels} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-guides";
import {GUIDE_BAND, GuideBandHeader} from "@/components/wildlife-guides/guide-ui";
import type {VirtualGuideProfile} from "@/data/virtual-wildlife-guides";

export type ProfileTab = "history" | "stats" | "shop" | "locations";

/** iOS `historyPageSize`. */
const HISTORY_PAGE_SIZE = 18;

export type ProfileContentLabels = {
    profileTitle: string;
    editProfile: string;
    shareProfile: string;
    openApp: string;
    collectorSince: string;
    proBadge: string;
    tabStats: string;
    tabHistory: string;
    tabShop: string;
    settingsActivity: string;
    earnings: string;
    settingsEndorsements: string;
    settingsEndorsementsDetail: string;
    settingsMissions: string;
    settingsMissionsDetail: string;
    settingsCreditsUnlocks: string;
    settingsCreditsUnlocksCount: string;
    settingsCreditsDetail: string;
    settingsEarningsDetail: string;
    settingsWidgets: string;
    settingsWidgetsDetail: string;
    settingsLanguage: string;
    settingsLanguageDetail: string;
    settingsLanguageValue: string;
    settingsCurrency: string;
    settingsCurrencyDetail: string;
    settingsCurrencyValue: string;
    settingsLocationPrivacyDetail: string;
    settingsDataUploadsDetail: string;
    settingsDone: string;
    settingsClose: string;
    manageShop: string;
    settingsPreferences: string;
    settingsNotifications: string;
    settingsPrivacyData: string;
    settingsLocationPrivacy: string;
    settingsDataUploads: string;
    settingsSupportAbout: string;
    settingsHelpSupport: string;
    settingsPrivacyPolicy: string;
    settingsTerms: string;
    settingsAccount: string;
    settingsAccountDetail: string;
    settingsActivityDetail: string;
    settingsConnectedServices: string;
    netWorthFootnote: string;
    keepScanning: string;
    wildProfileTitle: string;
    wildProfilePublic: string;
    originLabel: string;
    apexLabel: string;
    activeLabel: string;
    locationsTitle: string;
    locationsEmpty: string;
    locationCaptures: string;
    userIdLabel: string;
    noPublicCapturesTitle: string;
    noPublicCapturesDescription: string;
    signOut: string;
    signingOut: string;
    discoverWildProfileTitle: string;
    discoverWildProfileDetail: string;
    packMarketplaceEmpty: string;
    packListedBy: string;
    packBuyInApp: string;
    viewSignedInAs: string;
};

type ProfileContentProps = {
    profile: {
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        bio: string | null;
        instagramUrl: string | null;
        instagramDisplay: string | null;
        isPro: boolean;
        joinedAtLabel: string | null;
        chromePreset: "spirit" | "friend" | "professional" | "business";
        collectorScore: number;
        collectionArchetype: string;
        captureCount: number;
        speciesCount: number;
        indexedSpeciesCount: number;
        catalogSpeciesCount: number;
        unindexedCount: number;
        wildCount: number;
        zooCount: number;
        domesticCount: number;
        farmCount: number;
        tradesMade: number;
        missionsCompleted: number;
        animalPowersEarned: number | null;
        challengeWins: number;
        challengeLosses: number;
        discoveryDistanceLabel: string | null;
        collectionValueUsd: number | null;
        averageTraits: {
            dominance: number;
            speed: number;
            size: number;
            intelligence: number;
            rarity: number;
        };
        battleTierCounts: ProfileBattleTierCounts;
        bestForTagScores: ProfileBestForTag[];
        powerSetCompletions: ProfilePowerSetCompletion[];
        wildIdentity: PublicWildIdentity | null;
        insights: ProfileInsight[];
        wildInsights: ProfileInsight[];
        locationVisits: ProfileLocationVisit[];
        topCaptures: PublicProfileCapture[];
        recentCaptures: PublicProfileCapture[];
        /** Only the captures the owner marked as pets (iOS ProfilePetSelectionResolver). */
        pets: PublicProfilePet[];
        canViewLocations: boolean;
        captureGridSort: "recent" | "index";
    };
    labels: ProfileContentLabels;
    locale: string;
    appStoreUrl: string;
    shareButton: React.ReactNode;
    localePrefix: string;
    viewer: ProfileViewerState;
    viewerAvatarUrl?: string | null;
    ownerExtras?: {
        credits: ProfileCreditsSummary | null;
        tradeUnlock: {verifiedOverallScore: number; requiredScore: number; tradeUnlocked: boolean} | null;
        completedSets: ProfileCompletedSet[];
        completedSetsCount: number;
        /** Null when the binders could not be loaded: the count is then unknown, not zero. */
        completedBinders: ProfileBinder[] | null;
        /** The owner's whole library for History (iOS reads every card, not public rows). */
        historyCaptures: PublicProfileCapture[];
    } | null;
    listedPacks: ProfileListedPack[];
    virtualGuides?: VirtualGuideProfile;
    /** profile.shop.* strings for the Shop tab. */
    shopLabels: ProfileShopLabels;
    social?: ProfileSocialState | null;
    signInHref?: string;
    surface?: "marketing" | "app";
    /** Settings → Currency (iOS converts the USD collection value). */
    displayCurrency?: string;
};

/* ------------------------------------------------------------------ *
 * Tab bar — iOS `profileTabPicker`
 * ------------------------------------------------------------------ */

const TAB_ICONS: Record<ProfileTab, React.ReactNode> = {
    history: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
    ),
    stats: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="3" y="12" width="4.5" height="9" rx="1.2" />
            <rect x="9.75" y="6" width="4.5" height="15" rx="1.2" />
            <rect x="16.5" y="9" width="4.5" height="12" rx="1.2" />
        </svg>
    ),
    shop: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M12 2.2 21.4 6v1.1H2.6V6z" />
            <path d="M3.4 8.6h17.2v10.1a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2zM8.5 11.4h7v1.9h-7z" fillOpacity="1" />
        </svg>
    ),
    locations: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M12 2.4a5.4 5.4 0 0 0-5.4 5.4c0 3.7 4.3 8.4 5.05 9.2a.47.47 0 0 0 .7 0c.75-.8 5.05-5.5 5.05-9.2A5.4 5.4 0 0 0 12 2.4m0 7.5a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2" />
            <ellipse cx="12" cy="19.6" rx="7.4" ry="2.2" fillOpacity="0.55" />
        </svg>
    )
};

function ProfileChromeButton({
    children,
    onClick,
    href,
    ariaLabel
}: {
    children: React.ReactNode;
    onClick?: () => void;
    href?: string;
    ariaLabel: string;
}) {
    const className =
        "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-surface-800 text-white transition hover:bg-[#1a4528] light:hover:bg-surface-700";

    if (href) {
        return (
            <Link href={href} aria-label={ariaLabel} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
            {children}
        </button>
    );
}

function ProfileMessagesIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9.7L5 18.2V15H6.5A2.5 2.5 0 0 1 4 12.5v-7Z" />
        </svg>
    );
}

function ProfileEditIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

function ProfileSettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
    );
}

/* ------------------------------------------------------------------ *
 * Chrome — iOS `profileScrollableChrome`
 * ------------------------------------------------------------------ */

function WildIdentityCard({
    identity,
    labels
}: {
    identity: PublicWildIdentity;
    labels: ProfileContentLabels;
}) {
    const roles = [
        {key: "origin", role: identity.origin, label: labels.originLabel},
        {key: "apex", role: identity.apex, label: labels.apexLabel},
        {key: "active", role: identity.active, label: labels.activeLabel}
    ];

    return (
        <section className=" border border-white/10 bg-surface-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-primary-200">{labels.wildProfileTitle}</p>
                <span className="text-xs font-semibold text-white/35">{labels.wildProfilePublic}</span>
            </div>
            {identity.headline ? <h2 className="mt-3 font-display text-2xl font-bold text-white">{identity.headline}</h2> : null}
            {identity.summary ? <p className="mt-2 text-sm leading-relaxed text-white/55">{identity.summary}</p> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {roles.map(({key, role, label}) => (
                    <div key={key} className=" border border-white/[0.08] bg-black/20 p-3 light:bg-surface-900">
                        <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
                        {role.speciesSlug ? (
                            <Link href={`/animals/${role.speciesSlug}`} className="mt-2 block font-display text-lg font-bold text-white hover:text-primary-200">
                                {role.name}
                            </Link>
                        ) : (
                            <p className="mt-2 font-display text-lg font-bold text-white">{role.name}</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

/** iOS `ShopDestinationRow`. */
function ShopDestinationRow({href, external = false, tint, title, subtitle, status, actionTitle}: {
    href: string;
    external?: boolean;
    tint: string;
    title: string;
    subtitle: string;
    status: string;
    actionTitle: string;
}) {
    const body = (
        <>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{backgroundColor: `${tint}26`, color: tint}}>
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: tint}} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/45">{subtitle}</span>
                <span className="mt-1 block text-[11px] font-semibold text-white/60">{status}</span>
            </span>
            <span className="shrink-0 text-xs font-extrabold" style={{color: THEME.neon}}>{actionTitle} ›</span>
        </>
    );
    const className = "flex items-center gap-3 border-b border-white/[0.06] px-[18px] py-3.5 transition hover:bg-white/[0.03]";
    return external
        ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
        : <Link href={href} className={className}>{body}</Link>;
}

/** iOS `followCountsRow`: two counts under the score card, on every profile. */
function FollowCountsRow({counts, onOpen}: {counts: {followers: number; following: number}; onOpen?: (kind: "followers" | "following") => void}) {
    return (
        <div className="flex items-center border-b border-white/[0.06] bg-[#12351C]/40 py-3.5">
            {([["followers", "Followers", counts.followers], ["following", "Following", counts.following]] as const).map(([kind, label, value], index) => (
                <button
                    key={label}
                    type="button"
                    disabled={!onOpen}
                    onClick={() => onOpen?.(kind)}
                    aria-label={`${value} ${label}`}
                    title={onOpen ? "Opens the list" : undefined}
                    className={`flex flex-1 flex-col items-center gap-0.5 transition enabled:hover:opacity-80 ${index > 0 ? "border-l border-white/10" : ""}`}
                >
                    <span className="text-xl font-extrabold tabular-nums text-white">{formatAppInteger(value)}</span>
                    <span className="text-[11px] font-medium uppercase text-[#7E8781]">{label}</span>
                </button>
            ))}
        </div>
    );
}

/** iOS `ProfileViewsCard`: owner only. */
function ProfileViewsCard({stats}: {stats: ProfileViewStats}) {
    const comparison = stats.thisWeek === 0
        ? "No views this week"
        : stats.previousWeek === 0
            ? "First views this week"
            : stats.thisWeek === stats.previousWeek
                ? "Same as last week"
                : `${stats.thisWeek > stats.previousWeek ? "+" : ""}${Math.round(((stats.thisWeek - stats.previousWeek) / stats.previousWeek) * 100)}% vs last week`;

    return (
        <section className="border-b border-white/[0.06] px-[18px] py-4">
            <p className="text-xs font-medium uppercase tracking-[0.09em] text-white">Community</p>
            {stats.allTime === 0 ? (
                <div className="mt-3">
                    <p className="text-sm font-bold text-white">Profile views</p>
                    <p className="mt-1 text-xs text-white/45">No one has visited your profile yet.</p>
                </div>
            ) : (
                <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase text-white/40">Profile views</p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums text-white">
                            {formatAppInteger(stats.thisWeek)} <span className="text-xs font-semibold text-white/45">this week</span>
                        </p>
                        <p className="mt-1 text-xs font-semibold" style={{color: THEME.neon}}>{comparison}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase text-white/40">All time</p>
                        <p className="mt-1 text-lg font-extrabold tabular-nums text-white">{formatAppInteger(stats.allTime)}</p>
                    </div>
                </div>
            )}
        </section>
    );
}

/** iOS `ProfileHistoryGridCell`: square photo, index chip, sightings pill, level chip, video marker. */
function ProfileGridCell({item}: {item: ProfileGridItem<PublicProfileCapture>}) {
    const capture = item.representative;
    return (
        <Link href={capture.href} className="group relative aspect-square overflow-hidden bg-black">
            <Image
                src={capture.imageSrc}
                alt={capture.animalName}
                fill
                unoptimized
                className="object-cover transition duration-300 group-hover:scale-105"
            />
            {item.animalDexNumber != null ? (
                <span className="absolute left-[7px] top-[7px] rounded-full border border-[#A7F432]/[0.28] bg-black/55 px-[7px] py-1 text-[11px] font-extrabold leading-none tabular-nums text-[#A7F432]">
                    {formatAnimalDexNumber(item.animalDexNumber)}
                </span>
            ) : (
                <span className="absolute left-[7px] top-[7px] rounded-full bg-black/55 px-1.5 py-1 text-[9px] font-extrabold leading-none text-[#A8B0AA]">
                    NOT INDEXED
                </span>
            )}
            {item.captureCount > 1 ? (
                <span
                    aria-label={`${item.captureCount} sightings`}
                    className="absolute right-[7px] top-[7px] inline-flex items-center gap-1 rounded-full bg-black/55 px-[7px] py-1 text-[10px] font-extrabold leading-none text-white"
                >
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                        <path d="M9 4.5 7.6 6.5H5A2.5 2.5 0 0 0 2.5 9v8.5A2.5 2.5 0 0 0 5 20h14a2.5 2.5 0 0 0 2.5-2.5V9A2.5 2.5 0 0 0 19 6.5h-2.6L15 4.5H9Zm3 4.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
                    </svg>
                    {item.captureCount}
                </span>
            ) : null}
            {/* Level 1 is every new capture; iOS shows no chip for it. */}
            {item.level > 1 ? (
                <span
                    aria-label={`Level ${item.level}`}
                    className="absolute bottom-[7px] left-[7px] rounded-full bg-black/55 px-[7px] py-1 text-[10px] font-extrabold leading-none tabular-nums text-white"
                >
                    Lv {item.level}
                </span>
            ) : null}
            {item.isMovingMedia ? (
                <span className="absolute bottom-1.5 right-1.5 grid h-[19px] w-[19px] place-items-center rounded-full bg-black/55 text-white" aria-label="Video">
                    <svg viewBox="0 0 24 24" className="ml-px h-[9px] w-[9px]" fill="currentColor" aria-hidden="true">
                        <path d="M7 4.5v15l12.5-7.5L7 4.5Z" />
                    </svg>
                </span>
            ) : null}
            <span className="sr-only">{capture.animalName}</span>
        </Link>
    );
}

/** iOS `headToHeadStatsPrompt`. */
function HeadToHeadPrompt({onOpen}: {onOpen: () => void}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="relative flex w-full items-center gap-3 border-y border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.03]"
        >
            <span
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full"
                style={{backgroundColor: "rgba(167,244,50,0.10)", color: THEME.neon}}
            >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 7H3m0 0 3-3M3 7l3 3" />
                    <path d="M16 17h5m0 0-3-3m3 3-3 3" />
                </svg>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-white">Want to compare against yours?</span>
                <span className="text-[11px] font-semibold text-white/40">See your collections head to head</span>
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] font-extrabold" style={{color: THEME.neon}}>Compare</span>
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white/40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                </svg>
            </span>
        </button>
    );
}

export default function ProfileContent({
    profile,
    labels,
    locale,
    appStoreUrl,
    shareButton,
    localePrefix,
    viewer,
    viewerAvatarUrl,
    ownerExtras,
    listedPacks,
    virtualGuides,
    shopLabels,
    social = null,
    signInHref = "/account",
    surface = "marketing",
    displayCurrency = "USD"
}: ProfileContentProps) {
    const [activeTab, setActiveTab] = useState<ProfileTab>("history");
    const activeChromePreset = profile.chromePreset;
    const [chromeCollapsed, setChromeCollapsed] = useState(false);
    const [isWildInsightScope, setIsWildInsightScope] = useState(false);
    const [showHeadToHead, setShowHeadToHead] = useState(false);
    const [followList, setFollowList] = useState<"followers" | "following" | null>(null);
    // iOS History: the owner's whole library; everyone else the public rows.
    const historyCaptures = viewer.isOwner && ownerExtras ? ownerExtras.historyCaptures : profile.recentCaptures;
    const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
    const historySentinel = useRef<HTMLDivElement>(null);

    const speciesDenominator = profile.catalogSpeciesCount > 0 ? `/${profile.catalogSpeciesCount}` : undefined;
    const collectionValue = profile.collectionValueUsd != null && profile.collectionValueUsd > 0
        ? formatDisplayMoney(profile.collectionValueUsd, displayCurrency, locale)
        : null;
    // iOS shows only captures the owner marked as pets, never a guess from the
    // capture's setting.
    const friendPets = profile.pets;
    // Full-width sections. On /app the column has no side padding, so they sit
    // flush; on the public page they bleed past its px-4 / md:px-8 padding.
    // Everything inside then uses the same 18px inset, as iOS does.
    const bleed = surface === "app" ? "" : "-mx-4 md:-mx-8";
    const inset = surface === "app" ? "px-[18px]" : "px-[18px] md:px-0";

    const tabs = useMemo<ProfileTab[]>(
        () => (profile.canViewLocations || viewer.isOwner
            ? ["history", "stats", "shop", "locations"]
            : ["history", "stats", "shop"]),
        [profile.canViewLocations, viewer.isOwner]
    );
    const tabLabel = (tab: ProfileTab) => {
        if (tab === "history") return labels.tabHistory;
        if (tab === "stats") return labels.tabStats;
        if (tab === "shop") return labels.tabShop;
        return labels.locationsTitle;
    };

    const [followerDelta, setFollowerDelta] = useState(0);
    const followCounts = social?.followCounts
        ? {...social.followCounts, followers: Math.max(0, social.followCounts.followers + followerDelta)}
        : null;

    const gridItems = useMemo(
        () => buildProfileGridItems(historyCaptures, profile.captureGridSort),
        [historyCaptures, profile.captureGridSort]
    );

    // iOS reveals 18 cells at a time as the grid nears the bottom.
    useEffect(() => {
        const sentinel = historySentinel.current;
        if (!sentinel || activeTab !== "history") return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setHistoryLimit((limit) => limit + HISTORY_PAGE_SIZE);
            }
        }, {rootMargin: "260px 0px"});
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [activeTab, gridItems.length, historyLimit]);

    // iOS lists the owner's completed collection binders and nothing for another
    // member: binder progress is built from the viewer's own captures. The old
    // power-set tiers ("Indexed Species Silver") are retired there.
    const binders = viewer.isOwner ? ownerExtras?.completedBinders ?? null : null;

    // Matches iOS: the server ranks each scope, and a missing Wild ranking falls
    // back to the same leaders computed over the wild-only sample.
    const insights = useMemo(() => {
        if (!isWildInsightScope) return profile.insights;
        if (profile.wildInsights.length > 0) return profile.wildInsights;

        const wildCaptures = profile.recentCaptures.filter((capture) => capture.contextLabel === "Wild");
        const strongest = (metric: "dominance" | "speed" | "size" | "intelligence" | "rarity") =>
            wildCaptures.reduce<PublicProfileCapture | null>(
                (best, capture) => (!best || capture[metric] > best[metric] ? capture : best),
                null
            );

        return [
            {title: "Overall best capture", capture: wildCaptures[0] ?? null},
            {title: "Most dominant", capture: strongest("dominance")},
            {title: "Fastest animal", capture: strongest("speed")},
            {title: "Biggest animal", capture: strongest("size")},
            {title: "Most intelligent", capture: strongest("intelligence")},
            {title: "Rarest animal", capture: strongest("rarity")}
        ];
    }, [isWildInsightScope, profile.insights, profile.recentCaptures, profile.wildInsights]);

    const statChips = useMemo<ProfileStatChip[]>(() => {
        const chips: ProfileStatChip[] = [
            {title: "Captures", value: String(profile.captureCount), tint: THEME.neon},
            {title: "Species", value: String(profile.speciesCount), tint: THEME.mint},
            // Powers earned sits beside the species met: what this person has
            // been taught, next to what they have found.
            ...(profile.animalPowersEarned != null
                ? [{title: "Powers earned", value: String(profile.animalPowersEarned), tint: THEME.neon}]
                : []),
            {title: "Unindexed captures", value: String(profile.unindexedCount), tint: "rgba(255,59,48,0.92)"},
            {
                title: "Indexed",
                value: String(profile.indexedSpeciesCount),
                tint: THEME.mint,
                denominator: speciesDenominator
            },
            // iOS omits the chip when the count is not known.
            ...(binders ? [{title: "Binders complete", value: String(binders.length), tint: "rgba(148,84,250,0.95)"}] : []),
            {
                title: "Battles",
                value: `${profile.challengeWins}/${profile.challengeWins + profile.challengeLosses}`,
                tint: THEME.neon
            },
            {title: "Trades made", value: String(profile.tradesMade), tint: "rgba(255,149,0,0.92)"},
            {title: "Missions complete", value: String(profile.missionsCompleted), tint: THEME.mint}
        ];

        if (profile.discoveryDistanceLabel) {
            chips.push({
                title: "Discovery distance",
                value: profile.discoveryDistanceLabel,
                tint: "rgba(50,173,230,0.92)"
            });
        }

        return chips;
    }, [binders, profile, speciesDenominator]);

    useEffect(() => {
        const onScroll = () => {
            setChromeCollapsed(window.scrollY > 56);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className={`flex flex-col gap-6 ${surface === "app" ? "md:gap-7" : "md:gap-8"}`}>
            {viewer.isLoggedIn && !viewer.isOwner && viewer.viewerUsername ? (
                <p className=" border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-white/45">
                    {labels.viewSignedInAs.replace("{username}", viewer.viewerUsername)}
                </p>
            ) : null}


            <div
                className={`overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-out ${
 chromeCollapsed
                        ? "max-h-0 -mb-6 -translate-y-2 opacity-0 md:-mb-8"
                        : "max-h-[28rem] mb-0 translate-y-0 opacity-100"
                }`}
            >
            <header className={`flex items-center gap-3 pb-1 pt-1 ${inset}`}>
                {profile.avatarUrl ? (
                    <Image
                        src={profile.avatarUrl}
                        alt={`${profile.displayName}'s avatar`}
                        width={52}
                        height={52}
                        priority
                        className="h-[52px] w-[52px] shrink-0 rounded-full border border-white/[0.1] object-cover shadow-[0_0_24px_rgba(139,92,246,0.12)]"
                    />
                ) : (
                    <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-surface-800 font-display text-lg font-bold text-primary-100">
                        {profile.displayName.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-[17px] font-extrabold text-white">{profile.displayName}</h1>
                        {profile.isPro ? (
                            <span className="shrink-0 rounded-full bg-primary-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">{labels.proBadge}</span>
                        ) : null}
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            {viewer.isOwner ? (
                                <ProfileChromeButton href={`${localePrefix}/app/profile/edit`} ariaLabel="Edit profile">
                                    <ProfileEditIcon />
                                </ProfileChromeButton>
                            ) : viewer.isLoggedIn ? (
                                <ProfileChromeButton href={`${localePrefix}/app/messages/${encodeURIComponent(profile.userId)}`} ariaLabel="Message">
                                    <ProfileMessagesIcon />
                                </ProfileChromeButton>
                            ) : null}
                            {!viewer.isOwner ? (
                                <ProfileSocialControls
                                    profileUserId={profile.userId}
                                    displayName={profile.displayName}
                                    isLoggedIn={viewer.isLoggedIn}
                                    signInHref={signInHref}
                                    initialIsFollowing={social?.isFollowing ?? false}
                                    initialIsFriend={social?.isFriend ?? false}
                                    initialPreference={social?.notificationPreference ?? "all"}
                                    onFollowersChange={(delta) => setFollowerDelta((current) => current + delta)}
                                />
                            ) : null}
                            {shareButton ? (
                                <div className="[&_button]:grid [&_button]:h-9 [&_button]:w-9 [&_button]:place-items-center [&_button]:rounded-full [&_button]:border [&_button]:border-white/[0.1] [&_button]:bg-surface-800 [&_button]:p-0 [&_button]:text-white">
                                    {shareButton}
                                </div>
                            ) : null}
                            {viewer.isOwner && surface !== "app" ? (
                                <Link
                                    href={`${localePrefix}/app/settings`}
                                    aria-label="Settings and activity"
                                    className="grid h-9 w-9 place-items-center text-primary-200 transition hover:text-primary-100"
                                >
                                    <ProfileSettingsIcon />
                                </Link>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-medium text-white/55">@{profile.username}</p>
                        {viewer.isOwner && ownerExtras?.credits ? (
                            <Link
                                href={`${localePrefix}/app/credits`}
                                aria-label={`${ownerExtras.credits.balance} credits. Open credits and unlocks.`}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
 ownerExtras.credits.isLow
                                        ? "bg-primary-400 text-black"
                                        : "border border-primary-200/35 bg-primary-400/14 text-primary-200"
                                }`}
                            >
                                <span aria-hidden="true">⚡</span>
                                {ownerExtras.credits.balance}
                            </Link>
                        ) : null}
                    </div>
                </div>
            </header>

            <div key={activeChromePreset} className={`mt-5 motion-safe:animate-[profileChromeFade_220ms_ease-out] ${inset}`}>
            {activeChromePreset === "spirit" ? (
                profile.wildIdentity
                    ? <WildIdentityCard identity={profile.wildIdentity} labels={labels} />
                    : viewer.isOwner ? (
                        <Link href={`${localePrefix}/app/train/wild-profile`} className=" border border-primary-300/20 bg-primary-400/[0.08] p-4">
                            <p className="font-display text-lg font-bold text-white">Discover My Animals</p>
                            <p className="mt-1 text-sm text-white/55">Take the animal quiz to unlock your Origin, Apex, and Active animals.</p>
                        </Link>
                    ) : null
            ) : null}

            {activeChromePreset === "friend" ? (
                <section>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-primary-200">Pets</p>
                    {friendPets.length === 0 ? (
                        <div className="mt-2 space-y-1 py-1">
                            <p className="text-sm font-bold text-white">No pets yet</p>
                            <p className="text-xs font-medium text-white/45">Favorite pet captures will show up here.</p>
                        </div>
                    ) : (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                            {friendPets.map((pet) => (
                                // iOS ProfilePetCell: the species artwork over the pet's name.
                                <Link
                                    key={pet.captureId}
                                    href={`${localePrefix}/app/capture/${encodeURIComponent(pet.captureId)}`}
                                    className="flex h-[78px] w-[78px] shrink-0 flex-col items-center justify-center gap-1.5 border border-white/[0.08] bg-white/[0.04] px-1.5 transition hover:border-primary-400/40"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={pet.speciesSlug ? getSpeciesArtworkRoute(pet.speciesSlug) : "/images/placeholders/species-no-image.svg"}
                                        alt=""
                                        loading="lazy"
                                        className="h-[30px] w-[30px] object-contain"
                                    />
                                    <p className="w-full truncate text-center text-[12px] font-black text-white">{pet.name}</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            ) : null}

            {activeChromePreset === "professional" ? (
                <section className="space-y-2 text-sm text-white/55">
                    {profile.bio ? <p className="leading-6">{profile.bio}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {profile.joinedAtLabel ? <span>{labels.collectorSince.replace("{date}", profile.joinedAtLabel)}</span> : null}
                        {profile.instagramUrl && profile.instagramDisplay ? (
                            <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary-200">
                                Instagram · {profile.instagramDisplay}
                            </a>
                        ) : null}
                    </div>
                </section>
            ) : null}

            {activeChromePreset === "business" ? (
                <section className="grid grid-cols-3 gap-2">
                    {[
                        ["Net worth", collectionValue ?? "—"],
                        ["Overall", formatAppInteger(profile.collectorScore, locale)],
                        ["Catalog", profile.catalogSpeciesCount > 0 ? `${Math.round((profile.indexedSpeciesCount / profile.catalogSpeciesCount) * 100)}%` : "—"]
                    ].map(([title, value]) => (
                        <div key={title} className=" border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-white/35">{title}</p>
                            <p className="mt-1 truncate font-display text-base font-bold text-primary-100">{value}</p>
                        </div>
                    ))}
                </section>
            ) : null}
            </div>
            </div>

            <nav aria-label="Profile sections" className={`sticky z-20 border-b border-white/[0.08] bg-canvas-950/95 backdrop-blur-xl ${bleed} ${
 surface === "app"
                    ? viewer.isOwner ? "top-[6.65rem] lg:top-[2.65rem]" : "top-16 lg:top-0"
                    : "top-0"
            }`}>
                <div className="grid px-[18px]" style={{gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`}}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab)}
                                aria-label={tabLabel(tab)}
                                className="flex flex-col items-center gap-1.5 pt-2.5 outline-none focus-visible:bg-white/[0.05]"
                            >
                                <span className={`relative flex h-5 items-center ${isActive ? "text-white" : "text-white/40"}`}>
                                    {TAB_ICONS[tab]}
                                </span>
                                <span className={`h-0.5 w-full ${isActive ? "bg-white" : "bg-transparent"}`} />
                            </button>
                        );
                    })}
                </div>
            </nav>

            {activeTab === "stats" ? (
                <div className={`flex flex-col ${bleed}`}>
                    <CollectorScoreCard
                        score={profile.collectorScore}
                        archetype={profile.collectionArchetype}
                        catalogCompletion={profile.catalogSpeciesCount > 0
                            ? {completed: profile.indexedSpeciesCount, total: profile.catalogSpeciesCount}
                            : null}
                        tradeUnlock={ownerExtras?.tradeUnlock ?? null}
                    />
                    {followCounts ? (
                        <FollowCountsRow counts={followCounts} onOpen={viewer.isLoggedIn ? setFollowList : undefined} />
                    ) : null}
                    {social?.week ? <ProfileWeeklyStatsCard week={social.week} /> : null}
                    <SettingComparisonCard
                        wild={profile.wildCount}
                        zoo={profile.zooCount}
                        domestic={profile.domesticCount}
                        farm={profile.farmCount}
                    />
                    <TierDistributionCard
                        title="BATTLE TIER SPREAD"
                        rows={[{label: profile.displayName, counts: profile.battleTierCounts}]}
                    />
                    {!viewer.isOwner && viewer.isLoggedIn ? (
                        <HeadToHeadPrompt onOpen={() => setShowHeadToHead(true)} />
                    ) : null}
                    <StatChipScroller items={statChips} />
                    {collectionValue ? (
                        <StatTile
                            title="Net Worth"
                            value={collectionValue}
                            tint="rgba(52,199,89,0.92)"
                            footerText={labels.netWorthFootnote}
                        />
                    ) : null}
                    <BestForTagsChartCard
                        scores={profile.bestForTagScores}
                        title={viewer.isOwner ? "YOUR QUALITIES" : `@${profile.username}'S QUALITIES`.toUpperCase()}
                        isOwner={viewer.isOwner}
                        usernameHandle={`@${profile.username}`}
                    />
                    {viewer.isOwner ? (
                        <Link
                            href={`${localePrefix}/app/collection?segment=binders`}
                            className="flex items-center justify-end gap-1 border-b border-white/[0.06] px-[18px] py-3 text-xs font-bold"
                            style={{color: THEME.neon}}
                        >
                            Browse collection binders <span aria-hidden="true">↗</span>
                        </Link>
                    ) : null}
                    <AverageTraitsCard stats={profile.averageTraits} />
                    {viewer.isOwner && social?.profileViews ? <ProfileViewsCard stats={social.profileViews} /> : null}
                    <ProfileInsightsSection
                        insights={insights}
                        isWildScope={isWildInsightScope}
                        onToggleWildScope={setIsWildInsightScope}
                    />
                    {/* What this person has been taught, above what they have
                        found. Earned Powers are read for the signed-in viewer
                        only, so this is the owner's own profile. */}
                    {viewer.isOwner ? <MyAnimalPowersSection animalsMet={profile.speciesCount} /> : null}
                    {binders ? <CompletedBindersSection binders={binders} /> : null}
                    {!viewer.isOwner ? (
                        <StatsPanel className="px-[18px] py-4">
                            <p className="text-[11px] font-semibold uppercase text-white/40">{labels.userIdLabel}</p>
                            <p className="mt-1 break-all font-mono text-xs text-white/[0.62]">{profile.userId}</p>
                        </StatsPanel>
                    ) : null}
                </div>
            ) : null}

            {activeTab === "shop" ? (
                viewer.isOwner ? (
                    // iOS `ownerDashboard`: Wildlife Guides first, then Sealed Packs, then Ways to earn.
                    <div className={`flex flex-col ${bleed}`}>
                        <OwnerShopGuides
                            initial={virtualGuides?.kind === "owner" ? virtualGuides.mine : null}
                            labels={shopLabels}
                            locale={locale}
                        />
                        <GuideBandHeader title={shopLabels.sealedPacks} />
                        <ShopDestinationRow
                            href={`${localePrefix}/app/train/packs`}
                            tint="#FF9500"
                            title={shopLabels.sealedPacks}
                            subtitle={shopLabels.sealedPacksDetail}
                            status={listedPacks.length > 0 ? shopLabels.packsForSale.replace("{count}", String(listedPacks.length)) : shopLabels.noActiveListings}
                            actionTitle={shopLabels.manage}
                        />
                        <Link
                            href={`${localePrefix}/earn-on-animaldex`}
                            className="flex items-center gap-3 px-[18px] pb-7 pt-4 text-sm font-semibold text-white transition hover:opacity-80"
                        >
                            <span className="flex-1">{shopLabels.waysToEarn}</span>
                            <span className="text-xs text-white/40">{shopLabels.waysToEarnDetail} ›</span>
                        </Link>
                    </div>
                ) : (
                    // iOS `publicStorefront`: the person's guides, then their packs; one empty state for neither.
                    <div className={`flex flex-col ${bleed}`}>
                        <PublicShopGuides
                            guides={virtualGuides?.kind === "public" ? virtualGuides.guides : []}
                            labels={shopLabels}
                            locale={locale}
                        />
                        {listedPacks.length > 0 ? <GuideBandHeader title={shopLabels.sealedPacks} /> : null}
                        {listedPacks.map((pack) => (
                            <div key={pack.id} className={`${GUIDE_BAND} px-[18px] py-4`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-display text-xl font-bold text-white">{pack.themeTitle}</h3>
                                        <p className="mt-1 text-sm text-white/45">
                                            {pack.packSize} cards · {pack.listedPrice} credits
                                            {pack.qualityBand ? ` · ${pack.qualityBand}` : ""}
                                        </p>
                                        {pack.guaranteesSummary ? (
                                            <p className="mt-2 text-xs text-white/35">{pack.guaranteesSummary}</p>
                                        ) : null}
                                    </div>
                                    <a
                                        href={appStoreUrl}
                                        className="shrink-0 bg-primary-400 px-3 py-2 text-xs font-black text-black"
                                    >
                                        {labels.packBuyInApp}
                                    </a>
                                </div>
                                <p className="mt-3 text-xs text-white/35">
                                    {labels.packListedBy.replace("{name}", profile.displayName)}
                                </p>
                            </div>
                        ))}
                        {listedPacks.length === 0 && !(virtualGuides?.kind === "public" && virtualGuides.guides.length > 0) ? (
                            <div className="px-5 py-9 text-center">
                                <p className="font-display text-xl font-bold text-white">{shopLabels.nothingListedTitle}</p>
                                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{shopLabels.nothingListedDetail}</p>
                            </div>
                        ) : null}
                    </div>
                )
            ) : null}

            {activeTab === "locations" ? (
                <div className={`flex flex-col ${bleed}`}>
                    {profile.locationVisits.length === 0 ? (
                        <p className="px-[18px] py-7 text-center text-[15px] font-medium text-white/[0.62]">
                            {labels.locationsEmpty}
                        </p>
                    ) : (
                        <>
                            <ProfileLocationsMap visits={profile.locationVisits} />
                            <StatsPanel>
                                <div className="flex gap-3 overflow-x-auto px-[18px] py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {profile.locationVisits.map((visit) => (
                                        <div key={visit.id} className="w-52 shrink-0 border border-white/10 bg-[#1F1F1F] p-4 light:bg-surface-900">
                                            <p className="text-[11px] font-semibold uppercase text-white/40">
                                                {labels.locationCaptures.replace("{count}", String(visit.captureCount))}
                                            </p>
                                            <p className="mt-2 line-clamp-3 text-sm font-semibold text-white">{visit.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </StatsPanel>
                        </>
                    )}
                </div>
            ) : null}

            {activeTab === "history" ? (
                <section>
                    {historyCaptures.length === 0 && viewer.isOwner ? (
                        <p className="px-[18px] py-10 text-center text-[15px] font-medium text-white/[0.62]">No captures yet.</p>
                    ) : historyCaptures.length === 0 ? (
                        <div className="mt-4 border border-dashed border-white/10 px-6 py-10 text-center">
                            <h3 className="font-display text-2xl font-bold text-white">{labels.noPublicCapturesTitle}</h3>
                            <p className="mx-auto mt-3 max-w-xl text-sm text-white/45">
                                {labels.noPublicCapturesDescription.replace("{username}", profile.username)}
                            </p>
                        </div>
                    ) : (
                        <div className={`mt-2 grid grid-cols-3 gap-0.5 ${bleed}`}>
                            {gridItems.slice(0, historyLimit).map((item) => (
                                <ProfileGridCell key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                    {gridItems.length > historyLimit ? <div ref={historySentinel} className="h-px" aria-hidden="true" /> : null}
                </section>
            ) : null}

            {showHeadToHead ? (
                <ProfileHeadToHeadSheet
                    memberUserId={profile.userId}
                    viewerPerson={{
                        displayName: viewer.viewerUsername ?? "You",
                        username: viewer.viewerUsername ?? "you",
                        avatarUrl: viewerAvatarUrl ?? null
                    }}
                    memberPerson={{
                        displayName: profile.displayName,
                        username: profile.username,
                        avatarUrl: profile.avatarUrl
                    }}
                    onClose={() => setShowHeadToHead(false)}
                />
            ) : null}

            {followList ? (
                <ProfileFollowListSheet userId={profile.userId} kind={followList} onClose={() => setFollowList(null)} />
            ) : null}
        </div>
    );
}
