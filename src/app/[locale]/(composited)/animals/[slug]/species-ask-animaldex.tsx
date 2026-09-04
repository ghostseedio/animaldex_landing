"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {
    SPECIES_ASK_FUNNEL_EVENTS,
    SPECIES_ASK_LAYER_META,
    type SpeciesAskLayer,
    type SpeciesAskLayerKind,
    type SpeciesAskRoute,
    type SpeciesAskSuggestion
} from "@/lib/species-ask";

export const SPECIES_ASK_EVENT = "animaldex:ask";

export function askAboutAnimal(question: string) {
    window.dispatchEvent(new CustomEvent(SPECIES_ASK_EVENT, {detail: {question}}));
    document.getElementById("ask")?.scrollIntoView({behavior: "smooth", block: "start"});
}

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
            className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/[0.12] px-3 py-1.5 text-sm font-bold text-amber-100 transition hover:border-amber-200 hover:text-white"
        >
            {label}
        </a>
    );
}

type AskResponse = {
    ok?: boolean;
    remaining?: number;
    limit?: number;
    signedIn?: boolean;
    isPro?: boolean;
    layers?: SpeciesAskLayer[];
    routes?: SpeciesAskRoute[];
    error?: string;
};

const LAYER_TINT: Record<SpeciesAskLayerKind, string> = {
    biology: "border-cyan-300/25 bg-cyan-400/[0.06]",
    why: "border-amber-300/25 bg-amber-400/[0.07]",
    lesson: "border-primary-300/30 bg-primary-400/[0.08]",
    symbolism: "border-violet-300/25 bg-violet-400/[0.07]"
};

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
        thinking: string;
        quota: string;
        remaining: string;
        followups: string;
        noscript: string;
        limitReached: string;
        collectCta: string;
        collectHref: string;
        error: string;
        layers: Record<SpeciesAskLayerKind, {title: string; caption: string}>;
    };
};

export default function SpeciesAskAnimalDex({
    slug,
    animalName,
    suggestions,
    labels
}: SpeciesAskAnimalDexProps) {
    const [question, setQuestion] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [layers, setLayers] = useState<SpeciesAskLayer[]>([]);
    const [routes, setRoutes] = useState<SpeciesAskRoute[]>([]);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [limit, setLimit] = useState<number | null>(null);
    const [limitReached, setLimitReached] = useState(false);

    useEffect(() => {
        const onAsk = (event: Event) => {
            const detail = (event as CustomEvent<{question?: string}>).detail;
            if (!detail?.question) return;
            setQuestion(detail.question);
            void submitQuestion(detail.question, "ask_why");
        };
        window.addEventListener(SPECIES_ASK_EVENT, onAsk);
        return () => window.removeEventListener(SPECIES_ASK_EVENT, onAsk);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function submitQuestion(raw: string, source: "form" | "chip" | "ask_why") {
        const nextQuestion = raw.replace(/\s+/g, " ").trim();
        if (nextQuestion.length < 3 || pending) return;

        setPending(true);
        setError(null);
        setLimitReached(false);
        trackEvent(SPECIES_ASK_FUNNEL_EVENTS.submitted, {
            species_slug: slug,
            source
        });

        try {
            const response = await fetch("/api/animals/ask", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({slug, question: nextQuestion})
            });
            const payload = await response.json() as AskResponse;
            if (typeof payload.limit === "number") setLimit(payload.limit);
            if (response.status === 429) {
                setLimitReached(true);
                setRemaining(0);
                setLayers([]);
                setRoutes([]);
                trackEvent(SPECIES_ASK_FUNNEL_EVENTS.limitReached, {species_slug: slug, source});
                return;
            }
            if (!response.ok || !payload.layers) {
                setError(labels.error);
                return;
            }
            setLayers(payload.layers);
            setRoutes(payload.routes ?? []);
            setRemaining(typeof payload.remaining === "number" ? payload.remaining : null);
            trackEvent(SPECIES_ASK_FUNNEL_EVENTS.answered, {
                species_slug: slug,
                source,
                layer_count: payload.layers.length
            });
        } catch {
            setError(labels.error);
        } finally {
            setPending(false);
        }
    }

    const placeholder = labels.placeholder.replace("{animal}", animalName);
    const remainingCopy = remaining != null && limit != null
        ? labels.remaining
            .replace("{remaining}", String(remaining))
            .replace("{limit}", String(limit))
            .replace("{count}", String(remaining))
        : null;

    return (
        <section
            id="ask"
            className="scroll-mt-28 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(167,244,50,0.12),transparent_36%),linear-gradient(180deg,rgba(18,22,19,0.96),rgba(10,13,11,0.98))] p-5 md:p-8"
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/90">{labels.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                {labels.title.replace("{animal}", animalName)}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{labels.description}</p>
            <p className="mt-3 text-sm text-ink-400">{labels.quota}</p>

            <noscript>
                <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-ink-200">
                    {labels.noscript}
                </p>
            </noscript>

            <form
                className="mt-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submitQuestion(question, "form");
                }}
            >
                <label className="sr-only" htmlFor={`ask-${slug}`}>{placeholder}</label>
                <div className="flex items-end gap-2 rounded-[1.5rem] border border-white/12 bg-black/30 p-2 pl-4 focus-within:border-primary-300/50">
                    <textarea
                        id={`ask-${slug}`}
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder={placeholder}
                        rows={2}
                        maxLength={280}
                        className="min-h-[3.25rem] w-full resize-none bg-transparent py-3 text-base text-white outline-none placeholder:text-ink-400"
                    />
                    <button
                        type="submit"
                        disabled={pending || question.trim().length < 3}
                        className="mb-1 mr-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-400 text-canvas-950 transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={labels.submit}
                    >
                        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.prompt}
                        type="button"
                        onClick={() => {
                            trackEvent(SPECIES_ASK_FUNNEL_EVENTS.chipClicked, {
                                species_slug: slug,
                                source: "chip"
                            });
                            setQuestion(suggestion.prompt);
                            void submitQuestion(suggestion.prompt, "chip");
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink-100 transition hover:border-primary-300/40 hover:text-white"
                    >
                        {suggestion.label}
                    </button>
                ))}
            </div>

            {pending ? (
                <p className="mt-6 text-sm font-semibold text-primary-100">{labels.thinking}</p>
            ) : null}

            {error ? <p className="mt-6 text-sm text-rose-200">{error}</p> : null}

            {limitReached ? (
                <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-400/[0.08] p-5">
                    <p className="text-base leading-7 text-ink-100">{labels.limitReached}</p>
                    <Link
                        href={labels.collectHref}
                        onClick={() => {
                            trackEvent(SPECIES_ASK_FUNNEL_EVENTS.collectClicked, {
                                species_slug: slug,
                                source: "limit_reached"
                            });
                        }}
                        className="mt-4 inline-flex rounded-2xl bg-primary-400 px-5 py-3 text-sm font-bold text-canvas-950 hover:bg-primary-300"
                    >
                        {labels.collectCta}
                    </Link>
                </div>
            ) : null}

            {layers.length > 0 ? (
                <div className="mt-6 flex flex-col gap-3">
                    {layers.map((layer) => {
                        const meta = labels.layers[layer.kind] ?? SPECIES_ASK_LAYER_META[layer.kind];
                        return (
                            <article
                                key={`${layer.kind}-${layer.title}`}
                                className={`rounded-3xl border p-5 ${LAYER_TINT[layer.kind]}`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">{meta.title}</p>
                                <p className="mt-1 text-sm text-white/65">{meta.caption}</p>
                                <p className="mt-3 text-base leading-7 text-ink-100">{layer.body}</p>
                            </article>
                        );
                    })}
                </div>
            ) : null}

            {routes.length > 0 ? (
                <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{labels.followups}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {routes.map((route) => (
                            <Link
                                key={route.href}
                                href={route.href}
                                onClick={() => {
                                    trackEvent(SPECIES_ASK_FUNNEL_EVENTS.followupClicked, {
                                        species_slug: slug,
                                        intent: route.intent,
                                        href: route.href
                                    });
                                }}
                                className="rounded-full border border-primary-400/30 px-4 py-2 text-sm font-semibold text-primary-100 hover:border-primary-200 hover:text-white"
                            >
                                {route.label} →
                            </Link>
                        ))}
                    </div>
                </div>
            ) : null}

            {remainingCopy && !limitReached ? (
                <p className="mt-5 text-xs uppercase tracking-[0.14em] text-ink-400">
                    {remainingCopy}
                </p>
            ) : null}
        </section>
    );
}
