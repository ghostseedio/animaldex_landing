"use client";

/**
 * What this animal can do, on the public Talk chat (docs/rich-chat/SPEC.md,
 * section 4.4): a quiet row under its card. Talk is available now (its
 * openers are docked above the composer); its Trials are public, opened in
 * the thread as the animal's own Trials section, a tap on a loop enlarging
 * it in place; Your step and Debates are locked, each with one honest line
 * and the action it needs: an account for a reader without one, the app
 * (a card of the animal) for one signed in. Never a modal, never a nag.
 */

import {useEffect, useState, type ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskSpecialBubble} from "@/components/ask-animaldex/ask-messenger";
import {AskTrialsSection} from "@/components/ask-animaldex/ask-special";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import {rememberStorePlacement} from "@/lib/store-links";
import {talkCapabilityAction} from "@/lib/ask-animaldex/talk";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import type {AnimalTrial} from "@/lib/animal-trials";
import type {TalkWords} from "@/lib/ask-animaldex/talk";

type Capability = "trials" | "step" | "debates";

export default function TalkCapabilities({
    name,
    animalName,
    faceUrl,
    speciesProfileId,
    signedIn,
    words,
    companionWords,
    signUpHref,
    appHref,
    onTalk
}: {
    /** As the chat calls it. */
    name: string;
    /** The species, for "Catch a {animal}". */
    animalName: string;
    faceUrl: string | null;
    speciesProfileId: string | null;
    signedIn: boolean;
    words: TalkWords;
    companionWords: CompanionWords;
    signUpHref: string;
    appHref: string;
    onTalk: () => void;
}) {
    const [open, setOpen] = useState<Capability | null>(null);
    const captionLanguage = useTrialMotionCaptionLanguage();
    const [trials, setTrials] = useState<AnimalTrial[] | null>(null);
    useEffect(() => setTrials(null), [speciesProfileId]);
    useEffect(() => {
        if (open !== "trials" || trials !== null) return;
        if (!speciesProfileId) {
            setTrials([]);
            return;
        }
        let cancelled = false;
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}${captionLanguage ? `&lang=${captionLanguage}` : ""}`, {
            headers: {Accept: "application/json"}
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => {
                if (!cancelled) setTrials(payload && Array.isArray(payload.trials) ? payload.trials : []);
            })
            .catch(() => {
                if (!cancelled) setTrials([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open, trials, speciesProfileId, captionLanguage]);

    const toggle = (capability: Capability) => setOpen((current) => (current === capability ? null : capability));
    const viewer = {signedIn};
    /** The locked capability's one action: an account, or the app. */
    const action = (kind: "step" | "debates") => (talkCapabilityAction(kind, viewer) === "signUp"
        ? {label: words.createAccount, href: signUpHref, app: false}
        : {label: words.getApp, href: appHref, app: true});

    const lockedPanel = (kind: "step" | "debates") => {
        const next = action(kind);
        return (
            <div className="mx-auto flex max-w-[30rem] flex-col items-center gap-2 px-4 pt-3 text-center" data-testid={`talk-capability-${kind}-panel`}>
                <p className="text-[13px] leading-5 text-ink-200">
                    {kind === "step" ? fillWords(words.capStepNote, {animal: name}) : words.capDebatesNote}
                </p>
                <Link
                    href={next.href}
                    onClick={() => {
                        if (next.app) rememberStorePlacement("page_talk");
                    }}
                    className="inline-flex min-h-9 items-center rounded-full bg-primary-400 px-4 text-xs font-black text-canvas-950 transition-colors hover:bg-primary-300"
                >
                    {next.label}
                </Link>
            </div>
        );
    };

    const trialAction = talkCapabilityAction("trial", viewer) === "signUp"
        ? {label: words.createAccount, href: signUpHref, note: null}
        : {label: words.getApp, href: appHref, note: fillWords(words.catchForTrials, {animal: animalName})};

    return (
        <div className="flex flex-col pt-4" data-testid="talk-capabilities">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-ink-400">
                {fillWords(words.capabilities, {name})}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-2" role="group" aria-label={fillWords(words.capabilities, {name})}>
                <CapabilityChip icon={<TalkIcon />} label={words.capTalk} detail={words.capTalkNote} onClick={onTalk} />
                <CapabilityChip icon={<FlagIcon />} label={words.capTrials} pressed={open === "trials"} onClick={() => toggle("trials")} testId="talk-capability-trials" />
                <CapabilityChip icon={<LockIcon />} label={words.capStep} quiet pressed={open === "step"} onClick={() => toggle("step")} title={words.locked} testId="talk-capability-step" />
                <CapabilityChip icon={<LockIcon />} label={words.capDebates} quiet pressed={open === "debates"} onClick={() => toggle("debates")} title={words.locked} testId="talk-capability-debates" />
            </div>
            {open === "step" || open === "debates" ? lockedPanel(open) : null}
            {open === "trials" ? (
                // Its Trials, as the animal's own section, under its card.
                <div className="pt-4" data-testid="talk-trials">
                    <AskSpecialBubble avatarUrl={faceUrl}>
                        {trials !== null && trials.length === 0 ? (
                            <p className="text-[13px] leading-5 text-white/70">{words.noTrials}</p>
                        ) : (
                            <AskTrialsSection
                                name={name}
                                words={companionWords}
                                trials={trials}
                                currentFrequency={null}
                                working={null}
                                problem={null}
                                disabled={false}
                                onPick={() => undefined}
                                publicAction={trialAction}
                            />
                        )}
                    </AskSpecialBubble>
                </div>
            ) : null}
        </div>
    );
}

function CapabilityChip({icon, label, detail = null, quiet = false, pressed, onClick, title, testId}: {
    icon: ReactNode;
    label: string;
    detail?: string | null;
    quiet?: boolean;
    pressed?: boolean;
    onClick: () => void;
    title?: string;
    testId?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            title={title}
            data-testid={testId}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                pressed
                    ? "border-primary-300/55 bg-primary-400/[0.12] text-white"
                    : quiet
                        ? "border-white/10 bg-transparent text-ink-300 hover:border-white/20 hover:text-white"
                        : "border-white/12 bg-white/[0.05] text-white hover:border-primary-300/40"
            }`}
        >
            <span className={`shrink-0 ${quiet ? "text-ink-400" : "text-primary-300"}`}>{icon}</span>
            {label}
            {detail ? <span className="font-medium text-ink-400">· {detail}</span> : null}
        </button>
    );
}

function icon(path: ReactNode) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const TalkIcon = () => icon(<path d="M3.5 5.5h13v8h-7l-4 3v-3h-2Z" />);
const FlagIcon = () => icon(<path d="M5 17.5V3m0 1h9l-1.6 3.2L14 10.5H5" />);
const LockIcon = () => icon(<path d="M5.5 9h9v7.5h-9ZM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9" />);
