import Link from "@/app/[locale]/_components/link";

type ExploreKnowledgeLinksProps = {
    title: string;
    description?: string;
    labels: {
        species: string;
        lessons: string;
        symbolism: string;
    };
};

export default function ExploreKnowledgeLinks({title, description, labels}: ExploreKnowledgeLinksProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                {description ? <p className="text-ink-200 text-lg md:text-xl max-w-5xl">{description}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
                <Link href="/animals" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                    {labels.species}
                </Link>
                <Link href="/animal-lessons" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                    {labels.lessons}
                </Link>
                <Link href="/animal-symbolism" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                    {labels.symbolism}
                </Link>
            </div>
        </section>
    );
}
