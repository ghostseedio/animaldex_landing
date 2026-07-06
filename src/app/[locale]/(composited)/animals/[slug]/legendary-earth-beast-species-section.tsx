import Link from "@/app/[locale]/_components/link";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import LegendaryEarthBeastBadge from "@/app/[locale]/(composited)/animals/legendary-earth-beast-badge";
import {
    LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH,
    type LegendaryEarthBeast
} from "@/data/legendary-earth-beasts";

type LegendaryEarthBeastSpeciesSectionProps = {
    beast: LegendaryEarthBeast;
    speciesName: string;
};

export default function LegendaryEarthBeastSpeciesSection({
    beast,
    speciesName
}: LegendaryEarthBeastSpeciesSectionProps) {
    const captureSite = beast.captureSite.split(",")[0]?.trim() || beast.captureSite;

    return (
        <section id="legendary-earth-beast" aria-label="Legendary Earth Beast" className="scroll-mt-40">
            <div className="overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-[linear-gradient(145deg,rgba(251,191,36,0.12),rgba(34,58,41,0.16))] p-5 md:p-8">
                <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <LegendaryEarthBeastBadge formName={beast.legendaryFormName} />
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-200">
                                {beast.legendaryType}
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                                Legendary Earth Beast
                            </p>
                            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
                                {beast.legendaryFormName}
                            </h2>
                            <p className="text-lg leading-8 text-ink-100 md:text-xl">
                                {beast.legendaryFormName} is an S-tier Legendary Earth Beast captured only at {captureSite}. This species page includes flagship stats, field guide content, and the travel story behind the landmark.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Capture site</p>
                                <p className="mt-2 text-base font-medium leading-7 text-white">{captureSite}</p>
                                <p className="mt-1 text-sm text-ink-300">{beast.region}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Legendary power</p>
                                <p className="mt-2 text-base font-medium leading-7 text-white">{beast.power}</p>
                                <p className="mt-2 text-sm leading-6 text-ink-200">{beast.lesson}</p>
                            </div>
                        </div>

                        {beast.bestFor.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {beast.bestFor.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-medium text-amber-50"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                            <Link
                                href={`${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${beast.slug}`}
                                className="font-semibold text-amber-100 hover:text-white"
                                underline
                            >
                                Read the {beast.legendaryFormName} guide
                            </Link>
                            <Link
                                href={LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}
                                className="text-primary-200 hover:text-primary-100"
                                underline
                            >
                                All Legendary Earth Beasts
                            </Link>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.5rem] border border-amber-200/20 shadow-2xl shadow-black/30">
                        <ContentImageFigure image={beast.featuredImage} />
                    </div>
                </div>
            </div>
        </section>
    );
}
