import Link from "@/app/[locale]/_components/link";
import type {DiscoverCaptureItem} from "@/data/discover-timeline";
import {formatAnimalDexNumber} from "@/lib/animaldex-number";
import {formatAppShortDateWithYear} from "@/lib/app-dates";
import {discoverPostPath} from "@/lib/discover-post";

export default function HomeFeatureCaptureCard({capture, locale}: {capture: DiscoverCaptureItem; locale: string}) {
    const date = capture.capturedAt ? formatAppShortDateWithYear(capture.capturedAt, locale) : null;

    return (
        <article className="group overflow-hidden rounded-[1.4rem] border border-white/[0.09] bg-[#121212] shadow-[0_16px_40px_-28px_rgba(0,0,0,0.95)] transition hover:border-primary-400/30">
            <Link href={discoverPostPath(capture.id)} className="relative block aspect-[4/3] overflow-hidden bg-white/5">
                <img
                    src={capture.imageSrc}
                    alt={capture.animalName}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/75" />
                {capture.animalDexNumber != null ? (
                    <span className="absolute right-3 top-3 z-20 rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tabular-nums text-primary-200 shadow-sm">
                        {formatAnimalDexNumber(capture.animalDexNumber)}
                    </span>
                ) : null}
                <div className="absolute inset-x-0 top-0 z-20 p-4 pr-24">
                    <h3 className="truncate font-display text-xl font-bold text-white">{capture.animalName}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {capture.lifeStageChip ? (
                            <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[0.68rem] font-bold text-white/75 backdrop-blur-sm">
                                {capture.lifeStageChip}
                            </span>
                        ) : null}
                        {capture.contextLabel ? (
                            <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[0.68rem] font-bold text-white/75 backdrop-blur-sm">
                                {capture.contextLabel}
                            </span>
                        ) : null}
                        {capture.battleTier ? (
                            <span className="inline-flex rounded-full bg-cyan-400/15 px-2.5 py-1 text-[0.68rem] font-black text-cyan-100 ring-1 ring-cyan-400/20">
                                Tier {capture.battleTier}
                            </span>
                        ) : null}
                        {capture.captureGrade != null ? (
                            <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[0.68rem] font-bold text-white/75 backdrop-blur-sm">
                                Grade {capture.captureGrade}
                            </span>
                        ) : null}
                        {date ? (
                            <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[0.68rem] font-bold text-white/75 backdrop-blur-sm">
                                {date}
                            </span>
                        ) : null}
                    </div>
                </div>
            </Link>
        </article>
    );
}
