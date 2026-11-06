"use client";

import {useEffect, useMemo, useState} from "react";
import {DmSymbol, useLatest} from "@/app/[locale]/(authenticated)/app/messages/_components/dm-ui";
import type {DirectMessageCardChoice} from "@/data/direct-messages";
import {fillWords, type DirectMessageWords} from "@/lib/direct-message-words";

/**
 * iOS `DirectMessageCardPickerView`: your animals, newest first, three to a
 * row, to drop into a conversation as a card. A private one shows a lock.
 */
export default function CardPicker({words, onPick, onClose}: {
    words: DirectMessageWords;
    onPick: (card: DirectMessageCardChoice) => void;
    onClose: () => void;
}) {
    const [cards, setCards] = useState<DirectMessageCardChoice[] | null>(null);
    const [query, setQuery] = useState("");
    const close = useLatest(onClose);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/app/messages/cards", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : {cards: []})
            .then((payload: {cards?: DirectMessageCardChoice[]}) => {
                if (!cancelled) setCards(payload.cards ?? []);
            })
            .catch(() => {
                if (!cancelled) setCards([]);
            });
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close.current();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            cancelled = true;
            document.removeEventListener("keydown", onKey);
        };
    }, [close]);

    const shown = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return needle ? (cards ?? []).filter((card) => card.title.toLocaleLowerCase().includes(needle)) : cards ?? [];
    }, [cards, query]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center" role="presentation" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={words.sendAnAnimal}
                className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-card border border-white/10 bg-[#111] md:h-[min(680px,85dvh)] md:max-w-lg md:rounded-card"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center px-3 pb-2 pt-3">
                    <span />
                    <h2 className="truncate text-center text-[17px] font-semibold text-white">{words.sendAnAnimal}</h2>
                    <button type="button" onClick={onClose} aria-label={words.close} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-[#A7F432] transition hover:bg-white/[0.12]">
                        <DmSymbol name="chevronDown" className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                </header>
                {cards === null ? (
                    <div className="flex flex-1 items-center justify-center" aria-busy="true">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#A7F432]/25 border-t-[#A7F432]" />
                    </div>
                ) : !cards.length ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <span className="text-2xl text-white/35" aria-hidden="true">🐾</span>
                        <p className="mt-2.5 text-[17px] font-semibold text-white">{words.noAnimalsYet}</p>
                        <p className="mt-1 text-sm font-medium text-white/55">{words.noAnimalsDetail}</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 pb-2">
                            <label className="flex items-center gap-2 rounded-panel bg-white/[0.08] px-3 py-2 text-white/45 focus-within:ring-1 focus-within:ring-[#A7F432]/40">
                                <DmSymbol name="search" className="h-4 w-4" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={words.searchYourAnimals}
                                    aria-label={words.searchYourAnimals}
                                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
                                />
                            </label>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <ul className="grid grid-cols-3 gap-0.5">
                                {shown.map((card) => (
                                    <li key={card.captureId}>
                                        <button
                                            type="button"
                                            onClick={() => onPick(card)}
                                            className="relative block aspect-square w-full overflow-hidden bg-white/[0.05] text-left transition active:opacity-80"
                                            aria-label={[card.title, card.grade && card.grade > 0 ? fillWords(words.grade, {grade: card.grade}) : null, card.isPrivate ? words.privateCard : null].filter(Boolean).join(", ")}
                                        >
                                            {card.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={card.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                            ) : null}
                                            <span className="absolute inset-0 bg-gradient-to-b from-transparent from-50% to-black/70" />
                                            <span className="absolute bottom-1.5 left-1.5 right-1.5">
                                                <span className="block truncate text-xs font-bold text-white">{card.title}</span>
                                                {card.grade && card.grade > 0 ? (
                                                    <span className="block text-[10px] font-semibold text-[#A7F432]">{fillWords(words.grade, {grade: card.grade})}</span>
                                                ) : null}
                                            </span>
                                            {card.isPrivate ? (
                                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white">
                                                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0h6V7a3 3 0 0 0-6 0Z" /></svg>
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
