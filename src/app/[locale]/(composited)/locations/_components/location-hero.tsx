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
    publishedLabel: string;
    publishedValue: string;
    updatedLabel: string;
    updatedValue: string;
};

export default function LocationHero({
    title,
    description,
    regionTypeLabel,
    featuredImage,
    nameLabel,
    nameValue,
    publishedLabel,
    publishedValue,
    updatedLabel,
    updatedValue
}: LocationHeroProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
            <div className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60">
                <Image
                    src={featuredImage.src}
                    alt={featuredImage.alt}
                    width={featuredImage.width}
                    height={featuredImage.height}
                    sizes="(min-width: 1024px) 72rem, 100vw"
                    className="h-auto w-full object-cover"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                    {regionTypeLabel}
                </span>
            </div>
            <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{title}</h1>
            <p className="text-ink-200 text-lg md:text-xl leading-8">{description}</p>
            <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-x-6 gap-y-3">
                <span>
                    <span className="text-white">{nameLabel}: </span>
                    {nameValue}
                </span>
                <span>
                    <span className="text-white">{publishedLabel}: </span>
                    {publishedValue}
                </span>
                <span>
                    <span className="text-white">{updatedLabel}: </span>
                    {updatedValue}
                </span>
            </div>
        </section>
    );
}
