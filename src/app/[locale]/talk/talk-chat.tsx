"use client";

/**
 * One animal's chat on the Talk page: the drawer's own conversation
 * (`AskConversation`), full screen. It tells the site-wide provider what it
 * is about, exactly as the species page (or, with `?card=`, the card) does,
 * so the thread is the same one, under the same key: talked to in the
 * drawer, it carries on here. On the owner's own card (`?card=` among their
 * cards) it is their chat with the whole companion loop; anywhere else it is
 * the public chat, open to anyone (docs/rich-chat/SPEC.md, section 4).
 *
 * Until the conversation mounts, the page shows its frame from the server's
 * HTML (WEB-23): the header, the animal's contact card and what it can do,
 * laid out exactly as the conversation lays them out, so the largest paint
 * is in the first HTML and nothing moves when the conversation takes over.
 *
 * The conversation itself is given the subject straight from this page (the
 * address and the server's animal, `askDeclaredSubject`), read before the
 * first paint in the browser: switching chats puts the next conversation on
 * screen in the same paint as the navigation, with no frame of the frame in
 * between. The provider is told too, for everything else that listens.
 */

import {useEffect, useLayoutEffect, useMemo, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import AskConversation, {type AskConversationPage, type AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import {AskAnimalFace, AskAnimalHero, AskTypingBubble} from "@/components/ask-animaldex/ask-messenger";
import TalkCapabilities from "@/components/ask-animaldex/talk-capabilities";
import {useCompanionCards} from "@/components/companions/use-companions";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {getLocalePath} from "@/lib/site";
import {askDeclaredSubject} from "@/lib/ask-animaldex/subject";
import type {TalkWords} from "@/lib/ask-animaldex/talk";
import {useTalkShell} from "@/app/[locale]/talk/talk-shell";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Before the first paint in the browser; a plain effect on the server, where there is no paint. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function TalkChat({slug, name, power, locale}: {
    slug: string;
    name: string;
    /** Its Power, as the catalog has it: the header's second line from the first paint. */
    power: string | null;
    locale: string;
}) {
    const router = useRouter();
    const pathname = usePathname() ?? `/talk/${slug}`;
    // The chat's words and labels come once with the layout, not with every chat page.
    const {openSidebar, words, labels} = useTalkShell();
    // From the address, before the first paint (`useSearchParams` would render the page on the client only).
    const [query, setQuery] = useState<{card: string | null; ask: string | null} | null>(null);
    useIsomorphicLayoutEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const card = params.get("card")?.trim().toLowerCase() ?? "";
        const ask = params.get("ask")?.trim() ?? "";
        setQuery({card: UUID.test(card) ? card : null, ask: ask ? ask.slice(0, 900) : null});
    }, []);
    // A card is the owner's when it is one of theirs: their chat, with its loop. Read only with a session.
    const [hasSession, setHasSession] = useState(false);
    useIsomorphicLayoutEffect(() => setHasSession(requestHasSupabaseAuthCookie(document.cookie)), []);
    const cards = useCompanionCards(Boolean(query?.card) && hasSession);
    const ownCard = query?.card ? cards.cards.find((card) => card.captureId === query.card) ?? null : null;
    const settled = query !== null && (!query.card || !hasSession || cards.didLoad);
    const companionSpeciesProfileId = ownCard?.speciesProfileId ?? null;
    const avatarUrl = getSpeciesImageRoute(slug);
    const captureId = query?.card ?? null;

    const subject = useMemo(() => (settled
        ? {
            subject: askDeclaredSubject(pathname, {scope: "species", slug, name, title: name, captureId}, null),
            avatarUrl,
            companionSpeciesProfileId
        }
        : null), [settled, pathname, slug, name, captureId, avatarUrl, companionSpeciesProfileId]);

    const page = useMemo<AskConversationPage>(() => ({
        onMenu: openSidebar,
        words,
        onAskAnother: (question: string) => {
            const ask = question.trim();
            router.push(getLocalePath(locale, ask ? `/talk?ask=${encodeURIComponent(ask.slice(0, 900))}` : "/talk"));
        },
        initialQuestion: query?.ask ?? null,
        appHref: "/#download",
        subject
    }), [openSidebar, words, router, locale, query?.ask, subject]);

    return (
        <>
            {settled ? (
                <AskSubjectBridge
                    scope="species"
                    slug={slug}
                    name={name}
                    title={name}
                    captureId={captureId}
                    avatarUrl={avatarUrl}
                    companionSpeciesProfileId={companionSpeciesProfileId}
                />
            ) : null}
            {subject ? (
                <AskConversation labels={labels} presentation="page" page={page} />
            ) : (
                <TalkChatShell
                    name={name}
                    power={power}
                    slug={slug}
                    onMenu={openSidebar}
                    words={words}
                    labels={labels}
                    // Someone else's card or their own: no public chat's capabilities.
                    showsCapabilities={!query?.card}
                />
            )}
        </>
    );
}

/**
 * The chat's frame while it gets ready, from the server's HTML: the header
 * with its face, name and Power, the contact card, what it can do and the
 * animal typing, in the conversation's own layout and components.
 */
function TalkChatShell({name, power, slug, onMenu, words, labels, showsCapabilities}: {
    name: string;
    power: string | null;
    slug: string;
    onMenu: () => void;
    words: TalkWords;
    labels: AskDrawerLabels;
    showsCapabilities: boolean;
}) {
    const face = getSpeciesImageRoute(slug);
    return (
        <div className="ask-page relative flex h-full min-h-0 w-full min-w-0 flex-col bg-canvas-950" aria-busy="true" data-testid="talk-chat-shell">
            <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
                <button type="button" onClick={onMenu} aria-label={words.openChats} title={words.openChats} className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-200 lg:hidden">
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h9" /></svg>
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="relative shrink-0">
                        <AskAnimalFace url={face} size={32} />
                        <span aria-hidden="true" className="absolute bottom-0 right-0 h-[9px] w-[9px] rounded-full border-2 border-canvas-950 bg-primary-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-sm font-semibold text-white">{name}</p>
                        {power ? <p className="truncate text-[11px] font-semibold leading-4 text-primary-300">{power}</p> : null}
                    </div>
                </div>
                <span aria-hidden="true" className="h-8 w-8 shrink-0" />
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col px-4 py-4">
                    <div className="flex min-h-full flex-1 flex-col">
                        <AskAnimalHero
                            name={name}
                            subtitle={labels.inOwnWords}
                            avatarUrl={face}
                            popularity={null}
                            differenceLine={labels.answersFromPower.replace("{name}", name)}
                        />
                        {showsCapabilities ? (
                            <TalkCapabilities
                                name={name}
                                animalName={name}
                                faceUrl={face}
                                speciesProfileId={null}
                                signedIn={false}
                                words={words}
                                companionWords={labels.companions}
                                appHref="/#download"
                            />
                        ) : null}
                        <div aria-hidden="true" className="min-h-7 flex-1" />
                        <AskTypingBubble avatarUrl={face} label={labels.typing} />
                    </div>
                </div>
            </div>
            <div className="relative shrink-0 border-t border-white/10 pb-4 pt-3">
                <div className="relative mx-auto w-full max-w-[760px] px-4">
                    <div className="flex items-end gap-2 border border-white/12 bg-white/[0.05] py-1.5 pl-4 pr-1.5" style={{borderRadius: 22}}>
                        <p className="min-h-[2.25rem] flex-1 py-1.5 text-[15px] leading-6 text-ink-400">{labels.placeholderFollowUpAnimal.replace("{animal}", name)}</p>
                        <span aria-hidden="true" className="mb-0.5 h-9 w-9 shrink-0 rounded-full bg-white/8" />
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-ink-400">{labels.disclaimer}</p>
                </div>
            </div>
        </div>
    );
}
