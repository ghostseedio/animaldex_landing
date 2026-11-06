"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {DmAvatar, DmSymbol} from "@/app/[locale]/(authenticated)/app/messages/_components/dm-ui";
import {conversationSubtitle, conversationTitle, type DirectMessageProfile} from "@/lib/direct-message-presentation";
import {fillWords, type DirectMessageWords} from "@/lib/direct-message-words";

/**
 * iOS `DirectMessageNewConversationView`: recent chats and people you follow,
 * or a search by name or @username once two letters are typed.
 */
export default function NewMessagePicker({words, recents, onPick, onClose}: {
    words: DirectMessageWords;
    /** The inbox's people, newest first, without support. */
    recents: DirectMessageProfile[];
    onPick: (profile: DirectMessageProfile) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState("");
    const [following, setFollowing] = useState<DirectMessageProfile[]>([]);
    const [results, setResults] = useState<DirectMessageProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const needle = query.trim();
    const searching = needle.length >= 2;

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/app/messages/people", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((payload: {following?: DirectMessageProfile[]} | null) => {
                if (!cancelled && payload?.following) setFollowing(payload.following);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!searching) {
            setResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/app/messages/people?q=${encodeURIComponent(needle)}`, {cache: "no-store", signal: controller.signal})
                .then((response) => response.ok ? response.json() : {results: []})
                .then((payload: {results?: DirectMessageProfile[]}) => {
                    setResults(payload.results ?? []);
                    setIsSearching(false);
                })
                .catch((error: unknown) => {
                    if ((error as {name?: string})?.name === "AbortError") return;
                    setResults([]);
                    setIsSearching(false);
                });
        }, 280);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [needle, searching]);

    const recentPeople = useMemo(() => recents.filter((profile) => !profile.isSystem), [recents]);
    const followingPeople = useMemo(() => {
        const recentIds = new Set(recentPeople.map((profile) => profile.userId));
        return following
            .filter((profile) => !recentIds.has(profile.userId))
            .sort((left, right) => conversationTitle(left, words).localeCompare(conversationTitle(right, words)));
    }, [following, recentPeople, words]);

    function personRow(profile: DirectMessageProfile) {
        const handle = conversationSubtitle(profile, words);
        return (
            <li key={profile.userId}>
                <button
                    type="button"
                    onClick={() => onPick(profile)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                >
                    <DmAvatar profile={profile} size={42} />
                    <span className="min-w-0 flex-1 border-b border-white/[0.07] py-2">
                        <span className="block truncate text-base font-semibold text-white">{conversationTitle(profile, words)}</span>
                        {handle ? <span className="block truncate text-[13px] font-medium text-white/40">{handle}</span> : null}
                    </span>
                </button>
            </li>
        );
    }

    function sectionHeader(title: string) {
        return <h3 className="bg-white/[0.04] px-4 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white/40">{title}</h3>;
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center" role="presentation" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={words.newMessage}
                className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-card border border-white/10 bg-[#111] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] md:h-[min(640px,85dvh)] md:max-w-lg md:rounded-card"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-3 pb-2 pt-3">
                    <span />
                    <h2 className="truncate text-center text-[17px] font-semibold text-white">{words.newMessage}</h2>
                    <button type="button" onClick={onClose} aria-label={words.close} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-[#A7F432] transition hover:bg-white/[0.12]">
                        <DmSymbol name="chevronDown" className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                </header>
                <div className="px-4 pb-2">
                    <label className="flex items-center gap-2 rounded-panel bg-white/[0.08] px-3 py-2 text-white/45 focus-within:ring-1 focus-within:ring-[#A7F432]/40">
                        <DmSymbol name="search" className="h-4 w-4" />
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={words.searchCollectors}
                            aria-label={words.searchCollectors}
                            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
                        />
                    </label>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-6">
                    {searching ? (
                        isSearching && !results.length ? (
                            <div className="flex justify-center py-8" aria-busy="true">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#A7F432]/25 border-t-[#A7F432]" />
                            </div>
                        ) : !results.length ? (
                            <p className="px-4 py-4 text-sm font-medium text-white/50">{fillWords(words.noCollectors, {query})}</p>
                        ) : (
                            <ul>{results.map(personRow)}</ul>
                        )
                    ) : (
                        <>
                            {recentPeople.length ? (
                                <section>
                                    {sectionHeader(words.recent)}
                                    <ul>{recentPeople.map(personRow)}</ul>
                                </section>
                            ) : null}
                            {followingPeople.length ? (
                                <section>
                                    {sectionHeader(words.following)}
                                    <ul>{followingPeople.map(personRow)}</ul>
                                </section>
                            ) : null}
                            {!recentPeople.length && !followingPeople.length ? (
                                <p className="px-4 py-4 text-sm font-medium text-white/50">{words.searchHint}</p>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
