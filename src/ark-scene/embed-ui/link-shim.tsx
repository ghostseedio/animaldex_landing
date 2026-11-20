/**
 * The site's `Link` for the apps' Ark panel (`public/ark/embed.html`, lane ARK-SIMPLE): a plain anchor. The panel has
 * no Next router; a host (the iOS / Android app) takes the links it handles itself (Talk, a profile) through
 * `arkEmbedLinkHandler`, and any other link in the panel is left alone when there is no host (a browser).
 */
import React, {forwardRef} from "react";

type Handler = (href: string, event: React.MouseEvent<HTMLAnchorElement>) => boolean;
let handler: Handler | null = null;

/** The embed's link handler: true when the host took the link (the page stays). */
export function setArkEmbedLinkHandler(next: Handler | null): void {
    handler = next;
}

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {href: string; underline?: boolean; locale?: string; prefetch?: unknown; scroll?: unknown; replace?: unknown; shallow?: unknown; passHref?: unknown; legacyBehavior?: unknown};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({href, underline: _underline, locale: _locale, prefetch: _prefetch, scroll: _scroll, replace: _replace, shallow: _shallow, passHref: _passHref, legacyBehavior: _legacy, onClick, ...rest}, ref) {
    return (
        <a
            ref={ref}
            href={href}
            {...rest}
            onClick={(event) => {
                onClick?.(event);
                if (event.defaultPrevented || !handler) return;
                if (handler(href, event)) event.preventDefault();
            }}
        />
    );
});

export default Link;
