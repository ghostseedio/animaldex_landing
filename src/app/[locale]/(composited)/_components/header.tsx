import Link from "@/app/[locale]/_components/link";
import {useLocale, useTranslations} from "next-intl";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import Button from "@/app/[locale]/_components/button";
import Marquee from "@/app/[locale]/_components/marquee";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import HeaderMenu from "@/app/[locale]/(composited)/_components/header-menu";

export default function Header() {
    const currentLocale = useLocale();
    const t = useTranslations("nav");

    return (
        <header
            className="flex justify-between items-center mb-16 font-display font-bold text-2xl sticky top-0 py-4 md:py-8
            bg-canvas-900/80 backdrop-blur-xl border-b border-line-400 px-8 md:px-16 z-40"
        >
            <LocaleToggle currentLocale={currentLocale}/>
            <HeaderMenu>
                <HeaderLink
                    href="/#team"
                    data-cursor-text={t('team')}
                >
                    {t('team')}
                </HeaderLink>
                <HeaderLink
                    href="/#features"
                    data-cursor-text={t('features')}
                >
                    {t('features')}
                </HeaderLink>
                <HeaderLink
                    href="/animals"
                    data-cursor-text={t('animals')}
                >
                    {t('animals')}
                </HeaderLink>
                <HeaderLink
                    href="/challenges"
                    data-cursor-text={t('challenges')}
                >
                    {t('challenges')}
                </HeaderLink>
                <HeaderLink
                    href="/rankings"
                    data-cursor-text={t('rankings')}
                >
                    {t('rankings')}
                </HeaderLink>
                <Link
                    href="/#download"
                    className="hidden md:block"
                >
                    <Button
                        as="span"
                        className="inline-flex items-center justify-center w-14 overflow-hidden md:w-48 word-spacing-6 px-[0!important]
                        !text-canvas-950 hover:!text-white !bg-primary-100 hover:!bg-primary-500 active:!text-white
                        border-0 shadow-none"
                    >
                        <Marquee repeatCount={2}>
                            {t('download')}
                        </Marquee>
                    </Button>
                </Link>
                <HeaderLink href="/#download" mobile>
                    {t('download')}
                </HeaderLink>
                <HeaderLink href="/legal/privacy" mobile>
                    {t('privacy')}
                </HeaderLink>
                <HeaderLink href="/animals" mobile>
                    {t('animals')}
                </HeaderLink>
                <HeaderLink href="/challenges" mobile>
                    {t('challenges')}
                </HeaderLink>
                <HeaderLink href="/rankings" mobile>
                    {t('rankings')}
                </HeaderLink>
                <HeaderLink href="/#more" mobile>
                    {t('discover')}
                </HeaderLink>
                <HeaderLink href="/#features" mobile>
                    {t('collection')}
                </HeaderLink>
            </HeaderMenu>
        </header>
    )
}
