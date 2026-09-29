"use client";

import {useEffect, useState} from "react";
import {type AnimalPower, powerGateAnalytics} from "@/lib/animal-powers";
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
 */

const NEON = "#A7F432";

type Route = "trial" | "application";

const ROUTES: Array<{id: Route; title: string; icon: string; blurb: string}> = [
    {id: "trial", title: "Take the Trial", icon: "◎", blurb: "Do the animal's challenge and show it."},
    {id: "application", title: "Apply It Your Way", icon: "✎", blurb: "Use the lesson in your life and say what happened."}
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
    isViewersOwnAnimal = true
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

    // Finishing a Trial earns the Power, so the earned state is re-read the
    // moment one completes.
    const handleTrialCompleted = () => {
        void onReload().then((reloaded) => {
            if (reloaded?.isEarned && !power?.isEarned) {
                powerGateAnalytics.powerEarned(reloaded.speciesProfileId, reloaded.earnedVia);
            }
        });
    };

    const trials = (showsHeader: boolean) => (
        <AnimalTrialsSection
            speciesProfileId={speciesProfileId}
            showsHeader={showsHeader}
            onTrialCompleted={handleTrialCompleted}
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
            <p className="text-[10px] text-white/40">🔒 Nobody else sees what you write.</p>
            <button
                type="button"
                onClick={() => setShowsApply(true)}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
                style={{backgroundColor: NEON}}
            >
                WRITE WHAT YOU DID <span aria-hidden="true">→</span>
            </button>
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
                    {power.earnedAt ? (
                        <span className="text-[10px] text-white/40">
                            · {new Date(power.earnedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})}
                        </span>
                    ) : null}
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
                <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">Choose how to earn it</p>
                    <div role="tablist" aria-label="How to earn this Power" className="grid grid-cols-2 gap-2.5">
                        {ROUTES.map((option) => {
                            const selected = route === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    aria-label={`${option.title}. ${option.blurb}`}
                                    onClick={() => setRoute(option.id)}
                                    className={`flex flex-col items-start gap-[7px] rounded-[18px] border p-3.5 text-left transition-colors ${selected ? "border-transparent" : "border-[#A7F432]/30 bg-white/[0.04]"}`}
                                    style={selected ? {backgroundColor: NEON} : undefined}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`grid h-7 w-7 place-items-center rounded-full text-[15px] font-bold ${selected ? "bg-black/20 text-black" : "bg-[#A7F432]/15"}`}
                                        style={selected ? undefined : {color: NEON}}
                                    >
                                        {option.icon}
                                    </span>
                                    <span className={`text-base font-bold leading-5 ${selected ? "text-black" : "text-white"}`}>{option.title}</span>
                                    <span className={`text-[10px] leading-4 ${selected ? "text-black/75" : "text-white/60"}`}>{option.blurb}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-white/40">Either one earns the Power. You only need to do one.</p>
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
