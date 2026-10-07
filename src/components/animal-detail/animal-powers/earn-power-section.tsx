"use client";

import {useEffect, useState} from "react";
import {type AnimalPower, powerGateAnalytics} from "@/lib/animal-powers";
import {type AnimalTrial, NOT_YET_CAPTURED_NOTE, NOT_YET_CAPTURED_TITLE, isComplete} from "@/lib/animal-trials";
import AnimalTrialsSection from "@/components/animal-detail/animal-trials/animal-trials-section";
import ApplyItYourWay from "@/components/animal-detail/animal-powers/apply-it-your-way";

/**
 * The Play tab: one Power, two ways to earn it, one of them on screen. Ported
 * from iOS `EarnPowerSection`.
 *
 * THE CHOICE IS THE STRUCTURE, not a menu above a list. A person arrives here
 * from "Earn this Power" on Learn, so they already know which Power and what it
 * teaches. What is left is the one thing this tab has that no other surface
 * does: the fork.
 *
 * Both routes earn the SAME Power and neither is the lesser one, so they are
 * two halves of one control rather than a primary action and a link.
 *
 * 729 species have a Power and no authored Trial. For those the control does
 * not appear at all and the written route is simply the page, because offering
 * a choice with one arm is worse than offering no choice.
 *
 * A Trial — and a Power — is per person per species. On an animal the viewer
 * has not caught, both routes are shown and neither can be taken.
 */

const NEON = "#A7F432";

type Route = "trial" | "application";

const ROUTES: Array<{id: Route; title: string}> = [
    {id: "trial", title: "Take the Trial"},
    {id: "application", title: "Apply It Your Way"}
];

/**
 * "EARN COURAGE TO UNLOCK", falling back when the name is missing so the
 * heading never reads "EARN  TO UNLOCK".
 */
function lockedHeading(powerName: string | null | undefined) {
    const name = powerName?.trim();
    return name ? `EARN ${name.toUpperCase()} TO UNLOCK` : "EARN THIS POWER TO UNLOCK";
}

function UnlockRow({icon, title, detail, earned}: {icon: string; title: string; detail: string; earned: boolean}) {
    return (
        <div
            className={`flex items-start gap-3 ${earned ? "" : "opacity-75"}`}
            aria-label={`${title}. ${earned ? "Unlocked" : "Locked"} — ${detail}`}
        >
            <span aria-hidden="true" className="w-[22px] text-center text-[13px] font-bold" style={{color: earned ? NEON : "rgba(255,255,255,0.4)"}}>
                {earned ? "✓" : "🔒"}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${earned ? "text-white" : "text-white/60"}`}>
                    <span aria-hidden="true" className="text-[11px]" style={{color: earned ? NEON : undefined}}>{icon}</span>
                    {title}
                </span>
                <span className="text-[10px] leading-4 text-white/40">{detail}</span>
            </span>
        </div>
    );
}

/**
 * The two Play mechanics an Animal Power unlocks, in one component used in both
 * states.
 *
 * Locked features are SHOWN, never hidden. A person who cannot see what they
 * would get has no reason to earn anything, and a Play tab that silently omits
 * Comparison until some invisible condition is met reads as a missing feature
 * rather than a goal.
 */
function UnlockRows({earned, powerName, isViewersOwnAnimal}: {earned: boolean; powerName: string | null; isViewersOwnAnimal: boolean}) {
    return (
        <div className={`flex flex-col gap-2.5 px-5 pt-4 ${earned ? "pb-[18px]" : "pb-1"}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{color: earned ? NEON : "rgba(255,255,255,0.4)"}}>
                {earned ? "Play unlocked" : lockedHeading(powerName)}
            </p>
            <UnlockRow
                icon="⚡"
                title="Comparison Battles"
                detail={isViewersOwnAnimal ? "Battle this animal against others." : "Battle with your own captures of this animal."}
                earned={earned}
            />
            <UnlockRow
                icon="△"
                title="Fusion"
                detail={isViewersOwnAnimal ? "Enhance this animal through Fusion." : "Enhance your own captures of this animal."}
                earned={earned}
            />
        </div>
    );
}

export default function EarnPowerSection({
    speciesProfileId,
    power,
    didLoad,
    onReload,
    isViewersOwnAnimal = true,
    canAttemptTrials = true
}: {
    speciesProfileId: string | null | undefined;
    power: AnimalPower | null;
    /** False while the earned state is still being read, so the fork does not flash in. */
    didLoad: boolean;
    /** The grant is server-side; callers re-read rather than inferring state from a verdict. */
    onReload: () => Promise<AnimalPower | null>;
    /**
     * False on a public card. A Power is earned per person per species, so on
     * somebody else's animal it unlocks Play for the viewer's OWN captures of
     * that species — not for the animal on screen, which is not theirs.
     */
    isViewersOwnAnimal?: boolean;
    /**
     * False when the viewer has not unlocked this animal. Both routes still
     * show — they are the reason to catch it — and neither can be taken.
     */
    canAttemptTrials?: boolean;
}) {
    const [route, setRoute] = useState<Route>("trial");
    const [showsApply, setShowsApply] = useState(false);

    const isLocked = Boolean(power && !power.isEarned);
    const lockedSpeciesId = isLocked ? power?.speciesProfileId : null;

    useEffect(() => {
        if (!lockedSpeciesId) return;
        powerGateAnalytics.lockedComparisonImpression(lockedSpeciesId);
        powerGateAnalytics.lockedFusionImpression(lockedSpeciesId);
    }, [lockedSpeciesId]);

    if (!speciesProfileId) return null;

    // Finishing a Trial earns the Power once every frequency is done, so the
    // earned state is re-read the moment one completes.
    const handleTrialCompleted = () => {
        void onReload().then((reloaded) => {
            if (reloaded?.isEarned && !power?.isEarned) {
                powerGateAnalytics.powerEarned(reloaded.speciesProfileId, reloaded.earnedVia);
            }
        });
    };

    const trialDidUpdate = (trial: AnimalTrial) => {
        if (isComplete(trial)) handleTrialCompleted();
    };

    const trials = (showsHeader: boolean) => (
        <AnimalTrialsSection
            speciesProfileId={speciesProfileId}
            showsHeader={showsHeader}
            canAttempt={canAttemptTrials}
            onTrialCompleted={handleTrialCompleted}
            onUpdated={trialDidUpdate}
        />
    );

    const applyPanel = (isOnlyRoute: boolean) => (
        <div className={`flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 pb-5 ${isOnlyRoute ? "pt-5" : "pt-[18px]"}`}>
            {isOnlyRoute ? (
                // No Trial exists for this animal, so say so rather than leaving
                // a reader wondering where the challenge went.
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">This animal has no Trial yet</p>
            ) : null}
            <p className="text-sm leading-6 text-white">
                Use the lesson somewhere in your own life, then tell us the one thing you did.
            </p>
            {/* What you write is a Discover post, whatever the verdict. Said
                here, before anyone writes anything. */}
            <p className="text-[10px] text-white/40">📡 Accepted and rejected writing both post to Discover.</p>
            {canAttemptTrials ? (
                <button
                    type="button"
                    onClick={() => setShowsApply(true)}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
                    style={{backgroundColor: NEON}}
                >
                    WRITE WHAT YOU DID <span aria-hidden="true">→</span>
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        disabled
                        className="flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/[0.08] text-base font-bold text-white/60"
                    >
                        🔒 {NOT_YET_CAPTURED_TITLE}
                    </button>
                    <p className="text-center text-[10px] text-white/40">{NOT_YET_CAPTURED_NOTE}</p>
                </>
            )}
        </div>
    );

    let content: React.ReactNode;

    if (!didLoad) {
        // The Trials never depend on the Power, so they show while it loads.
        content = trials(true);
    } else if (power?.isEarned) {
        content = (
            <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.08] bg-[#A7F432]/10 px-5 py-3.5" style={{color: NEON}}>
                    <span aria-hidden="true" className="text-[13px] font-bold">✓</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.11em]">Power earned</span>
                    <span className="truncate text-[10px] font-bold text-white">· {power.principleName}</span>
                </div>
                <UnlockRows earned powerName={power.principleName} isViewersOwnAnimal={isViewersOwnAnimal} />
                {/* Earned, so there is nothing left to choose. The Trials stay —
                    they are still worth doing for the XP and the Credits. */}
                {trials(true)}
            </>
        );
    } else if (!power) {
        // No Power authored for this species: the Trials stand alone.
        content = trials(true);
    } else if (power.hasTrial) {
        content = (
            <>
                {/* Locked features first: what you get, then how to get it. */}
                <UnlockRows earned={false} powerName={power.principleName} isViewersOwnAnimal={isViewersOwnAnimal} />
                <div className="flex flex-col gap-1 px-5 pb-3 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">Choose how to earn it</p>
                    <p className="text-[10px] text-white/40">Either one earns the Power. You only need to do one.</p>
                </div>
                {/* A full-bleed segmented band, the same treatment as the
                    Learn / Stats / Play bar: the selected route is lit from
                    below rather than boxed. */}
                <div role="tablist" aria-label="How to earn this Power" className="flex border-t border-white/[0.08]">
                    {ROUTES.map((option) => {
                        const selected = route === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                aria-label={option.title}
                                onClick={() => setRoute(option.id)}
                                className={`relative flex-1 px-3 py-[15px] text-sm font-bold transition-colors ${selected ? "text-white" : "text-white/40"}`}
                                style={selected ? {backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(167,244,50,0.14))"} : undefined}
                            >
                                {option.title}
                                {selected ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5" style={{backgroundColor: NEON}} /> : null}
                            </button>
                        );
                    })}
                </div>
                <div className="border-t border-white/[0.08]">
                    {route === "trial" ? trials(false) : applyPanel(false)}
                </div>
            </>
        );
    } else {
        content = (
            <>
                <UnlockRows earned={false} powerName={power.principleName} isViewersOwnAnimal={isViewersOwnAnimal} />
                {applyPanel(true)}
            </>
        );
    }

    return (
        <section className="flex flex-col">
            {content}
            {showsApply && power ? (
                <ApplyItYourWay
                    power={power}
                    onClose={() => setShowsApply(false)}
                    onFinished={(result) => {
                        if (result.verdict !== "approved") return;
                        powerGateAnalytics.powerEarned(power.speciesProfileId, "application");
                        void onReload();
                    }}
                />
            ) : null}
        </section>
    );
}
