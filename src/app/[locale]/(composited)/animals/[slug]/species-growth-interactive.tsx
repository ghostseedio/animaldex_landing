"use client";

import {useEffect, useMemo, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {apexGrowthMatchTitle, apexGrowthPresentation} from "@/data/apex-growth";
import type {FusionDonorCapture, SpeciesGrowthContext} from "@/data/species-growth";

type GrowthLabels = {
    apexPathEyebrow: string;
    apexInsightTitle: string;
    apexInsightDescription: string;
    useThisPower: string;
    acceptChallenge: string;
    challengeInProgress: string;
    challengeCompleted: string;
    challengeProofApp: string;
    challengeWaiting: string;
    wildProfileCta: string;
    refreshWildProfileCta: string;
    powerFusionTitle: string;
    powerFusionDescription: string;
    fusePowers: string;
    fusionCostLabel: string;
    fusionLearnedCount: string;
    fusionNoDonors: string;
    fusionSelectDonor: string;
    fusionSearchPlaceholder: string;
    fusionSubmit: string;
    fusionSuccess: string;
    bestFor: string;
    collectedAnimalsTitle: string;
    signInPrompt: string;
    signInButton: string;
    emptyCapturesTitle: string;
    emptyCapturesDescription: string;
    scoreLabel: string;
    openLesson: string;
    openPower: string;
};

type SpeciesGrowthInteractiveProps = {
    speciesSlug: string;
    speciesName: string;
    lessonSlug: string | null;
    qualitySlug: string | null;
    qualityName: string | null;
    growth: SpeciesGrowthContext;
    labels: GrowthLabels;
};

function challengeStatusLabel(status: string) {
    switch (status) {
        case "approved":
            return "Challenge approved";
        case "rejected":
            return "Try proof again";
        case "accepted":
            return "In progress";
        case "proof_submitted":
            return "Checking proof";
        case "generated":
            return "Challenge ready";
        default:
            return "Challenge ended";
    }
}

function ApexMatchCard({growth, labels}: {growth: SpeciesGrowthContext; labels: GrowthLabels}) {
    const match = growth.match;
    const isPublicPower = !growth.hasCapture;

    if (!match) {
        return null;
    }

    const accent = match.strength === "strong" || match.strength === "apexReached"
        ? "text-[#38fa47]"
        : match.strength === "partial"
            ? "text-cyan-300"
            : match.strength === "offPath"
                ? "text-orange-300"
                : "text-white/40";
    const title = isPublicPower
        ? match.strength === "strong"
            ? "A power for your Apex Path"
            : match.strength === "partial"
                ? "A possible Apex power"
                : match.strength === "powerUnavailable"
                    ? "Reading this Animal Power"
                    : "Explore this Animal Power"
        : apexGrowthMatchTitle(match);
    const explanation = isPublicPower
        ? match.strength === "strong" || match.strength === "partial"
            ? "This public capture shows a power that could support qualities on your path. Challenges use animals in your own collection."
            : match.strength === "offPath"
                ? "This public capture has a useful Animal Power, even though it is not one of the powers your path needs most right now."
                : match.strength === "powerUnavailable"
                    ? "This public capture's Animal Power is still loading."
                    : match.strength === "apexReached"
                        ? "Explore how this public capture's Animal Power works in the real world."
                        : "This is a public capture, so you can explore its Animal Power here. Personal Apex matches and challenges use your Wild Profile and animals you own."
        : match.reason;

    return (
        <section className={`rounded-[20px] border bg-[#1f1f1f] p-4 font-sans ${
            match.strength === "partial"
                ? "border-cyan-300/20"
                : match.strength === "offPath"
                    ? "border-orange-300/20"
                    : match.strength === "strong" || match.strength === "apexReached"
                        ? "border-[#38fa47]/20"
                        : "border-white/10"
        }`}>
            <div className="flex items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 ${accent}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                </svg>
                <p className="text-[11px] font-semibold uppercase text-white/40">
                    {isPublicPower ? "Public Animal Power" : labels.apexPathEyebrow}
                </p>
            </div>
            {!isPublicPower && growth.wildProfile?.apexAnimalName ? (
                <p className="mt-3 text-xs font-medium text-white">
                    You are training toward: {growth.wildProfile.apexAnimalName}
                </p>
            ) : null}
            <div className="mt-3 space-y-1.5">
                <h3 className="text-[17px] font-semibold text-white">{title}</h3>
                <p className="text-xs font-medium leading-5 text-white/60">{explanation}</p>
            </div>

            {match.matchedQualities.length > 0 ? (
                <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-white/40">This power can train</p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
                        {match.matchedQualities.map((quality) => (
                            <span key={quality.key} className="rounded-full border border-[#38fa47]/20 bg-black/15 px-2.5 py-2 text-[11px] font-semibold text-white">
                                {quality.label}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            {!isPublicPower && match.neededQualities.length > 0 ? (
                <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-white/40">Needed powers</p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
                        {match.neededQualities.slice(0, 3).map((quality) => (
                            <span key={quality.key} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-2 text-[11px] font-semibold text-white">
                                {quality.label}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            {isPublicPower ? (
                <p className="mt-3 flex items-center gap-2 text-[11px] font-semibold leading-5 text-white/40">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="5" y="10" width="14" height="10" rx="2" />
                        <path d="M9 10V7a4 4 0 0 1 7.3-2.3" strokeLinecap="round" />
                    </svg>
                    Own an animal with this power to use it in Growth challenges.
                </p>
            ) : null}
        </section>
    );
}

function PrincipleFusionModal({
    open,
    onClose,
    receiverCaptureId,
    donors,
    fusionCost,
    creditBalance,
    powerName,
    receiverName,
    receiverImageSrc,
    learnedCount,
    onSuccess
}: {
    open: boolean;
    onClose: () => void;
    receiverCaptureId: string;
    donors: FusionDonorCapture[];
    fusionCost: number;
    creditBalance: number | null;
    powerName: string;
    receiverName: string;
    receiverImageSrc: string | null;
    learnedCount: number;
    onSuccess: () => void;
}) {
    const [search, setSearch] = useState("");
    const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Record<string, any> | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) {
            return;
        }

        setResult(null);
        setError(null);
        setSearch("");
        setSelectedDonorId(donors.find((donor) => donor.principleName)?.captureId ?? null);
    }, [donors, open]);

    const filteredDonors = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return donors;
        }

        return donors.filter((donor) =>
            donor.animalName.toLowerCase().includes(query)
            || (donor.principleName?.toLowerCase().includes(query) ?? false)
            || (donor.principleExpression?.toLowerCase().includes(query) ?? false)
        );
    }, [donors, search]);

    if (!open) {
        return null;
    }

    const selectedDonor = donors.find((donor) => donor.captureId === selectedDonorId) ?? null;
    const canAfford = creditBalance == null || creditBalance >= fusionCost;
    const canSubmit = Boolean(selectedDonor?.principleName && canAfford && !isPending);
    const disabledReason = !selectedDonor
        ? "Choose a teacher first."
        : !selectedDonor.principleName
            ? "That teacher does not have an Animal Principle yet."
            : !canAfford
                ? `You need ${fusionCost} credits to fuse these principles.`
                : null;
    const learned = result?.result && typeof result.result === "object" ? result.result : result;
    const learnedName = String(learned?.learned_sub_principle_name ?? learned?.learnedSubPrincipleName ?? "Sub-principle learned");
    const learnedExpression = String(learned?.learned_sub_principle_expression ?? learned?.learnedSubPrincipleExpression ?? "");
    const boostParts = [
        learned?.primary_stat && Number(learned?.stat_boost_primary ?? 0) > 0
            ? `+${Number(learned.stat_boost_primary)} ${String(learned.primary_stat).replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase())}`
            : null,
        learned?.secondary_stat && Number(learned?.stat_boost_secondary ?? 0) > 0
            ? `+${Number(learned.stat_boost_secondary)} ${String(learned.secondary_stat).replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase())}`
            : null
    ].filter(Boolean);
    const statBoostSummary = String(learned?.stat_boost_summary ?? learned?.statBoostSummary ?? (boostParts.length > 0 ? boostParts.join(" · ") : "Scenario fit only"));
    const scenarioTags = Array.isArray(learned?.scenario_tags)
        ? learned.scenario_tags
        : Array.isArray(learned?.scenarioTags) ? learned.scenarioTags : [];
    const spent = Number(learned?.credit_cost ?? learned?.creditCost ?? fusionCost);
    const remainingBalance = Number(learned?.balance ?? result?.balance ?? Math.max(0, (creditBalance ?? spent) - spent));

    const close = () => {
        if (result) {
            onSuccess();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 font-sans md:items-center md:p-4">
            <div className="flex max-h-[96vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-black shadow-2xl md:max-h-[92vh] md:rounded-[22px]">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 px-5 py-4">
                    <button type="button" onClick={close} className="justify-self-start text-sm font-medium text-white/60">{result ? "Done" : "Cancel"}</button>
                    <h3 className="text-base font-semibold text-white">Fuse Principles</h3>
                    {!result ? (
                        <button type="button" disabled={!canSubmit} onClick={() => document.getElementById("fusion-submit")?.click()} className="justify-self-end text-sm font-semibold text-[#38fa47] disabled:text-white/30">
                            {isPending ? "Fusing..." : "Fuse"}
                        </button>
                    ) : <span />}
                </div>

                <div className="overflow-y-auto p-5">
                    <section className="rounded-lg border border-white/15 bg-[#1f1f1f] p-3.5">
                        <div className="flex items-start gap-3">
                            {receiverImageSrc ? <Image src={receiverImageSrc} alt={receiverName} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#121212] text-[#38fa47]">●</div>}
                            <div>
                                <p className="text-[11px] font-semibold text-white/40">Receiver</p>
                                <p className="mt-1 text-[17px] font-semibold text-white">{receiverName}</p>
                                <p className="mt-1 text-[15px] font-medium text-[#38fa47]">{powerName}</p>
                            </div>
                        </div>
                        <p className="mt-3 text-xs font-medium leading-5 text-white/60">The receiver keeps this main Animal Principle. Fusion adds one narrow sub-principle for future scenario matchups.</p>
                        <div className="mt-3 flex gap-2">
                            <span className="rounded-full border border-white/15 bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{fusionCost} credits</span>
                            <span className="rounded-full border border-white/15 bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{learnedCount} learned</span>
                        </div>
                    </section>

                    {error ? <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs font-medium leading-5 text-red-300">⚠ &nbsp; {error}</p> : null}

                    {result ? (
                        <section className="mt-4 rounded-lg border border-[#38fa47]/30 bg-[#1f1f1f] p-3.5">
                            <div className="flex items-center gap-3">
                                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#38fa47]/15 text-2xl text-[#38fa47]">✓</span>
                                <div>
                                    <p className="text-[11px] font-semibold text-[#38fa47]">SUB-PRINCIPLE LEARNED</p>
                                    <h4 className="mt-1 text-xl font-black text-white">{learnedName}</h4>
                                </div>
                            </div>
                            {learnedExpression ? <p className="mt-3 text-[15px] font-medium leading-6 text-white/60">{learnedExpression}</p> : null}
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <span className="rounded-lg border border-[#38fa47]/20 bg-[#38fa47]/10 p-2.5 text-[11px] font-semibold text-[#38fa47]">▥ &nbsp; {statBoostSummary}</span>
                                <span className="rounded-lg border border-orange-300/20 bg-orange-300/10 p-2.5 text-[11px] font-semibold text-orange-300">▣ &nbsp; {spent} credits spent</span>
                                <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-[11px] font-semibold text-cyan-300">▤ &nbsp; {remainingBalance} balance</span>
                            </div>
                            {scenarioTags.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{scenarioTags.slice(0, 5).map((tag: string) => <span key={tag} className="rounded-full bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{tag.replace(/_/g, " ")}</span>)}</div> : null}
                            <p className="mt-3 text-xs font-medium leading-5 text-white/40">{receiverName} learned from {selectedDonor?.animalName}. The teacher was not consumed.</p>
                        </section>
                    ) : (
                        <>
                            <div className="mt-4">
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachers" className="w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none focus:border-[#38fa47]/40" />
                                <p className="mb-2 mt-4 text-xs font-medium text-white/40">Choose a teacher</p>
                                <div className="space-y-2">
                                    {filteredDonors.length === 0 ? <p className="text-[15px] font-medium leading-6 text-white/60">No eligible owned animals are available. Donors need a catalog Animal Principle and comparison hearts.</p> : filteredDonors.map((donor) => {
                                        const selected = donor.captureId === selectedDonorId;
                                        return <button key={donor.captureId} type="button" disabled={!donor.principleName} onClick={() => { setSelectedDonorId(donor.captureId); setError(null); }} className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left ${selected ? "border-[#38fa47]/35 bg-[#38fa47]/10" : "border-white/15 bg-[#1f1f1f]"} disabled:opacity-55`}>
                                            <span className={`mt-3 text-lg ${selected ? "text-[#38fa47]" : "text-white/40"}`}>{selected ? "●" : "○"}</span>
                                            <Image src={donor.imageSrc} alt={donor.animalName} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
                                            <span className="min-w-0">
                                                <span className="block text-[15px] font-medium text-white">{donor.animalName}</span>
                                                <span className={`mt-1 block text-xs font-medium ${donor.principleName ? "text-[#38fa47]" : "text-white/40"}`}>{donor.principleName ?? "Loading Animal Principle"}</span>
                                                {donor.principleExpression ? <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/60">{donor.principleExpression}</span> : null}
                                            </span>
                                        </button>;
                                    })}
                                </div>
                            </div>

                            <section className="mt-4 rounded-lg border border-white/15 bg-[#1f1f1f] p-3.5">
                                <p className="text-xs font-medium text-white/40">Fusion path</p>
                                <div className="mt-3 grid grid-cols-[1fr_54px_1fr] items-center gap-2">
                                    <div className="rounded-lg border border-[#38fa47]/20 bg-[#38fa47]/[0.08] p-2.5"><p className="text-[11px] font-semibold text-[#38fa47]">RECEIVER</p><p className="mt-1 truncate text-xs font-semibold text-white">{receiverName}</p><p className="mt-2 text-[11px] font-semibold text-white/60">{powerName}</p></div>
                                    <div className={`text-center text-xl ${selectedDonor ? "text-[#38fa47]" : "text-white/40"}`}>→</div>
                                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] p-2.5"><p className="text-[11px] font-semibold text-cyan-300">TEACHER</p><p className="mt-1 truncate text-xs font-semibold text-white">{selectedDonor?.animalName ?? "Choose one"}</p><p className="mt-2 text-[11px] font-semibold text-white/60">{selectedDonor?.principleName ?? "Waiting"}</p></div>
                                </div>
                                {selectedDonor?.principleName ? <><p className="mt-3 text-[15px] font-medium text-white">{powerName} learns from {selectedDonor.principleName}</p><p className="mt-2 text-xs font-medium leading-5 text-white/60">{selectedDonor.animalName} is the teacher. The donor is not consumed, and the learned lesson only helps when the future scenario fits its tags and behavior.</p></> : <p className="mt-3 text-[15px] font-medium text-white/60">Pick a teacher to preview the principle pairing.</p>}
                            </section>

                            <button id="fusion-submit" type="button" disabled={!canSubmit} onClick={() => {
                                if (!selectedDonor) return;
                                setError(null);
                                startTransition(() => { void (async () => {
                                    const response = await fetch("/api/app/principle-fusion", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({receiverCaptureId, donorCaptureId: selectedDonor.captureId})});
                                    const payload = await response.json().catch(() => ({}));
                                    if (!response.ok) { setError(typeof payload.error === "string" ? payload.error : "Principle Fusion is unavailable right now."); return; }
                                    setResult(payload as Record<string, any>);
                                })(); });
                            }} className="mt-4 w-full rounded-lg bg-[#38fa47] px-4 py-3.5 text-[15px] font-semibold text-black disabled:bg-white/20 disabled:text-white/40">
                                {isPending ? "Fusing..." : "⚡  Fuse Principles"}
                            </button>
                            {disabledReason && !canSubmit ? <p className="mt-2 text-xs font-medium text-white/40">{disabledReason}</p> : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SpeciesGrowthInteractive({
    speciesName,
    growth,
    labels
}: SpeciesGrowthInteractiveProps) {
    const router = useRouter();
    const [fusionOpen, setFusionOpen] = useState(false);
    const [challengeError, setChallengeError] = useState<string | null>(null);
    const [comparisonError, setComparisonError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isComparisonPending, startComparisonTransition] = useTransition();

    const presentation = growth.match ? apexGrowthPresentation(growth.match) : null;
    const powerName = growth.principle?.principle ?? speciesName;
    const canFuse = Boolean(growth.primaryCaptureId && growth.principle && growth.fusionDonors.length > 0);
    const canChallenge = Boolean(growth.challengeRequest);

    const refresh = () => router.refresh();

    const startChallenge = () => {
        if (!growth.challengeRequest) {
            return;
        }

        setChallengeError(null);
        startTransition(() => {
            void (async () => {
                const response = await fetch("/api/app/apex-growth-challenge", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({action: "generate", ...growth.challengeRequest})
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    setChallengeError(typeof payload.error === "string"
                        ? payload.error
                        : "Today's challenge could not be prepared. Check your connection and try again.");
                    return;
                }

                refresh();
            })();
        });
    };

    const acceptChallenge = () => {
        if (!growth.challenge?.id) {
            return;
        }

        setChallengeError(null);
        startTransition(() => {
            void (async () => {
                const response = await fetch("/api/app/apex-growth-challenge", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({action: "accept", challengeId: growth.challenge?.id})
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    setChallengeError(typeof payload.error === "string"
                        ? payload.error
                        : "That update did not go through. Check your connection and try again.");
                    return;
                }

                refresh();
            })();
        });
    };

    const cardClass = "rounded-[20px] border border-white/10 bg-[#1f1f1f] p-4 font-sans";
    const microClass = "text-[11px] font-semibold text-white/40";
    const capsuleButtonClass = "flex w-full items-center justify-center rounded-full bg-[#38fa47] px-4 py-3 text-[15px] font-medium text-black disabled:opacity-50";
    const targetQuality = growth.match?.matchedQualities[0]?.label ?? growth.challenge?.targetQualityTag.replace(/-/g, " ");
    const comparison = growth.comparison;
    const comparisonEnabled = Boolean(comparison?.isDiscoverable && comparison.challengeHealth > 0);

    const updateComparison = (action: "restore" | "update", values: {isChallengeReady?: boolean; challengeStake?: number} = {}) => {
        if (!comparison?.isOwnedByCurrentUser) {
            return;
        }

        setComparisonError(null);
        startComparisonTransition(() => {
            void (async () => {
                const response = await fetch("/api/app/comparison-settings", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        action,
                        captureId: comparison.captureId,
                        isChallengeReady: values.isChallengeReady ?? comparison.isChallengeReady,
                        challengeStake: values.challengeStake ?? comparison.challengeStake
                    })
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    setComparisonError(typeof payload.error === "string" ? payload.error : "Comparison settings could not be updated.");
                    return;
                }

                refresh();
            })();
        });
    };

    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 font-sans">
            {growth.match && (!growth.hasCapture || (presentation !== "profileRequired" && presentation !== "pathUnavailable")) ? (
                <ApexMatchCard growth={growth} labels={labels} />
            ) : null}

            {growth.isAuthenticated && growth.hasCapture ? (
                <>
                    {presentation === "profileRequired" ? (
                        <section className={`${cardClass} border-[#38fa47]/20`}>
                            <p className={`${microClass} uppercase`}>⌾ &nbsp; Apex Insight</p>
                            <h3 className="mt-3 text-[17px] font-semibold text-white">Find your Apex Animal</h3>
                            <p className="mt-2 text-xs font-medium leading-5 text-white/60">Take the Wild Profile to unlock animal-powered challenges based on your growth path.</p>
                            <Link href={growth.wildProfileHref} className={`${capsuleButtonClass} mt-3`}>
                                Start Wild Profile
                            </Link>
                        </section>
                    ) : null}

                    {presentation === "pathUnavailable" ? (
                        <section className={`${cardClass} border-[#38fa47]/20`}>
                            <p className={`${microClass} uppercase`}>⌾ &nbsp; Apex Insight</p>
                            <h3 className="mt-3 text-[17px] font-semibold text-white">Refresh your Apex Path</h3>
                            <p className="mt-2 text-xs font-medium leading-5 text-white/60">Your profile needs quality targets before this animal can train your path.</p>
                            <Link href={growth.wildProfileHref} className={`${capsuleButtonClass} mt-3`}>
                                Refresh Profile
                            </Link>
                        </section>
                    ) : null}

                    {presentation === "offPath" && growth.match ? (
                        <section className={`${cardClass} border-orange-400/20`}>
                            <p className={`${microClass} uppercase`}>◉ &nbsp; Find the right power</p>
                            <p className="mt-3 text-xs font-medium leading-5 text-white/60">This animal teaches useful lessons, but your Apex path needs different powers right now.</p>
                            {growth.match.neededQualities.length > 0 ? (
                                <>
                                    <p className={`${microClass} mt-3`}>Needed powers</p>
                                    <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
                                        {growth.match.neededQualities.slice(0, 4).map((quality) => (
                                            <span key={quality.key} className="rounded-full border border-[#38fa47]/20 bg-black/20 px-2.5 py-1.5 text-[11px] font-semibold text-white">{quality.label}</span>
                                        ))}
                                    </div>
                                    <p className="mt-3 text-xs font-medium text-white/40">Try capturing or training animals with these powers.</p>
                                </>
                            ) : null}
                        </section>
                    ) : null}

                    {canChallenge && !growth.challenge ? (
                        <section className={`${cardClass} border-[#38fa47]/20`}>
                            <p className={`${microClass} uppercase`}>⚡ &nbsp; Apex Insight</p>
                            <h3 className="mt-3 text-[17px] font-semibold text-white">Use This Power</h3>
                            {growth.match?.matchedQualities.length ? (
                                <p className="mt-3 text-xs font-medium text-white/60">Powers this animal can train: {growth.match.matchedQualities.map((quality) => quality.label).join(" · ")}</p>
                            ) : null}
                            {targetQuality ? (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className={microClass}>Train this quality</span>
                                    <span className="rounded-full border border-[#38fa47]/20 bg-black/20 px-2.5 py-1.5 text-[11px] font-semibold capitalize text-white">{targetQuality}</span>
                                </div>
                            ) : null}
                            <p className="mt-3 text-xs font-medium leading-5 text-white/60">Turn {powerName} into one real-world move that helps your Apex path today.</p>
                            <button type="button" onClick={startChallenge} disabled={isPending} className={`${capsuleButtonClass} mt-3`}>
                                {isPending ? "Preparing Today's Challenge…" : "⌾  Start Apex Challenge"}
                            </button>
                            {challengeError ? <p className="mt-3 text-xs font-medium text-orange-300">{challengeError}</p> : null}
                        </section>
                    ) : null}

                    {growth.challenge ? (
                        <section className={`${cardClass} ${growth.challenge.status === "approved" ? "border-[#38fa47]/20" : "border-cyan-300/20"}`}>
                            <div className="flex items-center justify-between gap-3">
                                <p className={`${microClass} uppercase`}>⌾ &nbsp; Today&apos;s training</p>
                                <span className={`rounded-full bg-black/20 px-2 py-1 text-[11px] font-semibold uppercase ${growth.challenge.status === "approved" ? "text-[#38fa47]" : "text-white/60"}`}>
                                    {challengeStatusLabel(growth.challenge.status)}
                                </span>
                            </div>
                            <h3 className="mt-4 text-[17px] font-semibold text-white">{growth.challenge.challengeTitle}</h3>
                            {targetQuality ? (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className={`${microClass} uppercase`}>Target quality</span>
                                    <span className="rounded-full border border-[#38fa47]/20 bg-black/20 px-2.5 py-1.5 text-[11px] font-semibold capitalize text-white">{targetQuality}</span>
                                </div>
                            ) : null}
                            {growth.challenge.whyThisHelps ? (
                                <div className="mt-3 space-y-1.5">
                                    <p className={microClass}>Why this helps</p>
                                    <p className="text-xs font-medium leading-5 text-white/60">{growth.challenge.whyThisHelps}</p>
                                </div>
                            ) : null}
                            <div className="mt-3 flex items-start justify-between gap-4">
                                <span className={microClass}>Animal Power</span>
                                <span className="text-right text-xs font-medium text-white">{powerName}</span>
                            </div>
                            <div className="mt-3 rounded-[14px] border border-[#38fa47]/15 bg-black/15 p-3">
                                <p className="text-[11px] font-semibold uppercase text-[#38fa47]">➜ &nbsp; Your task</p>
                                <p className="mt-2 text-base leading-6 text-white">{growth.challenge.challengeInstruction}</p>
                            </div>
                            <div className="mt-3 rounded-[14px] border border-cyan-300/15 bg-black/15 p-3">
                                <p className="text-[11px] font-semibold uppercase text-cyan-300">▣ &nbsp; Proof needed</p>
                                <p className="mt-2 text-xs font-medium leading-5 text-white/60">Capture a live photo showing you did the task. Camera-roll uploads are disabled. An optional note can add context, but your photo is the main proof.</p>
                            </div>
                            {growth.challenge.proofValidationReason ? (
                                <p className="mt-3 rounded-[14px] bg-orange-400/[0.08] p-3 text-xs font-medium leading-5 text-orange-300">{growth.challenge.proofValidationReason}</p>
                            ) : null}
                            <div className={`mt-3 rounded-[14px] p-3 ${growth.challenge.status === "approved" ? "bg-[#38fa47]/10" : "bg-[#38fa47]/5"}`}>
                                <p className="text-[11px] font-semibold uppercase text-[#38fa47]">✦ &nbsp; {growth.challenge.status === "approved" ? "Rewards earned" : "Reward"}</p>
                                {(growth.challenge.status === "approved" ? growth.challenge.captureXPAward : growth.challenge.rewardXP) > 0 ? (
                                    <p className="mt-2 text-xs font-medium text-white">⊕ &nbsp; +{growth.challenge.status === "approved" ? growth.challenge.captureXPAward : growth.challenge.rewardXP} XP</p>
                                ) : null}
                                {growth.challenge.rewardStat ? <p className="mt-2 text-xs font-medium capitalize text-white">⊕ &nbsp; {growth.challenge.rewardStat} boost</p> : null}
                                {growth.challenge.status === "approved" && growth.challenge.qualityProgressAward > 0 ? (
                                    <p className="mt-2 text-xs font-medium capitalize text-white">⊕ &nbsp; +{growth.challenge.qualityProgressAward} {targetQuality} progress</p>
                                ) : growth.challenge.status !== "approved" ? (
                                    <p className="mt-2 text-xs font-medium text-white">⊕ &nbsp; Apex path progress</p>
                                ) : null}
                            </div>
                            {growth.challenge.status === "generated" ? (
                                <button type="button" onClick={acceptChallenge} disabled={isPending} className={`${capsuleButtonClass} mt-3`}>
                                    {isPending ? "Working…" : "✓  Accept Challenge"}
                                </button>
                            ) : null}
                            {growth.challenge.status === "accepted" || growth.challenge.status === "rejected" ? (
                                <p className="mt-3 rounded-full border border-[#38fa47]/30 px-4 py-3 text-center text-[15px] font-medium text-[#38fa47]">Open AnimalDex to take live proof</p>
                            ) : null}
                            {growth.challenge.status === "proof_submitted" ? <p className="mt-3 text-xs font-medium text-white/60">Checking your proof…</p> : null}
                            {growth.challenge.status === "approved" ? <p className="mt-3 text-xs font-medium text-[#38fa47]">✓ You trained {speciesName}.</p> : null}
                            {challengeError ? <p className="mt-3 text-xs font-medium text-orange-300">{challengeError}</p> : null}
                        </section>
                    ) : null}

                    {growth.principle ? (
                        <section className={`${cardClass} border-[#38fa47]/20 bg-[linear-gradient(145deg,rgba(56,250,71,0.18),rgba(56,250,71,0.10),#1f1f1f)]`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className={microClass}>△ &nbsp; Power Fusion</p>
                                    <h3 className="mt-1 text-[15px] font-semibold text-white">What else can be learned from {powerName}?</h3>
                                    <p className="mt-1 text-xs font-medium leading-5 text-white/60">Fuse animal powers together to see what else can be gained.</p>
                                    {growth.learnedPrinciples.length > 0 ? (
                                        <p className="mt-2 text-[11px] font-semibold text-[#38fa47]">
                                            {growth.learnedPrinciples.length} extra lesson{growth.learnedPrinciples.length === 1 ? "" : "s"} learned
                                        </p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    disabled={!canFuse}
                                    onClick={() => setFusionOpen(true)}
                                    className="shrink-0 rounded-full bg-[#38fa47] px-3 py-2 text-[11px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                    ⚡ Fuse Powers
                                </button>
                            </div>

                            {growth.learnedPrinciples.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                    {growth.learnedPrinciples.slice(0, 4).map((principle) => (
                                        <article key={principle.id} className="rounded-lg bg-[#121212]/70 p-2.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="text-[15px] font-semibold text-white">{principle.learnedSubPrincipleName}</h4>
                                                <span className="shrink-0 text-[11px] font-semibold text-[#38fa47]">{principle.statBoostSummary}</span>
                                            </div>
                                            <p className="mt-1 text-xs font-medium leading-5 text-white/60">{principle.learnedSubPrincipleExpression}</p>
                                            {principle.scenarioTags.length > 0 ? (
                                                <div className="mt-2 space-y-1.5">
                                                    <p className={microClass}>Best For</p>
                                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                                                        {principle.scenarioTags.map((tag) => (
                                                            <span key={tag} className="rounded-full border border-[#38fa47]/20 bg-black px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{tag.replace(/_/g, " ")}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                            {principle.sourceDisplayName ? (
                                                <p className="mt-2 text-[11px] font-semibold text-white/40">Learned from {principle.sourceDisplayName}</p>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    ) : null}
                </>
            ) : null}

            {comparison ? (
                <section className="mt-1 space-y-4 font-sans">
                    <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                        <div className="flex items-center gap-3">
                            <div className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-2 ${comparison.challengeHealth > 0 ? "border-[#38fa47]/20 bg-[#38fa47]/10 text-[#38fa47]" : "border-orange-400/20 bg-orange-400/10 text-orange-300"}`}>
                                <span className="flex gap-1">
                                    {[0, 1, 2].map((index) => (
                                        <svg key={index} aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill={index < comparison.challengeHealth ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                                            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                                        </svg>
                                    ))}
                                </span>
                                <span className="text-[11px] font-semibold">{comparison.challengeHealth}/3</span>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs font-medium text-white">{comparison.challengeHealth > 0 ? "Comparison hearts ready" : "Comparison hearts empty"}</h3>
                                <p className="mt-1 text-[11px] font-semibold leading-4 text-white/60">
                                    {comparison.challengeHealth > 0
                                        ? `${comparison.challengeHealth} of 3 hearts remaining. Each loss removes 1 heart.`
                                        : "This animal has no hearts left. Restore it to refill all 3 hearts."}
                                </p>
                            </div>
                        </div>
                        {comparison.challengeHealth === 0 && comparison.isOwnedByCurrentUser ? (
                            <button type="button" onClick={() => updateComparison("restore")} disabled={isComparisonPending} className={`${capsuleButtonClass} mt-3 rounded-[18px]`}>
                                {isComparisonPending ? "Restoring..." : "♡  Restore · 2 credits"}
                            </button>
                        ) : null}
                    </div>

                    {!comparison.isOwnedByCurrentUser ? (
                        <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                            <h3 className="flex items-center gap-2 text-xs font-medium text-white"><span className="text-[#38fa47]">✦</span> Available actions</h3>
                            <p className="mt-3 text-[11px] font-semibold leading-4 text-white/60">Compare this public animal when your deck meets the current rules.</p>
                            <Link href={growth.isAuthenticated ? "/app" : "/account"} className="mt-3 flex items-center gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                                <span className="text-cyan-300">⚡</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-white">Compare</span>
                                    <span className="mt-1 block text-[11px] font-semibold text-white/60">{comparison.isChallengeReady && comparison.challengeHealth > 0 ? `${comparison.challengeStake} credits` : "Unavailable"}</span>
                                </span>
                                <span className="text-white/40">›</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                type="button"
                                disabled={!comparisonEnabled || isComparisonPending}
                                onClick={() => updateComparison("update", {isChallengeReady: !comparison.isChallengeReady})}
                                className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-3.5 text-left disabled:opacity-70"
                            >
                                <span className={comparison.isChallengeReady ? "text-[#38fa47]" : "text-white/40"}>⚡</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-white">Available for comparisons</span>
                                    <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/60">
                                        {!comparison.isDiscoverable
                                            ? "This capture must stay public in Discover before it can enter scenario comparisons."
                                            : comparison.challengeHealth === 0
                                                ? "This capture is out of hearts. Restore it before changing its comparison settings again."
                                                : comparison.isChallengeReady
                                                    ? `Other players can compare against this animal for ${comparison.challengeStake} credits.`
                                                    : "Hidden from comparisons until you turn it on."}
                                    </span>
                                </span>
                                <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${comparison.isChallengeReady ? "border-[#38fa47]/25 bg-[#38fa47]/10 text-[#38fa47]" : "border-white/10 bg-white/5 text-white/40"}`}>
                                    {isComparisonPending ? "…" : comparison.isChallengeReady ? "ON" : "OFF"}
                                </span>
                            </button>

                            {comparison.isChallengeReady ? (
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-white">Confidence</span>
                                        <span className="text-[11px] font-semibold text-[#38fa47]">{comparison.challengeStake} credits</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[2, 5, 10].map((stake) => (
                                            <button
                                                key={stake}
                                                type="button"
                                                disabled={!comparisonEnabled || isComparisonPending || (growth.creditBalance != null && growth.creditBalance < stake && comparison.challengeStake !== stake)}
                                                onClick={() => updateComparison("update", {challengeStake: stake})}
                                                className={`rounded-full border py-2.5 text-xs font-bold disabled:opacity-45 ${comparison.challengeStake === stake ? "border-[#38fa47]/20 bg-[#38fa47] text-black" : "border-white/10 bg-white/5 text-white"}`}
                                            >
                                                {stake}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                    {comparisonError ? <p className="text-xs font-medium text-orange-300">{comparisonError}</p> : null}
                </section>
            ) : null}

            {growth.primaryCaptureId ? (
                <PrincipleFusionModal
                    open={fusionOpen}
                    onClose={() => setFusionOpen(false)}
                    receiverCaptureId={growth.primaryCaptureId}
                    donors={growth.fusionDonors}
                    fusionCost={growth.fusionCost}
                    creditBalance={growth.creditBalance}
                    powerName={powerName}
                    receiverName={speciesName}
                    receiverImageSrc={growth.primaryCaptureImageSrc}
                    learnedCount={growth.learnedPrincipleCount}
                    onSuccess={refresh}
                />
            ) : null}
        </div>
    );
}
