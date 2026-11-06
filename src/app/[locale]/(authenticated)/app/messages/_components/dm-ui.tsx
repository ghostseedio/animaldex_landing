"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import type {DirectMessageProfile, DirectMessageReceipt} from "@/lib/direct-message-presentation";

/**
 * Pieces Messages shares across the inbox, a conversation and the New
 * Message picker: iOS's round `ProfileAvatarView`, its menus and alerts, and
 * the SF Symbols those screens use, drawn as SVG.
 */

export const DM_NEON = "#A7F432";

/** "/app/…" in the reader's locale, for pushes outside a Link. */
export function localeHref(locale: string, path: string): string {
    return !locale || locale === "en" ? path : `/${locale}${path}`;
}

/** After hydration only: times and day pills are the reader's own clock, never the server's. */
export function useMounted(): boolean {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted;
}

/** The newest value without re-running effects: callbacks a parent remakes on every render. */
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

/** True while the tab is in front; polling pauses behind it, as iOS's does when the scene is inactive. */
export function usePageVisible(): boolean {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const update = () => setVisible(document.visibilityState !== "hidden");
        update();
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);
    return visible;
}

export function DmAvatar({profile, size = 50, unreadRing = false}: {profile: Pick<DirectMessageProfile, "displayName" | "avatarUrl" | "isSystem">; size?: number; unreadRing?: boolean}) {
    const ring = unreadRing ? "ring-2 ring-[#A7F432]/70" : profile.isSystem ? "ring-1 ring-[#A7F432]/45" : "ring-1 ring-white/10";
    const style = {width: size, height: size};
    if (profile.isSystem) {
        return (
            <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#071B0F] ${ring}`} style={style}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="" className="h-[64%] w-[64%] object-contain" />
            </span>
        );
    }
    if (profile.avatarUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={profile.avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${ring}`} style={style} />;
    }
    return (
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-bold text-white/45 ${ring}`} style={{...style, fontSize: Math.round(size * 0.38)}}>
            {(profile.displayName.replace(/^@/, "").trim()[0] ?? "?").toUpperCase()}
        </span>
    );
}

type SymbolName = "compose" | "ellipsis" | "pin" | "pinSlash" | "bellSlash" | "bell" | "envelopeOpen" | "envelopeBadge" | "person" | "trash" | "hand" | "report" | "back" | "chevronDown" | "search" | "close" | "copy" | "unsend" | "card" | "nosign" | "eyeSlash" | "hourglass" | "bubbles" | "send";

const SYMBOLS: Record<SymbolName, ReactNode> = {
    compose: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
    pin: <><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z" /><path d="M12 14v7" /></>,
    pinSlash: <><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z" /><path d="M12 14v7M3 3l18 18" /></>,
    bellSlash: <><path d="M18 8a6 6 0 0 0-9.3-5M6 8c0 7-3 7-3 9h14" /><path d="M10 21h4M3 3l18 18" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    envelopeOpen: <><path d="M3 10 12 4l9 6v10H3Z" /><path d="m3 10 9 6 9-6" /></>,
    envelopeBadge: <><rect x="3" y="6" width="15" height="13" rx="2" /><path d="m3 8 7.5 5L18 8" /><circle cx="19" cy="6" r="3" fill="currentColor" /></>,
    person: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
    hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.7 14a1.5 1.5 0 0 1 2.5-1.6L8 15" /></>,
    report: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M12 8v3.5M12 14h.01" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    unsend: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
    card: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6" /></>,
    nosign: <><circle cx="12" cy="12" r="8" /><path d="m6.5 6.5 11 11" /></>,
    eyeSlash: <><path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.6 0-3-.5-4.2-1.2" /><path d="M3 3l18 18" /></>,
    hourglass: <><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" /></>,
    bubbles: <><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 1-2Z" /><path d="M10 9.5v1.5M10 13h.01" /><path d="M19 9h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3-3h-3" /></>,
    send: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>
};

export function DmSymbol({name, className = "h-4 w-4", strokeWidth = 1.9}: {name: SymbolName; className?: string; strokeWidth?: number}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            {SYMBOLS[name]}
        </svg>
    );
}

/** iOS `DirectMessageReceiptMark`: one tick sent, two delivered, two in neon seen. */
export function DmReceiptMark({receipt, label}: {receipt: DirectMessageReceipt; label: string}) {
    return (
        <svg viewBox="0 0 20 12" className={`h-[10px] w-[16px] shrink-0 ${receipt === "read" ? "text-[#A7F432]" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
            {receipt === "sent"
                ? <path d="m4 6.5 3 3 6-7" />
                : <><path d="m1.5 6.5 3 3 6-7" /><path d="m8 9.5 6.5-7.5" /><path d="m6.6 8.1 1.4 1.4" /></>}
        </svg>
    );
}

export type DmMenuItem =
    | {kind: "action"; label: string; icon?: SymbolName; destructive?: boolean; onSelect: () => void}
    | {kind: "submenu"; label: string; icon?: SymbolName; items: Array<{label: string; onSelect: () => void}>}
    | {kind: "divider"};

/**
 * A context menu, as iOS's: opened from a button or a right-click, closed by
 * a choice, Escape or a click outside. A submenu opens in place.
 */
export function DmMenu({items, anchor, onClose, label}: {
    items: DmMenuItem[];
    anchor: {x: number; y: number};
    onClose: () => void;
    label: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const close = useLatest(onClose);
    const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
    const [position, setPosition] = useState<{left: number; top: number}>({left: anchor.x, top: anchor.y});

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const left = Math.max(8, Math.min(anchor.x, window.innerWidth - rect.width - 8));
        const top = anchor.y + rect.height > window.innerHeight - 8 ? Math.max(8, anchor.y - rect.height) : anchor.y;
        setPosition({left, top});
        element.querySelector<HTMLButtonElement>("button[role=menuitem]")?.focus();
    }, [anchor.x, anchor.y, openSubmenu]);

    useEffect(() => {
        const dismiss = () => close.current();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") dismiss();
        };
        const onPointer = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) dismiss();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer, true);
        window.addEventListener("resize", dismiss);
        window.addEventListener("scroll", dismiss, true);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer, true);
            window.removeEventListener("resize", dismiss);
            window.removeEventListener("scroll", dismiss, true);
        };
    }, [close]);

    const itemClass = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none";

    return (
        <div
            ref={ref}
            role="menu"
            aria-label={label}
            className="fixed z-[70] min-w-[220px] max-w-[280px] overflow-hidden rounded-panel border border-white/10 bg-[#1c1c1e]/95 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{left: position.left, top: position.top}}
        >
            {items.map((item, index) => {
                if (item.kind === "divider") return <div key={`d${index}`} className="my-1 h-px bg-white/10" />;
                if (item.kind === "submenu") {
                    const open = openSubmenu === item.label;
                    return (
                        <div key={item.label}>
                            <button type="button" role="menuitem" aria-expanded={open} className={`${itemClass} text-white`} onClick={() => setOpenSubmenu(open ? null : item.label)}>
                                <span className="flex-1">{item.label}</span>
                                {item.icon ? <DmSymbol name={item.icon} className="h-[18px] w-[18px] text-white/70" /> : null}
                            </button>
                            {open ? item.items.map((child) => (
                                <button key={child.label} type="button" role="menuitem" className={`${itemClass} pl-8 text-white/85`} onClick={() => { onClose(); child.onSelect(); }}>
                                    {child.label}
                                </button>
                            )) : null}
                        </div>
                    );
                }
                return (
                    <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className={`${itemClass} ${item.destructive ? "text-[#FF6B6B]" : "text-white"}`}
                        onClick={() => { onClose(); item.onSelect(); }}
                    >
                        <span className="flex-1">{item.label}</span>
                        {item.icon ? <DmSymbol name={item.icon} className={`h-[18px] w-[18px] ${item.destructive ? "text-[#FF6B6B]" : "text-white/70"}`} /> : null}
                    </button>
                );
            })}
        </div>
    );
}

/** An alert, as iOS's: a title, a line, and its buttons; Escape cancels. */
export function DmAlert({title, message, actions, onCancel}: {
    title: string;
    message: string;
    actions: Array<{label: string; role?: "destructive" | "cancel"; onSelect: () => void}>;
    onCancel: () => void;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const cancel = useLatest(onCancel);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") cancel.current();
        };
        document.addEventListener("keydown", onKey);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
        return () => document.removeEventListener("keydown", onKey);
    }, [cancel]);
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6" role="presentation" onClick={onCancel}>
            <div
                ref={ref}
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-[300px] overflow-hidden rounded-card bg-[#1f1f21] text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="px-5 pb-4 pt-5">
                    <h2 className="text-[17px] font-semibold text-white">{title}</h2>
                    {message ? <p className="mt-1.5 text-[13px] leading-5 text-white/70">{message}</p> : null}
                </div>
                <div className={`grid border-t border-white/10 ${actions.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {actions.map((action, index) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={action.onSelect}
                            className={`min-h-11 px-3 py-2.5 text-[17px] transition hover:bg-white/[0.05] focus-visible:bg-white/[0.08] focus-visible:outline-none ${index > 0 ? (actions.length === 2 ? "border-l border-white/10" : "border-t border-white/10") : ""} ${action.role === "destructive" ? "font-semibold text-[#FF6B6B]" : action.role === "cancel" ? "text-[#A7F432]" : "font-semibold text-[#A7F432]"}`}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
