"use client";

import NextLink from "next/link";
import {usePathname} from "next/navigation";
import React, {ComponentProps, MouseEvent, ReactNode} from "react";
import {localeConfig} from "@/i18n";
import {isCollapsedEnglishDetailPath} from "@/lib/english-detail-routes";

const navigationStartEvent = "animaldex:navigation-start";

export type LinkProps = {
    underline?: boolean;
    href: string;
    children: ReactNode;
    className?: string;
    locale?: string;
} & Omit<ComponentProps<typeof NextLink>, "href" | "locale">

function isInternalPath(href: string) {
    return href.startsWith("/") && !href.startsWith("//");
}

function isHashOnlyPath(href: string) {
    return href.startsWith("#");
}

function stripLocalePrefix(href: string) {
    for (const locale of localeConfig.locales) {
        if (href === `/${locale}`) {
            return "/";
        }

        if (href.startsWith(`/${locale}/`)) {
            return href.slice(locale.length + 1);
        }

        if (href.startsWith(`/${locale}?`) || href.startsWith(`/${locale}#`)) {
            return `/${href.slice(locale.length + 2)}`;
        }
    }

    return href;
}

function localizeHref(href: string, locale: string) {
    if (!isInternalPath(href) || isHashOnlyPath(href)) {
        return href;
    }

    const unprefixedHref = stripLocalePrefix(href);

    if (locale === localeConfig.defaultLocale || isCollapsedEnglishDetailPath(unprefixedHref)) {
        return unprefixedHref;
    }

    if (unprefixedHref === "/") {
        return `/${locale}`;
    }

    if (unprefixedHref.startsWith("/?") || unprefixedHref.startsWith("/#")) {
        return `/${locale}${unprefixedHref.slice(1)}`;
    }

    return `/${locale}${unprefixedHref}`;
}

function getLocaleFromPathname(pathname: string | null) {
    if (!pathname) {
        return localeConfig.defaultLocale;
    }

    const firstSegment = pathname.split("/")[1];

    return localeConfig.locales.includes(firstSegment)
        ? firstSegment
        : localeConfig.defaultLocale;
}

function shouldStartNavigationFeedback(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    target?: string
) {
    if (
        event.defaultPrevented ||
        target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !isInternalPath(href) ||
        isHashOnlyPath(href)
    ) {
        return false;
    }

    if (typeof window === "undefined") {
        return false;
    }

    const nextUrl = new URL(href, window.location.href);

    return nextUrl.pathname !== window.location.pathname ||
        nextUrl.search !== window.location.search;
}

function startNavigationFeedback() {
    window.dispatchEvent(new Event(navigationStartEvent));
}

export default function Link(
    {
        underline,
        href,
        children,
        className,
        locale,
        prefetch,
        onClick,
        target,
        ...props
    }: LinkProps
) {
    const pathname = usePathname();
    const currentLocale = getLocaleFromPathname(pathname);
    const targetLocale = locale || currentLocale;
    const localizedHref = localizeHref(href, targetLocale);

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        onClick?.(event);

        if (shouldStartNavigationFeedback(event, localizedHref, target)) {
            startNavigationFeedback();
        }
    }

    return (
        <NextLink
            href={localizedHref}
            prefetch={prefetch}
            target={target}
            onClick={handleClick}
            className={(underline ? (className || "") + " group" : className)}
            {...props}
        >
            {children}
            {underline &&
                <span className="block w-full scale-x-0 group-hover:scale-x-100 h-1 mt-1 rounded-full bg-primary-200 transition-transform duration-300 ease-in-out" />
            }
        </NextLink>
    )
}
