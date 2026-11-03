"use client";

import Link from "@/app/[locale]/_components/link";
import DebateThread from "@/components/debates/debate-thread";
import {debateHeadline} from "@/lib/debate-words";
import type {CompanionWords} from "@/lib/companion-bond";
import type {Debate} from "@/lib/debates";

/** A debate on its own page: what it is about, then the debate itself. Read here; the asker's chat runs it. */
export default function DebateDetail({debate, words, typingLabel, backLabel, locale}: {
    debate: Debate;
    words: CompanionWords;
    typingLabel: string;
    backLabel: string;
    locale: string;
}) {
    const headline = debateHeadline(debate);
    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pb-12 lg:px-0">
            <Link href="/app/debates" className="inline-flex min-h-9 items-center gap-1.5 self-start text-sm font-bold text-white/70 hover:text-white">
                <span aria-hidden="true">←</span> {backLabel}
            </Link>
            {headline ? (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        {debate.askerIsMe && debate.visibility === "private" ? words.debateWeb.yourDebate : words.debate.voteQuestion}
                    </p>
                    <h1 className="mt-1 font-display text-2xl font-black leading-8 text-white">{headline}</h1>
                    {debate.askedPublic ? (
                        <p className="mt-2 text-xs font-semibold text-white/55">{words.debateWeb.askedPublicNote}</p>
                    ) : null}
                </div>
            ) : null}
            <DebateThread seed={debate} words={words} typingLabel={typingLabel} locale={locale} />
        </div>
    );
}
