"use client";

/**
 * The floating "Talk to…" pill, and the conversation it opens.
 *
 * One concept (DECISIONS §8, 2026-11-01): the generic "Ask AnimalDex"
 * assistant is retired from public pages.
 * - A species page keeps its animal's pill, "Talk to the {animal}", which
 *   opens the drawer.
 * - Elsewhere, only where the header hides its own Talk button (below
 *   1280 px), a "Talk to an animal" pill links to /talk, once the hero has
 *   scrolled away.
 * - Either pill appears once the first screen has scrolled away (the hero
 *   carries its own Talk button), and steps aside whenever it would sit over
 *   something tappable, so it never covers a link, a button or a field.
 *
 * Mounted once for the whole site. The panel itself is loaded on demand, so a
 * reader who never opens it never downloads the markdown renderer, the visual
 * mediums or the chart — this sits on every page, including the SEO ones.
 *
 * It also answers the `animaldex:ask` event that species pages already
 * dispatch, which is how an inline "Why?" link anywhere on a page starts a real
 * conversation without that page knowing anything about this component.
 */

import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {SPECIES_ASK_EVENT} from "@/lib/ask-animaldex/events";
import type {AskDrawerLabels} from "@/components/ask-animaldex/ask-drawer";

// While the panel's code loads, its frame with the animal's header, never an
// empty screen (newcomer UX vet, 2026-10-30, P0-2).
const AskDrawer = dynamic(() => import("@/components/ask-animaldex/ask-drawer"), {ssr: false, loading: () => <AskDrawerShell />});

/**
 * The drawer's frame as it opens: the animal's face and name in the header
 * and on its card, and the animal typing, until the conversation itself has
 * loaded. Kept to the provider's subject, so this stays small on every page.
 */
function AskDrawerShell() {
    const {subject, avatarUrl, close} = useAskAnimalDex();
    const name = subject.scope === "species" ? subject.name : null;
    const face = (size: number) => (
        <span className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.06]" style={{width: size, height: size}}>
            {avatarUrl && name ? <Image src={avatarUrl} unoptimized alt="" fill sizes={`${size}px`} className="object-contain p-[8%]" /> : null}
        </span>
    );
    return (
        <>
            <button type="button" aria-hidden="true" tabIndex={-1} onClick={close} className="fixed inset-0 z-[60] bg-canvas-950/60 backdrop-blur-[2px] lg:hidden" />
            <div
                role="dialog"
                aria-modal="false"
                aria-busy="true"
                aria-label={name ?? undefined}
                className="ask-panel fixed inset-x-0 bottom-0 z-[61] flex h-[85vh] flex-col border-t border-white/12 bg-canvas-950 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
                data-testid="ask-drawer-shell"
            >
                <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 pb-3 pt-4 lg:pt-3">
                    {face(32)}
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</p>
                </header>
                <div className="flex flex-1 flex-col items-center px-6 pt-10 text-center">
                    {name ? (
                        <>
                            {face(96)}
                            <p className="mt-3 font-display text-2xl font-bold leading-8 text-white">{name}</p>
                        </>
                    ) : null}
                    <span aria-hidden="true" className="mt-8 flex gap-[5px]">
                        {[0, 1, 2].map((dot) => (
                            <span key={dot} className="ask-typing-dot h-[7px] w-[7px] rounded-full bg-white/75" style={{animationDelay: `${dot * 150}ms`}} />
                        ))}
                    </span>
                </div>
            </div>
        </>
    );
}

/** What a person can tap: a pill resting over any of these would hide it. */
const TAPPABLE = "a[href], button, input, select, textarea, summary, label, video[controls], [role='button'], [role='link'], [role='tab'], [tabindex]:not([tabindex='-1'])";

/** Pages where a floating pill would compete with the page's own task. */
const QUIET_PATHS = [/^\/account(\/|$)/, /^\/checkout(\/|$)/, /^\/billing(\/|$)/, /^\/legal(\/|$)/, /^\/admin(\/|$)/];

/**
 * Whether a pill at `rect` would rest over tappable content. Samples a grid
 * of points across the pill and asks what lies beneath, ignoring the pill.
 */
function coversTappable(pill: HTMLElement): boolean {
    const rect = pill.getBoundingClientRect();
    if (rect.width === 0) return false;
    const inset = 4;
    const xs = [rect.left + inset, rect.left + rect.width / 2, rect.right - inset];
    const ys = [rect.top + inset, rect.top + rect.height / 2, rect.bottom - inset];
    for (const x of xs) {
        for (const y of ys) {
            for (const element of document.elementsFromPoint(x, y)) {
                if (element === pill || pill.contains(element)) continue;
                if (element.closest(TAPPABLE)) return true;
            }
        }
    }
    return false;
}

/**
 * Shown or hidden, for a pill that must never cover tappable content: checked
 * when scrolling settles, on resize and when focus moves; `afterHero` holds it
 * back until the first screen has scrolled away.
 */
function usePillPlacement(enabled: boolean, afterHero: boolean) {
    const ref = useRef<HTMLElement | null>(null);
    const [shown, setShown] = useState(false);
    const evaluate = useCallback(() => {
        const pill = ref.current;
        if (!pill) return;
        const active = document.activeElement;
        const typing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
        const pastHero = !afterHero || window.scrollY > window.innerHeight * 0.75;
        setShown(pastHero && !typing && !coversTappable(pill));
    }, [afterHero]);

    useEffect(() => {
        if (!enabled) return;
        let timer = 0;
        const settle = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(evaluate, 140);
        };
        evaluate();
        // Content that loads in after the first paint (images, embeds) moves things under the pill.
        const late = window.setTimeout(evaluate, 1200);
        window.addEventListener("scroll", settle, {passive: true});
        window.addEventListener("resize", settle);
        document.addEventListener("focusin", settle);
        document.addEventListener("focusout", settle);
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(late);
            window.removeEventListener("scroll", settle);
            window.removeEventListener("resize", settle);
            document.removeEventListener("focusin", settle);
            document.removeEventListener("focusout", settle);
        };
    }, [enabled, evaluate]);

    return {ref, shown};
}

/**
 * The pill's shell. Hidden, it stays in place (to be measured) but fades out,
 * takes no pointer and leaves the tab order. Motion is the site's state-change
 * curve; under reduced motion it only fades.
 */
function FloatingPill({
    shown,
    pillRef,
    className = "",
    children
}: {
    shown: boolean;
    pillRef: (element: HTMLElement | null) => void;
    className?: string;
    children: (props: {tabIndex: number; className: string}) => ReactNode;
}) {
    return (
        <div
            ref={pillRef}
            aria-hidden={shown ? undefined : true}
            className={`fixed right-4 z-[55] bottom-[calc(1.25rem+env(safe-area-inset-bottom))] transition-[opacity,transform] duration-[240ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] motion-reduce:translate-y-0 motion-reduce:transition-opacity lg:right-6 lg:bottom-6 ${
                shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            } ${className}`}
        >
            {children({
                tabIndex: shown ? 0 : -1,
                className: "group flex min-h-12 items-center gap-2 rounded-full border border-primary-300/35 bg-canvas-950 py-2 pl-2 pr-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors hover:border-primary-300/70 hover:bg-canvas-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
            })}
        </div>
    );
}

function TalkGlyph() {
    return (
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-400 text-canvas-950">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5h16v10H9.5L5 19.5v-4H4z" />
            </svg>
        </span>
    );
}

export default function AskAnimalDexSurface({labels}: {labels: AskDrawerLabels & {launcher: string}}) {
    const {isOpen, open, close, subject, avatarUrl} = useAskAnimalDex();
    // On the Talk page the page is the chat: a drawer left open elsewhere closes, so it doesn't reopen on the next page.
    const onTalk = subject.kind === "talk";
    useEffect(() => {
        if (onTalk && isOpen) close();
    }, [onTalk, isOpen, close]);
    const [mounted, setMounted] = useState(false);

    // The launcher is client-only chrome. Rendering it during hydration of a
    // statically generated page would put it in the HTML of every cached SEO
    // page for no benefit.
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onAsk = (event: Event) => {
            const detail = (event as CustomEvent<{question?: string}>).detail;
            open(detail?.question);
        };
        window.addEventListener(SPECIES_ASK_EVENT, onAsk);
        return () => window.removeEventListener(SPECIES_ASK_EVENT, onAsk);
    }, [open]);

    // On a species page the animal itself answers, so the pill is the
    // animal: its picture and its name.
    const speaksAsAnimal = subject.scope === "species" && Boolean(subject.name);
    const quiet = onTalk
        || isOpen
        // A card has its own Talk to it button in its action bar (docs/companion-loop/SPEC.md, phase 3).
        || subject.kind === "capture"
        // The web app has its own Companions tab and a tab bar at the foot of the screen.
        || subject.kind === "collection"
        // A shared post (/p/…) carries its own "Talk to the …" beside the store buttons.
        || subject.path.startsWith("/p/")
        || QUIET_PATHS.some((pattern) => pattern.test(subject.path))
        // A species page, before it has said which animal it is: nothing, not the generic pill.
        || (subject.kind === "species" && !speaksAsAnimal);
    // Both pills wait for the first screen to scroll away: the hero carries its own Talk button.
    const placement = usePillPlacement(mounted && !quiet, true);
    const setPillRef = useCallback((element: HTMLElement | null) => {
        placement.ref.current = element;
    }, [placement.ref]);

    if (!mounted) return null;

    // The Talk page is the conversation itself: no launcher and no drawer over it.
    if (onTalk) return null;

    if (isOpen) return <AskDrawer labels={labels} />;

    if (quiet) return null;

    if (speaksAsAnimal) {
        const label = labels.speakLauncher.replace("{animal}", subject.name ?? "");
        return (
            <FloatingPill shown={placement.shown} pillRef={setPillRef}>
                {({tabIndex, className}) => (
                    <button type="button" onClick={() => open()} tabIndex={tabIndex} className={className}>
                        {avatarUrl ? (
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/15">
                                <Image src={avatarUrl} unoptimized alt="" fill sizes="32px" className="object-cover" />
                                <span
                                    aria-hidden="true"
                                    className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary-400 text-canvas-950"
                                >
                                    <svg viewBox="0 0 20 20" className="h-2 w-2" fill="currentColor">
                                        <path d="M3 4h14v9H8l-4 3v-3H3z" />
                                    </svg>
                                </span>
                            </span>
                        ) : <TalkGlyph />}
                        {label}
                    </button>
                )}
            </FloatingPill>
        );
    }

    // Everywhere else: only where the header's own Talk button is hidden.
    return (
        <FloatingPill shown={placement.shown} pillRef={setPillRef} className="xl:hidden">
            {({tabIndex, className}) => (
                <Link href="/talk" tabIndex={tabIndex} className={className}>
                    <TalkGlyph />
                    {labels.launcher}
                </Link>
            )}
        </FloatingPill>
    );
}
