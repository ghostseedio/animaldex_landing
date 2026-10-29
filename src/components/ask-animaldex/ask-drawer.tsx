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
    EMPTY_COMPANION_LOOP,
    companionDisplayName,
    referralCapturePath,
    type AskCompanionEvent,
    type AskCompanionLoop
} from "@/lib/ask-animaldex/companion-loop";
import {bondChipText, bondStageText, decodeChatBond, fillWords, type ChatBond, type CompanionWords} from "@/lib/companion-bond";
import BondPanel from "@/components/companions/bond-panel";
import {reloadCompanions, useAnimalBond, useChatCaptureId} from "@/components/companions/use-companions";
import {noteAnimalMessagesMuted, noteAnimalMessagesRead} from "@/components/companions/use-animal-conversations";
import AnimalNameSheet from "@/components/companions/name-sheet";
import {CAPTURE_NICKNAME_EVENT, type CaptureNicknameDetail} from "@/lib/capture-nickname";
import {
    AskAnimalFace,
    AskAnimalHero,
    AskMenu,
    AskReplyBubbles,
    AskSuggestionBar,
    AskTimeLabel,
    AskTypingBubble,
    AskUserBubble,
    ASK_BUBBLE_INCOMING,
    AskReportSheet,
    MoreIcon,
    type AskMenuItem
} from "@/components/ask-animaldex/ask-messenger";
import {ASK_SUGGESTION_FRESHNESS_MS, askLabelledIndices, askReplyPieces, askTimeLabel} from "@/lib/ask-animaldex/thread-layout";
import {mergeAskAnimalMessages, parseAskAnimalMessages} from "@/lib/ask-animaldex/animal-messages";
import type {AskReportChoice} from "@/lib/ask-animaldex/report";
import {createAskMessage, type AskFollowUpResolution} from "@/lib/ask-animaldex/thread";
import {AskLitPlainText} from "@/components/ask-animaldex/ask-messenger";
import {askReplyWords} from "@/lib/ask-animaldex/spoken-words";
import {AskChatOptions, AskSoundCreditsPanel, AskVoiceIcon} from "@/components/ask-animaldex/ask-chat-audio";
import {useAnimalSpeech, type AskSpeechAllowance, type AskSpeechNotice, type AskSpeechPhase} from "@/components/ask-animaldex/use-animal-speech";
import {useAnimalSounds} from "@/components/ask-animaldex/use-animal-sounds";
import AskVoiceCallButton from "@/components/ask-animaldex/voice-call/ask-voice-call-button";
import {askCallsOffered} from "@/lib/ask-animaldex/call-gate";

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
    /** The companion loop on the owner's chat, under the animal's name. */
    workingOn: string;
    notThisAnyMore: string;
    doneTogether: string;
    powerYours: string;
    powerWaitsForTraining: string;
    talkTo: string;
    talkToHint: string;
    /** A Trial's own thread. */
    trialPlaceholder: string;
    trialEmptyHeading: string;
    bondLevel: string;
    /** Why a reply failed, in the reader's language. */
    errorUnavailable: string;
    errorEmpty: string;
    errorOffline: string;
    errorTimeout: string;
    errorNetwork: string;
    errorGeneric: string;
    /** A check-in the animal raised: done, not now, stop asking. */
    checkInDone: string;
    checkInNotNow: string;
    checkInStop: string;
    checkInFailed: string;
    /** Done on the check-in for the step the animal set: sent to the animal as the reader's message. */
    checkInDidIt: string;
    report: string;
    reportTitle: string;
    reportOffensive: string;
    reportInaccurate: string;
    reportOther: string;
    reportThanks: string;
    reportFailed: string;
    sending: string;
    /** An animal without a nickname, inside a sentence. */
    theAnimal: string;
    muteAnimal: string;
    unmuteAnimal: string;
    /** How the animals talk with the reader, in the memory panel. */
    prefPersonalise: string;
    prefPersonaliseDetail: string;
    prefSteps: string;
    prefStepsDetail: string;
    prefCheckBack: string;
    prefCheckBackDetail: string;
    prefAnimalMessages: string;
    prefAnimalMessagesDetail: string;
    prefVisitors: string;
    prefVisitorsDetail: string;
    prefFailed: string;
    memoryCorrect: string;
    memoryCorrectHint: string;
    memorySave: string;
    /** After a free account's third finished reply on its own card, once. */
    proIntroEyebrow: string;
    proIntroBody: string;
    proIntroCta: string;
    notNow: string;
    /** Under the animal's name while it answers. */
    typing: string;
    /** Time labels between sittings: "Today 14:02". */
    today: string;
    yesterday: string;
    /** A suggested reply, for screen readers. */
    say: string;
    /** A reply's menu. */
    more: string;
    askAgain: string;
    /** Under the animal's name on its card, once enough people have. */
    talkCount: string;
    /** The composer on the owner's chat with an animal they named. */
    placeholderNamed: string;
    /** Whose animal it is, on someone else's card. */
    ownersAnimal: string;
    latestMessages: string;
    trialHero: string;
    /** The chat's ••• menu. */
    chatOptions: string;
    /** A reply's menu: play it in the animal's voice. */
    hearIt: string;
    voiceStop: string;
    /** Spoken replies left today, for a free account. */
    voiceLeftToday: string;
    /** The voice icon beside a reply, for screen readers. */
    hearReply: string;
    stopVoice: string;
    /** The header's speaker: replies speak by themselves while it is on. */
    voiceOff: string;
    voiceOn: string;
    voiceLimitPro: string;
    voiceLimitFree: string;
    voiceFailed: string;
    seePro: string;
    /** The chat's menu: one of the animal's recorded calls, now. */
    hearCall: string;
    /** The chat's menu: the animal's recorded sounds as it types. */
    animalSounds: string;
    soundCredits: string;
    soundCreditsSpecies: string;
    soundCreditsHabitat: string;
    soundOriginal: string;
    /** The bond screen's words (and the bond chip's stage), in the reader's language. */
    companions: CompanionWords;
};

type AskMemoryFact = {id?: string; fact: string; animal: string | null; noted_at: string | null; source?: string; pinned?: boolean};

/** How the animals talk with the reader: each switch the server answered, null when it could not. */
type AskMemorySettings = {
    personalisationEnabled: boolean | null;
    suggestSteps: boolean | null;
    followUpsEnabled: boolean | null;
    shareJourney: boolean | null;
    animalMessagesEnabled: boolean | null;
};

/** What Pro adds to the chat, as the apps' introduction says it (`CreditStoreCatalog`). */
const PRO_DAILY_MESSAGES = 100;
const PRO_DAILY_VOICE_REPLIES = 30;
/** The Pro introduction shows once per browser, as the apps show it once per account. */
const PRO_INTRO_SHOWN_KEY = "animaldex:ask:pro-intro-shown";

function readFlag(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
}

function writeFlag(key: string) {
    try {
        window.localStorage.setItem(key, "1");
    } catch {
        // Session-only, then.
    }
}

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
    /** The canonical species: its recorded sounds and its voice are filed under it. */
    speciesProfileId?: string | null;
    /** How many people have talked to it, once enough have. */
    talkCount?: {people: number; peopleThisWeek: number} | null;
    /** The owner's own name for it, on their own card. */
    nickname?: string | null;
    /** Whose animal it is, on someone else's card. */
    ownerName?: string | null;
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
    const [memorySettings, setMemorySettings] = useState<AskMemorySettings | null>(null);
    const [savingPreference, setSavingPreference] = useState(false);
    const [preferenceFailed, setPreferenceFailed] = useState(false);
    // Report this reply: which reply, and how the report is going.
    const [reportTarget, setReportTarget] = useState<AskMessage | null>(null);
    const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

    const threadKey = askThreadKey(subject);
    const hints = context?.hints ?? EMPTY_ASK_HINTS;
    const resolvedSubject = context?.subject ?? subject;
    // The animal itself talks here, and its thread is a messenger (the apps'
    // one-to-one chat since AnimalDex bdfaccde). The site-wide assistant keeps
    // its answers pinned under the question instead.
    const messenger = resolvedSubject.scope === "species" && Boolean(hints.animalName ?? resolvedSubject.name);

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
        continueWithCredits,
        updateMessage,
        transformThread
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
    // The name the owner gave it here, before the context is read again.
    const [savedNickname, setSavedNickname] = useState<{captureId: string; nickname: string | null} | null>(null);
    const [showingNameSheet, setShowingNameSheet] = useState(false);
    useEffect(() => {
        const onNamed = (event: Event) => {
            const detail = (event as CustomEvent<CaptureNicknameDetail>).detail;
            if (detail?.captureId) setSavedNickname({captureId: detail.captureId, nickname: detail.nickname});
        };
        window.addEventListener(CAPTURE_NICKNAME_EVENT, onNamed);
        return () => window.removeEventListener(CAPTURE_NICKNAME_EVENT, onNamed);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setContext(null);
        setShowingNameSheet(false);
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

    /**
     * What the animal wrote to the owner while they were away joins their
     * chat first, each as its own reply in time order, and is marked read
     * (AnimalDex 51293f02). It has spoken, so then there is no hello as well;
     * the hello waits on this read, three seconds at most.
     */
    const animalSpeciesId = ownerChat ? companionSpeciesProfileId : null;
    const [animalMessagesSettled, setAnimalMessagesSettled] = useState(false);
    const [animalMuted, setAnimalMuted] = useState<boolean | null>(null);
    useEffect(() => {
        setAnimalMessagesSettled(false);
        setAnimalMuted(null);
        if (!animalSpeciesId) return;
        let cancelled = false;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        void fetch(`/api/ask/animal-messages?speciesProfileId=${encodeURIComponent(animalSpeciesId)}`, {signal: controller.signal})
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {messages?: unknown; muted?: boolean} | null) => {
                if (cancelled || !payload) return;
                setAnimalMuted(payload.muted === true);
                const incoming = parseAskAnimalMessages(payload.messages);
                transformThread((current) => {
                    const merged = mergeAskAnimalMessages(incoming, current, (message) =>
                        createAskMessage("assistant", message.body, {animalMessageId: message.id, createdAt: message.createdAt})
                    );
                    return merged.merged.length > 0 ? merged.messages : current;
                });
                // Not tied to this drawer: closing it a moment later must not
                // leave them unread behind a thread that already shows them.
                void fetch("/api/ask/animal-messages", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({action: "read", speciesProfileId: animalSpeciesId}),
                    keepalive: true
                })
                    .then((response) => (response.ok ? response.json() as Promise<{unread?: unknown}> : null))
                    .then((read) => {
                        // The Companions row and the tab's count drop at once.
                        if (read) noteAnimalMessagesRead(animalSpeciesId, typeof read.unread === "number" ? read.unread : null);
                        return reloadCompanions();
                    })
                    .catch(() => undefined);
            })
            .catch(() => undefined)
            .finally(() => {
                clearTimeout(timer);
                if (!cancelled) setAnimalMessagesSettled(true);
            });
        return () => {
            cancelled = true;
            clearTimeout(timer);
            controller.abort();
        };
    }, [animalSpeciesId, transformThread]);

    /** "Mute messages from Luna" / "Let Luna message you", back as it was if that fails. */
    const toggleAnimalMuted = useCallback(() => {
        if (!animalSpeciesId || animalMuted === null) return;
        const muted = !animalMuted;
        setAnimalMuted(muted);
        void fetch("/api/ask/animal-messages", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "mute", speciesProfileId: animalSpeciesId, muted})
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
            .then((payload: {muted?: boolean}) => {
                setAnimalMuted(payload.muted === true);
                noteAnimalMessagesMuted(animalSpeciesId, payload.muted === true);
            })
            .catch(() => setAnimalMuted(!muted));
    }, [animalSpeciesId, animalMuted]);

    useEffect(() => {
        if (!canGreet || isSending) return;
        if (animalSpeciesId && !animalMessagesSettled) return;
        if (greetsForReferral) {
            void greet({referralId});
            return;
        }
        if (messages.length > 0 || greetingState !== "idle") return;
        void greet();
    }, [canGreet, greetsForReferral, referralId, messages.length, greetingState, isSending, greet, animalSpeciesId, animalMessagesSettled]);

    // The loop as it stands when the chat opens; replies keep it current.
    useEffect(() => {
        setCompanionLoop(null);
        if (!ownerChat || !companionSpeciesProfileId) return;
        let cancelled = false;
        void fetch(`/api/ask/companion?speciesProfileId=${encodeURIComponent(companionSpeciesProfileId)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {loop?: unknown} | null) => {
                // The route answers the loop already read (`parseCompanionFocus`
                // on the RPC's row); reading it a second time lost the focus.
                const raw = payload?.loop && typeof payload.loop === "object" ? payload.loop as Partial<AskCompanionLoop> : null;
                const loop: AskCompanionLoop | null = raw
                    ? {
                        focus: typeof raw.focus === "string" && raw.focus ? raw.focus : null,
                        openTrial: typeof raw.openTrial === "string" && raw.openTrial ? raw.openTrial : null,
                        yourTrialsDone: typeof raw.yourTrialsDone === "number" ? raw.yourTrialsDone : 0
                    }
                    : null;
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
    // The animal's voice: replies spoken on request, or by themselves while
    // the header's speaker is on, with the word being said lit. The speech
    // allowance is an account's, so a signed-in reader's only.
    const speech = useAnimalSpeech({
        available: messenger && Boolean(context?.signedIn),
        captureId: resolvedSubject.captureId ?? null,
        speciesProfileId: context?.speciesProfileId ?? null
    });
    // Its own recorded sounds as it types, quiet once its voice is speaking
    // (not while the voice loads, so its opening call is not cut short).
    // On a call the animal's voice is the call's; the thread stays quiet.
    const [onCall, setOnCall] = useState(false);
    const sounds = useAnimalSounds({
        speciesProfileId: messenger ? context?.speciesProfileId ?? null : null,
        pace: persona?.pace ?? null,
        held: speech.isPlaying || onCall
    });
    const [showingSoundCredits, setShowingSoundCredits] = useState(false);
    useEffect(() => {
        if (showingMemory || showingBond) setShowingSoundCredits(false);
    }, [showingMemory, showingBond]);
    const pacer = useReplyPacer({
        messageId: pacedMessage && pacedMessage.status !== "failed" ? pacedMessage.id : null,
        text: pacedMessage?.text ?? "",
        sourceDone: pacedMessage?.status === "complete",
        persona,
        instant: reducedMotion,
        onWordShown: ({isFirst, endsSentence}) => (isFirst ? sounds.replyBegan() : sounds.wordShown(endsSentence))
    });
    // A reply (or the hello) that has just arrived speaks by itself, once; one
    // the reader stopped does not.
    const spokenIdRef = useRef<string | null>(null);
    const pacedComplete = pacedMessage?.status === "complete" ? pacedMessage : null;
    useEffect(() => {
        if (!pacedComplete || spokenIdRef.current === pacedComplete.id || !pacedComplete.text.trim()) return;
        spokenIdRef.current = pacedComplete.id;
        // A call's replies were heard on the call.
        if (onCall) return;
        speech.speakAutomatically(pacedComplete.id, pacedComplete.text);
    }, [pacedComplete, speech, onCall]);
    // Typing counts as talking: Stop stays until the last word is shown.
    const animalTalking = isSending || pacer.revealing;
    // With something typed the button sends, over a greeting or a reply that
    // is only still typing out; a reply still arriving is stopped first.
    const showStop = (isSending && greetingState !== "loading") || (animalTalking && composer.trim().length === 0);
    const stopTalking = useCallback(() => {
        // Still arriving: stop it, keeping what the reader saw. All here:
        // show the rest.
        if (isSending) {
            spokenIdRef.current = pacedId;
            stop(pacer.messageId ? pacer.visibleText : undefined);
        } else {
            pacer.skipToEnd();
        }
    }, [isSending, stop, pacer, pacedId]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (reportTarget) {
                    setReportTarget(null);
                    return;
                }
                if (confirmingClear) {
                    setConfirmingClear(false);
                    return;
                }
                close();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [close, confirmingClear, reportTarget]);

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
        if (messenger) return;
        if (!trailingQuestionId || trailingQuestionId === lastPinnedId.current) return;
        lastPinnedId.current = trailingQuestionId;
        const node = trailingQuestionRef.current;
        const scroller = scrollRef.current;
        if (!node || !scroller) return;
        scroller.scrollTo({
            top: node.offsetTop - scroller.offsetTop - 12,
            behavior: "smooth"
        });
    }, [trailingQuestionId, messenger]);

    /**
     * The messenger rests on the composer, as a message thread does: it
     * follows the animal's words to the bottom while the reader is there, and
     * leaves them alone once they scroll back ("Latest messages" brings them
     * down again). A message the reader sends always goes to the bottom.
     */
    const sticksToBottom = useRef(true);
    const [showsLatest, setShowsLatest] = useState(false);
    const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
        const scroller = scrollRef.current;
        if (!scroller) return;
        sticksToBottom.current = true;
        setShowsLatest(false);
        scroller.scrollTo({top: scroller.scrollHeight, behavior});
    }, []);
    const onThreadScroll = useCallback(() => {
        const scroller = scrollRef.current;
        if (!scroller || !messenger) return;
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        sticksToBottom.current = distance < 72;
        setShowsLatest(distance > 160);
    }, [messenger]);
    useLayoutEffect(() => {
        if (!messenger || showingMemory || showingBond || showingSoundCredits || !sticksToBottom.current) return;
        const scroller = scrollRef.current;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    useEffect(() => {
        if (messenger && trailingQuestionId) scrollToLatest();
    }, [messenger, trailingQuestionId, scrollToLatest]);

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
        // The composer shrinks back to one line with what it held.
        if (composerRef.current) composerRef.current.style.height = "";
        setShowingMemory(false);
        // The reader speaks: the animal stops talking. Inside their own click
        // or key press, the browser then lets the reply speak by itself.
        speech.stop();
        speech.prime();
        void send(question);
    }, [close, isSending, greetingState, locale, resolvedSubject.slug, send, speech]);

    const loadMemory = useCallback(async () => {
        setMemoryState("loading");
        try {
            const response = await fetch("/api/ask/memory", {method: "GET"});
            if (!response.ok) throw new Error(String(response.status));
            const payload = await response.json() as {ok?: boolean; facts?: AskMemoryFact[]; settings?: AskMemorySettings};
            setMemoryFacts(Array.isArray(payload.facts) ? payload.facts : []);
            setMemorySettings(payload.settings ?? null);
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

    /** "Correct this": the reader's own words for a fact (an empty one forgets it). */
    const correctFact = useCallback(async (item: AskMemoryFact, text: string) => {
        if (!item.id) return false;
        setForgettingFact(item.fact);
        try {
            const response = await fetch("/api/ask/memory", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "correct", id: item.id, text})
            });
            if (!response.ok) return false;
            const payload = await response.json() as {facts?: AskMemoryFact[]};
            setMemoryFacts(Array.isArray(payload.facts) ? payload.facts : []);
            return true;
        } catch {
            return false;
        } finally {
            setForgettingFact(null);
        }
    }, []);

    /** One of the switches for how the animals talk with them; the server's answer is what shows. */
    const setPreference = useCallback(async (patch: Partial<AskMemorySettings>) => {
        setSavingPreference(true);
        setPreferenceFailed(false);
        try {
            const response = await fetch("/api/ask/memory", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "preferences", ...patch})
            });
            if (!response.ok) throw new Error(String(response.status));
            const payload = await response.json() as {settings?: AskMemorySettings};
            if (payload.settings) setMemorySettings(payload.settings);
        } catch {
            setPreferenceFailed(true);
        } finally {
            setSavingPreference(false);
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
    // On someone else's card the animal is theirs; on the owner's, the name they gave it.
    const ownerName = context?.ownerName ?? null;
    const named = savedNickname && savedNickname.captureId === resolvedSubject.captureId ? savedNickname : null;
    const nickname = ownerName ? null : named ? named.nickname : context?.nickname ?? null;
    // "Name your Gray Wolf", on the owner's own card while it has no name (iOS AnimalPowerAskChatView).
    const nameTitle = ownerChat && !nickname && resolvedSubject.captureId && animalName
        ? fillWords(labels.companions.naming.nameYour, {animal: animalName})
        : null;
    const speakerName = nickname ?? animalName ?? labels.title;
    const suggestions = context?.suggestions ?? askSuggestions(resolvedSubject, hints);

    const aboutTrial = Boolean(resolvedSubject.trialContext);
    // On a species page the animal answers as itself; everywhere else the
    // site-wide assistant does.
    const speaksAsAnimal = resolvedSubject.scope === "species" && Boolean(animalName);
    // The animal's face is its icon art, never a capture photo.
    const faceUrl = speaksAsAnimal ? avatarUrl : photoUrl;
    const placeholder = messenger && animalName && !(aboutTrial && !hasConversation)
        ? (nickname
            ? labels.placeholderNamed.replace("{name}", nickname)
            : labels.placeholderFollowUpAnimal.replace("{animal}", animalName))
        : hasConversation
        ? (speaksAsAnimal && animalName
            ? labels.placeholderFollowUpAnimal.replace("{animal}", animalName)
            : labels.placeholderFollowUp)
        : aboutTrial
            ? labels.trialPlaceholder
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

    // MARK: The messenger's own parts

    // Under the name on the animal's card: the Trial it is about, whose it is,
    // or its temperament once it has spoken.
    const heroSubtitle = aboutTrial
        ? labels.trialHero
        : ownerName && animalName
            ? labels.ownersAnimal.replace("{owner}", ownerName).replace("{animal}", animalName)
            : persona?.tagline ?? (nickname ? animalName : labels.inOwnWords);
    const popularity = context?.talkCount
        ? labels.talkCount.replace("{count}", shortCount(context.talkCount.people, locale))
        : null;
    // Under the name in the header: typing while it answers, else how it is.
    const headerStatus = ownerName && animalName
        ? labels.ownersAnimal.replace("{owner}", ownerName).replace("{animal}", animalName)
        : persona?.tagline ?? (nickname ? animalName : labels.inOwnWords);
    const labelledIndices = useMemo(
        () => askLabelledIndices(messages.map((message) => new Date(message.createdAt))),
        [messages]
    );
    /**
     * What the reader might say next, docked above the composer: the newest
     * reply's own suggestions, or the openers while the thread is empty and
     * the animal could not say hello. Hidden while it talks, once the reader
     * starts typing, and when the suggestions are stale.
     */
    const dockedSuggestions = useMemo(() => {
        if (!messenger || animalTalking || quota.reached || composer.trim()) return [] as string[];
        const openers = suggestions.slice(0, 3).map((item) => item.prompt);
        const newest = messages[messages.length - 1];
        if (!newest) return awaitingGreeting ? [] : openers;
        if (newest.role !== "assistant" || newest.status !== "complete") return [];
        if (Date.now() - Date.parse(newest.createdAt) >= ASK_SUGGESTION_FRESHNESS_MS) return [];
        if (!hasConversation && newest.followUpPrompts.length === 0) return openers;
        return newest.followUpPrompts.slice(0, 3);
    }, [messenger, animalTalking, quota.reached, composer, suggestions, messages, awaitingGreeting, hasConversation]);

    /**
     * One of the three chips under a check-in the animal raised. "Done" on
     * the check-in for the step the animal set tells the animal instead,
     * which asks how it went and counts it (AnimalDex e84e88e2); the
     * check-in closes with the step.
     */
    const resolveFollowUp = useCallback(async (message: AskMessage, resolution: AskFollowUpResolution): Promise<boolean> => {
        const followUp = message.followUp;
        if (!followUp) return false;
        const step = companionLoop?.openTrial?.trim().toLowerCase() ?? "";
        const topic = followUp.topic.trim().toLowerCase();
        if (resolution === "done" && !isSending && step && topic && step.startsWith(topic)) {
            updateMessage(message.id, {followUpResolution: "done"});
            submit(labels.checkInDidIt.replace("{step}", followUp.topic), "chip");
            return true;
        }
        try {
            const response = await fetch("/api/ask/followup", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id: followUp.id, action: resolution})
            });
            if (!response.ok) return false;
        } catch {
            return false;
        }
        updateMessage(message.id, {followUpResolution: resolution});
        return true;
    }, [companionLoop, isSending, updateMessage, submit, labels.checkInDidIt]);

    /** Report this reply: files it for review, as the reader. */
    const sendReport = useCallback(async (choice: AskReportChoice) => {
        if (!reportTarget) return;
        setReportState("sending");
        try {
            const response = await fetch("/api/ask/report", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    choice,
                    text: askMarkdownPlainText(reportTarget.text),
                    animalName: animalName ?? "",
                    captureId: resolvedSubject.captureId
                })
            });
            setReportState(response.ok ? "sent" : "failed");
        } catch {
            setReportState("failed");
        }
    }, [reportTarget, animalName, resolvedSubject.captureId]);
    const openReport = useCallback((message: AskMessage) => {
        setReportState("idle");
        setReportTarget(message);
    }, []);

    /**
     * Once, after the third finished reply of a free account's own
     * conversation: never in someone else's chat or a Trial, never over the
     * limit notice. Whether the account is free is the server's allowance,
     * never a client Pro flag (AnimalDex d8a1c61c).
     */
    const finishedReplies = useMemo(
        () => messages.filter((message) => message.role === "assistant" && message.status === "complete" && !message.isGreeting && !message.animalMessageId).length,
        [messages]
    );
    const [showsProIntro, setShowsProIntro] = useState(false);
    useEffect(() => {
        if (showsProIntro || finishedReplies < 3 || quota.isPro !== false || quota.remaining === null) return;
        if (!ownerChat || aboutTrial || quota.reached || animalTalking || readFlag(PRO_INTRO_SHOWN_KEY)) return;
        writeFlag(PRO_INTRO_SHOWN_KEY);
        trackEvent("pro_intro_shown", {moment: "first_chat", surface: "web"});
        setShowsProIntro(true);
    }, [showsProIntro, finishedReplies, quota.isPro, quota.remaining, quota.reached, ownerChat, aboutTrial, animalTalking]);

    // Today's messages are spent: what to say and the reader's next step. A
    // card under the site-wide assistant's answers; in the animal's thread it
    // takes the composer's place, flush in its band, as in the apps.
    const limitNoticeContent = (
        <>
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
        </>
    );

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
                        {messenger ? (
                            // Present, the way a contact shows as online.
                            <span className="relative shrink-0">
                                <AskAnimalFace url={faceUrl} size={32} />
                                <span aria-hidden="true" className="absolute bottom-0 right-0 h-[9px] w-[9px] rounded-full border-2 border-canvas-950 bg-primary-400" />
                            </span>
                        ) : faceUrl ? (
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
                                    {messenger ? speakerName : animalName ?? labels.title}
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
                                        aria-label={bondChip(chipBond, labels)}
                                        title={bondChip(chipBond, labels)}
                                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                                            showingBond ? "border-primary-300/50 bg-primary-400/14 text-white" : "border-white/12 text-ink-200 hover:text-white"
                                        }`}
                                    >
                                        {/* Beside the header's buttons the stage runs out of room:
                                            the level alone, never "Level 4 · Worki…" (AnimalDex
                                            3a603746); the animal's card shows it whole. */}
                                        {chipBond.level !== null
                                            ? labels.bondLevel.replace("{level}", String(chipBond.level))
                                            : bondStageText(chipBond, labels.companions)}
                                    </button>
                                ) : null}
                            </div>
                            {messenger && animalTalking ? (
                                <p className="truncate text-[11px] leading-4 text-primary-300" aria-live="polite">{labels.typing}</p>
                            ) : ownerChat && companionLoop?.focus ? (
                                // What the two of you are working on, once the animal has found it.
                                <div className="flex min-w-0 items-baseline gap-2">
                                    <p className="min-w-0 truncate text-[11px] leading-4 text-ink-300" title={companionLoop.focus}>
                                        {labels.workingOn.replace("{focus}", companionLoop.focus)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={clearCompanionFocus}
                                        className="shrink-0 text-[11px] font-semibold leading-4 text-ink-400 underline-offset-2 transition-colors hover:text-white hover:underline"
                                    >
                                        {labels.notThisAnyMore}
                                    </button>
                                </div>
                            ) : speaksAsAnimal ? (
                                // Whose it is, or its temperament once it has spoken, as in the app's header.
                                <p className="truncate text-[11px] leading-4 text-ink-400">{headerStatus}</p>
                            ) : null}
                        </div>
                    </div>
                    {messenger && animalName && askCallsOffered(context?.signedIn === true) ? (
                        // A voice call with its talking 3D model, when it has one (voice-call/).
                        <AskVoiceCallButton
                            threadKey={threadKey}
                            animalName={animalName}
                            names={[hints.animalName, resolvedSubject.name, resolvedSubject.slug]}
                            locale={locale}
                            disabled={isSending}
                            send={send}
                            stop={stop}
                            onOpen={() => {
                                speech.stop();
                                sounds.stop();
                            }}
                            onCallChange={setOnCall}
                        />
                    ) : null}
                    {speaksAsAnimal && context?.signedIn && !messenger ? (
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
                    {messenger ? null : <button
                        type="button"
                        onClick={() => setConfirmingClear(true)}
                        disabled={!hasConversation}
                        aria-label={labels.newConversation}
                        title={labels.newConversation}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                    >
                        <PencilIcon />
                    </button>}
                    {messenger ? (
                        <AskChatOptions
                            labels={labels}
                            voiceAvailable={Boolean(context?.signedIn)}
                            autoplay={speech.autoplay}
                            onAutoplay={speech.setAutoplay}
                            bank={sounds.bank}
                            soundsOn={sounds.soundsOn}
                            onSounds={sounds.setSoundsOn}
                            onHearCall={() => {
                                speech.stop();
                                sounds.playCall();
                            }}
                            onCredits={() => {
                                setShowingMemory(false);
                                setShowingBond(false);
                                setShowingSoundCredits(true);
                            }}
                            extraItems={[
                                // "Name your Gray Wolf" while it has no name (iOS keeps it in the ••• menu too).
                                ...(nameTitle ? [{
                                    label: nameTitle,
                                    icon: <PencilIcon />,
                                    onSelect: () => setShowingNameSheet(true)
                                }] : []),
                                // "Mute messages from Luna" / "Let Luna message you" (AnimalDex 51293f02).
                                ...(animalMuted === null ? [] : [{
                                    label: (animalMuted ? labels.unmuteAnimal : labels.muteAnimal)
                                        .replace("{name}", nickname ?? labels.theAnimal.replace("{animal}", animalName ?? "")),
                                    icon: <BellIcon />,
                                    onSelect: toggleAnimalMuted
                                }]),
                                // In the menu, as on iOS, so the header has room for the call.
                                {
                                    label: labels.newConversation,
                                    icon: <PencilIcon />,
                                    // A chat holding only the hello can start over too, and the
                                    // fresh hello brings the animal's call again (AnimalDex 46809a93).
                                    disabled: messages.length === 0,
                                    onSelect: () => setConfirmingClear(true)
                                },
                                ...(context?.signedIn ? [{
                                    label: labels.memoryOpen,
                                    icon: <MemoryIcon />,
                                    checked: showingMemory,
                                    onSelect: showingMemory ? () => setShowingMemory(false) : openMemory
                                }] : [])
                            ]}
                        />
                    ) : null}
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
                                    speech.stop();
                                    sounds.stop();
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

                <div ref={scrollRef} onScroll={onThreadScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                    {showingBond && ownerChat ? (
                        <div className="-mx-4 -my-4">
                            <BondPanel
                                bond={animalBond.bond}
                                didLoad={animalBond.didLoad}
                                speciesProfileId={companionSpeciesProfileId}
                                slug={resolvedSubject.slug}
                                name={animalName ? companionDisplayName(nickname, animalName, labels.companions.displayName) : labels.title}
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
                                words={labels.companions}
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
                            onCorrect={correctFact}
                            settings={memorySettings}
                            savingPreference={savingPreference}
                            preferenceFailed={preferenceFailed}
                            onSetPreference={(patch) => void setPreference(patch)}
                        />
                    ) : showingSoundCredits && sounds.bank ? (
                        <AskSoundCreditsPanel
                            bank={sounds.bank}
                            animalName={animalName ?? labels.title}
                            labels={labels}
                            onBack={() => setShowingSoundCredits(false)}
                        />
                    ) : messenger ? (
                        // The animal's card at the top, the messages resting on the composer.
                        <div className="flex min-h-full flex-col">
                            <AskAnimalHero
                                name={speakerName}
                                subtitle={heroSubtitle}
                                avatarUrl={faceUrl}
                                popularity={popularity}
                                bondLabel={ownerChat && chipBond ? bondChip(chipBond, labels) : null}
                                onBond={() => {
                                    setShowingMemory(false);
                                    setShowingBond(true);
                                    void animalBond.reload();
                                }}
                                nameLabel={nameTitle}
                                onName={() => setShowingNameSheet(true)}
                            />
                            <div aria-hidden="true" className="min-h-7 flex-1" />
                            <div className="flex flex-col">
                                {messages.map((message, index) => (
                                    <div
                                        key={message.id}
                                        // Tight between two messages from one side, wider when the other speaks.
                                        className={index === 0 ? "" : messages[index - 1].role === message.role ? "pt-1.5" : "pt-3.5"}
                                    >
                                        {labelledIndices.has(index) ? (
                                            <AskTimeLabel
                                                text={askTimeLabel(new Date(message.createdAt), {locale, today: labels.today, yesterday: labels.yesterday})}
                                            />
                                        ) : null}
                                        <AnimalMessageRow
                                            message={message}
                                            labels={labels}
                                            isLast={message.id === lastMessageId}
                                            isSending={isSending}
                                            animalTalking={animalTalking}
                                            faceUrl={faceUrl}
                                            speakerName={speakerName}
                                            photoUrl={photoUrl}
                                            photoAlt={animalName ?? ""}
                                            paced={pacer.messageId === message.id && pacer.revealing ? pacer.visibleText : null}
                                            onSkip={pacer.skipToEnd}
                                            copied={copiedId === message.id}
                                            onCopy={() => copyMessage(message)}
                                            onShare={() => shareMessage(message)}
                                            onRegenerate={() => regenerate(message.id)}
                                            onRetry={() => retry(message.id)}
                                            companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
                                            principleName={hints.principleName}
                                            signInHref={signInHref}
                                            onReport={context?.signedIn ? () => openReport(message) : undefined}
                                            onResolveFollowUp={ownerChat && message.followUp && !message.followUpResolution
                                                ? (resolution) => resolveFollowUp(message, resolution)
                                                : undefined}
                                            voice={context?.signedIn ? {
                                                phase: speech.phase,
                                                allowance: speech.allowance,
                                                notice: speech.notice?.messageId === message.id ? speech.notice : null,
                                                onToggle: () => speech.toggle(message.id, message.text)
                                            } : null}
                                            spokenWord={speech.cursor?.messageId === message.id ? speech.cursor.word : null}
                                        />
                                    </div>
                                ))}
                                {messages.length === 0 && awaitingGreeting ? (
                                    <AskTypingBubble avatarUrl={faceUrl} label={labels.typing} />
                                ) : null}
                                {showsProIntro ? (
                                    <AskProIntroBand
                                        labels={labels}
                                        animalName={speakerName}
                                        href={labels.limitHrefSignedIn}
                                        onSeePro={() => trackEvent("pro_intro_tapped", {moment: "first_chat", surface: "web"})}
                                        onDismiss={() => {
                                            trackEvent("pro_intro_dismissed", {moment: "first_chat", surface: "web"});
                                            setShowsProIntro(false);
                                        }}
                                    />
                                ) : null}
                            </div>
                        </div>
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
                                        ? labels.trialEmptyHeading
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

                    {quota.reached && !showingMemory && !messenger ? (
                        <div className="mt-5 border border-amber-300/25 bg-amber-400/[0.08] p-4">
                            {limitNoticeContent}
                        </div>
                    ) : null}
                </div>

                <div className="relative shrink-0 border-t border-white/10 px-4 pb-4 pt-3">
                    {messenger && showsLatest && !showingMemory && !showingBond ? (
                        <button
                            type="button"
                            onClick={() => scrollToLatest("smooth")}
                            className="absolute -top-11 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/12 bg-canvas-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-colors hover:bg-canvas-850"
                        >
                            {labels.latestMessages}
                            <ArrowDownIcon />
                        </button>
                    ) : null}
                    {messenger && !showingMemory && !showingBond && !showingSoundCredits ? (
                        <AskSuggestionBar
                            suggestions={dockedSuggestions}
                            onPick={(prompt) => submit(prompt, "followup")}
                            disabled={isSending && greetingState !== "loading"}
                            sayLabel={labels.say}
                        />
                    ) : null}
                    {messenger && quota.reached && !showingMemory ? (
                        <div className="pb-1">{limitNoticeContent}</div>
                    ) : (
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
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-ink-400">
                        {/* Only a free budget is counted down: a Pro one is large
                            enough that a meter reads as stingy (as in the apps). */}
                        {remainingCopy && (quota.paying || !quota.isPro) ? <span>{remainingCopy}</span> : null}
                        <span className="min-w-0">{labels.disclaimer}</span>
                    </p>
                </div>
                {reportTarget ? (
                    <AskReportSheet
                        labels={{
                            report: labels.report,
                            title: labels.reportTitle,
                            offensive: labels.reportOffensive,
                            inaccurate: labels.reportInaccurate,
                            other: labels.reportOther,
                            thanks: labels.reportThanks,
                            failed: labels.reportFailed,
                            sending: labels.sending,
                            done: labels.checkInDone,
                            cancel: labels.clearCancel
                        }}
                        state={reportState}
                        onChoose={(choice) => void sendReport(choice)}
                        onClose={() => setReportTarget(null)}
                    />
                ) : null}
                {showingNameSheet && resolvedSubject.captureId && animalName ? (
                    <AnimalNameSheet
                        captureId={resolvedSubject.captureId}
                        animalName={animalName}
                        initialName={nickname}
                        mode="name"
                        words={labels.companions}
                        placement="panel"
                        // The event the save sends sets the name here and on the card.
                        onSaved={() => undefined}
                        onClose={() => setShowingNameSheet(false)}
                    />
                ) : null}
            </div>
        </>
    );
}

/** "8", "1,240", "12K": a count that reads at a glance, as the apps show it. */
function shortCount(count: number, locale: string): string {
    try {
        return new Intl.NumberFormat(locale, count >= 10_000 ? {notation: "compact", maximumFractionDigits: 1} : {}).format(count);
    } catch {
        return String(count);
    }
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

/** Why a reply failed, in the reader's language (the stored English is the fallback). */
function failureText(message: AskMessage, labels: AskDrawerLabels): string {
    switch (message.failureKind) {
        case "unavailable":
            return labels.errorUnavailable;
        case "empty":
            return labels.errorEmpty;
        case "offline":
            return labels.errorOffline;
        case "timeout":
            return labels.errorTimeout;
        case "network":
            return labels.errorNetwork;
        case "generic":
            return labels.errorGeneric;
        default:
            return message.text;
    }
}

/** "Level 4 · Getting to know you", with "Level" in the reader's language. */
function bondChip(bond: ChatBond | {level: number | null; stage?: string | null; stageLabel: string}, labels: AskDrawerLabels): string {
    return bondChipText(bond, labels.companions);
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

/**
 * One message in the animal's messenger thread: the person's bubble, the
 * animal typing, its reply as bubbles (with its menu beside the last), or the
 * reply it could not give, with a way to ask again.
 */
function AnimalMessageRow({
    voice = null,
    spokenWord = null,
    message,
    labels,
    isLast,
    isSending,
    animalTalking,
    faceUrl,
    speakerName,
    photoUrl,
    photoAlt,
    paced,
    onSkip,
    copied,
    onCopy,
    onShare,
    onRegenerate,
    onRetry,
    companionEvent,
    principleName,
    signInHref,
    onReport,
    onResolveFollowUp
}: {
    message: AskMessage;
    labels: AskDrawerLabels;
    isLast: boolean;
    isSending: boolean;
    /** Waiting for the animal, or watching it type. */
    animalTalking: boolean;
    /** Report this reply; signed-in readers only. */
    onReport?: () => void;
    /** The check-in this reply raised, while it is unanswered. */
    onResolveFollowUp?: (resolution: AskFollowUpResolution) => Promise<boolean>;
    faceUrl: string | null;
    speakerName: string;
    photoUrl: string | null;
    photoAlt: string;
    /** While this reply is being typed out, what of it is on screen; null once it is all shown. */
    paced: string | null;
    onSkip: () => void;
    copied: boolean;
    onCopy: () => void;
    onShare: () => void;
    onRegenerate: () => void;
    onRetry: () => void;
    companionEvent?: AskCompanionEvent;
    principleName: string | null;
    signInHref: string;
    /** The animal's voice, for a signed-in reader: this reply played, stopped, or why it could not be. */
    voice?: {
        phase: AskSpeechPhase;
        allowance: AskSpeechAllowance | null;
        notice: AskSpeechNotice | null;
        onToggle: () => void;
    } | null;
    /** The word its voice is saying, among the reply's words on screen; null when it is not speaking. */
    spokenWord?: number | null;
}) {
    if (message.role === "user") return <AskUserBubble text={message.text} label={labels.youAsked} />;

    // Nothing on screen yet: the animal is still finding its first word.
    if (message.status === "thinking" || (paced !== null && paced.length === 0)) {
        return <AskTypingBubble avatarUrl={faceUrl} label={labels.typing} />;
    }

    if (message.status === "failed") {
        const limit = message.limitNotice ? limitFailure(message.limitNotice, labels, signInHref) : null;
        return (
            <div className="flex items-end gap-2 pr-11">
                <AskAnimalFace url={faceUrl} size={28} className="opacity-55" />
                <div
                    className="min-w-0 border px-3.5 py-2.5"
                    style={{borderColor: ASK_BUBBLE_INCOMING, borderRadius: "19px"}}
                >
                    <p className="text-sm leading-6 text-ink-200">{limit?.text ?? failureText(message, labels)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {limit?.link ? (
                            <Link href={limit.link.href} className="text-xs font-semibold text-primary-200 underline underline-offset-2 transition-colors hover:text-primary-100">
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
            </div>
        );
    }

    const typing = paced !== null;
    const isLive = typing || message.status === "streaming";
    const shownText = typing ? paced : message.text;
    const speaking = voice !== null && voice.phase.kind !== "idle" && voice.phase.messageId === message.id;
    const loadingVoice = speaking && voice?.phase.kind === "loading";
    const playingVoice = speaking && voice?.phase.kind === "playing";
    // Where each bubble's words start among the reply's words, so the voice lights the right one.
    const wordStarts = spokenWord !== null ? askReplyWords(askReplyPieces(shownText, !isLive)).pieceStarts : null;
    const freeVoiceLeft = voice?.allowance && !voice.allowance.isPro
        ? labels.voiceLeftToday.replace("{count}", String(voice.allowance.remaining))
        : null;
    // Press-and-hold on the apps: Copy, Share, Hear it and, on the newest reply, Ask again.
    const menuItems: AskMenuItem[] = [
        {label: copied ? labels.copied : labels.copy, icon: copied ? <CheckIcon /> : <CopyIcon />, onSelect: onCopy},
        {label: labels.share, icon: <ShareIcon />, onSelect: onShare},
        ...(voice
            ? [{
                label: speaking ? labels.voiceStop : labels.hearIt,
                detail: speaking ? null : freeVoiceLeft,
                icon: <SpeakerSmallIcon />,
                onSelect: voice.onToggle
            }]
            : []),
        ...(isLast && !message.isGreeting && !message.animalMessageId && !animalTalking
            ? [{label: labels.askAgain, icon: <RefreshIcon />, onSelect: onRegenerate, disabled: isSending}]
            : []),
        // Every animal reply can be flagged for review (Android 8649e5a).
        ...(onReport ? [{label: labels.report, icon: <FlagIcon />, onSelect: onReport}] : [])
    ];
    const checkIn = !isLive && message.followUp && onResolveFollowUp
        ? <AskCheckInChips topic={message.followUp.topic} labels={labels} onResolve={onResolveFollowUp} />
        : null;
    const event = !isLive && companionEvent ? <CompanionEventBlock event={companionEvent} principleName={principleName} labels={labels} /> : null;
    return (
        <div className="group/reply">
            {/* Screen readers get the reply as it arrives, not a word at a time. */}
            {typing ? <p className="sr-only">{askMarkdownPlainText(message.text)}</p> : null}
            <div aria-hidden={typing ? true : undefined}>
                <AskReplyBubbles
                    text={shownText}
                    isLive={isLive}
                    avatarUrl={faceUrl}
                    speakerName={speakerName}
                    photoUrl={photoUrl}
                    photoAlt={photoAlt}
                    onSkip={onSkip}
                    renderPlain={spokenWord !== null && wordStarts
                        ? ({text, sparkle, pieceIndex}) => (
                            <AskLitPlainText text={text} sparkle={sparkle} word={spokenWord - (wordStarts[pieceIndex] ?? 0)} />
                        )
                        : undefined}
                    trailing={
                        <>
                            {voice ? (
                                <AskVoiceIcon
                                    loading={loadingVoice}
                                    playing={playingVoice}
                                    onClick={voice.onToggle}
                                    label={speaking ? labels.stopVoice : labels.hearReply}
                                />
                            ) : null}
                            <span className={`transition-opacity ${isLast ? "" : "opacity-0 focus-within:opacity-100 group-hover/reply:opacity-100 [@media(pointer:coarse)]:opacity-100"}`}>
                                <AskMenu label={labels.more} items={menuItems} align="right">
                                    <MoreIcon />
                                </AskMenu>
                            </span>
                        </>
                    }
                    after={!isLive && (checkIn || event || voice?.notice) ? (
                        <div className="flex flex-col items-start gap-2.5">
                            {voice?.notice ? (
                                // Why its voice could not play, under the reply it was for.
                                <p className="text-[11px] leading-4 text-ink-300">
                                    {voice.notice.kind === "failed"
                                        ? labels.voiceFailed
                                        : voice.notice.offersPro ? labels.voiceLimitFree : labels.voiceLimitPro}
                                    {voice.notice.offersPro ? (
                                        <>
                                            {" "}
                                            <Link href={labels.limitHrefSignedIn} className="font-bold text-primary-300 transition-colors hover:text-primary-200">
                                                {labels.seePro}
                                            </Link>
                                        </>
                                    ) : null}
                                </p>
                            ) : null}
                            {checkIn}
                            {event}
                        </div>
                    ) : null}
                />
            </div>
        </div>
    );
}

/**
 * A check-in the animal raised, under its reply: what it is about, and Done,
 * Not now or Stop asking. On failure the chips stay, with a line saying so.
 */
function AskCheckInChips({
    topic,
    labels,
    onResolve
}: {
    topic: string;
    labels: AskDrawerLabels;
    onResolve: (resolution: AskFollowUpResolution) => Promise<boolean>;
}) {
    const [working, setWorking] = useState<AskFollowUpResolution | null>(null);
    const [failed, setFailed] = useState(false);
    const choose = (resolution: AskFollowUpResolution) => {
        setWorking(resolution);
        setFailed(false);
        void onResolve(resolution).then((ok) => {
            setWorking(null);
            setFailed(!ok);
        });
    };
    const chips: Array<[AskFollowUpResolution, string]> = [
        ["done", labels.checkInDone],
        ["not_now", labels.checkInNotNow],
        ["stopped", labels.checkInStop]
    ];
    return (
        <div className="flex flex-col items-start gap-2">
            <p className="inline-flex items-start gap-1.5 text-[11px] font-semibold leading-4 text-ink-300">
                <CalendarIcon />
                <span>{topic}</span>
            </p>
            <div className="flex flex-wrap gap-2">
                {chips.map(([resolution, title]) => (
                    <button
                        key={resolution}
                        type="button"
                        disabled={working !== null}
                        onClick={() => choose(resolution)}
                        className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:border-primary-300/40 disabled:opacity-50"
                    >
                        {working === resolution ? "…" : title}
                    </button>
                ))}
            </div>
            {failed ? <p className="text-[11px] text-ink-400">{labels.checkInFailed}</p> : null}
        </div>
    );
}

/**
 * The Pro introduction, once, in the thread of a free account's own chat
 * after its third finished reply: a flush band, not a card.
 */
function AskProIntroBand({
    labels,
    animalName,
    href,
    onSeePro,
    onDismiss
}: {
    labels: AskDrawerLabels;
    animalName: string;
    href: string;
    onSeePro: () => void;
    onDismiss: () => void;
}) {
    return (
        <div className="-mx-4 mt-3.5 border-y border-primary-400/20 bg-white/[0.03] px-4 py-4">
            <div className="flex items-center gap-2">
                <p className="flex-1 text-[10px] font-black tracking-[0.14em] text-primary-300">{labels.proIntroEyebrow}</p>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={labels.notNow}
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white"
                >
                    <CloseIcon />
                </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-200">
                {labels.proIntroBody
                    .replace("{animal}", animalName)
                    .replace("{messages}", String(PRO_DAILY_MESSAGES))
                    .replace("{voices}", String(PRO_DAILY_VOICE_REPLIES))}
            </p>
            <div className="mt-3 flex items-center gap-4">
                <Link
                    href={href}
                    onClick={onSeePro}
                    className="inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                >
                    {labels.proIntroCta}
                </Link>
                <button type="button" onClick={onDismiss} className="text-xs font-semibold text-ink-400 transition-colors hover:text-white">
                    {labels.notNow}
                </button>
            </div>
        </div>
    );
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
                <p className="text-sm leading-6 text-ink-200">{limit?.text ?? failureText(message, labels)}</p>
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
                <CompanionEventBlock event={companionEvent} principleName={principleName} labels={labels} />
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
function CompanionEventBlock({event, principleName, labels}: {event: AskCompanionEvent; principleName: string | null; labels: AskDrawerLabels}) {
    const done = event.stepDone;
    const referral = event.referral;
    // That animal's chat on the card you last talked through, else the one the server named.
    const referralCaptureId = useChatCaptureId(referral?.speciesProfileId ?? null, referral?.captureId ?? null);
    const referralHref = referral ? referralCapturePath({...referral, captureId: referralCaptureId}) : null;
    return (
        <div className="flex flex-col items-start gap-2.5">
            {done ? (
                <div className="flex flex-col gap-1">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-300">
                        <SealIcon />
                        {labels.doneTogether}
                    </p>
                    <p className="text-[11px] leading-4 text-ink-300">{done.step}</p>
                    {done.powerEarned && principleName ? (
                        <p className="text-[11px] font-semibold leading-4 text-white">
                            {labels.powerYours.replace("{power}", principleName)}
                        </p>
                    ) : !done.powerEarned && done.powerWaitsForTraining ? (
                        <p className="text-[11px] font-semibold leading-4 text-white">{labels.powerWaitsForTraining}</p>
                    ) : null}
                </div>
            ) : null}
            {referral && referralHref ? (
                <Link
                    href={referralHref}
                    title={labels.talkToHint}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:border-primary-300/40"
                >
                    <ReferralIcon />
                    {labels.talkTo.replace("{name}", companionDisplayName(referral.nickname, referral.animal, labels.companions.displayName))}
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
    onBack,
    onCorrect,
    settings,
    savingPreference,
    preferenceFailed,
    onSetPreference
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
    /** "Correct this": true once saved. */
    onCorrect: (item: AskMemoryFact, text: string) => Promise<boolean>;
    settings: AskMemorySettings | null;
    savingPreference: boolean;
    preferenceFailed: boolean;
    onSetPreference: (patch: Partial<AskMemorySettings>) => void;
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
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
                                    {editing === (item.id ?? item.fact) ? (
                                        <form
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                void onCorrect(item, editText).then((ok) => {
                                                    if (ok) setEditing(null);
                                                });
                                            }}
                                        >
                                            <label className="sr-only" htmlFor={`ask-memory-correct-${item.id}`}>{labels.memoryCorrect}</label>
                                            <input
                                                id={`ask-memory-correct-${item.id}`}
                                                value={editText}
                                                maxLength={400}
                                                autoFocus
                                                onChange={(event) => setEditText(event.target.value)}
                                                className="w-full border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary-300/45"
                                            />
                                            <p className="mt-1 text-[11px] leading-4 text-ink-400">{labels.memoryCorrectHint}</p>
                                            <div className="mt-2 flex gap-3">
                                                <button type="submit" disabled={busy} className="text-xs font-bold text-primary-200 hover:text-primary-100 disabled:opacity-40">
                                                    {labels.memorySave}
                                                </button>
                                                <button type="button" onClick={() => setEditing(null)} className="text-xs font-semibold text-ink-300 hover:text-white">
                                                    {labels.clearCancel}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <p className="text-sm leading-6 text-white">{item.fact}</p>
                                            {memorySourceLine(item, labels) ? (
                                                <p className="mt-0.5 text-[11px] leading-4 text-ink-400">{memorySourceLine(item, labels)}</p>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                                {item.id && !isWildProfileFact(item) && editing !== (item.id ?? item.fact) ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditing(item.id ?? item.fact);
                                            setEditText(item.fact);
                                        }}
                                        disabled={busy}
                                        aria-label={`${labels.memoryCorrect}: ${item.fact}`}
                                        title={labels.memoryCorrect}
                                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-40"
                                    >
                                        <PencilIcon />
                                    </button>
                                ) : null}
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

            {settings ? (
                // How the animals talk with them: edge to edge, like the list above.
                <div className="-mx-4 border-y border-white/10">
                    {settings?.personalisationEnabled !== null && settings?.personalisationEnabled !== undefined ? (
                        <PreferenceRow
                            title={labels.prefPersonalise}
                            detail={labels.prefPersonaliseDetail}
                            value={settings.personalisationEnabled}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({personalisationEnabled: value})}
                        />
                    ) : null}
                    {settings?.suggestSteps !== null && settings?.suggestSteps !== undefined ? (
                        <PreferenceRow
                            title={labels.prefSteps}
                            detail={labels.prefStepsDetail}
                            value={settings.suggestSteps}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({suggestSteps: value})}
                        />
                    ) : null}
                    {settings?.followUpsEnabled !== null && settings?.followUpsEnabled !== undefined ? (
                        <PreferenceRow
                            title={labels.prefCheckBack}
                            detail={labels.prefCheckBackDetail}
                            value={settings.followUpsEnabled}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({followUpsEnabled: value})}
                        />
                    ) : null}
                    {settings?.animalMessagesEnabled !== null && settings?.animalMessagesEnabled !== undefined ? (
                        <PreferenceRow
                            title={labels.prefAnimalMessages}
                            detail={labels.prefAnimalMessagesDetail}
                            value={settings.animalMessagesEnabled}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({animalMessagesEnabled: value})}
                        />
                    ) : null}
                    {settings?.shareJourney !== null && settings?.shareJourney !== undefined ? (
                        <PreferenceRow
                            title={labels.prefVisitors}
                            detail={labels.prefVisitorsDetail}
                            value={settings.shareJourney}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({shareJourney: value})}
                        />
                    ) : null}
                    {preferenceFailed ? <p className="px-4 pb-3 text-[11px] text-ink-400">{labels.prefFailed}</p> : null}
                </div>
            ) : null}

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

/** One switch for how the animals talk with them. */
function PreferenceRow({title, detail, value, disabled, onChange}: {
    title: string;
    detail: string | null;
    value: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{title}</span>
                {detail ? <span className="mt-0.5 block text-[11px] leading-4 text-ink-400">{detail}</span> : null}
            </span>
            <input
                type="checkbox"
                role="switch"
                checked={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="peer sr-only"
            />
            <span
                aria-hidden="true"
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300 ${value ? "bg-primary-400" : "bg-white/15"} ${disabled ? "opacity-50" : ""}`}
            >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
            </span>
        </label>
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
const ArrowDownIcon = () => icon(<path d="M10 4v11m0 0-4.5-4.5M10 15l4.5-4.5" />, 2.4);
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
const BellIcon = () => icon(<path d="M6 13.5V9a4 4 0 0 1 8 0v4.5l1.3 1.5H4.7ZM8.5 16.5a1.6 1.6 0 0 0 3 0" />);
const FlagIcon = () => icon(<path d="M5 17V3.8m0 0h8.5l-1.6 3.1 1.6 3.1H5" />);
const CalendarIcon = () => icon(<path d="M4.5 6h11v9.5h-11Zm0 3h11M8 4v3m4-3v3" />);
const SpeakerSmallIcon = () => icon(<path d="M3.5 8v4h3l4 3.5v-11l-4 3.5Zm10-1.5a4.5 4.5 0 0 1 0 7" />);
