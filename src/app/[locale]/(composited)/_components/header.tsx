import Link from "@/app/[locale]/_components/link";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import ThemeToggle from "@/components/theme/theme-toggle";
import type {ScopedTranslator} from "@/loaders/translation";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import HeaderMenu from "@/app/[locale]/(composited)/_components/header-menu";
import HeaderAuthLink, {HeaderAccountButton} from "@/app/[locale]/(composited)/_components/header-auth-link";
import HeaderMobileNav from "@/app/[locale]/(composited)/_components/header-mobile-nav";
import HeaderTalkLink from "@/app/[locale]/(composited)/_components/header-talk-link";
import BrandLockup from "@/components/brand/brand-lockup";
import {
    START_COLLECTION_HREF,
    TALK_HREF,
    headerNavLinks,
    type PublicNavLink
} from "@/data/public-navigation";

function translateLinks(t: (key: string) => string, links: PublicNavLink[]) {
    return links.map((link) => ({
        href: link.href,
        label: t(link.labelKey)
    }));
}

/** Controls are pills (WEB-25): one shape, sentence case, a visible focus ring. */
const pill = "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full px-4 font-sans text-[0.8125rem] font-semibold leading-none transition-colors duration-200 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none";

export default function Header({locale, t}: {locale: string; t: ScopedTranslator}) {
    // The primary action on every page is talking (docs/rich-chat/SPEC.md §4.5),
    // with getting the app beside it. On a species page it talks to that animal.
    // Nov 2026: the whole header is Talk · Find your animals · Get the app.
    const ctaLabel = t("talkToAnAnimal");
    const getAppLabel = t("getTheApp");
    const navLinks = translateLinks(t, headerNavLinks);

    return (
        <header
            className="sticky top-0 z-40 mb-8 border-b border-line-200 bg-canvas-950/[0.94] px-4 font-display font-bold backdrop-blur-xl md:px-6 xl:px-8"
        >
            <a
                href="#main"
                className="sr-only rounded-full bg-primary-400 px-4 py-2 font-sans text-sm font-bold text-canvas-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary-300"
            >
                {t("skipToContent")}
            </a>
            <div className="mx-auto flex h-16 w-full max-w-[86rem] items-stretch justify-between gap-3">
                <div className="flex min-w-0 shrink-0 items-center gap-3">
                    <Link href="/" className="flex shrink-0 items-center" aria-label={t("logo")}>
                        {/* Signed in on a narrow phone, the avatar needs the room: the
                            mark stays, the word steps aside. */}
                        <BrandLockup size={null} className="[--brand-size:25px] md:[--brand-size:28px]" wordClassName="header-wordmark" />
                    </Link>
                    {/* A hairline separates identity from navigation, the way a field
                        guide separates its masthead from the index. */}
                    <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-line-200 xl:block" />
                </div>
                <HeaderMenu
                    logoLabel={t("logo")}
                    ctaHref={TALK_HREF}
                    ctaLabel={ctaLabel}
                    secondaryCtaHref={START_COLLECTION_HREF}
                    secondaryCtaLabel={getAppLabel}
                    navigationLabel={t("discover")}
                    followLabel={t("footerGroups.follow")}
                    openMenuLabel={t("openMenu")}
                    closeMenuLabel={t("closeMenu")}
                    actions={(
                        <>
                            <LocaleToggle currentLocale={locale} label={t("language")} />
                            <ThemeToggle toLightLabel={t("themeToLight")} toDarkLabel={t("themeToDark")} />
                            <HeaderAuthLink signInLabel={t("signIn")} myAnimalsLabel={t("myAnimals")} />
                            <Link
                                href={START_COLLECTION_HREF}
                                className={`${pill} border border-line-100 text-ink-100 hover:border-primary-400 hover:text-white focus-visible:border-primary-400 focus-visible:text-white`}
                            >
                                {getAppLabel}
                            </Link>
                            <HeaderTalkLink
                                href={TALK_HREF}
                                className={`${pill} bg-primary-400 px-5 text-canvas-950 hover:bg-primary-100 focus-visible:bg-primary-100`}
                            >
                                {ctaLabel}
                            </HeaderTalkLink>
                            <HeaderAccountButton myAnimalsLabel={t("myAnimals")} />
                        </>
                    )}
                    mobileLocale={(
                        <div className="flex items-center gap-2">
                            <LocaleToggle currentLocale={locale} label={t("language")} />
                            <ThemeToggle toLightLabel={t("themeToLight")} toDarkLabel={t("themeToDark")} />
                            <HeaderAccountButton myAnimalsLabel={t("myAnimals")} compact />
                        </div>
                    )}
                    mobileLinks={(
                        <HeaderMobileNav
                            topLinks={navLinks}
                            sections={[]}
                            moreTitle={t("moreNav")}
                            moreGroups={[]}
                        />
                    )}
                    mobileAuth={<HeaderAuthLink signInLabel={t("signIn")} myAnimalsLabel={t("myAnimals")} mobile />}
                >
                    {navLinks.map((link) => (
                        <HeaderLink key={link.href} href={link.href}>
                            {link.label}
                        </HeaderLink>
                    ))}
                </HeaderMenu>
            </div>
        </header>
    );
}
