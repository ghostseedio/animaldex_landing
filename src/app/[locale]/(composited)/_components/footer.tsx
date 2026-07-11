import Image from "next/image";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import FooterLink from "@/app/[locale]/(composited)/_components/footer-link";
import Link from "@/app/[locale]/_components/link";
import { useTranslations } from "next-intl";
import {ArrowSquareUpIcon, FacebookIcon, InstagramIcon, RedditIcon, SubstackIcon, TikTokIcon, XIcon, YouTubeIcon} from "@/app/[locale]/_components/icons";
import {socialProfileUrls} from "@/lib/social-links";

export default function Footer() {
    const t = useTranslations("nav");
    const footerSections = [
        {
            title: t("footerGroups.product"),
            links: [
                { href: "/#more", label: t("howItWorks") },
                { href: "/#features", label: t("features") },
                { href: "/use-cases", label: t("useCases") },
                { href: "/#download", label: t("download") }
            ]
        },
        {
            title: t("footerGroups.explore"),
            links: [
                { href: "/animals", label: t("browseAnimals") },
                { href: "/tier-list", label: t("rankings") },
                { href: "/comparisons", label: t("challenges") },
                { href: "/locations", label: t("locations") },
                { href: "/what-animal-am-i", label: t("whatAnimalAmI") }
            ]
        },
        {
            title: t("footerGroups.wisdom"),
            links: [
                { href: "/animal-wisdom", label: t("animalWisdom") },
                { href: "/animal-symbolism", label: t("animalSymbolism") },
                { href: "/animal-lessons", label: t("animalLessons") },
                { href: "/powers", label: t("qualities") }
            ]
        },
        {
            title: t("footerGroups.resources"),
            links: [
                { href: "/blog", label: t("articlesGuides") },
                { href: "/support", label: t("support") },
                { href: "/contact", label: t("contact") }
            ]
        }
    ];
    const socialLinks = [
        {
            href: socialProfileUrls.facebook,
            label: "Facebook",
            icon: FacebookIcon
        },
        {href: socialProfileUrls.instagram, label: "Instagram", icon: InstagramIcon},
        {href: socialProfileUrls.x, label: "X", icon: XIcon},
        {href: socialProfileUrls.tiktok, label: "TikTok", icon: TikTokIcon},
        {href: socialProfileUrls.youtube, label: "YouTube", icon: YouTubeIcon},
        {href: socialProfileUrls.substack, label: "Substack", icon: SubstackIcon},
        {href: socialProfileUrls.reddit, label: "Reddit", icon: RedditIcon}
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
                    <div className="flex w-full flex-col items-center gap-4">
                        <div
                            className="relative h-px w-28 overflow-hidden rounded-full bg-gradient-to-r from-transparent via-primary-100/80 to-transparent"
                            aria-hidden="true"
                        >
                            <span className="absolute left-1/2 top-1/2 h-[3px] w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-200/70 blur-[1px]" />
                        </div>
                        <p className="text-center font-display text-xl font-bold leading-tight text-white">
                            {t("description")}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-10 w-full max-w-5xl items-center xl:items-start">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-10 gap-y-10 w-full place-items-center xl:place-items-start">
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
            <nav
                aria-label="Legal and support"
                className="flex flex-wrap w-full justify-center items-center gap-x-6 gap-y-3 text-sm text-ink-200 border-t border-line-400 pt-8"
            >
                <FooterLink href="/legal/privacy">{t("privacy")}</FooterLink>
                <FooterLink href="/legal/terms">{t("terms")}</FooterLink>
            </nav>
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
