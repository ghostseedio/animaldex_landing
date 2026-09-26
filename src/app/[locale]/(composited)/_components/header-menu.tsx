"use client";

import {createContext, KeyboardEvent, ReactNode, useContext, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import CloseIcon from "@/app/[locale]/(composited)/_assets/ic_close.svg";
import OpenIcon from "@/app/[locale]/(composited)/_assets/ic_menu.svg";
import {
    FacebookIcon,
    InstagramIcon,
    RedditIcon,
    SubstackIcon,
    TikTokIcon,
    XIcon,
    YouTubeIcon
} from "@/app/[locale]/_components/icons";
import {socialProfileUrls} from "@/lib/social-links";

export const MenuContext = createContext({
    open: false,
    setOpen: (_: boolean) => {}
});

type HeaderMenuProps = {
    logoHref?: string;
    logoLabel: string;
    brandTitle: string;
    children: ReactNode;
    actions: ReactNode;
    mobileLocale: ReactNode;
    mobileLinks: ReactNode;
    mobileAuth: ReactNode;
    ctaHref: string;
    ctaLabel: string;
    navigationLabel: string;
    followLabel: string;
};

export default function HeaderMenu({
    logoHref = "/",
    logoLabel,
    brandTitle,
    children,
    actions,
    mobileLocale,
    mobileLinks,
    mobileAuth,
    ctaHref,
    ctaLabel,
    navigationLabel,
    followLabel
}: HeaderMenuProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const openButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const socialLinks = [
        {href: socialProfileUrls.instagram, label: "Instagram", icon: InstagramIcon},
        {href: socialProfileUrls.tiktok, label: "TikTok", icon: TikTokIcon},
        {href: socialProfileUrls.youtube, label: "YouTube", icon: YouTubeIcon},
        {href: socialProfileUrls.facebook, label: "Facebook", icon: FacebookIcon},
        {href: socialProfileUrls.x, label: "X", icon: XIcon},
        {href: socialProfileUrls.substack, label: "Substack", icon: SubstackIcon},
        {href: socialProfileUrls.reddit, label: "Reddit", icon: RedditIcon}
    ];

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = open ? "hidden" : "";
        closeButtonRef.current?.focus();

        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    function closeMenu() {
        setOpen(false);
        window.setTimeout(() => openButtonRef.current?.focus(), 0);
    }

    function trapFocus(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "Tab") return;

        const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        ).filter((element) => element.offsetParent !== null);

        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <MenuContext.Provider value={{open, setOpen}}>
            <div className="flex shrink-0 items-center gap-2 xl:hidden">
                {mobileLocale}
                <button
                    ref={openButtonRef}
                    type="button"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[2px] border border-line-200 bg-white/[0.02] transition-colors duration-150 hover:border-primary-400 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                    onClick={() => setOpen(true)}
                    aria-label="Open menu"
                    aria-expanded={open}
                    aria-controls="mobile-navigation-drawer"
                >
                    <Image src={OpenIcon} alt="" width={24} height={24} />
                </button>
            </div>

            {/* Desktop nav: stretched to the full header height so each item's active
                marker lands on the header's bottom rule. */}
            <nav
                aria-label="Primary navigation"
                className="hidden min-w-0 flex-1 items-stretch justify-start xl:flex"
            >
                {children}
            </nav>

            <div className="hidden shrink-0 items-center gap-2 xl:flex">
                {actions}
            </div>

            {/* Mobile drawer */}
            {mounted ? createPortal(<div
                className={`fixed inset-0 z-[100] xl:hidden ${open ? "pointer-events-auto visible" : "pointer-events-none invisible"}`}
                aria-hidden={!open}
            >
                <button
                    type="button"
                    tabIndex={open ? 0 : -1}
                    className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
                    aria-label="Close menu"
                    onClick={closeMenu}
                />
                <nav
                    ref={drawerRef}
                    id="mobile-navigation-drawer"
                    aria-label="Mobile navigation"
                    aria-modal="true"
                    role="dialog"
                    onKeyDown={trapFocus}
                    className={`absolute inset-y-0 right-0 flex w-[calc(100%-0.75rem)] max-w-[25rem] flex-col overflow-hidden border-l border-line-200 bg-canvas-950 shadow-[-28px_0_60px_-24px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
                >
                    <div className="flex min-h-16 items-center justify-between border-b border-line-200 px-4 py-3">
                        <Link
                            href={logoHref}
                            className="flex min-w-0 items-center gap-3"
                            aria-label={logoLabel}
                            onClick={closeMenu}
                        >
                            <img
                                src="/images/logo.webp"
                                alt=""
                                aria-hidden="true"
                                width={40}
                                height={40}
                                className="h-9 w-9"
                            />
                            <Image
                                src="/images/animaldex-logo-text.webp"
                                alt={brandTitle}
                                width={320}
                                height={76}
                                className="h-[1.625rem] w-auto max-w-[7.25rem]"
                            />
                        </Link>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[2px] border border-line-200 bg-white/[0.02] transition-colors duration-150 hover:border-primary-400 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                            onClick={closeMenu}
                            aria-label="Close menu"
                        >
                            <Image src={CloseIcon} alt="" width={26} height={26} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                        <div className="px-4 pb-6 pt-1">
                            <p className="sr-only">{navigationLabel}</p>
                            <div key={open ? "mobile-nav-open" : "mobile-nav-closed"}>
                                {mobileLinks}
                            </div>
                        </div>

                        <div className="border-t border-line-200 px-4 py-5">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-ink-500">
                                {followLabel}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {socialLinks.map((link) => (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={link.label}
                                        title={link.label}
                                        className="grid h-11 w-11 place-items-center rounded-[2px] border border-line-200 bg-white/[0.02] text-ink-300 transition-colors duration-150 hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                                    >
                                        <link.icon size={19} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 space-y-2 border-t border-line-200 bg-canvas-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                        <Link
                            href={ctaHref}
                            onClick={closeMenu}
                            className="flex min-h-12 w-full items-center justify-center rounded-[2px] bg-primary-400 px-4 text-center text-sm font-black uppercase leading-tight tracking-[0.04em] text-canvas-950 transition-colors duration-150 hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                        >
                            {ctaLabel}
                        </Link>
                        {mobileAuth}
                    </div>
                </nav>
            </div>, document.body) : null}
        </MenuContext.Provider>
    );
}

export function useHeaderMenu() {
    return useContext(MenuContext);
}
