"use client";

import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import {uniqueCtaEvents} from "@/lib/instagram-import";

export default function UseCaseProductCta({
    href,
    label,
    event,
    extraEvents = [],
    source,
    variant = "primary"
}: {
    href: string;
    label: string;
    event: string;
    extraEvents?: string[];
    source?: string;
    variant?: "primary" | "secondary";
}) {
    const className = variant === "secondary"
        ? "inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
        : "inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary-400 px-6 py-3 text-sm font-black text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200";
    const payload = {
        source: source ?? event,
        cta: label,
        href
    };
    return (
        <Link
            href={href}
            onClick={() => {
                for (const name of uniqueCtaEvents(event, extraEvents)) {
                    trackEvent(name, payload);
                }
            }}
            className={className}
        >
            {label}
        </Link>
    );
}
