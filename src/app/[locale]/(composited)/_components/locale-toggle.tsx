"use client";

import Link from "@/app/[locale]/_components/link";
import {usePathname} from "next/navigation";
import {localeConfig} from "@/i18n";
import {isCollapsedEnglishDetailPath} from "@/lib/english-detail-routes";

const localeFlags: Record<string, string> = {
    en: "🇺🇸",
    id: "🇮🇩"
};

function getPathnameWithoutLocale(pathname: string) {
    for (const locale of localeConfig.locales) {
        if (pathname === `/${locale}`) {
            return "/";
        }

        if (pathname.startsWith(`/${locale}/`)) {
            return pathname.slice(locale.length + 1) || "/";
        }

        if (pathname.startsWith(`/${locale}?`) || pathname.startsWith(`/${locale}#`)) {
            return pathname.slice(locale.length + 1) || "/";
        }
    }

    return pathname;
}

export default function LocaleToggle({currentLocale}: {currentLocale: string}) {
    const pathname = usePathname();
    const unprefixedPath = getPathnameWithoutLocale(pathname || "/");
    const collapsedEnglishDetail = isCollapsedEnglishDetailPath(unprefixedPath);
    const currentFlag = localeFlags[currentLocale] ?? currentLocale.toUpperCase();

    return (
        <details className="relative group">
            <summary
                className="flex h-9 items-center gap-2 list-none cursor-pointer rounded-[2px] border border-line-200 bg-white/[0.02] px-2.5 text-ink-200 select-none transition-colors duration-150 hover:border-line-100 hover:text-white motion-reduce:transition-none"
                aria-label={currentLocale.toUpperCase()}
            >
                <span aria-hidden="true" className="text-base leading-none">{currentFlag}</span>
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em]">{currentLocale}</span>
                <span aria-hidden="true" className="text-[0.5rem] leading-none text-ink-500 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-[2px] border border-line-200 bg-canvas-950 shadow-[0_18px_28px_-20px_rgba(0,0,0,0.95)]">
                {localeConfig.locales.map((locale) => (
                    <Link
                        key={locale}
                        href={collapsedEnglishDetail && locale !== localeConfig.defaultLocale ? "/" : unprefixedPath}
                        locale={locale}
                        className={"relative flex min-h-10 items-center gap-2.5 py-2 pl-3 pr-4 text-sm transition-colors duration-150 hover:bg-white/[0.045] hover:text-white motion-reduce:transition-none " +
                            (locale === currentLocale ? "text-white" : "text-ink-200")}
                        aria-label={locale.toUpperCase()}
                    >
                        {locale === currentLocale ? (
                            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-primary-400" />
                        ) : null}
                        <span aria-hidden="true" className="text-base leading-none">{localeFlags[locale] ?? locale.toUpperCase()}</span>
                        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em]">{locale}</span>
                    </Link>
                ))}
            </div>
        </details>
    );
}
