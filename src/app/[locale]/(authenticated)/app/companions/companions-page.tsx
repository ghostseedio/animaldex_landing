"use client";

/**
 * Companions, the first tab (docs/companion-loop/SPEC.md, phase 4; iOS
 * `CompanionsTabView`): a messaging roster of every animal you hold (polish
 * pass, DESIGN.md section 1). Sorted by what needs you (an unread message,
 * an open step, a referral), then every animal with a conversation, newest
 * message first, then the animals never talked to in the server's order
 * (`companion-roster.ts`, pure and tested).
 *
 * One row, one look: the animal as its icon art at 48 in a circle, a neon
 * ring only when something needs you; the name (bold while unread); exactly
 * one line under it: the animal's last words, the open step with the step
 * glyph in neon, the referral, the newest message's words (yours or its), or
 * its Power; on the right the time of the conversation and the unread dot.
 * No stage words, no "Working on:", no level, no menu (muting is in the
 * chat's ••• menu), no "Your steps" band: a step lives on its animal's row and
 * inside its chat.
 *
 * Tapping a row opens that animal's chat on the card you last talked through
 * in this browser, else its newest (iOS 5c980123). Before the server has the
 * bond, the animals you hold still show, without it. Refreshed when the tab
 * is opened and when the window comes back into view.
 *
 * Signed out, the tab says what to do instead of showing nothing (newcomer
 * UX vet, 2026-10-30, P1-10): sign in, or talk to an animal right now.
 *
 * With the remote switch `talk_front_door` on (the page reads it on the
 * server and passes `frontDoor`), the Talk front door is the first thing
 * under the title: a full-width band, "What's on your mind?", that chooses
 * which animal hears it (AnimalDex docs/talk-front-door/SPEC.md, section 4).
 * Without it the tab is exactly as before.
 */

import {rosterLine} from "@/lib/companion-roster";
import {cachedCompanionRow, rememberedCompanion} from "@/lib/companions-opening";
import AppSplash from "@/components/brand/app-splash";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import type {AskDrawerLabels} from "@/components/ask-animaldex/ask-conversation";
import type {TalkWords} from "@/lib/ask-animaldex/talk";
import {CompanionRow} from "@/app/[locale]/(authenticated)/app/companions/companion-row";
import {chatCaptureIdFor} from "@/components/companions/use-companions";
import {useCompanionRoster, type CompanionRosterEntry} from "@/components/companions/use-companion-roster";
import {useEffect, useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {companionRowHref, fillWords, type CompanionWords} from "@/lib/companion-bond";
import type {CompanionCard} from "@/lib/companion-cards";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import type {CompanionTabRow} from "@/lib/companion-rows";
import {TRY_TALKING_HREF, TRY_TALKING_SPECIES} from "@/lib/try-talking";
import TalkFrontDoorBand from "@/components/talk-front-door/talk-front-door-band";
import {useFrontDoorOwnAnimals} from "@/components/talk-front-door/use-front-door-animals";
import {featuredFrontDoorAnimal, meetOneNowAnimals, type TalkFrontDoorWords} from "@/lib/talk-front-door";
import type {TalkAnimal} from "@/lib/ask-animaldex/talk";

/**
 * The chat, with the conversation (the app's largest script), loads beside
 * the roster's read instead of before the page can hydrate: on the server
 * this tab draws the splash anyway (perf pass, 2026-11-06).
 */
const loadCompanionsChat = () => import("@/app/[locale]/(authenticated)/app/companions/companions-chat");
const CompanionsChat = dynamic(loadCompanionsChat, {ssr: false, loading: () => <AppSplash />});
// Started as this script runs, before the page hydrates, so it downloads beside the page's own.
if (typeof window !== "undefined") void loadCompanionsChat();

/** The Talk front door's part of the tab, when its switch is on. */
export type CompanionsFrontDoor = {
    words: TalkFrontDoorWords;
    /** The featured Talk animals: "Meet one now" for someone with no animals yet. */
    featured: TalkAnimal[];
};

/** The page's title: display 24/28, nothing above it. */
function Title({children}: {children: string}) {
    return <h1 className="font-display text-[24px] font-bold leading-8 text-white sm:text-[28px] sm:leading-9">{children}</h1>;
}

export default function CompanionsPage({words, locale = "en", frontDoor = null, labels = null, talk = null}: {
    words: CompanionWords;
    locale?: string;
    /** Set only with `talk_front_door` on. */
    frontDoor?: CompanionsFrontDoor | null;
    /**
     * The conversation's labels and the Talk page's words: with both, the tab
     * is the chat (the owner, 2026-11-06). Without them (the dev gallery), the
     * roster of rows.
     */
    labels?: AskDrawerLabels | null;
    talk?: TalkWords | null;
}) {
    const {isAuthenticated} = useAppShellChrome();
    return isAuthenticated
        ? <YourCompanions words={words} locale={locale} frontDoor={frontDoor} labels={labels} talk={talk} />
        : <SignedOutCompanions words={words} />;
}

/**
 * The Talk front door on Companions: edge to edge right under the title, on
 * the tab's band rhythm; the rows follow with no gap.
 */
function CompanionsFrontDoorBand({frontDoor, words, locale}: {frontDoor: CompanionsFrontDoor; words: CompanionWords; locale: string}) {
    const {animals} = useFrontDoorOwnAnimals(true, words);
    const meetOneNow = useMemo(
        () => meetOneNowAnimals(frontDoor.featured.map(featuredFrontDoorAnimal), TRY_TALKING_SPECIES.slug),
        [frontDoor.featured]
    );
    return (
        <TalkFrontDoorBand
            words={frontDoor.words}
            surface="app"
            locale={locale}
            signedIn
            own={animals}
            meetOneNow={meetOneNow}
            className="-mx-4 mt-4 border-y border-white/[0.08] px-4 py-3 md:mx-0 md:px-5"
        />
    );
}

/** Signed out: sign in to meet your animals, or talk to one now. */
function SignedOutCompanions({words}: {words: CompanionWords}) {
    return (
        <div className="mx-auto max-w-3xl">
            <Title>{words.list.title}</Title>
            <div className="-mx-4 mt-4 flex flex-col items-start gap-4 border-y border-white/[0.08] px-4 py-8 md:mx-0 md:px-5">
                <p className="text-[15px] font-semibold leading-6 text-white">{words.tab.signedOut}</p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/account?next=/app"
                        className="inline-flex min-h-11 items-center rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    >
                        {words.tab.signIn}
                    </Link>
                    <Link
                        href={TRY_TALKING_HREF}
                        className="inline-flex min-h-11 items-center rounded-pill border border-white/12 bg-white/[0.05] px-5 text-[13px] font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
                    >
                        {words.tab.tryTalking}
                    </Link>
                </div>
            </div>
        </div>
    );
}

function YourCompanions({words, locale, frontDoor, labels, talk}: {
    words: CompanionWords;
    locale: string;
    frontDoor: CompanionsFrontDoor | null;
    labels: AskDrawerLabels | null;
    talk: TalkWords | null;
}) {
    const {entries: roster, cards, didLoad, cardsLoaded, available, cardsAvailable} = useCompanionRoster(words);

    // Nothing to show yet, and nothing has said there is nothing.
    const isFirstLoad = roster.length === 0 && !(didLoad && cardsLoaded);
    // The remembered animal, from what this browser kept of it (read after
    // mount: storage is the browser's, not the server's), so a returning
    // person goes splash → chat before the roster has loaded (the owner,
    // 2026-11-07); the loaded rows take over in place.
    const [cachedRow, setCachedRow] = useState<CompanionTabRow | null>(null);
    useEffect(() => { setCachedRow(cachedCompanionRow(rememberedCompanion())); }, []);
    const cachedEntries = useMemo<CompanionRosterEntry[]>(
        () => (cachedRow ? [{row: cachedRow, line: rosterLine(cachedRow, null, words), time: cachedRow.lastActivityAt}] : []),
        [cachedRow, words]
    );

    // The tab is the chat (the owner, 2026-11-06): the animal they were with
    // last, open, and the others behind its name. The roster below stays for
    // the moments before there is anyone to talk to.
    if (labels && talk && roster.length > 0) {
        return <CompanionsChat entries={roster} cards={cards} words={words} labels={labels} talk={talk} locale={locale} />;
    }
    if (labels && talk && isFirstLoad && cachedEntries.length > 0) {
        return <CompanionsChat entries={cachedEntries} cards={cards} words={words} labels={labels} talk={talk} locale={locale} />;
    }
    // Nothing to show yet, and nothing has said there is nothing: the splash,
    // not the roster and its skeleton (the owner, 2026-11-06).
    if (isFirstLoad) {
        return <AppSplash />;
    }
    // Under the front door's band, the next band starts at its edge: no gap, no second hairline.
    const top = frontDoor ? "mt-0" : "mt-4";
    const ruled = frontDoor ? "border-b" : "border-y";

    return (
        <div className="mx-auto max-w-3xl">
            <Title>{words.list.title}</Title>
            {frontDoor ? <CompanionsFrontDoorBand frontDoor={frontDoor} words={words} locale={locale} /> : null}
            {isFirstLoad ? (
                // The skeleton is the row's own layout: 64 tall, the circle, two lines, the hairline.
                <div className={`-mx-4 ${top} md:mx-0`} aria-busy="true" data-testid="companions-skeleton">
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="flex h-16 items-center gap-3 pl-4 md:pl-5">
                            <span className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                            <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2 border-b border-white/[0.08] pr-4">
                                <span className="block h-3.5 w-36 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                                <span className="block h-3 w-56 max-w-full rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
                            </span>
                        </div>
                    ))}
                </div>
            ) : roster.length === 0 && !available && !cardsAvailable ? (
                // Neither the bond nor your cards could be read: your animals
                // are still all in the Collection.
                <div className={`-mx-4 ${top} ${ruled} border-white/[0.08] px-4 py-6 md:mx-0 md:px-5`}>
                    <Link
                        href="/app/collection"
                        className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-white/12 bg-white/[0.05] px-5 text-[13px] font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
                    >
                        <AppIcon name="collection" /> {words.tab.collection}
                    </Link>
                </div>
            ) : roster.length === 0 ? (
                // Empty: art, one line, Capture, and the public chats as the other way in.
                <div className={`-mx-4 ${top} flex flex-col items-center gap-4 ${ruled} border-white/[0.08] px-4 py-10 text-center md:mx-0 md:px-5`} data-testid="companions-empty">
                    <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-primary-400/10 text-primary-200">
                        <AppIcon name="companions" className="h-8 w-8" />
                    </span>
                    <p className="text-[15px] font-semibold leading-6 text-white">{words.list.empty}</p>
                    <Link
                        href="/app/capture"
                        className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    >
                        <AppIcon name="camera" /> {words.list.capture}
                    </Link>
                    <Link href={TRY_TALKING_HREF} className="text-[13px] font-semibold text-white/60 transition-colors hover:text-white">
                        {words.tab.meetOneNow}
                    </Link>
                </div>
            ) : (
                // The rows fade in once, when the list first mounts; a refresh keeps them.
                // Rows for the animals with something going on; the ones never
                // talked to are faces under them (design pass, 2026-11-06, as iOS),
                // so a message and an idle animal no longer weigh the same. With
                // nothing going on anywhere, everyone is a row.
                <div className={`rows-in -mx-4 ${top} md:mx-0`} data-testid="companions-roster">
                    {(() => {
                        const quiet = roster.filter(({line}) => line.kind === "power" || line.kind === "hello");
                        const active = quiet.length === roster.length ? roster : roster.filter(({line}) => line.kind !== "power" && line.kind !== "hello");
                        const hrefOf = (row: CompanionTabRow) => companionRowHref({
                            captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId),
                            referralWaiting: row.referralWaiting,
                            referralId: row.referralId
                        });
                        return (
                            <>
                                {active.map(({row, line, time}) => (
                                    <CompanionRow
                                        key={row.speciesProfileId}
                                        row={row}
                                        line={line}
                                        time={time}
                                        locale={locale}
                                        words={words}
                                        // Its chat, on the card you last talked through (else
                                        // its newest); on the referral, when one is waiting.
                                        href={hrefOf(row)}
                                    />
                                ))}
                                {active.length < roster.length ? (
                                    // A shelf (second pass, 2026-11-06, as iOS): the "Say hello" band header,
                                    // then faces with names in a row that scrolls sideways.
                                    <div data-testid="companions-faces">
                                        <p className="bg-[#12351C]/60 px-4 pb-2 pt-3.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/40 md:px-5">{words.list.shelf}</p>
                                        <div className="flex gap-2 overflow-x-auto px-1.5 pb-3 pt-4 [scrollbar-width:none] md:px-2.5 [&::-webkit-scrollbar]:hidden">
                                            {quiet.map(({row}) => {
                                                const href = hrefOf(row);
                                                const face = (
                                                    <>
                                                        <AskAnimalFace url={row.slug ? getSpeciesImageRoute(row.slug) : null} size={64} />
                                                        <span className="line-clamp-2 text-center text-[13px] font-semibold leading-4 text-white/60">{row.displayName}</span>
                                                    </>
                                                );
                                                const className = "flex w-[84px] shrink-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-80 active:opacity-70";
                                                return href
                                                    ? <Link key={row.speciesProfileId} href={href} className={className} data-testid="companion-face">{face}</Link>
                                                    : <div key={row.speciesProfileId} className={className} data-testid="companion-face">{face}</div>;
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
