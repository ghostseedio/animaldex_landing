import Image from "next/image";

type LocationHeroProps = {
    title: string;
    description: string;
    regionTypeLabel: string;
    featuredImage: {
        src: string;
        alt: string;
        width: number;
        height: number;
        caption?: string;
    };
    nameLabel: string;
    nameValue: string;
    updatedLabel: string;
    updatedValue: string;
    animalCountLabel: string;
    animalCountValue: string;
    placeTypeLabel: string;
    placeTypeValue: string;
};

export default function LocationHero({
    title,
    description,
    regionTypeLabel,
    featuredImage,
    nameLabel,
    nameValue,
    updatedLabel,
    updatedValue,
    animalCountLabel,
    animalCountValue,
    placeTypeLabel,
    placeTypeValue
}: LocationHeroProps) {
    return (
        <section className="grid min-w-0 gap-6 border-b border-line-300 pb-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(26rem,0.75fr)] lg:items-start">
            <div className="min-w-0">
                <span className="inline-flex w-fit rounded-md border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                    {regionTypeLabel}
                </span>
                <h1 className="mt-5 max-w-4xl break-words font-display text-3xl font-bold leading-[1.05] text-white md:text-5xl lg:text-6xl">
                    {title}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-ink-200 md:text-lg">{description}</p>
                <div className="mt-6 grid gap-3 text-sm text-ink-300 sm:grid-cols-2">
                    <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                        <span className="block text-ink-400">{nameLabel}</span>
                        <span className="mt-1 block font-semibold text-white">{nameValue}</span>
                    </div>
                    <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                        <span className="block text-ink-400">{placeTypeLabel}</span>
                        <span className="mt-1 block font-semibold text-white">{placeTypeValue}</span>
                    </div>
                    <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                        <span className="block text-ink-400">{animalCountLabel}</span>
                        <span className="mt-1 block font-semibold text-white">{animalCountValue}</span>
                    </div>
                    <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                        <span className="block text-ink-400">{updatedLabel}</span>
                        <span className="mt-1 block font-semibold text-white">{updatedValue}</span>
                    </div>
                </div>
            </div>
            <figure className="overflow-hidden rounded-lg border border-line-300 bg-surface-900/75">
                <Image
                    src={featuredImage.src}
                    alt={featuredImage.alt}
                    width={featuredImage.width}
                    height={featuredImage.height}
                    sizes="(min-width: 1024px) 36rem, 100vw"
                    priority
                    className="aspect-[4/3] w-full object-cover"
                />
                {featuredImage.caption ? (
                    <figcaption className="border-t border-line-400 px-4 py-3 text-xs leading-5 text-ink-400">
                        {featuredImage.caption}
                    </figcaption>
                ) : null}
            </figure>
        </section>
    );
}
