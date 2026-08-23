import Link from "@/app/[locale]/_components/link";
import {categoryLabel, formatDuration, formatGuidePrice, guidePath, type PublicGuideListing} from "@/lib/guide-marketplace-core";

export default function GuideCard({listing, locale}: {listing: PublicGuideListing; locale: string}) {
    return <article className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-300">
            <span>{categoryLabel(listing.service_category)}</span><span aria-hidden>·</span><span>{listing.public_area_label}</span>
        </div>
        <h2 className="font-display text-2xl text-white">{listing.title}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-white/65">{listing.public_summary}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-white/75">
            <div><dt className="text-white/45">Duration</dt><dd>{formatDuration(listing.duration_minutes)}</dd></div>
            <div><dt className="text-white/45">Group</dt><dd>Up to {listing.max_guests}</dd></div>
            <div className="col-span-2"><dt className="text-white/45">Price</dt><dd className="font-bold text-white">{formatGuidePrice(listing.amount_minor, listing.currency_code, locale)} / person</dd></div>
        </dl>
        <Link href={guidePath(listing)} className="mt-6 inline-flex w-fit rounded-full border border-primary-400/50 px-5 py-2.5 font-bold text-primary-300 hover:bg-primary-400/10">View experience</Link>
    </article>;
}
