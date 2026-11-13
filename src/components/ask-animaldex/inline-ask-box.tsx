"use client";

/**
 * The inline Ask box under a tier list's or a comparison's H1 (CC 2, Nov
 * 2026): one question, pre-filled, addressed to the page's #1 animal (or the
 * comparison's animal with the edge). It hands the question to the site-wide
 * conversation (`askAboutAnimal`), which answers as the animal and carries
 * the daily limits, the limit panel and the install moment; the box never
 * holds a conversation of its own (ask-animaldex-contract).
 *
 * The pages it sits on are static (SSG, dynamicParams=false), so what the
 * server renders is only what the page's own data knows: the animal, the
 * question, the words. Everything that needs the database (how many
 * messages are left today, the animal's own openers, its canonical species)
 * is read in the browser after hydration from /api/ask/context, through the
 * same prefetch cache the drawer reads, so opening the drawer afterwards
 * costs no second round trip.
 *
 * Square corners throughout, in both themes (the avatar alone is a circle).
 */

import Image from "next/image";
import {useEffect, useMemo, useState, type FormEvent} from "react";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {askContextRequestBody, fetchAskContext} from "@/components/ask-animaldex/ask-context-prefetch";
import {trackEvent} from "@/lib/analytics";
import {askAboutAnimal} from "@/lib/ask-animaldex/events";
import {SPECIES_ASK_DAILY_LIMITS, SPECIES_ASK_FUNNEL_EVENTS} from "@/lib/species-ask";
import type {InlineAskWords} from "@/lib/tier-list-ask";
import {isNonHumanAgent} from "@/lib/web-funnel";

export type InlineAskBoxProps = {
    /** The animal the box speaks to: the page's #1, or the comparison's animal with the edge. */
    slug: string;
    name: string;
    /** The one question the box opens with, derived from the page's data (lib/tier-list-ask). */
    question: string;
    /** The animal's picture (an /api/species-artwork route: rendered unoptimized). */
    avatarUrl: string | null;
    eyebrow: string;
    /** Which page family this is on, for the funnel events' `page_kind`. */
    pageKind: "tier_list" | "comparison" | "comparisons_hub";
    /** The page's own key for the events (`page_slug`): the list's or the pair's slug. */
    pageSlug: string;
    words: InlineAskWords;
};

type InlineAskContext = {
    remaining: number | null;
    limit: number | null;
    suggestions: Array<{title: string; prompt: string}>;
};

function fill(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

export default function InlineAskBox({slug, name, question, avatarUrl, eyebrow, pageKind, pageSlug, words}: InlineAskBoxProps) {
    const {subject, locale} = useAskAnimalDex();
    const [text, setText] = useState(question);
    const [context, setContext] = useState<InlineAskContext | null>(null);
    // The bridge the page renders makes this animal the drawer's subject; the
    // context is read for that exact subject, so the drawer's read is the same key.
    const ready = subject.scope === "species" && subject.slug === slug;
    const body = useMemo(() => (ready ? askContextRequestBody(locale, subject) : null), [ready, locale, subject]);

    // Read once the page is idle (never on the critical path of a static page),
    // and not for crawlers, which render JavaScript too: the page is complete
    // without it, and the context route is a database round trip.
    useEffect(() => {
        if (!body || isNonHumanAgent(navigator.userAgent) || navigator.webdriver) return;
        let cancelled = false;
        const read = () => {
            if (cancelled) return;
            fetchAskContext(body)
                .then((response) => (response.ok ? response.json() : null))
                .then((payload: {remaining?: unknown; limit?: unknown; suggestions?: unknown} | null) => {
                    if (cancelled || !payload) return;
                    const suggestions = Array.isArray(payload.suggestions)
                        ? payload.suggestions.filter((item): item is {title: string; prompt: string} =>
                            Boolean(item && typeof item === "object" && typeof (item as {prompt?: unknown}).prompt === "string" && typeof (item as {title?: unknown}).title === "string"))
                        : [];
                    setContext({
                        remaining: typeof payload.remaining === "number" ? payload.remaining : null,
                        limit: typeof payload.limit === "number" ? payload.limit : null,
                        suggestions: suggestions.slice(0, 3)
                    });
                })
                .catch(() => undefined);
        };
        const w = window as Window & {requestIdleCallback?: (cb: () => void, options?: {timeout: number}) => number; cancelIdleCallback?: (id: number) => void};
        const idle = typeof w.requestIdleCallback === "function" ? w.requestIdleCallback(read, {timeout: 2500}) : null;
        const timer = idle === null ? window.setTimeout(read, 1200) : null;
        return () => {
            cancelled = true;
            if (idle !== null) w.cancelIdleCallback?.(idle);
            if (timer !== null) window.clearTimeout(timer);
        };
    }, [body]);

    const ask = (prompt: string, source: "form" | "chip") => {
        const clean = prompt.trim();
        if (!clean) return;
        trackEvent(source === "chip" ? SPECIES_ASK_FUNNEL_EVENTS.chipClicked : SPECIES_ASK_FUNNEL_EVENTS.submitted, {
            species_slug: slug,
            source: source === "chip" ? "inline_box_chip" : "inline_box",
            page_kind: pageKind,
            page_slug: pageSlug
        });
        askAboutAnimal(clean);
    };

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        ask(text, "form");
    };

    const limitReached = context?.remaining === 0;
    const status = limitReached
        ? words.limitReached
        : context && context.remaining !== null && context.limit !== null
            ? fill(words.remaining, {remaining: context.remaining, limit: context.limit})
            : fill(words.quota, {limit: SPECIES_ASK_DAILY_LIMITS.anonymous});
    // Other openers the animal offers, never the one already in the field.
    const chips = (context?.suggestions ?? []).filter((item) => item.prompt.trim().toLowerCase() !== text.trim().toLowerCase()).slice(0, 2);

    return (
        <section
            id="ask"
            aria-labelledby="inline-ask-title"
            data-inline-ask={pageKind}
            className="scroll-mt-28 border border-white/10 light:border-line-200 bg-surface-900/60 light:bg-surface-900 p-4 md:p-6"
        >
            <div className="flex items-start gap-4">
                {avatarUrl ? (
                    <span className="relative hidden h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/15 light:border-line-300 bg-surface-800 sm:block md:h-16 md:w-16">
                        <Image src={avatarUrl} unoptimized alt="" fill sizes="64px" className="object-cover" />
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{eyebrow}</p>
                    <h2 id="inline-ask-title" className="mt-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                        {fill(words.title, {animal: name})}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-ink-300">{words.hint}</p>
                </div>
            </div>

            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="inline-ask-input">{fill(words.placeholder, {animal: name})}</label>
                <input
                    id="inline-ask-input"
                    type="text"
                    name="q"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={fill(words.placeholder, {animal: name})}
                    maxLength={400}
                    autoComplete="off"
                    enterKeyHint="send"
                    className="min-h-12 w-full flex-1 border border-white/15 light:border-line-300 bg-black/30 light:bg-canvas-950 px-4 text-base text-white placeholder:text-ink-400 focus:border-primary-300/60 focus:outline-none"
                />
                <button
                    type="submit"
                    className="inline-flex min-h-12 items-center justify-center bg-primary-400 px-6 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300 active:bg-primary-500"
                >
                    {words.submit}
                </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className={`text-xs ${limitReached ? "font-semibold text-amber-200" : "text-ink-400"}`} aria-live="polite">{status}</p>
                {chips.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-400">{words.moreQuestions}</span>
                        {chips.map((chip) => (
                            <button
                                key={chip.prompt}
                                type="button"
                                onClick={() => ask(chip.prompt, "chip")}
                                className="border border-white/10 light:border-line-300 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:border-primary-300/40 hover:text-white"
                            >
                                {chip.title}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
