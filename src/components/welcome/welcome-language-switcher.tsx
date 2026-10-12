"use client";

import {type KeyboardEvent, type MouseEvent, useEffect, useId, useRef, useState, useTransition} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {localeConfig} from "@/i18n";
import {
    WELCOME_LANGUAGE_COOKIE,
    WELCOME_LANGUAGE_NATIVE_NAMES,
    formatWelcomeLanguageCookie,
    parseWelcomeLanguageCookie,
    welcomeLanguageShortCode,
    welcomeLanguageTag
} from "@/lib/welcome-intro";

/** Dev-only query parameters the intro reads; a real language choice drops them. */
const DEV_PARAMS = ["welcomeLang"];

function pathWithoutLocale(pathname: string) {
    for (const locale of localeConfig.locales) {
        if (pathname === `/${locale}`) return "/";
        if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1) || "/";
    }
    return pathname;
}

function readChoiceCookie() {
    try {
        const entry = document.cookie.split("; ").find((part) => part.startsWith(`${WELCOME_LANGUAGE_COOKIE}=`));
        return entry ? entry.slice(WELCOME_LANGUAGE_COOKIE.length + 1) : null;
    } catch {
        return null;
    }
}

function writeChoiceCookie(value: string | null) {
    try {
        document.cookie = value
            ? `${WELCOME_LANGUAGE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
            : `${WELCOME_LANGUAGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
        // Cookies blocked: the choice holds for this page view only.
    }
}

/**
 * The sign-in intro's language control, left of its sound button: a globe and
 * the language's short code. It lists every language the intro is written in
 * (the app's 45), by native name.
 *
 * - A language the site is published in (en, id) changes the site's locale the
 *   same way the header's `LocaleToggle` does: the locale-aware `Link` to the
 *   same path under the other prefix, keeping the query so `?next=` survives.
 * - Any other language changes only the intro (text and voice). The choice is
 *   remembered in a cookie the server reads, so the page renders in it with no
 *   flash; the address and site locale don't change. The cookie records the
 *   locale it was made on, and the next real site-locale choice takes over.
 *
 * Either way the intro remounts at card 1 in the new language.
 */
export default function WelcomeLanguageSwitcher({
    currentLocale,
    displayLanguage,
    languages,
    label
}: {
    /** The site's locale. */
    currentLocale: string;
    /** The intro's language. */
    displayLanguage: string;
    /** The codes to list, in order. */
    languages: string[];
    /** "Language", in the intro's language. */
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();

    const query = new URLSearchParams(searchParams?.toString() ?? "");
    const hasDevParams = DEV_PARAMS.some((name) => query.has(name));
    DEV_PARAMS.forEach((name) => query.delete(name));
    const search = query.toString();
    const href = `${pathWithoutLocale(pathname || "/")}${search ? `?${search}` : ""}`;
    const currentName = WELCOME_LANGUAGE_NATIVE_NAMES[displayLanguage] ?? displayLanguage.toUpperCase();

    // A choice made on another site locale no longer holds: the site locale was chosen since.
    useEffect(() => {
        const remembered = parseWelcomeLanguageCookie(readChoiceCookie());
        if (remembered && remembered.locale !== currentLocale) writeChoiceCookie(null);
    }, [currentLocale]);

    useEffect(() => {
        if (!open) return;
        const close = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        // Focus the current language, so arrows and Enter work straight away.
        listRef.current?.querySelector<HTMLElement>("[aria-current='true']")?.focus();
        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    /** Re-renders this page on the server in the remembered language. */
    const reload = () => {
        startTransition(() => {
            if (hasDevParams) {
                router.replace(currentLocale === localeConfig.defaultLocale ? href : `/${currentLocale}${href === "/" ? "" : href}`);
            } else {
                router.refresh();
            }
        });
    };

    const chooseSiteLocale = (event: MouseEvent<HTMLAnchorElement>, locale: string) => {
        setOpen(false);
        writeChoiceCookie(formatWelcomeLanguageCookie(locale, locale));
        if (locale === currentLocale) {
            event.preventDefault();
            if (locale !== displayLanguage) reload();
        }
    };

    const chooseIntroLanguage = (code: string) => {
        setOpen(false);
        buttonRef.current?.focus();
        if (code === displayLanguage) return;
        writeChoiceCookie(formatWelcomeLanguageCookie(code, currentLocale));
        reload();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            buttonRef.current?.focus();
            return;
        }
        if (!open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("a, button") ?? []);
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const last = items.length - 1;
        const step = event.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
        const next = event.key === "Home" ? 0 : event.key === "End" ? last : step;
        event.preventDefault();
        items[next]?.focus();
    };

    const itemClass = (selected: boolean) =>
        "relative flex min-h-11 w-full items-center justify-between gap-4 py-2 pl-4 pr-4 text-left text-sm outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.08] focus-visible:text-white " +
        (selected ? "text-white" : "text-white/70");

    const itemBody = (code: string, selected: boolean) => (
        <>
            {selected ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-primary-400" /> : null}
            <span dir="auto" className="whitespace-nowrap font-semibold">{WELCOME_LANGUAGE_NATIVE_NAMES[code] ?? code.toUpperCase()}</span>
            <span aria-hidden="true" className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-white/40">{welcomeLanguageShortCode(code)}</span>
        </>
    );

    return (
        <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={listId}
                aria-busy={pending || undefined}
                aria-label={`${label}: ${currentName}`}
                title={label}
                className={"flex h-10 items-center gap-1.5 rounded-full border border-white/[0.14] bg-black/35 pl-3 pr-3.5 text-white/85 transition hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 " +
                    (pending ? "opacity-60" : "")}
            >
                <GlobeIcon />
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em]">{welcomeLanguageShortCode(displayLanguage)}</span>
            </button>
            <ul
                ref={listRef}
                id={listId}
                hidden={!open}
                aria-label={label}
                className="absolute right-0 top-full z-20 mt-2 max-h-[min(60vh,27rem)] min-w-[14rem] overflow-y-auto overscroll-contain rounded-[2px] border border-white/[0.14] bg-[#0b100d] py-1 shadow-[0_18px_28px_-12px_rgba(0,0,0,0.95)]"
            >
                {languages.map((code) => {
                    const selected = code === displayLanguage;
                    const tag = welcomeLanguageTag(code);
                    return (
                        <li key={code}>
                            {localeConfig.locales.includes(code) ? (
                                <Link
                                    href={href}
                                    locale={code}
                                    lang={tag}
                                    hrefLang={tag}
                                    aria-current={selected ? "true" : undefined}
                                    onClick={(event) => chooseSiteLocale(event, code)}
                                    className={itemClass(selected)}
                                >
                                    {itemBody(code, selected)}
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    lang={tag}
                                    aria-current={selected ? "true" : undefined}
                                    onClick={() => chooseIntroLanguage(code)}
                                    className={itemClass(selected)}
                                >
                                    {itemBody(code, selected)}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function GlobeIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z" strokeLinejoin="round" />
        </svg>
    );
}
