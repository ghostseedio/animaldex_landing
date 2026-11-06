"use client";

/**
 * The Companions tab as the chat (the owner, 2026-11-06; iOS
 * `CompanionsTabView`'s chat root): the animal they were with last, open, in
 * the conversation the Talk page renders full-screen; the others a switch
 * away, like a model switcher. On a wide screen their animals are a column
 * beside the chat; on a phone the header's name (or its menu button) opens
 * them as a slide-over. A tap puts that animal's own conversation here.
 * Nothing moves between conversations: what was said to one animal stays
 * with it. The chat stays on its animal while the tab lives, so a message
 * from another animal is a dot on the switch, never a chat that changes
 * under them.
 */

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {CompanionRow} from "@/app/[locale]/(authenticated)/app/companions/companion-row";
import AskConversation, {type AskConversationPage, type AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import {chatCaptureIdFor} from "@/components/companions/use-companions";
import {askDeclaredSubject} from "@/lib/ask-animaldex/subject";
import type {TalkWords} from "@/lib/ask-animaldex/talk";
import type {CompanionWords} from "@/lib/companion-bond";
import type {CompanionCard} from "@/lib/companion-cards";
import type {rosterLine} from "@/lib/companion-roster";
import type {CompanionTabRow} from "@/lib/companion-rows";
import {pickCompanionToOpen, rememberCompanion, rememberedCompanion, type CompanionsOpeningMemory} from "@/lib/companions-opening";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {TRY_TALKING_HREF} from "@/lib/try-talking";

export type CompanionsChatEntry = {row: CompanionTabRow; line: ReturnType<typeof rosterLine>; time: number | null};

/** With more animals than fit a screen, a field to find one. */
const SEARCH_FROM = 9;

/** Before the first paint in the browser; a plain effect on the server, where there is no paint. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Fills from where it sits to the foot of the viewport, above the shell's bottom chrome. */
function useFillToFoot(ref: React.RefObject<HTMLDivElement | null>): string | undefined {
    const [height, setHeight] = useState<string | undefined>(undefined);
    useIsomorphicLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const measure = () => {
            const top = Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));
            // Below 1024 px the tab bar floats at the foot (the shell's pb-28); above it, the page's own bottom padding.
            const reserve = window.matchMedia("(min-width: 1024px)").matches ? 40 : 112;
            setHeight(`calc(100dvh - ${top}px - ${reserve}px)`);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [ref]);
    return height;
}

export default function CompanionsChat({entries, cards, words, labels, talk, locale}: {
    entries: CompanionsChatEntry[];
    cards: CompanionCard[];
    words: CompanionWords;
    labels: AskDrawerLabels;
    talk: TalkWords;
    locale: string;
}) {
    const pathname = usePathname() ?? "/app";
    const rows = useMemo(() => entries.map((entry) => entry.row), [entries]);
    const [switchedTo, setSwitchedTo] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [remembered, setRemembered] = useState<CompanionsOpeningMemory | null>(null);
    useEffect(() => setRemembered(rememberedCompanion()), []);

    const lastAtOf = useCallback(
        (row: CompanionTabRow) => entries.find((entry) => entry.row === row)?.time ?? row.lastActivityAt,
        [entries]
    );
    const current = useMemo(
        () => rows.find((row) => row.speciesProfileId === switchedTo) ?? pickCompanionToOpen(rows, lastAtOf, remembered),
        [rows, switchedTo, lastAtOf, remembered]
    );
    useEffect(() => {
        if (!current || switchedTo === current.speciesProfileId) return;
        setSwitchedTo(current.speciesProfileId);
        rememberCompanion(current.speciesProfileId);
    }, [current, switchedTo]);
    const pick = useCallback((row: CompanionTabRow) => {
        setSwitchedTo(row.speciesProfileId);
        rememberCompanion(row.speciesProfileId);
        setOpen(false);
    }, []);
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const frame = useRef<HTMLDivElement | null>(null);
    const height = useFillToFoot(frame);
    const othersUnread = current ? rows.filter((row) => row.speciesProfileId !== current.speciesProfileId && row.unreadCount > 0).length : 0;
    const captureId = current ? chatCaptureIdFor(cards, current.speciesProfileId, current.captureId) : null;
    const avatarUrl = current?.slug ? getSpeciesImageRoute(current.slug) : null;
    const openSwitcher = useCallback(() => setOpen(true), []);

    const page = useMemo<AskConversationPage | null>(() => (current
        ? {
            onMenu: openSwitcher,
            words: talk,
            onAskAnother: openSwitcher,
            initialQuestion: null,
            appHref: "/#download",
            subject: {
                subject: askDeclaredSubject(pathname, {scope: "species", slug: current.slug, name: current.animal, title: current.displayName, captureId}, null),
                avatarUrl,
                companionSpeciesProfileId: current.speciesProfileId
            },
            switcher: {label: words.list.switcher, othersUnread, onOpen: openSwitcher}
        }
        : null), [current, openSwitcher, talk, pathname, captureId, avatarUrl, words.list.switcher, othersUnread]);

    if (!current || !page) return null;
    const list = (onClose?: () => void) => (
        <SwitchList entries={entries} currentId={current.speciesProfileId} words={words} locale={locale} onPick={pick} onClose={onClose} closeLabel={labels.close} />
    );
    return (
        <div
            ref={frame}
            style={{height}}
            className="-mx-4 -my-7 flex min-h-[420px] overflow-hidden border-t border-white/10 sm:-mx-7 lg:-mx-10 lg:-my-10 lg:border-t-0"
            data-testid="companions-chat"
        >
            <aside className="hidden w-[300px] shrink-0 flex-col border-r border-white/10 lg:flex" aria-label={words.list.switcher}>
                {list()}
            </aside>
            {open ? (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={words.list.switcher}>
                    <button type="button" aria-label={labels.close} onClick={() => setOpen(false)} className="absolute inset-0 bg-canvas-950/70" />
                    <aside
                        className="talk-slide-over absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-white/10 bg-canvas-900 shadow-[12px_0_40px_rgba(0,0,0,0.45)]"
                        data-testid="companion-switcher-panel"
                    >
                        {list(() => setOpen(false))}
                    </aside>
                </div>
            ) : null}
            <main className="flex min-w-0 flex-1 flex-col">
                <AskSubjectBridge
                    scope="species"
                    slug={current.slug}
                    name={current.animal}
                    title={current.displayName}
                    captureId={captureId}
                    avatarUrl={avatarUrl}
                    companionSpeciesProfileId={current.speciesProfileId}
                />
                <AskConversation key={current.speciesProfileId} labels={labels} presentation="page" page={page} />
            </main>
        </div>
    );
}

/** Their animals, the same rows the roster had: talking first, then the ones to say hello to, then the other ways in. */
function SwitchList({entries, currentId, words, locale, onPick, onClose, closeLabel}: {
    entries: CompanionsChatEntry[];
    currentId: string;
    words: CompanionWords;
    locale: string;
    onPick: (row: CompanionTabRow) => void;
    onClose?: () => void;
    closeLabel: string;
}) {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? entries.filter(({row}) => row.displayName.toLowerCase().includes(needle) || row.animal.toLowerCase().includes(needle))
        : entries;
    const talking = shown.filter(({time}) => time !== null);
    const quiet = shown.filter(({time}) => time === null);
    const headers = talking.length > 0 && quiet.length > 0;
    const band = (text: string) => (
        <p className="bg-[#12351C]/60 px-4 pb-2 pt-3.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/40">{text}</p>
    );
    const rowOf = ({row, line, time}: CompanionsChatEntry) => (
        <CompanionRow
            key={row.speciesProfileId}
            row={row}
            line={line}
            time={time}
            locale={locale}
            words={words}
            href={null}
            onSelect={() => onPick(row)}
            isCurrent={row.speciesProfileId === currentId}
        />
    );
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 pl-4 pr-1">
                <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold leading-6 text-white">{words.list.switcher}</h2>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="grid h-11 w-11 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white"
                    >
                        <CloseIcon />
                    </button>
                ) : null}
            </div>
            {entries.length >= SEARCH_FROM ? (
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={words.list.switcher}
                    className="mx-4 my-2.5 h-10 shrink-0 rounded-pill border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-primary-400/60"
                />
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {headers ? band(words.list.talking) : null}
                {talking.map(rowOf)}
                {headers ? band(words.list.shelf) : null}
                {quiet.map(rowOf)}
                {needle ? null : (
                    <div className="flex flex-col items-start gap-3 px-4 py-5">
                        <Link href={TRY_TALKING_HREF} className="text-[13px] font-semibold text-white/60 transition-colors hover:text-white">
                            {words.tab.meetOneNow}
                        </Link>
                        <Link
                            href="/app/capture"
                            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                        >
                            <AppIcon name="camera" /> {words.list.capture}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}
