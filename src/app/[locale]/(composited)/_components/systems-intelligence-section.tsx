import Link from "@/app/[locale]/_components/link";
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

function DetailCard({label, value}: {label: string; value: string}) {
    return (
        <div className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                {label}
            </p>
            <p className="text-base md:text-lg leading-7 text-ink-200">
                {value}
            </p>
        </div>
    );
}

export default function SystemsIntelligenceSection({labels, items}: SystemsIntelligenceSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                    {labels.title}
                </h2>
                {labels.description && (
                    <p className="text-ink-200 text-lg md:text-xl">
                        {labels.description}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <article
                        key={item.slug}
                        className="rounded-4xl border border-line-300/80 bg-surface-800/60 p-5 md:p-6 flex flex-col gap-4"
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                                    {labels.systemRole}
                                </p>
                                <h3 className="font-display font-bold text-2xl md:text-3xl text-white">
                                    {item.entry.roleTitle}
                                </h3>
                                <p className="text-ink-300 text-sm md:text-base">
                                    {item.name}
                                </p>
                            </div>
                            {item.href && labels.readSpeciesGuide && (
                                <Link
                                    href={item.href}
                                    className="text-primary-200 hover:text-primary-100 transition-colors w-fit"
                                    underline
                                >
                                    {labels.readSpeciesGuide}
                                </Link>
                            )}
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            <DetailCard
                                label={labels.specializedHardware}
                                value={item.entry.specializedHardware}
                            />
                            <DetailCard
                                label={labels.systemsScript}
                                value={item.entry.systemsScript}
                            />
                            <DetailCard
                                label={labels.strategicInsight}
                                value={item.entry.strategicInsight}
                            />
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
