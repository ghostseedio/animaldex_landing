"use client";

/** Port of the iOS `ProfileHeadToHeadSheet`. */

import Image from "next/image";
import {useEffect, useState} from "react";
import {
    THEME,
    TierDistributionCard,
    type TierDistributionRow
} from "@/app/[locale]/(composited)/u/[handle]/profile-stats-panels";
import type {ProfileBattleTierCounts} from "@/data/public-profiles";
import {formatDiscoveryDistance} from "@/lib/format-discovery-distance";

type ComparisonSide = {
    collectorScore: number;
    competitiveScore: number;
    powerSetScore: number;
    overallScore: number;
    indexedSpeciesCount: number;
    wildObservationCount: number;
    rareObservationCount: number;
    challengeWins: number;
    averageDominance: number | null;
    averageSpeed: number | null;
    averageSize: number | null;
    averageIntelligence: number | null;
    averageRarity: number | null;
    discoveryDistanceMeters: number | null;
};

type Comparison = {
    viewer: ComparisonSide;
    member: ComparisonSide;
    viewerTierCounts: ProfileBattleTierCounts;
    memberTierCounts: ProfileBattleTierCounts;
};

type Person = {
    displayName: string;
    username: string;
    avatarUrl: string | null;
};

function Avatar({person}: {person: Person}) {
    if (person.avatarUrl) {
        return (
            <Image
                src={person.avatarUrl}
                alt=""
                width={38}
                height={38}
                unoptimized
                className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
            />
        );
    }

    return (
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-white/[0.08] text-sm font-bold text-white/[0.62]">
            {person.displayName.slice(0, 1).toUpperCase()}
        </span>
    );
}

function ComparisonRow({
    label,
    viewer,
    member,
    viewerDisplay,
    memberDisplay
}: {
    label: string;
    viewer: number | null;
    member: number | null;
    viewerDisplay?: string | null;
    memberDisplay?: string | null;
}) {
    const viewerWins = (viewer ?? Number.NEGATIVE_INFINITY) > (member ?? Number.NEGATIVE_INFINITY);
    const memberWins = (member ?? Number.NEGATIVE_INFINITY) > (viewer ?? Number.NEGATIVE_INFINITY);
    const maximum = Math.max(Math.max(viewer ?? 0, member ?? 0), 1);

    return (
        <div className="flex flex-col gap-[9px] px-4 py-2.5 text-[15px] font-bold">
            <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-left" style={{color: viewerWins ? THEME.neon : "#ffffff"}}>
                    {viewerDisplay ?? viewer?.toString() ?? "–"}
                </span>
                <span className="min-w-0 flex-1 text-center text-xs font-medium text-white/[0.62]">{label}</span>
                <span className="w-16 shrink-0 text-right" style={{color: memberWins ? THEME.neon : "#ffffff"}}>
                    {memberDisplay ?? member?.toString() ?? "–"}
                </span>
            </div>
            <div className="flex h-[3px] items-stretch gap-1">
                <div className="flex flex-1 justify-end">
                    <span
                        className="rounded-full"
                        style={{
                            width: `${((viewer ?? 0) / maximum) * 100}%`,
                            backgroundColor: viewerWins ? THEME.neon : "rgba(255,255,255,0.16)"
                        }}
                    />
                </div>
                <div className="flex flex-1 justify-start">
                    <span
                        className="rounded-full"
                        style={{
                            width: `${((member ?? 0) / maximum) * 100}%`,
                            backgroundColor: memberWins ? THEME.neon : "rgba(255,255,255,0.16)"
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function ComparisonSection({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <section className="flex flex-col gap-2">
            <p className="px-4 text-[11px] font-semibold text-white/40">{title}</p>
            {children}
        </section>
    );
}

export default function ProfileHeadToHeadSheet({
    viewerPerson,
    memberPerson,
    memberUserId,
    onClose
}: {
    viewerPerson: Person;
    memberPerson: Person;
    memberUserId: string;
    onClose: () => void;
}) {
    const [comparison, setComparison] = useState<Comparison | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const response = await fetch(
                    `/api/app/profile/head-to-head?userId=${encodeURIComponent(memberUserId)}`
                );
                const payload = await response.json().catch(() => ({}));
                if (cancelled) return;
                if (!response.ok) {
                    setErrorMessage(payload.error ?? "Comparison unavailable.");
                    return;
                }
                setComparison(payload as Comparison);
            } catch {
                if (!cancelled) setErrorMessage("Comparison unavailable.");
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [memberUserId]);

    const tierRows: TierDistributionRow[] = comparison
        ? [
            {label: viewerPerson.displayName || "You", counts: comparison.viewerTierCounts},
            {label: memberPerson.displayName, counts: comparison.memberTierCounts}
        ]
        : [];
    const hasTierData = tierRows.some((row) =>
        Object.values(row.counts).some((count) => count > 0)
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:items-center md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Head to Head"
        >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden bg-black md:rounded-[1.5rem] md:border md:border-white/10">
                <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                    <h2 className="text-[17px] font-semibold text-white">Head to Head</h2>
                    <button type="button" onClick={onClose} className="text-[15px] font-semibold" style={{color: THEME.neon}}>
                        Done
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                    {errorMessage ? (
                        <div className="px-6 py-16 text-center">
                            <p className="text-[17px] font-semibold text-white">Comparison unavailable</p>
                            <p className="mt-2 text-sm text-white/[0.62]">{errorMessage}</p>
                        </div>
                    ) : !comparison ? (
                        <p className="px-6 py-16 text-center text-sm text-white/[0.62]">Comparing stats…</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2.5 px-4 text-[15px] font-extrabold text-white">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <Avatar person={viewerPerson} />
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <span className="text-[11px] font-semibold text-white/40">YOU</span>
                                        <span className="truncate">@{viewerPerson.username}</span>
                                    </div>
                                </div>
                                <span className="text-[11px] font-black" style={{color: THEME.neon}}>VS</span>
                                <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                                    <div className="flex min-w-0 flex-col items-end gap-0.5">
                                        <span className="text-[11px] font-semibold text-white/40">THEM</span>
                                        <span className="truncate">@{memberPerson.username}</span>
                                    </div>
                                    <Avatar person={memberPerson} />
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-2.5 px-4 py-[18px]">
                                <p className="text-[11px] font-semibold text-white/40">OVERALL COLLECTION SCORE</p>
                                <div className="flex w-full items-center text-[34px] font-black">
                                    <span
                                        style={{
                                            color: comparison.viewer.overallScore > comparison.member.overallScore
                                                ? THEME.neon
                                                : "#ffffff"
                                        }}
                                    >
                                        {comparison.viewer.overallScore}
                                    </span>
                                    <span className="mx-auto text-[10px] font-extrabold text-white/[0.62]">
                                        {comparison.viewer.overallScore === comparison.member.overallScore
                                            ? "TIED"
                                            : `LEADS BY ${Math.abs(comparison.viewer.overallScore - comparison.member.overallScore)}`}
                                    </span>
                                    <span
                                        style={{
                                            color: comparison.member.overallScore > comparison.viewer.overallScore
                                                ? THEME.neon
                                                : "#ffffff"
                                        }}
                                    >
                                        {comparison.member.overallScore}
                                    </span>
                                </div>
                            </div>

                            <ComparisonSection title="COLLECTION">
                                <ComparisonRow label="Collector score" viewer={comparison.viewer.collectorScore} member={comparison.member.collectorScore} />
                                <ComparisonRow label="Indexed species" viewer={comparison.viewer.indexedSpeciesCount} member={comparison.member.indexedSpeciesCount} />
                                <ComparisonRow label="Wild captures" viewer={comparison.viewer.wildObservationCount} member={comparison.member.wildObservationCount} />
                                <ComparisonRow label="Rare finds" viewer={comparison.viewer.rareObservationCount} member={comparison.member.rareObservationCount} />
                                <ComparisonRow
                                    label="Discovery distance"
                                    viewer={comparison.viewer.discoveryDistanceMeters}
                                    member={comparison.member.discoveryDistanceMeters}
                                    viewerDisplay={comparison.viewer.discoveryDistanceMeters != null
                                        ? formatDiscoveryDistance(comparison.viewer.discoveryDistanceMeters)
                                        : null}
                                    memberDisplay={comparison.member.discoveryDistanceMeters != null
                                        ? formatDiscoveryDistance(comparison.member.discoveryDistanceMeters)
                                        : null}
                                />
                            </ComparisonSection>

                            <ComparisonSection title="AVERAGE TRAITS">
                                <ComparisonRow label="Dominance" viewer={comparison.viewer.averageDominance} member={comparison.member.averageDominance} />
                                <ComparisonRow label="Speed" viewer={comparison.viewer.averageSpeed} member={comparison.member.averageSpeed} />
                                <ComparisonRow label="Size" viewer={comparison.viewer.averageSize} member={comparison.member.averageSize} />
                                <ComparisonRow label="Intelligence" viewer={comparison.viewer.averageIntelligence} member={comparison.member.averageIntelligence} />
                                <ComparisonRow label="Rarity" viewer={comparison.viewer.averageRarity} member={comparison.member.averageRarity} />
                            </ComparisonSection>

                            {hasTierData ? (
                                <div className="px-4">
                                    <TierDistributionCard
                                        title="BATTLE TIER SPREAD"
                                        rows={tierRows}
                                        showsRowLabels
                                        flush={false}
                                    />
                                </div>
                            ) : null}

                            <ComparisonSection title="ARENA">
                                <ComparisonRow label="Competitive score" viewer={comparison.viewer.competitiveScore} member={comparison.member.competitiveScore} />
                                <ComparisonRow label="Power sets" viewer={comparison.viewer.powerSetScore} member={comparison.member.powerSetScore} />
                                <ComparisonRow label="Challenge wins" viewer={comparison.viewer.challengeWins} member={comparison.member.challengeWins} />
                            </ComparisonSection>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
