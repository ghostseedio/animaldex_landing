"use client";

import NextLink from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {PrefetchKind} from "next/dist/client/components/router-reducer/router-reducer-types";
import React, {
    ComponentProps,
    FocusEvent,
    MouseEvent,
    PointerEvent,
    ReactNode,
    TouchEvent,
    useRef
} from "react";
import {localeConfig} from "@/i18n";
import {isCollapsedEnglishDetailPath} from "@/lib/english-detail-routes";

const navigationStartEvent = "animaldex:navigation-start";
const navigationCancelEvent = "animaldex:navigation-cancel";

export type LinkProps = {
    underline?: boolean;
    href: string;
    children: ReactNode;
    className?: string;
    locale?: string;
} & Omit<ComponentProps<typeof NextLink>, "href" | "locale">

type NavigationIntentEvent = {
    defaultPrevented: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button?: number;
};

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

function isDynamicPublicSeoDetailHref(href: string) {
    const path = stripLocalePrefix(href).split("?")[0]?.split("#")[0] ?? href;
    return /^\/p\/[a-z0-9-]+\/?$/i.test(path);
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

function opensInSameTab(target?: string) {
    return !target || target === "_self";
}

/**
 * A primary-button, unmodified activation of a same-tab link: the only kind
 * of event that leads to a client-side navigation.
 */
function isPlainActivation(event: NavigationIntentEvent, target?: string) {
    return !event.defaultPrevented &&
        opensInSameTab(target) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        (event.button === undefined || event.button === 0);
}

function isCurrentLocation(href: string) {
    const nextUrl = new URL(href, window.location.href);

    return nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search;
}

function shouldStartNavigationFeedback(
    event: NavigationIntentEvent,
    href: string,
    target?: string
) {
    if (
        !isPlainActivation(event, target) ||
        !isInternalPath(href) ||
        isHashOnlyPath(href)
    ) {
        return false;
    }

    if (typeof window === "undefined") {
        return false;
    }

    return !isCurrentLocation(href);
}

function shouldPrefetchOnIntent(href: string, target?: string) {
    if (!opensInSameTab(target) || !isInternalPath(href) || isHashOnlyPath(href)) {
        return false;
    }

    if (typeof window === "undefined") {
        return false;
    }

    return !isCurrentLocation(href);
}

function startNavigationFeedback() {
    window.dispatchEvent(new Event(navigationStartEvent));
}

function cancelNavigationFeedback() {
    window.dispatchEvent(new Event(navigationCancelEvent));
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
        onMouseEnter,
        onTouchStart,
        onPointerDown,
        onPointerCancel,
        onFocus,
        replace,
        scroll,
        target,
        ...props
    }: LinkProps
) {
    const pathname = usePathname();
    const router = useRouter();
    const currentLocale = getLocaleFromPathname(pathname);
    const targetLocale = locale || currentLocale;
    const localizedHref = localizeHref(href, targetLocale);
    const feedbackStartedByPointerRef = useRef(false);

    // Next 13.5 <Link> without an explicit `prefetch` downloads the full RSC
    // payload of every in-viewport link. The site-wide default is therefore
    // `false`, and this wrapper prefetches on intent (hover, focus, touch,
    // pointer down) instead. Callers that pass `prefetch` keep Next's own
    // behaviour; /p/ detail links stay un-prefetched (request amplification).
    const usesDefaultPrefetchPolicy = prefetch === undefined;
    const prefetchesOnIntent = usesDefaultPrefetchPolicy && !isDynamicPublicSeoDetailHref(localizedHref);
    // With prefetch={false} Next 13.5 forces an "optimistic" navigation on
    // click, which bypasses the prefetch cache and refetches. Navigating
    // through the router directly keeps the intent prefetch useful.
    const navigatesThroughRouter = prefetchesOnIntent && (isInternalPath(localizedHref) || isHashOnlyPath(localizedHref));

    function prefetchOnIntent() {
        if (!prefetchesOnIntent || !shouldPrefetchOnIntent(localizedHref, target)) {
            return;
        }

        router.prefetch(localizedHref, {kind: PrefetchKind.AUTO});
    }

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        onClick?.(event);

        feedbackStartedByPointerRef.current = false;

        if (shouldStartNavigationFeedback(event, localizedHref, target)) {
            startNavigationFeedback();
        }

        if (!navigatesThroughRouter || !isPlainActivation(event, target)) {
            return;
        }

        event.preventDefault();
        router[replace ? "replace" : "push"](localizedHref, {scroll: scroll ?? true});
    }

    function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
        onMouseEnter?.(event);
        prefetchOnIntent();
    }

    function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
        onFocus?.(event);
        prefetchOnIntent();
    }

    function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
        onTouchStart?.(event);
        prefetchOnIntent();
    }

    function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
        onPointerDown?.(event);

        if (event.pointerType === "touch" || event.pointerType === "mouse") {
            prefetchOnIntent();
        }

        if (shouldStartNavigationFeedback(event, localizedHref, target)) {
            feedbackStartedByPointerRef.current = true;
            startNavigationFeedback();
        }
    }

    function handlePointerCancel(event: PointerEvent<HTMLAnchorElement>) {
        onPointerCancel?.(event);

        // A touch that turned into a scroll never clicks; take the bar down.
        if (feedbackStartedByPointerRef.current) {
            feedbackStartedByPointerRef.current = false;
            cancelNavigationFeedback();
        }
    }

    return (
        <NextLink
            href={localizedHref}
            prefetch={prefetch ?? false}
            replace={replace}
            scroll={scroll}
            target={target}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onFocus={handleFocus}
            onTouchStart={handleTouchStart}
            onPointerDown={handlePointerDown}
            onPointerCancel={handlePointerCancel}
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
