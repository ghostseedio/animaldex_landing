"use client";

import {useCallback, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {DebateRow} from "@/components/debates/debate-views";
import {useDebateUpdates} from "@/components/debates/use-debates";
import {splitMyDebates, type Debate} from "@/lib/debates";
import type {CompanionWords} from "@/lib/companion-bond";

/** My debates: the open ones first, then the past ones, each opening the debate. */
export default function DebatesHome({initialDebates, words}: {initialDebates: Debate[]; words: CompanionWords}) {
    const [debates, setDebates] = useState(initialDebates);
    useDebateUpdates(null, useCallback((debate: Debate) => {
        setDebates((current) => current.some((item) => item.id === debate.id)
            ? current.map((item) => (item.id === debate.id ? {...item, ...debate, participants: debate.participants.length > 0 ? debate.participants : item.participants} : item))
            : current);
    }, []));
    const {open, past} = useMemo(() => splitMyDebates(debates), [debates]);
    const web = words.debateWeb;

    return (
        <div className="flex flex-col px-5 lg:px-0">
            <h1 className="pb-1 pt-2 font-display text-2xl font-black text-white">{web.myDebates}</h1>
            {open.length === 0 && past.length === 0 ? (
                <div className="-mx-5 mt-3 flex flex-col items-start gap-2 border-y border-white/[0.08] px-5 py-6 lg:mx-0">
                    <p className="font-display text-xl font-black text-white">{web.empty}</p>
                    <p className="text-sm leading-6 text-white/60">{web.emptyBody}</p>
                    <Link href="/app/companions" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black hover:bg-primary-300">
                        {words.list.title}
                    </Link>
                </div>
            ) : null}
            {open.length > 0 ? (
                <section aria-label={web.open} className="mt-3">
                    <p className="-mx-5 border-b border-white/[0.08] px-5 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{web.open}</p>
                    {open.map((debate) => <DebateRow key={debate.id} debate={debate} words={words} href={`/app/debates/${debate.id}`} />)}
                </section>
            ) : null}
            {past.length > 0 ? (
                <section aria-label={web.past} className="mt-6">
                    <p className="-mx-5 border-b border-white/[0.08] px-5 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{web.past}</p>
                    {past.map((debate) => <DebateRow key={debate.id} debate={debate} words={words} href={`/app/debates/${debate.id}`} />)}
                </section>
            ) : null}
        </div>
    );
}
