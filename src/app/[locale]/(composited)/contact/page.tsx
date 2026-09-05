import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {EarnTrackLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import ContactRouteCard from "@/app/[locale]/(composited)/contact/_components/contact-route-card";
import {ContactHeroMark} from "@/app/[locale]/(composited)/contact/_components/contact-visuals";
import {contactSupportEmail, getContactContent} from "@/data/contact-content";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

const contactPath = "/contact";

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    const content = getContactContent(locale);

    return {
        title: content.metaTitle,
        description: content.metaDescription,
        alternates: {
            canonical: getLocalePath(locale, contactPath),
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, contactPath);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, contactPath)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: content.metaTitle,
            description: content.metaDescription,
            url: getLocalePath(locale, contactPath),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: content.title}]
        },
        twitter: {
            card: "summary_large_image",
            title: content.metaTitle,
            description: content.metaDescription,
            images: ["/images/og.png"]
        }
    };
}

export default async function ContactPage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const content = getContactContent(locale);
    const supportRoute = content.routes.find((route) => route.featured)!;
    const secondaryRoutes = content.routes.filter((route) => !route.featured);
    const [partnerships, sponsors, creators, press, general] = secondaryRoutes;
    const routingLabels = content.routes.map((route) => route.label);

    const schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: content.title,
        description: content.description,
        url: getAbsoluteUrl(locale, contactPath),
        inLanguage: locale,
        mainEntity: {
            "@type": "Organization",
            name: "AnimalDex",
            email: contactSupportEmail,
            contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: contactSupportEmail,
                availableLanguage: ["English", "Indonesian"]
            }
        }
    };

    return (
        <div className="relative w-full overflow-hidden bg-[#07100B]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(33,192,94,0.11),transparent_62%)]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-24 top-40 hidden h-56 w-56 opacity-[0.04] blur-[1px] lg:block xl:-left-16"
            >
                <Image src="/images/logo.webp" alt="" width={224} height={224} className="h-full w-full object-contain" />
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 bottom-48 hidden h-48 w-48 opacity-[0.03] blur-[1px] lg:block xl:-right-12"
            >
                <Image src="/images/logo.webp" alt="" width={192} height={192} className="h-full w-full object-contain" />
            </div>

            <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 md:gap-14 md:px-8 md:py-14 lg:gap-16 lg:py-16">
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

                <header className="flex max-w-3xl flex-col gap-4 md:gap-5">
                    <div className="flex items-center gap-3">
                        <ContactHeroMark />
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{content.eyebrow}</p>
                    </div>
                    <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-[0.03em] text-white md:text-6xl lg:text-7xl">
                        {content.title}
                    </h1>
                    <p className="max-w-2xl text-base leading-relaxed text-ink-200 md:text-lg">{content.description}</p>
                    <p
                        aria-hidden="true"
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink-500 sm:text-[0.68rem]"
                    >
                        {routingLabels.map((label, index) => (
                            <span key={label} className="inline-flex items-center gap-2">
                                {index > 0 ? <span className="text-primary-200/35">·</span> : null}
                                <span>{label}</span>
                            </span>
                        ))}
                    </p>
                </header>

                <section aria-label="Contact routes" className="flex flex-col gap-4 md:gap-5">
                    <div className="relative">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-[2rem] bg-[radial-gradient(circle_at_50%_50%,rgba(167,244,50,0.07),transparent_68%)] max-md:hidden"
                        />
                        <ContactRouteCard routeId={supportRoute.id as "support"} {...supportRoute} featured />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                        <ContactRouteCard routeId={partnerships.id as "partnerships"} {...partnerships} />
                        <ContactRouteCard routeId={sponsors.id as "sponsors"} {...sponsors} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                        <ContactRouteCard routeId={creators.id as "creators"} {...creators} />
                        <ContactRouteCard routeId={press.id as "press"} {...press} />
                        <ContactRouteCard routeId={general.id as "general"} {...general} />
                    </div>
                </section>

                <section
                    aria-labelledby="earn-contact-title"
                    className="flex flex-col gap-3 border-t border-white/[0.07] pt-8"
                >
                    <h2 id="earn-contact-title" className="text-xs font-black uppercase tracking-[0.24em] text-ink-400">
                        Earn on AnimalDex
                    </h2>
                    <p className="max-w-2xl text-sm leading-relaxed text-ink-300 md:text-base">
                        In-product earning is separate from a collaboration pitch.{" "}
                        <EarnTrackLink href="/earn-on-animaldex" event="earn_path_clicked" label="contact_earn" className="text-primary-200 hover:text-white">Ways to earn</EarnTrackLink>
                        {", "}
                        <EarnTrackLink href="/become-a-wildlife-guide" event="guide_cta_clicked" label="contact_guide" className="text-primary-200 hover:text-white">become a Wildlife Guide</EarnTrackLink>
                        {", "}
                        <EarnTrackLink href="/creator-rewards" event="creator_rewards_cta_clicked" label="contact_creator" className="text-primary-200 hover:text-white">Creator Rewards</EarnTrackLink>
                        {", or "}
                        <EarnTrackLink href="/sponsor-a-challenge" event="sponsor_cta_clicked" label="contact_sponsor" className="text-primary-200 hover:text-white">sponsor a Challenge</EarnTrackLink>
                        .
                    </p>
                </section>

                <section
                    aria-labelledby="support-callout-title"
                    className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-[#071B0F]/85 px-5 py-6 md:flex md:items-center md:justify-between md:gap-8 md:px-7 md:py-7"
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-200/20 to-transparent"
                    />
                    <div className="flex max-w-2xl flex-col gap-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-primary-200 sm:text-xs">
                            {content.supportCalloutEyebrow}
                        </p>
                        <h2 id="support-callout-title" className="font-display text-2xl font-bold uppercase leading-tight tracking-[0.03em] text-white md:text-3xl">
                            {content.supportCalloutTitle}
                        </h2>
                        <p className="text-sm leading-relaxed text-ink-300 md:text-base">{content.supportCalloutDescription}</p>
                    </div>
                    <Link
                        href="/support"
                        className="mt-5 inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center rounded-full border border-primary-200/30 px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-200 transition-[border-color,color,background-color] duration-300 hover:border-primary-200/60 hover:bg-primary-400/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 md:mt-0 md:w-auto"
                    >
                        {content.supportCalloutCta} →
                    </Link>
                </section>

                <section aria-labelledby="direct-contact-title" className="border-t border-line-400/80 pt-10 md:pt-12">
                    <div className="flex max-w-2xl flex-col gap-3">
                        <h2 id="direct-contact-title" className="text-xs font-black uppercase tracking-[0.24em] text-ink-400">
                            {content.directContactTitle}
                        </h2>
                        <p className="text-base text-ink-200">{content.directContactLead}</p>
                        <a
                            href={`mailto:${contactSupportEmail}`}
                            className="w-fit font-display text-2xl font-bold text-primary-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 md:text-3xl"
                        >
                            {contactSupportEmail}
                        </a>
                        <p className="text-sm leading-relaxed text-ink-400 md:text-base">{content.directContactNote}</p>
                    </div>
                </section>
            </div>
        </div>
    );
}
