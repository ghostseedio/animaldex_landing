"use client";

import Link from "@/app/[locale]/_components/link";
import type {UniversalSearchDynamicsHit, UniversalSearchTrialHit} from "@/data/universal-search";

/**
 * The animal layers of universal search, ported from iOS
 * `UniversalSearchAnimalLayers`: a System Dynamics summary band and a Trial
 * row. Both open the animal — Trials are taken from the animal page, and
 * Explore on System Dynamics is that page's Learn band's business.
 */

function frequencyLine(hit: UniversalSearchDynamicsHit) {
    if (hit.baseline_frequency && hit.triggered_frequency && hit.baseline_frequency !== hit.triggered_frequency) {
        return `Baseline ${hit.baseline_frequency} → Triggered ${hit.triggered_frequency}`;
    }
    if (hit.baseline_frequency) return `Baseline ${hit.baseline_frequency}`;
    return null;
}

function FrequencyPill({frequency}: {frequency: string}) {
    const tone = frequency === "HIGH"
        ? "bg-cyan-400/15 text-cyan-100 ring-cyan-400/25"
        : frequency === "MID"
            ? "bg-amber-400/15 text-amber-100 ring-amber-400/25"
            : "bg-rose-400/15 text-rose-100 ring-rose-400/25";
    return <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ring-1 ${tone}`}>{frequency}</span>;
}

export function UniversalSearchDynamicsBand({hit, href}: {hit: UniversalSearchDynamicsHit; href: string | null}) {
    const line = frequencyLine(hit);
    const modes = hit.modes.map((mode) => mode.frequency).filter((value, index, all) => all.indexOf(value) === index).slice(0, 3);
    const body = (
        <>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-ink-400">
                {hit.display_name ? `System Dynamics · ${hit.display_name}` : "System Dynamics"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                {hit.archetype_name ? <p className="font-display text-lg font-bold text-white">{hit.archetype_name}</p> : null}
                {modes.map((mode) => <FrequencyPill key={mode} frequency={mode} />)}
            </div>
            {hit.behavior ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary-300">{hit.behavior}</p> : null}
            {line ? <p className="mt-2 text-sm text-ink-200">{line}</p> : null}
            {hit.signature_explanation ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-200">{hit.signature_explanation}</p> : null}
            {hit.core_principle ? <p className="mt-2 text-sm font-semibold text-white">{hit.core_principle}</p> : null}
            {hit.failure_modes.length ? (
                <p className="mt-2 text-xs text-ink-400">Fails when: {hit.failure_modes.slice(0, 3).join(" · ")}</p>
            ) : null}
            {href ? <span className="mt-3 inline-block text-sm font-bold text-primary-200">Explore on the animal →</span> : null}
        </>
    );
    const className = "block border border-white/10 bg-white/[0.03] p-5 transition hover:border-primary-400/40";
    return href ? <Link href={href} className={className}>{body}</Link> : <article className={className}>{body}</article>;
}

export function UniversalSearchTrialRow({hit, href}: {hit: UniversalSearchTrialHit; href: string | null}) {
    const meta = [
        "Trial",
        hit.display_name || null,
        hit.frequency,
        hit.estimated_minutes && hit.estimated_minutes > 0 ? `${hit.estimated_minutes} min` : null
    ].filter(Boolean).join(" · ");
    const body = (
        <>
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-400/[0.12] text-lg">🏁</span>
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-display text-base font-bold text-white">{hit.title}</span>
                {hit.objective ? <span className="mt-1 line-clamp-3 block text-sm leading-6 text-ink-200">{hit.objective}</span> : null}
                <span className="mt-2 inline-block rounded-full bg-primary-400/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-primary-200">{meta}</span>
            </span>
            {href ? <span aria-hidden="true" className="self-center text-ink-400">›</span> : null}
        </>
    );
    const className = "flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/[0.03]";
    return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}
