"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {
    ProfileBestForTag,
    ProfileInsight,
    ProfileLocationVisit,
    ProfilePowerSetCompletion,
    PublicProfileCapture,
    PublicWildIdentity
} from "@/data/public-profiles";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import type {
    ProfileCompletedSet,
    ProfileCreditsSummary,
    ProfileEndorsedCapture,
    ProfileListedPack,
    ProfileViewerState
} from "@/data/profile-authenticated";
import {getCollectorScoreBand} from "@/lib/collector-score";
import {formatAppInteger, formatAppUsd} from "@/lib/format-numbers";

export type ProfileTab = "history" | "stats" | "endorsed" | "packs" | "locations";

export type ProfileContentLabels = {
    profileTitle: string;
    editProfile: string;
    shareProfile: string;
    openApp: string;
    collectorSince: string;
    proBadge: string;
    tabStats: string;
    tabHistory: string;
    overallScore: string;
    scoreFootnote: string;
    wildVsZooVsDomestic: string;
    noCapturesYet: string;
    settingWild: string;
    settingZoo: string;
    settingDomestic: string;
    statCaptures: string;
    statSpecies: string;
    statUnindexed: string;
    statIndexed: string;
    statSetsComplete: string;
    statTradesMade: string;
    statMissionsComplete: string;
    netWorth: string;
    netWorthFootnote: string;
    qualitiesTitle: string;
    qualitiesEmpty: string;
    qualitiesTop: string;
    insightsTitle: string;
    keepScanning: string;
    powerSetTitle: string;
    powerSetSpecies: string;
    wildProfileTitle: string;
    wildProfilePublic: string;
    originLabel: string;
    apexLabel: string;
    activeLabel: string;
    locationsTitle: string;
    locationsEmpty: string;
    locationCaptures: string;
    topCapturesTitle: string;
    topCapturesTrailing: string;
    recentSightingsTitle: string;
    recentSightingsEmpty: string;
    userIdLabel: string;
    noPublicCapturesTitle: string;
    noPublicCapturesDescription: string;
    scoreLabel: string;
    creditsTitle: string;
    creditsProActive: string;
    creditsAvailable: string;
    creditsLow: string;
    myCollection: string;
    myCollectionDetail: string;
    signOut: string;
    signingOut: string;
    discoverWildProfileTitle: string;
    discoverWildProfileDetail: string;
    tradeUnlockTitle: string;
    tradeUnlockProgress: string;
    endorsedCapturesTitle: string;
    endorsedCapturesEmpty: string;
    endorsedStatLabel: string;
    completedSetsTitle: string;
    completedSetsSpecies: string;
    packMarketplaceTitle: string;
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
        collectionValueUsd: number | null;
        averageTraits: {
            dominance: number;
            speed: number;
            size: number;
            intelligence: number;
            rarity: number;
        };
        bestForTagScores: ProfileBestForTag[];
        powerSetCompletions: ProfilePowerSetCompletion[];
        wildIdentity: PublicWildIdentity | null;
        insights: ProfileInsight[];
        locationVisits: ProfileLocationVisit[];
        topCaptures: PublicProfileCapture[];
        recentCaptures: PublicProfileCapture[];
    };
    labels: ProfileContentLabels;
    locale: string;
    appStoreUrl: string;
    shareButton: React.ReactNode;
    localePrefix: string;
    viewer: ProfileViewerState;
    ownerExtras?: {
        credits: ProfileCreditsSummary | null;
        tradeUnlock: {verifiedOverallScore: number; requiredScore: number; tradeUnlocked: boolean} | null;
        endorsedCaptures: ProfileEndorsedCapture[];
        completedSets: ProfileCompletedSet[];
        completedSetsCount: number;
        signOutButton: React.ReactNode;
    } | null;
    memberExtras?: {
        listedPacks: ProfileListedPack[];
    } | null;
};

function InsightCaptureIcon({capture}: {capture: PublicProfileCapture}) {
    const iconSrc = capture.speciesSlug
        ? getSpeciesImageRoute(capture.speciesSlug)
        : capture.imageSrc;

    return (
        <Image
            src={iconSrc}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 shrink-0 rounded-lg border border-white/10 object-cover"
        />
    );
}

function SectionHeader({
    icon,
    title,
    trailing
}: {
    icon: React.ReactNode;
    title: string;
    trailing?: string | null;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary-200">
                    {icon}
                </span>
                <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
            </div>
            {trailing ? <span className="text-sm font-semibold text-white/45">{trailing}</span> : null}
        </div>
    );
}

function CollectorScoreCard({
    score,
    archetype,
    labels,
    locale,
    tradeUnlock
}: {
    score: number;
    archetype: string;
    labels: ProfileContentLabels;
    locale: string;
    tradeUnlock?: {verifiedOverallScore: number; requiredScore: number; tradeUnlocked: boolean} | null;
}) {
    const band = getCollectorScoreBand(score);
    const progressRatio = tradeUnlock && !tradeUnlock.tradeUnlocked && tradeUnlock.requiredScore > 0
        ? Math.min(1, tradeUnlock.verifiedOverallScore / tradeUnlock.requiredScore)
        : 0;

    return (
        <section className="overflow-hidden rounded-[1.65rem] border border-white/10 bg-[linear-gradient(145deg,rgba(24,32,27,0.98),rgba(10,14,12,0.98))] p-5 shadow-xl shadow-black/20 md:p-6">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">{labels.overallScore}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${band.accentClass} border-current/30 bg-current/10`}>
                    {band.tierLabel}
                </span>
            </div>
            <p className="mt-3 font-display text-5xl font-bold text-white">{formatAppInteger(score, locale)}</p>
            <p className="mt-2 text-lg font-semibold text-white/70">{archetype}</p>
            <p className="mt-1 text-sm text-white/40">{band.descriptor}</p>
            {tradeUnlock && !tradeUnlock.tradeUnlocked ? (
                <div className="mt-5 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">{labels.tradeUnlockTitle}</p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-primary-400" style={{width: `${Math.max(progressRatio * 100, 6)}%`}} />
                    </div>
                    <p className="text-xs text-white/45">
                        {labels.tradeUnlockProgress
                            .replace("{current}", String(tradeUnlock.verifiedOverallScore))
                            .replace("{required}", String(tradeUnlock.requiredScore))}
                    </p>
                </div>
            ) : (
                <p className="mt-5 text-xs leading-relaxed text-white/35">{labels.scoreFootnote}</p>
            )}
        </section>
    );
}

function SettingComparison({
    wild,
    zoo,
    domestic,
    farm,
    labels
}: {
    wild: number;
    zoo: number;
    domestic: number;
    farm: number;
    labels: ProfileContentLabels;
}) {
    const total = wild + zoo + domestic + farm;
    const wildRatio = total > 0 ? wild / total : 1 / 4;
    const zooRatio = total > 0 ? zoo / total : 1 / 4;
    const domesticRatio = total > 0 ? domestic / total : 1 / 4;
    const farmRatio = total > 0 ? farm / total : 1 / 4;

    return (
        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Wild vs zoo vs domestic vs farm</p>
                <p className="text-xs font-semibold text-white/45">
                    {total === 0
                        ? labels.noCapturesYet
                        : `${wild} wild / ${zoo} zoo / ${domestic} domestic / ${farm} farm`}
                </p>
            </div>
            <div className="mt-3 flex h-[4.5rem] overflow-hidden rounded-2xl bg-white/[0.04]">
                <div className="bg-primary-400" style={{width: `${wildRatio * 100}%`}} />
                <div className="bg-amber-300" style={{width: `${zooRatio * 100}%`}} />
                <div className="bg-sky-300" style={{width: `${domesticRatio * 100}%`}} />
                <div className="bg-orange-400" style={{width: `${farmRatio * 100}%`}} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-white/45">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary-400" />{labels.settingWild}</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />{labels.settingZoo}</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />{labels.settingDomestic}</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" />Farm</span>
            </div>
        </section>
    );
}

function StatChip({
    title,
    value,
    denominator,
    accentClass
}: {
    title: string;
    value: string;
    denominator?: string;
    accentClass: string;
}) {
    return (
        <div className="w-[7.25rem] shrink-0 rounded-[0.9rem] border border-white/10 bg-surface-900/70 px-2.5 py-2.5">
            <p className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-white/35">{title}</p>
            <p className="mt-1 font-display text-xl font-bold text-white">
                {value}
                {denominator ? <span className="ml-0.5 text-[0.55rem] font-bold text-white/35">{denominator}</span> : null}
            </p>
            <div className={`mt-2 h-0.5 rounded-full ${accentClass}`} />
        </div>
    );
}

function BestForChart({scores, labels}: {scores: ProfileBestForTag[]; labels: ProfileContentLabels}) {
    const maxScore = Math.max(...scores.map((score) => score.score), 1);

    return (
        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{labels.qualitiesTitle}</p>
                <p className="text-xs font-semibold text-white/45">{scores.length === 0 ? labels.qualitiesEmpty : labels.qualitiesTop}</p>
            </div>
            {scores.length === 0 ? (
                <p className="mt-4 text-sm text-white/45">{labels.qualitiesEmpty}</p>
            ) : (
                <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-1">
                    {scores.map((score) => (
                        <div key={score.tagKey} className="flex w-14 shrink-0 flex-col items-center gap-2">
                            <div className="flex h-32 w-full items-end rounded-xl bg-white/[0.03] px-1.5 py-2">
                                <div
                                    className="w-full rounded-md bg-gradient-to-t from-primary-500/80 to-primary-200"
                                    style={{height: `${Math.max((score.score / maxScore) * 100, 8)}%`}}
                                />
                            </div>
                            <p className="line-clamp-3 text-center text-[0.6rem] font-semibold leading-tight text-white/55">{score.tagLabel}</p>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function AverageTraitsCard({
    stats
}: {
    stats: {dominance: number; speed: number; size: number; intelligence: number; rarity: number};
}) {
    const entries = [
        ["Dominance", stats.dominance, "#fb7185"],
        ["Speed", stats.speed, "#22d3ee"],
        ["Size", stats.size, "#a78bfa"],
        ["Intelligence", stats.intelligence, "#67e8f9"],
        ["Rarity", stats.rarity, "#fb923c"]
    ] as const;
    const center = 80;
    const radius = 56;
    const point = (index: number, value: number) => {
        const angle = -Math.PI / 2 + index * ((Math.PI * 2) / entries.length);
        const scaled = radius * Math.min(100, Math.max(0, value)) / 100;
        return `${center + Math.cos(angle) * scaled},${center + Math.sin(angle) * scaled}`;
    };
    const framePoints = entries.map((_, index) => point(index, 100)).join(" ");
    const valuePoints = entries.map((entry, index) => point(index, entry[1])).join(" ");

    return (
        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
            <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Average traits</p>
                <p className="text-xs font-semibold text-white/45">Collection profile</p>
            </div>
            <div className="mt-4 grid grid-cols-[10rem_1fr] items-center gap-4">
                <svg viewBox="0 0 160 160" className="h-40 w-40" aria-label="Average collection traits radar">
                    <polygon points={framePoints} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
                    {[0.25, 0.5, 0.75].map((scale) => (
                        <polygon
                            key={scale}
                            points={entries.map((_, index) => point(index, scale * 100)).join(" ")}
                            fill="none"
                            stroke="rgba(255,255,255,.07)"
                            strokeWidth="1"
                        />
                    ))}
                    <polygon points={valuePoints} fill="rgba(56,250,71,.16)" stroke="#38fa47" strokeWidth="2" />
                </svg>
                <div className="space-y-2">
                    {entries.map(([label, value, color]) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                            <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: color}} />
                            <span className="min-w-0 flex-1 truncate text-white/55">{label}</span>
                            <span className="font-black text-white">{Math.round(value)}</span>
                        </div>
                    ))}
                </div>
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
        <div className="relative mt-4 h-[28rem] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(32,120,80,.18),transparent_32%),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),#111714] bg-[size:auto,32px_32px,32px_32px,auto]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(56,250,71,.04)_35%,rgba(56,250,71,.04)_37%,transparent_37%,transparent_62%,rgba(56,250,71,.035)_62%,rgba(56,250,71,.035)_64%,transparent_64%)]" />
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

export default function ProfileContent({
    profile,
    labels,
    locale,
    appStoreUrl,
    shareButton,
    localePrefix,
    viewer,
    ownerExtras,
    memberExtras
}: ProfileContentProps) {
    const [activeTab, setActiveTab] = useState<ProfileTab>("history");
    const [activeChromePreset, setActiveChromePreset] = useState(profile.chromePreset);
    const [showProfileStyle, setShowProfileStyle] = useState(false);
    const [isSavingProfileStyle, setIsSavingProfileStyle] = useState(false);
    const [profileStyleError, setProfileStyleError] = useState<string | null>(null);
    const [chromeCollapsed, setChromeCollapsed] = useState(false);
    const speciesDenominator = profile.catalogSpeciesCount > 0 ? `/${profile.catalogSpeciesCount}` : undefined;
    const collectionValue = profile.collectionValueUsd != null && profile.collectionValueUsd > 0
        ? formatAppUsd(profile.collectionValueUsd, locale)
        : null;
    const completedSetsCount = ownerExtras?.completedSetsCount ?? 0;
    const friendPets = profile.recentCaptures
        .filter((capture) => capture.contextLabel === "Domestic" || capture.contextLabel === "Farm")
        .slice(0, 8);

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

            <nav aria-label="Profile sections" className="sticky top-16 z-20 -mx-4 border-y border-white/[0.08] bg-black/95 px-4 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8">
                <div className="grid" style={{gridTemplateColumns: `repeat(${viewer.isOwner ? 4 : memberExtras ? 4 : 3}, minmax(0, 1fr))`}}>
                    {([
                        "history",
                        "stats",
                        ...(viewer.isOwner ? ["endorsed"] as const : memberExtras ? ["packs"] as const : []),
                        "locations"
                    ] as ProfileTab[]).map((tab) => {
                        const isActive = activeTab === tab;
                        const tabIcon = tab === "history" ? "▦" : tab === "stats" ? "▥" : tab === "endorsed" ? "♥" : tab === "packs" ? "◆" : "⌖";
                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab)}
                                aria-label={tab.charAt(0).toUpperCase() + tab.slice(1)}
                                className={`relative min-h-[3.25rem] px-3 py-2 text-lg font-black transition ${
                                    isActive ? "text-white" : "text-white/35 hover:text-white"
                                }`}
                            >
                                <span aria-hidden="true">{tabIcon}</span>
                                <span className={`absolute inset-x-2 bottom-0 h-0.5 ${isActive ? "bg-white" : "bg-transparent"}`} />
                            </button>
                        );
                    })}
                </div>
            </nav>

            {activeTab === "stats" ? (
                <div className="flex flex-col gap-4 md:gap-5">
                    <CollectorScoreCard
                        score={profile.collectorScore}
                        archetype={profile.collectionArchetype}
                        labels={labels}
                        locale={locale}
                        tradeUnlock={ownerExtras?.tradeUnlock ?? null}
                    />
                    <SettingComparison
                        wild={profile.wildCount}
                        zoo={profile.zooCount}
                        domestic={profile.domesticCount}
                        farm={profile.farmCount}
                        labels={labels}
                    />
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        <StatChip title={labels.statCaptures} value={String(profile.captureCount)} accentClass="bg-primary-400" />
                        <StatChip title={labels.statSpecies} value={String(profile.indexedSpeciesCount)} denominator={speciesDenominator} accentClass="bg-emerald-300" />
                        <StatChip title={labels.statUnindexed} value={String(profile.unindexedCount)} accentClass="bg-red-400/90" />
                        <StatChip title={labels.statIndexed} value={String(Math.max(profile.captureCount - profile.unindexedCount, 0))} accentClass="bg-emerald-300" />
                        {completedSetsCount > 0 ? (
                            <StatChip title={labels.statSetsComplete} value={String(completedSetsCount)} accentClass="bg-violet-300" />
                        ) : null}
                        <StatChip title={labels.statTradesMade} value={String(profile.tradesMade)} accentClass="bg-orange-300" />
                        <StatChip title={labels.statMissionsComplete} value={String(profile.missionsCompleted)} accentClass="bg-emerald-300" />
                    </div>
                    {collectionValue ? (
                        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{labels.netWorth}</p>
                            <p className="mt-2 font-display text-3xl font-bold text-emerald-300">{collectionValue}</p>
                            <p className="mt-2 text-xs text-white/35">{labels.netWorthFootnote}</p>
                        </section>
                    ) : null}
                    <BestForChart scores={profile.bestForTagScores} labels={labels} />
                    <AverageTraitsCard stats={profile.averageTraits} />
                    <section>
                        <SectionHeader icon={<span>✦</span>} title={labels.insightsTitle} />
                        <div className="mt-4 grid gap-2">
                            {profile.insights.map((insight) => (
                                <div key={insight.title} className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/10 bg-surface-900/60 px-4 py-3.5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">{insight.title}</p>
                                    {insight.capture ? (
                                        <Link href={insight.capture.href} className="flex min-w-0 items-center gap-2.5 hover:text-primary-200">
                                            <InsightCaptureIcon capture={insight.capture} />
                                            <span className="truncate font-display text-lg font-bold text-white">
                                                {insight.capture.animalName}
                                            </span>
                                        </Link>
                                    ) : (
                                        <p className="font-display text-lg font-bold text-white/45">{labels.keepScanning}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                    {viewer.isOwner && ownerExtras && ownerExtras.completedSets.length > 0 ? (
                        <section>
                            <SectionHeader
                                icon={<span>✓</span>}
                                title={labels.completedSetsTitle}
                                trailing={String(ownerExtras.completedSets.length)}
                            />
                            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                {ownerExtras.completedSets.map((set) => (
                                    <Link
                                        key={set.key}
                                        href={`${localePrefix}/app/collection?segment=binders`}
                                        className="w-60 shrink-0 rounded-[1.2rem] border border-white/10 bg-surface-900/60 p-4"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-primary-200">{set.tier}</p>
                                            <span className="text-xs font-semibold text-white/35">{set.found}/{set.total}</span>
                                        </div>
                                        <h3 className="mt-3 font-display text-xl font-bold text-white">{set.title}</h3>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            ) : (
                <div className="flex flex-col gap-6 md:gap-8">
                    {activeTab === "packs" && !viewer.isOwner && memberExtras && memberExtras.listedPacks.length > 0 ? (
                        <section>
                            <SectionHeader icon={<span>📦</span>} title={labels.packMarketplaceTitle} trailing={String(memberExtras.listedPacks.length)} />
                            <div className="mt-4 grid gap-3">
                                {memberExtras.listedPacks.map((pack) => (
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
                        </section>
                    ) : null}

                    {activeTab === "packs" && !viewer.isOwner && memberExtras && memberExtras.listedPacks.length === 0 ? (
                        <section className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                            {labels.packMarketplaceEmpty}
                        </section>
                    ) : null}

                    {activeTab === "locations" ? <section>
                        <SectionHeader
                            icon={<span>📍</span>}
                            title={labels.locationsTitle}
                            trailing={profile.locationVisits.length > 0 ? String(profile.locationVisits.length) : null}
                        />
                        {profile.locationVisits.length === 0 ? (
                            <p className="mt-4 text-sm text-white/45">{labels.locationsEmpty}</p>
                        ) : (
                            <>
                                <ProfileLocationsMap visits={profile.locationVisits} />
                                <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                    {profile.locationVisits.map((visit) => (
                                        <div key={visit.id} className="w-52 shrink-0 rounded-[1.1rem] border border-white/10 bg-surface-900/60 p-4">
                                            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                                                {labels.locationCaptures.replace("{count}", String(visit.captureCount))}
                                            </p>
                                            <p className="mt-2 line-clamp-3 text-sm font-semibold text-white">{visit.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </section> : null}

                    {activeTab === "endorsed" && viewer.isOwner && ownerExtras ? (
                        <section>
                            <SectionHeader
                                icon={<span>👍</span>}
                                title={labels.endorsedCapturesTitle}
                                trailing={ownerExtras.endorsedCaptures.length > 0 ? String(ownerExtras.endorsedCaptures.length) : null}
                            />
                            {ownerExtras.endorsedCaptures.length === 0 ? (
                                <p className="mt-4 text-sm text-white/45">{labels.endorsedCapturesEmpty}</p>
                            ) : (
                                <div className="-mx-4 mt-4 grid grid-cols-3 gap-0.5 md:-mx-8">
                                    {ownerExtras.endorsedCaptures.map((capture) => (
                                        <Link key={capture.id} href={capture.href} className="group relative aspect-square overflow-hidden bg-white/[0.03]">
                                            <Image src={capture.imageSrc} alt={capture.animalName} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
                                            <p className="absolute inset-x-1 bottom-1 rounded-full bg-black/65 px-2 py-1 text-center text-[0.55rem] font-black uppercase tracking-[0.08em] text-cyan-100 backdrop-blur-sm">
                                                {labels.endorsedStatLabel.replace("{stat}", capture.endorsedStat)}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    ) : null}

                    {activeTab === "history" ? <section>
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
                    </section> : null}
                </div>
            )}

            {activeTab === "stats" ? <section className="rounded-[1.1rem] border border-white/10 bg-surface-900/50 px-4 py-3">
                <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-white/35">{labels.userIdLabel}</p>
                <p className="mt-1 break-all font-mono text-xs text-white/55">{profile.userId}</p>
            </section> : null}

            {activeTab === "stats" && viewer.isOwner && ownerExtras?.signOutButton ? (
                <div className="pt-2">{ownerExtras.signOutButton}</div>
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
