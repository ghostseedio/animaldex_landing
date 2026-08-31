import Link from "@/app/[locale]/_components/link";
import {categoryLabel, formatDuration, formatGuidePrice, guideAreaServedName, guidePath, type PublicGuideListing} from "@/lib/guide-marketplace-core";

export default function GuideCard({listing, locale}: {listing: PublicGuideListing; locale: string}) {
    return <article className="flex h-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/10">
        <div className="flex w-full flex-col">
        <div className="relative h-52 overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(34,211,238,0.16),rgba(0,0,0,0.18))]">
            {listing.cover_image_url ? (
                <img src={listing.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
                <div className="grid h-full place-items-center text-white/35">
                    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 4 8 9l4-2 4 2-2-5" />
                        <path d="M6 10a6 6 0 0 0 12 0" />
                        <path d="M7 20h10" />
                    </svg>
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                <span className="rounded-full bg-black/60 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white ring-1 ring-white/15">{categoryLabel(listing.service_category)}</span>
                <span className="rounded-full bg-primary-400 px-3 py-1 text-[0.65rem] font-black text-black">{formatGuidePrice(listing.amount_minor, listing.currency_code, locale)}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5">
                <h2 className="font-display text-2xl leading-tight text-white">{listing.title}</h2>
                <p className="mt-2 truncate text-sm font-semibold text-white/75">{guideAreaServedName(listing)}</p>
            </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
            <p className="flex-1 text-sm leading-6 text-white/65">{listing.public_summary}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-white/75">
                <div><dt className="text-white/45">Duration</dt><dd>{formatDuration(listing.duration_minutes)}</dd></div>
                <div><dt className="text-white/45">Group</dt><dd>Up to {listing.max_guests}</dd></div>
                <div className="col-span-2"><dt className="text-white/45">Payment</dt><dd className="font-bold text-white">Cash in person, no Credits</dd></div>
            </dl>
            <Link href={guidePath(listing)} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary-400/50 px-5 py-2.5 font-bold text-primary-300 hover:bg-primary-400/10">View experience</Link>
        </div>
        </div>
    </article>;
}
