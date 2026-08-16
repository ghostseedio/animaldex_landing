"use client";

import Image from "next/image";
import {useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ProfileHeadToHeadSheet from "@/app/[locale]/(composited)/u/[handle]/profile-head-to-head";
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
    PublicWildIdentity
} from "@/data/public-profiles";
import type {
    ProfileCompletedSet,
    ProfileCreditsSummary,
    ProfileListedPack,
    ProfileViewerState
} from "@/data/profile-authenticated";
import {formatAppInteger, formatAppUsd} from "@/lib/format-numbers";

export type ProfileTab = "history" | "stats" | "packs" | "locations";

export type ProfileContentLabels = {
    profileTitle: string;
    editProfile: string;
    shareProfile: string;
    openApp: string;
    collectorSince: string;
    proBadge: string;
    tabStats: string;
    tabHistory: string;
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
        canViewLocations: boolean;
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
        signOutButton: React.ReactNode;
    } | null;
    listedPacks: ProfileListedPack[];
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
    packs: (
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

const TAB_LABELS: Record<ProfileTab, string> = {
    history: "History",
    stats: "Stats",
    packs: "Packs",
    locations: "Locations"
};

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
        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-primary-200">{labels.wildProfileTitle}</p>
                <span className="text-xs font-semibold text-white/35">{labels.wildProfilePublic}</span>
            </div>
            {identity.headline ? <h2 className="mt-3 font-display text-2xl font-bold text-white">{identity.headline}</h2> : null}
            {identity.summary ? <p className="mt-2 text-sm leading-relaxed text-white/55">{identity.summary}</p> : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {roles.map(({key, role, label}) => (
                    <div key={key} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
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

function ProfileLocationsMap({visits}: {visits: ProfileLocationVisit[]}) {
    const plotted = visits.filter((visit) => visit.latitude != null && visit.longitude != null);
    if (!plotted.length) return null;
    const latitudes = plotted.map((visit) => visit.latitude!);
    const longitudes = plotted.map((visit) => visit.longitude!);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    const maxCount = Math.max(...plotted.map((visit) => visit.captureCount), 1);

    return (
        <div className="relative h-[28rem] overflow-hidden border-y border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(32,120,80,.18),transparent_32%),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),#111714] bg-[size:auto,32px_32px,32px_32px,auto]">
            {plotted.map((visit) => {
                const left = 8 + ((visit.longitude! - minLng) / lngSpan) * 84;
                const top = 8 + (1 - (visit.latitude! - minLat) / latSpan) * 84;
                const size = 34 + (visit.captureCount / maxCount) * 42;
                return (
                    <div
                        key={visit.id}
                        title={`${visit.label} · ${visit.captureCount} captures`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-100/45 bg-primary-400/25 shadow-[0_0_30px_rgba(56,250,71,.24)] backdrop-blur-[2px]"
                        style={{left: `${left}%`, top: `${top}%`, width: size, height: size}}
                    >
                        <span className="absolute inset-0 grid place-items-center text-[0.65rem] font-black text-white">{visit.captureCount}</span>
                    </div>
                );
            })}
            <p className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1.5 text-[0.62rem] font-bold text-white/55 backdrop-blur">
                Approximate locations
            </p>
        </div>
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
                style={{backgroundColor: "rgba(56,250,71,0.10)", color: THEME.neon}}
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
    listedPacks
}: ProfileContentProps) {
    const [activeTab, setActiveTab] = useState<ProfileTab>("history");
    const [activeChromePreset, setActiveChromePreset] = useState(profile.chromePreset);
    const [showProfileStyle, setShowProfileStyle] = useState(false);
    const [isSavingProfileStyle, setIsSavingProfileStyle] = useState(false);
    const [profileStyleError, setProfileStyleError] = useState<string | null>(null);
    const [chromeCollapsed, setChromeCollapsed] = useState(false);
    const [isWildInsightScope, setIsWildInsightScope] = useState(false);
    const [showHeadToHead, setShowHeadToHead] = useState(false);

    const speciesDenominator = profile.catalogSpeciesCount > 0 ? `/${profile.catalogSpeciesCount}` : undefined;
    const collectionValue = profile.collectionValueUsd != null && profile.collectionValueUsd > 0
        ? formatAppUsd(profile.collectionValueUsd, locale)
        : null;
    const friendPets = profile.recentCaptures
        .filter((capture) => capture.contextLabel === "Domestic" || capture.contextLabel === "Farm")
        .slice(0, 8);

    const tabs = useMemo<ProfileTab[]>(
        () => (profile.canViewLocations
            ? ["history", "stats", "packs", "locations"]
            : ["history", "stats", "packs"]),
        [profile.canViewLocations]
    );

    const binders = useMemo<ProfileBinder[]>(
        () => profile.powerSetCompletions.map((completion) => ({
            key: completion.powerKey,
            title: completion.powerLabel,
            found: completion.speciesCount,
            total: completion.catalogLinkedCount ?? completion.speciesCount,
            tier: completion.tier
        })),
        [profile.powerSetCompletions]
    );

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
            {title: "Unindexed captures", value: String(profile.unindexedCount), tint: "rgba(255,59,48,0.92)"},
            {
                title: "Indexed",
                value: String(profile.indexedSpeciesCount),
                tint: THEME.mint,
                denominator: speciesDenominator
            },
            {title: "Sets complete", value: String(binders.length), tint: "rgba(148,84,250,0.95)"},
            {
                title: "Challenges",
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
    }, [binders.length, profile, speciesDenominator]);

    useEffect(() => {
        const onScroll = () => {
            setChromeCollapsed(window.scrollY > 56);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    async function saveProfileStyle(preset: typeof activeChromePreset) {
        setIsSavingProfileStyle(true);
        setProfileStyleError(null);
        try {
            const response = await fetch("/api/app/profile", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({chromePreset: preset})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error ?? "Could not update profile style.");
            setActiveChromePreset(preset);
            setShowProfileStyle(false);
        } catch (error) {
            setProfileStyleError(error instanceof Error ? error.message : "Could not update profile style.");
        } finally {
            setIsSavingProfileStyle(false);
        }
    }

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {viewer.isLoggedIn && !viewer.isOwner && viewer.viewerUsername ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-white/45">
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
            <header className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
                {profile.avatarUrl ? (
                    <Image
                        src={profile.avatarUrl}
                        alt={`${profile.displayName}'s avatar`}
                        width={56}
                        height={56}
                        priority
                        className="h-14 w-14 shrink-0 rounded-2xl border border-white/15 object-cover shadow-lg shadow-black/30"
                    />
                ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary-300/20 bg-primary-400/10 font-display text-xl font-bold text-primary-100">
                        {profile.displayName.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate font-display text-xl font-bold text-white">{profile.displayName}</h1>
                        {profile.isPro ? (
                            <span className="shrink-0 rounded-full bg-primary-400 px-2 py-1 text-[0.62rem] font-black text-black">Pro</span>
                        ) : null}
                    </div>
                    <p className="truncate text-sm font-semibold text-white/45">@{profile.username}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {viewer.isLoggedIn && !viewer.isOwner ? (
                        <Link
                            href={`${localePrefix}/app/messages/${encodeURIComponent(profile.userId)}`}
                            aria-label="Message"
                            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white/[0.1]"
                        >
                            <span aria-hidden="true">💬</span>
                        </Link>
                    ) : null}
                    {viewer.isOwner ? (
                        <button
                            type="button"
                            onClick={() => setShowProfileStyle(true)}
                            aria-label={labels.editProfile}
                            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white/[0.1]"
                        >
                            <span aria-hidden="true">✎</span>
                        </button>
                    ) : null}
                    {shareButton}
                </div>
            </header>

            <div key={activeChromePreset} className="mt-6 motion-safe:animate-[profileChromeFade_220ms_ease-out]">
            {activeChromePreset === "spirit" ? (
                profile.wildIdentity
                    ? <WildIdentityCard identity={profile.wildIdentity} labels={labels} />
                    : viewer.isOwner ? (
                        <Link href={`${localePrefix}/app/train/wild-profile`} className="rounded-2xl border border-primary-300/20 bg-primary-400/[0.08] p-4">
                            <p className="font-display text-lg font-bold text-white">{labels.discoverWildProfileTitle}</p>
                            <p className="mt-1 text-sm text-white/55">{labels.discoverWildProfileDetail}</p>
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
                            {friendPets.map((capture) => (
                                <Link key={capture.id} href={capture.href} className="w-[4.75rem] shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-center">
                                    <Image src={capture.imageSrc} alt="" width={48} height={48} unoptimized className="mx-auto h-10 w-10 rounded-lg object-cover" />
                                    <p className="mt-1 truncate text-[0.68rem] font-black text-white">{capture.animalName}</p>
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
                        <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[0.55rem] font-black uppercase tracking-[0.12em] text-white/35">{title}</p>
                            <p className="mt-1 truncate font-display text-base font-bold text-primary-100">{value}</p>
                        </div>
                    ))}
                </section>
            ) : null}
            </div>
            </div>

            <nav aria-label="Profile sections" className="sticky top-16 z-20 -mx-4 border-b border-white/10 bg-black/95 backdrop-blur-xl md:top-0 md:-mx-8">
                <div className="grid" style={{gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`}}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab)}
                                aria-label={TAB_LABELS[tab]}
                                className="flex flex-col items-center gap-1.5 pt-2.5"
                            >
                                <span className={`flex h-5 items-center ${isActive ? "text-white" : "text-white/40"}`}>
                                    {TAB_ICONS[tab]}
                                </span>
                                <span className={`h-0.5 w-full ${isActive ? "bg-white" : "bg-transparent"}`} />
                            </button>
                        );
                    })}
                </div>
            </nav>

            {activeTab === "stats" ? (
                <div className="-mx-4 flex flex-col md:-mx-8">
                    <CollectorScoreCard
                        score={profile.collectorScore}
                        archetype={profile.collectionArchetype}
                        catalogCompletion={profile.catalogSpeciesCount > 0
                            ? {completed: profile.indexedSpeciesCount, total: profile.catalogSpeciesCount}
                            : null}
                        tradeUnlock={ownerExtras?.tradeUnlock ?? null}
                    />
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
                    />
                    <AverageTraitsCard stats={profile.averageTraits} />
                    <ProfileInsightsSection
                        insights={insights}
                        isWildScope={isWildInsightScope}
                        onToggleWildScope={setIsWildInsightScope}
                    />
                    <CompletedBindersSection
                        binders={binders}
                        href={viewer.isOwner ? `${localePrefix}/app/collection?segment=binders` : `${localePrefix}/app/collection`}
                    />
                    {!viewer.isOwner ? (
                        <StatsPanel className="px-[18px] py-4">
                            <p className="text-[11px] font-semibold uppercase text-white/40">{labels.userIdLabel}</p>
                            <p className="mt-1 break-all font-mono text-xs text-white/[0.62]">{profile.userId}</p>
                        </StatsPanel>
                    ) : null}
                    {viewer.isOwner && ownerExtras?.signOutButton ? (
                        <div className="px-4 pt-4 md:px-8">{ownerExtras.signOutButton}</div>
                    ) : null}
                </div>
            ) : null}

            {activeTab === "packs" ? (
                listedPacks.length === 0 ? (
                    <p className="px-[18px] py-7 text-center text-[15px] font-medium text-white/[0.62]">
                        {labels.packMarketplaceEmpty}
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {listedPacks.map((pack) => (
                            <div key={pack.id} className="rounded-[1.2rem] border border-white/10 bg-surface-900/60 p-4">
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
                                        className="shrink-0 rounded-xl bg-primary-400 px-3 py-2 text-xs font-black text-black"
                                    >
                                        {labels.packBuyInApp}
                                    </a>
                                </div>
                                <p className="mt-3 text-xs text-white/35">
                                    {labels.packListedBy.replace("{name}", profile.displayName)}
                                </p>
                            </div>
                        ))}
                    </div>
                )
            ) : null}

            {activeTab === "locations" ? (
                <div className="-mx-4 flex flex-col md:-mx-8">
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
                                        <div key={visit.id} className="w-52 shrink-0 rounded-[14px] border border-white/10 bg-[#1F1F1F] p-4">
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
                    {profile.recentCaptures.length === 0 ? (
                        <div className="mt-4 rounded-[1.35rem] border border-dashed border-white/10 px-6 py-10 text-center">
                            <h3 className="font-display text-2xl font-bold text-white">{labels.noPublicCapturesTitle}</h3>
                            <p className="mx-auto mt-3 max-w-xl text-sm text-white/45">
                                {labels.noPublicCapturesDescription.replace("{username}", profile.username)}
                            </p>
                        </div>
                    ) : (
                        <div className="-mx-4 grid grid-cols-3 gap-0.5 md:-mx-8">
                            {profile.recentCaptures.map((capture) => (
                                <Link key={capture.id} href={capture.href} className="group relative aspect-square overflow-hidden bg-white/[0.03]">
                                    <Image
                                        src={capture.imageSrc}
                                        alt={capture.animalName}
                                        fill
                                        unoptimized
                                        className="object-cover transition duration-300 group-hover:scale-105"
                                    />
                                    <span className="sr-only">{capture.animalName}</span>
                                </Link>
                            ))}
                        </div>
                    )}
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

            {showProfileStyle ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center" role="dialog" aria-modal="true" aria-label="Profile style">
                    <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#171717] p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="font-display text-2xl font-bold text-white">Profile style</h2>
                                <p className="mt-1 text-sm text-white/45">Choose what appears beneath your profile header.</p>
                            </div>
                            <button type="button" onClick={() => setShowProfileStyle(false)} className="text-sm font-bold text-primary-200">Close</button>
                        </div>
                        <div className="mt-5 grid gap-2">
                            {([
                                ["spirit", "Spirit profile", "Origin, Apex, and Active animals", "✦"],
                                ["friend", "Friend profile", "Your pets", "♥"],
                                ["professional", "Professional profile", "Bio, joined date, and Instagram", "▣"],
                                ["business", "Business profile", "Net worth, overall score, and catalog %", "↗"]
                            ] as const).map(([preset, title, detail, icon]) => (
                                <button
                                    key={preset}
                                    type="button"
                                    disabled={isSavingProfileStyle}
                                    onClick={() => saveProfileStyle(preset)}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                                        activeChromePreset === preset
                                            ? "border-primary-300/40 bg-primary-400/10"
                                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                                    }`}
                                >
                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] text-primary-100">{icon}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-white">{title}</span>
                                        <span className="mt-0.5 block text-xs text-white/45">{detail}</span>
                                    </span>
                                    {activeChromePreset === preset ? <span className="text-primary-200">✓</span> : null}
                                </button>
                            ))}
                        </div>
                        {profileStyleError ? <p className="mt-3 text-sm text-red-300">{profileStyleError}</p> : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
