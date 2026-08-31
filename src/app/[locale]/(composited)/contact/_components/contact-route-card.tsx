import Link from "@/app/[locale]/_components/link";
import {
    ContactIconBadge,
    ContactRouteMotif,
    FieldScannerMotif,
    type ContactRouteId
} from "@/app/[locale]/(composited)/contact/_components/contact-visuals";

export type ContactRouteCardProps = {
    routeId: ContactRouteId;
    label: string;
    heading: string;
    description: string;
    cta: string;
    href: string;
    microcopy?: string;
    featured?: boolean;
};

function isExternalHref(href: string) {
    return href.startsWith("http");
}

function isMailtoHref(href: string) {
    return href.startsWith("mailto:");
}

function ContactCta({
    href,
    cta,
    heading,
    featured = false
}: {
    href: string;
    cta: string;
    heading: string;
    featured?: boolean;
}) {
    const external = isExternalHref(href);
    const mailto = isMailtoHref(href);

    if (featured) {
        return (
            <Link
                href={href}
                className="relative z-10 inline-flex min-h-[3rem] w-full items-center justify-center rounded-full border border-primary-200/35 bg-primary-400/95 px-6 font-display text-xs font-bold uppercase tracking-[0.14em] text-canvas-950 transition-[background-color,border-color,transform] duration-300 hover:border-primary-200 hover:bg-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 motion-reduce:transition-none sm:min-h-[3.1rem] sm:text-sm lg:w-auto lg:min-w-[14.5rem]"
                {...(external ? {target: "_blank", rel: "noopener noreferrer"} : {})}
                {...(mailto ? {"aria-label": `${cta} (${heading})`} : {})}
            >
                <span className="inline-flex items-center gap-2">
                    {cta}
                    <span
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
                    >
                        →
                    </span>
                </span>
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="relative z-10 inline-flex min-h-[2.75rem] w-fit max-w-full items-center gap-2 font-display text-[0.72rem] font-bold uppercase leading-tight tracking-[0.14em] text-primary-200 transition-colors duration-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:text-xs"
            {...(external ? {target: "_blank", rel: "noopener noreferrer"} : {})}
            {...(mailto ? {"aria-label": `${cta} (${heading})`} : {})}
        >
            <span>{cta}</span>
            <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
            >
                →
            </span>
        </Link>
    );
}

export default function ContactRouteCard({
    routeId,
    label,
    heading,
    description,
    cta,
    href,
    microcopy,
    featured = false
}: ContactRouteCardProps) {
    const displayLabel = featured ? "Help Center" : label;

    return (
        <article
            id={routeId}
            className={`group relative flex min-h-[15.5rem] overflow-hidden rounded-[1.35rem] border transition-[border-color,box-shadow,transform] duration-500 ease-out motion-reduce:transition-none ${
                featured
                    ? "border-primary-200/18 bg-[#0A2112]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-8 lg:min-h-[15rem] lg:p-9 hover:-translate-y-0.5 hover:border-primary-200/42 hover:shadow-[0_30px_96px_rgba(0,0,0,0.42),0_0_0_1px_rgba(167,244,50,0.08)] motion-reduce:hover:translate-y-0"
                    : "min-h-[14.5rem] border-white/[0.07] bg-[#071B0F]/82 p-5 md:min-h-[15rem] md:p-6 hover:-translate-y-0.5 hover:border-primary-200/32 hover:shadow-[0_0_0_1px_rgba(167,244,50,0.05),0_20px_64px_rgba(0,0,0,0.3)] motion-reduce:hover:translate-y-0"
            }`}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-200/25 to-transparent opacity-70"
            />

            {!featured ? <ContactRouteMotif routeId={routeId} /> : null}

            {featured ? (
                <>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(167,244,50,0.11),transparent_38%)]"
                    />
                    <FieldScannerMotif className="absolute -right-8 top-1/2 h-44 w-44 -translate-y-1/2 opacity-[0.08] sm:-right-4 sm:h-52 sm:w-52 sm:opacity-[0.1] lg:right-2 lg:h-56 lg:w-56" />
                </>
            ) : (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(167,244,50,0.04),transparent_42%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
            )}

            <div
                className={`relative flex h-full w-full flex-col ${
                    featured ? "gap-6 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10" : "gap-5"
                }`}
            >
                <div className={`flex min-w-0 flex-1 flex-col ${featured ? "gap-5 lg:max-w-2xl lg:gap-6" : "gap-4"}`}>
                    <ContactIconBadge routeId={routeId} featured={featured} />

                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-200/70" aria-hidden="true" />
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-primary-200 sm:text-xs">
                                {displayLabel}
                            </p>
                        </div>
                        <h2
                            className={`font-display font-black uppercase leading-[0.96] tracking-[0.03em] text-white ${
                                featured ? "text-3xl sm:text-4xl lg:text-[2.55rem]" : "text-[1.45rem] sm:text-2xl"
                            }`}
                        >
                            {heading}
                        </h2>
                    </div>

                    <p
                        className={`leading-relaxed text-ink-200 ${
                            featured ? "max-w-xl text-base md:text-lg" : "text-sm md:text-[0.95rem]"
                        }`}
                    >
                        {description}
                    </p>

                    {microcopy ? (
                        <p className="text-sm text-ink-400">{microcopy}</p>
                    ) : null}
                </div>

                <div
                    className={`relative flex shrink-0 flex-col justify-end ${
                        featured ? "gap-4 lg:min-w-[15.5rem] lg:items-end lg:self-stretch lg:pb-1" : "mt-auto pt-1"
                    }`}
                >
                    {featured ? (
                        <FieldScannerMotif className="pointer-events-none absolute -right-2 bottom-8 hidden h-36 w-36 opacity-[0.07] lg:block" />
                    ) : null}
                    <ContactCta href={href} cta={cta} heading={heading} featured={featured} />
                </div>
            </div>
        </article>
    );
}
