"use client";

import Image from "next/image";
import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {
    ProfileBestForTag,
    ProfileInsight,
    ProfileLocationVisit,
    ProfilePowerSetCompletion,
    PublicProfileCapture,
    PublicWildIdentity
} from "@/data/public-profiles";
import {getSpeciesImageRoute} from "@/data/species-images";
import type {
    ProfileCompletedSet,
    ProfileCreditsSummary,
    ProfileEndorsedCapture,
    ProfileListedPack,
    ProfileViewerState
} from "@/data/profile-authenticated";
import {getCollectorScoreBand} from "@/lib/collector-score";

export type ProfileTab = "stats" | "history";

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
        tradesMade: number;
        missionsCompleted: number;
        collectionValueUsd: number | null;
        bestForTagScores: ProfileBestForTag[];
        powerSetCompletions: ProfilePowerSetCompletion[];
        wildIdentity: PublicWildIdentity | null;
        insights: ProfileInsight[];
        locationVisits: ProfileLocationVisit[];
        topCaptures: PublicProfileCapture[];
        recentCaptures: PublicProfileCapture[];
    };
    labels: ProfileContentLabels;
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

function CaptureCard({capture, scoreLabel}: {capture: PublicProfileCapture; scoreLabel: string}) {
    return (
        <article className="group w-[11.5rem] shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-surface-900/80">
            <Link href={capture.href} className="relative block aspect-[3/4] overflow-hidden bg-black/30">
                <Image
                    src={capture.imageSrc}
                    alt={capture.animalName}
                    fill
                    unoptimized
                    className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute right-2.5 top-2.5 rounded-full bg-primary-400 px-2.5 py-1 text-[0.65rem] font-black text-black">
                    {scoreLabel.replace("{score}", String(capture.score))}
                </span>
            </Link>
            <div className="p-3.5">
                <h3 className="truncate font-display text-lg font-bold text-white">
                    <Link href={capture.href}>{capture.animalName}</Link>
                </h3>
            </div>
        </article>
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
    tradeUnlock
}: {
    score: number;
    archetype: string;
    labels: ProfileContentLabels;
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
            <p className="mt-3 font-display text-5xl font-bold text-white">{score.toLocaleString()}</p>
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
    labels
}: {
    wild: number;
    zoo: number;
    domestic: number;
    labels: ProfileContentLabels;
}) {
    const total = wild + zoo + domestic;
    const wildRatio = total > 0 ? wild / total : 1 / 3;
    const zooRatio = total > 0 ? zoo / total : 1 / 3;
    const domesticRatio = total > 0 ? 1 - wildRatio - zooRatio : 1 / 3;

    return (
        <section className="rounded-[1.35rem] border border-white/10 bg-surface-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{labels.wildVsZooVsDomestic}</p>
                <p className="text-xs font-semibold text-white/45">
                    {total === 0
                        ? labels.noCapturesYet
                        : `${wild} ${labels.settingWild.toLowerCase()} / ${zoo} ${labels.settingZoo.toLowerCase()} / ${domestic} ${labels.settingDomestic.toLowerCase()}`}
                </p>
            </div>
            <div className="mt-3 flex h-4 overflow-hidden rounded-2xl bg-white/[0.04]">
                <div className="bg-primary-400" style={{width: `${wildRatio * 100}%`}} />
                <div className="bg-amber-300" style={{width: `${zooRatio * 100}%`}} />
                <div className="bg-sky-300" style={{width: `${domesticRatio * 100}%`}} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-white/45">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary-400" />{labels.settingWild}</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />{labels.settingZoo}</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-300" />{labels.settingDomestic}</span>
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

function tierTint(tier: string) {
    switch (tier.toLowerCase()) {
        case "gold":
            return "border-amber-300/30 text-amber-200";
        case "silver":
            return "border-primary-300/30 text-primary-200";
        default:
            return "border-orange-300/30 text-orange-200";
    }
}

export default function ProfileContent({
    profile,
    labels,
    appStoreUrl,
    shareButton,
    localePrefix,
    viewer,
    ownerExtras,
    memberExtras
}: ProfileContentProps) {
    const [activeTab, setActiveTab] = useState<ProfileTab>("stats");
    const speciesDenominator = profile.catalogSpeciesCount > 0 ? `/${profile.catalogSpeciesCount}` : undefined;
    const collectionValue = profile.collectionValueUsd != null && profile.collectionValueUsd > 0
        ? new Intl.NumberFormat(undefined, {style: "currency", currency: "USD", maximumFractionDigits: 0}).format(profile.collectionValueUsd)
        : null;
    const completedSetsCount = ownerExtras?.completedSetsCount ?? 0;
    const overallScore = ownerExtras?.tradeUnlock != null
        ? ownerExtras.tradeUnlock.verifiedOverallScore
        : profile.collectorScore;

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {viewer.isLoggedIn && !viewer.isOwner && viewer.viewerUsername ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-white/45">
                    {labels.viewSignedInAs.replace("{username}", viewer.viewerUsername)}
                </p>
            ) : null}

            <header className="flex flex-col items-center gap-4 text-center">
                {profile.avatarUrl ? (
                    <Image
                        src={profile.avatarUrl}
                        alt={`${profile.displayName}'s avatar`}
                        width={280}
                        height={280}
                        priority
                        className="h-52 w-52 rounded-[2rem] border border-white/15 object-cover shadow-2xl shadow-black/30 md:h-64 md:w-64 md:rounded-[2.25rem]"
                    />
                ) : (
                    <div className="flex h-52 w-52 items-center justify-center rounded-[2rem] border border-primary-300/20 bg-primary-400/10 font-display text-6xl font-bold text-primary-100 md:h-64 md:w-64">
                        {profile.displayName.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">{labels.profileTitle}</p>
                    <h1 className="mt-2 font-display text-4xl font-bold text-white md:text-5xl">{profile.displayName}</h1>
                    <p className="mt-2 text-lg font-semibold text-white/55">@{profile.username}</p>
                    {profile.isPro ? (
                        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-400 px-3 py-1.5 text-xs font-black text-black">
                            {labels.proBadge}
                        </span>
                    ) : null}
                </div>
                {profile.joinedAtLabel ? (
                    <p className="text-sm font-semibold text-white/35">{labels.collectorSince.replace("{date}", profile.joinedAtLabel)}</p>
                ) : null}
                {profile.bio ? (
                    <p className="max-w-2xl text-sm leading-relaxed text-white/55">{profile.bio}</p>
                ) : null}
                {profile.instagramUrl && profile.instagramDisplay ? (
                    <a
                        href={profile.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-surface-900/70 px-4 py-3 text-sm font-semibold text-white hover:border-white/20"
                    >
                        Instagram
                        <span className="text-white/55">{profile.instagramDisplay}</span>
                    </a>
                ) : null}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {viewer.isLoggedIn && !viewer.isOwner ? (
                        <Link
                            href={`${localePrefix}/app/messages/${encodeURIComponent(profile.userId)}`}
                            className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl bg-primary-400 px-5 text-sm font-black text-black transition hover:bg-primary-200"
                        >
                            Message
                        </Link>
                    ) : null}
                    {viewer.isOwner ? (
                        <Link
                            href={`${localePrefix}/app/profile`}
                            className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl bg-primary-400 px-5 text-sm font-black text-black transition hover:bg-primary-200"
                        >
                            {labels.editProfile}
                        </Link>
                    ) : null}
                    {shareButton}
                    <a
                        href={appStoreUrl}
                        className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-white/10 bg-surface-900/70 px-5 text-sm font-black text-white transition hover:border-white/20"
                    >
                        {labels.openApp}
                    </a>
                </div>
            </header>

            {viewer.isOwner && ownerExtras?.credits ? (
                <Link
                    href={`${localePrefix}/app/missions`}
                    className={`flex items-center gap-4 rounded-[1.35rem] border px-4 py-4 transition hover:border-white/20 ${
                        ownerExtras.credits.isLow ? "border-orange-300/30 bg-orange-400/[0.08]" : "border-white/10 bg-surface-900/60"
                    }`}
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-400/15 text-lg">⚡</span>
                    <div className="min-w-0 text-left">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{labels.creditsTitle}</p>
                        <p className="mt-1 font-display text-xl font-bold text-white">
                            {ownerExtras.credits.hasProAccess
                                ? labels.creditsProActive
                                : labels.creditsAvailable.replace("{count}", String(ownerExtras.credits.balance))}
                        </p>
                    </div>
                    {ownerExtras.credits.isLow ? (
                        <span className="ml-auto rounded-full bg-orange-400/15 px-3 py-1 text-xs font-black text-orange-200">{labels.creditsLow}</span>
                    ) : null}
                </Link>
            ) : null}

            {viewer.isOwner ? (
                <Link
                    href={`${localePrefix}/app/collection`}
                    className="flex items-center gap-4 rounded-[1.35rem] border border-white/10 bg-surface-900/60 px-4 py-4 transition hover:border-white/20"
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/15 text-lg">🃏</span>
                    <div className="min-w-0 text-left">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{labels.myCollection}</p>
                        <p className="mt-1 text-sm text-white/55">{labels.myCollectionDetail}</p>
                    </div>
                </Link>
            ) : null}

            {viewer.isOwner && !profile.wildIdentity ? (
                <Link
                    href={`${localePrefix}/app/train/wild-profile`}
                    className="flex items-center gap-4 rounded-[1.35rem] border border-primary-300/20 bg-primary-400/[0.08] px-4 py-4 transition hover:border-primary-300/35"
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-400/20 text-lg">🐾</span>
                    <div className="min-w-0 text-left">
                        <p className="font-display text-lg font-bold text-white">{labels.discoverWildProfileTitle}</p>
                        <p className="mt-1 text-sm text-white/55">{labels.discoverWildProfileDetail}</p>
                    </div>
                </Link>
            ) : null}

            {profile.wildIdentity ? <WildIdentityCard identity={profile.wildIdentity} labels={labels} /> : null}

            <nav aria-label="Profile sections" className="rounded-[1.15rem] border border-white/[0.08] bg-surface-900/70 p-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                    {(["stats", "history"] as const).map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab)}
                                className={`min-h-[3rem] rounded-xl px-3 py-2.5 text-sm font-black transition ${
                                    isActive ? "bg-primary-400 text-black" : "text-white/45 hover:text-white"
                                }`}
                            >
                                {tab === "stats" ? labels.tabStats : labels.tabHistory}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {activeTab === "stats" ? (
                <div className="flex flex-col gap-4 md:gap-5">
                    <CollectorScoreCard
                        score={overallScore}
                        archetype={profile.collectionArchetype}
                        labels={labels}
                        tradeUnlock={ownerExtras?.tradeUnlock ?? null}
                    />
                    <SettingComparison wild={profile.wildCount} zoo={profile.zooCount} domestic={profile.domesticCount} labels={labels} />
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
                    {profile.powerSetCompletions.length > 0 ? (
                        <section>
                            <SectionHeader icon={<span>⚡</span>} title={labels.powerSetTitle} trailing={String(profile.powerSetCompletions.length)} />
                            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                {profile.powerSetCompletions.map((completion) => (
                                    <div
                                        key={`${completion.powerKey}-${completion.tier}`}
                                        className={`w-36 shrink-0 rounded-[1.1rem] border bg-surface-900/70 p-3.5 ${tierTint(completion.tier)}`}
                                    >
                                        <p className="text-[0.6rem] font-black uppercase tracking-[0.14em]">{completion.tier}</p>
                                        <p className="mt-2 line-clamp-2 font-display text-lg font-bold text-white">{completion.powerLabel}</p>
                                        <p className="mt-2 text-xs text-white/45">
                                            {labels.powerSetSpecies.replace("{count}", String(completion.speciesCount))}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            ) : (
                <div className="flex flex-col gap-6 md:gap-8">
                    {!viewer.isOwner && memberExtras && memberExtras.listedPacks.length > 0 ? (
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

                    {!viewer.isOwner && memberExtras && memberExtras.listedPacks.length === 0 ? (
                        <section className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                            {labels.packMarketplaceEmpty}
                        </section>
                    ) : null}

                    <section>
                        <SectionHeader
                            icon={<span>📍</span>}
                            title={labels.locationsTitle}
                            trailing={profile.locationVisits.length > 0 ? String(profile.locationVisits.length) : null}
                        />
                        {profile.locationVisits.length === 0 ? (
                            <p className="mt-4 text-sm text-white/45">{labels.locationsEmpty}</p>
                        ) : (
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
                        )}
                    </section>

                    {profile.topCaptures.length > 0 ? (
                        <section>
                            <SectionHeader icon={<span>🏆</span>} title={labels.topCapturesTitle} trailing={labels.topCapturesTrailing} />
                            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                {profile.topCaptures.map((capture) => (
                                    <CaptureCard key={capture.id} capture={capture} scoreLabel={labels.scoreLabel} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {viewer.isOwner && ownerExtras ? (
                        <section>
                            <SectionHeader
                                icon={<span>👍</span>}
                                title={labels.endorsedCapturesTitle}
                                trailing={ownerExtras.endorsedCaptures.length > 0 ? String(ownerExtras.endorsedCaptures.length) : null}
                            />
                            {ownerExtras.endorsedCaptures.length === 0 ? (
                                <p className="mt-4 text-sm text-white/45">{labels.endorsedCapturesEmpty}</p>
                            ) : (
                                <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                    {ownerExtras.endorsedCaptures.map((capture) => (
                                        <div key={capture.id} className="w-[11.5rem] shrink-0">
                                            <CaptureCard capture={capture} scoreLabel={labels.scoreLabel} />
                                            <p className="mt-2 rounded-full bg-cyan-400/10 px-3 py-1 text-center text-[0.65rem] font-black uppercase tracking-[0.12em] text-cyan-200">
                                                {labels.endorsedStatLabel.replace("{stat}", capture.endorsedStat)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    ) : null}

                    {viewer.isOwner && ownerExtras && ownerExtras.completedSets.length > 0 ? (
                        <section>
                            <SectionHeader
                                icon={<span>✓</span>}
                                title={labels.completedSetsTitle}
                                trailing={String(ownerExtras.completedSets.length)}
                            />
                            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                {ownerExtras.completedSets.map((set) => (
                                    <div key={set.key} className="w-64 shrink-0 rounded-[1.2rem] border border-white/10 bg-surface-900/60 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-primary-200">{set.tier}</p>
                                            <span className="text-xs font-semibold text-white/35">{set.found}/{set.total}</span>
                                        </div>
                                        <h3 className="mt-3 font-display text-2xl font-bold text-white">{set.title}</h3>
                                        <p className="mt-2 text-sm text-white/45">
                                            {labels.completedSetsSpecies.replace("{found}", String(set.found)).replace("{total}", String(set.total))}
                                        </p>
                                        <Link href={`${localePrefix}/app/sets`} className="mt-4 inline-flex text-sm font-bold text-primary-200 hover:text-primary-100">
                                            View sets →
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section>
                        <SectionHeader icon={<span>🕒</span>} title={labels.recentSightingsTitle} />
                        {profile.recentCaptures.length === 0 ? (
                            <div className="mt-4 rounded-[1.35rem] border border-dashed border-white/10 px-6 py-10 text-center">
                                <h3 className="font-display text-2xl font-bold text-white">{labels.noPublicCapturesTitle}</h3>
                                <p className="mx-auto mt-3 max-w-xl text-sm text-white/45">
                                    {labels.noPublicCapturesDescription.replace("{username}", profile.username)}
                                </p>
                            </div>
                        ) : (
                            <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
                                {profile.recentCaptures.map((capture) => (
                                    <CaptureCard key={capture.id} capture={capture} scoreLabel={labels.scoreLabel} />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <section className="rounded-[1.1rem] border border-white/10 bg-surface-900/50 px-4 py-3">
                <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-white/35">{labels.userIdLabel}</p>
                <p className="mt-1 break-all font-mono text-xs text-white/55">{profile.userId}</p>
            </section>

            {viewer.isOwner && ownerExtras?.signOutButton ? (
                <div className="pt-2">{ownerExtras.signOutButton}</div>
            ) : null}
        </div>
    );
}
