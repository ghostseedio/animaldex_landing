import Image from "next/image";
import FooterLink from "@/app/[locale]/(composited)/_components/footer-link";
import FooterBackToTop from "@/app/[locale]/(composited)/_components/footer-back-to-top";
import Link from "@/app/[locale]/_components/link";
import {FacebookIcon, InstagramIcon, RedditIcon, SubstackIcon, TikTokIcon, XIcon, YouTubeIcon} from "@/app/[locale]/_components/icons";
import type {ScopedTranslator} from "@/loaders/translation";
import {socialProfileUrls} from "@/lib/social-links";
import {footerColumns, type PublicNavLink} from "@/data/public-navigation";

const socialLinks = [
    {href: socialProfileUrls.facebook, label: "Facebook", icon: FacebookIcon},
    {href: socialProfileUrls.instagram, label: "Instagram", icon: InstagramIcon},
    {href: socialProfileUrls.x, label: "X", icon: XIcon},
    {href: socialProfileUrls.tiktok, label: "TikTok", icon: TikTokIcon},
    {href: socialProfileUrls.youtube, label: "YouTube", icon: YouTubeIcon},
    {href: socialProfileUrls.substack, label: "Substack", icon: SubstackIcon},
    {href: socialProfileUrls.reddit, label: "Reddit", icon: RedditIcon}
];

/**
 * Site footer: the closing page of the field guide.
 *
 * Structure carries the hierarchy, not containers — a brand column against a
 * navigation grid, separated by thin rules, with one motif (the numbered column
 * index) borrowed from a printed guide's back matter. Nothing here is a card.
 *
 * The previous version stacked four full-width blocks separated by `gap-16`,
 * centred everything below `xl`, and gave a 128px circular "up" control the same
 * weight as an entire navigation column, so the footer ran well over 1000px tall
 * for about twenty-five links.
 */
export default function Footer({t}: {t: ScopedTranslator}) {
    function renderLinks(links: PublicNavLink[]) {
        return links.map((link) => (
            <FooterLink key={`${link.href}-${link.labelKey}`} href={link.href}>
                {t(link.labelKey)}
            </FooterLink>
        ));
    }

    return (
        <footer className="mt-16 border-t border-line-400 bg-canvas-900">
            <div className="mx-auto flex w-full max-w-[88rem] flex-col px-4 md:px-8">
                <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-16 lg:py-14">
                    {/* Signature block: mark, wordmark, rule, promise — read as one object. */}
                    {/* Between tablet and desktop the brand block owns a full-width
                        row, so it runs horizontally there and stacks again once it
                        becomes the left column. */}
                    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8 lg:flex-col lg:items-stretch lg:gap-5">
                        <div className="flex flex-col gap-5">
                        <Link href="/" aria-label={t("logo")} className="flex w-fit items-center gap-3">
                            {/* The header's mark, so the two signatures match. The
                                SVG in _assets is 600KB and arrives late through the
                                image optimizer. */}
                            <img src="/images/logo.webp" alt="" aria-hidden="true" width={40} height={40} className="h-10 w-10 shrink-0" />
                            <Image
                                src="/images/animaldex-logo-text.webp"
                                alt={t("title")}
                                width={320}
                                height={76}
                                className="h-7 w-auto"
                            />
                        </Link>

                        <div className="flex flex-col gap-3">
                            <span aria-hidden="true" className="h-[2px] w-9 bg-primary-400" />
                            <p className="max-w-[22ch] font-display text-lg font-bold leading-snug text-white md:text-xl">
                                {t("description")}
                            </p>
                        </div>

                        </div>

                        <div className="flex flex-col gap-3 md:shrink-0 lg:mt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                                {t("footerGroups.follow")}
                            </p>
                            <ul className="-ml-2.5 flex flex-wrap">
                                {socialLinks.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={link.label}
                                            title={link.label}
                                            className="flex h-11 w-11 items-center justify-center text-ink-300 transition-colors hover:bg-white/[0.04] hover:text-primary-200 focus-visible:bg-white/[0.04] focus-visible:text-primary-200"
                                        >
                                            <link.icon size={18} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Navigation. Numbered like the index of a field guide — the one motif. */}
                    <nav aria-label={t("title")} className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4 lg:gap-x-8">
                        {footerColumns.map((section, index) => (
                            <div key={section.titleKey} className="flex min-w-0 flex-col gap-3">
                                {/* Fixed height so every rule lands on the same line,
                                    whether or not the label wraps to two. */}
                                <p className="flex min-h-[3.25rem] items-end border-b border-line-400 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                                    <span className="flex items-baseline gap-2">
                                        <span aria-hidden="true" className="font-mono text-[10px] tabular-nums text-primary-400/60">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="min-w-0">{t(section.titleKey)}</span>
                                    </span>
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {section.groups
                                        ? section.groups.map((group, groupIndex) => (
                                            <div key={groupIndex} className="flex flex-col gap-1.5 [&:not(:first-child)]:mt-3">
                                                {renderLinks(group)}
                                            </div>
                                        ))
                                        : renderLinks(section.links ?? [])}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Bottom bar: legal, company, and the return control, on one rule. */}
                <div className="flex flex-col gap-4 border-t border-line-400 py-6 md:flex-row md:items-center md:justify-between md:gap-8">
                    <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <FooterLink href="/legal/privacy">{t("privacy")}</FooterLink>
                        <FooterLink href="/legal/terms">{t("terms")}</FooterLink>
                        <FooterLink href="/legal/refunds">{t("refunds")}</FooterLink>
                    </nav>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-400">
                        <p>
                            <span className="sr-only">{t("credits.platform")}: </span>
                            {t("credits.platformValue")}
                        </p>
                        <p>
                            <span className="sr-only">{t("credits.status")}: </span>
                            {t("credits.statusValue")}
                        </p>
                        <FooterBackToTop label="Back to top" />
                    </div>
                </div>
            </div>
        </footer>
    )
}
