"use client";

/**
 * Companions, the first tab (docs/companion-loop/SPEC.md, phase 4; iOS
 * `CompanionsTabView`): every animal you hold, in the server's order (an
 * unread message, a referral waiting, an open step, then the most recent). A
 * row is the animal as its icon art, its name, its level and stage, and one
 * line on where the two of you are: its newest unread message when it wrote
 * to you, with the unread dot. Animal messages live here, not in Messages; a
 * row with a conversation mutes or unmutes the animal from its menu.
 *
 * Tapping a row opens that animal's chat on the card you last talked through
 * in this browser, else its newest (iOS 5c980123). Before the server has the
 * bond, the animals you hold still show, without it.
 *
 * On top, "Your steps" (3.2, docs/your-step/SPEC.md section 5): every open
 * step across your animals (`animal_open_steps_v1`), "{name}: {step}"; a row
 * opens that animal's chat, where the step is pinned.
 *
 * Refreshed when the tab is opened and when the window comes back into view.
 *
 * Signed out, the tab says what to do instead of showing nothing (newcomer
 * UX vet, 2026-10-30, P1-10): sign in, or talk to an animal right now.
 */

import {useEffect, useMemo, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {AskMenu, MoreIcon} from "@/components/ask-animaldex/ask-messenger";
import {setAnimalMessagesMuted, useAnimalConversations} from "@/components/companions/use-animal-conversations";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {useOpenSteps} from "@/components/companions/use-steps";
import {companionRowHref, companionSummaryName, fillWords, type CompanionWords} from "@/lib/companion-bond";
import type {OpenStepRow} from "@/lib/your-step";
import {buildCompanionRows, type CompanionStatusKind, type CompanionTabRow} from "@/lib/companion-rows";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {TRY_TALKING_HREF} from "@/lib/try-talking";

const NEON = "#A7F432";

/** The status line's colour, as iOS draws each case. */
const STATUS_CLASS: Record<CompanionStatusKind, string> = {
    unread: "font-semibold text-white",
    referral: "font-semibold text-primary-300",
    step: "font-semibold text-primary-300",
    focus: "text-white/60",
    hello: "text-white/40"
};

/** The animal as its icon art (never a capture photo), ringed while it has something unread. */
function CompanionArt({slug, unread}: {slug: string | null; unread: boolean}) {
    const [failed, setFailed] = useState(false);
    return (
        <span className={`relative h-14 w-14 shrink-0 rounded-full ${unread ? "ring-2 ring-primary-400/70" : ""}`}>
            {slug && !failed ? (
                <Image
                    src={getSpeciesImageRoute(slug)}
                    alt=""
                    fill
                    sizes="56px"
                    unoptimized
                    className={`object-contain ${unread ? "p-1" : ""}`}
                    onError={() => setFailed(true)}
                />
            ) : null}
        </span>
    );
}

function BellSlashIcon({className = "h-3 w-3"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 16a2.6 2.6 0 0 0 5 0M5.2 5.6A5 5 0 0 0 5 7v3.2L3.5 13h10M8 3.3A5 5 0 0 1 15 7v3.2l.8 1.5M3 3l14 14" />
        </svg>
    );
}

function BellIcon({className = "h-3.5 w-3.5"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.5 16a2.6 2.6 0 0 0 5 0M5 7a5 5 0 0 1 10 0v3.2l1.5 2.8h-13L5 10.2V7Z" />
        </svg>
    );
}

function CompanionRow({
    row,
    href,
    words,
    onMute
}: {
    row: CompanionTabRow;
    href: string | null;
    words: CompanionWords;
    onMute: (row: CompanionTabRow) => void;
}) {
    const unread = row.unreadCount > 0;
    const body = (
        <>
            <CompanionArt slug={row.slug} unread={unread} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className={`truncate text-base text-white ${unread ? "font-black" : "font-bold"}`}>{row.displayName}</span>
                    {row.muted ? <span className="shrink-0 text-white/40"><BellSlashIcon /></span> : null}
                </span>
                {row.bondText ? (
                    <span className={`mt-0.5 block truncate text-xs font-semibold ${row.mastered ? "text-primary-300" : "text-white/55"}`}>{row.bondText}</span>
                ) : null}
                <span className={`mt-1 line-clamp-2 text-sm leading-5 ${STATUS_CLASS[row.status.kind]}`}>{row.status.text}</span>
                {/* What the dot and the bell say, for a screen reader. */}
                <span className="sr-only">
                    {unread ? `, ${fillWords(words.tab.unread, {n: row.unreadCount})}` : ""}
                    {row.muted ? `, ${words.tab.muted}` : ""}
                </span>
            </span>
            {unread ? (
                <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{backgroundColor: row.muted ? "rgb(255 255 255 / 0.35)" : NEON}}
                />
            ) : null}
            {row.hasConversation ? null : <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />}
        </>
    );
    const className = "flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-4 md:pl-5";
    return (
        // The whole band lights under the pointer, its menu included.
        <div className="flex items-center border-b border-white/[0.08] transition hover:bg-white/[0.03]">
            {href
                ? <Link href={href} className={`${className} ${row.hasConversation ? "pr-1" : "pr-4 md:pr-5"}`}>{body}</Link>
                : <div className={`${className} ${row.hasConversation ? "pr-1" : "pr-4 md:pr-5"}`}>{body}</div>}
            {row.hasConversation ? (
                // iOS swipes or presses a row to mute it; here it is the row's menu.
                <div className="shrink-0 pr-2.5 md:pr-3.5">
                    <AskMenu
                        label={words.tab.options}
                        align="right"
                        buttonClassName="grid h-9 w-9 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                        items={[{
                            label: row.muted ? words.tab.unmute : words.tab.mute,
                            icon: row.muted ? <BellIcon /> : <BellSlashIcon className="h-3.5 w-3.5" />,
                            onSelect: () => onMute(row)
                        }]}
                    >
                        <MoreIcon />
                    </AskMenu>
                </div>
            ) : null}
        </div>
    );
}

/** "Your steps": every open step, "{name}: {step}", each opening that animal's chat. */
function YourStepsSection({steps, href, words}: {steps: OpenStepRow[]; href: (step: OpenStepRow) => string | null; words: CompanionWords}) {
    if (steps.length === 0) return null;
    return (
        <section className="-mx-4 border-t border-white/[0.08] md:mx-0" aria-label={words.journey.steps.sectionTitle} data-testid="your-steps">
            <h2 className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55 md:px-5">{words.journey.steps.sectionTitle}</h2>
            {steps.map((step) => {
                const target = href(step);
                const body = (
                    <>
                        <CompanionArt slug={step.slug} unread={false} />
                        <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-white">
                            {fillWords(words.journey.steps.row, {name: companionSummaryName(step, words), step: step.step})}
                        </span>
                        <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />
                    </>
                );
                const className = "flex min-h-14 items-center gap-3.5 border-t border-white/[0.06] px-4 py-3 md:px-5";
                return target ? (
                    <Link key={step.id} href={target} className={`${className} transition hover:bg-white/[0.03]`}>{body}</Link>
                ) : (
                    <div key={step.id} className={className}>{body}</div>
                );
            })}
        </section>
    );
}

export default function CompanionsPage({words}: {words: CompanionWords}) {
    const {isAuthenticated} = useAppShellChrome();
    return isAuthenticated ? <YourCompanions words={words} /> : <SignedOutCompanions words={words} />;
}

/** Signed out: sign in to meet your animals, or talk to one now. */
function SignedOutCompanions({words}: {words: CompanionWords}) {
    return (
        <AppPage narrow>
            <AppPageHeader eyebrow="AnimalDex" title={words.list.title} />
            <div className="-mx-4 flex flex-col items-start gap-4 border-y border-white/[0.08] px-4 py-8 md:mx-0 md:px-5">
                <p className="text-base font-semibold leading-7 text-white">{words.tab.signedOut}</p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/account?next=/app"
                        className="inline-flex min-h-11 items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                    >
                        {words.tab.signIn}
                    </Link>
                    <Link
                        href={TRY_TALKING_HREF}
                        className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        {words.tab.tryTalking}
                    </Link>
                </div>
            </div>
        </AppPage>
    );
}

function YourCompanions({words}: {words: CompanionWords}) {
    const {rows: companions, didLoad, available, reload} = useCompanions();
    const {cards, didLoad: cardsLoaded, available: cardsAvailable, reload: reloadCards} = useCompanionCards();
    const {conversations, reload: reloadConversations} = useAnimalConversations();
    const {steps, reload: reloadSteps} = useOpenSteps();
    const [muteFailed, setMuteFailed] = useState(false);

    useEffect(() => {
        const refresh = () => {
            void reload();
            void reloadCards();
            void reloadConversations();
            void reloadSteps();
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [reload, reloadCards, reloadConversations, reloadSteps]);

    const rows = useMemo(
        () => buildCompanionRows({companions, conversations, cards, words}),
        [companions, conversations, cards, words]
    );

    const mute = (row: CompanionTabRow) => {
        setMuteFailed(false);
        void setAnimalMessagesMuted(row.speciesProfileId, !row.muted).then((ok) => setMuteFailed(!ok));
    };

    // Nothing to show yet, and nothing has said there is nothing.
    const isFirstLoad = rows.length === 0 && !(didLoad && cardsLoaded);

    return (
        <AppPage narrow>
            <AppPageHeader eyebrow="AnimalDex" title={words.list.title} />
            {muteFailed ? (
                <p role="alert" className="-mx-4 border-y border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/70 md:mx-0 md:px-5">
                    {words.tab.muteFailed}
                </p>
            ) : null}
            {isFirstLoad ? (
                <div className="-mx-4 md:mx-0" aria-busy="true">
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="flex items-center gap-3.5 border-b border-white/[0.08] px-4 py-3.5">
                            <span className="h-14 w-14 shrink-0 rounded-full bg-white/[0.05]" />
                            <span className="h-4 w-40 bg-white/[0.05]" />
                        </div>
                    ))}
                </div>
            ) : rows.length === 0 && !available && !cardsAvailable ? (
                // Neither the bond nor your cards could be read: your animals
                // are still all in the Collection.
                <div className="-mx-4 border-y border-white/[0.08] px-4 py-6 md:mx-0 md:px-5">
                    <Link
                        href="/app/collection"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        <AppIcon name="collection" /> {words.tab.collection}
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
                <>
                    <YourStepsSection
                        steps={steps}
                        words={words}
                        // That animal's chat, on the card you last talked through, with the step pinned.
                        href={(step) => companionRowHref({
                            captureId: chatCaptureIdFor(cards, step.speciesProfileId, step.captureId),
                            referralWaiting: false,
                            referralId: null
                        })}
                    />
                    <div className="-mx-4 border-t border-white/[0.08] md:mx-0">
                        {rows.map((row) => (
                            <CompanionRow
                                key={row.speciesProfileId}
                                row={row}
                                // Its chat, on the card you last talked through (else
                                // its newest); on the referral, when one is waiting.
                                href={companionRowHref({
                                    captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId),
                                    referralWaiting: row.referralWaiting,
                                    referralId: row.referralId
                                })}
                                words={words}
                                onMute={mute}
                            />
                        ))}
                    </div>
                </>
            )}
        </AppPage>
    );
}
