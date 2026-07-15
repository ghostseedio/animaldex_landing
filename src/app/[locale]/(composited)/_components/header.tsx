import Link from "@/app/[locale]/_components/link";
import {useLocale, useTranslations} from "next-intl";
import LocaleToggle from "@/app/[locale]/(composited)/_components/locale-toggle";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import HeaderMenu from "@/app/[locale]/(composited)/_components/header-menu";
import HeaderAuthLink from "@/app/[locale]/(composited)/_components/header-auth-link";

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
                    <LocaleToggle currentLocale={currentLocale}/>
                </div>
                <HeaderMenu>
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
                            className="inline-flex min-h-[42px] items-center justify-center whitespace-nowrap rounded-md bg-primary-100 px-5 text-sm font-bold text-canvas-950 transition-colors hover:bg-primary-500 hover:text-white focus-visible:bg-primary-500 focus-visible:text-white"
                        >
                            {t("download")}
                        </span>
                    </Link>
                    <HeaderLink href="/animals" mobile>
                        {t("animals")}
                    </HeaderLink>
                    <HeaderLink href="/animal-wisdom" mobile>
                        {t("animalWisdom")}
                    </HeaderLink>
                    <HeaderLink href="/blog" mobile>
                        {t("blog")}
                    </HeaderLink>
                    <HeaderLink href="/app" mobile>
                        {t("signIn")}
                    </HeaderLink>
                    <HeaderLink href="/app" mobile>
                        {t("myAnimals")}
                    </HeaderLink>
                    <HeaderLink href="/#download" mobile>
                        {t("download")}
                    </HeaderLink>
                </HeaderMenu>
            </div>
        </header>
    )
}
