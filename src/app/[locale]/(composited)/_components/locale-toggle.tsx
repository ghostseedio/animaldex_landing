"use client";

import Link from "@/app/[locale]/_components/link";
import {usePathname} from "next-intl/client";
import {localeConfig} from "@/i18n";

const localeFlags: Record<string, string> = {
    en: "🇺🇸",
    id: "🇮🇩"
};

export default function LocaleToggle({currentLocale}: {currentLocale: string}) {
    const path = usePathname();
    const currentFlag = localeFlags[currentLocale] ?? currentLocale.toUpperCase();

    return (
        <details className="relative group">
            <summary
                className="flex items-center gap-2 list-none cursor-pointer rounded-full border border-line-300 bg-canvas-900/90 px-3 py-2 text-ink-200 select-none"
                aria-label={currentLocale.toUpperCase()}
            >
                <span aria-hidden="true" className="text-2xl leading-none">{currentFlag}</span>
                <span className="text-xs uppercase tracking-[0.18em]">{currentLocale}</span>
                <span aria-hidden="true" className="text-xs text-ink-400 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute left-0 top-full z-50 mt-2 min-w-full overflow-hidden rounded-2xl border border-line-300 bg-canvas-900/95 shadow-lg backdrop-blur-xl">
                {localeConfig.locales.map((locale) => (
                    <Link
                        key={locale}
                        href={path || "/"}
                        locale={locale}
                        className={"flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-800 " +
                            (locale === currentLocale ? "text-primary-500" : "text-ink-200")}
                        data-cursor-text={locale.toUpperCase()}
                        aria-label={locale.toUpperCase()}
                    >
                        <span aria-hidden="true" className="text-xl leading-none">{localeFlags[locale] ?? locale.toUpperCase()}</span>
                        <span className="uppercase tracking-[0.18em]">{locale}</span>
                    </Link>
                ))}
            </div>
        </details>
    );
}
