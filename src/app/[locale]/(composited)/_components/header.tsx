import Link from "@/app/[locale]/_components/link";
import Image from "next/image";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import ThemeToggle from "@/components/theme/theme-toggle";
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
        label: t(link.labelKey),
        preview: link.preview
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
            className="sticky top-0 z-40 mb-8 border-b border-line-200 bg-canvas-950/[0.94] px-4 font-display font-bold backdrop-blur-xl md:px-6 xl:px-8"
        >
            <div className="mx-auto flex h-16 w-full max-w-[86rem] items-stretch justify-between gap-3">
                <div className="flex min-w-0 shrink-0 items-center gap-3">
                    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={t("logo")}>
                        <img
                            src="/images/logo.webp"
                            alt=""
                            aria-hidden="true"
                            width={44}
                            height={44}
                            className="h-9 w-9"
                        />
                        <Image
                            src="/images/animaldex-logo-text.webp"
                            alt={t("title")}
                            width={320}
                            height={76}
                            priority
                            className="h-[1.625rem] w-auto max-w-[7.25rem] md:h-7 md:max-w-[8.25rem]"
                        />
                    </Link>
                    {/* A hairline separates identity from navigation, the way a field
                        guide separates its masthead from the index. */}
                    <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-line-200 xl:block" />
                </div>
                <HeaderMenu
                    logoLabel={t("logo")}
                    brandTitle={t("title")}
                    ctaHref={START_COLLECTION_HREF}
                    ctaLabel={startCollectionLabel}
                    navigationLabel={t("discover")}
                    followLabel={t("footerGroups.follow")}
                    actions={(
                        <>
                            <LocaleToggle currentLocale={locale} />
                            <ThemeToggle toLightLabel={t("themeToLight")} toDarkLabel={t("themeToDark")} />
                            <HeaderAuthLink webAppLabel={t("webApp")} myAnimalsLabel={t("myAnimals")} />
                            <Link
                                href={START_COLLECTION_HREF}
                                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[2px] bg-primary-400 px-4 text-[0.8125rem] font-black uppercase leading-none tracking-[0.04em] text-canvas-950 transition-colors duration-150 hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                            >
                                {startCollectionLabel}
                            </Link>
                        </>
                    )}
                    mobileLocale={(
                        <div className="flex items-center gap-2">
                            <LocaleToggle currentLocale={locale} />
                            <ThemeToggle toLightLabel={t("themeToLight")} toDarkLabel={t("themeToDark")} />
                        </div>
                    )}
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
                            <HeaderDropdown
                                key={section.id}
                                label={section.title}
                                items={section.items}
                                ruleAfterHref={section.ruleAfterHref}
                            />
                        ))}
                        <HeaderLink href={BLOG_HREF}>
                            {t("blog")}
                        </HeaderLink>
                    </HeaderDropdownProvider>
                </HeaderMenu>
            </div>
        </header>
    );
}
