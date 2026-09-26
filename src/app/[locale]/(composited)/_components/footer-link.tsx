import Link from "@/app/[locale]/_components/link";

export type FooterLinkProps = {
    href: string;
    children: string;
}

/**
 * One footer navigation link.
 *
 * Deliberately plain: colour is the only thing that changes on hover. The
 * previous version went `font-normal` -> `font-semibold`, which reflowed the
 * whole column under the cursor, and carried the animated underline bar, which
 * made a five-column sitemap twitch as the eye moved across it.
 */
export default function FooterLink({href, children}: FooterLinkProps) {
    return (
        <Link
            href={href}
            className="w-fit py-1 text-[13px] leading-6 text-ink-200 transition-colors hover:text-primary-200 focus-visible:text-primary-200 md:py-0 md:text-sm"
        >
            {children}
        </Link>
    )
}
