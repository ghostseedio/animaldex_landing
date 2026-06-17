"use client";

import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {CelebrityWildProfile} from "@/data/what-animal-am-i-page";

type CelebrityWildProfileCarouselProps = {
    profiles: CelebrityWildProfile[];
    copy: {
        eyebrow: string;
        title: string;
        description: string;
        disclaimer: string;
        originLabel: string;
        apexLabel: string;
        activeLabel: string;
        openSpecies: string;
        previous: string;
        next: string;
        slideLabel: string;
    };
};

function RoleCard({
    label,
    match,
    openSpeciesLabel
}: {
    label: string;
    match: CelebrityWildProfile["origin"];
    openSpeciesLabel: string;
}) {
    return (
        <article className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-4 flex flex-col gap-3">
            <p className="text-primary-200 text-xs uppercase tracking-[0.18em] font-semibold">{label}</p>
            <div className="flex items-start gap-3">
                <SpeciesArtworkImage
                    slug={match.speciesSlug}
                    alt={`${match.speciesName} artwork`}
                    className="h-16 w-16 rounded-2xl border border-line-300 shrink-0"
                    sizes="64px"
                />
                <div className="min-w-0 flex flex-col gap-1">
                    <h4 className="text-white font-display font-bold text-xl">{match.speciesName}</h4>
                    <p className="text-ink-200 text-sm md:text-base leading-6">{match.rationale}</p>
                    <Link href={`/animals/${match.speciesSlug}`} className="text-primary-200 hover:text-primary-100 text-sm w-fit" underline>
                        {openSpeciesLabel}
                    </Link>
                </div>
            </div>
        </article>
    );
}

export default function CelebrityWildProfileCarousel({profiles, copy}: CelebrityWildProfileCarouselProps) {
    const [index, setIndex] = useState(0);
    const activeProfile = profiles[index] ?? profiles[0];

    if (!activeProfile) {
        return null;
    }

    function goTo(nextIndex: number) {
        setIndex((nextIndex + profiles.length) % profiles.length);
    }

    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{copy.eyebrow}</p>
                <h2 className="font-display font-bold text-3xl md:text-5xl text-white">{copy.title}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-4xl">{copy.description}</p>
                <p className="text-ink-300 text-sm md:text-base">{copy.disclaimer}</p>
            </div>

            <div className="rounded-4xl border border-primary-500/20 bg-primary-500/5 p-5 md:p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{activeProfile.roleLabel}</p>
                        <h3 className="font-display font-bold text-3xl md:text-4xl text-white">{activeProfile.name}</h3>
                        <p className="text-ink-200 text-base md:text-lg max-w-3xl">{activeProfile.summary}</p>
                    </div>
                    <p className="text-ink-300 text-sm shrink-0">
                        {copy.slideLabel.replace("{current}", String(index + 1)).replace("{total}", String(profiles.length))}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <RoleCard label={copy.originLabel} match={activeProfile.origin} openSpeciesLabel={copy.openSpecies} />
                    <RoleCard label={copy.apexLabel} match={activeProfile.apex} openSpeciesLabel={copy.openSpecies} />
                    <RoleCard label={copy.activeLabel} match={activeProfile.active} openSpeciesLabel={copy.openSpecies} />
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => goTo(index - 1)}
                        className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                    >
                        {copy.previous}
                    </button>
                    <div className="flex flex-wrap justify-center gap-2">
                        {profiles.map((profile, profileIndex) => (
                            <button
                                key={profile.id}
                                type="button"
                                aria-label={profile.name}
                                onClick={() => setIndex(profileIndex)}
                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    profileIndex === index
                                        ? "border-primary-400 bg-primary-500/20 text-white"
                                        : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                }`}
                            >
                                {profile.name}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => goTo(index + 1)}
                        className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                    >
                        {copy.next}
                    </button>
                </div>
            </div>
        </section>
    );
}
