"use client";

import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {
    categoryLabel,
    formatDuration,
    formatGuidePrice,
    guideHostName,
    guideAreaServedName,
    guidePath,
    type PublicGuideListing
} from "@/lib/guide-marketplace-core";

export default function ExperienceCard({listing, locale}: {listing: PublicGuideListing; locale: string}) {
    const href = guidePath(listing);
    const host = guideHostName(listing);

    return (
        <article className="flex h-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035]">
            <div className="flex w-full flex-col">
                <div className="relative h-52 overflow-hidden bg-[#0A1A12]">
                    {listing.cover_image_url ? (
                        <Image
                            src={listing.cover_image_url}
                            alt={`${listing.title} wildlife experience in ${guideAreaServedName(listing)}`}
                            fill
                            unoptimized
                            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover"
                        />
                    ) : (
                        <div className="grid h-full place-items-center text-white/30" aria-hidden="true">
                            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M4 18c2-5 5-8 8-8s6 3 8 8" />
                                <circle cx="12" cy="8" r="2.2" />
                            </svg>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                        <span className="rounded-full bg-black/55 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white ring-1 ring-white/15">
                            {categoryLabel(listing.service_category)}
                        </span>
                        <span className="rounded-full bg-primary-400 px-3 py-1 text-[0.65rem] font-black text-canvas-950">
                            {formatGuidePrice(listing.amount_minor, listing.currency_code, locale)}
                            <span className="ml-1 font-semibold opacity-70">/ person</span>
                        </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                        <h3 className="font-display text-2xl leading-tight text-white">{listing.title}</h3>
                        <p className="mt-2 truncate text-sm font-semibold text-white/75">{guideAreaServedName(listing)}</p>
                    </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Led by {host}</p>
                    <p className="mt-3 flex-1 text-sm leading-6 text-white/65">{listing.public_summary}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-white/75">
                        <div>
                            <dt className="text-white/40">Duration</dt>
                            <dd>{formatDuration(listing.duration_minutes)}</dd>
                        </div>
                        <div>
                            <dt className="text-white/40">Group</dt>
                            <dd>Up to {listing.max_guests}</dd>
                        </div>
                    </dl>
                    <Link
                        href={href}
                        onClick={() => trackEvent("wildlife_experience_clicked", {
                            listing_id: listing.id,
                            service_category: listing.service_category
                        })}
                        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary-400/50 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-200 hover:bg-primary-400/10 hover:text-white"
                    >
                        View experience →
                    </Link>
                </div>
            </div>
        </article>
    );
}
