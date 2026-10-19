import Link from "@/app/[locale]/_components/link";
import {GUIDE_BAND, GUIDE_NEON, GuideBandHeader, GuideMessageBand, GuideRow} from "@/components/wildlife-guides/guide-ui";
import {guidePath, type GuideCard} from "@/lib/virtual-wildlife-guides";

/**
 * The public list pages (/wildlife-guides and its location and category
 * pages): a short explanation, links to narrower lists, then guide rows as
 * flush bands. Empty until virtual guides go public, so the empty state is a
 * normal page, not an error.
 */
export function GuideListPage({
    locale,
    eyebrow,
    title,
    intro,
    back,
    links,
    linksTitle,
    guides,
    listTitle,
    emptyTitle,
    emptyDetail
}: {
    locale: string;
    eyebrow: string;
    title: string;
    intro: string;
    back?: {href: string; label: string};
    links?: {href: string; label: string}[];
    linksTitle?: string;
    guides: GuideCard[];
    listTitle: string;
    emptyTitle: string;
    emptyDetail: string;
}) {
    return (
        <div className="mx-auto w-full max-w-3xl bg-[#121212] pb-16 pt-24 text-white md:pt-28">
            <header className="px-[18px] pb-6">
                {back ? (
                    <Link href={back.href} className="text-sm font-semibold text-white/55 hover:text-white">‹ {back.label}</Link>
                ) : null}
                <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{color: GUIDE_NEON}}>{eyebrow}</p>
                <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
                <p className="mt-4 text-base leading-7 text-white/65">{intro}</p>
            </header>

            {links && links.length > 0 ? (
                <nav aria-label={linksTitle}>
                    <GuideBandHeader title={linksTitle ?? "Places"} />
                    <div className={`${GUIDE_BAND} flex flex-wrap gap-2 px-[18px] py-3.5`}>
                        {links.map((link) => (
                            <Link key={link.href} href={link.href} className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40 hover:text-white">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </nav>
            ) : null}

            <GuideBandHeader title={guides.length > 0 ? `${listTitle} · ${guides.length}` : listTitle} />
            {guides.length > 0 ? (
                guides.map((guide) => <GuideRow key={guide.id} card={guide} href={guidePath(guide)} locale={locale} />)
            ) : (
                <GuideMessageBand title={emptyTitle} detail={emptyDetail} icon="binoculars" />
            )}

            <GuideBandHeader title="What a virtual guide is" />
            <div className={`${GUIDE_BAND} px-[18px] py-4 text-sm leading-6 text-white/75`}>
                <p>
                    AnimalDex builds a guide for a place from one explorer&rsquo;s own wild sightings there: which animals they found, how rare they are, and when.
                    Buying a guide unlocks the author&rsquo;s notes for every animal, a direct chat with the author, and introductions to local people they met.
                </p>
                <p className="mt-3 text-xs leading-5 text-white/50">
                    It is advice from someone who has been there, not a tour: the author is not with you, and wildlife is never guaranteed.
                </p>
                <Link href="/earn-on-animaldex" className="mt-3 inline-block text-xs font-semibold hover:underline" style={{color: GUIDE_NEON}}>
                    How your sightings become a guide ›
                </Link>
            </div>
        </div>
    );
}
