import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {WildlifePlace} from "@/data/location-places";

export type PlaceCardLabels = {
    typeLabels: Record<WildlifePlace["type"], string>;
    bestFor: string;
    animalsPreview: string;
    relatedSpecies: string;
    viewAnimals: string;
};

export default function PlaceCard({place, fallbackImage, labels}: {
    place: WildlifePlace;
    fallbackImage: {src: string; alt: string; width: number; height: number};
    labels: PlaceCardLabels;
}) {
    const image = place.image || fallbackImage.src;

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-surface-900/80 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
            <div className="relative aspect-[16/9] overflow-hidden bg-surface-800">
                <Image
                    src={image}
                    alt={place.imageAlt || `${place.name}, ${place.locationName}`}
                    width={fallbackImage.width}
                    height={fallbackImage.height}
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur">
                    {labels.typeLabels[place.type]}
                </span>
            </div>
            <div className="flex flex-1 flex-col p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">{place.locationName} · {place.region}</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-white">{place.name}</h3>
                <p className="mt-3 text-base leading-7 text-ink-200">{place.shortDescription}</p>

                <div className="mt-5">
                    <p className="text-xs font-semibold text-ink-300">{labels.bestFor}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {place.bestFor.map((item) => <span key={item} className="rounded-full bg-amber-200/[0.08] px-3 py-1 text-xs text-amber-100">{item}</span>)}
                    </div>
                </div>

                <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <p className="text-xs font-semibold text-ink-300">{labels.animalsPreview}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-100">{place.animalsToSpot.join(" · ")}</p>
                </div>

                <div className="mt-4">
                    <p className="text-xs font-semibold text-ink-300">{labels.relatedSpecies}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {place.relatedSpeciesSlugs.map((speciesSlug) => (
                            <Link key={speciesSlug} href={`/animals/${speciesSlug}`} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-primary-200 hover:bg-white/10">
                                {speciesSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}
                            </Link>
                        ))}
                    </div>
                </div>

                <a href="#animals-to-spot" className="mt-6 inline-flex min-h-11 items-center font-bold text-primary-200 hover:text-primary-100">
                    {labels.viewAnimals} <span aria-hidden="true" className="ml-1">↓</span>
                </a>
            </div>
        </article>
    );
}
