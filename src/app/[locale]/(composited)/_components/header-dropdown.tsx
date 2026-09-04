"use client";

import {createContext, KeyboardEvent, ReactNode, useContext, useEffect, useId, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";

type HeaderDropdownContextValue = {
    openId: string | null;
    setOpenId: (id: string | null) => void;
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
};

export default function HeaderDropdown({label, items}: {label: string; items: HeaderDropdownItem[]}) {
    const generatedId = useId();
    const {openId, setOpenId} = useContext(HeaderDropdownContext);
    const open = openId === generatedId;
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuId = `${generatedId}-menu`;

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

    function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        setOpenId(generatedId);
        window.requestAnimationFrame(() => {
            rootRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
        });
    }

    return (
        <div
            ref={rootRef}
            className="relative hidden xl:block"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setOpenId(null);
                }
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-ink-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
                aria-expanded={open}
                aria-haspopup="true"
                aria-controls={menuId}
                onClick={() => setOpenId(open ? null : generatedId)}
                onKeyDown={onButtonKeyDown}
            >
                {label}
                <svg
                    viewBox="0 0 16 16"
                    className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z" />
                </svg>
            </button>
            <div
                id={menuId}
                hidden={!open}
                className="absolute left-0 top-full z-50 mt-1 min-w-[17rem] rounded-xl border border-line-300 bg-canvas-900 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
            >
                {items.map((item) => (
                    <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-100 transition-colors hover:bg-white/[0.055] hover:text-primary-100 focus-visible:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300"
                        onClick={() => setOpenId(null)}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}
