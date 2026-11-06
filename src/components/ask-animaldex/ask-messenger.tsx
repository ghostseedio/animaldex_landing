"use client";

/**
 * Speak to [Animal] as a messenger: the pieces the drawer builds the animal's
 * one-to-one thread from, as the apps have it since AnimalDex bdfaccde.
 *
 *   - the animal's card at the top of the thread, like a contact card at the
 *     top of a message thread: its icon art, its name, its traits, how many
 *     people have talked with it, its one Power line and on the owner's chat
 *     their bond; nothing more (UX pass JRN-31);
 *   - Messages bubbles, one per thought: a reply is split into paragraphs
 *     (`askReplyPieces`), each its own bubble, with the drawings it offers
 *     beside the bubbles rather than inside them, and the animal's face
 *     beside the last of them;
 *   - three typing dots in the animal's own bubble while it finds its first
 *     word, and a sparkle at the end of the words while it types;
 *   - a time between sittings, the animal's suggested replies docked above
 *     the composer, and Copy / Share / Ask again in a reply's menu.
 *
 * The animal's face is always its species icon art, never a capture photo
 * (owner, 2026-10-23). The site-wide assistant keeps the drawer's own layout.
 */

import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from "react";
import Image from "next/image";
import AssistantMarkdown, {AskInline, AskInlineSegmentView} from "@/components/ask-animaldex/assistant-markdown";
import {parseAskInline} from "@/lib/ask-animaldex/markdown";
import {askWordRanges} from "@/lib/ask-animaldex/spoken-words";
import {askPieceIsWide, askPlainBubbleText, askReplyPieces, type AskReplyPiece} from "@/lib/ask-animaldex/thread-layout";
import {ASK_REPORT_CHOICES, type AskReportChoice} from "@/lib/ask-animaldex/report";

/**
 * The app's Messages colours (`DirectMessageBubbleStyle`): the person's green,
 * the animal's dark, as theme tokens in globals.css.
 */
export const ASK_BUBBLE_OUTGOING = "var(--ask-bubble-out)";
export const ASK_BUBBLE_INCOMING = "var(--ask-bubble-in)";

// The bubble tokens (globals.css): the outer corners, and the grouped corner on the speaker's side.
const BIG = "var(--r-bubble)";
const SMALL = "var(--r-bubble-tight)";

/** Before the first paint in the browser; a plain effect on the server, where there is no paint. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A Messages bubble's corners: the speaker's side tightens where bubbles of one turn meet. */
function bubbleRadius(params: {fromAnimal: boolean; groupStart: boolean; groupEnd: boolean}): string {
    const top = params.groupStart ? BIG : SMALL;
    const bottom = params.groupEnd ? BIG : SMALL;
    // top-left top-right bottom-right bottom-left
    return params.fromAnimal ? `${top} ${BIG} ${BIG} ${bottom}` : `${BIG} ${top} ${bottom} ${BIG}`;
}

/**
 * The animal's face: its icon art in a circle, or its spark while it has none.
 * The circle is there at its size from the first paint; the art fades in over
 * it once it has loaded (no pop-in), and one already in the cache is simply
 * there. Reduced motion: no fade.
 */
export function AskAnimalFace({url, size, className = ""}: {url: string | null; size: number; className?: string}) {
    const [failed, setFailed] = useState(false);
    // Visible until proven otherwise: the first HTML carries the art, so it
    // must not be hidden before hydration. Before the first paint here, an
    // image still loading is hidden, then fades in when it lands.
    const [shown, setShown] = useState(true);
    const imageRef = useRef<HTMLImageElement | null>(null);
    useEffect(() => setFailed(false), [url]);
    useIsomorphicLayoutEffect(() => {
        const node = imageRef.current;
        setShown(!node || (node.complete && node.naturalWidth > 0));
    }, [url]);
    return (
        <span
            className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] ${className}`}
            style={{width: size, height: size}}
        >
            {url && !failed ? (
                <Image
                    ref={imageRef}
                    src={url}
                    unoptimized
                    alt=""
                    fill
                    sizes={`${size}px`}
                    className={`object-contain p-[8%] transition-opacity duration-[180ms] ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setShown(true)}
                    onError={() => setFailed(true)}
                />
            ) : (
                <svg viewBox="0 0 20 20" className="h-1/2 w-1/2 text-primary-200" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.4 8.6 10.8 4 9.4 8.6 8Z" />
                </svg>
            )}
        </span>
    );
}

/**
 * The contact card at the top of the conversation (polish pass, DESIGN.md
 * section 3): the art at 72 in a thin neon ring, the name on one line, its
 * Power on one line under it, the one positioning line, and on the owner's
 * chat the bond line. Nothing else above the first message; the count of
 * people who talked with it and "Name your…" live in the ••• menu and the
 * header. It is there before the hello, which follows as the first message.
 */
export function AskAnimalHero({
    name,
    subtitle,
    avatarUrl,
    bondLabel,
    onBond,
    differenceLine = null
}: {
    name: string;
    /** Its Power, on one line; else how it is. */
    subtitle: string | null;
    avatarUrl: string | null;
    /** "Level 4 · Working together" on the owner's chat. */
    bondLabel?: string | null;
    onBond?: () => void;
    /** "{name} answers from its own Power. Another animal may tell you the opposite." (SPEC section 3.3). */
    differenceLine?: string | null;
}) {
    const showsBond = Boolean(bondLabel && onBond);
    return (
        <div className="flex flex-col items-center px-6 pt-3 text-center" data-testid="contact-card">
            <div className="relative grid h-[72px] w-[72px] place-items-center">
                <span aria-hidden="true" className="ask-hero-glow absolute h-[88px] w-[88px] rounded-full bg-primary-400/[0.12] blur-xl" />
                <AskAnimalFace url={avatarUrl} size={72} className="ring-1 ring-primary-400/60" />
            </div>
            <h2 className="mt-2 max-w-full truncate font-display text-[17px] font-semibold leading-6 text-white">{name}</h2>
            {subtitle ? <p className="mt-0.5 max-w-full truncate text-[13px] leading-[18px] text-ink-300">{subtitle}</p> : null}
            {showsBond ? (
                <button
                    type="button"
                    onClick={onBond}
                    className="mt-1 inline-flex min-h-7 items-center gap-1.5 text-[13px] font-semibold text-primary-300 transition-colors hover:text-primary-200 active:opacity-70"
                >
                    <LinkIcon />
                    {bondLabel}
                </button>
            ) : null}
            {differenceLine ? (
                // A footnote (second pass, 2026-11-06, as iOS): small and quiet under the Power.
                <p className="mt-1.5 max-w-[22rem] text-[11px] leading-4 text-ink-400/80" data-testid="hero-difference">{differenceLine}</p>
            ) : null}
        </div>
    );
}

/** When a conversation was picked up again ("Yesterday 18:40"). */
export function AskTimeLabel({text}: {text: string}) {
    return (
        <p role="heading" aria-level={3} className="pb-3 pt-2 text-center text-[11px] font-semibold text-ink-400">
            {text}
        </p>
    );
}

/**
 * What the person said, on the right in their green. Their report on a step
 * ("I did it", docs/your-step/INLINE.md) carries a small "YOUR STEP" label
 * and the thumbnail of the photo or video they added.
 */
export function AskUserBubble({
    text,
    label,
    report = null
}: {
    text: string;
    label: string;
    report?: {label: string; thumbUrl: string | null; kind: "photo" | "video" | null} | null;
}) {
    const radius = bubbleRadius({fromAnimal: false, groupStart: true, groupEnd: true});
    // The far-side inset: on a phone the bubble never takes more than 82 % of the column.
    if (!report) {
        return (
            <div className="flex justify-end pl-[18%] sm:pl-11" aria-label={`${label} ${text}`}>
                <p
                    className="max-w-full whitespace-pre-wrap break-words px-3.5 py-2.5 text-[15px] leading-6 text-white"
                    style={{backgroundColor: ASK_BUBBLE_OUTGOING, borderRadius: radius}}
                >
                    {text}
                </p>
            </div>
        );
    }
    return (
        <div className="flex justify-end pl-[18%] sm:pl-11" aria-label={`${report.label}. ${text}`} data-testid="step-report-bubble">
            <div className="flex max-w-full flex-col gap-2 px-3.5 py-2.5" style={{backgroundColor: ASK_BUBBLE_OUTGOING, borderRadius: radius}}>
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase leading-4 tracking-[0.12em] text-primary-300">
                    <AskWalkIcon />
                    {report.label}
                </p>
                {report.thumbUrl ? (
                    <span className="relative block h-[132px] w-[180px] max-w-full overflow-hidden rounded-panel bg-black/20">
                        {/* A small data URL drawn in the browser: nothing for the image optimiser to do. */}
                        <Image src={report.thumbUrl} alt="" fill sizes="180px" unoptimized className="object-cover" />
                        {report.kind === "video" ? (
                            <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white">
                                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor"><path d="M3 6.2A1.7 1.7 0 0 1 4.7 4.5h6.6A1.7 1.7 0 0 1 13 6.2v7.6a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 13.8Zm11 2.1 3-2v7.4l-3-2Z" /></svg>
                            </span>
                        ) : null}
                    </span>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-white">{text}</p>
            </div>
        </div>
    );
}

/** The step's walking figure: on "YOUR STEP", the report strip and the person's report. */
export function AskWalkIcon({className = "h-3.5 w-3.5"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="3.6" r="1.6" fill="currentColor" stroke="none" />
            <path d="M9.6 7.2 7.4 11.6l3 1.6.8 4.6M9.6 7.2l2.6 1 1.5 2.6 2.4.6M7.4 11.6 5.6 17.2M9.6 7.2 6.6 8.6 5.4 11" />
        </svg>
    );
}

/** The animal is typing: three soft dots in its own bubble, beside its face. */
export function AskTypingBubble({avatarUrl, label, plain = false}: {avatarUrl: string | null; label: string; plain?: boolean}) {
    return (
        <div className="flex items-end gap-2" role="status" aria-label={label}>
            {plain ? null : <AskAnimalFace url={avatarUrl} size={28} />}
            {/* Exactly a one-line bubble's height (10 + 24 + 10), so the first words replace the dots without moving the thread. */}
            <span
                className="flex h-[44px] w-[58px] items-center justify-center gap-[5px]"
                style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: bubbleRadius({fromAnimal: true, groupStart: true, groupEnd: true})}}
                aria-hidden="true"
            >
                {[0, 1, 2].map((dot) => (
                    <span key={dot} className="ask-typing-dot h-[7px] w-[7px] rounded-full bg-white/75" style={{animationDelay: `${dot * 150}ms`}} />
                ))}
            </span>
        </div>
    );
}

/** The twinkle at the end of a reply the animal is still typing. */
export function AskSparkle() {
    return (
        <svg viewBox="0 0 16 16" className="ask-sparkle ml-[3px] inline-block h-[13px] w-[13px] align-[-1px]" fill="currentColor" aria-hidden="true">
            <path d="M8 0.8c.5 3.6 2.1 5.9 6.9 7.2-4.8 1.3-6.4 3.6-6.9 7.2C7.5 11.6 5.9 9.3 1.1 8 5.9 6.7 7.5 4.4 8 .8Z" />
        </svg>
    );
}

export type AskPlainBubbleProps = {
    /** The bubble's text, a paragraph of prose. */
    text: string;
    sparkle: boolean;
};

/**
 * One paragraph in a bubble that hugs its words. Rendered by the drawer's
 * `renderPlain` when it wants to light words (the spoken voice); this is the
 * plain reading.
 */
export function AskPlainBubbleText({text, sparkle}: AskPlainBubbleProps) {
    return (
        <>
            <AskInline text={askPlainBubbleText(text)} />
            {sparkle ? <AskSparkle /> : null}
        </>
    );
}

/**
 * A plain bubble with the word the animal's voice is saying lit: brighter and
 * softly backed, a change of colour only, so the lines never reflow as the
 * voice moves on (iOS `AnimalChatSpokenWords.highlighting`). `word` counts
 * this bubble's own words; out of range, nothing is lit.
 */
export function AskLitPlainText({text, sparkle, word}: AskPlainBubbleProps & {word: number}) {
    const segments = parseAskInline(askPlainBubbleText(text));
    const plain = segments.map((segment) => segment.text).join("");
    const lit = askWordRanges(plain)[word];
    if (!lit) return <AskPlainBubbleText text={text} sparkle={sparkle} />;
    let offset = 0;
    return (
        <>
            {segments.map((segment, index) => {
                const from = offset;
                offset += segment.text.length;
                const start = Math.max(lit[0], from);
                const end = Math.min(lit[1], offset);
                if (start >= end) return <AskInlineSegmentView key={index} segment={segment} />;
                const parts = [
                    segment.text.slice(0, start - from),
                    segment.text.slice(start - from, end - from),
                    segment.text.slice(end - from)
                ];
                return (
                    <span key={index}>
                        {parts[0] ? <AskInlineSegmentView segment={{...segment, text: parts[0]}} /> : null}
                        <span className="bg-primary-400/[0.16] text-primary-300">
                            <AskInlineSegmentView segment={{...segment, text: parts[1]}} />
                        </span>
                        {parts[2] ? <AskInlineSegmentView segment={{...segment, text: parts[2]}} /> : null}
                    </span>
                );
            })}
            {sparkle ? <AskSparkle /> : null}
        </>
    );
}

/**
 * The animal's reply: one bubble per thought, typed out at its pace while it
 * is the newest, with any drawing set beside the bubbles. A click while it
 * types shows the rest at once.
 */
export function AskReplyBubbles({
    text,
    isLive,
    avatarUrl,
    speakerName,
    photoUrl,
    photoAlt,
    onSkip,
    renderPlain,
    trailing,
    after,
    special = null,
    plain = false
}: {
    /** What is on screen of the reply (the pacer's text while it types). */
    text: string;
    /**
     * The animal's words across the thread with nothing around them and no
     * face beside them (the owner, 2026-11-06, after the Claude app); its
     * controls a quiet row under the words. Special messages keep their card.
     */
    plain?: boolean;
    /** Still arriving or still typing: a sparkle at the end, no menu yet. */
    isLive: boolean;
    avatarUrl: string | null;
    speakerName: string;
    photoUrl: string | null;
    photoAlt: string;
    onSkip?: () => void;
    /**
     * How a plain bubble's words are drawn; `AskPlainBubbleText` when absent.
     * `index` counts plain bubbles, `pieceIndex` every piece of the reply.
     */
    renderPlain?: (bubble: AskPlainBubbleProps & {index: number; pieceIndex: number}) => ReactNode;
    /** Beside the last bubble of a finished reply: its voice, its menu. */
    trailing?: ReactNode;
    /** Under the bubbles: a check-in, a referral. */
    after?: ReactNode;
    /**
     * What this reply carries to do (docs/your-step/INLINE.md): drawn inside
     * its last bubble, which becomes a special message (neon edge, faint
     * wash, its own label), never as a card under it. Once it is all shown.
     */
    special?: ReactNode;
}) {
    const pieces = askReplyPieces(text, !isLive);
    if (pieces.length === 0) return <AskTypingBubble plain={plain} avatarUrl={avatarUrl} label={speakerName} />;
    const lastBubble = lastBubbleIndex(pieces);
    const specialHere = special && !isLive ? special : null;
    let plainIndex = -1;
    return (
        <div className="flex flex-col">
            <div
                className={`flex items-end gap-2 ${plain ? "" : "pr-2"} ${isLive ? "cursor-text" : ""}`}
                onClick={isLive ? onSkip : undefined}
            >
                {plain ? null : <AskAnimalFace url={avatarUrl} size={28} />}
                {/* 4 between the pieces of one reply (DESIGN.md section 3). */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {pieces.map((piece, index) => {
                        if (piece.kind === "visual") {
                            return (
                                <div key={`v-${index}`} className={`py-1 ${plain ? "" : "pr-9"}`}>
                                    <AssistantMarkdown compact text={piece.source} photoUrl={photoUrl} photoAlt={photoAlt} streaming={isLive} />
                                </div>
                            );
                        }
                        if (piece.isPlain) plainIndex += 1;
                        const radius = bubbleRadius({fromAnimal: true, groupStart: index === 0, groupEnd: index === pieces.length - 1});
                        const sparkle = isLive && index === pieces.length - 1;
                        const carries = specialHere !== null && index === lastBubble;
                        // A table or a diagram panel: the bubble takes the whole reply column,
                        // its controls under it (docs/rich-chat/SPEC.md, section 1.4).
                        const wide = askPieceIsWide(piece);
                        const bubble = (
                            <div
                                // 10 × 14 of padding on every bubble; the special one keeps 14 past its 3 px neon edge.
                                className={`min-w-0 max-w-full break-words py-2.5 text-[15px] leading-6 text-white ${carries ? "ask-special w-full pl-[17px] pr-3.5" : plain ? "w-full px-0 py-1.5" : wide ? "w-full px-3.5" : "px-3.5"}`}
                                style={plain && !carries ? undefined : {backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: radius}}
                                data-testid={carries ? "special-message" : undefined}
                            >
                                {piece.isPlain
                                    ? (renderPlain
                                        ? renderPlain({text: piece.text, sparkle, index: plainIndex, pieceIndex: index})
                                        : <AskPlainBubbleText text={piece.text} sparkle={sparkle} />)
                                    : (
                                        <>
                                            <AssistantMarkdown compact text={piece.text} photoUrl={photoUrl} photoAlt={photoAlt} />
                                            {sparkle ? <AskSparkle /> : null}
                                        </>
                                    )}
                                {carries ? <AskSpecialSections>{specialHere}</AskSpecialSections> : null}
                            </div>
                        );
                        if (wide) {
                            return (
                                <div key={`b-${index}`} className="flex min-w-0 flex-col" data-testid="wide-bubble">
                                    {bubble}
                                    {!isLive && index === lastBubble && trailing ? (
                                        <div className="flex items-center justify-start gap-0.5 pt-1 sm:justify-end">{trailing}</div>
                                    ) : null}
                                </div>
                            );
                        }
                        return (
                            <div key={`b-${index}`} className="flex items-end">
                                <div className={`flex min-w-0 flex-col items-start ${carries ? "flex-1" : ""}`}>{bubble}</div>
                                {/* From 640 px, room beside every bubble for the reply's controls (its
                                    voice, its menu), so their far edges line up. On a phone the
                                    bubbles take the whole width beside the face, the controls under
                                    the reply (UX pass WEB-27). */}
                                {plain ? null : (
                                    <div className="hidden w-[60px] shrink-0 items-center justify-start gap-0.5 pl-1 sm:flex">
                                        {!isLive && index === lastBubble ? trailing : null}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {specialHere !== null && lastBubble < 0 ? (
                        // Only drawings in the reply: what it carries is a special message of its own.
                        <div className="flex flex-col">
                            <div className="flex items-end">
                                <div className="flex min-w-0 flex-1 flex-col items-start">
                                    <AskSpecialShell>{specialHere}</AskSpecialShell>
                                </div>
                                <div className="hidden w-[60px] shrink-0 items-center justify-start gap-0.5 pl-1 sm:flex">{trailing}</div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            {/* A phone's controls: under the reply, beside nothing, so the face stays by the last bubble. */}
            {!isLive && trailing && (plain || (lastBubble >= 0 ? !askPieceIsWide(pieces[lastBubble]) : specialHere !== null)) ? (
                <div className={`flex items-center gap-0.5 pt-1 ${plain ? "" : "pl-9 sm:hidden"}`} data-testid="reply-controls-under">{trailing}</div>
            ) : null}
            {after ? <div className={plain ? "pt-2.5" : "pl-9 pt-2.5"}>{after}</div> : null}
        </div>
    );
}

/** The special part of a bubble: after the animal's words, set apart by a neon hairline, one section after another. */
function AskSpecialSections({children}: {children: ReactNode}) {
    return <div className="ask-special-sections mt-[11px] flex flex-col pt-[11px]">{children}</div>;
}

/** A special message's bubble on its own: the neon edge, the wash, and what it carries. */
export function AskSpecialShell({children, testId = "special-message"}: {children: ReactNode; testId?: string}) {
    return (
        <div
            className="ask-special flex w-full min-w-0 flex-col gap-2.5 break-words py-2.5 pl-[17px] pr-3.5 text-[15px] leading-6 text-white"
            style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: bubbleRadius({fromAnimal: true, groupStart: true, groupEnd: true})}}
            data-testid={testId}
        >
            {children}
        </div>
    );
}

/**
 * A special message that is not a reply: the animal's face beside one
 * special bubble (a Warmup question, docs/your-step/INLINE.md), with room
 * beside it where a reply's controls sit, so the edges line up.
 */
export function AskSpecialBubble({avatarUrl, showsFace = true, children, testId}: {
    avatarUrl: string | null;
    /** False while the next message is the animal's too (the next Warmup question): its face sits by the newest only. */
    showsFace?: boolean;
    children: ReactNode;
    testId?: string;
}) {
    return (
        <div className="flex items-end gap-2 pr-2">
            {showsFace ? <AskAnimalFace url={avatarUrl} size={28} /> : <span aria-hidden="true" className="w-7 shrink-0" />}
            <div className="flex min-w-0 flex-1 items-end">
                <div className="flex min-w-0 flex-1 flex-col items-start">
                    <AskSpecialShell testId={testId}>{children}</AskSpecialShell>
                </div>
                <div className="hidden w-[60px] shrink-0 sm:block" />
            </div>
        </div>
    );
}

/**
 * A special message's label: "YOUR STEP", "DONE TOGETHER · +5 XP", "WARMUP ·
 * 1 OF 2", in small capitals with its icon, UI rather than the animal
 * speaking; `trailing` is a word after it in its own colour ("Easy").
 */
export function AskSpecialLabel({icon, children, trailing = null}: {
    icon: ReactNode;
    children: ReactNode;
    trailing?: {text: string; color: string} | null;
}) {
    return (
        <p role="heading" aria-level={3} className="flex items-center gap-1.5 text-[11px] font-black uppercase leading-4 tracking-[0.12em] text-primary-300">
            {icon}
            <span className="min-w-0">{children}</span>
            {trailing ? <span className="shrink-0 font-bold normal-case tracking-normal" style={{color: trailing.color}}>{trailing.text}</span> : null}
        </p>
    );
}

function lastBubbleIndex(pieces: AskReplyPiece[]): number {
    for (let index = pieces.length - 1; index >= 0; index -= 1) {
        if (pieces[index].kind === "bubble") return index;
    }
    return -1;
}

/**
 * The animal's suggested replies, just above the composer, the way a
 * messenger offers smart replies. Written as the person, so a click sends one
 * as their own message.
 */
export function AskSuggestionBar({
    suggestions,
    onPick,
    disabled,
    sayLabel
}: {
    suggestions: string[];
    onPick: (prompt: string) => void;
    disabled?: boolean;
    /** "Say: {text}", for screen readers. */
    sayLabel: string;
}) {
    if (suggestions.length === 0) return null;
    return (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {suggestions.map((prompt) => (
                <button
                    key={prompt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(prompt)}
                    aria-label={sayLabel.replace("{text}", prompt)}
                    className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold leading-4 text-white transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-40"
                    style={{borderColor: ASK_BUBBLE_OUTGOING, backgroundColor: "var(--ask-bubble-out-soft)"}}
                >
                    {prompt}
                </button>
            ))}
        </div>
    );
}

/**
 * "Report this reply": the three reasons and Cancel, over the bottom of the
 * drawer as an edge-to-edge band. It stays up while it sends, then thanks
 * them, or says it failed with the choices still there. Shared by the
 * one-to-one chat and the group (Android 8649e5a: every animal reply).
 */
export type AskReportLabels = {
    /** The menu item that opens it. */
    report: string;
    title: string;
    offensive: string;
    inaccurate: string;
    other: string;
    thanks: string;
    failed: string;
    sending: string;
    done: string;
    cancel: string;
};

export function AskReportSheet({
    labels,
    state,
    onChoose,
    onClose
}: {
    labels: AskReportLabels;
    state: "idle" | "sending" | "sent" | "failed";
    onChoose: (choice: AskReportChoice) => void;
    onClose: () => void;
}) {
    const titles: Record<AskReportChoice, string> = {
        "Offensive or harmful": labels.offensive,
        "Inaccurate or misleading": labels.inaccurate,
        "Something else": labels.other
    };
    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-canvas-950/70" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={labels.title}
                className="border-t border-white/12 bg-canvas-900 pb-4"
                onClick={(event) => event.stopPropagation()}
            >
                <p className="px-4 pb-2 pt-4 text-sm font-semibold text-white">{labels.title}</p>
                {state === "sent" ? (
                    <div className="px-4 pb-1">
                        <p className="text-sm leading-6 text-ink-200">{labels.thanks}</p>
                        <button type="button" onClick={onClose} className="mt-3 rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950">
                            {labels.done}
                        </button>
                    </div>
                ) : (
                    <>
                        {state === "failed" ? <p className="px-4 pb-2 text-xs text-ink-300">{labels.failed}</p> : null}
                        {state === "sending" ? <p className="px-4 pb-2 text-xs text-ink-300">{labels.sending}</p> : null}
                        {ASK_REPORT_CHOICES.map((choice) => (
                            <button
                                key={choice}
                                type="button"
                                disabled={state === "sending"}
                                onClick={() => onChoose(choice)}
                                className="block w-full border-t border-white/[0.06] px-4 py-3 text-left text-sm text-white transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                            >
                                {titles[choice]}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={onClose}
                            className="block w-full border-t border-white/[0.06] px-4 py-3 text-left text-sm font-semibold text-ink-300 transition-colors hover:bg-white/[0.05]"
                        >
                            {labels.cancel}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export type AskMenuItem = {
    label: string;
    /** A second, quieter line ("3 left today"). */
    detail?: string | null;
    icon?: ReactNode;
    onSelect: () => void;
    disabled?: boolean;
    /** A toggle shows its state. */
    checked?: boolean;
    /** A page of its own inside the menu (the chat's Settings): the menu stays open and shows these, with a way back. */
    submenu?: AskMenuItem[];
};

/**
 * A small menu: a reply's (Copy, Share, Ask again…) or the chat's own. Opens
 * on click, closes on a choice, a click outside or Escape. A choice that
 * opens something else runs once the menu has closed.
 */
export function AskMenu({
    label,
    items,
    align = "right",
    buttonClassName,
    children
}: {
    label: string;
    items: AskMenuItem[];
    align?: "left" | "right";
    buttonClassName?: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    // The submenu on show, if any (design pass, 2026-11-06).
    const [submenu, setSubmenu] = useState<AskMenuItem | null>(null);
    // Low in the panel, the menu opens upwards, so the thread's edge never cuts it off.
    const [upwards, setUpwards] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!open) setSubmenu(null);
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
            }
        };
        window.addEventListener("pointerdown", onPointer);
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("pointerdown", onPointer);
            window.removeEventListener("keydown", onKey, true);
        };
    }, [open]);
    const visible = items.filter(Boolean);
    if (visible.length === 0) return null;
    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    const rect = rootRef.current?.getBoundingClientRect();
                    setUpwards(Boolean(rect && rect.bottom > window.innerHeight * 0.55));
                    setOpen((current) => !current);
                }}
                className={buttonClassName ?? "grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"}
            >
                {children}
            </button>
            {open ? (
                <div
                    role="menu"
                    className={`absolute z-10 min-w-[15rem] border border-white/12 bg-canvas-900 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${align === "right" ? "right-0" : "left-0"} ${upwards ? "bottom-full mb-1" : "top-full mt-1"}`}
                >
                    {submenu ? (
                        // The way back to the top of the menu.
                        <button
                            type="button"
                            role="menuitem"
                            onClick={(event) => {
                                event.stopPropagation();
                                setSubmenu(null);
                            }}
                            className="flex w-full items-center gap-2.5 border-b border-white/[0.08] px-3.5 py-2 text-left text-[13px] font-semibold text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                            <span aria-hidden="true" className="shrink-0">‹</span>
                            <span className="min-w-0 flex-1">{submenu.label}</span>
                        </button>
                    ) : null}
                    {(submenu ? submenu.submenu ?? [] : visible).filter(Boolean).map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                            aria-checked={item.checked}
                            aria-haspopup={item.submenu ? "menu" : undefined}
                            disabled={item.disabled}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (item.submenu) {
                                    // The menu stays open: its page takes the list's place.
                                    setSubmenu(item);
                                    return;
                                }
                                setOpen(false);
                                // Whatever it opens, it opens once this menu has gone.
                                setTimeout(item.onSelect, 0);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-ink-100 transition-colors hover:bg-white/[0.06] hover:text-white active:bg-white/10 disabled:opacity-40"
                        >
                            {item.icon ? <span className="shrink-0 text-ink-300">{item.icon}</span> : null}
                            <span className="min-w-0 flex-1">
                                <span className="block">{item.label}</span>
                                {item.detail ? <span className="block text-[11px] text-ink-400">{item.detail}</span> : null}
                            </span>
                            {item.submenu ? <span aria-hidden="true" className="shrink-0 text-ink-400">›</span> : null}
                            {item.checked === undefined ? null : (
                                <span
                                    aria-hidden="true"
                                    className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${item.checked ? "bg-primary-400" : "bg-white/15"}`}
                                >
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${item.checked ? "left-3.5" : "left-0.5"}`} />
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function icon(path: ReactNode) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

export const MoreIcon = () => (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <circle cx="4.5" cy="10" r="1.6" />
        <circle cx="10" cy="10" r="1.6" />
        <circle cx="15.5" cy="10" r="1.6" />
    </svg>
);
const LinkIcon = () => icon(<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-1 1m1.7 3.5a3 3 0 0 0-4.2 0L5 11.8A3 3 0 0 0 9.2 16l1-1" />);
