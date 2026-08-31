import Link from "@/app/[locale]/_components/link";
import Image from "next/image";

export type TeamMemberProps = {
    href: string;
    index: number;
    title: string;
    tagline: string;
    description: string;
    exploreLabel: string;
    image: string;
    imageAlt: string;
};

export default function TeamMember({
    href,
    index,
    title,
    tagline,
    description,
    exploreLabel,
    image,
    imageAlt
}: TeamMemberProps) {
    return (
        <figure
            className="group relative flex h-[26rem] w-[17.5rem] shrink-0 flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.42)] transition-[border-color,box-shadow] duration-500 ease-out hover:border-primary-200/55 hover:shadow-[0_28px_90px_rgba(0,0,0,0.5),0_0_0_1px_rgba(167,244,50,0.12)] sm:h-[28rem] sm:w-[18.5rem] md:h-[32rem] md:w-[21rem] lg:h-[34rem] lg:w-[22rem]"
        >
            <Image
                src={image}
                alt={imageAlt}
                fill
                sizes="(max-width: 768px) 280px, 352px"
                className="object-cover brightness-[0.42] saturate-[0.85] transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.03] group-hover:brightness-[0.58] group-hover:saturate-100"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,27,15,0.35)_0%,rgba(7,27,15,0.72)_48%,rgba(7,27,15,0.94)_100%)] transition-opacity duration-500 group-hover:opacity-90" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(167,244,50,0.08),transparent_58%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <figcaption className="relative flex h-full flex-col justify-between p-6 md:p-7 lg:p-8">
                <span className="font-display text-sm font-bold tabular-nums tracking-[0.2em] text-white/35">
                    {String(index).padStart(2, "0")}
                </span>

                <div>
                    <h3 className="font-display text-[1.65rem] font-black uppercase leading-[0.95] tracking-[0.04em] text-white md:text-[1.85rem]">
                        {title}
                    </h3>
                    <p className="mt-3 text-base font-medium leading-snug text-white/90 md:text-lg">
                        {tagline}
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <p className="translate-y-4 text-sm leading-relaxed text-ink-200 opacity-0 transition-[transform,opacity] duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-75">
                        {description}
                    </p>
                    <Link
                        className="inline-flex w-fit items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-primary-200 transition-colors duration-300 hover:text-white"
                        href={href}
                        data-drag-slider-ignore
                    >
                        {exploreLabel}
                        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                            →
                        </span>
                    </Link>
                </div>
            </figcaption>
        </figure>
    );
}
