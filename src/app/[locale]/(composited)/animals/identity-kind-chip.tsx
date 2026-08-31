"use client";

import {useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {
    identityKindShortLabel,
    identityKindTone,
    resolveIdentityKindExplanation,
    type IdentityKindTone
} from "@/lib/identity-kind";

/** Matches iOS IdentityKindChip palette groups. */
const TONE_STYLES: Record<IdentityKindTone, {color: string; background: string; border: string}> = {
    species: {
        color: "rgba(167, 244, 50, 1)",
        background: "rgba(167, 244, 50, 0.12)",
        border: "rgba(167, 244, 50, 0.34)"
    },
    group: {
        color: "rgba(110, 224, 184, 1)",
        background: "rgba(110, 224, 184, 0.12)",
        border: "rgba(110, 224, 184, 0.34)"
    },
    breed: {
        color: "rgba(115, 219, 255, 1)",
        background: "rgba(115, 219, 255, 0.12)",
        border: "rgba(115, 219, 255, 0.34)"
    },
    fallback: {
        color: "rgba(250, 184, 61, 1)",
        background: "rgba(250, 184, 61, 0.14)",
        border: "rgba(250, 184, 61, 0.36)"
    },
    neutral: {
        color: "rgba(255, 255, 255, 0.55)",
        background: "rgba(255, 255, 255, 0.08)",
        border: "rgba(255, 255, 255, 0.14)"
    }
};

type IdentityKindChipProps = {
    identityKind?: string | null;
    label?: string | null;
    animalName?: string | null;
    explanation?: string | null;
    retakeGuidance?: string | null;
    compact?: boolean;
    showsInfoIcon?: boolean;
    className?: string;
};

function InfoCircleIcon({className = "h-3 w-3"}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5" strokeLinecap="round" />
            <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}

function IdentityKindInfoTooltip({
    id,
    title,
    body,
    retakeGuidance,
    style
}: {
    id: string;
    title: string;
    body: string;
    retakeGuidance?: string;
    style: CSSProperties;
}) {
    return (
        <div
            id={id}
            role="tooltip"
            className="pointer-events-none z-[120] w-[min(18.5rem,calc(100vw-1.5rem))] rounded-2xl border border-white/12 bg-[#141814]/96 p-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
            style={style}
        >
            <p className="text-[0.7rem] font-black uppercase tracking-[0.14em] text-white/45">Identity level</p>
            <p className="mt-1.5 text-sm font-bold text-white">{title}</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-white/70">{body}</p>
            {retakeGuidance ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/55">Capture guidance</p>
                    <p className="mt-1.5 text-xs leading-5 text-white/65">{retakeGuidance}</p>
                </div>
            ) : null}
        </div>
    );
}

function stopNestedActivation(event: MouseEvent | KeyboardEvent | PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
}

export default function IdentityKindChip({
    identityKind,
    label,
    animalName,
    explanation,
    retakeGuidance,
    compact = false,
    showsInfoIcon = true,
    className = ""
}: IdentityKindChipProps) {
    const resolvedLabel = label ?? identityKindShortLabel(identityKind);
    const info = resolveIdentityKindExplanation({
        identityKind,
        animalName,
        explanation,
        retakeGuidance,
        label: resolvedLabel
    });
    const tooltipId = useId();
    const triggerRef = useRef<HTMLSpanElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!open || !triggerRef.current) return;

        function updatePosition() {
            const trigger = triggerRef.current;
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            const gap = 8;
            const width = Math.min(296, window.innerWidth - 24);
            const left = Math.min(
                Math.max(12, rect.left + rect.width / 2 - width / 2),
                window.innerWidth - width - 12
            );
            const estimatedHeight = 180;
            const preferAbove = rect.top > estimatedHeight + gap + 12;

            setTooltipStyle({
                position: "fixed",
                left,
                width,
                top: preferAbove ? undefined : rect.bottom + gap,
                bottom: preferAbove ? window.innerHeight - rect.top + gap : undefined
            });
        }

        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open]);

    if (!resolvedLabel) return null;

    const tone = identityKindTone(identityKind);
    const style = TONE_STYLES[tone];
    const canShowTooltip = Boolean(showsInfoIcon && info);

    function openTooltip() {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setOpen(true);
    }

    function scheduleCloseTooltip() {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => setOpen(false), 80);
    }

    let tooltipNode: ReactNode = null;
    if (mounted && open && info && canShowTooltip) {
        tooltipNode = createPortal(
            <IdentityKindInfoTooltip
                id={tooltipId}
                title={info.title}
                body={info.body}
                retakeGuidance={info.retakeGuidance}
                style={tooltipStyle}
            />,
            document.body
        );
    }

    return (
        <span
            className={[
                "relative z-10 inline-flex max-w-full items-center gap-1 rounded-full border font-bold",
                compact
                    ? "h-[22px] gap-1 px-2 text-[0.62rem] tracking-[0.02em]"
                    : "gap-1.5 px-3 py-1.5 text-sm",
                className
            ].join(" ")}
            style={{
                color: style.color,
                backgroundColor: style.background,
                borderColor: style.border
            }}
        >
            <span className="truncate">{resolvedLabel}</span>
            {canShowTooltip && info ? (
                <span
                    ref={triggerRef}
                    role="button"
                    tabIndex={0}
                    className={[
                        "pointer-events-auto relative z-20 -mr-0.5 inline-flex shrink-0 cursor-help items-center justify-center rounded-full outline-none",
                        "hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current/40",
                        compact ? "h-4 min-w-4 p-0.5" : "h-5 min-w-5 p-0.5"
                    ].join(" ")}
                    aria-label={`${info.title} identity level details`}
                    aria-describedby={open ? tooltipId : undefined}
                    aria-expanded={open}
                    onClick={(event) => {
                        stopNestedActivation(event);
                        setOpen((current) => !current);
                    }}
                    onMouseDown={stopNestedActivation}
                    onPointerDown={stopNestedActivation}
                    onMouseEnter={openTooltip}
                    onMouseLeave={scheduleCloseTooltip}
                    onFocus={openTooltip}
                    onBlur={scheduleCloseTooltip}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            stopNestedActivation(event);
                            setOpen(false);
                            return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                            stopNestedActivation(event);
                            setOpen((current) => !current);
                        }
                    }}
                >
                    <InfoCircleIcon className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
                </span>
            ) : null}
            {tooltipNode}
        </span>
    );
}
