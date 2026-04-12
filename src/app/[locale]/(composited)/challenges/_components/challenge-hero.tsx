import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {ChallengeEntry} from "@/data/challenges";

type ChallengeHeroProps = {
    challenge: ChallengeEntry;
    comparisonTypeLabel: string;
    animalAName: string;
    animalBName: string;
    publishedLabel: string;
    publishedValue: string;
    updatedLabel: string;
    updatedValue: string;
};

export default function ChallengeHero({
    challenge,
    comparisonTypeLabel,
    animalAName,
    animalBName,
    publishedLabel,
    publishedValue,
    updatedLabel,
    updatedValue
}: ChallengeHeroProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-4 md:p-5 flex flex-col gap-6">
            <div className="overflow-hidden rounded-[2rem] border border-line-300/80 bg-surface-800/60">
                <Image
                    src={challenge.featuredImage.src}
                    alt={challenge.featuredImage.alt}
                    width={challenge.featuredImage.width}
                    height={challenge.featuredImage.height}
                    priority
                    sizes="(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw"
                    className="h-auto w-full object-cover"
                />
            </div>

            <div className="px-2 md:px-3 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                        {comparisonTypeLabel}
                    </span>
                    <Link
                        href={`/animals/${challenge.animalASlug}`}
                        className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 hover:text-primary-100 text-sm"
                    >
                        {animalAName}
                    </Link>
                    <Link
                        href={`/animals/${challenge.animalBSlug}`}
                        className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 hover:text-primary-100 text-sm"
                    >
                        {animalBName}
                    </Link>
                </div>

                <div className="flex flex-col gap-3">
                    <h1 className="font-display font-bold text-5xl md:text-6xl text-white">
                        {challenge.title}
                    </h1>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200">
                        {challenge.description}
                    </p>
                </div>

                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-x-6 gap-y-3">
                    <span>
                        <span className="text-white">{publishedLabel}: </span>
                        {publishedValue}
                    </span>
                    <span>
                        <span className="text-white">{updatedLabel}: </span>
                        {updatedValue}
                    </span>
                </div>
            </div>
        </section>
    );
}
