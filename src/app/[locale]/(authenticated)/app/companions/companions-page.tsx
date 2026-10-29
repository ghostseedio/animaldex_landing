"use client";

/**
 * Companions, the first tab (docs/companion-loop/SPEC.md, phase 4): every
 * animal you hold, in the server's order (an unread message, a referral
 * waiting, an open step, then the most recent). A row is the animal as its
 * icon art, its name, its level and stage, and one line on where the two of
 * you are. Tapping it opens that animal's chat on the card you last talked
 * through in this browser, else its newest (iOS 5c980123).
 *
 * Refreshed when the tab is opened and when the window comes back into view.
 */

import {useEffect, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {
    bondChipText,
    companionRowHref,
    companionStatusLine,
    companionSummaryName,
    type CompanionSummary,
    type CompanionWords
} from "@/lib/companion-bond";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

const NEON = "#A7F432";

/** The group chat row says what it is for until it has been tried (iOS `ProMoments.secondCompanion`). */
const GROUP_CHAT_INTRO_SEEN_KEY = "animaldex:companions:group-chat-intro-seen";

function readIntroSeen(): boolean {
    try {
        return window.localStorage.getItem(GROUP_CHAT_INTRO_SEEN_KEY) === "1";
    } catch {
        return false;
    }
}

/**
 * "Talk to several animals": the group chat's own picker, then the chat.
 * Once a second animal is yours, the row says what it is for, until tried.
 */
function GroupChatRow({isNew, words}: {isNew: boolean; words: CompanionWords}) {
    return (
        <Link
            href="/app/companions/group"
            onClick={() => {
                try {
                    window.localStorage.setItem(GROUP_CHAT_INTRO_SEEN_KEY, "1");
                } catch {
                    // Shown again next time, then.
                }
            }}
            className="flex min-h-14 items-center gap-3.5 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05] md:px-5"
        >
            <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center" style={{color: NEON}}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h8A2.5 2.5 0 0 1 16 6.5v5a2.5 2.5 0 0 1-2.5 2.5H8l-3.5 3v-3.2A2.5 2.5 0 0 1 3 11.5v-5Zm15 2.5h.5A2.5 2.5 0 0 1 21 11.5v5a2.5 2.5 0 0 1-1.5 2.3V22L16 19h-4.5a2.5 2.5 0 0 1-2.3-1.5H13.5A4.5 4.5 0 0 0 18 13V9Z" />
                </svg>
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-white">{words.list.talkToSeveral}</span>
                    {isNew ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor: NEON}} /> : null}
                </span>
                {isNew ? <span className="mt-0.5 block text-sm leading-5 text-white/60">{words.list.talkToSeveralIntro}</span> : null}
            </span>
            <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />
        </Link>
    );
}

function CompanionArt({slug}: {slug: string | null}) {
    const [failed, setFailed] = useState(false);
    if (!slug || failed) return <span aria-hidden="true" className="h-14 w-14 shrink-0" />;
    return (
        <span className="relative h-14 w-14 shrink-0">
            <Image src={getSpeciesImageRoute(slug)} alt="" fill sizes="56px" unoptimized className="object-contain" onError={() => setFailed(true)} />
        </span>
    );
}

function CompanionRow({row, href, words}: {row: CompanionSummary; href: string | null; words: CompanionWords}) {
    const status = companionStatusLine(row, null, words);
    const unread = row.unread > 0;
    const body = (
        <>
            <CompanionArt slug={row.slug} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-white">{companionSummaryName(row, words)}</span>
                    {row.mastered ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-black" style={{backgroundColor: NEON}}>
                            {words.list.mastered}
                        </span>
                    ) : null}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-white/55">{bondChipText(row, words)}</span>
                <span className={`mt-1 flex items-center gap-1.5 text-sm ${unread ? "font-semibold text-white" : "text-white/60"}`}>
                    {unread ? <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: NEON}} /> : null}
                    <span className="truncate">{status.text}</span>
                </span>
            </span>
            <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />
        </>
    );
    const className = "flex items-center gap-3.5 border-b border-white/[0.08] px-4 py-3.5 transition hover:bg-white/[0.03] md:px-5";
    return href
        ? <Link href={href} className={className}>{body}</Link>
        : <div className={className}>{body}</div>;
}

export default function CompanionsPage({words}: {words: CompanionWords}) {
    const {rows, didLoad, available, reload} = useCompanions();
    const {cards, reload: reloadCards} = useCompanionCards();
    const [groupIntroSeen, setGroupIntroSeen] = useState(true);
    useEffect(() => setGroupIntroSeen(readIntroSeen()), []);

    useEffect(() => {
        void reload();
        void reloadCards();
        const onFocus = () => {
            void reload();
            void reloadCards();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [reload, reloadCards]);

    return (
        <AppPage narrow>
            <AppPageHeader eyebrow="AnimalDex" title={words.list.title} />
            {!didLoad ? (
                <div className="-mx-4 md:mx-0" aria-busy="true">
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="flex items-center gap-3.5 border-b border-white/[0.08] px-4 py-3.5">
                            <span className="h-14 w-14 shrink-0 bg-white/[0.05]" />
                            <span className="h-4 w-40 bg-white/[0.05]" />
                        </div>
                    ))}
                </div>
            ) : !available ? (
                // The list could not be read (or the bond is not live yet):
                // your animals are still all in the Collection.
                <div className="-mx-4 border-y border-white/[0.08] px-4 py-6 md:mx-0 md:px-5">
                    <Link
                        href="/app/collection"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        <AppIcon name="collection" /> Collection
                    </Link>
                </div>
            ) : rows.length === 0 ? (
                <div className="-mx-4 flex flex-col items-start gap-4 border-y border-white/[0.08] px-4 py-8 md:mx-0 md:px-5">
                    <p className="text-base font-semibold text-white">{words.list.empty}</p>
                    <Link
                        href="/app/capture"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                    >
                        <AppIcon name="camera" /> {words.list.capture}
                    </Link>
                </div>
            ) : (
                <div className="-mx-4 border-t border-white/[0.08] md:mx-0">
                    <GroupChatRow isNew={rows.length >= 2 && !groupIntroSeen} words={words} />
                    {rows.map((row) => (
                        <CompanionRow
                            key={row.speciesProfileId}
                            row={row}
                            // Its chat, on the card you last talked through (else
                            // its newest); on the referral, when one is waiting.
                            href={companionRowHref({...row, captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId)})}
                            words={words}
                        />
                    ))}
                </div>
            )}
        </AppPage>
    );
}
