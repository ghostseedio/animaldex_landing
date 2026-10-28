"use client";

/**
 * The conversation itself: a docked panel on desktop, a bottom sheet on mobile.
 *
 * The web counterpart of `AnimalPowerAskChatView`. The behaviour worth keeping
 * from it, all of which this reproduces:
 *   - the newest question is pinned to the top of the panel, so the answer
 *     renders *below* the question the way it reads on paper, instead of the
 *     reader landing on the last line of a long answer;
 *   - the waiting line names what is being consulted for this particular
 *     question, not a fixed script;
 *   - follow-up chips appear under the newest answer only — chips under every
 *     answer turn the scrollback into a wall of buttons;
 *   - stop is a real action with a real outcome, not a disabled send button.
 *
 * On a species page the animal itself talks (Speak to [Animal]), as in the
 * apps since 2026-10-23: it greets an empty thread first, its replies are
 * typed out at its own pace (`useReplyPacer`), a click on a reply shows the
 * rest at once, Stop keeps what was already said, and the header carries its
 * temperament.
 *
 * On the reader's own card it is their one-to-one chat, with the companion
 * loop (AnimalDex 2026-10-28): "Working on: …" under the name once the animal
 * has found what it is helping them with, "Not this any more" to let it go,
 * and under the reply where it happened, a step done together or another of
 * their animals it sent them to.
 */

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";
import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AssistantMarkdown from "@/components/ask-animaldex/assistant-markdown";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {useAskThread} from "@/components/ask-animaldex/use-ask-thread";
import {usePrefersReducedMotion, useReplyPacer} from "@/components/ask-animaldex/use-reply-pacer";
import {askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {askThreadKey, type AskLimitNotice, type AskMessage} from "@/lib/ask-animaldex/thread";
import {askThinkingPhases} from "@/lib/ask-animaldex/thinking-phases";
import {TRIAL_ASK_EMPTY_HEADING, TRIAL_ASK_PLACEHOLDER} from "@/lib/animal-trial-ask";
import {WILD_PROFILE_PATH, isWildProfileFollowUp} from "@/lib/ask-animaldex/wild-profile";
import {getLocalePath} from "@/lib/site";
import {
    askSuggestions,
    EMPTY_ASK_HINTS,
    type AskHints,
    type AskSubject,
    type AskSuggestion
} from "@/lib/ask-animaldex/subject";
import {trackEvent} from "@/lib/analytics";
import {rememberStorePlacement} from "@/lib/store-links";
import {SPECIES_ASK_FUNNEL_EVENTS, SPECIES_ASK_SIGNED_IN_LIMIT} from "@/lib/species-ask";
import {
    COMPANION_COPY,
    EMPTY_COMPANION_LOOP,
    companionDisplayName,
    parseCompanionFocus,
    referralCapturePath,
    type AskCompanionEvent,
    type AskCompanionLoop
} from "@/lib/ask-animaldex/companion-loop";
import {bondChipText, decodeChatBond, type ChatBond} from "@/lib/companion-bond";
import BondPanel from "@/components/companions/bond-panel";
import {reloadCompanions, useAnimalBond} from "@/components/companions/use-companions";

export type AskDrawerLabels = {
    title: string;
    /** Launcher text on a species page, where the animal speaks for itself. */
    speakLauncher: string;
    /** Under the animal's name in the header: it answers as itself. */
    inOwnWords: string;
    aboutAnimal: string;
    aboutSite: string;
    emptyTitleAnimal: string;
    emptyTitleGeneral: string;
    emptyHint: string;
    /** The hint when the animal itself is speaking. */
    emptyHintAnimal: string;
    placeholderAnimal: string;
    placeholderGeneral: string;
    placeholderFollowUp: string;
    placeholderFollowUpAnimal: string;
    send: string;
    stop: string;
    close: string;
    newConversation: string;
    clearConfirm: string;
    clearConfirmBodyAnimal: string;
    clearConfirmBodyGeneral: string;
    clearConfirmAction: string;
    clearCancel: string;
    copy: string;
    copied: string;
    share: string;
    retry: string;
    tryAgain: string;
    youAsked: string;
    thinking: string;
    thinkingAnimal: string;
    remaining: string;
    limitTitle: string;
    /** Signed out: "Sign in for {signedInLimit} messages a day, free — or keep going in the app." */
    limitBody: string;
    /** Signed out, the primary step: sign in, back to this page. */
    limitCta: string;
    /** Signed out, the secondary step: the app. */
    limitAppCta: string;
    limitHref: string;
    /** A signed-in free account: the next step is Pro, not a download. */
    limitBodySignedIn: string;
    limitCtaSignedIn: string;
    limitHrefSignedIn: string;
    /** A Pro account: nothing to sell, just when the messages come back. */
    limitBodyPro: string;
    /** Past the allowance, a Pro reader with credits: "Keep talking for {cost} credit per message? Balance: {balance}". */
    creditsOffer: string;
    creditsContinue: string;
    /** While paying: "{cost} credit per message · balance {balance}". */
    creditsFooter: string;
    /** Paying, and the balance cannot cover another message. */
    creditsOut: string;
    /** To the website's Credits page. */
    creditsGet: string;
    /** The failed reply when the day's messages are gone, by who the reader is. */
    failedLimitAnon: string;
    failedLimitSignedIn: string;
    failedLimitPro: string;
    failedNoCredits: string;
    disclaimer: string;
    /** "What I remember about you": the facts every animal shares, in the reader's hands. */
    memoryOpen: string;
    memoryHint: string;
    memoryEmptyTitle: string;
    memoryEmptyBody: string;
    memoryLoading: string;
    memoryFailed: string;
    memoryForget: string;
    memoryForgetAll: string;
    memoryForgetAllConfirm: string;
    memoryForgetAllBody: string;
    memoryToldTo: string;
    memoryFromWildProfile: string;
    memoryBack: string;
};

type AskMemoryFact = {id?: string; fact: string; animal: string | null; noted_at: string | null; source?: string; pinned?: boolean};

function isWildProfileFact(item: AskMemoryFact) {
    return item.source === "wild_profile" && item.pinned === true;
}

type AskContextPayload = {
    subject: AskSubject;
    hints: AskHints;
    suggestions: AskSuggestion[];
    limit: number;
    signedIn: boolean;
    isPro: boolean;
    hasWildProfile?: boolean;
    available: boolean;
};

const THINKING_PHASE_MS = 2200;

/** The website's Credits page, at the packs. */
const CREDITS_HREF = "/app/credits#credits";

/** Sign in, then back to the page the reader was on (`Link` adds the locale). */
function signInHrefFor(pathname: string | null) {
    return `/account?next=${encodeURIComponent(pathname || "/")}`;
}

export default function AskDrawer({labels}: {labels: AskDrawerLabels}) {
    const {
        subject,
        photoUrl,
        avatarUrl,
        companionSpeciesProfileId,
        referralId,
        locale,
        close,
        takePendingQuestion,
        questionRequest
    } = useAskAnimalDex();
    const signInHref = signInHrefFor(usePathname());
    const [context, setContext] = useState<AskContextPayload | null>(null);
    const [composer, setComposer] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);
    const [showingMemory, setShowingMemory] = useState(false);
    const [memoryFacts, setMemoryFacts] = useState<AskMemoryFact[]>([]);
    const [memoryState, setMemoryState] = useState<"loading" | "ready" | "failed">("loading");
    const [forgettingFact, setForgettingFact] = useState<string | null>(null);
    const [confirmingForgetAll, setConfirmingForgetAll] = useState(false);

    const threadKey = askThreadKey(subject);
    const hints = context?.hints ?? EMPTY_ASK_HINTS;
    const resolvedSubject = context?.subject ?? subject;

    // The owner's own one-to-one chat: their card, signed in, not a Trial
    // thread. Only there does the animal work on their life with them.
    const ownerChat = Boolean(
        companionSpeciesProfileId
        && context?.signedIn
        && resolvedSubject.scope === "species"
        && !resolvedSubject.trialContext
    );
    // What the animal is helping them with, and the step it set.
    const [companionLoop, setCompanionLoop] = useState<AskCompanionLoop | null>(null);
    // The bond: the header chip, and the sheet it opens (SPEC phase 2). The
    // chip follows `done.bond`; the sheet reads `animal_bond_v1`.
    const animalBond = useAnimalBond(ownerChat ? companionSpeciesProfileId : null);
    const [chatBond, setChatBond] = useState<ChatBond | null>(null);
    const [showingBond, setShowingBond] = useState(false);
    useEffect(() => {
        setChatBond(null);
        setShowingBond(false);
    }, [companionSpeciesProfileId]);
    const chipBond = chatBond ?? animalBond.bond;

    const {
        messages,
        hasConversation,
        isSending,
        quota,
        persona,
        greetingState,
        greet,
        send,
        stop,
        retry,
        regenerate,
        clear,
        continueWithCredits
    } = useAskThread({
        threadKey,
        subject: resolvedSubject,
        locale,
        principleName: hints.principleName,
        viewer: {signedIn: context?.signedIn ?? false, hasWildProfile: context?.hasWildProfile ?? false},
        ownerChat,
        onCompanion: (update) => setCompanionLoop(update.loop),
        onBond: (raw) => {
            const next = decodeChatBond(raw);
            if (!next) return;
            // A new level shows on every card of this animal.
            setChatBond((current) => {
                if (current && current.level !== next.level) void reloadCompanions();
                return next;
            });
        },
        onAnswered: ({followUps}) => {
            trackEvent(SPECIES_ASK_FUNNEL_EVENTS.answered, {
                species_slug: resolvedSubject.slug ?? "",
                source: "drawer",
                layer_count: followUps
            });
        }
    });

    const panelRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const trailingQuestionRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const lastPinnedId = useRef<string | null>(null);

    // Context first: the opening suggestions have to name this animal's real
    // states and failure modes, and the waiting lines are derived from the same
    // material. A generic chip row is what this replaces.
    useEffect(() => {
        let cancelled = false;
        setContext(null);
        void fetch("/api/ask/context", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                subject: {
                    scope: subject.scope,
                    slug: subject.slug,
                    name: subject.name,
                    captureId: subject.captureId,
                    hasReaderPhoto: subject.hasReaderPhoto,
                    title: subject.title,
                    summary: subject.summary,
                    path: subject.path,
                    trialContext: subject.trialContext,
                    trialKey: subject.trialKey
                }
            })
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: AskContextPayload | null) => {
                if (!cancelled && payload) setContext(payload);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [subject]);

    // A question the launcher was opened with is sent once, and only once the
    // subject has resolved — otherwise it would be answered from the wrong
    // grounding.
    useEffect(() => {
        if (!context) return;
        const pending = takePendingQuestion();
        if (pending) void send(pending);
        // `questionRequest`: a question asked while the drawer is already open.
    }, [context, questionRequest, takePendingQuestion, send]);

    // The animal speaks first: an empty species thread opens on its greeting.
    // Runs after the pending question above, which takes precedence. Opened
    // from another animal's referral, it speaks first about that instead,
    // history or not (once per referral; `greet` keeps count).
    const canGreet = Boolean(context?.available && context.subject.scope === "species" && (context.hints.animalName ?? context.subject.name));
    const greetsForReferral = ownerChat && Boolean(referralId);
    useEffect(() => {
        if (!canGreet || isSending) return;
        if (greetsForReferral) {
            void greet({referralId});
            return;
        }
        if (messages.length > 0 || greetingState !== "idle") return;
        void greet();
    }, [canGreet, greetsForReferral, referralId, messages.length, greetingState, isSending, greet]);

    // The loop as it stands when the chat opens; replies keep it current.
    useEffect(() => {
        setCompanionLoop(null);
        if (!ownerChat || !companionSpeciesProfileId) return;
        let cancelled = false;
        void fetch(`/api/ask/companion?speciesProfileId=${encodeURIComponent(companionSpeciesProfileId)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {loop?: unknown} | null) => {
                const loop = payload ? parseCompanionFocus(payload.loop) : null;
                if (!cancelled && loop) setCompanionLoop(loop);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [ownerChat, companionSpeciesProfileId]);

    /** "Not this any more": the animal lets the focus go, and the step on it. Back as it was if that fails. */
    const clearCompanionFocus = useCallback(() => {
        if (!companionSpeciesProfileId) return;
        const previous = companionLoop;
        setCompanionLoop({...EMPTY_COMPANION_LOOP, yourTrialsDone: previous?.yourTrialsDone ?? 0});
        void fetch("/api/ask/companion", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "clear", speciesProfileId: companionSpeciesProfileId})
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
            })
            .catch(() => setCompanionLoop(previous));
    }, [companionLoop, companionSpeciesProfileId]);

    /**
     * The reply being typed out: the newest animal reply that arrived while
     * the drawer was open. A reply restored from an earlier visit is not
     * paced; it is simply there.
     */
    const reducedMotion = usePrefersReducedMotion();
    const [pacedId, setPacedId] = useState<string | null>(null);
    const inFlightId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message.role === "assistant" && (message.status === "thinking" || message.status === "streaming")) return message.id;
        }
        return null;
    }, [messages]);
    useEffect(() => {
        if (inFlightId) setPacedId(inFlightId);
    }, [inFlightId]);
    const pacedMessage = pacedId ? messages.find((message) => message.id === pacedId) ?? null : null;
    const pacer = useReplyPacer({
        messageId: pacedMessage && pacedMessage.status !== "failed" ? pacedMessage.id : null,
        text: pacedMessage?.text ?? "",
        sourceDone: pacedMessage?.status === "complete",
        persona,
        instant: reducedMotion
    });
    // Typing counts as talking: Stop stays until the last word is shown.
    const animalTalking = isSending || pacer.revealing;
    // With something typed the button sends, over a greeting or a reply that
    // is only still typing out; a reply still arriving is stopped first.
    const showStop = (isSending && greetingState !== "loading") || (animalTalking && composer.trim().length === 0);
    const stopTalking = useCallback(() => {
        // Still arriving: stop it, keeping what the reader saw. All here:
        // show the rest.
        if (isSending) stop(pacer.messageId ? pacer.visibleText : undefined);
        else pacer.skipToEnd();
    }, [isSending, stop, pacer]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (confirmingClear) {
                    setConfirmingClear(false);
                    return;
                }
                close();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [close, confirmingClear]);

    useEffect(() => {
        if (hasConversation) return;
        // On a phone the keyboard would cover the animal's greeting, as the
        // app found: there the reader taps in when they are ready.
        const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
        if (coarse && subject.scope === "species") return;
        composerRef.current?.focus();
    }, [hasConversation, subject.scope]);

    /**
     * Pins the newest question to the top of the panel.
     *
     * Scrolling to the bottom drops the reader at the last line of a long answer
     * and makes them scroll back up to read it. A spacer below the exchange is
     * what lets the question actually reach the top instead of the scroll
     * stopping as soon as the content ends.
     */
    const trailingQuestionId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index].role === "user") return messages[index].id;
        }
        return null;
    }, [messages]);

    useLayoutEffect(() => {
        if (!trailingQuestionId || trailingQuestionId === lastPinnedId.current) return;
        lastPinnedId.current = trailingQuestionId;
        const node = trailingQuestionRef.current;
        const scroller = scrollRef.current;
        if (!node || !scroller) return;
        scroller.scrollTo({
            top: node.offsetTop - scroller.offsetTop - 12,
            behavior: "smooth"
        });
    }, [trailingQuestionId]);

    const submit = useCallback((question: string, source: "form" | "chip" | "followup") => {
        // The reader may talk over the animal's greeting (it keeps what it
        // had said); any other reply in flight has to finish or be stopped.
        if (!question.trim() || (isSending && greetingState !== "loading")) return;
        // The one chip that is a destination rather than a question: it opens
        // the questionnaire instead of asking the model about it.
        if (source === "followup" && isWildProfileFollowUp(question)) {
            close();
            window.location.assign(getLocalePath(locale, WILD_PROFILE_PATH));
            return;
        }
        trackEvent(
            source === "followup"
                ? SPECIES_ASK_FUNNEL_EVENTS.followupClicked
                : source === "chip"
                    ? SPECIES_ASK_FUNNEL_EVENTS.chipClicked
                    : SPECIES_ASK_FUNNEL_EVENTS.submitted,
            {species_slug: resolvedSubject.slug ?? "", source: `drawer_${source}`}
        );
        setComposer("");
        setShowingMemory(false);
        void send(question);
    }, [close, isSending, greetingState, locale, resolvedSubject.slug, send]);

    const loadMemory = useCallback(async () => {
        setMemoryState("loading");
        try {
            const response = await fetch("/api/ask/memory", {method: "GET"});
            if (!response.ok) throw new Error(String(response.status));
            const payload = await response.json() as {ok?: boolean; facts?: AskMemoryFact[]};
            setMemoryFacts(Array.isArray(payload.facts) ? payload.facts : []);
            setMemoryState("ready");
        } catch {
            setMemoryState("failed");
        }
    }, []);

    const openMemory = useCallback(() => {
        setShowingBond(false);
        setConfirmingClear(false);
        setConfirmingForgetAll(false);
        setShowingMemory(true);
        void loadMemory();
    }, [loadMemory]);

    const forgetFact = useCallback(async (item: AskMemoryFact) => {
        setForgettingFact(item.fact);
        try {
            // By id when the fact has one; facts saved before ids existed go by their text.
            const response = await fetch("/api/ask/memory", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(item.id ? {action: "forget", id: item.id} : {action: "forget", fact: item.fact})
            });
            if (!response.ok) return;
            const payload = await response.json() as {facts?: AskMemoryFact[]};
            setMemoryFacts(Array.isArray(payload.facts) ? payload.facts : []);
        } catch {
            // The fact stays listed; the reader can try again.
        } finally {
            setForgettingFact(null);
        }
    }, []);

    const forgetEverything = useCallback(async () => {
        setConfirmingForgetAll(false);
        setForgettingFact("*");
        try {
            const response = await fetch("/api/ask/memory", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "clear"})
            });
            if (response.ok) setMemoryFacts([]);
        } catch {
            // Nothing changed; the list stays as it was.
        } finally {
            setForgettingFact(null);
        }
    }, []);

    const animalName = hints.animalName ?? resolvedSubject.name ?? null;
    const suggestions = context?.suggestions ?? askSuggestions(resolvedSubject, hints);

    const aboutTrial = Boolean(resolvedSubject.trialContext);
    // On a species page the animal answers as itself; everywhere else the
    // site-wide assistant does.
    const speaksAsAnimal = resolvedSubject.scope === "species" && Boolean(animalName);
    // The animal's face is its icon art, never a capture photo.
    const faceUrl = speaksAsAnimal ? avatarUrl : photoUrl;
    const placeholder = hasConversation
        ? (speaksAsAnimal && animalName
            ? labels.placeholderFollowUpAnimal.replace("{animal}", animalName)
            : labels.placeholderFollowUp)
        : aboutTrial
            ? TRIAL_ASK_PLACEHOLDER
            : animalName
                ? labels.placeholderAnimal.replace("{animal}", animalName)
                : labels.placeholderGeneral;
    const thinkingLabel = speaksAsAnimal && animalName
        ? labels.thinkingAnimal.replace("{animal}", animalName)
        : labels.thinking;

    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    // Before the context arrives, a species thread is about to be greeted:
    // show the animal typing rather than flashing the static openers first.
    const awaitingGreeting = messages.length === 0
        && greetingState !== "failed"
        && (context === null ? subject.scope === "species" : canGreet);

    const copyMessage = (message: AskMessage) => {
        void navigator.clipboard?.writeText(askMarkdownPlainText(message.text));
        setCopiedId(message.id);
        setTimeout(() => {
            setCopiedId((current) => (current === message.id ? null : current));
        }, 1600);
    };
    const shareMessage = (message: AskMessage) => {
        const body = shareText(messages, message, animalName, speaksAsAnimal);
        if (navigator.share) {
            void navigator.share({text: body}).catch(() => undefined);
        } else {
            void navigator.clipboard?.writeText(body);
            setCopiedId(message.id);
        }
    };
    // While paying with credits the footer says what a message costs instead.
    const remainingCopy = quota.paying
        ? labels.creditsFooter
            .replace("{cost}", String(quota.creditCost ?? quota.creditOverflow?.cost ?? 1))
            .replace("{balance}", String(quota.creditBalance ?? quota.creditOverflow?.balance ?? "…"))
        : quota.remaining !== null && quota.limit !== null
            ? labels.remaining
                .replace("{remaining}", String(quota.remaining))
                .replace("{limit}", String(quota.limit))
            : null;
    const creditOffer = quota.creditOverflow?.available ? quota.creditOverflow : null;
    const outOfCredits = !creditOffer && (quota.reason === "insufficient_credits"
        || (quota.isPro === true && quota.creditOverflow !== null && quota.creditOverflow !== undefined));
    const limitTier = quota.isPro ? "pro" : quota.signedIn ? "free" : "anon";
    const limitBody = limitTier === "pro"
        ? labels.limitBodyPro
        : limitTier === "free"
            ? labels.limitBodySignedIn
            : labels.limitBody.replace("{signedInLimit}", String(SPECIES_ASK_SIGNED_IN_LIMIT));
    const trackLimitStep = (source: string) => {
        trackEvent(SPECIES_ASK_FUNNEL_EVENTS.collectClicked, {species_slug: resolvedSubject.slug ?? "", source});
    };
    // Once each time the limit card comes up, with whose allowance ran out.
    const limitShown = quota.reached && !showingMemory;
    const limitReported = useRef(false);
    useEffect(() => {
        if (!quota.reached) {
            limitReported.current = false;
            return;
        }
        if (!limitShown || limitReported.current) return;
        limitReported.current = true;
        trackEvent(SPECIES_ASK_FUNNEL_EVENTS.limitReached, {
            species_slug: resolvedSubject.slug ?? "",
            source: "drawer",
            tier: limitTier
        });
    }, [quota.reached, limitShown, limitTier, resolvedSubject.slug]);

    return (
        <>
            {/* Mobile only: the sheet covers the page, so it gets a way out by tapping past it. */}
            <button
                type="button"
                aria-label={labels.close}
                onClick={close}
                className="fixed inset-0 z-[60] bg-canvas-950/60 backdrop-blur-[2px] lg:hidden"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="false"
                aria-label={animalName ? labels.aboutAnimal.replace("{animal}", animalName) : labels.title}
                // Fully opaque, and no `backdrop-blur`: a translucent panel over this site
                // lets the page's lime radial glows ghost straight through the
                // conversation, even at 98% background opacity. It also matches the
                // field-guide look, which has no glassmorphism anywhere else.
                className="ask-panel fixed inset-x-0 bottom-0 z-[61] flex h-[85vh] flex-col border-t border-white/12 bg-canvas-950 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
            >
                <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 px-4 pb-3 pt-4 lg:pt-3">
                    {/* Sheet grabber. Decorative on mobile only; the sheet is
                        dismissed by the close button or the backdrop. */}
                    <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {faceUrl ? (
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/15">
                                <Image src={faceUrl} unoptimized alt="" fill sizes="32px" className="object-cover" />
                            </span>
                        ) : (
                            <span
                                aria-hidden="true"
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-400/14 text-primary-200"
                            >
                                <SparkIcon />
                            </span>
                        )}
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <p className="min-w-0 truncate text-sm font-semibold text-white">
                                    {animalName ?? labels.title}
                                </p>
                                {ownerChat && chipBond ? (
                                    // The bond chip: the level and the stage. It opens the bond.
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowingMemory(false);
                                            setShowingBond((current) => !current);
                                            if (!showingBond) void animalBond.reload();
                                        }}
                                        aria-pressed={showingBond}
                                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                                            showingBond ? "border-primary-300/50 bg-primary-400/14 text-white" : "border-white/12 text-ink-200 hover:text-white"
                                        }`}
                                    >
                                        {bondChipText(chipBond)}
                                    </button>
                                ) : null}
                            </div>
                            {ownerChat && companionLoop?.focus ? (
                                // What the two of you are working on, once the animal has found it.
                                <div className="flex min-w-0 items-baseline gap-2">
                                    <p className="min-w-0 truncate text-[11px] leading-4 text-ink-300" title={companionLoop.focus}>
                                        {COMPANION_COPY.workingOn.replace("{focus}", companionLoop.focus)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={clearCompanionFocus}
                                        className="shrink-0 text-[11px] font-semibold leading-4 text-ink-400 underline-offset-2 transition-colors hover:text-white hover:underline"
                                    >
                                        {COMPANION_COPY.notThisAnyMore}
                                    </button>
                                </div>
                            ) : speaksAsAnimal ? (
                                // The animal's temperament once it has spoken, as in the app's header.
                                <p className="truncate text-[11px] leading-4 text-ink-400">{persona?.tagline ?? labels.inOwnWords}</p>
                            ) : null}
                        </div>
                    </div>
                    {speaksAsAnimal && context?.signedIn ? (
                        <button
                            type="button"
                            onClick={showingMemory ? () => setShowingMemory(false) : openMemory}
                            aria-label={labels.memoryOpen}
                            aria-pressed={showingMemory}
                            title={labels.memoryOpen}
                            className={`grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/8 hover:text-white ${showingMemory ? "bg-white/10 text-white" : "text-ink-300"}`}
                        >
                            <MemoryIcon />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setConfirmingClear(true)}
                        disabled={!hasConversation}
                        aria-label={labels.newConversation}
                        title={labels.newConversation}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                    >
                        <PencilIcon />
                    </button>
                    <button
                        type="button"
                        onClick={close}
                        aria-label={labels.close}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white"
                    >
                        <CloseIcon />
                    </button>
                </header>

                {confirmingClear ? (
                    <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-sm font-semibold text-ink-100">{labels.clearConfirm}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-300">
                            {animalName
                                ? labels.clearConfirmBodyAnimal.replace("{animal}", animalName)
                                : labels.clearConfirmBodyGeneral}
                        </p>
                        <div className="mt-2.5 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    clear();
                                    setConfirmingClear(false);
                                    composerRef.current?.focus();
                                }}
                                className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                            >
                                {labels.clearConfirmAction}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingClear(false)}
                                className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-semibold text-ink-200 transition-colors hover:text-white"
                            >
                                {labels.clearCancel}
                            </button>
                        </div>
                    </div>
                ) : null}

                <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                    {showingBond && ownerChat ? (
                        <div className="-mx-4 -my-4">
                            <BondPanel
                                bond={animalBond.bond}
                                didLoad={animalBond.didLoad}
                                speciesProfileId={companionSpeciesProfileId}
                                slug={resolvedSubject.slug}
                                name={animalName ?? labels.title}
                                powerName={hints.principleName}
                                onTalk={() => setShowingBond(false)}
                                onAsk={(message) => {
                                    setShowingBond(false);
                                    submit(message, "chip");
                                }}
                                // The website's chat has no lesson-check card; the
                                // card's Bond tab holds the lesson check.
                                onLessonCheck={null}
                                onBondChanged={(next) => {
                                    animalBond.setBond(next);
                                    if (next) setCompanionLoop((current) => ({...(current ?? EMPTY_COMPANION_LOOP), focus: next.focus, openTrial: next.openTrial}));
                                }}
                                onRefresh={() => void animalBond.reload()}
                                locale={locale}
                            />
                        </div>
                    ) : showingMemory ? (
                        <AskMemoryPanel
                            labels={labels}
                            facts={memoryFacts}
                            state={memoryState}
                            forgettingFact={forgettingFact}
                            confirmingForgetAll={confirmingForgetAll}
                            onRetry={() => void loadMemory()}
                            onForget={(item) => void forgetFact(item)}
                            onAskForgetAll={() => setConfirmingForgetAll(true)}
                            onCancelForgetAll={() => setConfirmingForgetAll(false)}
                            onForgetAll={() => void forgetEverything()}
                            onBack={() => setShowingMemory(false)}
                        />
                    ) : !hasConversation && (messages.length > 0 || awaitingGreeting) ? (
                        // The animal's greeting opens the thread, in place of the static openers.
                        <div className="flex flex-col gap-6">
                            {messages.length === 0 ? (
                                <div className="flex items-start gap-2.5">
                                    {faceUrl ? <MessageFace url={faceUrl} /> : null}
                                    <ThinkingIndicator phases={[thinkingLabel]} label={thinkingLabel} />
                                </div>
                            ) : messages.map((message) => (
                                <MessageBlock
                                    key={message.id}
                                    message={message}
                                    labels={labels}
                                    isLast={message.id === lastMessageId}
                                    isSending={isSending}
                                    photoUrl={photoUrl}
                                    photoAlt={animalName ?? ""}
                                    avatarUrl={speaksAsAnimal ? faceUrl : null}
                                    thinkingLabel={thinkingLabel}
                                    thinkingPhases={[thinkingLabel]}
                                    paced={pacer.messageId === message.id && pacer.revealing ? pacer.visibleText : null}
                                    onSkip={pacer.skipToEnd}
                                    copied={copiedId === message.id}
                                    onCopy={() => copyMessage(message)}
                                    onShare={() => shareMessage(message)}
                                    onRegenerate={() => regenerate(message.id)}
                                    onRetry={() => retry(message.id)}
                                    onFollowUp={(prompt) => submit(prompt, "followup")}
                                    companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
                                    principleName={hints.principleName}
                                    signInHref={signInHref}
                                />
                            ))}
                        </div>
                    ) : !hasConversation ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <h2 className="font-display text-xl font-bold leading-7 text-white">
                                    {aboutTrial
                                        ? TRIAL_ASK_EMPTY_HEADING
                                        : animalName
                                            ? labels.emptyTitleAnimal.replace("{animal}", animalName)
                                            : labels.emptyTitleGeneral}
                                </h2>
                                <p className="mt-1.5 text-sm leading-6 text-ink-300">
                                    {speaksAsAnimal && !aboutTrial ? labels.emptyHintAnimal : labels.emptyHint}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {suggestions.slice(0, aboutTrial ? suggestions.length : 3).map((suggestion) => (
                                    <button
                                        key={suggestion.prompt}
                                        type="button"
                                        onClick={() => submit(suggestion.prompt, "chip")}
                                        className="group flex items-start gap-2.5 border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left transition-colors hover:border-primary-300/35 hover:bg-white/[0.06]"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-primary-200/85">
                                                {suggestion.title}
                                            </span>
                                            <span className="mt-1 block text-sm font-semibold leading-6 text-white">
                                                {suggestion.prompt}
                                            </span>
                                        </span>
                                        <span aria-hidden="true" className="mt-1 shrink-0 text-ink-400 group-hover:text-primary-200">
                                            <ArrowUpRightIcon />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {messages.map((message) => (
                                <MessageBlock
                                    key={message.id}
                                    message={message}
                                    labels={labels}
                                    isLast={message.id === lastMessageId}
                                    isSending={isSending}
                                    photoUrl={photoUrl}
                                    photoAlt={animalName ?? ""}
                                    avatarUrl={speaksAsAnimal ? faceUrl : null}
                                    thinkingLabel={thinkingLabel}
                                    thinkingPhases={askThinkingPhases(
                                        lastQuestion(messages),
                                        {...hints, hasWildProfile: context?.hasWildProfile ?? false, aboutTrial, speaksAsAnimal}
                                    )}
                                    paced={pacer.messageId === message.id && pacer.revealing ? pacer.visibleText : null}
                                    onSkip={pacer.skipToEnd}
                                    copied={copiedId === message.id}
                                    questionRef={message.id === trailingQuestionId ? trailingQuestionRef : undefined}
                                    onCopy={() => copyMessage(message)}
                                    onShare={() => shareMessage(message)}
                                    onRegenerate={() => regenerate(message.id)}
                                    onRetry={() => retry(message.id)}
                                    onFollowUp={(prompt) => submit(prompt, "followup")}
                                    companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
                                    principleName={hints.principleName}
                                    signInHref={signInHref}
                                />
                            ))}
                            {/* Room below the newest exchange, so the question can sit at the top. */}
                            <div aria-hidden="true" className="h-[40vh] shrink-0" />
                        </div>
                    )}

                    {quota.reached && !showingMemory ? (
                        <div className="mt-5 border border-amber-300/25 bg-amber-400/[0.08] p-4">
                            <p className="text-sm font-semibold text-white">{labels.limitTitle}</p>
                            <p className="mt-1.5 text-sm leading-6 text-ink-100">
                                {limitBody.replace("{limit}", String(quota.limit ?? ""))}
                            </p>
                            {creditOffer ? (
                                <>
                                    <p className="mt-1.5 text-sm leading-6 text-ink-100">
                                        {labels.creditsOffer
                                            .replace("{cost}", String(creditOffer.cost))
                                            .replace("{balance}", String(creditOffer.balance))}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={continueWithCredits}
                                        disabled={isSending}
                                        className="mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 disabled:opacity-50"
                                    >
                                        {labels.creditsContinue}
                                    </button>
                                </>
                            ) : outOfCredits ? (
                                <>
                                    <p className="mt-1.5 text-sm leading-6 text-ink-100">{labels.creditsOut}</p>
                                    <Link
                                        href={CREDITS_HREF}
                                        onClick={() => trackLimitStep("drawer_limit_credits")}
                                        className="mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                                    >
                                        {labels.creditsGet}
                                    </Link>
                                </>
                            ) : null}
                            {limitTier === "pro" || creditOffer ? null : limitTier === "free" ? (
                                <Link
                                    href={labels.limitHrefSignedIn}
                                    onClick={() => trackLimitStep("drawer_limit_pro")}
                                    className={`${outOfCredits ? "ml-2 " : ""}mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300`}
                                >
                                    {labels.limitCtaSignedIn}
                                </Link>
                            ) : (
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <Link
                                        href={signInHref}
                                        onClick={() => trackLimitStep("drawer_limit_sign_in")}
                                        className="inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                                    >
                                        {labels.limitCta}
                                    </Link>
                                    <Link
                                        href={labels.limitHref}
                                        onClick={() => {
                                            trackLimitStep("drawer_limit_app");
                                            // The store button on /#download credits the chat.
                                            rememberStorePlacement("chat_limit");
                                        }}
                                        className="text-xs font-semibold text-primary-200 underline-offset-2 transition-colors hover:text-primary-100 hover:underline"
                                    >
                                        {labels.limitAppCta}
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="shrink-0 border-t border-white/10 px-4 pb-4 pt-3">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit(composer, "form");
                        }}
                        className="flex items-end gap-2 border border-white/12 bg-white/[0.05] pl-4 pr-1.5 py-1.5 focus-within:border-primary-300/45"
                    >
                        <label className="sr-only" htmlFor="ask-animaldex-composer">{placeholder}</label>
                        <textarea
                            id="ask-animaldex-composer"
                            ref={composerRef}
                            value={composer}
                            rows={1}
                            maxLength={900}
                            placeholder={placeholder}
                            onChange={(event) => {
                                setComposer(event.target.value);
                                const node = event.target;
                                node.style.height = "auto";
                                // One to six lines, as the app's composer does.
                                node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    submit(composer, "form");
                                }
                            }}
                            className="max-h-[8.25rem] min-h-[2.25rem] w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400"
                        />
                        <button
                            type={showStop ? "button" : "submit"}
                            onClick={showStop ? stopTalking : undefined}
                            disabled={!showStop && composer.trim().length === 0}
                            aria-label={showStop ? labels.stop : labels.send}
                            className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                                showStop || composer.trim()
                                    ? "bg-primary-400 text-canvas-950 hover:bg-primary-300"
                                    : "bg-white/8 text-ink-400"
                            }`}
                        >
                            {showStop ? <StopIcon /> : <ArrowUpIcon />}
                        </button>
                    </form>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-ink-400">
                        {remainingCopy ? <span>{remainingCopy}</span> : null}
                        <span className="min-w-0">{labels.disclaimer}</span>
                    </p>
                </div>
            </div>
        </>
    );
}

function lastQuestion(messages: AskMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") return messages[index].text;
    }
    return "";
}

/** Shared text reads as prose, not as markdown source. */
function shareText(messages: AskMessage[], message: AskMessage, animalName: string | null, asAnimal = false): string {
    const index = messages.findIndex((entry) => entry.id === message.id);
    const question = index > 0 && messages[index - 1].role === "user" ? messages[index - 1].text : null;
    const body = askMarkdownPlainText(message.text);
    if (asAnimal && animalName) {
        const heading = `${animalName}, in its own words — AnimalDex`;
        return question ? `${heading}\n\nMe: ${question}\n\n${animalName}: ${body}` : `${heading}\n\n${body}`;
    }
    const heading = animalName ? `${animalName} — AnimalDex` : "AnimalDex";
    return question ? `${heading}\n\nQ: ${question}\n\n${body}` : `${heading}\n\n${body}`;
}

/** A reply refused at the day's limit: what to say, in the reader's language, and their next step. */
function limitFailure(notice: AskLimitNotice, labels: AskDrawerLabels, signInHref: string) {
    switch (notice) {
        case "anon":
            return {text: labels.failedLimitAnon, link: {href: signInHref, label: labels.limitCta}};
        case "free":
            return {text: labels.failedLimitSignedIn, link: {href: labels.limitHrefSignedIn, label: labels.limitCtaSignedIn}};
        case "credits":
            return {text: labels.failedNoCredits, link: {href: CREDITS_HREF, label: labels.creditsGet}};
        default:
            return {text: labels.failedLimitPro, link: null};
    }
}

function MessageBlock({
    message,
    labels,
    isLast,
    isSending,
    photoUrl,
    photoAlt,
    avatarUrl = null,
    thinkingLabel,
    thinkingPhases,
    paced = null,
    onSkip,
    copied,
    questionRef,
    onCopy,
    onShare,
    onRegenerate,
    onRetry,
    onFollowUp,
    companionEvent,
    principleName = null,
    signInHref
}: {
    message: AskMessage;
    labels: AskDrawerLabels;
    isLast: boolean;
    isSending: boolean;
    photoUrl: string | null;
    photoAlt: string;
    /** The animal's face beside its replies, when the animal is the one answering. */
    avatarUrl?: string | null;
    thinkingLabel?: string;
    thinkingPhases: string[];
    /**
     * While this reply is being typed out, what of it is on screen; null
     * once it is all shown (or when it is not paced at all).
     */
    paced?: string | null;
    /** Shows the rest of a reply being typed out. */
    onSkip?: () => void;
    copied: boolean;
    questionRef?: React.RefObject<HTMLDivElement>;
    onCopy: () => void;
    onShare: () => void;
    onRegenerate: () => void;
    onRetry: () => void;
    onFollowUp: (prompt: string) => void;
    /** What the animal did in this reply in the companion loop; the owner's own chat only. */
    companionEvent?: AskCompanionEvent;
    /** The animal's Power, named when a step earned it. */
    principleName?: string | null;
    /** Where "Sign in" goes from a reply refused at the signed-out limit. */
    signInHref: string;
}) {
    if (message.role === "user") {
        return (
            <div ref={questionRef} className="flex justify-end pl-8" aria-label={`${labels.youAsked} ${message.text}`}>
                <p className="bg-primary-400/14 px-3.5 py-2.5 text-[15px] leading-7 text-white">
                    {message.text}
                </p>
            </div>
        );
    }

    // With the answer written in the first person, the reader needs to see
    // who "I" is without looking back up at the header.
    const face = avatarUrl ? <MessageFace url={avatarUrl} /> : null;
    const typing = paced !== null;

    // Nothing on screen yet: the animal is still finding its first word.
    if (message.status === "thinking" || (typing && paced.length === 0)) {
        return (
            <div className="flex items-start gap-2.5">
                {face}
                <ThinkingIndicator phases={thinkingPhases} label={thinkingLabel ?? labels.thinking} />
            </div>
        );
    }

    if (message.status === "failed") {
        const limit = message.limitNotice ? limitFailure(message.limitNotice, labels, signInHref) : null;
        return (
            <div className="border border-white/10 bg-white/[0.035] p-3.5">
                <p className="text-sm leading-6 text-ink-200">{limit?.text ?? message.text}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {limit?.link ? (
                        <Link
                            href={limit.link.href}
                            className="text-xs font-semibold text-primary-200 underline underline-offset-2 transition-colors hover:text-primary-100"
                        >
                            {limit.link.label}
                        </Link>
                    ) : null}
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-200 transition-colors hover:text-primary-100"
                    >
                        <RefreshIcon />
                        {labels.tryAgain}
                    </button>
                </div>
            </div>
        );
    }

    // Actions and next questions wait until the animal has finished talking.
    const finished = message.status === "complete" && !typing;

    return (
        <div className="flex items-start gap-2.5">
        {face}
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            {typing ? (
                <>
                    {/* Screen readers get the reply as it arrives, not a word at a time. */}
                    <p className="sr-only">{askMarkdownPlainText(message.text)}</p>
                    {/* A click shows the rest now; Stop does the same from the keyboard. */}
                    <div aria-hidden="true" onClick={onSkip} className="cursor-text">
                        <AssistantMarkdown text={paced} photoUrl={photoUrl} photoAlt={photoAlt} streaming />
                    </div>
                </>
            ) : (
                <AssistantMarkdown
                    text={message.text}
                    photoUrl={photoUrl}
                    photoAlt={photoAlt}
                    streaming={message.status === "streaming"}
                />
            )}

            {finished && isLast ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <ActionButton onClick={onCopy} label={copied ? labels.copied : labels.copy}>
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </ActionButton>
                    <ActionButton onClick={onShare} label={labels.share}>
                        <ShareIcon />
                    </ActionButton>
                    {/* A greeting answers no question, so there is nothing to ask again. */}
                    {message.isGreeting ? null : (
                        <ActionButton onClick={onRegenerate} label={labels.retry} disabled={isSending}>
                            <RefreshIcon />
                        </ActionButton>
                    )}
                </div>
            ) : null}

            {finished && companionEvent ? (
                <CompanionEventBlock event={companionEvent} principleName={principleName} />
            ) : null}

            {/* Only the newest answer offers next questions. */}
            {finished && isLast && message.followUpPrompts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {message.followUpPrompts.slice(0, 3).map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            disabled={isSending}
                            onClick={() => onFollowUp(prompt)}
                            className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:border-primary-300/40 hover:text-white disabled:opacity-40"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
        </div>
    );
}

/**
 * Under the reply where the animal saw a step of theirs done, or sent them to
 * another of their animals: the moment, marked in the thread. The animal has
 * already said well done in its own words; this is the game's part.
 */
function CompanionEventBlock({event, principleName}: {event: AskCompanionEvent; principleName: string | null}) {
    const done = event.stepDone;
    const referral = event.referral;
    const referralHref = referral ? referralCapturePath(referral) : null;
    return (
        <div className="flex flex-col items-start gap-2.5">
            {done ? (
                <div className="flex flex-col gap-1">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-300">
                        <SealIcon />
                        {COMPANION_COPY.doneTogether}
                    </p>
                    <p className="text-[11px] leading-4 text-ink-300">{done.step}</p>
                    {done.powerEarned && principleName ? (
                        <p className="text-[11px] font-semibold leading-4 text-white">
                            {COMPANION_COPY.powerYours.replace("{power}", principleName)}
                        </p>
                    ) : !done.powerEarned && done.powerWaitsForTraining ? (
                        <p className="text-[11px] font-semibold leading-4 text-white">{COMPANION_COPY.powerWaitsForTraining}</p>
                    ) : null}
                </div>
            ) : null}
            {referral && referralHref ? (
                <Link
                    href={referralHref}
                    title={COMPANION_COPY.talkToHint}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:border-primary-300/40"
                >
                    <ReferralIcon />
                    {COMPANION_COPY.talkTo.replace("{name}", companionDisplayName(referral.nickname, referral.animal))}
                </Link>
            ) : null}
        </div>
    );
}

/** The animal's face beside what it says. */
function MessageFace({url}: {url: string}) {
    return (
        <span className="relative mt-0.5 h-[26px] w-[26px] shrink-0 overflow-hidden rounded-full border border-white/15">
            <Image src={url} unoptimized alt="" fill sizes="26px" className="object-cover" />
        </span>
    );
}

function ActionButton({children, label, onClick, disabled}: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
            {children}
            {label}
        </button>
    );
}

/**
 * The waiting state. A bare spinner reads as a stalled network; a pulsing dot
 * row plus a line naming what is being consulted reads as an assistant doing
 * something with this animal's content.
 */
function ThinkingIndicator({phases, label}: {phases: string[]; label: string}) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (phases.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((current) => Math.min(current + 1, phases.length - 1));
        }, THINKING_PHASE_MS);
        return () => clearInterval(timer);
    }, [phases.length]);

    return (
        <div className="flex items-center gap-2.5" role="status" aria-label={label}>
            <span aria-hidden="true" className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                    <span
                        key={dot}
                        className="ask-thinking-dot h-1.5 w-1.5 rounded-full bg-primary-400"
                        style={{animationDelay: `${dot * 160}ms`}}
                    />
                ))}
            </span>
            <span className="text-[13px] text-ink-300">{phases[Math.min(index, phases.length - 1)]}</span>
        </div>
    );
}

// MARK: - Icons

/**
 * "What I remember about you". Anything told to one animal is known to all
 * of them, so the list is the same whichever animal opened it; the reader can
 * take any of it back, one fact at a time or all at once.
 */
function AskMemoryPanel({
    labels,
    facts,
    state,
    forgettingFact,
    confirmingForgetAll,
    onRetry,
    onForget,
    onAskForgetAll,
    onCancelForgetAll,
    onForgetAll,
    onBack
}: {
    labels: AskDrawerLabels;
    facts: AskMemoryFact[];
    state: "loading" | "ready" | "failed";
    forgettingFact: string | null;
    confirmingForgetAll: boolean;
    onRetry: () => void;
    onForget: (item: AskMemoryFact) => void;
    onAskForgetAll: () => void;
    onCancelForgetAll: () => void;
    onForgetAll: () => void;
    onBack: () => void;
}) {
    const busy = forgettingFact !== null;
    // What the Wild Profile learned comes first; the rest keep their order.
    const ordered = [...facts.filter(isWildProfileFact), ...facts.filter((item) => !isWildProfileFact(item))];
    return (
        <div className="flex flex-col gap-4" data-testid="ask-memory-panel">
            <div>
                <h2 className="font-display text-xl font-bold leading-7 text-white">{labels.memoryOpen}</h2>
                <p className="mt-1.5 text-sm leading-6 text-ink-300">{labels.memoryHint}</p>
            </div>

            {state === "loading" ? (
                <p className="text-sm text-ink-400">{labels.memoryLoading}</p>
            ) : state === "failed" ? (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-ink-300">{labels.memoryFailed}</p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-200 hover:text-primary-100"
                    >
                        <RefreshIcon />
                        {labels.tryAgain}
                    </button>
                </div>
            ) : facts.length === 0 ? (
                <div>
                    <p className="text-base font-semibold text-white">{labels.memoryEmptyTitle}</p>
                    <p className="mt-1.5 text-sm leading-6 text-ink-300">{labels.memoryEmptyBody}</p>
                </div>
            ) : (
                <>
                    <ul className="flex flex-col gap-2">
                        {ordered.map((item) => (
                            <li
                                key={item.id ?? item.fact}
                                className="flex items-start gap-3 border border-white/10 bg-white/[0.035] py-3 pl-3.5 pr-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-6 text-white">{item.fact}</p>
                                    {memorySourceLine(item, labels) ? (
                                        <p className="mt-0.5 text-[11px] leading-4 text-ink-400">{memorySourceLine(item, labels)}</p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onForget(item)}
                                    disabled={busy}
                                    aria-label={`${labels.memoryForget}: ${item.fact}`}
                                    title={labels.memoryForget}
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-40"
                                >
                                    {forgettingFact === item.fact ? <span className="text-[10px]">…</span> : <CloseIcon />}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {confirmingForgetAll ? (
                        <div className="border border-white/10 bg-white/[0.03] px-3.5 py-3">
                            <p className="text-sm font-semibold text-ink-100">{labels.memoryForgetAllConfirm}</p>
                            <p className="mt-1 text-xs leading-5 text-ink-300">{labels.memoryForgetAllBody}</p>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={onForgetAll}
                                    className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                                >
                                    {labels.memoryForgetAll}
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancelForgetAll}
                                    className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-semibold text-ink-200 transition-colors hover:text-white"
                                >
                                    {labels.clearCancel}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onAskForgetAll}
                            disabled={busy}
                            className="w-full border border-white/12 px-3.5 py-2.5 text-xs font-semibold text-ink-200 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                        >
                            {labels.memoryForgetAll}
                        </button>
                    )}
                </>
            )}

            <button
                type="button"
                onClick={onBack}
                className="self-start text-xs font-semibold text-primary-200 hover:text-primary-100"
            >
                {labels.memoryBack}
            </button>
        </div>
    );
}

/** "Told to the Wolf, 2 Oct 2026" or "From your Wild Profile, …" — who learned it and when. */
function memorySourceLine(item: AskMemoryFact, labels: AskDrawerLabels): string | null {
    const parts: string[] = [];
    if (isWildProfileFact(item)) parts.push(labels.memoryFromWildProfile);
    else if (item.animal) parts.push(labels.memoryToldTo.replace("{animal}", item.animal));
    const day = item.noted_at?.slice(0, 10);
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const date = new Date(`${day}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) {
            parts.push(date.toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}));
        }
    }
    return parts.length > 0 ? parts.join(", ") : null;
}

function icon(path: React.ReactNode, strokeWidth = 2) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const SparkIcon = () => icon(<path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.4 8.6 10.8 4 9.4 8.6 8Z" />);
const CloseIcon = () => icon(<path d="M5.5 5.5l9 9m0-9l-9 9" />);
const PencilIcon = () => icon(<path d="M4 16h3.5l8-8a2.1 2.1 0 0 0-3-3l-8 8V16Z" />);
const MemoryIcon = () => icon(<path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v1.2A3.3 3.3 0 0 0 7 14.6V17h6v-2.4a3.3 3.3 0 0 0 1.5-5.9V7.5A4.5 4.5 0 0 0 10 3Zm-2 14h4" />);
const ArrowUpIcon = () => icon(<path d="M10 16V5m0 0-4.5 4.5M10 5l4.5 4.5" />, 2.4);
const StopIcon = () => (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" />
    </svg>
);
const ArrowUpRightIcon = () => icon(<path d="M6.5 13.5l7-7m0 0h-5m5 0v5" />, 2.2);
const CopyIcon = () => icon(<path d="M7.5 7.5V5.2A1.2 1.2 0 0 1 8.7 4h6.1A1.2 1.2 0 0 1 16 5.2v6.1a1.2 1.2 0 0 1-1.2 1.2H12.5M5.2 7.5h6.1A1.2 1.2 0 0 1 12.5 8.7v6.1A1.2 1.2 0 0 1 11.3 16H5.2A1.2 1.2 0 0 1 4 14.8V8.7A1.2 1.2 0 0 1 5.2 7.5Z" />);
const CheckIcon = () => icon(<path d="M4.5 10.5l3.5 3.5 7.5-8" />, 2.4);
const ShareIcon = () => icon(<path d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4.5 12v2.8A1.2 1.2 0 0 0 5.7 16h8.6a1.2 1.2 0 0 0 1.2-1.2V12" />);
const SealIcon = () => icon(<path d="M10 2.8l1.8 1.3 2.2-.1.7 2.1 1.8 1.3-.7 2.1.7 2.1-1.8 1.3-.7 2.1-2.2-.1L10 17.2l-1.8-1.3-2.2.1-.7-2.1-1.8-1.3.7-2.1-.7-2.1 1.8-1.3.7-2.1 2.2.1Zm-2.6 7.4 1.8 1.8 3.6-3.8" />);
const ReferralIcon = () => icon(<path d="M5 15V9.5A3.5 3.5 0 0 1 8.5 6H15m0 0-3-3m3 3-3 3" />);
const RefreshIcon = () => icon(<path d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 4v3h-3" />);
