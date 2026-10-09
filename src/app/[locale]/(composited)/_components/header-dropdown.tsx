"use client";

import {createContext, Dispatch, KeyboardEvent, PointerEvent, ReactNode, SetStateAction, useContext, useEffect, useId, useRef, useState} from "react";
import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {isNavHrefActive, isNavSectionActive} from "@/lib/nav-active";
import type {NavPreviewId} from "@/data/public-navigation";
import HeaderNavPreview from "@/app/[locale]/(composited)/_components/header-nav-preview";

type HeaderDropdownContextValue = {
    openId: string | null;
    setOpenId: Dispatch<SetStateAction<string | null>>;
};

const HeaderDropdownContext = createContext<HeaderDropdownContextValue>({
    openId: null,
    setOpenId: () => {}
});

export function HeaderDropdownProvider({children}: {children: ReactNode}) {
    const [openId, setOpenId] = useState<string | null>(null);
    return (
        <HeaderDropdownContext.Provider value={{openId, setOpenId}}>
            {children}
        </HeaderDropdownContext.Provider>
    );
}

type HeaderDropdownItem = {
    href: string;
    label: string;
    preview?: NavPreviewId;
};

/** A 10x6 stroked caret: the old 14px filled glyph read as a form control. */
export function NavCaret({open}: {open: boolean}) {
    return (
        <svg
            viewBox="0 0 10 6"
            className={`h-[6px] w-[10px] shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "-scale-y-100" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M1 1.4 5 4.6 9 1.4" />
        </svg>
    );
}

function RowArrow() {
    return (
        <svg
            viewBox="0 0 12 10"
            className="h-[9px] w-[11px] shrink-0 text-ink-600 transition-transform duration-150 group-hover:translate-x-[2px] group-hover:text-primary-400 group-focus-visible:translate-x-[2px] group-focus-visible:text-primary-400 motion-reduce:transition-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M0.75 5h9.5M7 1.5 10.5 5 7 8.5" />
        </svg>
    );
}

export default function HeaderDropdown({
    label,
    items,
    ruleAfterHref
}: {
    label: string;
    items: HeaderDropdownItem[];
    ruleAfterHref?: string;
}) {
    const generatedId = useId();
    const {openId, setOpenId} = useContext(HeaderDropdownContext);
    const open = openId === generatedId;
    const rootRef = useRef<HTMLDivElement>(null);
    // A mouse opens the panel by hovering; touch and keyboard still use the
    // button. The short close delay lets the pointer cross small gaps without
    // the panel snapping shut, and a click right after a hover-open must not
    // toggle it closed again.
    const closeTimerRef = useRef<number>();
    const hoverOpenedRef = useRef(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const menuId = `${generatedId}-menu`;
    const pathname = usePathname();
    const sectionActive = isNavSectionActive(pathname, items.map((item) => item.href));
    // The scene the preview pane shows: whichever row the pointer or focus last
    // rested on, falling back to the current page's row, then the first.
    const [hoveredPreview, setHoveredPreview] = useState<NavPreviewId | null>(null);
    const previews = items.flatMap((item) => item.preview ? [item.preview] : []);
    const shownPreview = hoveredPreview
        ?? items.find((item) => item.preview && isNavHrefActive(pathname, item.href))?.preview
        ?? previews[0];

    useEffect(() => {
        if (!open) {
            setHoveredPreview(null);
            hoverOpenedRef.current = false;
        }
    }, [open]);

    useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

    function onRootPointerEnter(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== "mouse") return;
        window.clearTimeout(closeTimerRef.current);
        if (!open) {
            hoverOpenedRef.current = true;
            setOpenId(generatedId);
        }
    }

    function onRootPointerLeave(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== "mouse") return;
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(() => {
            // Only close if this panel is still the open one: the pointer may
            // already have opened a neighbouring dropdown.
            setOpenId((current) => (current === generatedId ? null : current));
        }, 140);
    }

    function onButtonClick() {
        if (open && hoverOpenedRef.current) {
            // The hover already opened it; treat the click as "keep it open".
            hoverOpenedRef.current = false;
            return;
        }
        setOpenId(open ? null : generatedId);
    }

    useEffect(() => {
        if (!open) return;

        const closeOnPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpenId(null);
            }
        };

        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpenId(null);
            buttonRef.current?.focus();
        };

        document.addEventListener("mousedown", closeOnPointerDown);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("mousedown", closeOnPointerDown);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open, setOpenId]);

    function panelLinks() {
        return Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
    }

    function focusPanelLink(index: number) {
        const links = panelLinks();
        if (!links.length) return;
        const wrapped = (index + links.length) % links.length;
        links[wrapped].focus();
    }

    function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        setOpenId(generatedId);
        window.requestAnimationFrame(() => focusPanelLink(event.key === "ArrowUp" ? -1 : 0));
    }

    function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const links = panelLinks();
        const current = links.indexOf(document.activeElement as HTMLAnchorElement);

        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusPanelLink(current + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusPanelLink(current - 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusPanelLink(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusPanelLink(-1);
        }
    }

    return (
        <div
            ref={rootRef}
            className="relative hidden xl:flex"
            onPointerEnter={onRootPointerEnter}
            onPointerLeave={onRootPointerLeave}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setOpenId(null);
                }
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                className="group relative inline-flex h-full items-center gap-[7px] px-3 text-[0.9375rem] leading-none tracking-[-0.005em] text-ink-200 transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-5px] focus-visible:outline-primary-300 motion-reduce:transition-none"
                aria-expanded={open}
                aria-haspopup="true"
                aria-controls={menuId}
                aria-current={sectionActive && !open ? "true" : undefined}
                onClick={onButtonClick}
                onKeyDown={onButtonKeyDown}
            >
                <span className={open || sectionActive ? "text-white" : undefined}>{label}</span>
                <NavCaret open={open} />
                {/*
                    The active marker: a 2px lime rule sitting on the header's bottom
                    edge, the exact width of the item's hit area. When the panel is
                    open it is also the seam between the nav item and the panel below,
                    which is what makes the menu read as attached rather than floating.
                */}
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary-400 transition-transform duration-150 ease-out motion-reduce:transition-none ${
                        open || sectionActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                    }`}
                />
            </button>
            <div
                id={menuId}
                ref={panelRef}
                hidden={!open}
                onKeyDown={onPanelKeyDown}
                className={`nav-panel absolute left-0 top-full z-50 -mt-px max-w-[calc(100vw-2rem)] rounded-b-[2px] border border-line-200 bg-canvas-950 shadow-[0_22px_34px_-24px_rgba(0,0,0,0.95)] ${
                    previews.length ? "w-[33.5rem] [&:not([hidden])]:flex" : "w-[18.5rem]"
                }`}
            >
                {previews.length ? <HeaderNavPreview previews={previews} shown={shownPreview} /> : null}
                <div className="min-w-0 flex-1">
                    {items.map((item) => {
                        const itemActive = isNavHrefActive(pathname, item.href);
                        return (
                            <div
                                key={`${item.href}-${item.label}`}
                                className={ruleAfterHref === item.href ? "border-b border-line-300" : undefined}
                            >
                                <Link
                                    href={item.href}
                                    aria-current={itemActive ? "page" : undefined}
                                    className={`group relative flex min-h-[2.625rem] items-center justify-between gap-5 py-2 pl-3 pr-3.5 text-[0.875rem] font-semibold leading-snug transition-colors duration-150 hover:bg-white/[0.045] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary-300 motion-reduce:transition-none ${
                                        itemActive ? "text-white" : "text-ink-200"
                                    }`}
                                    onClick={() => setOpenId(null)}
                                    onPointerEnter={() => item.preview && setHoveredPreview(item.preview)}
                                    onFocus={() => item.preview && setHoveredPreview(item.preview)}
                                >
                                    {/* Edge marker instead of a rounded pill around every row. */}
                                    <span
                                        aria-hidden="true"
                                        className={`absolute inset-y-0 left-0 w-[2px] origin-top bg-primary-400 transition-transform duration-150 ease-out motion-reduce:transition-none ${
                                            itemActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100 group-focus-visible:scale-y-100"
                                        }`}
                                    />
                                    <span className="min-w-0">{item.label}</span>
                                    <RowArrow />
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
