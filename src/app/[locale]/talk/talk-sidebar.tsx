"use client";

/**
 * The Talk page's sidebar (docs/rich-chat/SPEC.md, section 4.2): New chat
 * (the picker); Your animals, signed in with cards, each opening its owner's
 * chat with the whole companion loop; Recent chats, every animal thread in
 * this browser's thread store with a message in it and, signed in, every
 * thread kept on their account (docs/chat-sync/SPEC.md, section 3), grouped
 * Today / Yesterday / Earlier, Delete on hover; and at the bottom the account
 * and the app. With no chats yet, it says where they will be and offers
 * three animals to start with (WEB-36). Faces are species icon art, never a
 * capture photo.
 */

import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
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
import {useCompanions} from "@/components/companions/use-companions";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {askPathWithoutLocale} from "@/lib/ask-animaldex/subject";
import {rememberStorePlacement} from "@/lib/store-links";
import {normalizeServerChatThreads} from "@/lib/ask-animaldex/chat-sync";
import {
    talkChatPath,
    talkMergeRecentChats,
    talkRecentChats,
    talkRelativeTime,
    talkThreadsDigest,
    type TalkAnimal,
    type TalkServerChat,
    type TalkWords
} from "@/lib/ask-animaldex/talk";
import type {AskThreads} from "@/lib/ask-animaldex/thread";

const NO_THREADS: AskThreads = {};

/**
 * The thread store, as far as the sidebar is concerned: the same object back
 * while no message has landed or gone (`talkThreadsDigest`), so a reply
 * typing out in the main pane does not draw the sidebar again on every step.
 */
function useTalkThreads(): AskThreads {
    const last = useRef<{digest: string; threads: AskThreads} | null>(null);
    return useSyncExternalStore(
        askSessionStore.subscribe,
        () => {
            const threads = askSessionStore.all();
            const digest = talkThreadsDigest(threads);
            if (last.current && last.current.digest === digest) return last.current.threads;
            last.current = {digest, threads};
            return threads;
        },
        () => NO_THREADS
    );
}

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
    const synced = signedIn && server.available;
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
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                {/* The shared flat lockup (DECISIONS section 5): src/components/brand/brand-lockup.tsx. */}
                <Link href="/" aria-label={words.home} className="flex min-h-11 min-w-0 flex-1 items-center">
                    <BrandLockup size={22} />
                </Link>
                {onClose ? (
                    <button type="button" onClick={onClose} aria-label={words.closeChats} className="grid h-11 w-11 place-items-center rounded-full text-ink-300 hover:bg-white/8 hover:text-white">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9m0-9l-9 9" /></svg>
                    </button>
                ) : null}
            </div>
            <div className="px-3 pb-2 pt-1">
                <Link
                    href="/talk"
                    className="flex h-11 w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white transition-colors hover:border-primary-300/40 hover:bg-white/[0.08]"
                    data-testid="talk-new-chat"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
                    {words.newChat}
                </Link>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label={words.recentChats}>
                {yourAnimals.length > 0 ? (
                    <section className="pt-3" data-testid="talk-your-animals">
                        <h2 className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-ink-400">{words.yourAnimals}</h2>
                        {yourAnimals.map((row) => {
                            const href = talkChatPath({slug: row.slug as string, captureId: row.captureId});
                            return (
                                <Link
                                    key={row.speciesProfileId}
                                    href={href}
                                    {...askContextIntentHandlers(() => prefetchAskContext(locale, row.slug as string, row.animal, row.captureId))}
                                    className={`flex items-center gap-2.5 px-2 py-2 transition-colors hover:bg-white/[0.05] ${current === href ? "bg-white/[0.07]" : ""}`}
                                    style={{borderRadius: 12}}
                                >
                                    <AskAnimalFace url={getSpeciesImageRoute(row.slug as string)} size={30} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-semibold text-white">{row.nickname ?? row.animal}</span>
                                        {row.powerName ? <span className="block truncate text-[11px] text-ink-300">{row.powerName}</span> : null}
                                    </span>
                                </Link>
                            );
                        })}
                    </section>
                ) : null}
                {groups.length > 0 ? (
                    <section className="pt-3" data-testid="talk-recent">
                        <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.14em] text-ink-400">{words.recentChats}</h2>
                        {groups.map((group) => (
                            <div key={group.group} className="pt-2">
                                <p className="px-2 pb-1 text-[11px] font-semibold text-ink-500">{groupTitle[group.group]}</p>
                                {group.chats.map((chat) => {
                                    const href = talkChatPath(chat);
                                    return (
                                        <div key={chat.key} className={`group/chat relative flex items-center transition-colors hover:bg-white/[0.05] ${current === href ? "bg-white/[0.07]" : ""}`} style={{borderRadius: 12}}>
                                            <Link
                                                href={href}
                                                // Intent on a chat starts its context read, so it opens with it in flight.
                                                {...askContextIntentHandlers(() => prefetchAskContext(locale, chat.slug, chat.name, chat.captureId))}
                                                className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 pr-11"
                                            >
                                                <AskAnimalFace url={getSpeciesImageRoute(chat.slug)} size={30} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-baseline gap-2">
                                                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{chat.name}</span>
                                                        <span className="shrink-0 text-[10px] text-ink-400">{talkRelativeTime(chat.lastAt, {locale, yesterday: words.yesterday})}</span>
                                                    </span>
                                                    {chat.preview ? <span className="block truncate text-[11px] text-ink-400">{chat.preview}</span> : null}
                                                </span>
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => deleteChat(chat)}
                                                aria-label={`${words.deleteChat}: ${chat.name}`}
                                                title={words.deleteChat}
                                                className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-ink-400 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus:opacity-100 group-hover/chat:opacity-100 [@media(pointer:coarse)]:opacity-100"
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
                        <p className="px-2 pt-3 text-[11px] leading-4 text-ink-500" data-testid="talk-recent-note">{synced ? words.syncedHere : words.keptHere}</p>
                    </section>
                ) : yourAnimals.length === 0 ? (
                    // Nothing yet: where the chats will be, and three animals to start with (WEB-36).
                    <section className="px-2 pt-4" data-testid="talk-sidebar-empty">
                        <p className="text-[13px] leading-5 text-ink-200">{words.noChatsYet}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-ink-500">{synced ? words.syncedHere : words.keptHere}</p>
                        {starters.length > 0 ? (
                            <>
                                <h2 className="pb-1.5 pt-5 text-[10px] font-black uppercase tracking-[0.14em] text-ink-400">{words.startWith}</h2>
                                {starters.slice(0, 3).map((animal) => (
                                    <Link
                                        key={animal.slug}
                                        href={`/talk/${animal.slug}`}
                                        className="-mx-2 flex items-center gap-2.5 px-2 py-2 transition-colors hover:bg-white/[0.05]"
                                        style={{borderRadius: 12}}
                                    >
                                        <AskAnimalFace url={animal.icon ?? getSpeciesImageRoute(animal.slug)} size={30} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-semibold text-white">{animal.name}</span>
                                            {animal.power ? <span className="block truncate text-[11px] text-ink-300">{animal.power}</span> : null}
                                        </span>
                                    </Link>
                                ))}
                            </>
                        ) : null}
                    </section>
                ) : null}
            </nav>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-2.5 py-3">
                {signedIn ? (
                    <Link
                        href="/app"
                        className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-2.5 text-[13px] font-semibold text-ink-100 transition-colors hover:bg-white/[0.06] hover:text-white"
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
                        <Link href={accountHref} className="inline-flex h-10 items-center rounded-full px-2 text-white transition-colors hover:bg-white/[0.06]" data-testid="talk-sign-up">
                            {words.signUpFree}
                        </Link>
                        <span aria-hidden="true" className="text-ink-500">·</span>
                        <Link href={accountHref} className="inline-flex h-10 items-center rounded-full px-2 text-ink-200 transition-colors hover:bg-white/[0.06] hover:text-white">
                            {words.signIn}
                        </Link>
                    </span>
                )}
                <Link
                    href="/#download"
                    onClick={() => rememberStorePlacement("page_talk")}
                    className="ml-auto inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-primary-400 px-3 text-[12px] font-black text-canvas-950 transition-colors hover:bg-primary-300"
                >
                    {words.getApp}
                </Link>
            </div>
        </div>
    );
}
