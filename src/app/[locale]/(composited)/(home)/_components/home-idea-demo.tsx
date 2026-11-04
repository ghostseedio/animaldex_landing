"use client";

/**
 * Hero B's live demo (lib/hero-demo): idea chips over a split card, "The
 * usual answer" (our grey example, labelled as one) beside "Your lion's
 * take", streamed from the guest Talk API on a tap. One request per tap, a
 * chip's take kept once it has arrived, and "Keep talking" carries the
 * exchange into the lion's own chat.
 */

import Image from "next/image";
import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {AI_SAFETY_HREF, useAiChatGate} from "@/components/ai-gate/ai-chat-gate";
import {AiTag} from "@/components/ai-gate/ai-notices";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {rememberTalkThread} from "@/components/ask-animaldex/ask-thread-meta";
import {askThreadKey, createAskMessage, newAskMessageId} from "@/lib/ask-animaldex/thread";
import {
    HERO_DEMO_ANIMAL,
    HERO_DEMO_TALK_PATH,
    heroDemoFailureFor,
    heroDemoFollowUps,
    heroDemoRequestBody,
    heroDemoThreadText,
    heroDemoVisibleText,
    splitStreamFrames,
    type HeroDemoChip,
    type HeroDemoFailure
} from "@/lib/hero-demo";
import {getLocalePath} from "@/lib/site";
import {rememberStorePlacement} from "@/lib/store-links";
import {noteFunnelMessage, noteFunnelReply, trackFunnel} from "@/lib/web-funnel-client";

export type HomeIdeaDemoWords = {
    label: string;
    eyebrow: string;
    chipsLabel: string;
    usualTitle: string;
    exampleTag: string;
    exampleNote: string;
    takeTitle: string;
    idle: string;
    ask: string;
    thinking: string;
    keepTalking: string;
    share: string;
    copied: string;
    shareTitle: string;
    failed: string;
    tryAgain: string;
    limit: string;
    limitCta: string;
    disclosure: string;
    safetyLink: string;
    aiTagLabel: string;
    under13Title: string;
};

type Take = {
    status: "loading" | "streaming" | "done" | "failed";
    /** The stream as it arrived; what is shown is read from it. */
    raw: string;
    followUps: string[];
    failure?: HeroDemoFailure;
};

export default function HomeIdeaDemo({chips, words, locale, animalImage}: {
    chips: HeroDemoChip[];
    words: HomeIdeaDemoWords;
    locale: string;
    animalImage: string;
}) {
    const router = useRouter();
    const gate = useAiChatGate();
    const [selectedId, setSelectedId] = useState(chips[0]?.id ?? "");
    const [takes, setTakes] = useState<Record<string, Take>>({});
    const [copied, setCopied] = useState(false);
    const inFlight = useRef<{chipId: string; controller: AbortController} | null>(null);
    const carried = useRef(new Set<string>());
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const selected = chips.find((chip) => chip.id === selectedId) ?? chips[0];
    const take = selected ? takes[selected.id] : undefined;
    const shown = take ? heroDemoVisibleText(take.raw) : "";

    useEffect(() => () => inFlight.current?.controller.abort(), []);
    // The newest words stay in view while the take arrives.
    useEffect(() => {
        const node = bodyRef.current;
        if (node && take?.status === "streaming") node.scrollTop = node.scrollHeight;
    }, [shown, take?.status]);
    useEffect(() => setCopied(false), [selectedId]);

    const ask = useCallback(async (chip: HeroDemoChip) => {
        // One take at a time: a tap on another idea stops the one arriving.
        const previous = inFlight.current;
        if (previous) {
            previous.controller.abort();
            setTakes((current) => {
                const next = {...current};
                if (next[previous.chipId]?.status !== "done") delete next[previous.chipId];
                return next;
            });
        }
        setSelectedId(chip.id);
        // An account passes its age check and consent first; a guest's tap sends our words, not theirs.
        if (!(await gate.request({ownWords: false}))) return;
        const controller = new AbortController();
        inFlight.current = {chipId: chip.id, controller};
        setTakes((current) => ({...current, [chip.id]: {status: "loading", raw: "", followUps: []}}));
        noteFunnelMessage(chip.kind);
        const fail = (failure: HeroDemoFailure) => setTakes((current) => ({...current, [chip.id]: {status: "failed", raw: "", followUps: [], failure}}));
        let raw = "";
        let followUps: string[] = [];
        try {
            const response = await fetch("/api/ask/stream", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                signal: controller.signal,
                body: JSON.stringify(heroDemoRequestBody({
                    message: chip.message,
                    locale,
                    requestId: newAskMessageId(),
                    utcOffsetMinutes: -new Date().getTimezoneOffset()
                }))
            });
            if (!response.ok || !response.body) {
                fail(heroDemoFailureFor(response.status));
                return;
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const {done, value} = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {stream: true});
                const {events, rest} = splitStreamFrames(buffer);
                buffer = rest;
                for (const event of events) {
                    if (typeof event.delta === "string") {
                        raw += event.delta;
                        const sofar = raw;
                        setTakes((current) => ({...current, [chip.id]: {status: "streaming", raw: sofar, followUps: []}}));
                    } else if (event.done) {
                        followUps = heroDemoFollowUps(event.follow_up_prompts);
                    }
                }
            }
            if (!heroDemoVisibleText(raw)) {
                fail("unavailable");
                return;
            }
            setTakes((current) => ({...current, [chip.id]: {status: "done", raw, followUps}}));
            noteFunnelReply();
        } catch {
            if (!controller.signal.aborted) fail("unavailable");
        } finally {
            if (inFlight.current?.controller === controller) inFlight.current = null;
        }
    }, [gate, locale]);

    const pick = (chip: HeroDemoChip) => {
        const existing = takes[chip.id];
        if (existing && existing.status !== "failed") {
            setSelectedId(chip.id);
            return;
        }
        void ask(chip);
    };

    /** Into the lion's own chat, with this exchange as the start of its thread. */
    const keepTalking = () => {
        if (!selected || take?.status !== "done") return;
        const key = askThreadKey({scope: "species", slug: HERO_DEMO_ANIMAL.slug});
        if (!carried.current.has(selected.id)) {
            carried.current.add(selected.id);
            askSessionStore.replace(key, [
                ...askSessionStore.messages(key),
                createAskMessage("user", selected.message),
                createAskMessage("assistant", heroDemoThreadText(take.raw), {followUpPrompts: take.followUps})
            ]);
            rememberTalkThread(key, {slug: HERO_DEMO_ANIMAL.slug, name: HERO_DEMO_ANIMAL.name, captureId: null, nickname: null});
        }
        router.push(getLocalePath(locale, HERO_DEMO_TALK_PATH));
    };

    const shareTake = async () => {
        if (!selected || take?.status !== "done") return;
        const title = words.shareTitle.replace("{idea}", selected.label);
        const url = `${window.location.origin}${getLocalePath(locale, HERO_DEMO_TALK_PATH)}`;
        const text = `${title}\n\n${shown}`;
        try {
            if (navigator.share) {
                await navigator.share({title, text, url});
            } else {
                await navigator.clipboard.writeText(`${text}\n\n${url}`);
                setCopied(true);
            }
            trackFunnel("share_take");
        } catch {
            // Closing the share sheet is not a share.
        }
    };

    if (!selected) return null;
    const busy = take?.status === "loading" || take?.status === "streaming";

    return (
        <figure aria-label={words.label} className="flex w-full min-w-0 flex-col gap-4">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-primary-200">{words.eyebrow}</p>
            <div role="group" aria-label={words.chipsLabel} className="flex flex-wrap justify-center gap-2">
                {chips.map((chip) => {
                    const pressed = chip.id === selected.id;
                    return (
                        <button
                            key={chip.id}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => pick(chip)}
                            className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold transition-colors duration-200 ${
                                pressed
                                    ? "border-primary-300 bg-primary-400 text-canvas-950"
                                    : "border-white/15 bg-white/[0.04] text-white hover:border-primary-300/60 hover:bg-white/[0.08]"
                            }`}
                            data-testid={`hero-chip-${chip.id}`}
                            data-chip-kind={chip.kind}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>

            <div className="grid w-full grid-cols-1 border border-white/10 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                {/* The usual answer: our example, grey and labelled as one. */}
                <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 bg-white/[0.035] p-4 text-left sm:border-b-0 sm:border-r sm:p-5" data-testid="hero-usual">
                    <p className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-300">{words.usualTitle}</span>
                        <span title={words.exampleNote} className="border border-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">{words.exampleTag}</span>
                    </p>
                    <ul className="flex flex-col gap-2">
                        {selected.usual.map((line) => (
                            <li key={line} className="flex gap-2.5 text-[14px] leading-5 text-ink-300">
                                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-ink-500" />
                                <span>{line}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-auto text-[11px] leading-4 text-ink-500">{words.exampleNote}</p>
                </div>

                {/* Your lion's take: live, from the lion's own record. */}
                <div className="relative flex min-h-[15rem] min-w-0 flex-col bg-canvas-950 text-left light:bg-surface-900" data-testid="hero-take" data-status={take?.status ?? "idle"}>
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-primary-400" />
                    <div className="flex items-center gap-3 px-4 pb-2 pt-4 sm:px-5">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
                            <Image src={animalImage} alt="" fill sizes="40px" className="object-contain p-0.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-primary-200">{words.takeTitle}</span>
                                <AiTag label={words.aiTagLabel} />
                            </span>
                            <span className="block truncate text-[12px] font-semibold leading-5 text-ink-300">{HERO_DEMO_ANIMAL.name} · {HERO_DEMO_ANIMAL.power}</span>
                        </span>
                    </div>
                    <div ref={bodyRef} aria-live="polite" className="max-h-[17rem] min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:max-h-[19rem] sm:px-5">
                        {gate.blocked ? (
                            <p className="text-[15px] leading-6 text-ink-200">{words.under13Title}</p>
                        ) : !take ? (
                            <div className="flex h-full flex-col items-start justify-center gap-3 py-2">
                                <p className="text-[15px] leading-6 text-ink-200">{words.idle}</p>
                                <button
                                    type="button"
                                    onClick={() => void ask(selected)}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300"
                                    data-testid="hero-ask"
                                >
                                    {words.ask} <span aria-hidden="true">→</span>
                                </button>
                            </div>
                        ) : take.status === "loading" ? (
                            <p className="flex items-center gap-2 text-[15px] leading-6 text-ink-300">
                                <span aria-hidden="true" className="flex gap-1">
                                    {[0, 1, 2].map((dot) => (
                                        <span key={dot} className="h-1.5 w-1.5 rounded-full bg-primary-300 motion-safe:animate-pulse" style={{animationDelay: `${dot * 160}ms`}} />
                                    ))}
                                </span>
                                {words.thinking}
                            </p>
                        ) : take.status === "failed" ? (
                            <div className="flex flex-col items-start gap-3">
                                <p className="text-[15px] leading-6 text-ink-200">{take.failure === "limit" ? words.limit : words.failed}</p>
                                {take.failure === "limit" ? (
                                    <Link href="/#download" onClick={() => rememberStorePlacement("chat_limit")} className="inline-flex min-h-10 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-canvas-950 hover:bg-primary-300">
                                        {words.limitCta}
                                    </Link>
                                ) : (
                                    <button type="button" onClick={() => void ask(selected)} className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-5 text-sm font-bold text-white hover:border-primary-300">
                                        {words.tryAgain}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="whitespace-pre-line text-[15px] leading-6 text-white sm:text-base sm:leading-7" data-testid="hero-take-text">
                                {shown}
                                {busy ? <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary-300 motion-safe:animate-pulse" /> : null}
                            </p>
                        )}
                    </div>
                    {take?.status === "done" && !gate.blocked ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
                            <button
                                type="button"
                                onClick={keepTalking}
                                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300"
                                data-testid="hero-keep-talking"
                            >
                                {words.keepTalking} <span aria-hidden="true">→</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => void shareTake()}
                                className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-bold text-white transition-colors hover:border-primary-300"
                                data-testid="hero-share"
                            >
                                {copied ? words.copied : words.share}
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            <figcaption className="text-center text-[12px] leading-5 text-ink-400">
                {words.disclosure}{" "}
                <Link href={AI_SAFETY_HREF} className="underline underline-offset-2 hover:text-white">{words.safetyLink}</Link>
            </figcaption>
        </figure>
    );
}
