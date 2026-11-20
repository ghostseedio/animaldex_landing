import Link from "@/app/[locale]/_components/link";
import type {ArkCauseBar, ArkPlaceCard} from "@/lib/ark-rankings-text";

/**
 * The sections the two Ark ranking pages add to the shared ranking components (hero, table, methodology, related
 * rankings, entry cards): places with their daily losses, the causes of death, a strip of totals, the questions and the
 * link into the Ark. Server components: every word and number arrives formatted, in the reader's language.
 */

const CARD = "rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6";
const H2 = "font-display text-3xl font-bold text-white md:text-4xl";
const LEAD = "max-w-4xl text-base leading-7 text-ink-300 md:text-lg";

/** The days of one place's losses as a line: oldest on the left, the last day dotted. Time runs left to right in every language. */
function Sparkline({values, label, tone}: {values: number[]; label: string; tone: "more" | "less" | "steady"}) {
    const width = 160;
    const height = 44;
    const pad = 4;
    const top = Math.max(...values, 0.5);
    const points = values.map((value, index) => {
        const x = values.length > 1 ? pad + (index * (width - pad * 2)) / (values.length - 1) : width / 2;
        const y = height - pad - (value / top) * (height - pad * 2);
        return [x, y] as const;
    });
    const last = points[points.length - 1];
    const stroke = tone === "more" ? "#ffb08f" : tone === "less" ? "#9fe3b0" : "#c8fa63";
    return (
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="h-11 w-full max-w-[10rem]" style={{direction: "ltr"}}>
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.25" className="text-ink-300" />
            <polyline points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {last ? <circle cx={last[0]} cy={last[1]} r="3" fill={stroke} /> : null}
        </svg>
    );
}

export function ArkPlaceCards({title, description, cards, openLabel}: {title: string; description: string; cards: ArkPlaceCard[]; openLabel: string}) {
    return (
        <section aria-labelledby="ark-places-heading" className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <h2 id="ark-places-heading" className={H2}>{title}</h2>
                <p className={LEAD}>{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                    <article key={card.place} data-place={card.place} className="flex flex-col gap-3 rounded-lg border border-line-300 bg-surface-900/75 p-5">
                        <h3 className="font-display text-2xl font-bold leading-tight text-white">{card.name}</h3>
                        <p className="font-display text-2xl font-bold leading-tight text-primary-100">{card.alive ?? "–"}</p>
                        <p className="text-sm leading-6 text-ink-200">{card.line}</p>
                        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-400 pt-3">
                            <Sparkline values={card.series} label={card.seriesLabel} tone={card.trend} />
                            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold leading-tight ${card.trend === "more" ? "border-[#ff8a5b]/40 bg-[#ff8a5b]/10 text-[#ffb08f]" : card.trend === "less" ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-line-400 text-ink-200"}`}>
                                {card.trendText}
                            </span>
                        </div>
                    </article>
                ))}
            </div>
            <Link href="/ark" className="w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100" underline>
                {openLabel}
            </Link>
        </section>
    );
}

export function ArkCauses({title, description, bars, notes}: {title: string; description: string; bars: ArkCauseBar[]; notes: string[]}) {
    return (
        <section aria-labelledby="ark-causes-heading" className={CARD}>
            <h2 id="ark-causes-heading" className={H2}>{title}</h2>
            <p className={`mt-3 ${LEAD}`}>{description}</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
                {bars.map((bar) => (
                    <li key={bar.cause} data-cause={bar.cause} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-300">{bar.name}</p>
                        <p className="mt-2 text-sm leading-6 text-ink-200">{bar.line}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-800" role="presentation">
                            <div className="h-full rounded-full bg-primary-300" style={{width: `${Math.round(bar.share * 100)}%`}} />
                        </div>
                    </li>
                ))}
            </ul>
            <ul className="mt-5 flex flex-col gap-2 text-sm leading-6 text-ink-300">
                {notes.filter(Boolean).map((note) => (
                    <li key={note}>{note}</li>
                ))}
            </ul>
        </section>
    );
}

/** Three figures side by side, in the hero's own style. */
export function ArkStatStrip({title, items}: {title: string; items: Array<{label: string; value: string}>}) {
    return (
        <section aria-label={title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-300">{title}</h2>
            <div className="grid gap-3 text-sm text-ink-300 sm:grid-cols-3">
                {items.map((item) => (
                    <div key={item.label} className="rounded-md border border-line-400 bg-surface-900/55 p-4">
                        <span className="block text-ink-400">{item.label}</span>
                        <span className="mt-1 block font-display text-3xl font-bold text-white">{item.value}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function ArkFaq({title, items}: {title: string; items: Array<{question: string; answer: string}>}) {
    return (
        <section className={CARD}>
            <h2 className={H2}>{title}</h2>
            <div className="mt-5 grid gap-3">
                {items.map((item) => (
                    <div key={item.question} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                        <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                        <p className="mt-2 text-base leading-7 text-ink-200">{item.answer}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function ArkOpenCta({title, body, button}: {title: string; body: string; button: string}) {
    return (
        <section className="flex flex-col gap-3 rounded-lg border border-primary-500/30 bg-primary-500/10 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{title}</h2>
                <p className="mt-2 max-w-3xl text-base leading-7 text-ink-200">{body}</p>
            </div>
            <Link href="/ark" className="w-fit shrink-0 rounded-md bg-primary-300 px-5 py-3 text-base font-bold text-canvas-950 transition-colors hover:bg-primary-200 focus-visible:bg-primary-200">
                {button}
            </Link>
        </section>
    );
}

export function ArkUnavailable({text}: {text: string}) {
    return (
        <section className={CARD}>
            <p className="text-base leading-7 text-ink-200">{text}</p>
        </section>
    );
}
