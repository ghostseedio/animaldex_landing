"use client";

/**
 * One animal's chat on the Talk page: the drawer's own conversation
 * (`AskConversation`), full screen. It tells the site-wide provider what it
 * is about, exactly as the species page (or, with `?card=`, the card) does,
 * so the thread is the same one, under the same key: talked to in the
 * drawer, it carries on here. On the owner's own card (`?card=` among their
 * cards) it is their chat with the whole companion loop; anywhere else it is
 * the public chat, open to anyone (docs/rich-chat/SPEC.md, section 4).
 */

import {useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import AskConversation, {type AskConversationPage, type AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";
import {AskSubjectBridge, useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {useCompanionCards} from "@/components/companions/use-companions";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {getLocalePath} from "@/lib/site";
import type {TalkWords} from "@/lib/ask-animaldex/talk";
import {useTalkShell} from "@/app/[locale]/talk/talk-shell";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TalkChat({slug, name, labels, words, locale}: {
    slug: string;
    name: string;
    labels: AskDrawerLabels;
    words: TalkWords;
    locale: string;
}) {
    const router = useRouter();
    const {openSidebar} = useTalkShell();
    const {subject} = useAskAnimalDex();
    // From the address once mounted (`useSearchParams` would render the page on the client only).
    const [query, setQuery] = useState<{card: string | null; ask: string | null} | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const card = params.get("card")?.trim().toLowerCase() ?? "";
        const ask = params.get("ask")?.trim() ?? "";
        setQuery({card: UUID.test(card) ? card : null, ask: ask ? ask.slice(0, 900) : null});
    }, []);
    // A card is the owner's when it is one of theirs: their chat, with its loop. Read only with a session.
    const [hasSession, setHasSession] = useState(false);
    useEffect(() => setHasSession(requestHasSupabaseAuthCookie(document.cookie)), []);
    const cards = useCompanionCards(Boolean(query?.card) && hasSession);
    const ownCard = query?.card ? cards.cards.find((card) => card.captureId === query.card) ?? null : null;
    const settled = query !== null && (!query.card || !hasSession || cards.didLoad);
    const companionSpeciesProfileId = ownCard?.speciesProfileId ?? null;

    // The conversation opens once the provider holds this subject, so its first read is the right one.
    const declared = settled && subject.slug === slug && subject.name === name && (subject.captureId ?? null) === (query?.card ?? null);

    const page = useMemo<AskConversationPage>(() => ({
        onMenu: openSidebar,
        words,
        onAskAnother: (question: string) => {
            const ask = question.trim();
            router.push(getLocalePath(locale, ask ? `/talk?ask=${encodeURIComponent(ask.slice(0, 900))}` : "/talk"));
        },
        initialQuestion: query?.ask ?? null,
        appHref: "/#download"
    }), [openSidebar, words, router, locale, query?.ask]);

    return (
        <>
            {settled ? (
                <AskSubjectBridge
                    scope="species"
                    slug={slug}
                    name={name}
                    title={name}
                    captureId={query?.card ?? null}
                    avatarUrl={getSpeciesImageRoute(slug)}
                    companionSpeciesProfileId={companionSpeciesProfileId}
                />
            ) : null}
            {declared ? (
                <AskConversation labels={labels} presentation="page" page={page} />
            ) : (
                <TalkChatShell name={name} slug={slug} onMenu={openSidebar} menuLabel={words.openChats} />
            )}
        </>
    );
}

/** The chat's frame while it gets ready: its face and name, the animal typing. */
function TalkChatShell({name, slug, onMenu, menuLabel}: {name: string; slug: string; onMenu: () => void; menuLabel: string}) {
    return (
        <div className="flex h-full min-h-0 flex-col" aria-busy="true" data-testid="talk-chat-shell">
            <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 py-3">
                <button type="button" onClick={onMenu} aria-label={menuLabel} className="-ml-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-200 lg:hidden">
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h9" /></svg>
                </button>
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpeciesImageRoute(slug)} alt="" className="h-full w-full object-contain p-[8%]" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</p>
            </header>
            <div className="flex flex-1 flex-col items-center px-6 pt-12 text-center">
                <span className="relative h-24 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpeciesImageRoute(slug)} alt="" className="h-full w-full object-contain p-[8%]" />
                </span>
                <h1 className="mt-3 font-display text-2xl font-bold leading-8 text-white">{name}</h1>
                <span aria-hidden="true" className="mt-8 flex gap-[5px]">
                    {[0, 1, 2].map((dot) => (
                        <span key={dot} className="ask-typing-dot h-[7px] w-[7px] rounded-full bg-white/75" style={{animationDelay: `${dot * 150}ms`}} />
                    ))}
                </span>
            </div>
        </div>
    );
}
