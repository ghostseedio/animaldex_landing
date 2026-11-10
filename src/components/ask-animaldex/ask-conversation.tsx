"use client";

/**
 * The conversation itself, in one of two presentations that change only its
 * layout (docs/rich-chat/SPEC.md, section 4.2): the drawer (`AskDrawer`, a
 * docked panel on desktop, a bottom sheet on mobile) and the full-screen
 * Talk page (/talk/<slug>, a centered column with the composer docked, like
 * an LLM app). One thread, one store key: the drawer's "Full screen" opens the
 * same conversation on the page. Never a second chat.
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
 *
 * 3.2 "Your step" (docs/your-step/SPEC.md, section 5), everything inline in
 * the conversation (docs/your-step/INLINE.md, owner, 2026-10-30): nothing in
 * the chat opens a window. An animal message that carries something to do is
 * a special message (a neon edge on its left, a faint wash, a small label
 * with an icon, its actions inside the bubble), keyed off server state and
 * the reply's card kinds, never off its words:
 *   - the step is the last section of the bubble that set it ("YOUR STEP",
 *     the step, [I'll do it] or [I did it], and [A different step]). Set in
 *     an earlier conversation, or with the thread cleared, it is one more
 *     animal message holding only that section, where the conversation picks
 *     up (`askThreadStep`): never pinned above the thread, never stored or
 *     sent as history, and one step never shows twice;
 *   - "I did it" puts the message bar in report mode: a strip ("Telling
 *     {name} how your step went", the step, ✕), the attach button for one
 *     photo or video, and send at three characters, which uploads, attaches
 *     the report and sends their words with `step_report`, their bubble
 *     labelled "YOUR STEP" with the thumbnail (the composer sheet only below
 *     340 px);
 *   - done is "DONE TOGETHER · +5 XP"; the first done step is the Power
 *     earned, in the same bubble, with a brief burst and Share;
 *   - the Warmup runs in the thread, each question a special message with
 *     its choices as chips, the result line sent to the animal as theirs;
 *   - "{name}'s Trials" sit in the bubble, the chosen one in place, its loop
 *     enlarging in place.
 *
 * 3.2 Debates (docs/debates/SPEC.md, sections 1, 4 and 6): the animal offers
 * a debate in its own words; its `debate` card is a hidden marker, never
 * drawn, and under that reply, when the server allowed the offer
 * (`done.companion.debate_offer`), the app offers [Yes, start a debate]
 * [Not now], the animals it named pre-selected in the setup. "Yes, start a
 * debate", "Start a debate" in the ••• menu and on the Bond tab,
 * and a call that ended on a yes (`debate_request`), open the setup as a band
 * in the thread itself (the modal sheet only at very small widths). Started,
 * the debate runs in the thread where it was asked, its setup one line
 * ("Luna, Pip and Bruno: private debate"), turn by turn with each animal's
 * icon art, then its report band with "Try {name}'s way". Nothing of it shows
 * while the server's switch is off.
 */

import {AnimalChatBlockContext} from "@/components/ask-animaldex/animal-chat-blocks";
import {memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AssistantMarkdown from "@/components/ask-animaldex/assistant-markdown";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {askContextRequestBody, fetchAskContext} from "@/components/ask-animaldex/ask-context-prefetch";
import {useAskThread} from "@/components/ask-animaldex/use-ask-thread";
import {usePrefersReducedMotion, useReplyPacer} from "@/components/ask-animaldex/use-reply-pacer";
import {emitAnimalVoice} from "@/lib/ark/animal-voice";
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
import {useAiChatGate} from "@/components/ai-gate/ai-chat-gate";
import {clearFrontDoorDraft, frontDoorMessageWaiting, takeFrontDoorMessage} from "@/components/talk-front-door/front-door-store";
import {firstMessageOrigin} from "@/lib/talk-front-door";
import {AiNotice, AiTag, useAiLongSession} from "@/components/ai-gate/ai-notices";
import {noteFunnelMessage, noteFunnelReply, trackFunnel} from "@/lib/web-funnel-client";
import {rememberStorePlacement} from "@/lib/store-links";
import {SPECIES_ASK_FUNNEL_EVENTS, SPECIES_ASK_SIGNED_IN_LIMIT} from "@/lib/species-ask";
import {
    EMPTY_COMPANION_LOOP,
    companionDisplayName,
    normalizeCompanionLoop,
    referralCapturePath,
    type AskCompanionEvent,
    type AskCompanionReferral,
    type AskCompanionLoop,
    type AskCompanionStepSet
} from "@/lib/ask-animaldex/companion-loop";
import {askReplyCards} from "@/lib/ask-animaldex/chat-cards";
import {
    cleanStepReport,
    isStepVideoFile,
    reportingStep,
    stepReportReady,
    MAX_STEP_REPORT_CHARACTERS,
    STEP_MEDIA_ACCEPT,
    type AnimalStep,
    type StepFrequency
} from "@/lib/your-step";
import {stepEarnedLine, stepProblemText, stepReportStripText, trialPickedMessage, warmupResultMessage} from "@/lib/your-step-words";
import type {AnimalTrial} from "@/lib/animal-trials";
import {notingTrainingResult, trainingCanStart} from "@/lib/species-training";
import {submitSpeciesTraining, useSpeciesTraining} from "@/components/animal-detail/species-training/use-species-training";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import {
    attachStepReport,
    dropStep,
    noteOpenStep,
    stepFromTrial,
    stepReportThumbnail,
    useCompanionLoopUpdates,
    useOpenStepUpdates
} from "@/components/companions/use-steps";
import {StepDoneChip, type StepReportDraft} from "@/components/companions/step-views";
import {ArkRevealMessages, ArkRevisionCard} from "@/components/ark/ark-views";
import {ArkArrivalLine, ArkStepOfferNote} from "@/components/ark/ark-chat-lines";
import {useArkArrivals, useArkStepOffer} from "@/components/ark/use-ark-chat";
import {useArkPanelControl} from "@/components/ark/ark-panel";
import {arkStepOutcome} from "@/lib/ark-measure";
import {trackArk} from "@/lib/ark-measure-client";
import {arkMoneyFormatter, fetchArkChanges, fetchArkStats, useDisplayCurrency} from "@/components/ark/use-ark";
import {
    ARK_EVENTS,
    arkIsReveal,
    arkIsRevision,
    arkRevealAnchorId,
    arkRevealDone,
    arkRevealShown,
    arkRevealShownParams,
    arkRevisionAnchorId,
    arkRevisionShownParams,
    arkThreadChanges,
    type ArkChange,
    type ArkStats
} from "@/lib/ark";
import {
    AskDebateOfferSection,
    AskDoneSection,
    AskEarnedSection,
    AskStepPreviewSection,
    AskStepSection,
    AskTrialsSection,
    AskWarmupOfferSection,
    AskWarmupQuestion
} from "@/components/ask-animaldex/ask-special";
import {
    answerAskWarmupItem,
    applyWarmupResult,
    askDoneStepIds,
    askEarnedReport,
    askPublicReplySpecials,
    askReplySpecials,
    askStepCarrierId,
    askStepResolution,
    askThreadStep,
    askThreadStepIndex,
    askWarmupAnswers,
    askWarmupItem,
    askWarmupItems,
    askWarmupNextIndex,
    type AskSpecial
} from "@/lib/ask-animaldex/special-messages";
import {bondChipText, decodeChatBond, fillWords, type ChatBond, type CompanionWords} from "@/lib/companion-bond";

import {reloadCompanions, useAnimalBond, useChatCaptureId} from "@/components/companions/use-companions";
import {noteAnimalMessagesMuted, noteAnimalMessagesRead} from "@/components/companions/use-animal-conversations";

import {CAPTURE_NICKNAME_EVENT, type CaptureNicknameDetail} from "@/lib/capture-nickname";
import {
    AskAnimalFace,
    AskAnimalHero,
    AskMenu,
    AskReplyBubbles,
    AskSpecialBubble,
    AskSuggestionBar,
    AskTimeLabel,
    AskTypingBubble,
    AskUserBubble,
    ASK_BUBBLE_INCOMING,
    AskReportSheet,
    AskWalkIcon,
    MoreIcon,
    type AskMenuItem
} from "@/components/ask-animaldex/ask-messenger";
import {ASK_SUGGESTION_FRESHNESS_MS, askLabelledIndices, askReplyPieces, askTimeLabel} from "@/lib/ask-animaldex/thread-layout";
import {mergeAskAnimalMessages, parseAskAnimalMessages} from "@/lib/ask-animaldex/animal-messages";
import type {AskReportChoice} from "@/lib/ask-animaldex/report";
import {createAskMessage, newAskMessageId, type AskFollowUpResolution} from "@/lib/ask-animaldex/thread";
import {AskLitPlainText} from "@/components/ask-animaldex/ask-messenger";
import {askReplyWords} from "@/lib/ask-animaldex/spoken-words";
import {AskChatOptions, AskSoundCreditsPanel, AskVoiceIcon} from "@/components/ask-animaldex/ask-chat-audio";
import {useAnimalSpeech, type AskSpeechAllowance, type AskSpeechNotice, type AskSpeechPhase} from "@/components/ask-animaldex/use-animal-speech";
import {useAnimalSounds} from "@/components/ask-animaldex/use-animal-sounds";
import AskVoiceCallButton from "@/components/ask-animaldex/voice-call/ask-voice-call-button";
import {askCallsOffered} from "@/lib/ask-animaldex/call-gate";
import type {DebateEdit, DebateHost} from "@/components/debates/debate-sheet";
import {fetchDebate, noteDebateChanged, useMyDebates} from "@/components/debates/use-debates";
import {debateSeedProblem, type Debate, type DebateNamedAnimal, type DebateRequest} from "@/lib/debates";
import {ASK_DIAGRAM_ADVANCE_PX, askCopyText, askReplyIsRealProblem, askTextColumns} from "@/lib/ask-animaldex/rich";
import {talkAskAnotherOffered, talkChatPath, type TalkCapabilityWords, type TalkWords} from "@/lib/ask-animaldex/talk";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {forgetAllTalkThreads, rememberTalkThread} from "@/components/ask-animaldex/ask-thread-meta";
import {mergeServerThread, normalizeServerChatRows, serverThreadKey} from "@/lib/ask-animaldex/chat-sync";
import {useDictation} from "@/components/ask-animaldex/use-dictation";
import {DictationButton, DictationStrip} from "@/components/ask-animaldex/dictation-views";
import {callCopy, callSpeechLanguage} from "@/lib/ask-animaldex/call-copy";
import TalkCapabilities from "@/components/ask-animaldex/talk-capabilities";

/**
 * What only some chats ever draw, fetched when first drawn rather than with
 * the page (UX pass WEB-23): the debate setup and its turns, the bond panel,
 * the naming sheet and the report composer.
 */
/** How often an open, visible signed-in thread reads the account's copy again. */
const LIVE_HISTORY_INTERVAL_MS = 4000;

const DebateSetup = dynamic(() => import("@/components/debates/debate-sheet"));
const DebateThread = dynamic(() => import("@/components/debates/debate-thread"));
const DebateQuietSection = dynamic(() => import("@/components/debates/debate-thread").then((module) => module.DebateQuietSection));
const BondPanel = dynamic(() => import("@/components/companions/bond-panel"));
const AnimalNameSheet = dynamic(() => import("@/components/companions/name-sheet"));
const StepReportComposer = dynamic(() => import("@/components/companions/step-views").then((module) => module.StepReportComposer));

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
    /** The AI disclosure (SPEC 3.1): the header's tag, the thread's notices and the locked chat. */
    aiTagLabel: string;
    /** The fixed greeting under the animal's face in an empty chat (the owner, 2026-11-06). */
    goodMorning: string;
    goodAfternoon: string;
    goodEvening: string;
    sayHey: string;
    aiNotice: string;
    aiNoticeLong: string;
    aiNoticeBreak: string;
    aiSafetyLink: string;
    consentLockedHint: string;
    consentReview: string;
    under13Title: string;
    under13Body: string;
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
    /** The ••• menu's Settings submenu. */
    settings: string;
    soundCredits: string;
    soundCreditsSpecies: string;
    soundCreditsHabitat: string;
    soundOriginal: string;
    /** The drawer's header: the same conversation on the full-screen Talk page. */
    fullScreen: string;
    /** On the animal's card at the top of the thread (SPEC section 3.3): "{name} answers from its own Power. …" */
    answersFromPower: string;
    /** The Talk page's header, on the owner's chat: their card. */
    openOnCard: string;
    /** The bond screen's words (and the bond chip's stage), in the reader's language. */
    companions: CompanionWords;
    /** The Talk page's words for what an animal can do, on the public chat in the drawer too (WEB-38). */
    talk?: TalkCapabilityWords;
    /** Chat history on every device (docs/chat-sync/SPEC.md, section 3), in the memory panel. */
    prefHistorySync: string;
    prefHistorySyncDetail: string;
    deleteHistory: string;
    deleteHistoryConfirm: string;
    deleteHistoryDone: string;
};

/**
 * The full-screen Talk page's part of the conversation (SPEC section 4):
 * the sidebar's menu button below 1024 px, and on the public chat (anyone
 * not on their own card) what this animal can do and "Ask another animal".
 */
export type AskConversationPage = {
    onMenu: () => void;
    words: TalkWords;
    /** "Ask another animal": the picker, with the question the reply answered carried over. */
    onAskAnother: (question: string) => void;
    /**
     * The owner's own chat (the owner, 2026-11-07): "Ask another animal" in
     * the ••• menu and under the open step opens the picker of their other
     * animals, with the problem the chat is on; a pick tells the server
     * (`refer_animal`) and switches to that animal. Absent, neither shows.
     */
    onAskAnotherAnimal?: ((problem: string) => void) | null;
    /**
     * Another of their animals, in place (the Companions tab's chat): an
     * animal's referral card and "Try X's way" switch the tab's chat to it
     * on the referral, instead of leaving the page. True once handled.
     */
    onOpenAnimal?: ((target: {speciesProfileId: string | null; captureId: string | null}, referralId: string | null) => boolean) | null;
    /** A question carried over from another animal's chat: put in the composer, ready to send, never sent for them. */
    initialQuestion: string | null;
    /** Where the app is ("Get the app"). */
    appHref: string;
    /** Beside the header's own buttons (the Ark panel's toggle). */
    headerAccessory?: React.ReactNode;
    /**
     * Who the page is about, from the page itself (the address and the
     * server's animal), so the conversation opens on the right thread in the
     * same paint as the navigation, before the provider's declaration lands.
     * Absent, the provider's subject is used, as in the drawer.
     */
    subject?: {subject: AskSubject; avatarUrl: string | null; companionSpeciesProfileId: string | null} | null;
    /**
     * The Companions tab's chat (the owner, 2026-11-06): the header's name is
     * the switch to another of their animals, like a model switcher, with a
     * dot while that many other animals have written.
     */
    switcher?: {
        label: string; othersUnread: number; onOpen: () => void;
        /** The person's name, for the fixed greeting under the animal's face in an empty chat (the owner, 2026-11-06). */
        personName?: string | null;
        /**
         * The composer's "+" (the owner, 2026-11-06, after the Claude app): a
         * new animal. Each item opens its source at once: a file input (the
         * phone's camera app with `capture`, or the camera roll), or a link
         * where there is no camera app (a desktop's "Take a photo" is the
         * scanner page). The picked file goes to `onFile`.
         */
        capture?: {
            label: string;
            items: Array<{key: "camera" | "library"; label: string; accept?: string; capture?: "environment"; href?: string}>;
            onFile: (key: "camera" | "library", file: File) => void;
        } | null;
    } | null;
};

type AskMemoryFact = {id?: string; fact: string; animal: string | null; noted_at: string | null; source?: string; pinned?: boolean};

/** How the animals talk with the reader: each switch the server answered, null when it could not. */
type AskMemorySettings = {
    personalisationEnabled: boolean | null;
    suggestSteps: boolean | null;
    followUpsEnabled: boolean | null;
    shareJourney: boolean | null;
    animalMessagesEnabled: boolean | null;
    /** "Keep my chats on all my devices"; null before the chat history migration. */
    historySync?: boolean | null;
};

/** What Pro adds to the chat, as the apps' introduction says it (`CreditStoreCatalog`). */
const PRO_DAILY_MESSAGES = 100;
const PRO_DAILY_VOICE_REPLIES = 30;
/** The Pro introduction shows once per browser, as the apps show it once per account. */
const PRO_INTRO_SHOWN_KEY = "animaldex:ask:pro-intro-shown";

/** How many of a thread's newest messages draw at once, and how many older ones each step after. */
const THREAD_FIRST_BATCH = 24;
const THREAD_BATCH = 24;

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
    /** This animal's chat on the Talk page (its catalog slug), for Full screen (WEB-1). */
    talkSlug?: string | null;
};

const THINKING_PHASE_MS = 2200;

/** The website's Credits page, at the packs. */
const CREDITS_HREF = "/app/credits#credits";

/** Sign in, then back to the page the reader was on (`Link` adds the locale). */
function signInHrefFor(pathname: string | null) {
    return `/account?next=${encodeURIComponent(pathname || "/")}`;
}

function AskConversation({
    labels,
    presentation = "drawer",
    page = null
}: {
    labels: AskDrawerLabels;
    presentation?: "drawer" | "page";
    /** The Talk page's own parts; null in the drawer. */
    page?: AskConversationPage | null;
}) {
    const onPage = presentation === "page" && page !== null;
    const router = useRouter();
    const {
        subject: providerSubject,
        photoUrl,
        avatarUrl: providerAvatarUrl,
        companionSpeciesProfileId: providerCompanionSpeciesProfileId,
        referralId,
        locale,
        close,
        takePendingQuestion,
        questionRequest,
        takePendingAction,
        actionRequest
    } = useAskAnimalDex();
    // The Talk page knows its subject from its own address and server data: it
    // opens on the right thread in the same paint as the navigation. The drawer
    // takes the provider's, as any page declared it.
    // Held by value: the context read, the history and every owner fetch are keyed on it, so a
    // caller that hands over an equal subject in a new object must not start them all again
    // (perf pass, 2026-11-06: the Companions chat looped that way while it was open).
    const declaredSubject = page?.subject?.subject ?? providerSubject;
    const subjectKey = JSON.stringify(declaredSubject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const subject = useMemo(() => declaredSubject, [subjectKey]);
    const avatarUrl = page?.subject ? page.subject.avatarUrl : providerAvatarUrl;
    const companionSpeciesProfileId = page?.subject ? page.subject.companionSpeciesProfileId : providerCompanionSpeciesProfileId;
    const currentPath = usePathname();
    const signInHref = signInHrefFor(currentPath);
    const [context, setContext] = useState<AskContextPayload | null>(null);
    const [composer, setComposer] = useState("");
    const composerValueRef = useRef("");
    composerValueRef.current = composer;
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
    // 3.2 Debates: the setup, from the animal's offer, the ••• menu or a call, or to approve a public draft;
    // `named`: the owner's animals the animal named in its offer, pre-selected.
    const [debateSheet, setDebateSheet] = useState<{
        problem: string;
        messageId: string | null;
        approving: Debate | null;
        fromCall: boolean;
        named: DebateNamedAnimal[];
    } | null>(null);
    // Below this width a band in the thread or the bar's report mode has no
    // room: the debate setup and "I did it" are their sheets instead.
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 340px)") : null;
        if (!query) return;
        const update = () => setNarrow(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    // A call that ended on yes to a debate (`done.debate_request`): its problem and the animals it named, for when the call is over.
    const callDebateRef = useRef<DebateRequest | null>(null);

    /**
     * Rich answers (docs/rich-chat/SPEC.md, section 1.1): how many diagram
     * characters fit across the reply column, from a hidden copy of a wide
     * bubble's diagram panel (`AskColumnsProbe`): its inner width over the
     * diagram font's fixed advance (JetBrains Mono, 0.6 em at 13 px: 7.8 px),
     * again when the column resizes. Never drawn in that font, so the font
     * loads only once a diagram panel is (WEB-16).
     */
    const [richColumns, setRichColumns] = useState<number | null>(null);
    const columnsProbeRef = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
        const probe = columnsProbeRef.current;
        if (!probe) return;
        const measure = () => {
            const width = probe.clientWidth - 28;
            if (width > 0) setRichColumns(askTextColumns(width, ASK_DIAGRAM_ADVANCE_PX));
        };
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(probe);
        return () => observer.disconnect();
    }, []);

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
    // The public chat: anyone not on their own card, on the Talk page and in
    // the drawer alike (SPEC section 4.4; WEB-38). The owner's own card is never
    // shown as public while its context is still on its way.
    const publicChat = messenger && !ownerChat && !(companionSpeciesProfileId && context === null) && !resolvedSubject.trialContext;
    const publicTalkChat = onPage && publicChat;
    const talkWords = page?.words ?? labels.talk ?? null;
    // What the animal is helping them with, and the step it set.
    const [companionLoop, setCompanionLoop] = useState<AskCompanionLoop | null>(null);
    // The loop's first read has answered (or failed): a pending "I did it" can be settled.
    const [loopLoaded, setLoopLoaded] = useState(false);
    const words = labels.companions;
    const openStep = ownerChat ? companionLoop?.openStep ?? null : null;
    /** The step as the server now holds it, here and on every other surface showing it. */
    const setOpenStep = useCallback((step: AnimalStep | null) => {
        setCompanionLoop((current) => ({...(current ?? EMPTY_COMPANION_LOOP), openStep: step, openTrial: step?.step ?? null}));
        noteOpenStep(companionSpeciesProfileId, step);
    }, [companionSpeciesProfileId]);
    // Accepted, dropped or made from a Trial on the card's Bond tab.
    useOpenStepUpdates(ownerChat ? companionSpeciesProfileId : null, useCallback((step: AnimalStep | null) => {
        setCompanionLoop((current) => (current?.openStep?.id === step?.id && current?.openStep?.acceptedAt === step?.acceptedAt
            ? current
            : {...(current ?? EMPTY_COMPANION_LOOP), openStep: step, openTrial: step?.step ?? null}));
    }, []));
    // Read again after a debate way was chosen (`refreshCompanionLoop`): the server set this
    // animal's step from the way, replacing the old one, on the debate's problem. The old
    // step's card goes quiet and the new one shows "I'll do it" (owner, 2026-11-09).
    useCompanionLoopUpdates(ownerChat ? companionSpeciesProfileId : null, useCallback((loop: AskCompanionLoop) => {
        setCompanionLoop(loop);
        setLoopLoaded(true);
    }, []));
    // "I did it": the message bar's report mode (docs/your-step/INLINE.md),
    // with the one photo or video they added; below 340 px, the sheet.
    const [reporting, setReporting] = useState<{file: File | null; previewUrl: string | null; sending: boolean; problem: string | null} | null>(null);
    const [reportSheet, setReportSheet] = useState(false);
    const reportFileRef = useRef<HTMLInputElement | null>(null);
    // The strip's preview, revoked as soon as it is replaced, removed or done with.
    const reportPreviewRef = useRef<string | null>(null);
    const setReportPreview = useCallback((url: string | null) => {
        if (reportPreviewRef.current && reportPreviewRef.current !== url) URL.revokeObjectURL(reportPreviewRef.current);
        reportPreviewRef.current = url;
    }, []);
    useEffect(() => () => setReportPreview(null), [setReportPreview]);
    /** ✕ on the strip (or Escape): the bar is the message bar again, with what they typed still in it. */
    const leaveReportMode = useCallback(() => {
        setReportPreview(null);
        setReporting(null);
    }, [setReportPreview]);
    /** The bar's attach button: one photo or video, previewed in the strip; another replaces it, ✕ removes it. */
    const attachReportFile = useCallback((file: File | null) => {
        const url = file ? URL.createObjectURL(file) : null;
        setReportPreview(url);
        setReporting((current) => (current ? {...current, file, previewUrl: url, problem: null} : current));
        if (reportFileRef.current) reportFileRef.current.value = "";
    }, [setReportPreview]);
    /**
     * The debate setup's Edit (docs/rich-chat/SPEC.md, section 2.2): the
     * message bar's edit mode, the way "I did it" is its report mode. A strip
     * says what is being edited, with ✕ to leave; the field is prefilled and
     * Send saves it (10–1500 characters for the question, 10–400 for what
     * people will see). What they had typed comes back once they are done.
     */
    const [debateEdit, setDebateEdit] = useState<DebateEdit | null>(null);
    const debateEditRef = useRef<DebateEdit | null>(null);
    debateEditRef.current = debateEdit;
    const draftBeforeEditRef = useRef("");
    const startDebateEdit = useCallback((edit: DebateEdit) => {
        setReportPreview(null);
        setReporting(null);
        // What they had typed, kept for when they are done (read now, before the field is prefilled).
        if (!debateEditRef.current) draftBeforeEditRef.current = composerValueRef.current;
        setDebateEdit(edit);
        setComposer(edit.text);
        requestAnimationFrame(() => {
            const node = composerRef.current;
            if (!node) return;
            node.focus();
            node.style.height = "auto";
            node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
            node.setSelectionRange(node.value.length, node.value.length);
        });
    }, [setReportPreview]);
    const leaveDebateEdit = useCallback(() => {
        if (!debateEditRef.current) return;
        setDebateEdit(null);
        setComposer(draftBeforeEditRef.current);
        if (composerRef.current) composerRef.current.style.height = "";
    }, []);
    // The Power-earned messages whose burst has played (once, only for a reply that arrived here).
    const [burstsPlayed, setBurstsPlayed] = useState<ReadonlySet<string>>(() => new Set());
    const [sharedEarnedId, setSharedEarnedId] = useState<string | null>(null);
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
        send: rawSend,
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
        // A reply may draw one of the animal's Trial loops or a picture (the
        // owner, 2026-11-07: "messages seem to be lacking visuals"); a call
        // never sends the blocks.
        chatBlocks: true,
        principleName: hints.principleName,
        viewer: {signedIn: context?.signedIn ?? false, hasWildProfile: context?.hasWildProfile ?? false},
        ownerChat,
        onCompanion: (update) => {
            setCompanionLoop(update.loop);
            noteOpenStep(companionSpeciesProfileId, update.loop.openStep);
            // Ark measurement (lib/ark-measure): the animal set a step, or saw one done, in this reply.
            if (update.event.stepSet) trackArk("step_offered", {species_profile_id: companionSpeciesProfileId ?? undefined});
            const outcome = arkStepOutcome(update.event.stepDone?.outcome);
            if (update.event.stepDone && outcome) trackArk("step_completed", {outcome});
            // The reply itself shows it: "Done together", or the Power earned, in its bubble.
            if (update.event.stepDone) void reloadCompanions();
            // A debate's way that did not work: the debate is open again, its
            // other ways there to try, in this thread and on its page.
            const reopened = update.event.stepDone?.reopenedDebateId;
            if (reopened) {
                void fetchDebate(reopened).then(({debate}) => {
                    if (debate) noteDebateChanged(debate);
                });
            }
        },
        // A call that ended on yes to a debate: set up once the call is over (Private, "From your call").
        onDebateRequest: (request) => {
            callDebateRef.current = request;
        },
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
                source: onPage ? "talk" : "drawer",
                layer_count: followUps
            });
            // The front-door funnel (lib/web-funnel): the visitor's first reply.
            noteFunnelReply();
        },
        // The animal's own chat draws rich answers; the site-wide assistant keeps its own format.
        richColumns: resolvedSubject.scope === "species" ? richColumns : null
    });
    // A long thread draws its newest messages first and the older ones a batch at a time right
    // after, so opening the chat or switching to an animal is never one long task on a phone
    // (perf pass, 2026-11-06). The view rests on the newest message throughout.
    const [drawnFrom, setDrawnFrom] = useState(() => Math.max(0, messages.length - THREAD_FIRST_BATCH));
    useEffect(() => {
        if (drawnFrom <= 0) return;
        const handle = window.setTimeout(() => startTransition(() => setDrawnFrom((from) => Math.max(0, from - THREAD_BATCH))), 0);
        return () => window.clearTimeout(handle);
    }, [drawnFrom]);
    // SPEC 3.1: the age check and the AI consent come before any message, on
    // every way one is sent (the composer, a chip, a report, a call); the
    // session's clock starts with the first one.
    const aiGate = useAiChatGate();
    const aiSession = useAiLongSession();
    const touchAiSession = aiSession.touch;
    // Opened from another of their animals' referral: the first message they
    // send here says so (`origin: "referral"`, talk front door SPEC 6.3), once.
    const referralOriginRef = useRef<string | null>(null);
    useEffect(() => {
        referralOriginRef.current = referralId ?? null;
    }, [referralId]);
    // The chat the Companions tab opens on is the front door (the owner,
    // 2026-11-06): the first message sent in it says so, once per visit.
    const tabRootOriginRef = useRef(Boolean(page?.switcher));
    const send = useCallback(async (...args: Parameters<typeof rawSend>): Promise<string | null> => {
        if (!(await aiGate.request())) return null;
        touchAiSession();
        const [question, options = {}] = args;
        if (options.onCallEvent) return rawSend(question, options);
        const tabRoot = tabRootOriginRef.current;
        tabRootOriginRef.current = false;
        if (options.origin) return rawSend(question, options);
        const origin = firstMessageOrigin({referral: Boolean(referralOriginRef.current), tabRoot});
        if (origin === "referral") referralOriginRef.current = null;
        return rawSend(question, origin ? {...options, origin} : options);
    }, [aiGate, rawSend, touchAiSession]);

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
        // The read a hover or touch on the way here may already have started (`ask-context-prefetch`).
        void fetchAskContext(askContextRequestBody(locale, subject))
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: AskContextPayload | null) => {
                if (!cancelled && payload) setContext(payload);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [subject, locale]);

    /**
     * Chat history on every device (docs/chat-sync/SPEC.md, section 3): a
     * signed-in reader's thread is read from their account in the background
     * and merged into this browser's (`mergeServerThread`): an empty thread
     * takes the account's, otherwise only what is missing joins, in time
     * order. Never waits for the hello, never touches a turn in flight, and
     * with nothing missing (or before the migration) nothing changes. The
     * thread follows to its end only when the reader was already there.
     */
    const historyKey = context?.signedIn && context.subject.scope === "species" && !subject.trialContext
        ? serverThreadKey({captureId: subject.captureId ?? null, speciesProfileId: context.speciesProfileId ?? null})
        : null;
    // Each tick reads the account's thread again, so a turn on their phone
    // shows here without a refresh (the owner, 2026-11-10: "it should update in
    // real-time both ways"); the ticks are set below, past `animalTalking`.
    const [historySyncTick, setHistorySyncTick] = useState(0);
    useEffect(() => {
        if (!historyKey) return;
        let cancelled = false;
        void fetch(`/api/ask/history?thread=${encodeURIComponent(historyKey)}`, {headers: {Accept: "application/json"}})
            .then((response) => (response.ok ? response.json() as Promise<{available?: boolean; messages?: unknown}> : null))
            .then((payload) => {
                if (cancelled || !payload?.available) return;
                const rows = normalizeServerChatRows(payload.messages);
                transformThread((current) => mergeServerThread(current, rows) ?? current);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [historyKey, transformThread, historySyncTick]);

    // A question the launcher was opened with is sent once, and only once the
    // subject has resolved — otherwise it would be answered from the wrong
    // grounding.
    useEffect(() => {
        if (!context) return;
        const pending = takePendingQuestion();
        if (pending) void send(pending);
        // `questionRequest`: a question asked while the drawer is already open.
    }, [context, questionRequest, takePendingQuestion, send]);
    // The Talk front door (docs/talk-front-door/SPEC.md, section 4.4): what
    // they typed before this chat opened is sent once, as their first message
    // here, with `origin: "front_door"`, once the subject has resolved. Only
    // the chat it was sent to takes it (their card's, or a wild animal's
    // public chat), and the animal skips its hello, as with any chat opened
    // with a question.
    const frontDoorChat = useMemo(() => (subject.scope === "species" && !subject.trialContext
        ? {captureId: subject.captureId?.toLowerCase() ?? null, slug: subject.slug ?? null}
        : null), [subject.scope, subject.trialContext, subject.captureId, subject.slug]);
    const frontDoorWaiting = useMemo(() => typeof window !== "undefined" && frontDoorChat !== null && frontDoorMessageWaiting(frontDoorChat), [frontDoorChat]);
    useEffect(() => {
        if (!context || !frontDoorChat) return;
        // The context read for this chat, not the one before it.
        if ((context.subject.captureId?.toLowerCase() ?? null) !== frontDoorChat.captureId) return;
        const text = takeFrontDoorMessage({...frontDoorChat, speciesProfileId: context.speciesProfileId ?? null});
        if (!text) return;
        // Past Talk's gate, it is sent and the box's draft goes; refused, the draft stays in the box.
        void aiGate.request().then((allowed) => {
            if (!allowed) return;
            clearFrontDoorDraft();
            void send(text, {origin: "front_door"});
        });
    }, [context, frontDoorChat, send, aiGate]);
    // On the Talk page, a question carried over from another animal's chat
    // ("Ask another animal"): in the composer, ready to send, once. Never
    // sent for them (UX pass WEB-3, DECISIONS section 6): sending spends a
    // message, and that is theirs to choose.
    const initialQuestion = page?.initialQuestion ?? null;
    const carriedInitialRef = useRef(false);
    useEffect(() => {
        if (!initialQuestion || carriedInitialRef.current) return;
        carriedInitialRef.current = true;
        setComposer((current) => (current.trim() ? current : initialQuestion));
        requestAnimationFrame(() => {
            const node = composerRef.current;
            if (!node) return;
            node.style.height = "auto";
            node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
            // A phone's keyboard would cover the animal's hello: there they tap in when ready.
            if (!window.matchMedia?.("(pointer: coarse)").matches) {
                node.focus();
                node.setSelectionRange(node.value.length, node.value.length);
            }
        });
    }, [initialQuestion]);

    // The animal speaks first: an empty species thread opens on its greeting.
    // Runs after the pending question above, which takes precedence. Opened
    // from another animal's referral, it speaks first about that instead,
    // history or not (once per referral; `greet` keeps count).
    const canGreet = Boolean(context?.available && context.subject.scope === "species" && (context.hints.animalName ?? context.subject.name));
    // A public species chat says hello without waiting for the context's round
    // trip: the page already names the animal and the server grounds the hello
    // itself. The owner's own chat waits, since its referral and the messages
    // the animal wrote are read with the context; so does a Trial's thread.
    const greetsBeforeContext = context === null && subject.scope === "species" && Boolean(subject.name) && !companionSpeciesProfileId && !subject.trialContext;
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
        if (!(canGreet || greetsBeforeContext) || isSending) return;
        // A message from the front door is on its way: they speak first.
        if (frontDoorWaiting) return;
        if (animalSpeciesId && !animalMessagesSettled) return;
        if (greetsForReferral) {
            void greet({referralId});
            return;
        }
        // No hello from the animal in an empty chat (the owner, 2026-11-06):
        // the app's fixed greeting stands under its face instead.
    }, [canGreet, greetsBeforeContext, greetsForReferral, referralId, messages.length, greetingState, isSending, greet, animalSpeciesId, animalMessagesSettled, frontDoorWaiting]);

    // The loop as it stands when the chat opens; replies keep it current.
    useEffect(() => {
        setCompanionLoop(null);
        setLoopLoaded(false);
        if (!ownerChat || !companionSpeciesProfileId) return;
        let cancelled = false;
        void fetch(`/api/ask/companion?speciesProfileId=${encodeURIComponent(companionSpeciesProfileId)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {loop?: unknown} | null) => {
                // The route answers the loop already read (`parseCompanionFocus`
                // on the RPC's row); reading it a second time lost the focus.
                const loop = normalizeCompanionLoop(payload?.loop);
                if (!cancelled && loop) setCompanionLoop(loop);
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setLoopLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [ownerChat, companionSpeciesProfileId]);

    /** "Not this any more": the animal lets the focus go, and the step on it. Back as it was if that fails. */
    const clearCompanionFocus = useCallback(() => {
        if (!companionSpeciesProfileId) return;
        const previous = companionLoop;
        // Letting the focus go drops the step on it too.
        setCompanionLoop({...EMPTY_COMPANION_LOOP, yourTrialsDone: previous?.yourTrialsDone ?? 0});
        noteOpenStep(companionSpeciesProfileId, null);
        void fetch("/api/ask/companion", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "clear", speciesProfileId: companionSpeciesProfileId})
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
            })
            .catch(() => {
                setCompanionLoop(previous);
                noteOpenStep(companionSpeciesProfileId, previous?.openStep ?? null);
            });
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
    // Its sounds are fetched once the reader starts typing (so they are decoded
    // before a fast reply's first word), with the first message sent, or as the
    // hello starts typing; never as the chat opens (WEB-42).
    const [soundsWanted, setSoundsWanted] = useState(false);
    const firstWordsShown = messages.some((message) => message.role === "assistant" && message.text.trim().length > 0 && message.status !== "complete");
    const startedTyping = composer.trim().length > 0;
    useEffect(() => {
        if ((isSending && greetingState !== "loading") || firstWordsShown || startedTyping) setSoundsWanted(true);
    }, [isSending, greetingState, firstWordsShown, startedTyping]);
    const sounds = useAnimalSounds({
        speciesProfileId: messenger && soundsWanted ? context?.speciesProfileId ?? null : null,
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
    // "You're offline. We'll try again when you're back." (DECISIONS section 4): and it does.
    useEffect(() => {
        const onOnline = () => {
            const last = messages[messages.length - 1];
            if (last?.role === "assistant" && last.status === "failed" && last.failureKind === "offline") retry(last.id);
        };
        window.addEventListener("online", onOnline);
        return () => window.removeEventListener("online", onOnline);
    }, [messages, retry]);
    // Typing counts as talking: Stop stays until the last word is shown.
    const animalTalking = isSending || pacer.revealing;
    // Tell anything beside the chat (the Ark panel) that it is talking, what appears, and each word heard.
    const voiceSubject = useMemo(() => ({slug: resolvedSubject.slug ?? null, speciesProfileId: context?.speciesProfileId ?? null}), [resolvedSubject.slug, context?.speciesProfileId]);
    const voiceTalking = messenger && (animalTalking || speech.isPlaying);
    useEffect(() => {
        if (!messenger) return;
        emitAnimalVoice({kind: "talking", active: voiceTalking, ...voiceSubject});
    }, [messenger, voiceTalking, voiceSubject]);
    const shownRef = useRef<{id: string | null; length: number}>({id: null, length: 0});
    useEffect(() => {
        if (!messenger) return;
        const id = pacer.messageId ?? null;
        const text = pacer.visibleText ?? "";
        const before = shownRef.current;
        const from = before.id === id && text.length >= before.length ? before.length : 0;
        shownRef.current = {id, length: text.length};
        if (id && text.length > from) emitAnimalVoice({kind: "text", chunk: text.slice(from), ...voiceSubject});
    }, [messenger, pacer.messageId, pacer.visibleText, voiceSubject]);
    useEffect(() => {
        if (messenger && speech.isPlaying && speech.cursor) emitAnimalVoice({kind: "spoken", ...voiceSubject});
    }, [messenger, speech.isPlaying, speech.cursor, voiceSubject]);
    // The open thread follows their other devices: read again every few
    // seconds while this tab is on screen, and at once when it comes back.
    // Never while the animal is answering here (the merge would leave that
    // turn alone anyway; this saves the read). The phone's turn is stored
    // once it is answered, so the question and the reply arrive together.
    const animalTalkingRef = useRef(animalTalking);
    animalTalkingRef.current = animalTalking;
    useEffect(() => {
        if (!historyKey) return;
        const tick = () => {
            if (document.visibilityState !== "visible" || animalTalkingRef.current) return;
            setHistorySyncTick((value) => value + 1);
        };
        const timer = window.setInterval(tick, LIVE_HISTORY_INTERVAL_MS);
        document.addEventListener("visibilitychange", tick);
        window.addEventListener("focus", tick);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", tick);
            window.removeEventListener("focus", tick);
        };
    }, [historyKey]);
    // With something typed the button sends, over a greeting or a reply that
    // is only still typing out; a reply still arriving is stopped first.
    const showStop = !debateEdit && ((isSending && greetingState !== "loading") || (animalTalking && composer.trim().length === 0));
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
                if (debateEdit) {
                    leaveDebateEdit();
                    return;
                }
                if (reporting && !reporting.sending) {
                    leaveReportMode();
                    return;
                }
                if (debateSheet) {
                    setDebateSheet(null);
                    return;
                }
                if (reportTarget) {
                    setReportTarget(null);
                    return;
                }
                if (confirmingClear) {
                    setConfirmingClear(false);
                    return;
                }
                // The page is the chat: Escape never leaves it.
                if (!onPage) close();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [close, confirmingClear, reportTarget, debateSheet, reporting, leaveReportMode, onPage, debateEdit, leaveDebateEdit]);

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
    const showingMemoryRef = useRef(false);
    showingMemoryRef.current = showingMemory || showingBond || showingSoundCredits;
    const [showsLatest, setShowsLatest] = useState(false);
    const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
        const scroller = scrollRef.current;
        if (!scroller) return;
        sticksToBottom.current = true;
        setShowsLatest(false);
        scroller.scrollTo({top: scroller.scrollHeight, behavior});
    }, []);
    /** Something opened in the thread (the public chat's Trials): it is shown, and the thread stops following the newest message. */
    const followHeldUntilRef = useRef(0);
    const revealInThread = useCallback((element: HTMLElement) => {
        sticksToBottom.current = false;
        // While it scrolls into view and what it opened loads, the thread does not pull back to the end.
        followHeldUntilRef.current = Date.now() + 2500;
        requestAnimationFrame(() => element.scrollIntoView({block: "start", behavior: "smooth"}));
    }, []);
    const onThreadScroll = useCallback(() => {
        const scroller = scrollRef.current;
        if (!scroller || !messenger) return;
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        sticksToBottom.current = distance < 72;
        setShowsLatest(distance > 160);
    }, [messenger]);
    // Pinned when what the thread shows changes, not on every draw: reading scrollHeight lays out
    // the whole thread, and a keystroke in the composer drew this again (perf pass, 2026-11-06).
    // What changes size without a draw here is followed by the observers below.
    useLayoutEffect(() => {
        if (!messenger || showingMemory || showingBond || showingSoundCredits || !sticksToBottom.current) return;
        const scroller = scrollRef.current;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }, [messenger, showingMemory, showingBond, showingSoundCredits, messages, pacer.visibleText, drawnFrom]);
    useEffect(() => {
        if (messenger && trailingQuestionId) scrollToLatest();
    }, [messenger, trailingQuestionId, scrollToLatest]);
    // What grows without this component drawing again (a debate's turns typing out, its report,
    // a loop or a picture loading) keeps the thread on its newest message too, while the reader
    // was there: followed on any change in the thread, and on any change of its parts' sizes.
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!messenger || !scroller) return;
        let lastHeight = scroller.scrollHeight;
        const follow = () => {
            const before = lastHeight - scroller.scrollTop - scroller.clientHeight;
            const held = Date.now() < followHeldUntilRef.current;
            if (!held && !showingMemoryRef.current && (sticksToBottom.current || before < 72) && scroller.scrollHeight !== lastHeight) {
                scroller.scrollTop = scroller.scrollHeight;
                sticksToBottom.current = true;
            }
            lastHeight = scroller.scrollHeight;
        };
        // The thread's own box: a composer growing a line shortens it, and the newest words stay in view.
        let lastClient = scroller.clientHeight;
        const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
            if (scroller.clientHeight !== lastClient) {
                lastClient = scroller.clientHeight;
                if (sticksToBottom.current && !showingMemoryRef.current) scroller.scrollTop = scroller.scrollHeight;
            }
            follow();
        });
        const observeParts = () => {
            if (!resize) return;
            resize.disconnect();
            resize.observe(scroller);
            for (const child of Array.from(scroller.children)) {
                resize.observe(child);
                for (const inner of Array.from(child.children)) resize.observe(inner);
            }
        };
        observeParts();
        // Observed again only when the two levels it watches gain or lose a part: a reply typing
        // out changes text deep inside, and re-observing every row on each step was the cost.
        const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
            if (records.some((record) => record.type === "childList" && (record.target === scroller || record.target.parentNode === scroller))) observeParts();
            follow();
        });
        mutations?.observe(scroller, {childList: true, subtree: true, characterData: true});
        return () => {
            resize?.disconnect();
            mutations?.disconnect();
        };
    }, [messenger, onPage]);

    /**
     * Dictation (DECISIONS section 9): the mic beside Send puts what they say
     * in the field as it is heard; it never sends.
     */
    const dictationCopy = useMemo(() => callCopy(locale), [locale]);
    const dictation = useDictation({
        language: callSpeechLanguage(locale),
        serverHearing: context?.signedIn === true,
        getText: () => composerValueRef.current,
        setText: (text) => {
            setComposer(text);
            requestAnimationFrame(() => {
                const node = composerRef.current;
                if (!node) return;
                node.style.height = "auto";
                node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
                node.scrollTop = node.scrollHeight;
            });
        }
    });
    const dictationStop = dictation.stop;
    const dictationActive = dictation.active;

    const gatedSubmitRef = useRef<((question: string, source: "form" | "chip" | "followup", passed?: boolean) => void) | null>(null);
    const submit = useCallback((question: string, source: "form" | "chip" | "followup", passed = false) => {
        // The reader may talk over the animal's greeting (it keeps what it
        // had said); any other reply in flight has to finish or be stopped.
        if (!question.trim() || (isSending && greetingState !== "loading")) return;
        // The gate first (SPEC 3.1): their words stay in the composer until it is passed.
        if (!passed && !aiGate.ready) {
            void aiGate.request().then((allowed) => {
                if (allowed) gatedSubmitRef.current?.(question, source, true);
            });
            return;
        }
        // Sent while dictating: the mic stops with it, nothing more is added.
        if (dictationActive) void dictationStop();
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
        noteFunnelMessage(source === "form" ? "typed" : "suggested");
        void send(question);
    }, [close, isSending, greetingState, locale, resolvedSubject.slug, send, speech, dictationActive, dictationStop, aiGate]);
    gatedSubmitRef.current = submit;

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

    /**
     * "Delete chat history" (docs/chat-sync/SPEC.md, section 3): every thread
     * on the account (`delete_animal_chat_history_v1`), then this browser's
     * too. Their memory stays; that is "Forget everything".
     */
    const [historyDeletion, setHistoryDeletion] = useState<"idle" | "confirming" | "deleting" | "done" | "failed">("idle");
    const deleteHistory = useCallback(async () => {
        setHistoryDeletion("deleting");
        try {
            const response = await fetch("/api/ask/history", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "deleteAll"})
            });
            const payload = await response.json().catch(() => null) as {ok?: boolean} | null;
            if (!response.ok || payload?.ok !== true) throw new Error(String(response.status));
            speech.stop();
            askSessionStore.clearAnimalThreads();
            forgetAllTalkThreads();
            setHistoryDeletion("done");
        } catch (error) {
            console.warn("[ask-animaldex] chat history delete failed", error instanceof Error ? error.message : "unknown");
            setHistoryDeletion("failed");
        }
    }, [speech]);

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
    // The tab opens ready to type (the owner, 2026-11-06, after the Claude app).
    const rootSwitcher = onPage && page?.switcher ? page.switcher : null;
    // The bar is one line at rest; the controls' row with the animal's pill comes while the field has focus (the owner, 2026-11-06).
    const [composerFocused, setComposerFocused] = useState(false);
    const stacked = Boolean(rootSwitcher) && composerFocused;
    useEffect(() => {
        if (!rootSwitcher) return;
        const handle = window.setTimeout(() => composerRef.current?.focus(), 450);
        return () => window.clearTimeout(handle);
    }, [rootSwitcher, historyKey]);
    const suggestions = context?.suggestions ?? askSuggestions(resolvedSubject, hints);
    // The Talk page's sidebar names and opens this thread (SPEC section 4.2).
    useEffect(() => {
        if (!messenger || !resolvedSubject.slug || !animalName || resolvedSubject.trialContext) return;
        rememberTalkThread(threadKey, {slug: resolvedSubject.slug, name: animalName, captureId: resolvedSubject.captureId ?? null, nickname});
    }, [messenger, resolvedSubject.slug, resolvedSubject.captureId, resolvedSubject.trialContext, animalName, nickname, threadKey]);

    const aboutTrial = Boolean(resolvedSubject.trialContext);
    // On a species page the animal answers as itself; everywhere else the
    // site-wide assistant does.
    const speaksAsAnimal = resolvedSubject.scope === "species" && Boolean(animalName);
    // The animal's face is its icon art, never a capture photo.
    const faceUrl = speaksAsAnimal ? avatarUrl : photoUrl;
    // The owner's own chat with no step open: what to bring it (newcomer UX vet, P0-2).
    // Concise (the owner, 2026-11-06): "Say 'hey' to Luna".
    const placeholder = messenger && animalName && !(aboutTrial && !hasConversation)
        ? labels.sayHey.replace("{name}", nickname ?? animalName)
        : hasConversation
        ? (speaksAsAnimal && animalName
            ? labels.placeholderFollowUpAnimal.replace("{animal}", animalName)
            : labels.placeholderFollowUp)
        : aboutTrial
            ? labels.trialPlaceholder
            : animalName
                ? labels.placeholderAnimal.replace("{animal}", animalName)
                : labels.placeholderGeneral;
    // A visitor's first message: what to ask it about (newcomer UX vet, P0-2), said by the
    // empty field itself, never as a line above it that comes and goes (it moved the bar).
    const visitorPlaceholder = messenger && context && !ownerChat && !aboutTrial && !hasConversation && !quota.reached
        ? labels.companions.journey.chat.visitorHint
        : null;
    // Report mode: "Tell Leo how it went", and send once there are three characters.
    const fieldPlaceholder = debateEdit
        ? debateEdit.placeholder ?? words.debateWeb.problemPlaceholder
        : reporting ? fillWords(labels.companions.journey.report.placeholder, {name: speakerName}) : visitorPlaceholder ?? placeholder;
    const sendReady = debateEdit
        ? composer.trim().length >= debateEdit.min
        : reporting ? !reporting.sending && stepReportReady(composer) : composer.trim().length > 0;
    /** Save in the bar's edit mode: the setup takes the words, and the bar is the message bar again. */
    const saveDebateEdit = () => {
        if (!debateEdit) return;
        const text = composer.replace(/\s+$/g, "").trim();
        if (text.length < debateEdit.min) return;
        debateEdit.save(text.slice(0, debateEdit.max));
        setDebateEdit(null);
        setComposer(draftBeforeEditRef.current);
        if (composerRef.current) composerRef.current.style.height = "";
    };
    const thinkingLabel = speaksAsAnimal && animalName
        ? labels.thinkingAnimal.replace("{animal}", animalName)
        : labels.thinking;

    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    // The animal is typing in an empty chat only when a hello is really on its
    // way: one being written now, or a referral's (the only hello left since
    // the owner removed the animal's greeting on 2026-11-06). Every other empty
    // chat shows the fixed greeting at once; waiting on canGreet left the
    // typing dots up forever (owner, /talk/komodo-dragon, 2026-11-10).
    const awaitingGreeting = messages.length === 0
        && greetingState !== "failed"
        && (greetingState === "loading" || (greetsForReferral && greetingState !== "done"));

    const copyMessage = (message: AskMessage) => {
        // The animal's own markdown (headings, tables, diagrams as written); the site-wide assistant's reads as prose.
        void navigator.clipboard?.writeText(messenger ? askCopyText(message.text) : askMarkdownPlainText(message.text));
        setCopiedId(message.id);
        setTimeout(() => {
            setCopiedId((current) => (current === message.id ? null : current));
        }, 1600);
    };
    const shareMessage = (message: AskMessage) => {
        const body = shareText(messages, message, animalName, speaksAsAnimal);
        if (navigator.share) {
            void navigator.share({text: body}).then(() => trackFunnel("share_take")).catch(() => undefined);
        } else {
            void navigator.clipboard?.writeText(body);
            setCopiedId(message.id);
            trackFunnel("share_take");
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
    // Under the name in the header: typing while it answers, else how it is.
    const headerStatus = ownerName && animalName
        ? labels.ownersAnimal.replace("{owner}", ownerName).replace("{animal}", animalName)
        : persona?.tagline ?? (nickname ? animalName : labels.inOwnWords);
    /**
     * "Ask another animal" under a public chat's reply to a real problem (SPEC
     * section 4.4): a reply holding a heading or a numbered list, read from
     * its structure; for a reader without an account, under the first one
     * only, "Sign up to set steps and start debates".
     */
    const firstRealProblemId = useMemo(() => {
        if (!publicTalkChat) return null;
        return messages.find((message) => message.role === "assistant" && message.status === "complete" && askReplyIsRealProblem(message.text))?.id ?? null;
    }, [publicTalkChat, messages]);
    const askedBefore = (messageId: string): string | null => {
        const index = messages.findIndex((message) => message.id === messageId);
        for (let at = index - 1; at >= 0; at -= 1) {
            if (messages[at].role === "user") return messages[at].text;
        }
        return null;
    };
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

    // MARK: Your step (3.2), everything inline (docs/your-step/INLINE.md)

    const [stepBusy, setStepBusy] = useState(false);
    /** Why the last step button did not go through, in words. */
    const [stepProblem, setStepProblem] = useState<string | null>(null);
    /**
     * When this chat opened: what was written before it is the history it
     * opened on, and the open step a reply here does not carry goes after
     * that, as a message of its own (`askThreadStep`).
     */
    const [visit, setVisit] = useState(() => ({threadKey, openedAt: Date.now()}));
    useEffect(() => {
        setVisit((current) => (current.threadKey === threadKey ? current : {threadKey, openedAt: Date.now()}));
    }, [threadKey]);
    /**
     * The step that message shows this visit: the open one while no reply
     * carries it, then as it resolves. A cleared thread starts it again.
     */
    const [shownStep, setShownStep] = useState<{threadKey: string; step: AskCompanionStepSet | null}>(() => ({threadKey, step: null}));
    useEffect(() => {
        setShownStep((current) => {
            const step = askThreadStep({shown: current.threadKey === threadKey ? current.step : null, openStep, messages});
            return current.threadKey === threadKey && current.step === step ? current : {threadKey, step};
        });
    }, [threadKey, openStep, messages]);
    const threadStep = shownStep.threadKey === threadKey ? shownStep.step : null;
    /**
     * "I did it": the message bar's report mode, its field focused, the thread
     * at its newest message. Below 340 px the bar has no room for the strip:
     * the composer sheet instead.
     */
    const startReport = useCallback(() => {
        if (!openStep) return;
        setShowingBond(false);
        setShowingMemory(false);
        setShowingSoundCredits(false);
        if (narrow) {
            setReportSheet(true);
            return;
        }
        leaveDebateEdit();
        setReporting((current) => current ?? {file: null, previewUrl: null, sending: false, problem: null});
        sticksToBottom.current = true;
        requestAnimationFrame(() => composerRef.current?.focus());
    }, [openStep, narrow, leaveDebateEdit]);
    // The step went (dropped, done, or let go elsewhere): so does its report.
    useEffect(() => {
        if (openStep) return;
        setReportSheet(false);
        setReportPreview(null);
        setReporting(null);
    }, [openStep, setReportPreview]);
    // MARK: Life Sim (docs/life-sim/CONTRACT.md): the reveal once a step is done, revisions under their messages

    const displayCurrency = useDisplayCurrency();
    const arkMoney = useMemo(() => arkMoneyFormatter(displayCurrency, locale), [displayCurrency, locale]);
    /**
     * The reader's own ledger (every animal's: a word to this one can revise
     * another's step), newest first, and their own bars (`ark_stats_v1`), so
     * a card shows all five (owner, 2026-11-10); null when they do not read.
     */
    const [ark, setArk] = useState<{threadKey: string; changes: ArkChange[]; stats: ArkStats | null; loaded: boolean}>(() => ({threadKey, changes: [], stats: null, loaded: false}));
    /** Changes that arrived while this chat was open: they play in, the rest are already there. */
    const [arkFresh, setArkFresh] = useState<ReadonlySet<string>>(() => new Set());
    const arkRef = useRef(ark);
    arkRef.current = ark;
    /** The thread as of this render, for the timers that read the Ark again once a reply is out. */
    const messagesRef = useRef(messages);
    messagesRef.current = messages;
    const reloadArk = useCallback(async () => {
        if (!ownerChat) return;
        const key = threadKey;
        const [changes, stats] = await Promise.all([fetchArkChanges({limit: 50}), fetchArkStats()]);
        if (!changes) return;
        const current = arkRef.current;
        if (current.threadKey === key && current.loaded) {
            const known = new Set(current.changes.map((change) => change.id));
            // A reveal now arrives here too, after the reply that finished its step (owner, 2026-11-09).
            const arrived = changes.filter((change) => !known.has(change.id) && (arkIsRevision(change) || arkIsReveal(change)));
            if (arrived.length > 0) {
                sticksToBottom.current = true;
                setArkFresh((fresh) => new Set([...Array.from(fresh), ...arrived.map((change) => change.id)]));
                for (const change of arrived) {
                    if (arkIsReveal(change) && arkRevealShown(change)) trackEvent(ARK_EVENTS.revealShown, arkRevealShownParams(change, companionSpeciesProfileId));
                }
            }
        }
        setArk({threadKey: key, changes, stats: stats?.isSelf ? stats : null, loaded: true});
    }, [ownerChat, threadKey, companionSpeciesProfileId]);
    // When the chat opens, then after each reply: the memory call that may
    // revise a step runs once the reply is out, so it is read again a little
    // later; a reply that finished a step is read sooner, for its reveal.
    useEffect(() => {
        if (!ownerChat) return;
        void reloadArk();
    }, [ownerChat, reloadArk]);
    const wasSending = useRef(false);
    useEffect(() => {
        const finished = wasSending.current && !isSending;
        wasSending.current = isSending;
        if (!finished || !ownerChat) return;
        const newest = messagesRef.current[messagesRef.current.length - 1];
        const finishedStep = newest?.role === "assistant" && Boolean(newest.companionEvent?.stepDone);
        const timers = [...(finishedStep ? [1_200] : []), 4_000, 12_000].map((delay) => window.setTimeout(() => void reloadArk(), delay));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [isSending, ownerChat, reloadArk]);
    // MARK: The shared Ark (Part 2, docs/ark-next.md): the step's line, and the arrival a step that worked brings

    const arkSpecies = useMemo(() => ({
        speciesProfileId: companionSpeciesProfileId ?? null,
        slug: resolvedSubject.slug ?? null,
        name: hints.animalName ?? resolvedSubject.name ?? null
    }), [companionSpeciesProfileId, resolvedSubject.slug, resolvedSubject.name, hints.animalName]);
    /** Read again after an arrival: the pair it completed changes the line. */
    const [arkOfferVersion, setArkOfferVersion] = useState(0);
    const arkOffer = useArkStepOffer({enabled: ownerChat && Boolean(openStep), species: arkSpecies, refreshKey: arkOfferVersion});
    const arkArrivals = useArkArrivals({
        enabled: ownerChat,
        species: arkSpecies,
        messages,
        onArrived: () => {
            sticksToBottom.current = true;
            setArkOfferVersion((version) => version + 1);
        }
    });
    const arkPanel = useArkPanelControl();
    /**
     * "I've done it" puts the bar in report mode: one button, no accepting
     * first (owner, 2026-11-09). The reveal comes once the step is done,
     * after the reply to their report. "Tell {name} more", once the step has
     * a report, is the plain message bar instead: the animal follows the step
     * from the talk, and in report mode a message like "just talk about life"
     * went as a step report (owner, 2026-11-10; iOS 33c7b656).
     */
    const stepPrimary = useCallback((step: AnimalStep) => {
        if (step.hasReport) {
            setShowingBond(false);
            setShowingMemory(false);
            setShowingSoundCredits(false);
            setReportSheet(false);
            leaveReportMode();
            speech.stop();
            sticksToBottom.current = true;
            requestAnimationFrame(() => composerRef.current?.focus());
            return;
        }
        startReport();
    }, [startReport, leaveReportMode, speech]);
    /** "A different step": the step is dropped, then they ask for a different one, as their own message. */
    const stepOther = useCallback((step: AnimalStep) => {
        if (isSending && greetingState !== "loading") return;
        setStepBusy(true);
        setStepProblem(null);
        void dropStep(step).then((result) => {
            setStepBusy(false);
            if (!result.ok) {
                setStepProblem(stepProblemText(result.code, words));
                return;
            }
            setOpenStep(null);
            submit(words.journey.step.otherMessage, "chip");
        });
    }, [isSending, greetingState, setOpenStep, submit, words]);
    /**
     * The report, from the bar or the sheet: uploaded and attached first,
     * then their words sent as their own message with `step_report`, its
     * bubble labelled "YOUR STEP" with a thumbnail of what they added.
     */
    const sendStepReport = useCallback(async (draft: StepReportDraft): Promise<string | null> => {
        if (!openStep || !companionSpeciesProfileId) return stepProblemText("step_not_open", words);
        if (isSending && greetingState !== "loading") return stepProblemText(null, words);
        const text = cleanStepReport(draft.text);
        const [attached, thumb] = await Promise.all([
            attachStepReport({step: openStep, speciesProfileId: companionSpeciesProfileId, account: text, file: draft.file}),
            draft.file ? stepReportThumbnail(draft.file) : Promise.resolve(null)
        ]);
        if (!attached.ok) return stepProblemText(attached.code, words);
        setOpenStep(reportingStep(openStep));
        setReportSheet(false);
        setShowingBond(false);
        speech.stop();
        speech.prime();
        sticksToBottom.current = true;
        noteFunnelMessage("typed");
        void send(text, {
            stepReportId: openStep.id,
            stepReportThumb: thumb,
            stepReportKind: draft.file ? (isStepVideoFile(draft.file) ? "video" : "photo") : null
        });
        return null;
    }, [openStep, companionSpeciesProfileId, isSending, greetingState, setOpenStep, speech, send, words]);
    /** Send in report mode: at least three characters; a problem stays in the strip, with their words. */
    const sendReportFromBar = useCallback(async () => {
        if (!reporting || reporting.sending || !stepReportReady(composer)) return;
        setReporting({...reporting, sending: true, problem: null});
        const problem = await sendStepReport({text: composer, file: reporting.file, previewUrl: reporting.previewUrl});
        if (problem) {
            setReporting((current) => (current ? {...current, sending: false, problem} : current));
            return;
        }
        setReportPreview(null);
        setReporting(null);
        setComposer("");
        if (composerRef.current) composerRef.current.style.height = "";
    }, [reporting, composer, sendStepReport, setReportPreview]);

    /**
     * One of the three chips under a check-in the animal raised. "Done" on
     * the check-in for the step the animal set puts the bar in report mode
     * instead ("I did it", 3.2): the animal hears how it went and counts it,
     * and the check-in closes with the step.
     */
    const resolveFollowUp = useCallback(async (message: AskMessage, resolution: AskFollowUpResolution): Promise<boolean> => {
        const followUp = message.followUp;
        if (!followUp) return false;
        const step = openStep?.step.trim().toLowerCase() ?? "";
        const topic = followUp.topic.trim().toLowerCase();
        if (resolution === "done" && !isSending && step && topic && step.startsWith(topic)) {
            updateMessage(message.id, {followUpResolution: "done"});
            startReport();
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
    }, [openStep, isSending, updateMessage, startReport]);

    // The Warmup: from the animal's `training` card or the Bond tab, run in the
    // thread as the animal's messages, a question at a time (iOS AnimalWarmupRun).
    const warmupTraining = useSpeciesTraining(ownerChat ? companionSpeciesProfileId : null);
    const training = warmupTraining.training;
    const setTraining = warmupTraining.setTraining;
    // Runs whose answers are being checked, and the ones that could not be.
    const [warmupChecking, setWarmupChecking] = useState<ReadonlySet<string>>(() => new Set());
    const [warmupErrors, setWarmupErrors] = useState<Record<string, string>>({});
    const warmupTimers = useRef<number[]>([]);
    useEffect(() => () => {
        for (const timer of warmupTimers.current) window.clearTimeout(timer);
    }, []);
    // The result goes to the animal a beat after it shows: as whatever `submit` is by then.
    const submitRef = useRef(submit);
    useEffect(() => {
        submitRef.current = submit;
    }, [submit]);
    /**
     * The answers go to the server; the verdict is kept on each question, the
     * result line shows on the last, and a beat later the result goes to the
     * animal as their own message, which reacts in character.
     */
    const checkWarmup = useCallback(async (runId: string, answers: number[], speciesProfileId: string) => {
        setWarmupChecking((current) => new Set(current).add(runId));
        setWarmupErrors((current) => {
            const next = {...current};
            delete next[runId];
            return next;
        });
        const outcome = await submitSpeciesTraining(speciesProfileId, answers);
        setWarmupChecking((current) => {
            const next = new Set(current);
            next.delete(runId);
            return next;
        });
        if (!outcome.ok) {
            setWarmupErrors((current) => ({...current, [runId]: stepProblemText(/not_authenticated/i.test(outcome.code) ? "not_authenticated" : null, words)}));
            return;
        }
        transformThread((current) => current.map((message) => (message.warmup?.runId === runId
            ? {...message, warmup: applyWarmupResult(outcome.result, message.warmup)}
            : message)));
        if (outcome.result.passed && training) setTraining(notingTrainingResult(training, outcome.result));
        sticksToBottom.current = true;
        warmupTimers.current.push(window.setTimeout(() => submitRef.current(warmupResultMessage(outcome.result, words), "chip"), 600));
    }, [transformThread, training, setTraining, words]);
    /** A choice tapped: kept on the question, and after a beat the next question appears; the last one sends the answers. */
    const answerWarmup = useCallback((messageId: string, choice: number) => {
        const item = messages.find((message) => message.id === messageId)?.warmup;
        if (!item || warmupChecking.has(item.runId)) return;
        const answered = answerAskWarmupItem(item, choice);
        if (answered === item) return;
        updateMessage(messageId, {warmup: answered});
        sticksToBottom.current = true;
        const asked = askWarmupItems(messages, item.runId).map((entry) => (entry.index === item.index ? answered : entry));
        const next = askWarmupNextIndex(answered, asked);
        if (next !== null) {
            // A beat, the way the next question would come in a chat.
            warmupTimers.current.push(window.setTimeout(() => {
                const question = training ? askWarmupItem(training, next, item.runId) : null;
                if (!question) return;
                transformThread((current) => (current.some((message) => message.warmup?.runId === item.runId && message.warmup.index === next)
                    ? current
                    : [...current, createAskMessage("assistant", "", {warmup: question})]));
                sticksToBottom.current = true;
            }, 350));
            return;
        }
        const answers = askWarmupAnswers(asked);
        if (answers) void checkWarmup(item.runId, answers, item.speciesProfileId);
    }, [messages, warmupChecking, updateMessage, training, transformThread, checkWarmup]);
    /** Try again, with the same answers, when they never reached the grader. */
    const retryWarmup = useCallback((runId: string) => {
        const items = askWarmupItems(messages, runId);
        const answers = askWarmupAnswers(items);
        if (answers && items[0] && !warmupChecking.has(runId)) void checkWarmup(runId, answers, items[0].speciesProfileId);
    }, [messages, warmupChecking, checkWarmup]);
    /** The newest Warmup question while its run is unfinished: another run does not start over it. */
    const openWarmupItem = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const item = messages[index].warmup;
            if (item) return typeof item.passed === "boolean" ? null : item;
        }
        return null;
    }, [messages]);
    /**
     * "Take the warmup": the offer's chips go, and the first question appears
     * as the animal's next message. A run left unfinished (the drawer closed
     * between questions, or while its answers were checked) carries on instead.
     */
    const startWarmup = useCallback((offerMessageId: string | null) => {
        if (!training || !trainingCanStart(training)) return;
        speech.stop();
        setShowingBond(false);
        setShowingMemory(false);
        sticksToBottom.current = true;
        const open = openWarmupItem;
        if (open) {
            if (typeof open.chosen !== "number") return;
            if (open.index < open.total - 1) {
                const question = askWarmupItem(training, open.index + 1, open.runId);
                if (question) transformThread((current) => [...current, createAskMessage("assistant", "", {warmup: question})]);
            } else {
                retryWarmup(open.runId);
            }
            return;
        }
        const runId = offerMessageId ?? newAskMessageId();
        const first = askWarmupItem(training, 0, runId);
        if (!first) return;
        transformThread((current) => (current.some((message) => message.warmup?.runId === runId)
            ? current
            : [...current, createAskMessage("assistant", "", {warmup: first})]));
    }, [training, speech, openWarmupItem, transformThread, retryWarmup]);
    /** What a reply's Warmup offer shows: loading, the offer, done, or nothing for an animal without one. */
    const warmupOfferState: "loading" | "offer" | "passed" | "hidden" = !warmupTraining.didLoad
        ? "loading"
        : !training?.available
            ? "hidden"
            : training.completed
                ? "passed"
                : trainingCanStart(training) ? "offer" : "hidden";

    // "{name}'s Trials", inside the animal's message: one of them can be their step.
    const captionLanguage = useTrialMotionCaptionLanguage();
    const [trials, setTrials] = useState<AnimalTrial[] | null>(null);
    const [trialBusy, setTrialBusy] = useState<StepFrequency | null>(null);
    const [trialProblem, setTrialProblem] = useState<{messageId: string; text: string} | null>(null);
    // Read once a reply in the thread offers them, so the one it pointed at opens in place.
    const trialsWanted = useMemo(() => ownerChat && messages.some((message) => message.role === "assistant"
        && message.status === "complete"
        && !message.cardsDismissed
        && askReplyCards(message.text).some((card) => card.kind === "trial")), [ownerChat, messages]);
    useEffect(() => {
        setTrials(null);
    }, [companionSpeciesProfileId]);
    useEffect(() => {
        if (!trialsWanted || trials !== null || !companionSpeciesProfileId) return;
        let cancelled = false;
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(companionSpeciesProfileId)}${captionLanguage ? `&lang=${captionLanguage}` : ""}`, {
            headers: {Accept: "application/json"}
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => {
                if (!cancelled) setTrials(payload?.trials && Array.isArray(payload.trials) ? payload.trials : []);
            })
            .catch(() => {
                if (!cancelled) setTrials([]);
            });
        return () => {
            cancelled = true;
        };
    }, [trialsWanted, trials, companionSpeciesProfileId, captionLanguage]);
    /** "Make this my step": the Trial is their step, and they tell the animal they will try it. */
    const makeTrialStep = useCallback((frequency: StepFrequency, messageId: string) => {
        if (!companionSpeciesProfileId) return;
        setTrialBusy(frequency);
        setTrialProblem(null);
        void stepFromTrial(companionSpeciesProfileId, frequency).then((result) => {
            setTrialBusy(null);
            if (!result.ok) {
                setTrialProblem({messageId, text: stepProblemText(result.code, words)});
                return;
            }
            const step = {...result.value, trialFrequency: result.value.trialFrequency ?? frequency};
            setOpenStep(step);
            // A Trial picked as the step is a step offered too, as the server counts it (`set_at`).
            trackArk("step_offered", {species_profile_id: companionSpeciesProfileId});
            // The reply now carries that step instead of its Trials, with its loop.
            const offered = messages.find((message) => message.id === messageId);
            updateMessage(messageId, {
                companionEvent: {...offered?.companionEvent, stepSet: {id: step.id, step: step.step, trialFrequency: frequency}}
            });
            setShowingBond(false);
            const message = trialPickedMessage(frequency, words);
            if (message) submit(message, "chip");
        });
    }, [companionSpeciesProfileId, setOpenStep, submit, words, updateMessage, messages]);

    // MARK: Debates (3.2)

    // The debates this chat started, and the server's switch: every debate
    // entry hides while it is off. From the first problem, Power earned or not
    // (Debates v2, iOS 059ba3df).
    const hostCaptureId = ownerChat ? resolvedSubject.captureId ?? null : null;
    const myDebates = useMyDebates({captureId: hostCaptureId, active: Boolean(hostCaptureId)});
    const powerEarned = animalBond.bond?.power.earned === true;
    const debatesOffered = Boolean(ownerChat && hostCaptureId && myDebates.enabled && !aboutTrial);
    const debateHost: DebateHost | null = hostCaptureId ? {
        captureId: hostCaptureId,
        name: speakerName,
        speciesProfileId: companionSpeciesProfileId,
        powerEarned,
        hearts: null
    } : null;
    const threadDebates = useMemo(() => (myDebates.enabled ? myDebates.debates : [])
        .filter((debate) => debate.askerIsMe && debate.hostCaptureId === hostCaptureId && debate.status !== "cancelled")
        .sort((a, b) => Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? "")), [myDebates.enabled, myDebates.debates, hostCaptureId]);
    /** Each debate sits after the message it was started from: the newest one before it. */
    const debatesAfter = useMemo(() => {
        const placed = new Map<string, Debate[]>();
        for (const debate of threadDebates) {
            const at = Date.parse(debate.createdAt ?? "");
            let anchor = Number.isFinite(at) ? "top" : messages[messages.length - 1]?.id ?? "top";
            if (Number.isFinite(at)) {
                for (const message of messages) if (Date.parse(message.createdAt) <= at) anchor = message.id;
            }
            placed.set(anchor, [...(placed.get(anchor) ?? []), debate]);
        }
        return placed;
    }, [threadDebates, messages]);
    /**
     * The setup, with the problem (owner, 2026-10-31, `debateSeedProblem`):
     * the animal's offer names it (`debate_offer.problem`, the focus when
     * there is one); started by them (the menu, the Bond tab, a call) it is
     * what the animal is helping them with, and only without a focus what
     * they said (the call's `debate_request`, then their latest message).
     * The owner's animals it named are pre-selected.
     */
    // What "Ask another animal" hands the other animal: the problem as a debate would seed it (the focus, else what they said).
    const askAnotherProblem = useCallback(
        () => debateSeedProblem({focus: companionLoop?.focus ?? animalBond.bond?.focus ?? null, said: [lastQuestion(messages)]}),
        [companionLoop?.focus, animalBond.bond?.focus, messages]
    );
    const askAnotherAnimal = page?.onAskAnotherAnimal && ownerChat ? page.onAskAnotherAnimal : null;
    const openDebateSheet = useCallback((
        messageId: string | null,
        approving: Debate | null = null,
        offered: string | null = null,
        fromCall = false,
        named: DebateNamedAnimal[] = [],
        said: string | null = null
    ) => {
        speech.stop();
        setShowingBond(false);
        setShowingMemory(false);
        // The loop's focus, else the bond's (read for the Bond tab before the loop is).
        const focus = companionLoop?.focus ?? animalBond.bond?.focus ?? null;
        const problem = debateSeedProblem({offered, focus, said: [said, lastQuestion(messages)]});
        setDebateSheet({problem, messageId, approving, fromCall, named});
        sticksToBottom.current = true;
    }, [speech, messages, companionLoop?.focus, animalBond.bond?.focus]);
    // The call is over: the setup opens prefilled from it, its animals pre-selected, Private (a public debate never starts from a call).
    useEffect(() => {
        if (onCall || !callDebateRef.current) return;
        const request = callDebateRef.current;
        callDebateRef.current = null;
        if (debatesOffered) openDebateSheet(null, null, null, true, request.with, request.problem);
    }, [onCall, debatesOffered, openDebateSheet]);
    /**
     * The setup (docs/rich-chat/SPEC.md, section 2.2): the offer's section
     * grown in place, or, opened from the ••• menu, the Bond tab or a call, a
     * special message of its own from the host where the thread ends; below
     * `narrow`, the sheet. Started from an offer, that section goes quiet in
     * place (`debateId` on its message).
     */
    const debateSetup = (layout: "section" | "sheet") => (debateSheet && debateHost ? (
        <DebateSetup
            key={`${debateSheet.messageId ?? "end"}:${debateSheet.approving?.id ?? "new"}`}
            layout={layout}
            host={debateHost}
            problem={debateSheet.problem}
            named={debateSheet.named}
            fromCall={debateSheet.fromCall}
            words={words}
            closeLabel={labels.close}
            optedIn={myDebates.optedIn}
            onOptedIn={myDebates.setOptedIn}
            approving={debateSheet.approving}
            onEdit={layout === "section" ? startDebateEdit : undefined}
            onStarted={(debate) => {
                // The debate now runs in the thread; the offer's section stays, quiet, naming who is in it.
                if (debateSheet.messageId) updateMessage(debateSheet.messageId, {debateId: debate.id, cardsDismissed: true});
                setDebateSheet(null);
                leaveDebateEdit();
                scrollToLatest("smooth");
            }}
            onClose={() => {
                setDebateSheet(null);
                leaveDebateEdit();
            }}
        />
    ) : null);
    const debateSetupMessage = !narrow && debateSheet && debateSheet.messageId === null ? (
        <div className="pt-3.5" data-testid="debate-setup-message">
            <AskSpecialBubble avatarUrl={faceUrl}>{debateSetup("section")}</AskSpecialBubble>
        </div>
    ) : null;
    // Debates started from an offer in this thread: that offer's section says so, so its block opens on its first turn.
    const anchoredDebateIds = useMemo(() => new Set(messages.map((message) => message.debateId).filter(Boolean)), [messages]);
    // The host's own way, chosen in its own chat: said here, as their message.
    const debateChat = useMemo(() => ({
        captureId: hostCaptureId,
        onOwnWay: () => submit(words.debateWeb.tryOwnWayMessage, "chip"),
        // At the tab's root, another animal's way switches the tab's chat to it in place (2026-11-07).
        onOpenAnimal: page?.onOpenAnimal ?? undefined
    }), [hostCaptureId, submit, words.debateWeb.tryOwnWayMessage, page?.onOpenAnimal]);
    const debateBlocks = (anchor: string) => (debatesAfter.get(anchor) ?? []).map((debate) => (
        <div key={debate.id} className="pt-3.5">
            <DebateThread
                seed={debate}
                words={words}
                typingLabel={labels.typing}
                run
                locale={locale}
                onApprove={(draft) => openDebateSheet(null, draft)}
                chat={debateChat}
                hostFaceUrl={faceUrl}
                opening={!anchoredDebateIds.has(debate.id)}
                onEdit={startDebateEdit}
            />
        </div>
    ));

    // Opened from the card's Bond tab with "I did it", the Warmup or a debate:
    // settled once the loop (the quiz, the debates) has been read. With no step
    // open, nothing happens; with Debates off or the Power not earned, no setup.
    const pendingActionRef = useRef<"report" | "warmup" | "debate" | null>(null);
    useEffect(() => {
        const action = takePendingAction();
        if (action) pendingActionRef.current = action.kind;
    }, [actionRequest, takePendingAction]);
    useEffect(() => {
        const pending = pendingActionRef.current;
        if (!pending || !ownerChat) return;
        if (pending === "report" && loopLoaded) {
            pendingActionRef.current = null;
            // A step already reported opens the plain bar, as "Tell {name} more" does (iOS a4e6ea7f).
            if (openStep) stepPrimary(openStep);
        } else if (pending === "warmup" && training?.speciesProfileId) {
            // Only once this animal's quiz has been read, never on a read for no animal.
            pendingActionRef.current = null;
            startWarmup(null);
        } else if (pending === "debate" && myDebates.loaded && animalBond.didLoad) {
            pendingActionRef.current = null;
            if (debatesOffered) openDebateSheet(null);
        }
    }, [actionRequest, ownerChat, loopLoaded, openStep, training, stepPrimary, startWarmup, myDebates.loaded, animalBond.didLoad, debatesOffered, openDebateSheet]);

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
        () => messages.filter((message) => message.role === "assistant" && message.status === "complete" && !message.isGreeting && !message.animalMessageId && !message.warmup).length,
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

    /**
     * What a finished reply on the owner's chat carries, inside its last
     * bubble (docs/your-step/INLINE.md): done or the Power earned, the step
     * while it is the open one, the Warmup or Trials it offered (only their
     * kind is read, never its words), and a debate offer's quick replies
     * from `done.companion.debate_offer` (a marker the server did not allow
     * shows nothing). Nothing while it is still being typed out.
     */
    const stepBusyNow = stepBusy || (isSending && greetingState !== "loading");
    // The open step is in the newest bubble that set it, when that reply is in
    // the loaded thread; otherwise it is a message of its own where the
    // conversation picks up (`threadStepAt` messages above it). Never both.
    const stepCarrierId = ownerChat ? askStepCarrierId(messages, openStep) : null;
    const threadStepAt = ownerChat && messenger ? askThreadStepIndex({
        step: threadStep,
        messages,
        openedAt: visit.openedAt,
        greetingPending: awaitingGreeting,
        revealingId: pacer.revealing ? pacer.messageId : null,
        setAt: threadStep && openStep && threadStep.id === openStep.id ? openStep.setAt : null
    }) : null;
    // Steps the animal saw done in this thread: their sections say so.
    const doneStepIds = useMemo(() => askDoneStepIds(messages), [messages]);
    /**
     * Life Sim in this thread: each reveal under the animal's reply that
     * finished its step (an older one, made when a step was taken on, under
     * the reply that set it), each revision under the animal's answer to the
     * person's message that caused it, else under that message (contract
     * section 4). A reveal whose reply is not loaded goes
     * with the open step's own message, or, just played, at the end.
     */
    const arkThread = useMemo(() => {
        if (!ownerChat || ark.threadKey !== threadKey) return null;
        const {reveals, revisions} = arkThreadChanges(ark.changes);
        const after = new Map<string, {reveals: ArkChange[]; revisions: ArkChange[]}>();
        const slot = (id: string) => {
            const found = after.get(id) ?? {reveals: [], revisions: []};
            after.set(id, found);
            return found;
        };
        const withThreadStep: ArkChange[] = [];
        const atEnd: ArkChange[] = [];
        reveals.forEach((reveal, stepId) => {
            // A tap's reveal (the removed "I'll do it" reward) is never a card here (owner, 2026-11-10).
            if (!arkRevealShown(reveal)) return;
            const at = arkRevealAnchorId(stepId, messages);
            if (at) slot(at).reveals.push(reveal);
            else if (threadStep?.id && threadStep.id.toLowerCase() === stepId) withThreadStep.push(reveal);
            else if (arkFresh.has(reveal.id)) atEnd.push(reveal);
        });
        for (const revision of revisions) {
            const at = arkRevisionAnchorId(revision, messages);
            if (at) slot(at).revisions.push(revision);
        }
        return {after, withThreadStep, atEnd};
    }, [ownerChat, ark, threadKey, messages, threadStep, arkFresh]);
    // A revision that has just arrived here is counted once, as it shows.
    const revisionsTracked = useRef(new Set<string>());
    useEffect(() => {
        if (!arkThread) return;
        arkThread.after.forEach(({revisions}) => {
            for (const revision of revisions) {
                if (!arkFresh.has(revision.id) || revisionsTracked.current.has(revision.id)) continue;
                revisionsTracked.current.add(revision.id);
                trackEvent(ARK_EVENTS.revisionShown, arkRevisionShownParams(revision));
            }
        });
    }, [arkThread, arkFresh]);
    // The rows' handlers, one stable object (see `AskRowActions`): each reads
    // this render's closure through the ref, so a memoised row never calls a
    // stale one and never renders again just because a closure was remade.
    const openReferralInPlace = (referral: AskCompanionReferral) => page?.onOpenAnimal?.({speciesProfileId: referral.speciesProfileId, captureId: referral.captureId}, referral.id) ?? false;
    const rowClosuresRef = useRef({copyMessage, shareMessage, regenerate, retry, openReport, resolveFollowUp, submit, toggleVoice: speech.toggle, askAnother: (message: AskMessage) => page?.onAskAnother(askedBefore(message.id) ?? ""), openReferral: openReferralInPlace});
    rowClosuresRef.current = {copyMessage, shareMessage, regenerate, retry, openReport, resolveFollowUp, submit, toggleVoice: speech.toggle, askAnother: (message: AskMessage) => page?.onAskAnother(askedBefore(message.id) ?? ""), openReferral: openReferralInPlace};
    const rowActions = useMemo<AskRowActions>(() => ({
        onCopy: (message) => rowClosuresRef.current.copyMessage(message),
        onShare: (message) => rowClosuresRef.current.shareMessage(message),
        onRegenerate: (message) => rowClosuresRef.current.regenerate(message.id),
        onRetry: (message) => rowClosuresRef.current.retry(message.id),
        onFollowUp: (prompt) => rowClosuresRef.current.submit(prompt, "followup"),
        onReport: (message) => rowClosuresRef.current.openReport(message),
        onResolveFollowUp: (message, resolution) => rowClosuresRef.current.resolveFollowUp(message, resolution),
        onToggleVoice: (message) => rowClosuresRef.current.toggleVoice(message.id, message.text),
        onAskAnother: (message) => rowClosuresRef.current.askAnother(message),
        onOpenReferral: (referral) => rowClosuresRef.current.openReferral(referral)
    }), []);
    // Under the first real-problem reply on the public Talk chat, once: why to sign up (one object, so the row stays memoised).
    const signUpOffer = useMemo(() => (page ? {text: page.words.signUpForMore, href: page.appHref} : null), [page]);
    const thinkingPhases = useMemo(() => askThinkingPhases(
        lastQuestion(messages),
        {...hints, hasWildProfile: context?.hasWildProfile ?? false, aboutTrial, speaksAsAnimal}
    ), [messages, hints, context?.hasWildProfile, aboutTrial, speaksAsAnimal]);
    /**
     * Share on a step done or a Power earned: this animal's page, and the
     * Power when it was earned, never their private words or their step.
     */
    const shareCard = (messageId: string, powerName: string | null) => {
        const url = resolvedSubject.slug && typeof window !== "undefined"
            ? `${window.location.origin}${getLocalePath(locale, `/animals/${resolvedSubject.slug}`)}`
            : undefined;
        const text = powerName ? `${powerName}\n${stepEarnedLine(speakerName, words)}` : `${speakerName} — AnimalDex`;
        if (navigator.share) {
            void navigator.share({title: powerName ?? speakerName, text, ...(url ? {url} : {})}).catch(() => undefined);
            return;
        }
        void navigator.clipboard?.writeText(url ? `${text}\n${url}` : text);
        setSharedEarnedId(messageId);
        setTimeout(() => setSharedEarnedId((current) => (current === messageId ? null : current)), 1600);
    };
    /**
     * "YOUR STEP", the step and its chips: the last section of the reply that
     * set it, or all of the message the thread shows for an open step no
     * reply in it carries. Done or dropped, it resolves the same either way.
     */
    const stepSection = (stepSet: AskCompanionStepSet, carriedLater: boolean, messageId: string | null = null) => {
        const resolution = askStepResolution({stepSet, openStep, loaded: loopLoaded, doneStepIds, carriedLater});
        // The other animals' ways under the open step (the owner, 2026-11-07).
        const offersDebate = debatesOffered && debateHost !== null && !debateSheet && threadDebates.length === 0;
        return (
            <AskStepSection
                onStartDebate={offersDebate ? () => openDebateSheet(messageId) : undefined}
                onAskAnother={askAnotherAnimal && page ? {label: page.words.askAnother, onClick: () => askAnotherAnimal(askAnotherProblem())} : undefined}
                key="step"
                text={stepSet.step}
                resolution={resolution}
                trialFrequency={stepSet.trialFrequency ?? null}
                speciesProfileId={companionSpeciesProfileId}
                name={speakerName}
                words={words}
                busy={stepBusyNow}
                problem={stepProblem}
                arkOffer={arkOffer && resolution.kind === "live" ? <ArkStepOfferNote offer={arkOffer} words={words.ark} locale={locale} /> : null}
                onPrimary={() => {
                    if (resolution.kind === "live") stepPrimary(resolution.step);
                }}
                onOther={() => {
                    if (resolution.kind === "live") stepOther(resolution.step);
                }}
            />
        );
    };
    const arkReveal = (reveal: ArkChange) => (
        <ArkRevealMessages
            key={`ark-${reveal.id}`}
            reveal={reveal}
            stats={ark.stats}
            // The animal's own Power heads it: "{Power} earned" when the reply that finished this step earned it.
            power={{
                name: hints.principleName?.trim() || null,
                speciesProfileId: companionSpeciesProfileId,
                earnedHere: reveal.stepId ? arkRevealDone(reveal.stepId, messages)?.powerEarned === true : false
            }}
            fresh={arkFresh.has(reveal.id)}
            reducedMotion={reducedMotion}
            faceUrl={faceUrl}
            speakerName={speakerName}
            words={words}
            money={arkMoney}
            locale={locale}
        />
    );
    /** What the Ark adds after a message in the thread: the reveal of the step it finished, the revisions it caused. */
    const arkBlocks = (message: AskMessage) => {
        const blocks = arkThread?.after.get(message.id);
        if (!blocks) return null;
        // The reveal, and a revision anchored on the reply, follow it once it is all there, never under words still being typed out.
        const typing = pacer.revealing && pacer.messageId === message.id;
        return (
            <>
                {typing ? null : blocks.reveals.map(arkReveal)}
                {typing ? null : blocks.revisions.map((revision) => (
                    <ArkRevisionCard
                        key={`ark-${revision.id}`}
                        revision={revision}
                        stats={ark.stats}
                        animate={arkFresh.has(revision.id) && !reducedMotion}
                        words={words}
                        money={arkMoney}
                        locale={locale}
                    />
                ))}
            </>
        );
    };
    /** The animal a worked step brought aboard, under the reply that finished it (after its reveal), never under words still being typed out. */
    const arkArrivalBlock = (message: AskMessage) => {
        const arrival = arkArrivals.get(message.id);
        if (!arrival || (pacer.revealing && pacer.messageId === message.id)) return null;
        return (
            <ArkArrivalLine
                key={`ark-arrival-${arrival.animal.id}`}
                species={arrival.animal.name}
                slug={arrival.animal.model_slug}
                fresh={arrival.fresh && !reducedMotion}
                words={words.ark}
                locale={locale}
                onSee={arkPanel ? () => arkPanel.show(arrival.animal) : undefined}
            />
        );
    };
    /** The open step's own message: the animal's face and the step section, no words above it (those are the model's alone). */
    const threadStepMessage = threadStep && threadStepAt !== null ? (
        <div
            key={`thread-step-${threadStep.id ?? threadStep.step}`}
            className={threadStepAt === 0 ? "" : messages[threadStepAt - 1].role === "assistant" ? "pt-1.5" : "pt-3.5"}
            data-testid="thread-step"
        >
            <AskSpecialBubble avatarUrl={faceUrl}>{stepSection(threadStep, false)}</AskSpecialBubble>
            {arkThread?.withThreadStep.map(arkReveal)}
        </div>
    ) : null;
    const specialSection = (message: AskMessage, special: AskSpecial) => {
        const shareLabel = sharedEarnedId === message.id ? labels.copied : labels.share;
        switch (special.kind) {
            case "done": {
                const powerName = hints.principleName?.trim();
                if (special.powerEarned && powerName) {
                    const report = askEarnedReport(messages, message.id);
                    return (
                        <AskEarnedSection
                            key="done"
                            powerName={powerName}
                            speciesProfileId={companionSpeciesProfileId}
                            name={speakerName}
                            xp={special.xp}
                            proofBonus={special.proofBonus}
                            words={words}
                            report={report ? {text: report.text, thumb: report.stepReportThumb ?? null, isVideo: report.stepReportKind === "video"} : null}
                            // Only for a reply that has just arrived here, once, and never under Reduce Motion.
                            burst={!reducedMotion && message.id === pacedId && !burstsPlayed.has(message.id)}
                            onBurstEnd={() => setBurstsPlayed((current) => new Set(current).add(message.id))}
                            shareLabel={shareLabel}
                            onShare={() => shareCard(message.id, powerName)}
                        />
                    );
                }
                return <AskDoneSection key="done" xp={special.xp} proofBonus={special.proofBonus} step={special.step} words={words} shareLabel={shareLabel} onShare={() => shareCard(message.id, null)} outcome={special.outcome} />;
            }
            case "step":
                // Only the newest reply that set the open step has its buttons.
                return stepSection(special.stepSet, stepCarrierId !== null && stepCarrierId !== message.id, message.id);
            case "warmup":
                return warmupOfferState === "hidden" ? null : (
                    <AskWarmupOfferSection
                        key="warmup"
                        words={words}
                        powerName={hints.principleName?.trim() || null}
                        questionCount={training?.questions.length ?? 0}
                        state={warmupOfferState}
                        disabled={stepBusyNow}
                        onTake={() => startWarmup(message.id)}
                        onSkip={() => updateMessage(message.id, {cardsDismissed: true})}
                    />
                );
            case "trials":
                return (
                    <AskTrialsSection
                        key="trials"
                        name={speakerName}
                        words={words}
                        trials={trials}
                        currentFrequency={openStep?.trialFrequency ?? null}
                        working={trialBusy}
                        problem={trialProblem?.messageId === message.id ? trialProblem.text : null}
                        disabled={stepBusyNow}
                        onPick={(frequency) => makeTrialStep(frequency, message.id)}
                    />
                );
            case "debate":
                // "Yes, start a debate" grows the offer into the setup, in this same section.
                if (!narrow && debateSheet?.messageId === message.id) {
                    return <div key="debate">{debateSetup("section")}</div>;
                }
                return (
                    <AskDebateOfferSection
                        key="debate"
                        words={words}
                        disabled={stepBusyNow}
                        onYes={() => openDebateSheet(message.id, null, special.problem, false, special.with)}
                        // "Not now" puts them away; the server will not offer again for this problem.
                        onNotNow={() => updateMessage(message.id, {cardsDismissed: true})}
                    />
                );
            case "debateStarted": {
                const started = threadDebates.find((debate) => debate.id === special.debateId) ?? null;
                return started ? <DebateQuietSection key="debate" debate={started} words={words} locale={locale} /> : null;
            }
            case "stepPreview":
                return (
                    <AskStepPreviewSection
                        key="step-preview"
                        text={special.step}
                        words={words}
                        live={message.id === latestStepPreviewId && !isSending}
                        note={talkWords ? fillWords(talkWords.capStepNote, {animal: speakerName}) : ""}
                        appLabel={talkWords?.getApp ?? labels.limitAppCta}
                        appHref={page?.appHref ?? "/#download"}
                        onApp={() => rememberStorePlacement("page_talk_step")}
                        onOther={() => submit(words.journey.step.otherMessage, "chip")}
                    />
                );
        }
    };
    // A public chat's newest step (web only): only it has its buttons.
    const latestStepPreviewId = publicChat
        ? [...messages].reverse().find((message) => message.role === "assistant" && message.companionEvent?.stepPreview)?.id ?? null
        : null;
    const replySpecial = (message: AskMessage) => {
        if (message.role !== "assistant" || message.status !== "complete") return null;
        if (pacer.messageId === message.id && pacer.revealing) return null;
        if (!ownerChat) {
            // A public chat: the step this reply set, if it set one (web only).
            if (!publicChat) return null;
            const previews = askPublicReplySpecials(message).map((special) => specialSection(message, special)).filter(Boolean);
            return previews.length > 0 ? <>{previews}</> : null;
        }
        const sections = askReplySpecials({
            message,
            warmupUnavailable: warmupOfferState === "hidden",
            warmupStarted: messages.some((entry) => entry.warmup?.runId === message.id),
            trialsUnavailable: trials !== null && trials.length === 0,
            debatesOffered
        }).map((special) => specialSection(message, special)).filter(Boolean);
        return sections.length > 0 ? <>{sections}</> : null;
    };
    /** A Warmup question in the thread: only the run's last question carries its check, its problem and Try again. */
    const warmupProps = (message: AskMessage) => {
        const item = message.warmup;
        if (!item) return null;
        const isLast = item.index >= item.total - 1;
        const next = messages[messages.findIndex((entry) => entry.id === message.id) + 1];
        return {
            followedByNext: next?.warmup?.runId === item.runId,
            checking: isLast && warmupChecking.has(item.runId),
            problem: isLast ? warmupErrors[item.runId] ?? null : null,
            onChoose: (choice: number) => answerWarmup(message.id, choice),
            onRetry: () => retryWarmup(item.runId)
        };
    };

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
                        className="mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500 disabled:opacity-50"
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
                        className="mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
                    >
                        {labels.creditsGet}
                    </Link>
                </>
            ) : null}
            {limitTier === "pro" || creditOffer ? null : limitTier === "free" ? (
                <Link
                    href={labels.limitHrefSignedIn}
                    onClick={() => trackLimitStep("drawer_limit_pro")}
                    className={`${outOfCredits ? "ml-2 " : ""}mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500`}
                >
                    {labels.limitCtaSignedIn}
                </Link>
            ) : (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                        href={signInHref}
                        onClick={() => trackLimitStep("drawer_limit_sign_in")}
                        className="inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
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

    const panelLabel = animalName ? labels.aboutAnimal.replace("{animal}", animalName) : labels.title;
    // The page's reply column is centered and capped like an LLM app's; the drawer's is the panel.
    const column = onPage ? "mx-auto w-full max-w-[760px]" : "";
    // The same conversation, full screen: its thread key goes with it (the card's, or the animal's).
    const fullScreenSlug = context?.talkSlug ?? resolvedSubject.slug;
    const fullScreenHref = !onPage && messenger && fullScreenSlug && !aboutTrial
        ? talkChatPath({slug: fullScreenSlug, captureId: resolvedSubject.captureId ?? null})
        : null;
    const publicTalk = publicTalkChat;

    // The thread itself: the bond, the memory or the sound credits in its place when open.
    // The reply's own pictures (animal-chat-blocks): the animal this chat is
    // with, for a Trial loop or its Power's icon inside a reply. Trials and
    // the icon are read by the blocks themselves, once a species.
    const threadContent = (
        <AnimalChatBlockContext.Provider value={{speciesProfileId: companionSpeciesProfileId ?? null, animalName: speakerName}}>
                    <AskColumnsProbe probeRef={columnsProbeRef} />
                    {showingBond && ownerChat ? (
                        <div className="-mx-4 -my-4">
                            <BondPanel
                                bond={animalBond.bond}
                                didLoad={animalBond.didLoad}
                                speciesProfileId={companionSpeciesProfileId}
                                slug={resolvedSubject.slug}
                                name={animalName ? companionDisplayName(nickname, animalName, labels.companions.displayName) : labels.title}
                                powerName={hints.principleName}
                                openStep={openStep}
                                onStepChange={setOpenStep}
                                onTalk={() => setShowingBond(false)}
                                onDidIt={() => {
                                    if (openStep) stepPrimary(openStep);
                                }}
                                onDropped={() => {
                                    setShowingBond(false);
                                    submit(words.journey.step.otherMessage, "chip");
                                }}
                                onTrialPicked={(frequency) => {
                                    setShowingBond(false);
                                    const message = trialPickedMessage(frequency, words);
                                    if (message) submit(message, "chip");
                                }}
                                warmup={training?.available ? {
                                    onTake: trainingCanStart(training) ? () => startWarmup(null) : null,
                                    passed: training.completed,
                                    questionCount: training.questions.length
                                } : null}
                                onDebate={debatesOffered ? () => openDebateSheet(null) : null}
                                onBondChanged={(next) => {
                                    animalBond.setBond(next);
                                    if (next) setCompanionLoop((current) => ({...(current ?? EMPTY_COMPANION_LOOP), focus: next.focus, openTrial: next.openTrial}));
                                }}
                                locale={locale}
                                closeLabel={labels.close}
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
                            historyDeletion={historyDeletion}
                            onAskDeleteHistory={() => setHistoryDeletion("confirming")}
                            onCancelDeleteHistory={() => setHistoryDeletion("idle")}
                            onDeleteHistory={() => void deleteHistory()}
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
                        <div className="flex min-h-full flex-1 flex-col">
                            <AskAnimalHero
                                // An empty chat at the tab's root greets with the app's own words for the time of day, under the
                                // animal's face, as the Claude app does (the owner, 2026-11-06); the animal's name is the line under it.
                                name={rootSwitcher && messages.length === 0 ? greetingLine(labels, rootSwitcher.personName ?? null) : speakerName}
                                // Its Power on one line under the name (DESIGN.md section 3); how it is, when it has none.
                                subtitle={rootSwitcher && messages.length === 0 ? speakerName : (hints.principleName?.trim() || heroSubtitle)}
                                // No AI badge in the input (the owner, 2026-11-06): the tag sits by the name here at the tab's root.
                                aiTag={rootSwitcher ? <AiTag label={labels.aiTagLabel} linksToSafety /> : null}
                                avatarUrl={faceUrl}
                                // Only before there is a level: once the header shows "Gray Wolf · Level 4",
                                // the card does not say it again (owner, 2026-11-06).
                                bondLabel={ownerChat && chipBond && chipBond.level == null ? bondChip(chipBond, labels) : null}
                                onBond={() => {
                                    setShowingMemory(false);
                                    setShowingBond(true);
                                    void animalBond.reload();
                                }}
                                // No positioning line (owner, 2026-11-06: "drop both"); the animals show it
                                // by disagreeing.
                                differenceLine={null}
                            />
                            {publicChat && talkWords ? (
                                <TalkCapabilities
                                    name={speakerName}
                                    animalName={animalName ?? speakerName}
                                    faceUrl={faceUrl}
                                    speciesProfileId={context?.speciesProfileId ?? null}
                                    signedIn={context?.signedIn ?? false}
                                    words={talkWords}
                                    companionWords={words}
                                    appHref={page?.appHref ?? "/#download"}
                                    onReveal={revealInThread}
                                />
                            ) : null}
                            <div aria-hidden="true" className="min-h-7 flex-1" />
                            <div className="flex flex-col">
                                {/* The AI tag beside the name is the notice (owner, 2026-11-06: "drop both"). */}
                                {debateBlocks("top")}
                                {messages.flatMap((message, index) => index < drawnFrom ? [] : [
                                    // The open step no reply here carries, where the conversation picks up.
                                    index === threadStepAt ? threadStepMessage : null,
                                    <div
                                        key={message.id}
                                        // Tight (4) between two messages from one side, 10 when the other speaks (DESIGN.md section 3).
                                        className={index === 0 && threadStepAt !== 0 ? "" : (index === threadStepAt ? "assistant" : messages[index - 1].role) === message.role ? "pt-1" : "pt-2.5"}
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
                                            actions={rowActions}
                                            companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
                                            special={replySpecial(message)}
                                            warmup={warmupProps(message)}
                                            signInHref={signInHref}
                                            reportable={context?.signedIn === true}
                                            resolvesFollowUp={Boolean(ownerChat && message.followUp && !message.followUpResolution)}
                                            // Only the reply being played sees the phase change; the others keep the idle one.
                                            voicePhase={context?.signedIn ? (speech.phase.kind !== "idle" && speech.phase.messageId === message.id ? speech.phase : IDLE_PHASE) : null}
                                            voiceAllowance={context?.signedIn ? speech.allowance : null}
                                            voiceNotice={speech.notice?.messageId === message.id ? speech.notice : null}
                                            spokenWord={speech.cursor?.messageId === message.id ? speech.cursor.word : null}
                                            askAnotherLabel={page && message.role === "assistant" && talkAskAnotherOffered({
                                                publicChat: publicTalk,
                                                quotaReached: quota.reached,
                                                finished: message.status === "complete",
                                                realProblem: askReplyIsRealProblem(message.text)
                                            }) ? page.words.askAnother : null}
                                            // Steps and debates need an animal of their own, captured in the app (W13, JRN-6).
                                            askAnotherSignUp={message.id === firstRealProblemId ? signUpOffer : null}
                                        />
                                        {arkBlocks(message)}
                                        {arkArrivalBlock(message)}
                                        {debateBlocks(message.id)}
                                    </div>
                                ])}
                                {threadStepAt === messages.length ? threadStepMessage : null}
                                {arkThread?.atEnd.map(arkReveal)}
                                {debateSetupMessage}
                                {messages.length === 0 && awaitingGreeting ? (
                                    <AskTypingBubble plain avatarUrl={faceUrl} label={labels.typing} />
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
                                {/* Past three hours of talking: again, and for a teen with a break suggested. */}
                                {aiSession.due ? (
                                    <AiNotice text={aiGate.band === "teen" ? labels.aiNoticeBreak : labels.aiNoticeLong} className="pt-4" />
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
                                    thinkingPhases={message.status === "thinking" ? [thinkingLabel] : NO_PHASES}
                                    paced={pacer.messageId === message.id && pacer.revealing ? pacer.visibleText : null}
                                    onSkip={pacer.skipToEnd}
                                    copied={copiedId === message.id}
                                    actions={rowActions}
                                    companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
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
                                    // Only the reply still finding its first word shows the phases: the rows stay memoised.
                                    thinkingPhases={message.status === "thinking" ? thinkingPhases : NO_PHASES}
                                    paced={pacer.messageId === message.id && pacer.revealing ? pacer.visibleText : null}
                                    onSkip={pacer.skipToEnd}
                                    copied={copiedId === message.id}
                                    questionRef={message.id === trailingQuestionId ? trailingQuestionRef : undefined}
                                    actions={rowActions}
                                    companionEvent={companionSpeciesProfileId ? message.companionEvent : undefined}
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
        </AnimalChatBlockContext.Provider>
    );

    const body = (
        <>
                <header className={`relative flex shrink-0 items-center gap-2 px-4 ${onPage && page?.switcher ? "py-3" : onPage ? "border-b border-white/10 py-3" : "border-b border-white/10 pb-3 pt-4 lg:pt-3"}`}>
                    {onPage && page ? (
                        // Below 1024 px the sidebar is a slide-over, opened from here.
                        <button
                            type="button"
                            onClick={page.onMenu}
                            aria-label={page.words.openChats}
                            title={page.words.openChats}
                            className={`-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors lg:hidden ${page.switcher ? "bg-white/10 text-white backdrop-blur-xl hover:bg-white/15" : "text-ink-200 hover:bg-white/8 hover:text-white active:bg-white/12"}`}
                            data-testid="talk-menu"
                        >
                            <MenuIcon />
                        </button>
                    ) : (
                        // Sheet grabber. Decorative on mobile only; the sheet is
                        // dismissed by the close button or the backdrop.
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden"
                        />
                    )}
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
                        {/* Who is talking, and one line under the name, as iOS's chat header has it:
                            typing while it answers; on the owner's chat its bond (the level and the
                            stage, which opens the bond); else what the two of you are working on;
                            else its temperament. "Not this any more" is in the ••• menu. */}
                        <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-1.5">
                                {onPage && page?.switcher ? (
                                    // Nothing in the middle at the tab's root (the owner, 2026-11-06, after the Claude app): the
                                    // name and the switch live in the composer's pill, with the AI tag.
                                    <span className="flex-1" />                                ) : (
                                    <span className="min-w-0 truncate text-[15px] font-semibold leading-5 text-white">
                                        {messenger ? speakerName : animalName ?? labels.title}
                                    </span>
                                )}
                                {/* SPEC 3.1: the AI tag, always visible in the chat's header. */}
                                <AiTag label={labels.aiTagLabel} linksToSafety />
                            </p>
                            {messenger && animalTalking ? (
                                <p className="truncate text-[11px] leading-4 text-primary-300" aria-live="polite">{labels.typing}</p>
                            ) : ownerChat && chipBond && chipBond.level !== null ? (
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
                                    className="flex max-w-full items-center gap-1 text-[11px] font-semibold leading-4 text-primary-300 transition-colors hover:text-primary-200"
                                    data-testid="header-bond"
                                >
                                    {/* The level and the stage when they fit; the level alone
                                        when they do not, never "Level 4 · Worki…". */}
                                    <AskFitText
                                        full={bondChip(chipBond, labels)}
                                        short={labels.bondLevel.replace("{level}", String(chipBond.level))}
                                    />
                                    <span aria-hidden="true" className="shrink-0 text-[9px]">›</span>
                                </button>
                            ) : ownerChat && companionLoop?.focus ? (
                                // What the two of you are working on, once the animal has found it.
                                <p className="truncate text-[11px] leading-4 text-ink-300" title={companionLoop.focus} data-testid="header-focus">
                                    {labels.workingOn.replace("{focus}", companionLoop.focus)}
                                </p>
                            ) : speaksAsAnimal && hints.principleName && !ownerName ? (
                                // Its face, its name and its Power, in the drawer as on the Talk page (WEB-38).
                                <p className="truncate text-[11px] font-semibold leading-4 text-primary-300" data-testid="talk-header-power">{hints.principleName}</p>
                            ) : speaksAsAnimal ? (
                                // Whose it is, or its temperament once it has spoken, as in the app's header.
                                <p className="truncate text-[11px] leading-4 text-ink-400">{headerStatus}</p>
                            ) : null}
                        </div>
                    </div>
                    {/* One icon at the tab's root (the owner, 2026-11-06): memory lives in the ••• menu there. */}
                    {speaksAsAnimal && context?.signedIn && !messenger && !(onPage && page?.switcher) ? (
                        <button
                            type="button"
                            onClick={showingMemory ? () => setShowingMemory(false) : openMemory}
                            aria-label={labels.memoryOpen}
                            aria-pressed={showingMemory}
                            title={labels.memoryOpen}
                            className={`grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 ${showingMemory ? "bg-white/10 text-white" : "text-ink-300"}`}
                        >
                            <MemoryIcon />
                        </button>
                    ) : null}
                    {messenger || (onPage && page?.switcher) ? null : <button
                        type="button"
                        onClick={() => setConfirmingClear(true)}
                        disabled={!hasConversation}
                        aria-label={labels.newConversation}
                        title={labels.newConversation}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 disabled:pointer-events-none disabled:opacity-35"
                    >
                        <PencilIcon />
                    </button>}
                    {onPage && page?.headerAccessory ? page.headerAccessory : null}
                    {messenger ? (
                        <span className={onPage && page?.switcher ? "[&>div>button]:h-9 [&>div>button]:w-9 [&>div>button]:bg-white/10 [&>div>button]:text-white [&>div>button]:backdrop-blur-xl" : ""}>
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
                                // The top of the menu: four things a newcomer understands at a glance
                                // (design pass, 2026-11-06, as iOS). Each shows only once it applies.
                                // "Name your Gray Wolf" while it has no name.
                                ...(nameTitle ? [{
                                    label: nameTitle,
                                    icon: <PencilIcon />,
                                    onSelect: () => setShowingNameSheet(true)
                                }] : []),
                                {
                                    label: labels.newConversation,
                                    icon: <PencilIcon />,
                                    // A chat holding only the hello can start over too, and the
                                    // fresh hello brings the animal's call again (AnimalDex 46809a93).
                                    disabled: messages.length === 0,
                                    onSelect: () => setConfirmingClear(true)
                                },
                                // 3.2 Debates: once its Power is earned, and while the server has them on.
                                ...(debatesOffered ? [{
                                    label: words.debate.start,
                                    icon: <DebateIcon />,
                                    onSelect: () => openDebateSheet(null)
                                }] : []),
                                // "Ask another animal" (the owner, 2026-11-07): another of theirs picks the problem up.
                                ...(askAnotherAnimal && page ? [{
                                    label: page.words.askAnother,
                                    icon: <ReferralIcon />,
                                    onSelect: () => askAnotherAnimal(askAnotherProblem())
                                }] : [])
                            ]}
                            settingsItems={[
                                // Under Settings: its messages, what it remembers, what you are working on.
                                // "Mute messages from Luna" / "Let Luna message you" (AnimalDex 51293f02).
                                ...(animalMuted === null ? [] : [{
                                    label: (animalMuted ? labels.unmuteAnimal : labels.muteAnimal)
                                        .replace("{name}", nickname ?? labels.theAnimal.replace("{animal}", animalName ?? "")),
                                    icon: <BellIcon />,
                                    onSelect: toggleAnimalMuted
                                }]),
                                // A plain row that opens it, as iOS's menu (the owner, 2026-11-10: a
                                // switch here read as turning memory off); its Back closes it.
                                ...(context?.signedIn ? [{
                                    label: labels.memoryOpen,
                                    icon: <MemoryIcon />,
                                    onSelect: openMemory
                                }] : []),
                                // What the two of you are working on, and letting it go.
                                ...(ownerChat && companionLoop?.focus ? [{
                                    label: labels.notThisAnyMore,
                                    detail: labels.workingOn.replace("{focus}", companionLoop.focus),
                                    icon: <CloseIcon />,
                                    onSelect: clearCompanionFocus
                                }] : [])
                            ]}
                        />
                        </span>
                    ) : null}
                    {onPage && ownerChat && resolvedSubject.captureId ? (
                        // The owner's chat on the page: back to their card.
                        <Link
                            href={`/app/capture/${encodeURIComponent(resolvedSubject.captureId)}`}
                            className="hidden h-8 shrink-0 items-center rounded-full border border-white/12 px-3 text-[12px] font-semibold text-ink-100 transition-colors hover:border-primary-300/40 hover:text-white sm:inline-flex"
                            data-testid="talk-open-card"
                        >
                            {labels.openOnCard}
                        </Link>
                    ) : null}
                    {fullScreenHref ? (
                        // The same conversation on the Talk page (SPEC section 4.2).
                        <button
                            type="button"
                            onClick={() => {
                                speech.stop();
                                sounds.stop();
                                // The Talk page files it under the catalog's slug: the same conversation goes with it.
                                if (fullScreenSlug && !resolvedSubject.captureId && fullScreenSlug !== resolvedSubject.slug) {
                                    askSessionStore.move(threadKey, askThreadKey({scope: "species", slug: fullScreenSlug}));
                                }
                                // The drawer stays up until the Talk page is on screen (the surface closes it
                                // there): the thread never leaves the screen on the way to full screen.
                                router.push(getLocalePath(locale, fullScreenHref));
                            }}
                            // Intent on the button fetches the Talk page, so the switch is ready when tapped.
                            onPointerEnter={() => router.prefetch(getLocalePath(locale, fullScreenHref))}
                            onPointerDown={() => router.prefetch(getLocalePath(locale, fullScreenHref))}
                            onFocus={() => router.prefetch(getLocalePath(locale, fullScreenHref))}
                            aria-label={labels.fullScreen}
                            title={labels.fullScreen}
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
                            data-testid="ask-full-screen"
                        >
                            <ExpandIcon />
                        </button>
                    ) : null}
                    {onPage ? null : (
                        <button
                            type="button"
                            onClick={close}
                            aria-label={labels.close}
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
                        >
                            <CloseIcon />
                        </button>
                    )}
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
                                    // A step still open shows again after the new hello; one already resolved goes with the thread.
                                    setShownStep({threadKey, step: null});
                                    setConfirmingClear(false);
                                    composerRef.current?.focus();
                                }}
                                className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
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

                <div ref={scrollRef} onScroll={onThreadScroll} className={`flex-1 overflow-y-auto overscroll-contain ${onPage ? "" : "px-4 py-4"}`}>
                    {onPage ? <div className={`${column} flex min-h-full flex-col px-4 py-4`}>{threadContent}</div> : threadContent}
                </div>

                <div className={`relative shrink-0 border-t border-white/10 ${onPage ? "pb-4 pt-3" : "px-4 pb-4 pt-3"}`}>
                    <div className={onPage ? `${column} relative px-4` : "contents"}>
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
                    {/* No chips above the bar (the owner, 2026-11-06): a step, a debate or a Trial keeps its own card in the thread. */}
                    {messenger && quota.reached && !showingMemory ? (
                        <div className="pb-1">{limitNoticeContent}</div>
                    ) : (
                        <>
                            {reporting && openStep ? (
                                // Report mode (docs/your-step/INLINE.md): what this message is, the step, and ✕ to leave it.
                                <div
                                    // The look of the special message it answers: its wash and even outline (iOS ad31aa51).
                                    className="ask-bar-strip mb-2.5 flex items-start gap-3 bg-primary-400/[0.07] py-2.5 pl-3 pr-2.5"
                                    data-testid="report-strip"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-1.5 text-[11px] font-bold leading-4 text-primary-300">
                                            <AskWalkIcon />
                                            <span className="line-clamp-2 min-w-0">{stepReportStripText(speakerName, words)}</span>
                                        </p>
                                        <p className="mt-0.5 truncate text-[13px] leading-5 text-white/80" title={openStep.step}>{openStep.step}</p>
                                        {!reporting.file ? (
                                            // The proof bonus, said where you add it: optional, never required, and it reads so
                                            // (owner, 2026-11-09): "Optional:" first, in the strip's quiet grey, not a neon call to action.
                                            <button
                                                type="button"
                                                onClick={() => reportFileRef.current?.click()}
                                                disabled={reporting.sending}
                                                className="mt-1 block max-w-full text-left text-[11px] font-medium leading-4 text-white/55 transition-colors hover:text-white/80 disabled:opacity-40"
                                                data-testid="report-proof-hint"
                                            >
                                                {words.journey.report.attachBonus}
                                            </button>
                                        ) : null}
                                        {reporting.problem ? <p role="alert" className="mt-0.5 text-[11px] leading-4 text-white/60">{reporting.problem}</p> : null}
                                    </div>
                                    {/* The photo or video they added, after the words, with ✕ to take it out (iOS AnimalStepReportStrip). */}
                                    {reporting.file && reporting.previewUrl ? (
                                        <span className="relative mr-1 mt-0.5 h-[46px] w-[46px] shrink-0">
                                            <span className="absolute inset-0 overflow-hidden rounded-panel bg-white/[0.05]">
                                                {isStepVideoFile(reporting.file) ? (
                                                    <video src={reporting.previewUrl} muted playsInline className="h-full w-full object-cover" />
                                                ) : (
                                                    <Image src={reporting.previewUrl} alt="" fill sizes="46px" unoptimized className="object-cover" />
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => attachReportFile(null)}
                                                disabled={reporting.sending}
                                                aria-label={labels.close}
                                                title={reporting.file.name}
                                                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-canvas-900 text-white transition-colors hover:bg-canvas-850"
                                            >
                                                <span className="scale-75"><CloseIcon /></span>
                                            </button>
                                        </span>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={leaveReportMode}
                                        disabled={reporting.sending}
                                        aria-label={labels.close}
                                        className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 disabled:opacity-40"
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            ) : null}
                            {!debateEdit ? (
                                <DictationStrip
                                    phase={dictation.phase}
                                    priming={dictation.priming}
                                    startedAt={dictation.startedAt}
                                    name={speakerName}
                                    copy={dictationCopy}
                                    level={dictation.level}
                                    onCancel={dictation.cancel}
                                    onDismiss={dictation.dismiss}
                                />
                            ) : null}
                            {debateEdit ? (
                                // Edit mode (docs/rich-chat/SPEC.md, section 2.2): what is being edited, and ✕ to leave it.
                                <div
                                    className="ask-bar-strip mb-2.5 flex items-center gap-3 bg-primary-400/[0.07] py-2.5 pl-3 pr-2.5"
                                    data-testid="debate-edit-strip"
                                >
                                    <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-bold leading-4 text-primary-300">
                                        <PencilIcon />
                                        <span className="min-w-0 truncate">{debateEdit.strip ?? (debateEdit.kind === "public" ? words.debate.editingPublic : words.debate.editingQuestion)}</span>
                                    </p>
                                    <span className="shrink-0 text-[11px] tabular-nums text-white/45">{composer.length} / {debateEdit.max}</span>
                                    <button
                                        type="button"
                                        onClick={leaveDebateEdit}
                                        aria-label={labels.close}
                                        className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            ) : null}
                            {aiGate.declined && !aiGate.ready && !aiGate.blocked ? (
                                <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-5 text-ink-300" data-testid="ai-consent-locked">
                                    <span>{labels.consentLockedHint}</span>
                                    <button type="button" onClick={() => void aiGate.request()} className="font-bold text-primary-200 underline underline-offset-2 hover:text-white">
                                        {labels.consentReview}
                                    </button>
                                </p>
                            ) : null}
                            {aiGate.blocked ? (
                                // SPEC 3.1: under 13, a calm block where the message bar was.
                                <div className="border border-white/10 bg-white/[0.035] px-4 py-3 text-left" data-testid="ai-under-13">
                                    <p className="text-[15px] font-semibold leading-6 text-white">{labels.under13Title}</p>
                                    <p className="mt-0.5 text-[13px] leading-5 text-ink-300">{labels.under13Body}</p>
                                </div>
                            ) : <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (debateEdit) saveDebateEdit();
                                    else if (reporting) void sendReportFromBar();
                                    else submit(composer, "form");
                                }}
                                // The message bar is a control, a capsule like the apps' composer: never a square box.
                                className={`flex items-end gap-2 border border-white/12 bg-white/[0.06] backdrop-blur-xl py-1.5 ${stacked ? "flex-wrap rounded-panel px-2.5" : rootSwitcher ? "rounded-pill pl-2.5 pr-1.5" : `rounded-pill ${reporting ? "pl-1.5" : "pl-4"} pr-1.5`} focus-within:border-primary-300/45`}
                            >
                                {reporting ? (
                                    <>
                                        <input
                                            ref={reportFileRef}
                                            type="file"
                                            accept={STEP_MEDIA_ACCEPT}
                                            tabIndex={-1}
                                            aria-hidden="true"
                                            className="sr-only"
                                            onChange={(event) => attachReportFile(event.target.files?.[0] ?? null)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => reportFileRef.current?.click()}
                                            disabled={reporting.sending}
                                            aria-label={words.journey.report.attachBonus}
                                            title={words.journey.report.attachBonus}
                                            className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary-300 transition-colors hover:bg-white/8 hover:text-primary-200 disabled:opacity-40"
                                            data-testid="report-attach"
                                        >
                                            <AttachIcon />
                                        </button>
                                    </>
                                ) : null}
                                {rootSwitcher?.capture ? (
                                    // A new animal from the composer (the owner, 2026-11-06, after the Claude app's "+").
                                    <ComposerPlusMenu capture={rootSwitcher.capture} />
                                ) : null}
                                {stacked && rootSwitcher ? (
                                    // The animal as the pill, like a model switcher (the owner), while they type. No AI badge in the input (the owner): the tag sits on the animal's card.
                                    <button
                                        type="button"
                                        onClick={rootSwitcher.onOpen}
                                        aria-label={`${messenger ? speakerName : animalName ?? labels.title}, ${rootSwitcher.label}`}
                                        data-testid="companion-switcher"
                                        className="mb-0.5 mr-auto flex h-9 max-w-[12rem] shrink-0 items-center gap-1 rounded-pill bg-white/[0.08] pl-3 pr-1.5 text-left transition-colors hover:bg-white/15"
                                    >
                                        <span className="min-w-0 truncate text-[13px] font-semibold leading-5 text-white">{messenger ? speakerName : animalName ?? labels.title}</span>
                                        <span className="relative shrink-0 text-ink-300" aria-hidden="true">
                                            <SwitchChevronIcon />
                                            {rootSwitcher.othersUnread > 0 ? <span className="absolute -right-1 -top-0.5 h-[7px] w-[7px] rounded-full bg-primary-400" /> : null}
                                        </span>
                                    </button>
                                ) : null}
                                <label className="sr-only" htmlFor="ask-animaldex-composer">{fieldPlaceholder}</label>
                                <textarea
                                    id="ask-animaldex-composer"
                                    ref={composerRef}
                                    value={composer}
                                    rows={1}
                                    maxLength={debateEdit ? debateEdit.max : reporting ? MAX_STEP_REPORT_CHARACTERS : 900}
                                    placeholder={fieldPlaceholder}
                                    readOnly={reporting?.sending === true}
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
                                            if (debateEdit) saveDebateEdit();
                                            else if (reporting) void sendReportFromBar();
                                            else submit(composer, "form");
                                        }
                                    }}
                                    className={`max-h-[8.25rem] min-h-[2.25rem] w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400 ${stacked ? "order-first basis-full px-1.5" : rootSwitcher ? "px-1.5" : ""}`}
                                    onFocus={() => setComposerFocused(true)}
                                    onBlur={() => setComposerFocused(false)}
                                />
                                {messenger && animalName && askCallsOffered(context?.signedIn === true) && !debateEdit && !reporting && !showStop ? (
                                    // The call beside the mic, as ChatGPT's voice mode sits (the owner, 2026-11-06): with its talking 3D model (voice-call/).
                                    <AskVoiceCallButton
                                        threadKey={threadKey}
                                        animalName={animalName}
                                        captureId={resolvedSubject.captureId ?? null}
                                        speciesProfileId={context?.speciesProfileId ?? null}
                                        serverHearing={context?.signedIn === true}
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
                                {messenger && dictation.available && !debateEdit && !showStop ? (
                                    <DictationButton
                                        active={dictation.phase === "starting" || dictation.phase === "listening"}
                                        busy={dictation.phase === "transcribing"}
                                        copy={dictationCopy}
                                        onStart={() => void dictation.start()}
                                        onStop={() => void dictation.stop()}
                                    />
                                ) : null}
                                {debateEdit ? (
                                    <button
                                        type="submit"
                                        disabled={!sendReady}
                                        className={`mb-0.5 inline-flex h-9 shrink-0 items-center rounded-full px-4 text-xs font-black transition-colors ${sendReady ? "bg-primary-400 text-canvas-950 hover:bg-primary-300 active:bg-primary-500" : "bg-white/8 text-ink-400"}`}
                                        data-testid="debate-edit-save"
                                    >
                                        {debateEdit.sendLabel ?? words.debate.save}
                                    </button>
                                ) : (
                                    <button
                                        type={showStop ? "button" : "submit"}
                                        onClick={showStop ? stopTalking : undefined}
                                        disabled={!showStop && !sendReady}
                                        aria-label={showStop ? labels.stop : reporting ? fillWords(words.journey.report.send, {name: speakerName}) : labels.send}
                                        className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                                            showStop || sendReady
                                                ? "bg-primary-400 text-canvas-950 hover:bg-primary-300 active:bg-primary-500"
                                                : "bg-white/8 text-ink-400"
                                        }`}
                                    >
                                        {showStop ? <StopIcon /> : reporting?.sending ? <span aria-hidden="true" className="text-sm font-black">…</span> : <ArrowUpIcon />}
                                    </button>
                                )}
                            </form>}
                        </>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-ink-400">
                        {/* The count is there when it matters: the last few of a free budget, or what
                            each message costs while paying with Credits. Not after every reply (a counter
                            is noise, and its arrival moved the message bar on phones); a Pro budget is
                            large enough that a meter reads as stingy (as in the apps). */}
                        {remainingCopy && (quota.paying || (!quota.isPro && quota.remaining !== null && quota.remaining <= ASK_REMAINING_SHOWN_FROM)) ? <span>{remainingCopy}</span> : null}
                        <span className="min-w-0">{labels.disclaimer}</span>
                    </p>
                    </div>
                </div>
                {reportSheet && openStep ? (
                    // "I did it" below 340 px, where the bar has no room for its strip.
                    <StepReportComposer
                        name={speakerName}
                        words={words}
                        sendingLabel={labels.sending}
                        closeLabel={labels.close}
                        onCancel={() => setReportSheet(false)}
                        onSubmit={sendStepReport}
                    />
                ) : null}
                {narrow ? debateSetup("sheet") : null}
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
        </>
    );

    return onPage ? (
        <div ref={panelRef} aria-label={panelLabel} className="ask-page relative flex h-full min-h-0 w-full min-w-0 flex-col bg-canvas-950" data-testid="ask-page">
            {body}
        </div>
    ) : (
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
                aria-label={panelLabel}
                // Fully opaque, and no `backdrop-blur`: a translucent panel over this site
                // lets the page's lime radial glows ghost straight through the
                // conversation, even at 98% background opacity. It also matches the
                // field-guide look, which has no glassmorphism anywhere else.
                className="ask-panel fixed inset-x-0 bottom-0 z-[61] flex h-[85vh] flex-col border-t border-white/12 bg-canvas-950 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
            >
                {body}
            </div>
        </>
    );
}

/**
 * Drawn again only when its own props change: the Companions chat hands over
 * the same labels and page while the roster, the menu or the shell around it
 * change (perf pass, 2026-11-06).
 */
export default memo(AskConversation);

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
/**
 * What a thread row can do, as one object whose identity never changes: the
 * rows are memoised (`AnimalMessageRow`, `MessageBlock`), so while a reply
 * types out only its own row renders again, not the forty above it. Each
 * handler reads the conversation's latest closure through a ref at call time.
 */
type AskRowActions = {
    onCopy: (message: AskMessage) => void;
    onShare: (message: AskMessage) => void;
    onRegenerate: (message: AskMessage) => void;
    onRetry: (message: AskMessage) => void;
    onFollowUp: (prompt: string) => void;
    onReport: (message: AskMessage) => void;
    onResolveFollowUp: (message: AskMessage, resolution: AskFollowUpResolution) => Promise<boolean>;
    onToggleVoice: (message: AskMessage) => void;
    onAskAnother: (message: AskMessage) => void;
    /** An animal's referral card at the tab's root: the tab's chat switches to that animal in place; true once it did. */
    onOpenReferral?: (referral: AskCompanionReferral) => boolean;
};

const IDLE_PHASE: AskSpeechPhase = {kind: "idle"};
const NO_PHASES: string[] = [];
/** "N of M messages left today" shows under the message bar from this many left, not before (DESIGN.md section 3). */
const ASK_REMAINING_SHOWN_FROM = 5;

const AnimalMessageRow = memo(function AnimalMessageRow({
    voicePhase = null,
    voiceAllowance = null,
    voiceNotice = null,
    spokenWord = null,
    askAnotherLabel = null,
    askAnotherSignUp = null,
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
    actions,
    companionEvent,
    special = null,
    warmup = null,
    signInHref,
    reportable = false,
    resolvesFollowUp = false
}: {
    message: AskMessage;
    labels: AskDrawerLabels;
    isLast: boolean;
    isSending: boolean;
    /** Waiting for the animal, or watching it type. */
    animalTalking: boolean;
    /** What the reply carries to do, inside its last bubble (docs/your-step/INLINE.md). */
    special?: React.ReactNode;
    /** A Warmup question's part in the run (its check, its problem), and its taps. */
    warmup?: {followedByNext: boolean; checking: boolean; problem: string | null; onChoose: (choice: number) => void; onRetry: () => void} | null;
    /** Report this reply; signed-in readers only. */
    reportable?: boolean;
    /** The check-in this reply raised, while it is unanswered. */
    resolvesFollowUp?: boolean;
    faceUrl: string | null;
    speakerName: string;
    photoUrl: string | null;
    photoAlt: string;
    /** While this reply is being typed out, what of it is on screen; null once it is all shown. */
    paced: string | null;
    onSkip: () => void;
    copied: boolean;
    actions: AskRowActions;
    companionEvent?: AskCompanionEvent;
    signInHref: string;
    /**
     * The animal's voice, for a signed-in reader: null when it has none here;
     * else this reply's phase (idle unless it is the one playing), the
     * allowance, and why it could not play, when that was this reply.
     */
    voicePhase?: AskSpeechPhase | null;
    voiceAllowance?: AskSpeechAllowance | null;
    voiceNotice?: AskSpeechNotice | null;
    /** The word its voice is saying, among the reply's words on screen; null when it is not speaking. */
    spokenWord?: number | null;
    /** The public Talk chat, under a reply to a real problem: a second side, and once, why to sign up (SPEC section 4.4). */
    askAnotherLabel?: string | null;
    askAnotherSignUp?: {text: string; href: string} | null;
}) {
    const onCopy = () => actions.onCopy(message);
    const onShare = () => actions.onShare(message);
    const onRegenerate = () => actions.onRegenerate(message);
    const onRetry = () => actions.onRetry(message);
    const onReport = reportable ? () => actions.onReport(message) : undefined;
    const onResolveFollowUp = resolvesFollowUp ? (resolution: AskFollowUpResolution) => actions.onResolveFollowUp(message, resolution) : undefined;
    const voice = voicePhase ? {phase: voicePhase, allowance: voiceAllowance, notice: voiceNotice, onToggle: () => actions.onToggleVoice(message)} : null;
    const askAnother = askAnotherLabel ? {label: askAnotherLabel, onAsk: () => actions.onAskAnother(message), signUp: askAnotherSignUp} : null;
    if (message.role === "user") {
        return (
            <AskUserBubble
                text={message.text}
                label={labels.youAsked}
                // Their report on a step: "YOUR STEP", with the thumbnail of what they added.
                report={message.stepReportId ? {
                    label: labels.companions.journey.step.pinnedLabel,
                    thumbUrl: message.stepReportThumb ?? null,
                    kind: message.stepReportKind ?? null
                } : null}
            />
        );
    }

    // A Warmup question: the animal's special message, its choices as chips (docs/your-step/INLINE.md).
    if (message.warmup) {
        return (
            <AskWarmupQuestion
                item={message.warmup}
                avatarUrl={faceUrl}
                showsFace={!warmup?.followedByNext}
                name={speakerName}
                words={labels.companions}
                checking={warmup?.checking ?? false}
                problem={warmup?.problem ?? null}
                tryAgainLabel={labels.tryAgain}
                onChoose={warmup?.onChoose ?? (() => undefined)}
                onRetry={warmup?.onRetry ?? (() => undefined)}
            />
        );
    }

    // Nothing on screen yet: the animal is still finding its first word.
    if (message.status === "thinking" || (paced !== null && paced.length === 0)) {
        return <AskTypingBubble plain avatarUrl={faceUrl} label={labels.typing} />;
    }

    if (message.status === "failed") {
        const limit = message.limitNotice ? limitFailure(message.limitNotice, labels, signInHref) : null;
        return (
            <div className="flex items-end gap-2 pr-11">
                <AskAnimalFace url={faceUrl} size={28} className="opacity-55" />
                <div
                    className="min-w-0 rounded-bubble border px-3.5 py-2.5"
                    style={{borderColor: ASK_BUBBLE_INCOMING}}
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
    // A step done is the reply's special message; another of their animals it sent them to stays under it.
    const event = !isLive && companionEvent?.referral
        ? <CompanionEventBlock event={{referral: companionEvent.referral}} name={speakerName} labels={labels} onOpen={actions.onOpenReferral} />
        : null;
    return (
        <div className="group/reply">
            {/* Screen readers get the reply as it arrives, not a word at a time. */}
            {typing ? <p className="sr-only">{askMarkdownPlainText(message.text)}</p> : null}
            <div aria-hidden={typing ? true : undefined}>
                <AskReplyBubbles
                    plain
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
                    special={special}
                    after={!isLive && (checkIn || event || voice?.notice || askAnother) ? (
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
                            {askAnother ? (
                                <div className="flex flex-col items-start gap-1.5" data-testid="ask-another">
                                    <button
                                        type="button"
                                        onClick={askAnother.onAsk}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:border-primary-300/40 active:bg-white/10"
                                    >
                                        <ReferralIcon />
                                        {askAnother.label}
                                    </button>
                                    {askAnother.signUp ? (
                                        <Link href={askAnother.signUp.href} className="text-[11px] font-semibold leading-4 text-ink-300 underline-offset-2 transition-colors hover:text-primary-200 hover:underline">
                                            {askAnother.signUp.text}
                                        </Link>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                />
            </div>
        </div>
    );
});

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
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
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
                    className="inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
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

const MessageBlock = memo(function MessageBlock({
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
    actions,
    companionEvent,
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
    actions: AskRowActions;
    /** What the animal did in this reply in the companion loop; the owner's own chat only. */
    companionEvent?: AskCompanionEvent;
    /** Where "Sign in" goes from a reply refused at the signed-out limit. */
    signInHref: string;
}) {
    const onCopy = () => actions.onCopy(message);
    const onShare = () => actions.onShare(message);
    const onRegenerate = () => actions.onRegenerate(message);
    const onRetry = () => actions.onRetry(message);
    const onFollowUp = actions.onFollowUp;
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

            {finished && companionEvent && (companionEvent.stepDone || companionEvent.referral) ? (
                <CompanionEventBlock event={companionEvent} name={labels.title} labels={labels} />
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
});

/**
 * Under the reply where the animal saw a step of theirs done ("Done together
 * · +5 XP", and when it earned the Power, that it is theirs), or sent them to
 * another of their animals: the moment, marked in the thread. The animal has
 * already said well done in its own words; this is the game's part.
 */
function CompanionEventBlock({event, name, labels, onOpen}: {event: AskCompanionEvent; name: string; labels: AskDrawerLabels; onOpen?: (referral: AskCompanionReferral) => boolean}) {
    const done = event.stepDone;
    const referral = event.referral;
    // That animal's chat on the card you last talked through, else the one the server named.
    const referralCaptureId = useChatCaptureId(referral?.speciesProfileId ?? null, referral?.captureId ?? null);
    const referralHref = referral ? referralCapturePath({...referral, captureId: referralCaptureId}) : null;
    return (
        <div className="flex flex-col items-start gap-2.5">
            {done ? (
                <div className="flex flex-col gap-1">
                    <StepDoneChip
                        xp={done.xp}
                        words={labels.companions}
                        earnedLine={done.powerEarned ? fillWords(labels.companions.journey.earned.subtitle, {name}) : null}
                    />
                    <p className="text-[11px] leading-4 text-ink-300">{done.step}</p>
                </div>
            ) : null}
            {referral && referralHref ? (
                <Link
                    href={referralHref}
                    title={labels.talkToHint}
                    // At the Companions tab's root the chat switches in place (2026-11-07); elsewhere the link opens that card's chat.
                    onClick={onOpen ? (click: React.MouseEvent<HTMLAnchorElement>) => { if (onOpen({...referral, captureId: referralCaptureId})) click.preventDefault(); } : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:border-primary-300/40 active:bg-white/10"
                >
                    <ReferralIcon />
                    {labels.talkTo.replace("{name}", companionDisplayName(referral.nickname, referral.animal, labels.companions.displayName))}
                </Link>
            ) : null}
        </div>
    );
}

/**
 * One line that fits: `full` while it fits its room, else `short` (iOS
 * `ViewThatFits`), so a narrow header never cuts the words mid-way.
 */
function AskFitText({full, short}: {full: string; short: string}) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [fits, setFits] = useState(true);
    useLayoutEffect(() => {
        const node = ref.current;
        const host = node?.parentElement;
        const room = host?.parentElement;
        if (!node || !host || !room) return;
        const measure = () => {
            // Measured whole, in its own type, off the line, against the room the header gives it.
            const probe = node.cloneNode(true) as HTMLSpanElement;
            probe.textContent = full;
            probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
            host.appendChild(probe);
            const needed = probe.getBoundingClientRect().width;
            probe.remove();
            setFits(needed + 16 <= room.getBoundingClientRect().width);
        };
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(room);
        return () => observer.disconnect();
    }, [full]);
    return <span ref={ref} className="min-w-0 truncate">{fits ? full : short}</span>;
}

/**
 * A hidden copy of a wide bubble's diagram panel: its inner width over the
 * diagram font's advance is `text_columns` (SPEC section 1.1). Laid out as
 * `AskReplyBubbles` lays a wide bubble out: the face's room, the bubble's
 * padding, the panel's. It holds no text, so the diagram font is fetched
 * only once a real panel is drawn (WEB-16).
 */
function AskColumnsProbe({probeRef}: {probeRef: React.RefObject<HTMLDivElement>}) {
    return (
        <div aria-hidden="true" className="pointer-events-none invisible h-0 overflow-hidden">
            <div className="flex gap-2 pr-2">
                <span className="w-7 shrink-0" />
                <div className="min-w-0 flex-1 px-3.5">
                    <div ref={probeRef} style={{paddingLeft: 14, paddingRight: 14}} />
                </div>
            </div>
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-white/10 active:bg-white/15 hover:text-white disabled:opacity-40"
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
    onSetPreference,
    historyDeletion,
    onAskDeleteHistory,
    onCancelDeleteHistory,
    onDeleteHistory
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
    historyDeletion: "idle" | "confirming" | "deleting" | "done" | "failed";
    onAskDeleteHistory: () => void;
    onCancelDeleteHistory: () => void;
    onDeleteHistory: () => void;
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const syncKnown = settings?.historySync !== null && settings?.historySync !== undefined;
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
                                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 disabled:opacity-40"
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
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 disabled:opacity-40"
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
                                    className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
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
                    {syncKnown && settings ? (
                        // Chat history on every device (docs/chat-sync/SPEC.md, section 3).
                        <PreferenceRow
                            title={labels.prefHistorySync}
                            detail={labels.prefHistorySyncDetail}
                            value={settings.historySync === true}
                            disabled={savingPreference}
                            onChange={(value) => onSetPreference({historySync: value})}
                        />
                    ) : null}
                    {preferenceFailed ? <p className="px-4 pb-3 text-[11px] text-ink-400">{labels.prefFailed}</p> : null}
                </div>
            ) : null}

            {syncKnown ? (
                historyDeletion === "confirming" || historyDeletion === "deleting" ? (
                    <div className="-mx-4 border-y border-white/10 bg-white/[0.03] px-4 py-3" data-testid="delete-history-confirm">
                        <p className="text-sm font-semibold text-ink-100">{labels.deleteHistoryConfirm}</p>
                        <div className="mt-2.5 flex gap-2">
                            <button
                                type="button"
                                onClick={onDeleteHistory}
                                disabled={historyDeletion === "deleting"}
                                className="inline-flex min-h-9 items-center rounded-full bg-red-500 px-4 text-xs font-bold text-white transition-colors hover:bg-red-400 disabled:opacity-60"
                            >
                                {historyDeletion === "deleting" ? labels.sending : labels.deleteHistory}
                            </button>
                            <button
                                type="button"
                                onClick={onCancelDeleteHistory}
                                disabled={historyDeletion === "deleting"}
                                className="inline-flex min-h-9 items-center rounded-full border border-white/12 px-4 text-xs font-semibold text-ink-200 transition-colors hover:text-white"
                            >
                                {labels.clearCancel}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-start gap-1.5">
                        <button
                            type="button"
                            onClick={onAskDeleteHistory}
                            className="inline-flex min-h-9 items-center text-xs font-semibold text-red-300 transition-colors hover:text-red-200"
                            data-testid="delete-history"
                        >
                            {labels.deleteHistory}
                        </button>
                        {historyDeletion === "done" ? <p className="text-[11px] text-ink-300" role="status">{labels.deleteHistoryDone}</p> : null}
                        {historyDeletion === "failed" ? <p className="text-[11px] text-ink-300" role="alert">{labels.errorGeneric}</p> : null}
                    </div>
                )
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
const ReferralIcon = () => icon(<path d="M5 15V9.5A3.5 3.5 0 0 1 8.5 6H15m0 0-3-3m3 3-3 3" />);
const RefreshIcon = () => icon(<path d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 4v3h-3" />);
const BellIcon = () => icon(<path d="M6 13.5V9a4 4 0 0 1 8 0v4.5l1.3 1.5H4.7ZM8.5 16.5a1.6 1.6 0 0 0 3 0" />);
const FlagIcon = () => icon(<path d="M5 17V3.8m0 0h8.5l-1.6 3.1 1.6 3.1H5" />);
const CalendarIcon = () => icon(<path d="M4.5 6h11v9.5h-11Zm0 3h11M8 4v3m4-3v3" />);
const DebateIcon = () => icon(<path d="M3.5 5.5h8v5.5h-4.5L4.5 13v-2h-1Zm4.5 7.5v1.5h4.5l2.5 2v-2h1.5V8.5h-3.5" />);
/** The bar's attach button in report mode: a photo with a plus (iOS photo.badge.plus). */
const AttachIcon = () => (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 4.5H6.2A2.2 2.2 0 0 0 4 6.7v11.1A2.2 2.2 0 0 0 6.2 20h11.1a2.2 2.2 0 0 0 2.2-2.2V11" />
        <path d="m4.5 16.5 4.2-4.2a1.6 1.6 0 0 1 2.3 0l4.5 4.5M14 15.5l1.3-1.3a1.6 1.6 0 0 1 2.3 0l1.9 1.9" />
        <circle cx="9" cy="9" r="1.4" />
        <path d="M18.5 3v6M15.5 6h6" />
    </svg>
);
const SpeakerSmallIcon = () => icon(<path d="M3.5 8v4h3l4 3.5v-11l-4 3.5Zm10-1.5a4.5 4.5 0 0 1 0 7" />);
const ExpandIcon = () => icon(<path d="M11.5 4H16v4.5M16 4l-5 5M8.5 16H4v-4.5M4 16l5-5" />);
const MenuIcon = () => (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 6h13M3.5 10h13M3.5 14h9" />
    </svg>
);

/** The switcher's chevron after the name (the Companions tab's chat): the line opens. */
function SwitchChevronIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** The app's fixed greeting for the time of day (the owner, 2026-11-06, after the Claude app). */
function greetingLine(labels: AskDrawerLabels, personName: string | null, hour = new Date().getHours()): string {
    const base = hour < 12 ? labels.goodMorning : hour < 18 ? labels.goodAfternoon : labels.goodEvening;
    // The first name, as the Claude app greets (bug hunt, 2026-11-06).
    const name = personName?.trim().split(/\s+/)[0];
    return name ? base.replace("{name}", name) : base.replace(", {name}", "").replace("{name}", "").trim();
}

function PlusIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

/**
 * The "+" and its two items (Take a photo, Upload from camera roll), as the
 * Claude app's. A file item is a label over a hidden file input, so the tap
 * that picks the item is the tap that opens the camera app or the roll; a
 * link item is where there is no camera app. The menu closes on a pick,
 * Escape, or a tap outside.
 */
function ComposerPlusMenu({capture}: {capture: NonNullable<NonNullable<AskConversationPage["switcher"]>["capture"]>}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        const onPointer = (event: PointerEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onPointer);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onPointer);
        };
    }, [open]);
    const itemClass = "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-card px-3 py-2 text-left text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08] active:bg-white/10";
    return (
        <div ref={root} className="relative mb-0.5 shrink-0">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label={capture.label}
                title={capture.label}
                aria-haspopup="menu"
                aria-expanded={open}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-white transition-colors hover:bg-white/15"
                data-testid="composer-plus"
            >
                <PlusIcon />
            </button>
            {open ? (
                <div role="menu" className="absolute bottom-11 left-0 z-30 w-64 rounded-panel border border-white/10 bg-[#121a14] p-1.5 shadow-2xl" data-testid="composer-plus-menu">
                    {capture.items.map((item) => item.href ? (
                        <Link key={item.key} href={item.href} role="menuitem" className={itemClass} data-testid={`composer-plus-${item.key}`} onClick={() => setOpen(false)}>
                            {item.key === "camera" ? <CameraGlyph /> : <RollGlyph />}
                            <span>{item.label}</span>
                        </Link>
                    ) : (
                        <label key={item.key} role="menuitem" className={itemClass} data-testid={`composer-plus-${item.key}`}>
                            {item.key === "camera" ? <CameraGlyph /> : <RollGlyph />}
                            <span>{item.label}</span>
                            <input
                                type="file"
                                accept={item.accept}
                                capture={item.capture}
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    event.target.value = "";
                                    setOpen(false);
                                    if (file) capture.onFile(item.key, file);
                                }}
                            />
                        </label>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CameraGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-primary-300">
            <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.1-1.6c.3-.4.7-.6 1.2-.6h3.2c.5 0 .9.2 1.2.6L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
    );
}

function RollGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-primary-300">
            <rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m5 16 4.2-4.6a1 1 0 0 1 1.5 0L14 15l1.8-2a1 1 0 0 1 1.5 0L19 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="15.5" cy="9.5" r="1.3" fill="currentColor" />
        </svg>
    );
}
