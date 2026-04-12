import Link from "@/app/[locale]/_components/link";

type RankingTableItem = {
    rank: number;
    speciesSlug: string;
    speciesName: string;
    primaryMetric: string;
    shortReason: string;
};

type RankingTableProps = {
    title: string;
    description: string;
    labels: {
        rank: string;
        animal: string;
        metric: string;
        whyItRanks: string;
        readSpecies: string;
    };
    items: RankingTableItem[];
};

export default function RankingTable({title, description, labels, items}: RankingTableProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-line-300/80 bg-surface-800/60">
                <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                        <tr className="border-b border-line-300/80 text-left">
                            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.rank}</th>
                            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.animal}</th>
                            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.metric}</th>
                            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.whyItRanks}</th>
                            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.readSpecies}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={`${item.rank}-${item.speciesSlug}`} className="border-b border-line-300/60 last:border-b-0 align-top">
                                <td className="px-4 py-4 text-white text-lg font-semibold">#{item.rank}</td>
                                <td className="px-4 py-4">
                                    <Link
                                        href={`/animals/${item.speciesSlug}`}
                                        className="text-white text-lg font-semibold hover:text-primary-100 transition-colors"
                                    >
                                        {item.speciesName}
                                    </Link>
                                </td>
                                <td className="px-4 py-4 text-primary-200 text-base md:text-lg font-medium">{item.primaryMetric}</td>
                                <td className="px-4 py-4 text-ink-200 text-base md:text-lg leading-7">{item.shortReason}</td>
                                <td className="px-4 py-4">
                                    <Link
                                        href={`/animals/${item.speciesSlug}`}
                                        className="text-primary-200 hover:text-primary-100 transition-colors"
                                        underline
                                    >
                                        {labels.readSpecies}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
