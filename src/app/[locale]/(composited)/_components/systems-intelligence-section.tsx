import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SystemsIntelligenceLabels = {
    title: string;
    description?: string;
    systemRole: string;
    specializedHardware: string;
    systemsScript: string;
    strategicInsight: string;
    readSpeciesGuide?: string;
};

type SystemsIntelligenceSectionItem = {
    slug: string;
    name: string;
    entry: SystemsIntelligenceEntry;
    href?: string;
};

type SystemsIntelligenceSectionProps = {
    labels: SystemsIntelligenceLabels;
    items: SystemsIntelligenceSectionItem[];
};

function InsightBlock({
    index,
    label,
    value
}: {
    index: number;
    label: string;
    value: string;
}) {
    return (
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 md:gap-4">
            <span className="font-display text-2xl font-bold leading-none text-primary-300/70 md:text-3xl">
                {String(index).padStart(2, "0")}
            </span>
            <div className="min-w-0 space-y-1.5">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary-200">
                    {label}
                </p>
                <p className="text-base leading-7 text-ink-200 md:text-[1.05rem] md:leading-8">
                    {value}
                </p>
            </div>
        </div>
    );
}

function SystemsProfile({
    item,
    labels
}: {
    item: SystemsIntelligenceSectionItem;
    labels: SystemsIntelligenceLabels;
}) {
    return (
        <article className="flex h-full flex-col gap-7">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-surface-800/90 to-surface-900">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(27,196,81,0.14),transparent_58%)]" />
                <div className="relative grid gap-5 p-5 md:grid-cols-[9.5rem_minmax(0,1fr)] md:items-end md:gap-6 md:p-6">
                    <SpeciesArtworkImage
                        slug={item.slug}
                        alt={item.name}
                        fit="contain"
                        className="mx-auto h-40 w-40 shrink-0 rounded-2xl bg-black/20 md:mx-0 md:h-44 md:w-44"
                        sizes="176px"
                    />
                    <div className="relative min-w-0 space-y-3 pb-1">
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-primary-200">
                            {labels.systemRole}
                        </p>
                        <h3 className="font-display text-3xl font-bold leading-[1.05] tracking-[-0.03em] text-white md:text-4xl">
                            {item.entry.roleTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <p className="text-sm font-semibold text-ink-300 md:text-base">{item.name}</p>
                            {item.href && labels.readSpeciesGuide ? (
                                <Link
                                    href={item.href}
                                    className="whitespace-nowrap text-sm font-bold text-primary-200 hover:text-primary-100"
                                    underline
                                >
                                    {labels.readSpeciesGuide}
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6 px-1 md:gap-7">
                <InsightBlock
                    index={1}
                    label={labels.specializedHardware}
                    value={item.entry.specializedHardware}
                />
                <InsightBlock
                    index={2}
                    label={labels.systemsScript}
                    value={item.entry.systemsScript}
                />
                <blockquote className="border-l-2 border-primary-400/70 pl-4 md:pl-5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary-200">
                        {labels.strategicInsight}
                    </p>
                    <p className="mt-2 font-display text-xl font-bold leading-snug tracking-[-0.02em] text-white md:text-2xl md:leading-snug">
                        {item.entry.strategicInsight}
                    </p>
                </blockquote>
            </div>
        </article>
    );
}

export default function SystemsIntelligenceSection({labels, items}: SystemsIntelligenceSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="space-y-8 md:space-y-10">
            <div className="max-w-3xl space-y-3">
                <h2 className="font-display text-3xl font-bold tracking-[-0.03em] text-white md:text-5xl">
                    {labels.title}
                </h2>
                {labels.description ? (
                    <p className="max-w-2xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">
                        {labels.description}
                    </p>
                ) : null}
            </div>

            <div className={`grid gap-10 lg:gap-12 ${items.length > 1 ? "lg:grid-cols-2" : "max-w-4xl"}`}>
                {items.map((item) => (
                    <SystemsProfile key={item.slug} item={item} labels={labels} />
                ))}
            </div>
        </section>
    );
}
