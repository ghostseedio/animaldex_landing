import type {ComponentType} from "react";
import {
    CameraIcon,
    HandshakeIcon,
    LifeBuoyIcon,
    MegaphoneIcon,
    MessageCircleIcon,
    NewspaperIcon
} from "@/app/[locale]/_components/icons";

export type ContactRouteId = "support" | "partnerships" | "sponsors" | "creators" | "press" | "general";

export const contactRouteIcons: Record<ContactRouteId, ComponentType<{className?: string; size?: number}>> = {
    support: LifeBuoyIcon,
    partnerships: HandshakeIcon,
    sponsors: MegaphoneIcon,
    creators: CameraIcon,
    press: NewspaperIcon,
    general: MessageCircleIcon
};

export function ContactHeroMark() {
    return (
        <div aria-hidden="true" className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute h-8 w-8 rounded-full border border-primary-200/25" />
            <span className="absolute h-5 w-5 rounded-full border border-primary-200/18" />
            <span className="relative h-2 w-2 rounded-full bg-primary-200 shadow-[0_0_12px_rgba(167,244,50,0.55)]" />
        </div>
    );
}

export function FieldScannerMotif({className = ""}: {className?: string}) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 220 220"
            className={`pointer-events-none text-primary-200 ${className}`}
            fill="none"
        >
            <circle cx="110" cy="110" r="96" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
            <circle cx="110" cy="110" r="68" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
            <circle cx="110" cy="110" r="40" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
            <path d="M110 14v192M14 110h192" stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
            <path d="M44 44l132 132M176 44 44 176" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" />
            <circle cx="110" cy="110" r="5" fill="currentColor" fillOpacity="0.55" />
            <circle cx="110" cy="110" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
        </svg>
    );
}

export function ContactRouteMotif({routeId}: {routeId: ContactRouteId}) {
    const shared = "pointer-events-none absolute right-0 top-0 h-28 w-28 text-primary-200 opacity-[0.05] max-md:opacity-[0.03] sm:h-32 sm:w-32";

    switch (routeId) {
        case "partnerships":
            return (
                <svg aria-hidden="true" viewBox="0 0 120 120" className={shared} fill="none">
                    <circle cx="38" cy="42" r="18" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="78" cy="58" r="14" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M52 48 66 54M70 62 84 72" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            );
        case "sponsors":
            return (
                <svg aria-hidden="true" viewBox="0 0 120 120" className={shared} fill="none">
                    <path d="M28 58h18l24-12v36l-24-12H28V58Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M78 48c6 4 10 10 10 18s-4 14-10 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M88 40c10 7 16 18 16 30s-6 23-16 30" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            );
        case "creators":
            return (
                <svg aria-hidden="true" viewBox="0 0 120 120" className={shared} fill="none">
                    <path d="M34 34h52v52H34V34Z" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M28 28h8M84 28h8M28 84h8M84 84h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="60" cy="60" r="10" stroke="currentColor" strokeWidth="1.2" />
                </svg>
            );
        case "press":
            return (
                <svg aria-hidden="true" viewBox="0 0 120 120" className={shared} fill="none">
                    <path d="M24 24h72v72H24V24Z" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M24 44h72M24 64h72M24 84h40" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M44 24v72M64 24v72M84 24v72" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" />
                </svg>
            );
        case "general":
            return (
                <svg aria-hidden="true" viewBox="0 0 120 120" className={shared} fill="none">
                    <path d="M28 38a12 12 0 0 1 12-12h28a12 12 0 0 1 12 12v18l16 12v22H28V68l16-12V38Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M46 52h20M46 64h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
}

export function ContactIconBadge({
    routeId,
    featured = false
}: {
    routeId: ContactRouteId;
    featured?: boolean;
}) {
    const Icon = contactRouteIcons[routeId];
    const size = featured ? 30 : 24;
    const container = featured
        ? "h-14 w-14 sm:h-16 sm:w-16 rounded-[1.1rem]"
        : "h-11 w-11 sm:h-12 sm:w-12 rounded-2xl";

    return (
        <div
            className={`flex shrink-0 items-center justify-center border border-primary-200/20 bg-[#071B0F]/90 text-primary-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] duration-500 group-hover:border-primary-200/40 group-hover:shadow-[0_0_20px_rgba(167,244,50,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] motion-reduce:transition-none ${container}`}
        >
            <Icon size={size} />
        </div>
    );
}
