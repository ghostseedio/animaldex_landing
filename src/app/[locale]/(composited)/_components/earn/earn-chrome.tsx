"use client";

import Link from "@/app/[locale]/_components/link";
import {trackEvent} from "@/lib/analytics";
import type {ReactNode} from "react";

export function EarnTrackLink({
    href,
    event,
    label,
    className,
    children,
    external = false
}: {
    href: string;
    event: string;
    label: string;
    className?: string;
    children: ReactNode;
    external?: boolean;
}) {
    return (
        <Link
            href={href}
            className={className}
            {...(external ? {target: "_blank", rel: "noopener noreferrer"} : {})}
            onClick={() => trackEvent(event, {source: event, cta: label, href})}
        >
            {children}
        </Link>
    );
}

export function EarnPrimaryCta({
    href,
    event,
    label,
    children,
    external = false
}: {
    href: string;
    event: string;
    label: string;
    children: ReactNode;
    external?: boolean;
}) {
    return (
        <EarnTrackLink
            href={href}
            event={event}
            label={label}
            external={external}
            className="inline-flex min-h-[3.1rem] items-center justify-center rounded-full bg-primary-400 px-7 font-display text-sm font-bold uppercase tracking-[0.14em] text-canvas-950 transition-colors hover:bg-primary-200"
        >
            {children}
        </EarnTrackLink>
    );
}

const earnMarketingHrefs = [
    "/earn-on-animaldex",
    "/become-a-wildlife-guide",
    "/creator-rewards",
    "/sponsor-a-challenge"
] as const;

const importMarketingHrefs = [
    "/use-cases/import-instagram-wildlife-photos",
    "/app/import/instagram"
] as const;

export function isEarnMarketingHref(href: string) {
    const path = href.split(/[?#]/)[0];
    return earnMarketingHrefs.some((prefix) => path === prefix);
}

export function isImportMarketingHref(href: string) {
    const path = href.split(/[?#]/)[0].replace(/^\/id(?=\/)/, "");
    return importMarketingHrefs.some((prefix) => path === prefix || path.endsWith(prefix));
}

export function EarnContentLink({
    href,
    className,
    children,
    source
}: {
    href: string;
    className?: string;
    children: ReactNode;
    source: "blog" | "support";
}) {
    if (isImportMarketingHref(href)) {
        return (
            <EarnTrackLink
                href={href}
                event={source === "blog" ? "blog_to_import" : "support_to_import"}
                label={href}
                className={className}
            >
                {children}
            </EarnTrackLink>
        );
    }

    if (!isEarnMarketingHref(href)) {
        return (
            <Link href={href} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <EarnTrackLink
            href={href}
            event={source === "blog" ? "blog_product_cta_clicked" : "support_marketing_clicked"}
            label={href}
            className={className}
        >
            {children}
        </EarnTrackLink>
    );
}

export function EarnGhostCta({
    href,
    event,
    label,
    children
}: {
    href: string;
    event: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <EarnTrackLink
            href={href}
            event={event}
            label={label}
            className="inline-flex min-h-[3.1rem] items-center justify-center rounded-full border border-primary-200/35 px-7 font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200 transition-colors hover:border-primary-200/70 hover:text-white"
        >
            {children}
        </EarnTrackLink>
    );
}
