"use client";

import Link from "@/app/[locale]/_components/link";
import {usePathname} from "next/navigation";
import {localeConfig} from "@/i18n";
import {isCollapsedEnglishDetailPath} from "@/lib/english-detail-routes";

/**
 * A language, not a country: a globe and the language's own name rather than a
 * flag emoji (which Windows draws as the letters "US"). WEB-26.
 */
const localeNames: Record<string, string> = {
    en: "English",
    id: "Bahasa Indonesia"
};

function GlobeIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
            <circle cx="10" cy="10" r="7.25" />
            <path d="M2.75 10h14.5M10 2.75c2 2.1 3 4.5 3 7.25s-1 5.15-3 7.25M10 2.75C8 4.85 7 7.25 7 10s1 5.15 3 7.25" />
        </svg>
    );
}

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

export default function LocaleToggle({currentLocale, label = "Language"}: {currentLocale: string; label?: string}) {
    const pathname = usePathname();
    const unprefixedPath = getPathnameWithoutLocale(pathname || "/");
    const collapsedEnglishDetail = isCollapsedEnglishDetailPath(unprefixedPath);

    return (
        <details className="relative group">
            <summary
                className="flex h-9 items-center gap-1.5 list-none cursor-pointer rounded-full border border-line-200 bg-white/[0.02] px-3 text-ink-200 select-none transition-colors duration-150 hover:border-line-100 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
                aria-label={`${label}: ${localeNames[currentLocale] ?? currentLocale.toUpperCase()}`}
            >
                <GlobeIcon />
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em]">{currentLocale}</span>
                <span aria-hidden="true" className="text-[0.5rem] leading-none text-ink-500 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[12rem] overflow-hidden rounded-2xl border border-line-200 bg-canvas-950 py-1 shadow-[0_18px_28px_-20px_rgba(0,0,0,0.95)]">
                {localeConfig.locales.map((locale) => (
                    <Link
                        key={locale}
                        href={collapsedEnglishDetail && locale !== localeConfig.defaultLocale ? "/" : unprefixedPath}
                        locale={locale}
                        lang={locale}
                        aria-current={locale === currentLocale ? "true" : undefined}
                        className={"relative flex min-h-11 items-center gap-3 py-2 pl-4 pr-4 font-sans text-sm font-semibold transition-colors duration-150 hover:bg-white/[0.045] hover:text-white motion-reduce:transition-none " +
                            (locale === currentLocale ? "text-white" : "text-ink-200")}
                    >
                        {locale === currentLocale ? (
                            <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-primary-400" />
                        ) : null}
                        <span aria-hidden="true" className="w-6 font-display text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink-400">{locale}</span>
                        <span>{localeNames[locale] ?? locale.toUpperCase()}</span>
                    </Link>
                ))}
            </div>
        </details>
    );
}
