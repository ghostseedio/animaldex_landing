"use client";

/**
 * Companions, the first tab (docs/companion-loop/SPEC.md, phase 4; iOS
 * `CompanionsTabView`): a messaging roster of every animal you hold (polish
 * pass, DESIGN.md section 1). Sorted by what needs you (an unread message,
 * an open step, a referral), then every animal with a conversation, newest
 * message first, then the animals never talked to in the server's order
 * (`companion-roster.ts`, pure and tested).
 *
 * One row, one look: the animal as its icon art at 48 in a circle, a neon
 * ring only when something needs you; the name (bold while unread); exactly
 * one line under it: the animal's last words, the open step with the step
 * glyph in neon, the referral, the newest message's words (yours or its), or
 * its Power; on the right the time of the conversation and the unread dot.
 * No stage words, no "Working on:", no level, no menu (muting is in the
 * chat's ••• menu), no "Your steps" band: a step lives on its animal's row and
 * inside its chat.
 *
 * Tapping a row opens that animal's chat on the card you last talked through
 * in this browser, else its newest (iOS 5c980123). Before the server has the
 * bond, the animals you hold still show, without it. Refreshed when the tab
 * is opened and when the window comes back into view.
 *
 * Signed out, the tab says what to do instead of showing nothing (newcomer
 * UX vet, 2026-10-30, P1-10): sign in, or talk to an animal right now.
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {AskAnimalFace, AskWalkIcon} from "@/components/ask-animaldex/ask-messenger";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {useTalkThreads} from "@/components/ask-animaldex/use-talk-threads";
import {useAnimalConversations} from "@/components/companions/use-animal-conversations";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {useOpenStepUpdates} from "@/components/companions/use-steps";
import {askThreadKey} from "@/lib/ask-animaldex/thread";
import {talkRelativeTime} from "@/lib/ask-animaldex/talk";
import {companionRowHref, fillWords, type CompanionWords} from "@/lib/companion-bond";
import {rosterLastAt, rosterLine, rosterNeed, sortCompanionRoster, type RosterLocalLast} from "@/lib/companion-roster";
import {animalMessagePreviewText, buildCompanionRows, type CompanionTabRow} from "@/lib/companion-rows";
import type {CompanionCard} from "@/lib/companion-cards";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {TRY_TALKING_HREF} from "@/lib/try-talking";
import type {AnimalStep} from "@/lib/your-step";

const NEON = "#A7F432";

/** "yesterday", in the reader's language, from the browser (the roster has no words of its own for it). */
function yesterdayWord(locale: string): string {
    try {
        return new Intl.RelativeTimeFormat(locale, {numeric: "auto"}).format(-1, "day");
    } catch {
        return "";
    }
}

/** The page's title: display 24/28, nothing above it. */
function Title({children}: {children: string}) {
    return <h1 className="font-display text-[24px] font-bold leading-8 text-white sm:text-[28px] sm:leading-9">{children}</h1>;
}

/**
 * One row, 64 tall, 16 inset: the art, then the text column with the
 * hairline under it (the separator starts at the text, never under the art).
 */
function CompanionRow({row, href, line, time, locale, words}: {
    row: CompanionTabRow;
    href: string | null;
    line: ReturnType<typeof rosterLine>;
    time: number | null;
    locale: string;
    words: CompanionWords;
}) {
    const unread = row.unreadCount > 0;
    const needsYou = rosterNeed(row) !== null;
    const body = (
        <>
            <AskAnimalFace url={row.slug ? getSpeciesImageRoute(row.slug) : null} size={48} className={needsYou ? "ring-2 ring-primary-400/80" : ""} />
            <span className="flex h-full min-w-0 flex-1 items-center gap-3 border-b border-white/[0.08] pr-4">
                <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[17px] leading-6 text-white ${unread ? "font-bold" : "font-semibold"}`}>{row.displayName}</span>
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
                {time !== null ? (
                    <span className="shrink-0 text-[11px] leading-4 text-white/40">{talkRelativeTime(time, {locale, yesterday: yesterdayWord(locale)})}</span>
                ) : null}
                {unread ? (
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: row.muted ? "rgb(255 255 255 / 0.35)" : NEON}} />
                ) : null}
            </span>
        </>
    );
    // Hover is a wash, no scale (DESIGN.md section 1); a press darkens it a step.
    const className = "flex h-16 items-center gap-3 pl-4 transition-colors duration-150 ease-spring hover:bg-white/[0.04] active:bg-white/[0.07] md:pl-5";
    return href
        ? <Link href={href} className={className} data-testid="companion-row">{body}</Link>
        : <div className={className} data-testid="companion-row">{body}</div>;
}

export default function CompanionsPage({words, locale = "en"}: {words: CompanionWords; locale?: string}) {
    const {isAuthenticated} = useAppShellChrome();
    return isAuthenticated ? <YourCompanions words={words} locale={locale} /> : <SignedOutCompanions words={words} />;
}

/** Signed out: sign in to meet your animals, or talk to one now. */
function SignedOutCompanions({words}: {words: CompanionWords}) {
    return (
        <div className="mx-auto max-w-3xl">
            <Title>{words.list.title}</Title>
            <div className="-mx-4 mt-4 flex flex-col items-start gap-4 border-y border-white/[0.08] px-4 py-8 md:mx-0 md:px-5">
                <p className="text-[15px] font-semibold leading-6 text-white">{words.tab.signedOut}</p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/account?next=/app"
                        className="inline-flex min-h-11 items-center rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    >
                        {words.tab.signIn}
                    </Link>
                    <Link
                        href={TRY_TALKING_HREF}
                        className="inline-flex min-h-11 items-center rounded-pill border border-white/12 bg-white/[0.05] px-5 text-[13px] font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
                    >
                        {words.tab.tryTalking}
                    </Link>
                </div>
            </div>
        </div>
    );
}

/** The newest message on the animal's chat in this browser, yours or its. */
function localLastOf(cards: CompanionCard[], row: CompanionTabRow): RosterLocalLast {
    const captureId = chatCaptureIdFor(cards, row.speciesProfileId, row.captureId);
    if (!captureId) return null;
    const messages = askSessionStore.messages(askThreadKey({scope: "species", captureId}));
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.status !== "complete" || !message.text.trim()) continue;
        const at = Date.parse(message.createdAt);
        const text = animalMessagePreviewText(message.text);
        return text && Number.isFinite(at) ? {text, at} : null;
    }
    return null;
}

function YourCompanions({words, locale}: {words: CompanionWords; locale: string}) {
    const {rows: companions, didLoad, available, reload} = useCompanions();
    const {cards, didLoad: cardsLoaded, available: cardsAvailable, reload: reloadCards} = useCompanionCards();
    const {conversations, reload: reloadConversations} = useAnimalConversations();
    // Read again when a thread changes here: a message sent moves its row and its line.
    const threads = useTalkThreads();
    // A step accepted, dropped or finished in a chat changes its row at once.
    const [stepOverrides, setStepOverrides] = useState<ReadonlyMap<string, string | null>>(() => new Map());
    useOpenStepUpdates(null, useCallback((step: AnimalStep | null, speciesProfileId: string) => {
        setStepOverrides((current) => new Map(current).set(speciesProfileId, step?.step ?? null));
    }, []));

    useEffect(() => {
        const refresh = () => {
            void reload();
            void reloadCards();
            void reloadConversations();
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [reload, reloadCards, reloadConversations]);
    // The server's list is the truth again once it has been read after a change.
    useEffect(() => setStepOverrides(new Map()), [companions]);

    const roster = useMemo(() => {
        const rows = buildCompanionRows({companions, conversations, cards, words}).map((row) =>
            stepOverrides.has(row.speciesProfileId) ? {...row, openStep: stepOverrides.get(row.speciesProfileId) ?? null} : row);
        const local = new Map(rows.map((row) => [row.speciesProfileId, localLastOf(cards, row)]));
        const localOf = (row: CompanionTabRow) => local.get(row.speciesProfileId) ?? null;
        return sortCompanionRoster(rows, localOf).map((row) => ({
            row,
            line: rosterLine(row, localOf(row), words),
            // The time only once there is a conversation to date.
            time: row.hasConversation || localOf(row) ? rosterLastAt(row, localOf(row)) : null
        }));
        // `threads` is the signal that this browser's chats changed; the rows read them through localLastOf.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companions, conversations, cards, words, stepOverrides, threads]);

    // Nothing to show yet, and nothing has said there is nothing.
    const isFirstLoad = roster.length === 0 && !(didLoad && cardsLoaded);

    return (
        <div className="mx-auto max-w-3xl">
            <Title>{words.list.title}</Title>
            {isFirstLoad ? (
                // The skeleton is the row's own layout: 64 tall, the circle, two lines, the hairline.
                <div className="-mx-4 mt-4 md:mx-0" aria-busy="true" data-testid="companions-skeleton">
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="flex h-16 items-center gap-3 pl-4 md:pl-5">
                            <span className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                            <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2 border-b border-white/[0.08] pr-4">
                                <span className="block h-3.5 w-36 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                                <span className="block h-3 w-56 max-w-full rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
                            </span>
                        </div>
                    ))}
                </div>
            ) : roster.length === 0 && !available && !cardsAvailable ? (
                // Neither the bond nor your cards could be read: your animals
                // are still all in the Collection.
                <div className="-mx-4 mt-4 border-y border-white/[0.08] px-4 py-6 md:mx-0 md:px-5">
                    <Link
                        href="/app/collection"
                        className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-white/12 bg-white/[0.05] px-5 text-[13px] font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
                    >
                        <AppIcon name="collection" /> {words.tab.collection}
                    </Link>
                </div>
            ) : roster.length === 0 ? (
                // Empty: art, one line, Capture, and the public chats as the other way in.
                <div className="-mx-4 mt-4 flex flex-col items-center gap-4 border-y border-white/[0.08] px-4 py-10 text-center md:mx-0 md:px-5" data-testid="companions-empty">
                    <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-primary-400/10 text-primary-200">
                        <AppIcon name="companions" className="h-8 w-8" />
                    </span>
                    <p className="text-[15px] font-semibold leading-6 text-white">{words.list.empty}</p>
                    <Link
                        href="/app/capture"
                        className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    >
                        <AppIcon name="camera" /> {words.list.capture}
                    </Link>
                    <Link href={TRY_TALKING_HREF} className="text-[13px] font-semibold text-white/60 transition-colors hover:text-white">
                        {words.tab.meetOneNow}
                    </Link>
                </div>
            ) : (
                // The rows fade in once, when the list first mounts; a refresh keeps them.
                <div className="rows-in -mx-4 mt-4 md:mx-0" data-testid="companions-roster">
                    {roster.map(({row, line, time}) => (
                        <CompanionRow
                            key={row.speciesProfileId}
                            row={row}
                            line={line}
                            time={time}
                            locale={locale}
                            words={words}
                            // Its chat, on the card you last talked through (else
                            // its newest); on the referral, when one is waiting.
                            href={companionRowHref({
                                captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId),
                                referralWaiting: row.referralWaiting,
                                referralId: row.referralId
                            })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
