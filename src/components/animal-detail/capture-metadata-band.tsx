"use client";

import {useMemo} from "react";

function relativeTimestamp(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const magnitude = Math.abs(seconds);
    if (magnitude < 45) return seconds >= 0 ? "in a moment" : "a moment ago";

    const formatter = new Intl.RelativeTimeFormat(undefined, {numeric: "auto", style: "long"});
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 31_536_000],
        ["month", 2_592_000],
        ["week", 604_800],
        ["day", 86_400],
        ["hour", 3_600],
        ["minute", 60],
        ["second", 1]
    ];
    const [unit, divisor] = units.find(([, unitSeconds]) => magnitude >= unitSeconds) ?? units[units.length - 1];
    return formatter.format(Math.round(seconds / divisor), unit);
}

function CalendarIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" strokeLinecap="round" /></svg>;
}

function LocationIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function CheckIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.8 7.4-5.6 6a1 1 0 0 1-1.45.02l-2.55-2.6 1.43-1.4 1.82 1.85 4.9-5.23 1.45 1.36Z" /></svg>;
}

function ArrowIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19 19 5M11 5h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function CaptureMetadataBand({
    captureId,
    capturedAt,
    locationLabel,
    locationHref,
    saved = true,
    layout = "compact"
}: {
    captureId: string;
    capturedAt?: string | null;
    locationLabel?: string | null;
    locationHref?: string | null;
    saved?: boolean;
    layout?: "compact" | "wide";
}) {
    const relativeDate = useMemo(() => capturedAt ? relativeTimestamp(capturedAt) : null, [capturedAt]);
    const wide = layout === "wide";

    return (
        <section className={`-mx-5 border-b border-white/10 bg-[#1f1f1f] px-5 py-3.5 font-sans ${
            wide ? "lg:mx-0 lg:rounded-[22px] lg:border lg:px-6 lg:py-5" : ""
        }`}>
            <div className="space-y-2">
                {relativeDate ? (
                    <div className="flex items-start gap-2 text-[15px] font-medium leading-5 text-white/[0.62]">
                        <span className="grid w-5 shrink-0 place-items-center text-white/55"><CalendarIcon /></span>
                        <span>{relativeDate}</span>
                    </div>
                ) : null}
                {locationLabel ? locationHref ? (
                    <a href={locationHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-[15px] font-medium leading-5 text-white/[0.62]">
                        <span className="grid w-5 shrink-0 place-items-center text-[#9454fa]"><LocationIcon /></span>
                        <span className="min-w-0 flex-1">{locationLabel}</span>
                        <span className="mt-0.5 text-white/[0.42]"><ArrowIcon /></span>
                    </a>
                ) : (
                    <div className="flex items-start gap-2 text-[15px] font-medium leading-5 text-white/[0.62]">
                        <span className="grid w-5 shrink-0 place-items-center text-[#9454fa]"><LocationIcon /></span>
                        <span>{locationLabel}</span>
                    </div>
                ) : null}
                {saved ? (
                    <div className="flex items-start gap-2 text-[15px] font-medium leading-5 text-white/[0.62]">
                        <span className="grid w-5 shrink-0 place-items-center text-[#38fa47]"><CheckIcon /></span>
                        <span>Saved in your collection</span>
                    </div>
                ) : null}
                <div className="space-y-1 px-1 pt-1 text-[11px] font-semibold leading-[14px] text-white/[0.42]">
                    <p>RECORD ID</p>
                    <p className="break-all text-white/[0.31] selection:bg-[#38fa47] selection:text-black">{captureId.toUpperCase()}</p>
                </div>
            </div>
        </section>
    );
}
