import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import publishedTrials from "@/data/published-animal-trials.json";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {StaticSpeciesGroupMember} from "@/lib/static-species-profiles";

type TrialEntry = {slug: string; title: string};

const trialTitleBySlug = new Map((publishedTrials.entries as TrialEntry[]).map((trial) => [trial.slug, trial.title]));

type SpeciesGroupMembersProps = {
    members: StaticSpeciesGroupMember[];
    labels: {
        eyebrow: string;
        title: string;
        description: string;
        /** Contains "{title}". */
        trial: string;
        openPlay: string;
    };
};

/**
 * Play tab of a group page with no indexed group profile (octopus, fox…): the
 * indexed species it covers, each with its own Trial and powers on its page.
 */
export default function SpeciesGroupMembers({members, labels}: SpeciesGroupMembersProps) {
    if (members.length === 0) return null;
    return (
        <section className="flex flex-col gap-4 border border-white/10 bg-surface-900/55 p-5 md:p-7">
            <div className="flex max-w-3xl flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{labels.eyebrow}</p>
                <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{labels.title}</h3>
                <p className="text-sm leading-6 text-ink-300 md:text-base">{labels.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((member) => {
                    const trialTitle = trialTitleBySlug.get(member.slug);
                    return (
                        <Link
                            key={member.slug}
                            href={`/animals/${member.slug}`}
                            className="group flex items-center gap-4 border border-white/10 bg-canvas-950/40 p-4 transition hover:-translate-y-0.5 hover:border-primary-300/40"
                        >
                            <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-white/10 bg-white/[0.04]">
                                <Image src={getSpeciesArtworkRoute(member.slug)} alt="" fill unoptimized sizes="56px" className="object-contain p-1.5 transition duration-300 group-hover:scale-105" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-xs font-semibold text-primary-200">#{member.animalDexNumber}</span>
                                <span className="block truncate font-bold text-white">{member.name}</span>
                                <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-300">
                                    {trialTitle ? labels.trial.replace("{title}", trialTitle) : labels.openPlay}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
