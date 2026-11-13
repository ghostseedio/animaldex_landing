"use client";

/**
 * Which of the two /talk/<slug> renders a reader gets (CC 5). The server's
 * HTML is the indexable landing page: the article, the sample exchange, the
 * questions and the Ask entry. Before the first paint in the browser this
 * swaps it for the full-screen chat (`TalkChat`, exactly what every
 * /talk/<slug> opened before) when the reader is signed in (the Supabase
 * auth cookie), or arrives with the chat's own query (`?card=` their card,
 * `?ask=` a carried question, `?chat=1` from the landing's own button). So
 * the signed-in experience is unchanged, and a signed-out reader sees the
 * landing, with the chat one tap away.
 */

import {useEffect, useLayoutEffect, useState, type ReactNode} from "react";
import TalkChat from "@/app/[locale]/talk/talk-chat";
import {useTalkShell} from "@/app/[locale]/talk/talk-shell";
import Link from "@/app/[locale]/_components/link";
import {AiTag} from "@/components/ai-gate/ai-notices";
import {TALK_LANDING_WORDS, talkLandingWantsChat} from "@/lib/talk-landing";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function TalkLandingSwitch({slug, name, power, locale, aiTagLabel, children}: {
    slug: string;
    name: string;
    power: string | null;
    locale: string;
    aiTagLabel: string;
    children: ReactNode;
}) {
    const [chat, setChat] = useState(false);
    useIsomorphicLayoutEffect(() => {
        if (talkLandingWantsChat(window.location.search, document.cookie)) setChat(true);
    }, []);
    const {openSidebar, words} = useTalkShell();

    if (chat) return <TalkChat key={slug} slug={slug} name={name} power={power} locale={locale} />;

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-canvas-950" data-testid="talk-landing">
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
                <button type="button" onClick={openSidebar} aria-label={words.openChats} title={words.openChats} className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center text-ink-200 lg:hidden">
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h9" /></svg>
                </button>
                <Link href="/talk" className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-white">
                    {TALK_LANDING_WORDS.backToTalk}
                </Link>
                <span aria-hidden="true" className="text-ink-500">/</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{name}</span>
                <AiTag label={aiTagLabel} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
    );
}
