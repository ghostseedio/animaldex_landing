"use client";

import {useCallback, useState} from "react";
import type {AnimalPower} from "@/lib/animal-powers";
import {
    FUSED_COPY,
    type FusedPower,
    type FusedStage,
    attemptsExhausted,
    boostChips,
    boostStateText,
    bringsLine,
    decodeFusedSubmitResult,
    estimatedMinutesLine,
    fusedPowerAnchor,
    fusedProvingRewardLine,
    fusedRefusalMessage,
    fusedSteps,
    fusedTrainingForQuiz,
    fusedTrainingRewardLine,
    taughtByLine,
    teachesLine
} from "@/lib/fused-powers";
import {type SpeciesTraining, TRAINING_COPY, decodeSpeciesTrainingResult} from "@/lib/species-training";
import TrainingQuiz, {type TrainingAnswerSubmitter} from "@/components/animal-detail/species-training/training-quiz";
import ApplyItYourWay, {type ApplicationSubmitter} from "@/components/animal-detail/animal-powers/apply-it-your-way";
import {
    type AttachedEvidence,
    EvidencePicker,
    appendEvidence,
    useAttachedEvidence
} from "@/components/animal-detail/animal-powers/power-evidence";
import {useFusedPowersContext} from "@/components/animal-detail/fused-powers/fused-powers-context";

/**
 * "Fused Powers" on the owner's card Play tab, under the Fuse Powers row. One
 * full-width band per fused Power, newest first: what it boosts, where it is
 * on Training → Trial → Earned, and the one thing to do now. Ported from the
 * iOS Fused Powers section (FUSED_SPEC A).
 *
 * Nothing here decides anything. The stage, the quiz, the grading and the pay
 * are the server's; after a pass or an approval the list and the card are
 * both re-read.
 */

const NEON = "#A7F432";
const NEON_TEXT = "rgb(var(--c-primary-text-400))";
const ORANGE = "#FB923C";

type Route = "trial" | "application";

const ROUTES: Array<{id: Route; title: string}> = [
    {id: "trial", title: FUSED_COPY.doTheTrial},
    {id: "application", title: FUSED_COPY.applyItYourWay}
];

/** Renders under the Fuse Powers row when the card's context carries fused Powers. */
export function FusedPowersSlot() {
    const context = useFusedPowersContext();
    if (!context || !context.state.items.length) return null;
    return (
        <FusedPowersSection
            items={context.state.items}
            receiverName={context.receiverName}
            onReload={context.state.reload}
            onCardChanged={context.onCardChanged}
        />
    );
}

export default function FusedPowersSection({
    items,
    receiverName,
    onReload,
    onCardChanged
}: {
    items: FusedPower[];
    receiverName: string;
    onReload: () => Promise<unknown>;
    onCardChanged: () => void;
}) {
    // A pass or an approval moves XP and stats: re-read the list and the card.
    const settle = useCallback(() => {
        void onReload();
        onCardChanged();
    }, [onCardChanged, onReload]);

    if (!items.length) return null;

    return (
        <section className="-mx-5 flex flex-col border-b border-white/[0.08]" aria-label={FUSED_COPY.title}>
            <h3 className="flex items-center gap-2 px-5 pb-1 pt-5 font-display text-2xl font-black leading-tight text-white">
                <span aria-hidden="true" className="text-[15px]" style={{color: NEON_TEXT}}>△</span>
                {FUSED_COPY.title}
            </h3>
            {items.map((item) => (
                <FusedPowerRow
                    key={item.id}
                    item={item}
                    receiverName={receiverName}
                    onReload={onReload}
                    onSettled={settle}
                />
            ))}
        </section>
    );
}

function FusedPowerRow({
    item,
    receiverName,
    onReload,
    onSettled
}: {
    item: FusedPower;
    receiverName: string;
    onReload: () => Promise<unknown>;
    onSettled: () => void;
}) {
    const chips = boostChips(item.boost);
    // Held here, not in the Training stage: a pass re-reads the list and moves
    // this row on to proving while the quiz is still showing its explanations.
    const [quiz, setQuiz] = useState<SpeciesTraining | null>(null);

    const submitAnswers: TrainingAnswerSubmitter = useCallback(async (answers) => {
        try {
            const response = await fetch("/api/app/fused-powers", {
                method: "POST",
                headers: {"Content-Type": "application/json", Accept: "application/json"},
                body: JSON.stringify({action: "training", learnedId: item.id, answers})
            });
            const payload = await response.json().catch(() => null);
            const result = response.ok ? decodeSpeciesTrainingResult(payload?.result) : null;
            if (!result) return {ok: false, error: payload?.error ?? fusedRefusalMessage(payload?.code ?? "")};
            return {ok: true, result};
        } catch {
            return {ok: false, error: fusedRefusalMessage("")};
        }
    }, [item.id]);

    return (
        <article
            id={fusedPowerAnchor(item.id)}
            className="flex scroll-mt-24 flex-col gap-3 border-t border-white/[0.08] px-5 py-[18px]"
            style={item.stage === "earned" ? undefined : {boxShadow: `inset 3px 0 0 ${NEON}8C`, backgroundColor: "rgb(var(--c-white) / 0.03)"}}
        >
            <div className="flex flex-col gap-0.5">
                <p className="break-words text-lg font-black leading-6 text-white">{item.name}</p>
                <p className="text-[11px] font-semibold text-white/50">{taughtByLine(item.teacherName)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                    <span
                        key={chip}
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black"
                        style={item.earned
                            ? {color: NEON_TEXT, backgroundColor: `${NEON}24`, borderColor: `${NEON}59`}
                            : {color: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)"}}
                    >
                        {chip}
                    </span>
                ))}
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${item.earned ? "" : "text-white/45"}`} style={item.earned ? {color: NEON_TEXT} : undefined}>
                    {item.earned ? null : <span aria-hidden="true">🔒 </span>}
                    {boostStateText(item.earned)}
                </span>
            </div>

            <MiniStepper stage={item.stage} />

            {item.stage === "preparing" ? (
                <p aria-live="polite" className="flex items-center gap-2.5 text-sm text-white/70">
                    <span
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/15"
                        style={{borderTopColor: NEON}}
                    />
                    {FUSED_COPY.preparing}
                </p>
            ) : item.stage === "training" ? (
                <TrainingStage item={item} receiverName={receiverName} onStart={() => setQuiz(fusedTrainingForQuiz(item))} />
            ) : item.stage === "proving" ? (
                <ProvingStage item={item} onReload={onReload} onSettled={onSettled} />
            ) : (
                <p className="flex items-center gap-2 text-sm font-bold" style={{color: NEON_TEXT}}>
                    <span aria-hidden="true" className="text-[13px]">✓</span>
                    {FUSED_COPY.earnedLine}
                </p>
            )}

            {quiz ? (
                <TrainingQuiz
                    training={quiz}
                    powerName={item.name}
                    submitAnswers={submitAnswers}
                    onPassed={onSettled}
                    onReadPower={() => {
                        // Back to this row's lesson.
                        setQuiz(null);
                        window.requestAnimationFrame(() => {
                            document.getElementById(fusedPowerAnchor(item.id))?.scrollIntoView({behavior: "smooth", block: "start"});
                        });
                    }}
                    onClose={() => {
                        setQuiz(null);
                        void onReload();
                    }}
                />
            ) : null}
        </article>
    );
}

/** Training → Trial → Earned: a check when done, the accent on the current one. */
function MiniStepper({stage}: {stage: FusedStage}) {
    const steps = fusedSteps(stage);
    return (
        <ol
            className="flex items-center gap-1.5"
            aria-label={steps.map((step) => `${step.label}, ${step.state}`).join(". ")}
        >
            {steps.map((step, index) => {
                const done = step.state === "done";
                const current = step.state === "current";
                return (
                    <li key={step.label} aria-hidden="true" className="flex min-w-0 items-center gap-1.5">
                        {index > 0 ? (
                            <span className="h-0.5 w-4 shrink-0 rounded-full" style={{backgroundColor: done || current ? `${NEON}8C` : "rgba(255,255,255,0.12)"}} />
                        ) : null}
                        <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${done || current ? "" : "border border-white/20 text-white/40"}`}
                            style={done
                                ? {backgroundColor: NEON, color: "rgba(0,0,0,0.85)"}
                                : current
                                    ? {boxShadow: `inset 0 0 0 2px ${NEON}`, color: NEON_TEXT}
                                    : undefined}
                        >
                            {done ? "✓" : index + 1}
                        </span>
                        <span className={`whitespace-nowrap text-[11px] font-bold ${current ? "text-white" : done ? "text-white/70" : "text-white/40"}`}>
                            {step.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function TrainingStage({
    item,
    receiverName,
    onStart
}: {
    item: FusedPower;
    receiverName: string;
    onStart: () => void;
}) {
    const power = item.power;
    const canStart = Boolean(fusedTrainingForQuiz(item));

    return (
        <>
            <div className="flex flex-col gap-2">
                {power?.motto ? <p className="text-base font-bold leading-6 text-white">{power.motto}</p> : null}
                {power?.lesson ? <p className="text-sm leading-6 text-white/70">{power.lesson}</p> : null}
                {power?.receiverPart ? (
                    <p className="text-sm leading-6 text-white/70">{bringsLine(receiverName, power.receiverPart)}</p>
                ) : null}
                {power?.teacherPart ? (
                    <p className="text-sm leading-6 text-white/70">{teachesLine(item.teacherName, power.teacherPart)}</p>
                ) : null}
                {power?.example ? <p className="text-[11px] leading-5 text-white/45">{power.example}</p> : null}
            </div>
            <p className="text-[11px] font-black" style={{color: NEON_TEXT}}>{fusedTrainingRewardLine(item)}</p>
            <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90 disabled:opacity-50"
                style={{backgroundColor: NEON}}
            >
                {TRAINING_COPY.start} <span aria-hidden="true">→</span>
            </button>
        </>
    );
}

/** One submission to the `fused-power` edge function, through the site's route. */
async function submitProof(form: FormData): Promise<
    | {ok: true; result: NonNullable<ReturnType<typeof decodeFusedSubmitResult>>}
    | {ok: false; status: number; code: string; error: string}
> {
    try {
        const response = await fetch("/api/app/fused-powers/submit", {method: "POST", body: form});
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
            const next = `${window.location.pathname}${window.location.search}`;
            window.location.assign(`/account?next=${encodeURIComponent(next)}`);
            return {ok: false, status: 401, code: "unauthorized", error: ""};
        }
        if (!response.ok || !payload.result) {
            const code = String(payload.code ?? "");
            return {ok: false, status: response.status, code, error: payload.error ?? fusedRefusalMessage(code)};
        }
        return {ok: true, result: payload.result};
    } catch {
        return {ok: false, status: 0, code: "", error: fusedRefusalMessage("")};
    }
}

function ProvingStage({
    item,
    onReload,
    onSettled
}: {
    item: FusedPower;
    onReload: () => Promise<unknown>;
    onSettled: () => void;
}) {
    const [route, setRoute] = useState<Route>("trial");
    const [showsApply, setShowsApply] = useState(false);
    const exhausted = attemptsExhausted(item);

    // Apply It Your Way, sent to the fused route instead of the Animal Power one.
    const submitApplication: ApplicationSubmitter = useCallback(async ({domain, account, evidence}) => {
        const form = new FormData();
        form.set("learnedId", item.id);
        form.set("kind", "application");
        form.set("domain", domain);
        form.set("account", account);
        appendEvidence(form, evidence, {includeClip: true});
        const outcome = await submitProof(form);
        if (!outcome.ok) return outcome;
        return {
            ok: true,
            result: {
                verdict: outcome.result.verdict,
                reason: outcome.result.reason,
                quotedAction: "",
                grantedPower: outcome.result.earned,
                rejectionsRemaining: outcome.result.rejectionsRemaining
            }
        };
    }, [item.id]);

    // The written route reads the fused Power the way it reads an animal's.
    const applyPower: AnimalPower = {
        speciesProfileId: item.teacherSpeciesProfileId ?? item.id,
        speciesDisplayName: item.teacherName,
        principleName: item.name,
        coreLesson: item.power?.lesson ?? item.expression,
        principleExpression: item.power?.expression ?? item.expression,
        shortMotto: item.power?.motto ?? null,
        isEarned: false,
        earnedAt: null,
        earnedVia: null,
        sourceDomain: null,
        sourceTrialFrequency: null,
        principleNameAtEarning: null,
        hasTrial: Boolean(item.trial),
        suggestedDomains: []
    };

    return (
        <>
            <p className="text-[11px] font-black" style={{color: NEON_TEXT}}>{fusedProvingRewardLine(item)}</p>

            {/* Both routes earn it; one is on screen. The same full-bleed
                segmented band as the animal's own Earn the Power. */}
            <div className="-mx-5 flex flex-col">
                <div role="tablist" aria-label={item.name} className="flex border-y border-white/[0.08]">
                    {ROUTES.map((option) => {
                        const selected = route === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => setRoute(option.id)}
                                className={`relative flex-1 px-3 py-[13px] text-sm font-bold transition-colors ${selected ? "text-white" : "text-white/40"}`}
                                style={selected ? {backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(167,244,50,0.14))"} : undefined}
                            >
                                {option.title}
                                {selected ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5" style={{backgroundColor: NEON}} /> : null}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-col gap-3 px-5 pt-4">
                    {route === "trial" ? (
                        item.trial ? (
                            <TrialRoute item={item} exhausted={exhausted} onReload={onReload} onSettled={onSettled} />
                        ) : (
                            <p className="text-sm leading-6 text-white/60">{FUSED_COPY.notReady}</p>
                        )
                    ) : (
                        <>
                            <p className="text-sm leading-6 text-white">
                                Use the lesson somewhere in your own life, then tell us the one thing you did.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowsApply(true)}
                                disabled={exhausted}
                                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/60"
                                style={exhausted ? undefined : {backgroundColor: NEON}}
                            >
                                WRITE WHAT YOU DID <span aria-hidden="true">→</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {item.attempts.lastReason ? (
                <p className="border-l-2 pl-3 text-xs leading-5 text-white/80" style={{borderColor: `${ORANGE}8C`}}>
                    {item.attempts.lastReason}
                </p>
            ) : null}
            {exhausted ? <p className="text-xs font-semibold leading-5 text-orange-400">{FUSED_COPY.attemptsExhausted}</p> : null}

            {showsApply ? (
                <ApplyItYourWay
                    power={applyPower}
                    submitApplication={submitApplication}
                    onFinished={(result) => {
                        if (result.verdict === "approved") onSettled();
                        else void onReload();
                    }}
                    onClose={() => {
                        setShowsApply(false);
                        void onReload();
                    }}
                />
            ) : null}
        </>
    );
}

/**
 * The fused Trial: what to do, what to show, then a photo or a video — the
 * same picker and frame sampling as Apply It Your Way, sent to the fused route.
 */
function TrialRoute({
    item,
    exhausted,
    onReload,
    onSettled
}: {
    item: FusedPower;
    exhausted: boolean;
    onReload: () => Promise<unknown>;
    onSettled: () => void;
}) {
    const trial = item.trial!;
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const {evidence, setEvidence, isPreparing, attach} = useAttachedEvidence(setErrorMessage);
    const minutes = estimatedMinutesLine(trial.estimatedMinutes);

    const submit = useCallback(async (attached: AttachedEvidence) => {
        setIsWorking(true);
        setErrorMessage(null);
        const form = new FormData();
        form.set("learnedId", item.id);
        form.set("kind", "trial");
        appendEvidence(form, attached, {includeClip: true});
        const outcome = await submitProof(form);
        setIsWorking(false);
        if (!outcome.ok) {
            if (outcome.code === "already_earned") {
                onSettled();
                return;
            }
            if (outcome.error) setErrorMessage(outcome.error);
            if (outcome.code === "attempts_exhausted_today") void onReload();
            return;
        }
        if (outcome.result.verdict === "approved") {
            setEvidence(null);
            onSettled();
            return;
        }
        // The reviewer's reason shows under the routes once re-read.
        void onReload();
    }, [item.id, onReload, onSettled, setEvidence]);

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <p className="text-base font-bold leading-6 text-white">{trial.title}</p>
                {trial.instructions ? <p className="text-sm leading-6 text-white/70">{trial.instructions}</p> : null}
                {minutes ? <p className="text-[10px] font-bold text-white/45">{minutes}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
                {trial.proofPrompt ? <p className="text-sm leading-6 text-white/60">{trial.proofPrompt}</p> : null}
                {trial.successCriteria.map((criterion, index) => (
                    <p key={`${index}-${criterion}`} className="text-[10px] text-white/55">✓ {criterion}</p>
                ))}
            </div>
            <EvidencePicker
                evidence={evidence}
                onRemove={() => setEvidence(null)}
                onPick={(file) => void attach(file)}
                isPreparing={isPreparing}
                disabled={isWorking || exhausted}
                allowsLibrary={false}
            />
            {errorMessage ? <p className="text-[11px] leading-5 text-orange-400">{errorMessage}</p> : null}
            <button
                type="button"
                onClick={() => {
                    if (evidence) void submit(evidence);
                }}
                disabled={!evidence || isWorking || isPreparing || exhausted}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/60"
                style={!evidence || isWorking || isPreparing || exhausted ? undefined : {backgroundColor: NEON}}
            >
                {isWorking ? "…" : "SEND FOR REVIEW"}
            </button>
            {!evidence && !exhausted ? (
                <p className="text-center text-[10px] text-white/50">Add a photo or video to submit.</p>
            ) : null}
        </>
    );
}
