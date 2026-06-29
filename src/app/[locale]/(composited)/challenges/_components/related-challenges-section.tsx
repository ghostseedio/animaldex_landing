import Link from "@/app/[locale]/_components/link";
import Image from "next/image";

type RelatedChallengesSectionProps = {
    title: string;
    description: string;
    readChallengeLabel: string;
    items: Array<{
        slug: string;
        title: string;
        quickVerdict: string;
        animalAName: string;
        animalBName: string;
        comparisonTypeLabel: string;
        image?: {src: string; alt: string; width: number; height: number};
    }>;
};

export default function RelatedChallengesSection({
    title,
    description,
    readChallengeLabel,
    items
}: RelatedChallengesSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section id="related" className="scroll-mt-28 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {items.map((item) => (
                    <article
                        key={item.slug}
                        className="group overflow-hidden rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur flex flex-col"
                    >
                        <Link href={`/comparisons/${item.slug}`} className="relative block h-40 overflow-hidden bg-gradient-to-br from-primary-500/25 via-surface-800 to-violet-500/20">
                            {item.image ? <Image src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-surface-950 to-transparent" />
                        </Link>
                        <div className="flex flex-1 flex-col gap-3 p-5">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                                {item.comparisonTypeLabel}
                            </span>
                            <span className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-xs">
                                {item.animalAName}
                            </span>
                            <span className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-xs">
                                {item.animalBName}
                            </span>
                        </div>
                        <h3 className="font-display font-bold text-2xl text-white">
                            <Link
                                href={`/comparisons/${item.slug}`}
                                className="hover:text-primary-100 transition-colors"
                            >
                                {item.title}
                            </Link>
                        </h3>
                        <p className="text-ink-200 text-base">{item.quickVerdict}</p>
                        <Link
                            href={`/comparisons/${item.slug}`}
                            className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                            underline
                        >
                            {readChallengeLabel}
                        </Link>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
