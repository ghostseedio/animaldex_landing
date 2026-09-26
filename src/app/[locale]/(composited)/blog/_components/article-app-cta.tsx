import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

type ArticleAppCtaProps = {
    title: string;
    description: string;
    supportItems?: string[];
};

/**
 * The end-of-article conversion moment.
 *
 * Deliberately the one place on the page that carries a filled surface: after a
 * long neutral read, a single darker panel with a lime edge reads as arrival
 * rather than as another box. It is asymmetric — copy left, proof right — so it
 * does not look like the centred marketing banner it replaced.
 */
export default function ArticleAppCta({title, description, supportItems = []}: ArticleAppCtaProps) {
    return (
        // Self-wrapping so the module keeps the editorial measure whether it
        // is dropped into the article flow or the index.
        <div className="editorial-grid my-16 md:my-24">
        <aside className="span-wide">
            <div className="relative overflow-hidden rounded-sm border border-[color:var(--rule-strong)] bg-[color:var(--paper-850)]">
                {/* One hairline of brand at the top edge, instead of a green fill. */}
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--lime)] to-transparent opacity-70" />

                <div className="grid gap-8 p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:p-10">
                    <div className="flex flex-col gap-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--lime)]">AnimalDex</p>
                        <h2 className="max-w-[22ch] font-display text-2xl font-bold leading-[1.12] tracking-[-0.02em] text-[color:var(--text-100)] [text-wrap:balance] md:text-[2rem]">
                            {title}
                        </h2>
                        <p className="max-w-[50ch] text-[15px] leading-relaxed text-[color:var(--text-300)]">{description}</p>
                    </div>

                    <div className="flex flex-col gap-4 md:items-end">
                        <StoreLinks />
                        {supportItems.length ? (
                            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 md:justify-end">
                                {supportItems.map((item) => (
                                    <li
                                        key={item}
                                        className="flex list-none items-center gap-1.5 text-[12px] text-[color:var(--text-400)]"
                                    >
                                        <span aria-hidden="true" className="text-[color:var(--lime)]">✓</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>
            </div>
        </aside>
        </div>
    );
}
