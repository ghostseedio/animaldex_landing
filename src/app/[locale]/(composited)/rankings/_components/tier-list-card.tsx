import Link from "@/app/[locale]/_components/link";
import ResponsiveImageWithFallback from "@/app/[locale]/(composited)/rankings/_components/responsive-image-with-fallback";

export type TierListCardData = {
    slug: string;
    title: string;
    description: string;
    category: string;
    categoryLabel: string;
    image: {
        src: string;
        alt: string;
        width: number;
        height: number;
    };
    rankedSpeciesCount: number;
    updatedLabel: string;
    methodologyLabel: string;
};

type TierListCardProps = {
    item: TierListCardData;
    href: string;
    actionLabel: string;
    priority?: boolean;
};

export default function TierListCard({item, href, actionLabel, priority = false}: TierListCardProps) {
    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-line-300 bg-surface-900/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary-500/50 hover:bg-surface-800/90 motion-reduce:transform-none">
            <Link href={href} className="block overflow-hidden border-b border-line-400 bg-canvas-900" aria-label={item.title}>
                <ResponsiveImageWithFallback
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 100vw"
                    priority={priority}
                    className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                />
            </Link>
            <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{item.categoryLabel}</span>
                    <span className="text-xs text-ink-400">{item.updatedLabel}</span>
                </div>
                <h2 className="break-words font-display text-xl font-bold leading-tight text-white md:text-2xl">
                    <Link href={href} className="transition-colors hover:text-primary-100 focus-visible:text-primary-100">
                        {item.title}
                    </Link>
                </h2>
                <p
                    className="text-sm leading-6 text-ink-200"
                    style={{display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"}}
                >
                    {item.description}
                </p>
                <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line-400 pt-4 text-sm">
                    <div>
                        <dt className="text-ink-400">Ranked species</dt>
                        <dd className="mt-1 font-semibold text-white">{item.rankedSpeciesCount}</dd>
                    </div>
                    <div>
                        <dt className="text-ink-400">Method</dt>
                        <dd className="mt-1 font-semibold text-white">{item.methodologyLabel}</dd>
                    </div>
                </dl>
                <Link href={href} className="w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100" underline>
                    {actionLabel}
                </Link>
            </div>
        </article>
    );
}
