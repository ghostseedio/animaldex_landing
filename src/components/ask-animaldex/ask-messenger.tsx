"use client";

/**
 * Speak to [Animal] as a messenger: the pieces the drawer builds the animal's
 * one-to-one thread from, as the apps have it since AnimalDex bdfaccde.
 *
 *   - the animal's card at the top of the thread, like a contact card at the
 *     top of a message thread: its icon art, its name, its temperament, how
 *     many people have talked to it, and on the owner's chat their bond;
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

import {useEffect, useRef, useState, type ReactNode} from "react";
import Image from "next/image";
import AssistantMarkdown, {AskInline} from "@/components/ask-animaldex/assistant-markdown";
import {askPlainBubbleText, askReplyPieces, type AskReplyPiece} from "@/lib/ask-animaldex/thread-layout";

/**
 * The app's Messages colours (`DirectMessageBubbleStyle`): the person's green,
 * the animal's dark, as theme tokens in globals.css.
 */
export const ASK_BUBBLE_OUTGOING = "var(--ask-bubble-out)";
export const ASK_BUBBLE_INCOMING = "var(--ask-bubble-in)";

const BIG = "19px";
const SMALL = "6px";

/** A Messages bubble's corners: the speaker's side tightens where bubbles of one turn meet. */
function bubbleRadius(params: {fromAnimal: boolean; groupStart: boolean; groupEnd: boolean}): string {
    const top = params.groupStart ? BIG : SMALL;
    const bottom = params.groupEnd ? BIG : SMALL;
    // top-left top-right bottom-right bottom-left
    return params.fromAnimal ? `${top} ${BIG} ${BIG} ${bottom}` : `${BIG} ${top} ${bottom} ${BIG}`;
}

/** The animal's face: its icon art in a circle, or its spark while it has none. */
export function AskAnimalFace({url, size, className = ""}: {url: string | null; size: number; className?: string}) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [url]);
    return (
        <span
            className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] ${className}`}
            style={{width: size, height: size}}
        >
            {url && !failed ? (
                <Image src={url} unoptimized alt="" fill sizes={`${size}px`} className="object-contain p-[8%]" onError={() => setFailed(true)} />
            ) : (
                <svg viewBox="0 0 20 20" className="h-1/2 w-1/2 text-primary-200" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.4 8.6 10.8 4 9.4 8.6 8Z" />
                </svg>
            )}
        </span>
    );
}

/**
 * The top of the conversation: the animal, its name and how it is, and the
 * owner's bond to open. It is there before the hello, which follows as the
 * first message.
 */
export function AskAnimalHero({
    name,
    subtitle,
    avatarUrl,
    popularity,
    bondLabel,
    onBond
}: {
    name: string;
    subtitle: string | null;
    avatarUrl: string | null;
    /** "1,240 people have talked to me", once enough have. */
    popularity: string | null;
    /** "Level 4 · Working together" on the owner's chat. */
    bondLabel?: string | null;
    onBond?: () => void;
}) {
    return (
        <div className="flex flex-col items-center px-6 pt-5 text-center">
            <div className="relative grid h-28 w-28 place-items-center">
                <span aria-hidden="true" className="ask-hero-glow absolute h-[124px] w-[124px] rounded-full bg-primary-400/[0.12] blur-xl" />
                <AskAnimalFace url={avatarUrl} size={96} className="ring-[1.5px] ring-primary-400/40" />
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold leading-8 text-white">{name}</h2>
            {subtitle ? <p className="mt-1 text-sm leading-6 text-ink-300">{subtitle}</p> : null}
            {popularity ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400">
                    <BubblesIcon />
                    {popularity}
                </p>
            ) : null}
            {bondLabel && onBond ? (
                <button
                    type="button"
                    onClick={onBond}
                    className="mt-2.5 inline-flex items-center gap-1.5 py-1.5 text-xs font-semibold text-primary-300 transition-colors hover:text-primary-200"
                >
                    <LinkIcon />
                    {bondLabel}
                </button>
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

/** What the person said, on the right in their green. */
export function AskUserBubble({text, label}: {text: string; label: string}) {
    return (
        <div className="flex justify-end pl-11" aria-label={`${label} ${text}`}>
            <p
                className="max-w-full whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-6 text-white"
                style={{backgroundColor: ASK_BUBBLE_OUTGOING, borderRadius: bubbleRadius({fromAnimal: false, groupStart: true, groupEnd: true})}}
            >
                {text}
            </p>
        </div>
    );
}

/** The animal is typing: three soft dots in its own bubble, beside its face. */
export function AskTypingBubble({avatarUrl, label}: {avatarUrl: string | null; label: string}) {
    return (
        <div className="flex items-end gap-2" role="status" aria-label={label}>
            <AskAnimalFace url={avatarUrl} size={28} />
            <span
                className="flex h-[38px] w-[58px] items-center justify-center gap-[5px]"
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
    after
}: {
    /** What is on screen of the reply (the pacer's text while it types). */
    text: string;
    /** Still arriving or still typing: a sparkle at the end, no menu yet. */
    isLive: boolean;
    avatarUrl: string | null;
    speakerName: string;
    photoUrl: string | null;
    photoAlt: string;
    onSkip?: () => void;
    /** How a plain bubble's words are drawn; `AskPlainBubbleText` when absent. */
    renderPlain?: (bubble: AskPlainBubbleProps & {index: number}) => ReactNode;
    /** Beside the last bubble of a finished reply: its voice, its menu. */
    trailing?: ReactNode;
    /** Under the bubbles: a check-in, a step done together, a referral. */
    after?: ReactNode;
}) {
    const pieces = askReplyPieces(text, !isLive);
    if (pieces.length === 0) return <AskTypingBubble avatarUrl={avatarUrl} label={speakerName} />;
    const lastBubble = lastBubbleIndex(pieces);
    let plainIndex = -1;
    return (
        <div className="flex flex-col">
            <div
                className={`flex items-end gap-2 pr-2 ${isLive ? "cursor-text" : ""}`}
                onClick={isLive ? onSkip : undefined}
            >
                <AskAnimalFace url={avatarUrl} size={28} />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    {pieces.map((piece, index) => {
                        if (piece.kind === "visual") {
                            return (
                                <div key={`v-${index}`} className="py-[5px] pr-9">
                                    <AssistantMarkdown compact text={piece.source} photoUrl={photoUrl} photoAlt={photoAlt} streaming={isLive} />
                                </div>
                            );
                        }
                        if (piece.isPlain) plainIndex += 1;
                        const radius = bubbleRadius({fromAnimal: true, groupStart: index === 0, groupEnd: index === pieces.length - 1});
                        const sparkle = isLive && index === pieces.length - 1;
                        const bubble = (
                            <div
                                className="min-w-0 max-w-full break-words px-3.5 py-2 text-[15px] leading-6 text-white"
                                style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: radius}}
                            >
                                {piece.isPlain
                                    ? (renderPlain
                                        ? renderPlain({text: piece.text, sparkle, index: plainIndex})
                                        : <AskPlainBubbleText text={piece.text} sparkle={sparkle} />)
                                    : (
                                        <>
                                            <AssistantMarkdown compact text={piece.text} photoUrl={photoUrl} photoAlt={photoAlt} />
                                            {sparkle ? <AskSparkle /> : null}
                                        </>
                                    )}
                            </div>
                        );
                        return (
                            <div key={`b-${index}`} className="flex items-end">
                                <div className="flex min-w-0 flex-col items-start">{bubble}</div>
                                {/* Room beside every bubble for the reply's controls, so their far edges line up. */}
                                <div className="flex w-9 shrink-0 justify-center">
                                    {!isLive && index === lastBubble ? trailing : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {after ? <div className="pl-9 pt-2.5">{after}</div> : null}
        </div>
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
                    className="shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{borderColor: ASK_BUBBLE_OUTGOING, backgroundColor: "var(--ask-bubble-out-soft)"}}
                >
                    {prompt}
                </button>
            ))}
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
    const rootRef = useRef<HTMLDivElement | null>(null);
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
                    setOpen((current) => !current);
                }}
                className={buttonClassName ?? "grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/8 hover:text-white"}
            >
                {children}
            </button>
            {open ? (
                <div
                    role="menu"
                    className={`absolute z-10 mt-1 min-w-[12.5rem] border border-white/12 bg-canvas-900 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${align === "right" ? "right-0" : "left-0"}`}
                >
                    {visible.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                            aria-checked={item.checked}
                            disabled={item.disabled}
                            onClick={(event) => {
                                event.stopPropagation();
                                setOpen(false);
                                // Whatever it opens, it opens once this menu has gone.
                                setTimeout(item.onSelect, 0);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-ink-100 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                        >
                            {item.icon ? <span className="shrink-0 text-ink-300">{item.icon}</span> : null}
                            <span className="min-w-0 flex-1">
                                <span className="block">{item.label}</span>
                                {item.detail ? <span className="block text-[11px] text-ink-400">{item.detail}</span> : null}
                            </span>
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
const BubblesIcon = () => icon(<path d="M3.5 12.5V5.8A1.8 1.8 0 0 1 5.3 4h6.4a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H6Zm10-3h1.2a1.8 1.8 0 0 1 1.8 1.8V16l-2.5-2H9.3a1.8 1.8 0 0 1-1.8-1.8V11" />);
const LinkIcon = () => icon(<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-1 1m1.7 3.5a3 3 0 0 0-4.2 0L5 11.8A3 3 0 0 0 9.2 16l1-1" />);
