import Link from "@/app/[locale]/_components/link";
import type {LocationCaptureProof, LocationCaptureSetting} from "@/data/location-captures";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {discoverPostPath} from "@/lib/discover-post";

type LocationCaptureProofSectionProps = {
    locale: string;
    locationName: string;
    proof: LocationCaptureProof;
    labels: {
        eyebrow: string;
        title: string;
        description: string;
        statCaptures: string;
        statSpecies: string;
        statCollectors: string;
        statWild: string;
        speciesTitle: string;
        speciesDescription: string;
        speciesCount: (count: number) => string;
        featuredTitle: string;
        settings: Record<LocationCaptureSetting, string>;
        by: (name: string) => string;
        viewPost: string;
        imageAlt: (animal: string, area: string) => string;
        footnote: string;
    };
};

function formatMonth(locale: string, iso: string) {
    return new Intl.DateTimeFormat(locale, {month: "short", year: "numeric"}).format(new Date(iso));
}

const SETTING_TONE: Record<LocationCaptureSetting, string> = {
    wild: "border-primary-400/40 bg-primary-400/10 text-primary-100",
    zoo: "border-sky-400/40 bg-sky-400/10 text-sky-100",
    farm: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    unknown: "border-white/12 bg-white/[0.03] text-ink-200"
};

/**
 * Real captures logged inside the location's area, snapshotted at build time.
 * Photos come straight from /api/capture-images (a redirect to signed storage),
 * never through the Next image optimizer, which cannot follow that redirect.
 */
export default function LocationCaptureProofSection({locale, locationName, proof, labels}: LocationCaptureProofSectionProps) {
    const stats = [
        {value: proof.captureCount, label: labels.statCaptures},
        {value: proof.speciesCount, label: labels.statSpecies},
        {value: proof.collectorCount, label: labels.statCollectors},
        {value: proof.wildCount, label: labels.statWild}
    ];

    return (
        <section id="field-proof" className="scroll-mt-28 rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6" aria-labelledby="location-capture-proof">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{labels.eyebrow}</p>
            <h2 id="location-capture-proof" className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">{labels.title}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{labels.description}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                        <dd className="font-display text-3xl font-bold text-white md:text-4xl">{stat.value.toLocaleString(locale)}</dd>
                        <dt className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{stat.label}</dt>
                    </div>
                ))}
            </dl>

            {proof.featured.length > 0 ? (
                <div className="mt-8">
                    <h3 className="font-display text-2xl font-bold text-white">{labels.featuredTitle}</h3>
                    <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                        {proof.featured.map((capture) => (
                            <li key={capture.captureId} className="group flex flex-col overflow-hidden rounded-lg border border-line-400 bg-canvas-900/40 transition hover:border-primary-500/50">
                                <Link href={discoverPostPath(`capture-${capture.captureId}`)} className="block overflow-hidden border-b border-line-400 bg-canvas-900">
                                    <img
                                        src={getCaptureImageRoute(capture.captureId)}
                                        alt={labels.imageAlt(capture.animalName, capture.area)}
                                        width={640}
                                        height={640}
                                        loading="lazy"
                                        decoding="async"
                                        className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                                    />
                                </Link>
                                <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
                                    <span className={`w-fit rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${SETTING_TONE[capture.setting]}`}>
                                        {labels.settings[capture.setting]}
                                    </span>
                                    <Link href={`/animals/${capture.speciesSlug}`} className="break-words font-display text-lg font-bold leading-tight text-white transition-colors hover:text-primary-100 md:text-xl">
                                        {capture.animalName}
                                    </Link>
                                    <p className="text-xs leading-5 text-ink-300 md:text-sm">
                                        {capture.area} · {formatMonth(locale, capture.capturedAt)}
                                    </p>
                                    <p className="text-xs leading-5 text-ink-400">
                                        {capture.collectorHandle ? (
                                            <Link href={`/u/${capture.collectorHandle}`} className="hover:text-primary-100">{labels.by(capture.collectorName)}</Link>
                                        ) : labels.by(capture.collectorName)}
                                    </p>
                                    <Link href={discoverPostPath(`capture-${capture.captureId}`)} className="mt-auto w-fit text-xs font-semibold text-primary-200 transition-colors hover:text-primary-100" underline>
                                        {labels.viewPost}
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="mt-8">
                <h3 className="font-display text-2xl font-bold text-white">{labels.speciesTitle}</h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-ink-300 md:text-base">{labels.speciesDescription}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                    {proof.species.map((species) => (
                        <li key={species.slug}>
                            <Link
                                href={`/animals/${species.slug}`}
                                className="inline-flex items-center gap-2 rounded-md border border-line-400 bg-canvas-900/40 px-3 py-1.5 text-sm text-ink-100 transition hover:border-primary-500/50 hover:text-white"
                            >
                                <span className="font-semibold">{species.name}</span>
                                <span className="text-xs text-ink-400">{labels.speciesCount(species.count)}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <p className="mt-6 text-xs leading-5 text-ink-500">{labels.footnote}</p>
        </section>
    );
}
