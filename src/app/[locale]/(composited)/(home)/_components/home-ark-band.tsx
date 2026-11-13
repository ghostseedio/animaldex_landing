import Link from "@/app/[locale]/_components/link";
import {ARK_HREF} from "@/data/public-navigation";
import type {ArkHomeCounts} from "@/lib/ark-home-counts";

export type HomeArkBandWords = {
    eyebrow: string;
    title: string;
    animals: string;
    bringers: string;
    cta: string;
    alt: string;
};

const ART = "/images/home/ark";

/**
 * The shared Ark, under the three plates (CC 3, 2026-11-13): one heading, the
 * two live counts read at ISR time (`readArkHomeCounts`), and a still of the
 * Ark that is the link to /ark. Picture-first, no paragraph. The still is the
 * hero's own poster frame (already in the page's cache), lazy and sized for
 * the viewport, so the band costs the first paint nothing.
 */
export default function HomeArkBand({locale, counts, words}: {locale: string; counts: ArkHomeCounts; words: HomeArkBandWords}) {
    const wide = (format: string) => [1280, 1920].map((width) => `${ART}/poster-wide-${width}.${format} ${width}w`).join(", ");
    const tall = (format: string) => [640, 828].map((width) => `${ART}/poster-tall-${width}.${format} ${width}w`).join(", ");
    const wideSizes = "(min-width: 1440px) 86rem, 100vw";
    const number = (value: number) => value.toLocaleString(locale);
    const cells = [
        {key: "animals", value: counts.animals, label: words.animals},
        {key: "bringers", value: counts.bringers, label: words.bringers}
    ];
    return (
        <section aria-labelledby="home-ark-title" className="pt-24 md:pt-32">
            <header className="grid gap-y-4 md:grid-cols-12 md:gap-x-8">
                <p className="border-t border-line-200 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300 md:col-span-12">{words.eyebrow}</p>
                <h2 id="home-ark-title" className="font-display text-[2.5rem] font-bold leading-[0.95] tracking-tight text-white [text-wrap:balance] md:col-span-7 md:text-6xl">{words.title}</h2>
                <dl className="flex flex-wrap gap-x-10 gap-y-4 self-end md:col-span-5 md:justify-end" data-ark-counts={counts.live ? "live" : "fallback"}>
                    {cells.map((cell) => (
                        <div key={cell.key} className="flex flex-col gap-2">
                            <dd className="order-1 font-display text-5xl font-bold leading-none tracking-tight text-white [font-variant-numeric:tabular-nums] md:text-6xl">{number(cell.value)}</dd>
                            <dt className="order-2 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-ink-300">{cell.label}</dt>
                        </div>
                    ))}
                </dl>
            </header>
            <Link href={ARK_HREF} className="group mt-10 block md:mt-14">
                <figure className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-900 sm:aspect-[16/10] lg:aspect-[21/9]">
                    <picture>
                        <source media="(min-width: 640px)" type="image/avif" srcSet={wide("avif")} sizes={wideSizes} />
                        <source media="(min-width: 640px)" type="image/webp" srcSet={wide("webp")} sizes={wideSizes} />
                        <source type="image/avif" srcSet={tall("avif")} sizes="100vw" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`${ART}/poster-tall-640.webp`}
                            srcSet={tall("webp")}
                            sizes="100vw"
                            width={640}
                            height={1387}
                            alt={words.alt}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover object-[50%_40%] transition-transform duration-700 group-hover:scale-[1.02]"
                        />
                    </picture>
                    <figcaption className="absolute bottom-3 left-3 inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#f4f1e8] px-4 text-sm font-bold text-[#13221a] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                        {words.cta}
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                    </figcaption>
                </figure>
            </Link>
        </section>
    );
}
