"use client";

import {useEffect, useMemo, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import type {FusionDonorCapture, SpeciesGrowthContext} from "@/data/species-growth";
import {usePlayEligibility} from "@/components/animal-detail/animal-powers/use-animal-power";
import {FusedPowersSlot} from "@/components/animal-detail/fused-powers/fused-powers-section";
import {useFusedPowersContext} from "@/components/animal-detail/fused-powers/fused-powers-context";
import {FUSED_COPY, whenEarnedLine, statDisplayName} from "@/lib/fused-powers";
import {gateIsLocked, powerGateAnalytics} from "@/lib/animal-powers";

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
    compareOnly?: boolean;
    layout?: "compact" | "wide";
    settingTag?: string | null;
    labels: GrowthLabels;
};

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
    receiverLocked,
    onEarnPower,
    onSuccess
}: {
    open: boolean;
    onClose: () => void;
    /**
     * The RECEIVER's Power gate. The donor is unaffected — it is material you
     * already own, not the animal being enhanced. Shown only for `not_earned`:
     * the two fail-open states let Fusion proceed and must never be dressed up
     * as a lock the person could open.
     */
    receiverLocked: boolean;
    /** "Talk to it": the Power is earned with the animal, in its chat (3.2). */
    onEarnPower: () => void;
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
    const canSubmit = Boolean(!receiverLocked && selectedDonor?.principleName && canAfford && !isPending);
    const disabledReason = receiverLocked
        ? `Earn ${powerName} to unlock Fusion for this animal.`
        : !selectedDonor
        ? "Choose a teacher first."
        : !selectedDonor.principleName
            ? "That teacher does not have an Animal Principle yet."
            : !canAfford
                ? `You need ${fusionCost} credits to fuse these principles.`
                : null;
    const learned = result?.result && typeof result.result === "object" ? result.result : result;
    const learnedName = String(learned?.learned_sub_principle_name ?? learned?.learnedSubPrincipleName ?? "Sub-principle learned");
    const learnedExpression = String(learned?.learned_sub_principle_expression ?? learned?.learnedSubPrincipleExpression ?? "");
    // The boost is off until the fused Power's Training and Trial are done,
    // so it reads "+1 Intelligence when earned", never as already active.
    const boostParts = [
        learned?.primary_stat && Number(learned?.stat_boost_primary ?? 0) > 0
            ? whenEarnedLine(Number(learned.stat_boost_primary), statDisplayName(String(learned.primary_stat)))
            : null,
        learned?.secondary_stat && Number(learned?.stat_boost_secondary ?? 0) > 0
            ? whenEarnedLine(Number(learned.stat_boost_secondary), statDisplayName(String(learned.secondary_stat)))
            : null
    ].filter(Boolean);
    const statBoostSummary = boostParts.length > 0
        ? boostParts.join(" · ")
        : String(learned?.stat_boost_summary ?? learned?.statBoostSummary ?? "Situational");
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
            <div className="flex max-h-[96vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-black shadow-2xl md:max-h-[92vh] md: ">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 px-5 py-4">
                    <button type="button" onClick={close} className="justify-self-start text-sm font-medium text-white/60">{result ? "Done" : "Cancel"}</button>
                    <h3 className="text-base font-semibold text-white">Fuse Principles</h3>
                    {!result ? (
                        <button type="button" disabled={!canSubmit} onClick={() => document.getElementById("fusion-submit")?.click()} className="justify-self-end text-sm font-semibold text-primary-400 disabled:text-white/30">
                            {isPending ? "Fusing..." : "Fuse"}
                        </button>
                    ) : <span />}
                </div>

                <div className="overflow-y-auto p-5">
                    <section className="rounded-lg border border-white/15 bg-[#1f1f1f] p-3.5">
                        <div className="flex items-start gap-3">
                            {receiverImageSrc ? <Image src={receiverImageSrc} unoptimized alt={receiverName} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#121212] text-primary-400">●</div>}
                            <div>
                                <p className="text-[11px] font-semibold text-white/40">Receiver</p>
                                <p className="mt-1 text-[17px] font-semibold text-white">{receiverName}</p>
                                <p className="mt-1 text-[15px] font-medium text-primary-400">{powerName}</p>
                            </div>
                        </div>
                        <p className="mt-3 text-xs font-medium leading-5 text-white/60">The receiver keeps its own Power. Fusion adds one narrow lesson learned from the other animal.</p>
                        <div className="mt-3 flex gap-2">
                            <span className="rounded-full border border-white/15 bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{fusionCost} credits</span>
                            <span className="rounded-full border border-white/15 bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{learnedCount} learned</span>
                        </div>
                    </section>

                    {receiverLocked && !result ? (
                        // Locked Fusion, with the route out: the animal's chat,
                        // where one step done together earns its Power.
                        <button
                            type="button"
                            onClick={onEarnPower}
                            className="mt-4 flex w-full items-start gap-3 rounded-[18px] border border-primary-400/30 bg-white/[0.04] p-3.5 text-left"
                        >
                            <span aria-hidden="true" className="w-[22px] text-center text-sm text-white/40">🔒</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-white">Fusion is locked</span>
                                <span className="mt-0.5 block text-[10px] leading-4 text-white/60">Earn {powerName} to unlock Fusion for this animal.</span>
                            </span>
                            <span className="shrink-0 text-[11px] font-bold text-primary-400">Talk to it ›</span>
                        </button>
                    ) : null}

                    {error ? <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs font-medium leading-5 text-red-300">⚠ &nbsp; {error}</p> : null}

                    {result ? (
                        <section className="mt-4 rounded-lg border border-primary-400/30 bg-[#1f1f1f] p-3.5">
                            <div className="flex items-center gap-3">
                                <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-400/15 text-2xl text-primary-400">✓</span>
                                <div>
                                    <p className="text-[11px] font-semibold text-primary-400">SUB-PRINCIPLE LEARNED</p>
                                    <h4 className="mt-1 text-xl font-black text-white">{learnedName}</h4>
                                </div>
                            </div>
                            {learnedExpression ? <p className="mt-3 text-[15px] font-medium leading-6 text-white/60">{learnedExpression}</p> : null}
                            <p className="mt-3 text-xs font-semibold leading-5 text-primary-400">{FUSED_COPY.fusionResultLine}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <span className="rounded-lg border border-primary-400/20 bg-primary-400/10 p-2.5 text-[11px] font-semibold text-primary-400">▥ &nbsp; {statBoostSummary}</span>
                                <span className="rounded-lg border border-orange-300/20 bg-orange-300/10 p-2.5 text-[11px] font-semibold text-orange-300">▣ &nbsp; {spent} credits spent</span>
                                <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-[11px] font-semibold text-cyan-300">▤ &nbsp; {remainingBalance} balance</span>
                            </div>
                            {scenarioTags.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{scenarioTags.slice(0, 5).map((tag: string) => <span key={tag} className="rounded-full bg-[#121212] px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{tag.replace(/_/g, " ")}</span>)}</div> : null}
                            <p className="mt-3 text-xs font-medium leading-5 text-white/40">{receiverName} learned from {selectedDonor?.animalName}. The teacher was not consumed.</p>
                        </section>
                    ) : (
                        <>
                            <div className="mt-4">
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachers" className="w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none focus:border-primary-400/40" />
                                <p className="mb-2 mt-4 text-xs font-medium text-white/40">Choose a teacher</p>
                                <div className="space-y-2">
                                    {filteredDonors.length === 0 ? <p className="text-[15px] font-medium leading-6 text-white/60">No eligible owned animals are available. A teacher needs a Power and at least 1 heart.</p> : filteredDonors.map((donor) => {
                                        const selected = donor.captureId === selectedDonorId;
                                        return <button key={donor.captureId} type="button" disabled={!donor.principleName} onClick={() => { setSelectedDonorId(donor.captureId); setError(null); }} className={`flex w-full items-start gap-2.5 rounded-lg border p-3 text-left ${selected ? "border-primary-400/35 bg-primary-400/10" : "border-white/15 bg-[#1f1f1f]"} disabled:opacity-55`}>
                                            <span className={`mt-3 text-lg ${selected ? "text-primary-400" : "text-white/40"}`}>{selected ? "●" : "○"}</span>
                                            <Image src={donor.imageSrc} unoptimized alt={donor.animalName} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
                                            <span className="min-w-0">
                                                <span className="block text-[15px] font-medium text-white">{donor.animalName}</span>
                                                <span className={`mt-1 block text-xs font-medium ${donor.principleName ? "text-primary-400" : "text-white/40"}`}>{donor.principleName ?? "Loading Animal Principle"}</span>
                                                {donor.principleExpression ? <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/60">{donor.principleExpression}</span> : null}
                                            </span>
                                        </button>;
                                    })}
                                </div>
                            </div>

                            <section className="mt-4 rounded-lg border border-white/15 bg-[#1f1f1f] p-3.5">
                                <p className="text-xs font-medium text-white/40">Fusion path</p>
                                <div className="mt-3 grid grid-cols-[1fr_54px_1fr] items-center gap-2">
                                    <div className="rounded-lg border border-primary-400/20 bg-primary-400/[0.08] p-2.5"><p className="text-[11px] font-semibold text-primary-400">RECEIVER</p><p className="mt-1 truncate text-xs font-semibold text-white">{receiverName}</p><p className="mt-2 text-[11px] font-semibold text-white/60">{powerName}</p></div>
                                    <div className={`text-center text-xl ${selectedDonor ? "text-primary-400" : "text-white/40"}`}>→</div>
                                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] p-2.5"><p className="text-[11px] font-semibold text-cyan-300">TEACHER</p><p className="mt-1 truncate text-xs font-semibold text-white">{selectedDonor?.animalName ?? "Choose one"}</p><p className="mt-2 text-[11px] font-semibold text-white/60">{selectedDonor?.principleName ?? "Waiting"}</p></div>
                                </div>
                                {selectedDonor?.principleName ? <><p className="mt-3 text-[15px] font-medium text-white">{powerName} learns from {selectedDonor.principleName}</p><p className="mt-2 text-xs font-medium leading-5 text-white/60">{selectedDonor.animalName} is the teacher. The teacher is not used up, and the learned lesson fits the situations in its tags.</p></> : <p className="mt-3 text-[15px] font-medium text-white/60">Pick a teacher to preview the principle pairing.</p>}
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
                            }} className="mt-4 w-full rounded-lg bg-primary-400 px-4 py-3.5 text-[15px] font-semibold text-black disabled:bg-white/20 disabled:text-white/40">
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
    compareOnly = false,
    layout = "compact",
    settingTag,
    labels
}: SpeciesGrowthInteractiveProps) {
    const router = useRouter();
    const [fusionOpen, setFusionOpen] = useState(false);
    // The receiver's Power gate. Null until the read lands, and a failed read
    // leaves Fusion open under the existing rules — the server is the authority.
    const play = usePlayEligibility(Boolean(growth.isAuthenticated && growth.primaryCaptureId));
    const receiverPlay = growth.primaryCaptureId
        ? play.eligibility?.[growth.primaryCaptureId.toLowerCase()] ?? null
        : null;
    const receiverLocked = Boolean(receiverPlay && gateIsLocked(receiverPlay.powerGateStatus));
    const receiverSpeciesProfileId = receiverPlay?.canonicalSpeciesProfileId ?? null;

    useEffect(() => {
        if (fusionOpen && receiverLocked) powerGateAnalytics.lockedFusionImpression(receiverSpeciesProfileId);
    }, [fusionOpen, receiverLocked, receiverSpeciesProfileId]);

    const powerName = growth.principle?.principle ?? speciesName;
    const canFuse = Boolean(growth.primaryCaptureId && growth.principle && growth.fusionDonors.length > 0);

    const fusedPowers = useFusedPowersContext();

    const wide = layout === "wide";
    const refresh = () => router.refresh();

    const microClass = "text-[11px] font-semibold text-white/40";
    const normalizedSetting = settingTag?.trim().toLowerCase();
    const fusionTint = normalizedSetting === "wild"
        ? "56,250,71"
        : normalizedSetting === "zoo"
            ? "250,219,71"
            : normalizedSetting === "domestic"
                ? "140,199,255"
                : normalizedSetting === "farm"
                    ? "209,166,89"
                    : "255,255,255";
    const fusionTintIsKnown = Boolean(normalizedSetting && normalizedSetting !== "unknown");
    // The compact Fusion row, for the foot of the card's Stats tab.
    const compactFusionRow = (
        <div className="flex flex-col">
            <button
                type="button"
                disabled={!canFuse}
                onClick={() => setFusionOpen(true)}
                className="-mx-5 flex items-center gap-3 border-y border-white/[0.08] px-5 py-4 text-left font-sans disabled:cursor-not-allowed disabled:opacity-55"
            >
                <span aria-hidden="true" className="w-6 text-center text-sm font-bold text-primary-400">△</span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">Fuse Powers</span>
                    <span className={`mt-0.5 line-clamp-2 block text-[10px] leading-4 ${growth.learnedPrinciples.length > 0 ? "text-primary-400" : "text-white/60"}`}>
                        {growth.learnedPrinciples.length > 0
                            ? `${growth.learnedPrinciples.length} extra lesson${growth.learnedPrinciples.length === 1 ? "" : "s"} learned`
                            : "Combine two animals to learn something neither teaches alone."}
                    </span>
                </span>
                <span aria-hidden="true" className="text-[11px] font-bold text-white/40">›</span>
            </button>
            {/* The owner's fused Powers, each to train and prove. */}
            <FusedPowersSlot />
        </div>
    );

    return (
        <div className={`mx-auto flex w-full max-w-[720px] flex-col gap-3 font-sans ${wide ? "lg:max-w-none lg:gap-5" : ""}`}>
            {growth.isAuthenticated && growth.hasCapture ? (
                <>
                    {growth.principle && compareOnly ? (
                        // Power Fusion as one row, for the foot of the Play tab.
                        // The full card is the right shape on a surface about
                        // Fusion and the wrong one here: on Play it was a third
                        // hero card under a tab whose job is a single choice.
                        // This keeps the entry point and the count, and lets the
                        // sheet do the explaining.
                        compactFusionRow
                    ) : growth.principle ? (
                        <section
                            className="  border p-4 font-sans"
                            style={{
                                background: `linear-gradient(145deg,rgba(${fusionTint},${fusionTintIsKnown ? ".18" : ".08"}),rgba(${fusionTint},${fusionTintIsKnown ? ".10" : ".04"}),#1f1f1f)`,
                                borderColor: fusionTintIsKnown ? `rgba(${fusionTint},.24)` : "rgba(255,255,255,.10)"
                            }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className={microClass}>△ &nbsp; Power Fusion</p>
                                    <h3 className="mt-1 text-[15px] font-semibold text-white">What else can be learned from {powerName}?</h3>
                                    <p className="mt-1 text-xs font-medium leading-5 text-white/60">Fuse animal powers together to see what else can be gained.</p>
                                    {growth.learnedPrinciples.length > 0 ? (
                                        <p className="mt-2 text-[11px] font-semibold text-primary-400">
                                            {growth.learnedPrinciples.length} extra lesson{growth.learnedPrinciples.length === 1 ? "" : "s"} learned
                                        </p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    disabled={!canFuse}
                                    onClick={() => setFusionOpen(true)}
                                    className="shrink-0 rounded-full bg-primary-400 px-3 py-2 text-[11px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-55"
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
                                                <span className="shrink-0 text-[11px] font-semibold text-primary-400">{principle.statBoostSummary}</span>
                                            </div>
                                            <p className="mt-1 text-xs font-medium leading-5 text-white/60">{principle.learnedSubPrincipleExpression}</p>
                                            {principle.scenarioTags.length > 0 ? (
                                                <div className="mt-2 space-y-1.5">
                                                    <p className={microClass}>Best For</p>
                                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                                                        {principle.scenarioTags.map((tag) => (
                                                            <span key={tag} className="rounded-full border border-primary-400/20 bg-black px-2.5 py-1.5 text-[11px] font-semibold text-white/60">{tag.replace(/_/g, " ")}</span>
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
                    receiverLocked={receiverLocked}
                    onEarnPower={() => {
                        powerGateAnalytics.lockedFusionEarnTap(receiverSpeciesProfileId);
                        setFusionOpen(false);
                        router.push(`/app/capture/${encodeURIComponent(growth.primaryCaptureId ?? "")}?talk=1`);
                    }}
                    onSuccess={() => {
                        refresh();
                        // The new fused Power, still to train and prove.
                        void fusedPowers?.state.reload();
                    }}
                />
            ) : null}

        </div>
    );
}
