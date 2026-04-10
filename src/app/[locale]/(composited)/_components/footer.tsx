import Image from "next/image";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import SplashText from "@/app/[locale]/(composited)/_components/splash-text";
import FooterLink from "@/app/[locale]/(composited)/_components/footer-link";
import Link from "@/app/[locale]/_components/link";
import {useTranslations} from "next-intl";
import {default as splashes} from "@/data/splashes.json";
import {ArrowSquareUpIcon} from "@/app/[locale]/_components/icons";

export default function Footer() {
    const t = useTranslations("nav");

    return (
        <footer className="flex flex-col gap-16 mt-16 px-8 md:px-16 bg-canvas-900 pt-4 pb-16 border-t border-line-400">
            <div className="flex flex-col lg:flex-row w-full justify-between items-center gap-8">
                <div className="flex flex-col gap-4 items-center lg:items-start mb-12 md:mb-0">
                    <Image src={logo} alt={t("logo")} width={64} height={64} />
                    <h3 className="font-display font-bold text-4xl md:text-5xl cursor-help w-full max-w-xs text-center lg:text-left">
                        <SplashText splashes={[
                            t("title"),
                            ...splashes.map(s => s.toLowerCase())
                        ]} />
                    </h3>
                    <p className="text-xl text-ink-200 w-full max-w-sm text-center lg:text-left">{t("description")}</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6 w-full max-w-2xl place-items-center lg:place-items-start">
                    <FooterLink href="/#features">
                        {t('features')}
                    </FooterLink>
                    <FooterLink href="/animals">
                        {t('animals')}
                    </FooterLink>
                    <FooterLink href="/use-cases">
                        {t('useCases')}
                    </FooterLink>
                    <FooterLink href="/journal">
                        {t('journal')}
                    </FooterLink>
                    <FooterLink href="/blog">
                        {t('blog')}
                    </FooterLink>
                    <FooterLink href="/#download">
                        {t('download')}
                    </FooterLink>
                    <FooterLink href="/legal/privacy">
                        {t('privacy')}
                    </FooterLink>
                    <FooterLink href="mailto:hello@animaldex.app">
                        {t('support')}
                    </FooterLink>
                </div>
                <Link
                    href="#top"
                    role="button"
                    className="group w-32 h-32 font-bold font-display aspect-square text-4xl overflow-hidden hover:bg-primary-500 flex-col
                        hover:text-canvas-950 rounded-full bg-surface-800 text-primary-500 flex justify-center items-center transition-colors
                        active:bg-primary-400 active:text-canvas-950 duration-300 ease-in-out min-w-max min-h-max border border-line-300"
                >
                    <span className="group-hover:-translate-y-32 transition-transform duration-300 ease-in-out">up</span>
                    <span className="translate-y-32 group-hover:-translate-y-5 transition-transform h-0 duration-300 ease-in-out flex items-center">
                        <ArrowSquareUpIcon size={60} />
                    </span>
                </Link>
            </div>
            <div className="flex flex-col lg:flex-row w-full justify-center items-center gap-2 lg:gap-8 text-ink-300">
                <div className="hover:font-semibold transition-all flex gap-1">
                    {t('credits.platform') + ' '}
                    <span className="text-primary-200">
                        {t('credits.platformValue')}
                    </span>
                </div>
                <div className="hover:font-semibold transition-all flex gap-1">
                    {t('credits.status') + ' '}
                    <span className="text-primary-200">
                        {t('credits.statusValue')}
                    </span>
                </div>
            </div>
        </footer>
    )
}
