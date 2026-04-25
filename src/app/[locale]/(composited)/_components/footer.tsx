import Image from "next/image";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import FooterLink from "@/app/[locale]/(composited)/_components/footer-link";
import Link from "@/app/[locale]/_components/link";
import {useTranslations} from "next-intl";
import {ArrowSquareUpIcon, InstagramIcon, TikTokIcon, YouTubeIcon} from "@/app/[locale]/_components/icons";

export default function Footer() {
    const t = useTranslations("nav");
    const footerSections = [
        {
            title: t("footerGroups.product"),
            links: [
                {href: "/#features", label: t("features")},
                {href: "/use-cases", label: t("useCases")},
                {href: "/#download", label: t("download")}
            ]
        },
        {
            title: t("footerGroups.explore"),
            links: [
                {href: "/animals", label: t("animals")},
                {href: "/locations", label: t("locations")},
                {href: "/comparisons", label: t("challenges")},
                {href: "/rankings", label: t("rankings")}
            ]
        },
        {
            title: t("footerGroups.resources"),
            links: [
                {href: "/journal", label: t("journal")},
                {href: "/blog", label: t("blog")},
                {href: "/animal-wisdom", label: t("animalWisdom")},
                {href: "/legal/privacy", label: t("privacy")},
                {href: "mailto:hello@animaldex.app", label: t("support")}
            ]
        }
    ];
    const socialLinks = [
        {href: "https://www.instagram.com/animaldex.app/", label: "Instagram", icon: InstagramIcon},
        {href: "https://www.tiktok.com/@animaldex.app", label: "TikTok", icon: TikTokIcon},
        {href: "https://www.youtube.com/@animaldexapp", label: "YouTube", icon: YouTubeIcon}
    ];

    return (
        <footer className="flex flex-col gap-16 mt-16 px-8 md:px-16 bg-canvas-900 pt-16 pb-16 border-t border-line-400">
            <div className="flex flex-col xl:flex-row w-full justify-between items-center xl:items-start gap-8">
                <div className="flex flex-col gap-4 items-center xl:items-start mb-12 md:mb-0 w-full max-w-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center xl:justify-start">
                        <Image src={logo} alt={t("logo")} width={64} height={64} className="shrink-0" />
                        <Image
                            src="/images/animaldex-logo-text.webp"
                            alt={t("title")}
                            width={320}
                            height={76}
                            className="w-full max-w-[10rem] sm:max-w-[12rem] md:max-w-[14rem] h-auto"
                            priority
                        />
                    </div>
                    <p className="text-xl text-ink-200 w-full text-center xl:text-left">{t("description")}</p>
                </div>
                <div className="flex flex-col gap-10 w-full max-w-3xl items-center xl:items-start">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-10 w-full place-items-center xl:place-items-start">
                        {footerSections.map(section => (
                            <div key={section.title} className="flex flex-col gap-4 items-center xl:items-start">
                                <p className="text-xs font-sans font-semibold uppercase tracking-[0.24em] text-ink-400 text-center xl:text-left">
                                    {section.title}
                                </p>
                                <div className="flex flex-col gap-3 items-center xl:items-start">
                                    {section.links.map(link => (
                                        <FooterLink key={link.href} href={link.href}>
                                            {link.label}
                                        </FooterLink>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-4 w-full items-center xl:items-start">
                        <p className="text-xs font-sans font-semibold uppercase tracking-[0.24em] text-ink-400 text-center xl:text-left">
                            {t("footerGroups.follow")}
                        </p>
                        <div className="flex flex-wrap justify-center xl:justify-start gap-4">
                            {socialLinks.map(link => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={link.label}
                                    title={link.label}
                                    className="flex h-12 w-12 items-center justify-center rounded-full border border-line-300 text-ink-100 transition-colors hover:border-primary-400 hover:text-white"
                                >
                                    <link.icon size={20} />
                                </Link>
                            ))}
                        </div>
                    </div>
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
