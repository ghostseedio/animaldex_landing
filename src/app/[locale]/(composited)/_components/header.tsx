import Link from "@/app/[locale]/_components/link";
import Image from "next/image";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import type {ScopedTranslator} from "@/loaders/translation";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import HeaderMenu from "@/app/[locale]/(composited)/_components/header-menu";
import HeaderAuthLink from "@/app/[locale]/(composited)/_components/header-auth-link";
import HeaderDropdown, {HeaderDropdownProvider} from "@/app/[locale]/(composited)/_components/header-dropdown";
import HeaderMobileNav from "@/app/[locale]/(composited)/_components/header-mobile-nav";
import {
    BLOG_HREF,
    START_COLLECTION_HREF,
    blogNavLink,
    headerDropdowns,
    mobileAccordionSections,
    moreNavGroups,
    type PublicNavLink
} from "@/data/public-navigation";

function translateLinks(t: (key: string) => string, links: PublicNavLink[]) {
    return links.map((link) => ({
        href: link.href,
        label: t(link.labelKey)
    }));
}

export default function Header({locale, t}: {locale: string; t: ScopedTranslator}) {
    const startCollectionLabel = t("startYourCollection");
    const desktopDropdowns = headerDropdowns.map((section) => ({
        ...section,
        title: t(section.titleKey),
        items: translateLinks(t, section.links)
    }));

    return (
        <header
            className="sticky top-0 z-40 mb-8 border-b border-line-400 bg-canvas-900/92 px-4 py-3 font-display font-bold backdrop-blur-xl md:px-8"
        >
            <div className="mx-auto flex h-14 w-full max-w-[86rem] items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3 md:gap-5">
                    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={t("logo")}>
                        <img
                            src="/images/logo.webp"
                            alt=""
                            aria-hidden="true"
                            width={44}
                            height={44}
                            className="h-10 w-10"
                        />
                        <Image
                            src="/images/animaldex-logo-text.webp"
                            alt={t("title")}
                            width={320}
                            height={76}
                            priority
                            className="h-7 w-auto max-w-[7.5rem] md:h-8 md:max-w-[9rem]"
                        />
                    </Link>
                    <LocaleToggle currentLocale={locale} />
                </div>
                <HeaderMenu
                    logoLabel={t("logo")}
                    brandTitle={t("title")}
                    ctaHref={START_COLLECTION_HREF}
                    ctaLabel={startCollectionLabel}
                    navigationLabel={t("discover")}
                    followLabel={t("footerGroups.follow")}
                    mobileLinks={(
                        <HeaderMobileNav
                            sections={mobileAccordionSections.map((section) => ({
                                id: section.id,
                                title: t(section.titleKey),
                                links: translateLinks(t, section.links)
                            }))}
                            blog={{href: blogNavLink.href, label: t(blogNavLink.labelKey)}}
                            moreTitle={t("moreNav")}
                            moreGroups={moreNavGroups.map((group) => translateLinks(t, group))}
                        />
                    )}
                    mobileAuth={<HeaderAuthLink webAppLabel={t("webApp")} myAnimalsLabel={t("myAnimals")} mobile />}
                >
                    <HeaderDropdownProvider>
                        {desktopDropdowns.map((section) => (
                            <HeaderDropdown key={section.id} label={section.title} items={section.items} />
                        ))}
                        <HeaderLink href={BLOG_HREF} data-cursor-text={t("blog")}>
                            {t("blog")}
                        </HeaderLink>
                    </HeaderDropdownProvider>
                    <HeaderAuthLink webAppLabel={t("webApp")} myAnimalsLabel={t("myAnimals")} />
                    <Link href={START_COLLECTION_HREF} className="hidden xl:inline-flex">
                        <span
                            className="inline-flex min-h-[42px] items-center justify-center whitespace-nowrap rounded-md bg-primary-400 px-5 text-sm font-bold text-canvas-950 transition-colors hover:bg-primary-300 focus-visible:bg-primary-300"
                        >
                            {startCollectionLabel}
                        </span>
                    </Link>
                </HeaderMenu>
            </div>
        </header>
    );
}
