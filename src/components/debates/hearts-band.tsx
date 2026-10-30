"use client";

/**
 * The card's hearts (docs/debates/SPEC.md, sections 1.8 and 4), where the
 * battle tools were, on the owner's own card: the animal's 3 hearts, "Heal
 * a heart: 5 Credits" any time below 3, "All 3 hearts" or "Out of hearts.
 * Heal it to join debates again.", the public roster opt-in (the same switch
 * as Settings, off by default) and the debates it was in. The stats stay
 * where they are.
 */

import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {DebateRow} from "@/components/debates/debate-views";
import {healHeart, setDebateRoster, type useMyDebates} from "@/components/debates/use-debates";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {DEBATE_MAX_HEARTS, canHealHeart, clampHearts} from "@/lib/debates";
import {debateProblemText} from "@/lib/debate-words";

const LISTED = 5;

export function HeartsRow({hearts, size = 18}: {hearts: number; size?: number}) {
    return (
        <span className="flex shrink-0 gap-1 text-primary-400" aria-hidden="true">
            {Array.from({length: DEBATE_MAX_HEARTS}, (_, index) => (
                <svg key={index} viewBox="0 0 24 24" style={{width: size, height: size}} fill={index < hearts ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                </svg>
            ))}
        </span>
    );
}

export default function HeartsBand({captureId, hearts: initialHearts, powerEarned, name, words, mine}: {
    captureId: string;
    hearts: number;
    powerEarned: boolean;
    /** "Luna", or the animal. */
    name: string;
    words: CompanionWords;
    /** This card's debates, the switch and the opt-in (`useMyDebates({captureId})`), read once by the card. */
    mine: ReturnType<typeof useMyDebates>;
}) {
    const [hearts, setHearts] = useState(clampHearts(initialHearts));
    const [healing, setHealing] = useState(false);
    const [problem, setProblem] = useState<{text: string; credits: boolean} | null>(null);
    const [savingRoster, setSavingRoster] = useState(false);
    const heal = canHealHeart(hearts, null);
    const status = hearts <= 0 ? words.roster.offRoster : hearts >= DEBATE_MAX_HEARTS ? words.heal.full : null;
    const web = words.debateWeb;

    const healOne = () => {
        if (healing) return;
        setHealing(true);
        setProblem(null);
        void healHeart(captureId).then((result) => {
            setHealing(false);
            if (result.ok) {
                setHearts(result.value.hearts);
                return;
            }
            if (result.code === "hearts_full") {
                setHearts(DEBATE_MAX_HEARTS);
                return;
            }
            setProblem({text: debateProblemText(result.code, words), credits: result.code === "insufficient_credits"});
        });
    };

    const toggleRoster = () => {
        if (savingRoster || mine.optedIn === null) return;
        const next = !mine.optedIn;
        setSavingRoster(true);
        mine.setOptedIn(next);
        void setDebateRoster(next).then((result) => {
            setSavingRoster(false);
            mine.setOptedIn(result.ok ? result.value : !next);
        });
    };

    return (
        <div className="flex flex-col">
            <p className="-mx-5 border-b border-white/[0.08] px-5 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{words.heal.title}</p>
            <div className="-mx-5 flex flex-col gap-3 border-b border-white/[0.08] px-5 py-4">
                <div className="flex items-center gap-3">
                    <HeartsRow hearts={hearts} size={20} />
                    <span className="sr-only">{fillWords(web.hearts, {n: hearts})}</span>
                    {status ? <span className={`text-sm leading-5 ${hearts <= 0 ? "text-orange-300" : "text-white/65"}`}>{status}</span> : null}
                </div>
                {heal.can ? (
                    <button
                        type="button"
                        onClick={healOne}
                        disabled={healing}
                        className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-primary-400 px-4 text-[13px] font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-60"
                    >
                        {healing ? web.healing : words.heal.one}
                    </button>
                ) : null}
                {problem ? (
                    <p role="alert" className="text-xs leading-5 text-white/60">
                        {problem.text}
                        {problem.credits ? (
                            <> <Link href="/app/credits#credits" className="font-bold text-primary-200 underline-offset-2 hover:underline">{web.getCredits}</Link></>
                        ) : null}
                    </p>
                ) : null}
            </div>

            {mine.enabled ? (
                <>
                    <div className="-mx-5 flex items-start gap-3 border-b border-white/[0.08] px-5 py-4">
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-white">{words.roster.optIn}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-white/60">
                                {powerEarned ? words.roster.optInNote : fillWords(web.rosterNeedsPower, {name})}
                            </span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={mine.optedIn === true}
                            aria-label={words.roster.optIn}
                            onClick={toggleRoster}
                            disabled={savingRoster || mine.optedIn === null}
                            className={`mt-0.5 h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors disabled:opacity-60 ${mine.optedIn ? "bg-primary-400" : "bg-white/15"}`}
                        >
                            <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${mine.optedIn ? "translate-x-5" : ""}`} />
                        </button>
                    </div>
                    <p className="-mx-5 border-b border-white/[0.08] px-5 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{web.withAnimal}</p>
                    {mine.debates.length === 0 ? (
                        <p className="-mx-5 border-b border-white/[0.06] px-5 py-3.5 text-sm text-white/50">{mine.loaded ? web.withAnimalEmpty : "…"}</p>
                    ) : (
                        <>
                            {mine.debates.slice(0, LISTED).map((debate) => (
                                <DebateRow key={debate.id} debate={debate} words={words} href={`/app/debates/${debate.id}`} />
                            ))}
                            {mine.debates.length > LISTED ? (
                                <Link href="/app/debates" className="-mx-5 border-b border-white/[0.06] px-5 py-3 text-xs font-bold text-primary-200">{web.seeAll}</Link>
                            ) : null}
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}
