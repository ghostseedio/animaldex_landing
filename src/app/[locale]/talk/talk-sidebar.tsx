"use client";

/**
 * The Talk page's sidebar (docs/rich-chat/SPEC.md, section 4.2): New chat
 * (the picker); Your animals, signed in with cards, each opening its owner's
 * chat with the whole companion loop; Recent chats, every animal thread in
 * this browser's thread store with a message in it and, signed in, every
 * thread kept on their account (docs/chat-sync/SPEC.md, section 3), grouped
 * Today / Yesterday / Earlier, Delete on hover; and at the bottom the account
 * row, nothing else. With no chats yet, it says where they will be and offers
 * three animals to start with (WEB-36). Faces are species icon art, never a
 * capture photo.
 *
 * Rows are 48 tall with 36 art, the name and one line under it, the time on
 * the right; section labels are 11 px capitals (polish pass, DESIGN.md
 * section 3).
 */

import {useEffect, useMemo, useState, type ReactNode} from "react";
import Image from "next/image";
import BrandLockup from "@/components/brand/brand-lockup";
import {usePathname, useRouter} from "next/navigation";
import {getLocalePath} from "@/lib/site";
import {onIdle} from "@/lib/on-idle";
import Link from "@/app/[locale]/_components/link";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {askContextIntentHandlers, prefetchAskContext} from "@/components/ask-animaldex/ask-context-prefetch";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {forgetTalkThread, useTalkThreadMetas} from "@/components/ask-animaldex/ask-thread-meta";
import {useTalkThreads} from "@/components/ask-animaldex/use-talk-threads";
import {useCompanions} from "@/components/companions/use-companions";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {askPathWithoutLocale} from "@/lib/ask-animaldex/subject";
import {normalizeServerChatThreads} from "@/lib/ask-animaldex/chat-sync";
import {
    talkChatPath,
    talkMergeRecentChats,
    talkRecentChats,
    talkRelativeTime,
    type TalkAnimal,
    type TalkServerChat,
    type TalkWords
} from "@/lib/ask-animaldex/talk";

/** A row's hover wash on its card radius; a press darkens it a step (no scale on the web). */
const ROW = "flex h-12 items-center gap-2.5 rounded-card px-2 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]";

/** The account's threads, once per tab: the sidebar is drawn again on every page of the Talk area. */
let serverChatsCache: Promise<{available: boolean; threads: TalkServerChat[]}> | null = null;

function loadServerChats() {
    serverChatsCache ??= fetch("/api/ask/history?list=1", {headers: {Accept: "application/json"}})
        .then((response) => (response.ok ? response.json() as Promise<{available?: boolean; threads?: unknown}> : null))
        .then((payload) => ({available: payload?.available === true, threads: normalizeServerChatThreads(payload?.threads)}))
        .catch(() => {
            serverChatsCache = null;
            return {available: false, threads: []};
        });
    return serverChatsCache;
}

/** A section's label: 36 tall, 11 px capitals, tertiary. */
function SectionLabel({children}: {children: ReactNode}) {
    return <h2 className="flex h-9 items-center px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">{children}</h2>;
}

/** The name and the line under it, the time at the right of the name. */
function RowText({name, line, time = null}: {name: string; line: string | null; time?: string | null}) {
    return (
        <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-4 text-white">{name}</span>
                {time ? <span className="shrink-0 text-[11px] leading-4 text-ink-400">{time}</span> : null}
            </span>
            {line ? <span className="block truncate text-[11px] leading-4 text-ink-400">{line}</span> : null}
        </span>
    );
}

export default function TalkSidebar({locale, words, starters = [], onClose}: {
    locale: string;
    words: TalkWords;
    /** Three animals to start with while there are no chats (the featured ones, from the server). */
    starters?: TalkAnimal[];
    onClose?: () => void;
}) {
    const {session} = useHeaderAuth();
    const signedIn = Boolean(session.user);
    const companions = useCompanions(signedIn);
    const threads = useTalkThreads();
    const metas = useTalkThreadMetas();
    const [server, setServer] = useState<{available: boolean; threads: TalkServerChat[]}>({available: false, threads: []});
    const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
    useEffect(() => {
        if (!signedIn) return;
        let cancelled = false;
        void loadServerChats().then((value) => {
            if (!cancelled) setServer(value);
        });
        return () => {
            cancelled = true;
        };
    }, [signedIn]);
    const groups = useMemo(() => {
        const local = talkRecentChats(threads, metas);
        const remote = signedIn ? server.threads.filter((chat) => !removed.has(chat.key)) : [];
        return talkMergeRecentChats(local, remote);
    }, [threads, metas, server.threads, signedIn, removed]);
    const pathname = usePathname() ?? "/talk";
    const path = askPathWithoutLocale(pathname);
    // Read from the address, not `useSearchParams`, which would render the static /talk page on the client only.
    const [card, setCard] = useState<string | null>(null);
    useEffect(() => setCard(new URLSearchParams(window.location.search).get("card")), [pathname]);
    const current = `${path}${card ? `?card=${card}` : ""}`;
    const groupTitle = {today: words.today, yesterday: words.yesterday, earlier: words.earlier};
    const yourAnimals = signedIn ? companions.rows.filter((row) => row.captureId && row.slug) : [];
    const accountHref = `/account?next=${encodeURIComponent(current)}`;
    // The chats most likely opened next (the first of each list), fetched once
    // the page is idle, so switching to them is a paint, not a download.
    const router = useRouter();
    const nextHrefs = useMemo(() => {
        const hrefs = [
            ...yourAnimals.slice(0, 2).map((row) => talkChatPath({slug: row.slug as string, captureId: row.captureId})),
            ...groups.flatMap((group) => group.chats).slice(0, 3).map((chat) => talkChatPath(chat))
        ];
        return Array.from(new Set(hrefs)).filter((href) => href !== current).slice(0, 4).join("\u0001");
    }, [yourAnimals, groups, current]);
    useEffect(() => {
        if (!nextHrefs) return;
        return onIdle(() => {
            for (const href of nextHrefs.split("\u0001")) router.prefetch(getLocalePath(locale, href));
        }, 2000);
    }, [nextHrefs, router, locale]);

    const deleteChat = (chat: {key: string; serverKey?: string}) => {
        askSessionStore.clear(chat.key);
        forgetTalkThread(chat.key);
        setRemoved((current) => new Set(current).add(chat.key));
        // On the account too, when it is kept there; an older server keeps nothing to delete.
        if (chat.serverKey) {
            serverChatsCache = null;
            void fetch("/api/ask/history", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "delete", thread: chat.serverKey})
            }).catch(() => undefined);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col" data-testid="talk-sidebar">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3">
                {/* The shared flat lockup (DECISIONS section 5): src/components/brand/brand-lockup.tsx. */}
                <Link href="/" aria-label={words.home} className="flex min-h-11 min-w-0 flex-1 items-center">
                    <BrandLockup size={22} />
                </Link>
                {onClose ? (
                    <button type="button" onClick={onClose} aria-label={words.closeChats} className="grid h-11 w-11 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9m0-9l-9 9" /></svg>
                    </button>
                ) : null}
            </div>
            <div className="px-3 pb-1 pt-1">
                {/* New chat: a pill at the top of the list. */}
                <Link
                    href="/talk"
                    className="flex h-11 w-full items-center gap-2 rounded-pill border border-white/12 bg-white/[0.05] px-4 text-[13px] font-bold text-white transition-colors hover:border-primary-300/40 hover:bg-white/[0.08] active:bg-white/[0.12]"
                    data-testid="talk-new-chat"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
                    {words.newChat}
                </Link>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label={words.recentChats}>
                {yourAnimals.length > 0 ? (
                    <section className="pt-1" data-testid="talk-your-animals">
                        <SectionLabel>{words.yourAnimals}</SectionLabel>
                        {yourAnimals.map((row) => {
                            const href = talkChatPath({slug: row.slug as string, captureId: row.captureId});
                            return (
                                <Link
                                    key={row.speciesProfileId}
                                    href={href}
                                    {...askContextIntentHandlers(() => prefetchAskContext(locale, row.slug as string, row.animal, row.captureId))}
                                    className={`${ROW} ${current === href ? "bg-white/[0.07]" : ""}`}
                                >
                                    <AskAnimalFace url={getSpeciesImageRoute(row.slug as string)} size={36} />
                                    <RowText name={row.nickname ?? row.animal} line={row.powerName} />
                                </Link>
                            );
                        })}
                    </section>
                ) : null}
                {groups.length > 0 ? (
                    <section className="pt-1" data-testid="talk-recent">
                        <SectionLabel>{words.recentChats}</SectionLabel>
                        {groups.map((group) => (
                            <div key={group.group}>
                                <p className="flex h-7 items-center px-2 text-[11px] font-semibold leading-4 text-ink-500">{groupTitle[group.group]}</p>
                                {group.chats.map((chat) => {
                                    const href = talkChatPath(chat);
                                    return (
                                        <div key={chat.key} className={`group/chat relative flex h-12 items-center rounded-card transition-colors hover:bg-white/[0.05] active:bg-white/[0.08] ${current === href ? "bg-white/[0.07]" : ""}`}>
                                            <Link
                                                href={href}
                                                // Intent on a chat starts its context read, so it opens with it in flight.
                                                {...askContextIntentHandlers(() => prefetchAskContext(locale, chat.slug, chat.name, chat.captureId))}
                                                className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2 pr-11"
                                            >
                                                <AskAnimalFace url={getSpeciesImageRoute(chat.slug)} size={36} />
                                                <RowText name={chat.name} line={chat.preview} time={talkRelativeTime(chat.lastAt, {locale, yesterday: words.yesterday})} />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => deleteChat(chat)}
                                                aria-label={`${words.deleteChat}: ${chat.name}`}
                                                title={words.deleteChat}
                                                className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-ink-400 opacity-0 transition-opacity hover:bg-white/10 active:bg-white/15 hover:text-white focus:opacity-100 group-hover/chat:opacity-100 [@media(pointer:coarse)]:opacity-100"
                                                data-testid="talk-delete-chat"
                                            >
                                                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M4.5 6h11M8 6V4.5h4V6m-6 0 .7 9.5h6.6L14 6" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </section>
                ) : yourAnimals.length === 0 ? (
                    // Nothing yet: where the chats will be, and three animals to start with (WEB-36).
                    <section className="pt-3" data-testid="talk-sidebar-empty">
                        <p className="px-2 text-[13px] leading-[18px] text-ink-200">{words.noChatsYet}</p>
                        {starters.length > 0 ? (
                            <>
                                <div className="pt-3"><SectionLabel>{words.startWith}</SectionLabel></div>
                                {starters.slice(0, 3).map((animal) => (
                                    <Link key={animal.slug} href={`/talk/${animal.slug}`} className={ROW}>
                                        <AskAnimalFace url={animal.icon ?? getSpeciesImageRoute(animal.slug)} size={36} />
                                        <RowText name={animal.name} line={animal.power} />
                                    </Link>
                                ))}
                            </>
                        ) : null}
                    </section>
                ) : null}
            </nav>
            {/* Under the list, the account row and nothing else (DESIGN.md section 3). */}
            <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2">
                {signedIn ? (
                    <Link
                        href="/app"
                        className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-pill px-2.5 text-[13px] font-semibold text-ink-100 transition-colors hover:bg-white/[0.06] hover:text-white active:bg-white/10"
                    >
                        {session.avatarUrl ? (
                            <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-white/15">
                                <Image src={session.avatarUrl} alt="" fill sizes="24px" unoptimized className="object-cover" />
                            </span>
                        ) : null}
                        <span className="truncate">{session.displayName ?? session.username ?? words.account}</span>
                    </Link>
                ) : (
                    <span className="flex items-center whitespace-nowrap text-[13px] font-semibold">
                        <Link href={accountHref} className="inline-flex h-10 items-center rounded-pill px-2 text-white transition-colors hover:bg-white/[0.06] active:bg-white/10" data-testid="talk-sign-up">
                            {words.signUpFree}
                        </Link>
                        <span aria-hidden="true" className="text-ink-500">·</span>
                        <Link href={accountHref} className="inline-flex h-10 items-center rounded-pill px-2 text-ink-200 transition-colors hover:bg-white/[0.06] hover:text-white active:bg-white/10">
                            {words.signIn}
                        </Link>
                    </span>
                )}
            </div>
        </div>
    );
}
