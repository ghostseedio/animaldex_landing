"use client";

/**
 * One Companions row (polish pass, DESIGN.md section 1): the animal as its
 * icon art at 48 in a circle, a neon ring only when something needs you; the
 * name (bold while unread); exactly one line under it; on the right the time
 * and the unread dot. A link to its chat on the tab's roster, or, in the
 * switcher of the tab's chat (the owner, 2026-11-06), a button that puts that
 * animal's conversation in the tab, the open one marked with a neon edge.
 */

import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace, AskWalkIcon} from "@/components/ask-animaldex/ask-messenger";
import {talkRelativeTime} from "@/lib/ask-animaldex/talk";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {rosterNeed, type rosterLine} from "@/lib/companion-roster";
import type {CompanionTabRow} from "@/lib/companion-rows";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

export const NEON = "#A7F432";

/** "yesterday", in the reader's language, from the browser (the roster has no words of its own for it). */
export function yesterdayWord(locale: string): string {
    try {
        return new Intl.RelativeTimeFormat(locale, {numeric: "auto"}).format(-1, "day");
    } catch {
        return "";
    }
}

/**
 * One row, 64 tall, 16 inset: the art, then the text column with the
 * hairline under it (the separator starts at the text, never under the art).
 */
export function CompanionRow({row, href, line, time, locale, words, onSelect, isCurrent = false}: {
    row: CompanionTabRow;
    href: string | null;
    line: ReturnType<typeof rosterLine>;
    time: number | null;
    locale: string;
    words: CompanionWords;
    /** In the switcher: a tap puts this animal's chat in the tab. */
    onSelect?: () => void;
    /** The animal whose chat is open: chrome under it, a neon edge. */
    isCurrent?: boolean;
}) {
    const unread = row.unreadCount > 0;
    const needsYou = rosterNeed(row) !== null;
    const body = (
        <>
            <AskAnimalFace url={row.slug ? getSpeciesImageRoute(row.slug) : null} size={48} className={needsYou ? "ring-2 ring-primary-400/80" : ""} />
            <span className="flex h-full min-w-0 flex-1 items-center gap-3 border-b border-white/[0.08] pr-4">
                <span className="min-w-0 flex-1">
                    {/* The time sits on the name's baseline (baselines aligned across a row, DESIGN.md section 4). */}
                    <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[17px] leading-6 text-white ${unread ? "font-bold" : "font-semibold"}`}>{row.displayName}</span>
                        {time !== null ? (
                            <span className="shrink-0 text-[11px] leading-4 text-white/40">{talkRelativeTime(time, {locale, yesterday: yesterdayWord(locale)})}</span>
                        ) : null}
                    </span>
                    <span
                        className={`mt-0.5 flex items-center gap-1 text-[13px] leading-[18px] ${
                            line.neon ? "font-semibold text-primary-300" : line.kind === "power" || line.kind === "hello" ? "text-white/40" : unread ? "text-white/85" : "text-white/60"
                        }`}
                        data-testid={`companion-line-${line.kind}`}
                    >
                        {line.kind === "step" ? <AskWalkIcon className="h-3.5 w-3.5" /> : null}
                        <span className="min-w-0 truncate">{line.text}</span>
                    </span>
                    {/* What the dot and the ring say, for a screen reader. */}
                    <span className="sr-only">
                        {unread ? `, ${fillWords(words.tab.unread, {n: row.unreadCount})}` : ""}
                        {row.muted ? `, ${words.tab.muted}` : ""}
                    </span>
                </span>
                {unread ? (
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: row.muted ? "rgb(255 255 255 / 0.35)" : NEON}} />
                ) : null}
            </span>
        </>
    );
    // Hover is a wash, no scale (DESIGN.md section 1); a press darkens it a step.
    // 72 tall, as the app's rows (design pass, 2026-11-06).
    const className = "flex h-[72px] items-center gap-3 pl-4 transition-colors duration-150 ease-spring hover:bg-white/[0.04] active:bg-white/[0.07] md:pl-5";
    if (onSelect) {
        return (
            <button
                type="button"
                onClick={onSelect}
                aria-current={isCurrent ? "true" : undefined}
                className={`${className} relative w-full text-left ${isCurrent ? "bg-[#12351C]" : ""}`}
                data-testid="companion-row"
            >
                {isCurrent ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{backgroundColor: NEON}} /> : null}
                {body}
            </button>
        );
    }
    return href
        ? <Link href={href} className={className} data-testid="companion-row">{body}</Link>
        : <div className={className} data-testid="companion-row">{body}</div>;
}

