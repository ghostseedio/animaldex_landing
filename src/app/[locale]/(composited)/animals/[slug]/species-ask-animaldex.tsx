"use client";

/**
 * The species page's entry into Ask AnimalDex.
 *
 * The web counterpart of `AnimalPowerAskEntrySection`: a server-rendered section
 * with the animal's own suggested questions, which hands off to the site-wide
 * conversation rather than holding one of its own. The section stays because it
 * is the page's anchor (`#ask`), the thing inline "Why?" links point at, and the
 * part a reader without JavaScript still sees.
 *
 * It used to render a four-layer one-shot answer inline. The layers survive here
 * as what the assistant covers, which is the useful thing to tell a no-JS reader
 * — the conversation itself now lives in the drawer, where it can stream, keep
 * context across follow-ups and draw.
 */

import {askAboutAnimal, SPECIES_ASK_EVENT} from "@/lib/ask-animaldex/events";
import {trackEvent} from "@/lib/analytics";
import {
    SPECIES_ASK_FUNNEL_EVENTS,
    SPECIES_ASK_LAYER_META,
    type SpeciesAskLayerKind,
    type SpeciesAskSuggestion
} from "@/lib/species-ask";

export {SPECIES_ASK_EVENT, askAboutAnimal};

/**
 * An inline "Why?" beside a claim elsewhere on the page.
 *
 * Still an anchor to `#ask`, so it works before hydration and reads as a link to
 * a section rather than a button that might do nothing.
 */
export function AskWhyButton({
    question,
    label,
    slug
}: {
    question: string;
    label: string;
    slug: string;
}) {
    return (
        <a
            href="#ask"
            onClick={() => {
                trackEvent(SPECIES_ASK_FUNNEL_EVENTS.whyClicked, {
                    species_slug: slug,
                    source: "ask_why"
                });
                askAboutAnimal(question);
            }}
            className="inline-flex items-center gap-1.5 border-b border-primary-500/40 pb-0.5 text-sm font-semibold text-primary-200 transition-colors hover:border-primary-400 hover:text-white"
        >
            {label}
        </a>
    );
}

type SpeciesAskAnimalDexProps = {
    slug: string;
    animalName: string;
    suggestions: SpeciesAskSuggestion[];
    labels: {
        eyebrow: string;
        title: string;
        description: string;
        placeholder: string;
        submit: string;
        quota: string;
        noscript: string;
        layers: Record<SpeciesAskLayerKind, {title: string; caption: string}>;
    };
};

export default function SpeciesAskAnimalDex({
    slug,
    animalName,
    suggestions,
    labels
}: SpeciesAskAnimalDexProps) {
    const placeholder = labels.placeholder.replace("{animal}", animalName);

    const openConversation = (question: string | undefined, source: "form" | "chip") => {
        trackEvent(
            source === "chip" ? SPECIES_ASK_FUNNEL_EVENTS.chipClicked : SPECIES_ASK_FUNNEL_EVENTS.submitted,
            {species_slug: slug, source}
        );
        askAboutAnimal(question);
    };

    return (
        <section
            id="ask"
            className="scroll-mt-28 overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(167,244,50,0.12),transparent_36%),linear-gradient(180deg,rgba(18,22,19,0.96),rgba(10,13,11,0.98))] p-5 md:p-8"
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/90">{labels.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                {labels.title.replace("{animal}", animalName)}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{labels.description}</p>
            <p className="mt-3 text-sm text-ink-400">{labels.quota}</p>

            <noscript>
                <div className="mt-4 border border-white/10 bg-black/30 p-4">
                    <p className="text-sm leading-6 text-ink-200">{labels.noscript}</p>
                    <dl className="mt-3 flex flex-col gap-2">
                        {(Object.keys(labels.layers) as SpeciesAskLayerKind[]).map((kind) => {
                            const meta = labels.layers[kind] ?? SPECIES_ASK_LAYER_META[kind];
                            return (
                                <div key={kind}>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
                                        {meta.title}
                                    </dt>
                                    <dd className="text-sm leading-6 text-ink-300">{meta.caption}</dd>
                                </div>
                            );
                        })}
                    </dl>
                </div>
            </noscript>

            {/* Composer-shaped, because that is what it opens. */}
            <button
                type="button"
                onClick={() => openConversation(undefined, "form")}
                aria-label={`${labels.submit}: ${animalName}`}
                className="mt-6 flex w-full items-center gap-3 rounded-[1.75rem] border border-white/12 bg-black/30 py-3 pl-4 pr-2 text-left transition-colors hover:border-primary-300/50"
            >
                <span className="flex-1 text-base text-ink-400">{placeholder}</span>
                <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-400 text-canvas-950"
                >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 16V5m0 0-4.5 4.5M10 5l4.5 4.5" />
                    </svg>
                </span>
            </button>

            <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.prompt}
                        type="button"
                        onClick={() => openConversation(suggestion.prompt, "chip")}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink-100 transition-colors hover:border-primary-300/40 hover:text-white"
                    >
                        {suggestion.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
