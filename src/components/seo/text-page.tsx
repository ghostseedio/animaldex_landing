import type {ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import {jsonLdHtml, type JsonLd} from "@/lib/seo/structured-data";

/**
 * The frame of the SEO lane's text pages (/ark/how-it-works, /ark/food-chain,
 * /about): a visible breadcrumb, one h1 with its eyebrow and intro, the page's
 * sections (h2 and below), and its JSON-LD. Server-rendered; no script.
 */

export type Crumb = {name: string; href: string};

export function Breadcrumbs({items, label}: {items: Crumb[]; label: string}) {
    return (
        <nav aria-label={label} className="text-[13px] text-ink-400">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {items.map((item, index) => (
                    <li key={item.href} className="flex items-center gap-2">
                        {index > 0 ? <span aria-hidden="true">/</span> : null}
                        {index < items.length - 1 ? (
                            <Link href={item.href} className="underline-offset-4 hover:text-white hover:underline">{item.name}</Link>
                        ) : (
                            <span aria-current="page" className="text-ink-300">{item.name}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

type Props = {
    crumbs: Crumb[];
    crumbsLabel: string;
    eyebrow: string;
    title: string;
    intro: ReactNode;
    /** A line under the intro (the live counts). */
    live?: string | null;
    jsonLd: JsonLd[];
    children: ReactNode;
    /** Wider pages (the explorer) take the full column. */
    wide?: boolean;
};

export default function TextPage({crumbs, crumbsLabel, eyebrow, title, intro, live, jsonLd, children, wide}: Props) {
    return (
        <div className="relative w-full overflow-hidden bg-canvas-950">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdHtml(jsonLd)}} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(33,192,94,0.12),transparent_62%)]" />
            <div className={`relative mx-auto flex w-full flex-col gap-12 px-4 py-10 md:px-8 md:py-14 ${wide ? "max-w-[88rem]" : "max-w-4xl"}`}>
                <header className="flex flex-col gap-5">
                    <Breadcrumbs items={crumbs} label={crumbsLabel} />
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{eyebrow}</p>
                    <h1 className="max-w-3xl font-display text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">{title}</h1>
                    <div className="max-w-3xl text-lg leading-8 text-ink-200">{intro}</div>
                    {live ? <p className="text-base font-semibold text-white">{live}</p> : null}
                </header>
                {children}
            </div>
        </div>
    );
}

/** One titled section of a text page. */
export function TextSection({id, title, children}: {id: string; title: string; children: ReactNode}) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 flex flex-col gap-4 border-t border-line-300 pt-10">
            <h2 id={`${id}-title`} className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{title}</h2>
            {children}
        </section>
    );
}

export function Paragraphs({items}: {items: string[]}) {
    return (
        <>
            {items.filter(Boolean).map((text) => (
                <p key={text.slice(0, 40)} className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">{text}</p>
            ))}
        </>
    );
}

/** A row of the pages' calls to action. */
export function LinkRow({links}: {links: Array<{href: string; label: string; primary?: boolean}>}) {
    return (
        <div className="flex flex-wrap gap-3">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className={link.primary
                        ? "inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-400 px-6 font-display text-sm font-bold uppercase tracking-[0.08em] text-canvas-950 transition-colors hover:bg-primary-300"
                        : "inline-flex min-h-12 items-center gap-2 rounded-full border border-primary-200/50 px-6 font-display text-sm font-bold uppercase tracking-[0.08em] text-primary-200 transition-colors hover:border-primary-200 hover:text-white"}
                >
                    {link.label} <span aria-hidden="true">→</span>
                </Link>
            ))}
        </div>
    );
}
