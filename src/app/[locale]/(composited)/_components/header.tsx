import Link from "@/app/[locale]/_components/link";
import {useLocale, useTranslations} from "next-intl";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import HeaderMenu from "@/app/[locale]/(composited)/_components/header-menu";
import HeaderAuthLink from "@/app/[locale]/(composited)/_components/header-auth-link";
import {ChecklistIcon, DatabaseIcon, DocumentIcon, HelpCircleIcon, SparklesIcon} from "@/app/[locale]/_components/icons";

function MobileNavIcon({type}: {type: "location" | "use-case" | "feature"}) {
    const paths = {
        location: <><path d="M12 21s6-5.15 6-11a6 6 0 1 0-12 0c0 5.85 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
        "use-case": <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M8 5V3h8v2M3 11h18M10 11v2h4v-2" /></>,
        feature: <><path d="M12 3 14.4 8.6 20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z" /><path d="m19 3 .7 1.3L21 5l-1.3.7L19 7l-.7-1.3L17 5l1.3-.7L19 3Z" /></>
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}

export default function Header({locale}: {locale?: string}) {
    const currentLocale = useLocale();
    const resolvedLocale = locale ?? currentLocale;
    const t = useTranslations("nav");

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
                        <span className="text-xl tracking-tight text-white md:text-2xl">{t("title")}</span>
                    </Link>
                    <LocaleToggle currentLocale={resolvedLocale} />
                </div>
                <HeaderMenu
                    logoLabel={t("logo")}
                    brandTitle={t("title")}
                    getAppLabel={t("download")}
                    navigationLabel={t("discover")}
                    followLabel={t("footerGroups.follow")}
                    mobileLinks={(
                        <>
                            <HeaderLink href="/animals" mobile icon={<DatabaseIcon size={20} />}>{t("animals")}</HeaderLink>
                            <HeaderLink href="/tier-list" mobile icon={<ChecklistIcon size={20} />}>{t("rankings")}</HeaderLink>
                            <HeaderLink href="/locations" mobile icon={<MobileNavIcon type="location" />}>{t("locations")}</HeaderLink>
                            <HeaderLink href="/animal-wisdom" mobile icon={<SparklesIcon size={20} />}>{t("animalWisdom")}</HeaderLink>
                            <HeaderLink href="/blog" mobile icon={<DocumentIcon size={20} />}>{t("blog")}</HeaderLink>
                            <HeaderLink href="/use-cases" mobile icon={<MobileNavIcon type="use-case" />}>{t("useCases")}</HeaderLink>
                            <HeaderLink href="/#features" mobile icon={<MobileNavIcon type="feature" />}>{t("features")}</HeaderLink>
                            <HeaderLink href="/support" mobile icon={<HelpCircleIcon size={20} />}>{t("support")}</HeaderLink>
                        </>
                    )}
                    mobileAuth={<HeaderAuthLink signInLabel={t("signIn")} myAnimalsLabel={t("myAnimals")} mobile />}
                >
                    <HeaderLink href="/#team" data-cursor-text={t("team")}>
                        {t("team")}
                    </HeaderLink>
                    <HeaderLink href="/#features" data-cursor-text={t("features")}>
                        {t("features")}
                    </HeaderLink>
                    <HeaderLink href="/animals" data-cursor-text={t("animals")}>
                        {t("animals")}
                    </HeaderLink>
                    <HeaderAuthLink signInLabel={t("signIn")} myAnimalsLabel={t("myAnimals")} />
                    <Link href="/#download" className="hidden md:inline-flex">
                        <span
                            className="inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-md border border-primary-100 bg-transparent px-5 text-sm font-bold text-primary-100 transition-colors hover:border-primary-500 hover:bg-primary-500 hover:text-white focus-visible:border-primary-500 focus-visible:bg-primary-500 focus-visible:text-white"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <path d="M12 3v12" strokeLinecap="round" />
                                <path d="m7.5 10.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M5 20h14" strokeLinecap="round" />
                            </svg>
                            {t("download")}
                        </span>
                    </Link>
                </HeaderMenu>
            </div>
        </header>
    );
}
