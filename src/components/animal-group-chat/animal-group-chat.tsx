"use client";

/**
 * "Talk to several animals": two to four of the reader's own animals in one
 * conversation, one of each species. The animals talk it over with each
 * other, one typing at a time, while the reader watches and can jump in;
 * picking one of them addresses the next message to it alone.
 *
 * The web counterpart of `AnimalGroupChatEntryView`, `AnimalGroupCapturePicker`
 * and `AnimalGroupChatView` in the iOS app (AnimalDex de78fe74, 546d7a07,
 * 589691a6, 4b8bbfc7, ae2bec96): the picker first, then the conversation, in
 * the one-to-one chat's Messages bubbles, one per thought. Faces are always
 * the species' icon art. Threads are keyed by the sorted capture ids, so the
 * same group picked in any order reopens the same conversation; the group
 * itself rides in the address (`?animals=`), so a reload keeps it.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {
    AskAnimalFace,
    AskMenu,
    AskPlainBubbleText,
    AskSparkle,
    AskUserBubble,
    ASK_BUBBLE_INCOMING,
    AskReportSheet,
    MoreIcon,
    type AskReportLabels
} from "@/components/ask-animaldex/ask-messenger";
import {useAnimalSounds} from "@/components/ask-animaldex/use-animal-sounds";
import type {AskReportChoice} from "@/lib/ask-animaldex/report";
import AssistantMarkdown from "@/components/ask-animaldex/assistant-markdown";
import {usePrefersReducedMotion} from "@/components/ask-animaldex/use-reply-pacer";
import {useAskGroupDirector} from "@/components/animal-group-chat/use-group-director";
import {useCompanions} from "@/components/companions/use-companions";
import {companionSummaryName, type CompanionSummary, type CompanionWords} from "@/lib/companion-bond";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {askShortNames} from "@/lib/ask-animaldex/group-conversation";
import {ASK_GROUP_MAX_ANIMALS, ASK_GROUP_MIN_ANIMALS} from "@/lib/ask-animaldex/group-rules";
import {
    askGroupColor,
    askGroupHistoryForSending,
    askGroupThreadKey,
    loadAskGroupThreads,
    parseAskGroupFrame,
    saveAskGroupThreads,
    type AskGroupMessage,
    type AskGroupSpeaker,
    type AskGroupTurn
} from "@/lib/ask-animaldex/group-thread";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

export type AnimalGroupChatLabels = Record<
    | "title" | "intro" | "empty" | "loading" | "pickHint" | "search" | "start" | "cancel" | "yourAnimals" | "talkingItOver"
    | "options" | "close" | "newConversation" | "changeAnimals" | "clearConfirm" | "clearBody" | "clearAction" | "typing"
    | "talkOnlyTo" | "theAnimals" | "anAnimal" | "isTalking" | "welcome" | "openerDecision" | "openerThinkOfMe"
    | "openerHardWeek" | "followCarryOn" | "followStillDisagree" | "followEachInMyPlace" | "followWhereAgree"
    | "commonGround" | "copy" | "copied" | "share" | "more" | "tryAgain" | "toOnly" | "talkToAll" | "messageName"
    | "jumpIn" | "messageAnimals" | "send" | "stop" | "failed" | "offline" | "signInNeeded" | "shareHeading",
    string
>;

/** The one-to-one chat's own budget and credits copy, shared rather than repeated. */
export type AnimalGroupBudgetLabels = Record<
    | "remaining" | "limitTitle" | "limitBodySignedIn" | "limitCtaSignedIn" | "limitHrefSignedIn" | "limitBodyPro"
    | "creditsOffer" | "creditsContinue" | "creditsFooter" | "creditsOut" | "creditsGet",
    string
>;

const CREDITS_HREF = "/app/credits#credits";
/** The drawer's own key: "Continue with credits" holds across every chat until the allowance resets. */
const PAY_WITH_CREDITS_KEY = "animaldex:ask:pay-with-credits-until";

function payingUntil(): number | null {
    try {
        const until = Number(window.localStorage.getItem(PAY_WITH_CREDITS_KEY));
        return Number.isFinite(until) && until > Date.now() ? until : null;
    } catch {
        return null;
    }
}

function setPayingUntil(until: number | null) {
    try {
        if (until) window.localStorage.setItem(PAY_WITH_CREDITS_KEY, String(until));
        else window.localStorage.removeItem(PAY_WITH_CREDITS_KEY);
    } catch {
        // This visit only, then.
    }
}

function nextUtcMidnight(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function newId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

function faceUrl(row: CompanionSummary | undefined): string | null {
    return row?.slug ? getSpeciesImageRoute(row.slug) : null;
}

export default function AnimalGroupChat({
    labels,
    budget,
    report,
    words,
    locale
}: {
    labels: AnimalGroupChatLabels;
    budget: AnimalGroupBudgetLabels;
    /** Report this reply, in the one-to-one chat's words. */
    report: AskReportLabels;
    /** The animals' names ("Luna the Gray Wolf") and Capture, in the reader's language. */
    words: CompanionWords;
    locale: string;
}) {
    const {rows, didLoad} = useCompanions();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // Only animals with a card can talk: the conversation is through their cards.
    const animals = useMemo(() => rows.filter((row) => row.captureId), [rows]);
    const requested = useMemo(
        () => (searchParams?.get("animals") ?? "").split(",").map((id) => id.trim().toLowerCase()).filter(Boolean),
        [searchParams]
    );
    const chosen = useMemo(() => {
        const byCapture = new Map(animals.map((row) => [String(row.captureId).toLowerCase(), row]));
        const picked = requested.map((id) => byCapture.get(id)).filter((row): row is CompanionSummary => Boolean(row));
        return picked.length >= ASK_GROUP_MIN_ANIMALS ? picked.slice(0, ASK_GROUP_MAX_ANIMALS) : null;
    }, [animals, requested]);

    const choose = (picked: CompanionSummary[] | null) => {
        const query = picked ? `?animals=${picked.map((row) => row.captureId).join(",")}` : "";
        router.replace(`${pathname ?? ""}${query}`);
    };

    if (!didLoad) {
        return <GroupFrame><p className="px-4 py-8 text-sm text-white/55 md:px-5">{labels.loading}</p></GroupFrame>;
    }
    if (!chosen) {
        return (
            <GroupPicker
                labels={labels}
                words={words}
                animals={animals}
                preselected={requested}
                onStart={(picked) => choose(picked)}
            />
        );
    }
    return (
        <GroupConversation
            key={askGroupThreadKey(chosen.map((row) => String(row.captureId)))}
            labels={labels}
            budget={budget}
            report={report}
            words={words}
            locale={locale}
            members={chosen}
            onChangeAnimals={() => choose(null)}
        />
    );
}

/** The group page sits in the app's column, full height, flush bands top to bottom. */
function GroupFrame({children}: {children: React.ReactNode}) {
    return (
        <div className="relative -mx-4 -my-7 flex h-[calc(100dvh-11.75rem)] min-h-[30rem] flex-col border-white/[0.08] sm:-mx-7 md:mx-auto md:my-0 md:max-w-3xl md:border-x lg:-my-10 lg:h-[100dvh]">
            {children}
        </div>
    );
}

// MARK: - The picker

function GroupPicker({
    labels,
    words,
    animals,
    preselected,
    onStart
}: {
    labels: AnimalGroupChatLabels;
    words: CompanionWords;
    animals: CompanionSummary[];
    preselected: string[];
    onStart: (picked: CompanionSummary[]) => void;
}) {
    const [selection, setSelection] = useState<string[]>(() =>
        preselected.filter((id) => animals.some((row) => String(row.captureId).toLowerCase() === id)).slice(0, ASK_GROUP_MAX_ANIMALS));
    const [query, setQuery] = useState("");
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return animals;
        return animals.filter((row) => companionSummaryName(row, words).toLowerCase().includes(needle) || row.animal.toLowerCase().includes(needle));
    }, [animals, query, words]);
    const isFull = selection.length >= ASK_GROUP_MAX_ANIMALS;
    const canStart = selection.length >= ASK_GROUP_MIN_ANIMALS && selection.length <= ASK_GROUP_MAX_ANIMALS;
    const byCapture = new Map(animals.map((row) => [String(row.captureId).toLowerCase(), row]));

    return (
        <GroupFrame>
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 md:px-5">
                <Link href="/app" className="text-sm font-semibold text-white/60 transition hover:text-white">{labels.cancel}</Link>
                <h1 className="min-w-0 flex-1 truncate text-center text-sm font-bold text-white">{labels.title}</h1>
                <button
                    type="button"
                    disabled={!canStart}
                    onClick={() => onStart(selection.map((id) => byCapture.get(id)).filter((row): row is CompanionSummary => Boolean(row)))}
                    className="text-sm font-black text-primary-300 transition enabled:hover:text-primary-200 disabled:text-white/25"
                >
                    {labels.start.replace("{count}", String(selection.length))}
                </button>
            </div>
            {animals.length < ASK_GROUP_MIN_ANIMALS ? (
                <div className="flex flex-1 flex-col items-start gap-4 px-4 py-8 md:px-5">
                    <p className="text-base font-semibold text-white">{labels.empty}</p>
                    <Link href="/app/capture" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300">
                        <AppIcon name="camera" /> {words.list.capture}
                    </Link>
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <p className="border-b border-white/[0.08] px-4 py-3.5 text-sm leading-6 text-white/60 md:px-5">{labels.pickHint}</p>
                    <label className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-2.5 md:px-5">
                        <AppIcon name="search" className="h-4 w-4 shrink-0 text-white/35" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={labels.search}
                            aria-label={labels.search}
                            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/35"
                        />
                    </label>
                    {visible.map((row) => {
                        const id = String(row.captureId).toLowerCase();
                        const at = selection.indexOf(id);
                        const picked = at >= 0;
                        const dimmed = !picked && isFull;
                        return (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={picked}
                                onClick={() => setSelection((current) => (
                                    current.includes(id) ? current.filter((value) => value !== id) : current.length >= ASK_GROUP_MAX_ANIMALS ? current : [...current, id]
                                ))}
                                className={`flex w-full items-center gap-3.5 border-b border-white/[0.08] px-4 py-3 text-left transition hover:bg-white/[0.03] md:px-5 ${dimmed ? "opacity-45" : ""}`}
                            >
                                <AskAnimalFace url={faceUrl(row)} size={48} className={picked ? "ring-2 ring-primary-400" : ""} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-base font-bold text-white">{companionSummaryName(row, words)}</span>
                                    {row.powerName ? <span className="mt-0.5 block truncate text-xs font-semibold text-white/50">{row.powerName}</span> : null}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${picked ? "bg-primary-400 text-black" : "border border-white/20"}`}
                                >
                                    {picked ? at + 1 : null}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </GroupFrame>
    );
}

// MARK: - The conversation

type LimitNotice =
    | {kind: "credits"; cost: number; balance: number; limit: number | null}
    | {kind: "upgrade"; isPro: boolean; limit: number | null}
    | {kind: "outOfCredits"};

function GroupConversation({
    labels,
    budget,
    report,
    words,
    locale,
    members,
    onChangeAnimals
}: {
    labels: AnimalGroupChatLabels;
    budget: AnimalGroupBudgetLabels;
    report: AskReportLabels;
    words: CompanionWords;
    locale: string;
    members: CompanionSummary[];
    onChangeAnimals: () => void;
}) {
    const captureIds = useMemo(() => members.map((row) => String(row.captureId).toLowerCase()), [members]);
    const threadKey = askGroupThreadKey(captureIds);
    const byCapture = useMemo(() => new Map(members.map((row) => [String(row.captureId).toLowerCase(), row])), [members]);
    const shortNames = useMemo(() => {
        const names = askShortNames(members.map((row) => ({nickname: row.nickname, animalName: row.animal})));
        return new Map(captureIds.map((id, index) => [id, names[index]]));
    }, [members, captureIds]);

    const [messages, setMessagesState] = useState<AskGroupMessage[]>([]);
    const messagesRef = useRef<AskGroupMessage[]>([]);
    useEffect(() => {
        const restored = loadAskGroupThreads(storage())[threadKey] ?? [];
        messagesRef.current = restored;
        setMessagesState(restored);
    }, [threadKey]);
    const setMessages = useCallback((change: (current: AskGroupMessage[]) => AskGroupMessage[]) => {
        const next = change(messagesRef.current);
        messagesRef.current = next;
        setMessagesState(next);
        const threads = loadAskGroupThreads(storage());
        saveAskGroupThreads(storage(), {...threads, [threadKey]: next});
    }, [threadKey]);

    const [composer, setComposer] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [addressedId, setAddressedId] = useState<string | null>(null);
    const [speakers, setSpeakers] = useState<Map<string, AskGroupSpeaker>>(new Map());
    const [limitNotice, setLimitNotice] = useState<LimitNotice | null>(null);
    const [limitedMessage, setLimitedMessage] = useState<{text: string; requestId: string} | null>(null);
    const [quota, setQuota] = useState<{remaining: number | null; limit: number | null; isPro: boolean; creditCost: number | null; creditBalance: number | null}>(
        {remaining: null, limit: null, isPro: false, creditCost: null, creditBalance: null}
    );
    const [confirmingClear, setConfirmingClear] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    // Report this reply (Android 8649e5a: a group bubble too), filed against the speaking animal's card.
    const [reportTarget, setReportTarget] = useState<AskGroupMessage | null>(null);
    const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
    /** Each animal's sounds, by its card, registered by the `MemberSounds` below. */
    const soundsRef = useRef(new Map<string, MemberSoundControls>());
    const abortRef = useRef<AbortController | null>(null);
    const roundRef = useRef(0);
    const followUpsRef = useRef<string[]>([]);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const following = useRef(true);
    const reducedMotion = usePrefersReducedMotion();

    const director = useAskGroupDirector({
        instant: reducedMotion,
        onTurnShown: (turn, text) => keep(turn, text),
        onRoundFinished: () => {
            const followUps = followUpsRef.current;
            setMessages((current) => {
                const next = [...current];
                for (let index = next.length - 1; index >= 0; index -= 1) {
                    if (next[index].role === "assistant" && next[index].status === "complete") {
                        next[index] = {...next[index], followUpPrompts: followUps};
                        break;
                    }
                }
                return next;
            });
        },
        // Each animal makes its own recorded sounds as its words appear
        // (AnimalDex de78fe74): the one-to-one chat's soundscape, one per animal.
        onWordShown: (captureId, word) => {
            const sounds = soundsRef.current.get(captureId);
            if (!sounds) return;
            if (word.isFirst) sounds.replyBegan();
            else sounds.wordShown(word.endsSentence);
        }
    });
    const isTalking = isSending || director.active;
    const hasConversation = messages.some((message) => message.role === "user");

    /** A turn that has typed out joins the thread. */
    function keep(turn: AskGroupTurn, text: string) {
        if (!text) return;
        setMessages((current) => [...current, {
            id: newId(),
            role: "assistant",
            text,
            status: "complete",
            createdAt: new Date().toISOString(),
            speakerCaptureId: turn.captureId,
            phase: turn.phase === "unknown" ? null : turn.phase
        }]);
    }

    const nameFor = useCallback((captureId: string | null | undefined): string => {
        if (!captureId) return labels.theAnimals;
        const row = byCapture.get(captureId);
        const speaker = speakers.get(captureId);
        const animal = speaker?.animalName || row?.animal;
        if (!animal) return labels.anAnimal;
        return companionSummaryName({nickname: speaker?.nickname ?? row?.nickname ?? null, animal}, words);
    }, [byCapture, speakers, labels.anAnimal, labels.theAnimals, words]);
    const colorFor = (captureId: string | null | undefined) => askGroupColor(captureId, captureIds);

    // Who is typing right now, for the strip.
    const typingIds = new Set<string>();
    if (director.current) typingIds.add(director.current.captureId);
    if (director.revealing && director.waiting) typingIds.add(director.waiting.captureId);

    // Follow the conversation down while the reader is at the bottom; leave
    // them be once they scroll up to reread.
    useEffect(() => {
        if (!following.current) return;
        const scroller = scrollRef.current;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });

    /**
     * Ends the round now. What the animal on screen had said stays in the
     * thread (cut where it stood); nothing unseen is kept.
     */
    const stopTalking = useCallback((keepWhatWasSaid: boolean) => {
        roundRef.current += 1;
        abortRef.current?.abort();
        abortRef.current = null;
        setIsSending(false);
        const kept = director.interrupt();
        if (kept && keepWhatWasSaid) keep(kept.turn, kept.shown);
        // `keep` only reads refs and setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [director]);
    useEffect(() => () => {
        abortRef.current?.abort();
    }, []);

    const send = useCallback(async (raw: string, reusing?: {questionId: string; requestId: string}) => {
        const text = raw.replace(/\s+/g, " ").trim();
        if (!text) return;
        // Jumping in: whatever the animals already said stays.
        if (abortRef.current || director.active) stopTalking(true);
        const round = roundRef.current + 1;
        roundRef.current = round;
        const controller = new AbortController();
        abortRef.current = controller;
        setIsSending(true);
        setLimitNotice(null);
        following.current = true;

        const requestId = reusing?.requestId ?? newId();
        let questionId = reusing?.questionId ?? "";
        if (!reusing || !messagesRef.current.some((message) => message.id === reusing.questionId)) {
            questionId = newId();
            setMessages((current) => [...current, {id: questionId, role: "user", text, status: "complete", createdAt: new Date().toISOString(), requestId}]);
        }
        setComposer("");
        const history = askGroupHistoryForSending(messagesRef.current, questionId);
        // Addressing is for the next message only.
        const addressed = addressedId;
        setAddressedId(null);
        followUpsRef.current = [];
        director.beginRound();
        const paying = payingUntil() !== null;
        let shownAnything = false;

        const fail = (message: string) => {
            director.interrupt();
            setMessages((current) => [...current, {id: newId(), role: "assistant", text: message, status: "failed", createdAt: new Date().toISOString()}]);
        };

        try {
            const response = await fetch("/api/ask/group", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                signal: controller.signal,
                body: JSON.stringify({
                    captureIds,
                    addressedCaptureId: addressed,
                    question: text,
                    history,
                    requestId,
                    ...(paying ? {payWithCredits: true} : {}),
                    locale,
                    utcOffsetMinutes: -new Date().getTimezoneOffset()
                })
            });
            if (response.status === 429) {
                const payload = await response.json().catch(() => ({})) as {reason?: string; limit?: number; isPro?: boolean; creditOverflow?: {available?: boolean; cost?: number; balance?: number}};
                if (paying) setPayingUntil(null);
                director.interrupt();
                // The message waits in the composer, to be sent again as it was.
                setMessages((current) => current.filter((message) => message.id !== questionId));
                setComposer(text);
                setLimitedMessage({text, requestId});
                setLimitNotice(payload.reason === "insufficient_credits"
                    ? {kind: "outOfCredits"}
                    : payload.creditOverflow?.available
                        ? {kind: "credits", cost: payload.creditOverflow.cost ?? 1, balance: payload.creditOverflow.balance ?? 0, limit: payload.limit ?? null}
                        : {kind: "upgrade", isPro: payload.isPro === true, limit: payload.limit ?? null});
                return;
            }
            if (!response.ok || !response.body) {
                fail(response.status === 401 ? labels.signInNeeded : labels.failed);
                return;
            }
            await readFrames(response.body, (frame) => {
                if (roundRef.current !== round) return;
                const event = parseAskGroupFrame(frame);
                if (!event) return;
                switch (event.kind) {
                    case "speakers":
                        setSpeakers(new Map(event.speakers.map((speaker) => [speaker.captureId, speaker])));
                        break;
                    case "turnStarted":
                        director.turnStarted(event.start);
                        break;
                    case "turnDelta":
                        shownAnything = true;
                        director.received(event.index, event.text);
                        break;
                    case "turnDone":
                        director.turnDone(event.index, event.settled);
                        break;
                    case "turnFailed":
                        director.turnFailed(event.index);
                        break;
                    case "done": {
                        const done = event.done;
                        followUpsRef.current = done.followUps;
                        setQuota({remaining: done.remaining, limit: done.limit, isPro: done.isPro, creditCost: done.creditCost, creditBalance: done.creditBalance});
                        // Today's last message has gone: the composer makes way for the notice.
                        if (done.remaining !== null && done.remaining <= 0 && payingUntil() === null) {
                            setLimitNotice(done.creditOverflow?.available
                                ? {kind: "credits", cost: done.creditOverflow.cost, balance: done.creditOverflow.balance, limit: done.limit}
                                : {kind: "upgrade", isPro: done.isPro, limit: done.limit});
                        }
                        director.streamFinished();
                        break;
                    }
                }
            });
            if (roundRef.current === round) director.streamFinished();
        } catch {
            if (controller.signal.aborted || roundRef.current !== round) return;
            // What was already said stays; the rest of the round is gone.
            director.streamFinished();
            if (!shownAnything) {
                fail(typeof navigator !== "undefined" && navigator.onLine === false ? labels.offline : labels.failed);
            }
        } finally {
            if (roundRef.current === round) {
                abortRef.current = null;
                setIsSending(false);
            }
        }
    }, [addressedId, captureIds, director, labels.failed, labels.offline, labels.signInNeeded, locale, setMessages, stopTalking]);

    const retry = (failedId: string) => {
        const current = messagesRef.current;
        const index = current.findIndex((message) => message.id === failedId);
        const question = [...current.slice(0, index)].reverse().find((message) => message.role === "user");
        if (index < 0 || !question) return;
        // Everything after the question goes; the question is sent again as it was.
        const questionIndex = current.findIndex((message) => message.id === question.id);
        setMessages(() => current.slice(0, questionIndex + 1));
        void send(question.text, {questionId: question.id, requestId: question.requestId ?? newId()});
    };

    const continueWithCredits = () => {
        setPayingUntil(nextUtcMidnight());
        setLimitNotice(null);
        if (limitedMessage) {
            const pending = limitedMessage;
            setLimitedMessage(null);
            setComposer("");
            void send(pending.text, {questionId: "", requestId: pending.requestId});
        }
    };

    const followUpLabel = (prompt: string): string => ({
        "Carry on": labels.followCarryOn,
        "Where do you still disagree?": labels.followStillDisagree,
        "What would you each do in my place?": labels.followEachInMyPlace,
        "Where do you all agree?": labels.followWhereAgree
    } as Record<string, string>)[prompt] ?? prompt;

    const copy = (message: AskGroupMessage) => {
        void navigator.clipboard?.writeText(askMarkdownPlainText(message.text));
        setCopiedId(message.id);
        setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1600);
    };
    const share = (message: AskGroupMessage) => {
        const body = `${labels.shareHeading}\n\n${nameFor(message.speakerCaptureId)}: ${askMarkdownPlainText(message.text)}`;
        if (navigator.share) void navigator.share({text: body}).catch(() => undefined);
        else void navigator.clipboard?.writeText(body);
    };
    const sendReport = async (choice: AskReportChoice) => {
        if (!reportTarget) return;
        setReportState("sending");
        const speaker = reportTarget.speakerCaptureId ?? null;
        const row = speaker ? byCapture.get(speaker) : undefined;
        try {
            const response = await fetch("/api/ask/report", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    choice,
                    text: askMarkdownPlainText(reportTarget.text),
                    animalName: row?.animal ?? nameFor(speaker),
                    captureId: speaker
                })
            });
            setReportState(response.ok ? "sent" : "failed");
        } catch {
            setReportState("failed");
        }
    };

    const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id ?? null;
    const placeholder = addressedId
        ? labels.messageName.replace("{name}", nameFor(addressedId))
        : isTalking ? labels.jumpIn : labels.messageAnimals;
    const showStop = isTalking && composer.trim().length === 0;
    const listFormat = (() => {
        try {
            return new Intl.ListFormat(locale, {type: "conjunction"}).format(captureIds.map((id) => shortNames.get(id) ?? ""));
        } catch {
            return captureIds.map((id) => shortNames.get(id) ?? "").join(", ");
        }
    })();
    const openers = [labels.openerDecision, labels.openerThinkOfMe, labels.openerHardWeek];

    return (
        <GroupFrame>
            {/* Header: back to Companions, who this is, and the conversation's options. */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 md:px-5">
                <Link href="/app" aria-label={labels.close} className="grid h-9 w-9 place-items-center text-white/60 transition hover:text-white">
                    <AppIcon name="back" className="h-5 w-5" />
                </Link>
                <div className="min-w-0 flex-1 text-center">
                    <h1 className="truncate text-sm font-bold text-white">{labels.yourAnimals}</h1>
                    {isTalking ? <p className="text-[11px] font-semibold text-primary-300" aria-live="polite">{labels.talkingItOver}</p> : null}
                </div>
                <AskMenu
                    label={labels.options}
                    align="right"
                    buttonClassName="grid h-9 w-9 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/8 hover:text-white"
                    items={[
                        {label: labels.newConversation, onSelect: () => setConfirmingClear(true), disabled: !hasConversation},
                        {label: labels.changeAnimals, onSelect: () => {
                            stopTalking(true);
                            onChangeAnimals();
                        }}
                    ]}
                >
                    <MoreIcon />
                </AskMenu>
            </div>

            {confirmingClear ? (
                <div className="shrink-0 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3 md:px-5">
                    <p className="text-sm font-semibold text-white">{labels.clearConfirm}</p>
                    <p className="mt-1 text-xs leading-5 text-white/55">{labels.clearBody}</p>
                    <div className="mt-2.5 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                stopTalking(false);
                                setMessages(() => []);
                                setConfirmingClear(false);
                            }}
                            className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-black transition-colors hover:bg-primary-300"
                        >
                            {labels.clearAction}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmingClear(false)}
                            className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
                        >
                            {labels.cancel}
                        </button>
                    </div>
                </div>
            ) : null}

            {/* Who is here: tap one to talk to it alone; it rings while it types. */}
            <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-white/[0.08] px-4 py-2 [scrollbar-width:none] md:px-5">
                {captureIds.map((id) => {
                    const tint = colorFor(id);
                    const addressed = addressedId === id;
                    const typing = typingIds.has(id);
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setAddressedId((current) => (current === id ? null : id))}
                            aria-label={labels.talkOnlyTo.replace("{name}", nameFor(id))}
                            aria-pressed={addressed}
                            className="flex w-[70px] shrink-0 flex-col items-center gap-1"
                        >
                            <span
                                className={`rounded-full transition-transform ${typing ? "scale-105" : ""}`}
                                style={{boxShadow: `0 0 0 ${addressed || typing ? 2.5 : 1.5}px ${tint}${addressed || typing ? "" : "59"}`}}
                            >
                                <AskAnimalFace url={faceUrl(byCapture.get(id))} size={36} />
                            </span>
                            <span
                                className={`w-full truncate text-center text-[11px] ${typing ? "font-semibold" : ""}`}
                                style={{color: typing || addressed ? tint : "rgb(var(--c-ink-400))"}}
                            >
                                {typing ? labels.typing : shortNames.get(id)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* The thread. */}
            <div
                ref={scrollRef}
                onScroll={() => {
                    const scroller = scrollRef.current;
                    if (scroller) following.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
                }}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5"
            >
                <div className="flex flex-col gap-[18px]">
                    {!hasConversation ? (
                        <div className="flex flex-col gap-3.5 pt-1.5">
                            <div className="flex" aria-hidden="true">
                                {captureIds.map((id, index) => (
                                    <span
                                        key={id}
                                        className="rounded-full bg-canvas-950"
                                        style={{marginLeft: index === 0 ? 0 : -12, boxShadow: `0 0 0 3px rgb(var(--c-canvas-950)), 0 0 0 4.5px ${colorFor(id)}`}}
                                    >
                                        <AskAnimalFace url={faceUrl(byCapture.get(id))} size={52} />
                                    </span>
                                ))}
                            </div>
                            <div>
                                <h2 className="font-display text-2xl font-bold leading-8 text-white">{listFormat}</h2>
                                <p className="mt-1.5 text-sm leading-6 text-white/60">{labels.welcome}</p>
                            </div>
                            <Chips prompts={openers} onPick={(prompt) => void send(prompt)} />
                        </div>
                    ) : null}

                    {messages.map((message) => {
                        if (message.role === "user") {
                            return <div key={message.id} className="pt-1"><AskUserBubble text={message.text} label="" /></div>;
                        }
                        if (message.status === "failed") {
                            return (
                                <div key={message.id} className="flex flex-col items-start gap-2">
                                    <p className="text-sm leading-6 text-white/60">{message.text}</p>
                                    {/* A speaker's own failure was refunded and needs nothing; a round that failed as a whole can be sent again. */}
                                    {!message.speakerCaptureId && !isTalking ? (
                                        <button
                                            type="button"
                                            onClick={() => retry(message.id)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-300 transition-colors hover:text-primary-200"
                                        >
                                            <AppIcon name="refresh" className="h-3.5 w-3.5" />
                                            {labels.tryAgain}
                                        </button>
                                    ) : null}
                                </div>
                            );
                        }
                        const speaker = message.speakerCaptureId ?? null;
                        return (
                            <AnimalRow
                                key={message.id}
                                name={nameFor(speaker)}
                                color={colorFor(speaker)}
                                face={faceUrl(speaker ? byCapture.get(speaker) : undefined)}
                                commonGround={message.phase === "converge" ? labels.commonGround : null}
                                onFace={speaker ? () => setAddressedId((current) => (current === speaker ? null : speaker)) : undefined}
                            >
                                <div className="group/reply flex items-end gap-1">
                                    <GroupBubbles text={message.text} isLive={false} />
                                    <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/reply:opacity-100 [@media(pointer:coarse)]:opacity-100">
                                        <AskMenu
                                            label={labels.more}
                                            align="right"
                                            items={[
                                                {label: copiedId === message.id ? labels.copied : labels.copy, onSelect: () => copy(message)},
                                                {label: labels.share, onSelect: () => share(message)},
                                                {label: report.report, onSelect: () => {
                                                    setReportState("idle");
                                                    setReportTarget(message);
                                                }}
                                            ]}
                                        >
                                            <MoreIcon />
                                        </AskMenu>
                                    </span>
                                </div>
                                {message.id === lastAssistantId && !isTalking && messages[messages.length - 1]?.id === message.id ? (
                                    <div className="pt-1">
                                        <Chips
                                            prompts={(message.followUpPrompts?.length ? message.followUpPrompts : ["Where do you all agree?"]).map(followUpLabel)}
                                            onPick={(prompt) => void send(prompt)}
                                        />
                                    </div>
                                ) : null}
                            </AnimalRow>
                        );
                    })}

                    {/* The round as it plays out: the animal typing now, and the one about to speak. */}
                    {director.current ? (
                        director.revealing && director.revealing.index === director.current.index ? (
                            <>
                                <AnimalRow
                                    name={nameFor(director.current.captureId)}
                                    color={colorFor(director.current.captureId)}
                                    face={faceUrl(byCapture.get(director.current.captureId))}
                                    commonGround={director.current.phase === "converge" ? labels.commonGround : null}
                                >
                                    <p className="sr-only">{labels.isTalking.replace("{name}", nameFor(director.current.captureId))}</p>
                                    <div aria-hidden="true" className="cursor-text" onClick={director.skipCurrent}>
                                        <GroupBubbles text={director.visibleText} isLive />
                                    </div>
                                </AnimalRow>
                                {director.waiting ? <TypingRow name={nameFor(director.waiting.captureId)} color={colorFor(director.waiting.captureId)} face={faceUrl(byCapture.get(director.waiting.captureId))} /> : null}
                            </>
                        ) : (
                            <TypingRow name={nameFor(director.current.captureId)} color={colorFor(director.current.captureId)} face={faceUrl(byCapture.get(director.current.captureId))} />
                        )
                    ) : isSending ? (
                        // Before the first animal is chosen: the group is gathering itself.
                        <div className="flex items-start gap-2" role="status" aria-label={labels.yourAnimals}>
                            <span className="flex">
                                {captureIds.slice(0, 3).map((id, index) => (
                                    <span key={id} className="rounded-full" style={{marginLeft: index === 0 ? 0 : -8, boxShadow: "0 0 0 2px rgb(var(--c-canvas-950))"}}>
                                        <AskAnimalFace url={faceUrl(byCapture.get(id))} size={24} />
                                    </span>
                                ))}
                            </span>
                            <TypingDots />
                        </div>
                    ) : null}
                </div>
            </div>

            {/* The composer band: the notice that replaces it once today's messages are spent. */}
            <div className="shrink-0 border-t border-white/[0.08] px-4 pb-4 pt-3 md:px-5">
                {limitNotice ? (
                    <div className="flex flex-col items-start gap-2.5 py-1">
                        <p className="text-sm leading-6 text-white/70">
                            {limitNotice.kind === "outOfCredits"
                                ? budget.creditsOut
                                : limitNotice.kind === "credits"
                                    ? budget.creditsOffer.replace("{cost}", String(limitNotice.cost)).replace("{balance}", String(limitNotice.balance))
                                    : (limitNotice.isPro ? budget.limitBodyPro : budget.limitBodySignedIn).replace("{limit}", String(limitNotice.limit ?? ""))}
                        </p>
                        {limitNotice.kind === "credits" ? (
                            <button type="button" onClick={continueWithCredits} className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black text-black transition-colors hover:bg-primary-300">
                                {budget.creditsContinue}
                            </button>
                        ) : limitNotice.kind === "outOfCredits" ? (
                            <Link href={CREDITS_HREF} className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black text-black transition-colors hover:bg-primary-300">{budget.creditsGet}</Link>
                        ) : !limitNotice.isPro ? (
                            <Link href={budget.limitHrefSignedIn} className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black text-black transition-colors hover:bg-primary-300">{budget.limitCtaSignedIn}</Link>
                        ) : null}
                    </div>
                ) : (
                    <>
                        {addressedId ? (
                            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{color: colorFor(addressedId)}}>
                                {labels.toOnly.replace("{name}", nameFor(addressedId))}
                                <button type="button" onClick={() => setAddressedId(null)} aria-label={labels.talkToAll} className="text-white/40 transition hover:text-white">
                                    <AppIcon name="close" className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : null}
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void send(composer);
                            }}
                            className="flex items-end gap-2 border border-white/12 bg-white/[0.05] py-1.5 pl-4 pr-1.5 focus-within:border-primary-300/45"
                        >
                            <textarea
                                value={composer}
                                rows={1}
                                maxLength={900}
                                placeholder={placeholder}
                                aria-label={placeholder}
                                onChange={(event) => setComposer(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void send(composer);
                                    }
                                }}
                                className="max-h-[8.25rem] min-h-[2.25rem] w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-white/35"
                            />
                            <button
                                type={showStop ? "button" : "submit"}
                                onClick={showStop ? () => stopTalking(true) : undefined}
                                disabled={!showStop && composer.trim().length === 0}
                                aria-label={showStop ? labels.stop : labels.send}
                                className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                                    showStop || composer.trim() ? "bg-primary-400 text-black hover:bg-primary-300" : "bg-white/8 text-white/35"
                                }`}
                            >
                                {showStop ? (
                                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true"><rect x="5.5" y="5.5" width="9" height="9" rx="1.6" /></svg>
                                ) : (
                                    <AppIcon name="send" className="h-4 w-4" />
                                )}
                            </button>
                        </form>
                    </>
                )}
                {/* Only a free budget is counted down. */}
                {payingUntil() !== null && quota.creditCost !== null && !limitNotice ? (
                    <p className="mt-2 text-[11px] text-white/40">
                        {budget.creditsFooter.replace("{cost}", String(quota.creditCost)).replace("{balance}", String(quota.creditBalance ?? "…"))}
                    </p>
                ) : quota.remaining !== null && quota.limit !== null && !quota.isPro && quota.remaining > 0 && !limitNotice ? (
                    <p className="mt-2 text-[11px] text-white/40">
                        {budget.remaining.replace("{remaining}", String(quota.remaining)).replace("{limit}", String(quota.limit))}
                    </p>
                ) : null}
            </div>
            {members.map((row) => (
                <MemberSounds
                    key={String(row.captureId)}
                    captureId={String(row.captureId).toLowerCase()}
                    speciesProfileId={row.speciesProfileId}
                    registry={soundsRef.current}
                />
            ))}
            {reportTarget ? (
                <AskReportSheet
                    labels={report}
                    state={reportState}
                    onChoose={(choice) => void sendReport(choice)}
                    onClose={() => setReportTarget(null)}
                />
            ) : null}
        </GroupFrame>
    );
}

type MemberSoundControls = {replyBegan: () => void; wordShown: (endsSentence: boolean) => void};

/** One animal's recorded sounds in the group, under its card; renders nothing. */
function MemberSounds({captureId, speciesProfileId, registry}: {
    captureId: string;
    speciesProfileId: string | null;
    registry: Map<string, MemberSoundControls>;
}) {
    const sounds = useAnimalSounds({speciesProfileId, pace: null, held: false});
    const {replyBegan, wordShown} = sounds;
    useEffect(() => {
        registry.set(captureId, {replyBegan, wordShown});
        return () => {
            registry.delete(captureId);
        };
    }, [registry, captureId, replyBegan, wordShown]);
    return null;
}

/** One animal's line in the thread: its face (tap to talk to it alone), its name in its colour, then what it said. */
function AnimalRow({
    name,
    color,
    face,
    commonGround,
    onFace,
    children
}: {
    name: string;
    color: string;
    face: string | null;
    commonGround?: string | null;
    onFace?: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-2">
            <button type="button" onClick={onFace} disabled={!onFace} aria-hidden="true" tabIndex={-1} className="shrink-0 rounded-full" style={{boxShadow: `0 0 0 1.5px ${color}cc`}}>
                <AskAnimalFace url={face} size={30} />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[5px]">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold" style={{color}}>{name}</span>
                    {commonGround ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55">
                            <AppIcon name="check" className="h-3 w-3" />
                            {commonGround}
                        </span>
                    ) : null}
                </div>
                {children}
            </div>
        </div>
    );
}

function TypingDots() {
    return (
        <span
            className="flex h-[38px] w-[58px] items-center justify-center gap-[5px]"
            style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: "19px"}}
            aria-hidden="true"
        >
            {[0, 1, 2].map((dot) => (
                <span key={dot} className="ask-typing-dot h-[7px] w-[7px] rounded-full bg-white/75" style={{animationDelay: `${dot * 150}ms`}} />
            ))}
        </span>
    );
}

function TypingRow({name, color, face}: {name: string; color: string; face: string | null}) {
    return (
        <div role="status" aria-label={name}>
            <AnimalRow name={name} color={color} face={face}>
                <TypingDots />
            </AnimalRow>
        </div>
    );
}

/** A turn as bubbles, one per thought, like the one-to-one chat. */
function GroupBubbles({text, isLive}: {text: string; isLive: boolean}) {
    const pieces = askReplyPieces(text, !isLive).filter((piece) => piece.kind === "bubble");
    if (pieces.length === 0) return <TypingDots />;
    return (
        <div className="flex min-w-0 flex-col items-start gap-[3px] pr-6">
            {pieces.map((piece, index) => {
                if (piece.kind !== "bubble") return null;
                const top = index === 0 ? "19px" : "6px";
                const bottom = index === pieces.length - 1 ? "19px" : "6px";
                const sparkle = isLive && index === pieces.length - 1;
                return (
                    <div
                        key={index}
                        className="min-w-0 max-w-full break-words px-3.5 py-2 text-[15px] leading-6 text-white"
                        style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: `${top} 19px 19px ${bottom}`}}
                    >
                        {piece.isPlain ? (
                            <AskPlainBubbleText text={piece.text} sparkle={sparkle} />
                        ) : (
                            <>
                                <AssistantMarkdown compact text={piece.text} />
                                {sparkle ? <AskSparkle /> : null}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function Chips({prompts, onPick}: {prompts: string[]; onPick: (prompt: string) => void}) {
    return (
        <div className="flex flex-wrap gap-2">
            {prompts.slice(0, 3).map((prompt) => (
                <button
                    key={prompt}
                    type="button"
                    onClick={() => onPick(prompt)}
                    className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-primary-300/40"
                >
                    {prompt}
                </button>
            ))}
        </div>
    );
}

/** Reads an SSE body frame by frame. */
async function readFrames(body: ReadableStream<Uint8Array>, onFrame: (frame: Record<string, unknown>) => void) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true}).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
            const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
            const payload = line?.slice(5).trim();
            if (!payload) continue;
            try {
                onFrame(JSON.parse(payload) as Record<string, unknown>);
            } catch {
                // A frame that cannot be parsed is skipped rather than failing the round.
            }
        }
    }
}
