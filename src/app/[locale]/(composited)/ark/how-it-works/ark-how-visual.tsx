import React from "react";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";

/**
 * /ark/how-it-works as pictures (lane ARK-SIMPLE, owner 2026-11-20: "needs a makeover, needs to be 10x more visual then
 * textual and feel super premium"): each rule of the Ark as a small drawn scene made of the Ark's own species icons and
 * stills, with a caption a five-year-old gets. Server components only (no script): the motion is CSS, and it stands still
 * with reduced motion (`.ark-how-*` in this file's style block). The facts are the page's (the long rules stay below).
 */

export type ArkHowWords = Record<"lead" | "capture" | "captureCaption" | "islands" | "islandsCaption" | "thrive" | "thriveCaption" | "food" | "foodCaption" | "babies" | "babiesCaption" | "time" | "timeCaption" | "fair" | "fairCaption" | "cta" | "more" | "wild" | "town" | "arkYear", string>;

export const ARK_HOW_ENGLISH: ArkHowWords = {
    lead: "A live 3D world of real animals, run by nature's rules.",
    capture: "Snap a real animal",
    captureCaption: "Catch one with the AnimalDex app. One of its kind comes aboard.",
    islands: "Two islands",
    islandsCaption: "Wild animals live on the wild island. Pets, farm and zoo animals live in town.",
    thrive: "Help it thrive",
    thriveCaption: "Talk to your animal and try its step. When it works, your animals grow stronger.",
    food: "Who eats whom",
    foodCaption: "Hunters eat only what their field guide says. The weakest get caught first.",
    babies: "Babies",
    babiesCaption: "Two grown-ups of a kind, in the same place, with food: babies!",
    time: "Fast time",
    timeCaption: "A year on the Ark is 2 weeks for you. Animals grow up and grow old.",
    fair: "Nobody picks",
    fairCaption: "No one decides who lives. Only the rules, the same for everyone.",
    cta: "Open the Ark",
    more: "Read every rule",
    wild: "Wild",
    town: "Town",
    arkYear: "1 Ark year"
};

export function arkHowWords(raw: unknown): ArkHowWords {
    const own = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const out = {...ARK_HOW_ENGLISH};
    for (const key of Object.keys(out) as Array<keyof ArkHowWords>) {
        const value = own[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

function Icon({slug, size, className = "", style}: {slug: string; size: number; className?: string; style?: React.CSSProperties}) {
    return (
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] ring-2 ring-white/70 ${className}`} style={{width: size, height: size, ...style}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={arkIconUrl(slug)} alt="" width={size} height={size} loading="lazy" decoding="async" className="h-[84%] w-[84%] object-contain" />
        </span>
    );
}

/** The motion, in one place (each animation is decoration; reduced motion stands it still). */
const STYLE = `
@keyframes ark-how-fly { 0%,18% { transform: translate(0,0) scale(1); opacity: 1 } 55% { transform: translate(var(--fx), var(--fy)) scale(.9); opacity: 1 } 70%,100% { transform: translate(var(--fx), var(--fy)) scale(1); opacity: 1 } }
@keyframes ark-how-flash { 0%,14% { opacity: 0 } 16% { opacity: .9 } 30%,100% { opacity: 0 } }
@keyframes ark-how-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes ark-how-fill { 0%,10% { transform: scaleX(.12) } 45%,85% { transform: scaleX(1) } 100% { transform: scaleX(.12) } }
@keyframes ark-how-star { 0%,30% { opacity: .2; transform: scale(.8) } 40%,85% { opacity: 1; transform: scale(1) } 100% { opacity: .2; transform: scale(.8) } }
@keyframes ark-how-dash { to { stroke-dashoffset: -24 } }
@keyframes ark-how-pop { 0%,35% { transform: scale(0); opacity: 0 } 50% { transform: scale(1.15); opacity: 1 } 60%,90% { transform: scale(1); opacity: 1 } 100% { transform: scale(0); opacity: 0 } }
@keyframes ark-how-beat { 0%,100% { transform: scale(1) } 15% { transform: scale(1.25) } 30% { transform: scale(1) } }
@keyframes ark-how-spin { to { transform: rotate(360deg) } }
@keyframes ark-how-grow { 0% { transform: scale(.55) } 50% { transform: scale(1) } 100% { transform: scale(.55) } }
.ark-how-fly { animation: ark-how-fly 4.5s cubic-bezier(.5,0,.2,1) infinite; }
.ark-how-flash { animation: ark-how-flash 4.5s ease-out infinite; }
.ark-how-bob { animation: ark-how-bob 3.2s ease-in-out infinite; }
.ark-how-fill { transform-origin: left center; animation: ark-how-fill 5s ease-in-out infinite; }
[dir="rtl"] .ark-how-fill { transform-origin: right center; }
.ark-how-star { animation: ark-how-star 5s ease-in-out infinite; }
.ark-how-dash { animation: ark-how-dash 1.4s linear infinite; }
.ark-how-pop { animation: ark-how-pop 4s ease-out infinite; }
.ark-how-beat { animation: ark-how-beat 1.6s ease-in-out infinite; }
.ark-how-spin { animation: ark-how-spin 6s linear infinite; transform-origin: 60px 60px; }
.ark-how-grow { animation: ark-how-grow 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ark-how-fly, .ark-how-flash, .ark-how-bob, .ark-how-fill, .ark-how-star, .ark-how-dash, .ark-how-pop, .ark-how-beat, .ark-how-spin, .ark-how-grow { animation: none; }
  .ark-how-fly { transform: translate(var(--fx), var(--fy)); }
  .ark-how-pop { transform: none; opacity: 1; }
}
`;

const STAGE = "relative aspect-[16/10] w-full overflow-hidden rounded-[1.4rem] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(200,250,99,0.10),transparent_55%),linear-gradient(180deg,#18201b,#101512)] ring-1 ring-white/[0.09]";

function Capture() {
    return (
        // Two columns wide at lg, as tall as its neighbours' scenes (no gap under the second card).
        <div className={`${STAGE} lg:aspect-[33/10]`}>
            {/* The 3D Ark, far right; a phone, left, catching a fox; the fox flies aboard. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ark/poster/wild-wide.webp" alt="" loading="lazy" className="absolute inset-y-0 right-0 h-full w-[58%] object-cover [mask-image:linear-gradient(to_right,transparent,#000_35%)] rtl:left-0 rtl:right-auto rtl:[mask-image:linear-gradient(to_left,transparent,#000_35%)]" />
            <div className="absolute left-[9%] top-1/2 flex aspect-[10/17] h-[78%] -translate-y-1/2 items-center justify-center rounded-[1.1rem] border-[3px] border-white/85 bg-[#0d120f] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)] rtl:left-auto rtl:right-[9%]">
                <span className="absolute top-1.5 h-1 w-6 rounded-full bg-white/40" />
                <svg viewBox="0 0 40 40" className="absolute h-[70%] w-[70%] text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M3 12V3h9M28 3h9v9M37 28v9h-9M12 37H3v-9" /></svg>
                <span className="ark-how-flash absolute inset-0 rounded-[0.9rem] bg-white" />
                <span className="ark-how-fly relative" style={{"--fx": "clamp(7rem, 26vw, 15rem)", "--fy": "-0.6rem"} as React.CSSProperties}>
                    <Icon slug="red-fox" size={52} />
                </span>
            </div>
        </div>
    );
}

function Islands({words}: {words: ArkHowWords}) {
    const island = (label: string, slugs: string[], tint: string, delay: string) => (
        <div className="relative flex flex-1 flex-col items-center justify-end">
            <div className="ark-how-bob relative mb-[12%] flex w-[88%] items-end justify-center" style={{animationDelay: delay}}>
                <span className={`absolute inset-x-0 bottom-0 h-[58%] rounded-[50%] ${tint} shadow-[0_14px_30px_-10px_rgba(0,0,0,0.7)]`} />
                <div className="relative mb-[22%] flex -space-x-2 rtl:space-x-reverse">
                    {slugs.map((slug) => <Icon key={slug} slug={slug} size={40} />)}
                </div>
            </div>
            <span className="absolute bottom-[4%] rounded-full bg-black/45 px-2.5 py-0.5 text-[12px] font-bold text-white backdrop-blur">{label}</span>
        </div>
    );
    return (
        <div className={`${STAGE} flex bg-[linear-gradient(180deg,#183447,#0f2232)]`}>
            <span className="absolute inset-0 bg-[repeating-linear-gradient(170deg,rgba(255,255,255,0.04)_0_2px,transparent_2px_16px)]" />
            {island(words.wild, ["african-lion", "plains-zebra", "golden-eagle"], "bg-[radial-gradient(circle_at_50%_30%,#6a9a3a,#3d6a25_60%,#c9b27a_61%,#b89a5c)]", "0s")}
            {island(words.town, ["domestic-dog", "domestic-cat", "domestic-goat"], "bg-[radial-gradient(circle_at_50%_30%,#8aa65a,#5e7d3a_60%,#cdb98a_61%,#b3a072)]", "-1.6s")}
        </div>
    );
}

function Thrive() {
    return (
        <div className={`${STAGE} flex flex-col items-center justify-center gap-[7%]`}>
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-lg rtl:rounded-bl-2xl rtl:rounded-br-md" aria-hidden="true"><i className="block h-1.5 w-1.5 rounded-full bg-canvas-900/70" /><i className="block h-1.5 w-1.5 rounded-full bg-canvas-900/50" /><i className="block h-1.5 w-1.5 rounded-full bg-canvas-900/30" /></span>
                <svg viewBox="0 0 48 12" className="h-3 w-12 text-primary-300 rtl:rotate-180" aria-hidden="true"><path d="M2 6h40" stroke="currentColor" strokeWidth={2.5} strokeDasharray="4 4" className="ark-how-dash" /><path d="M40 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <Icon slug="meerkat" size={58} />
            </div>
            <div className="flex w-[62%] flex-col items-center gap-2">
                <div className="flex gap-2 text-[22px] leading-none">
                    {[0, 1, 2].map((n) => <span key={n} aria-hidden="true" className="ark-how-star text-[#c8fa63]" style={{animationDelay: `${n * 0.35}s`}}>★</span>)}
                </div>
                <span className="block h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <span className="ark-how-fill block h-full w-full rounded-full bg-[linear-gradient(90deg,#86e08f,#c8fa63)]" />
                </span>
            </div>
        </div>
    );
}

function Food() {
    const arrow = (
        <svg viewBox="0 0 60 16" className="h-4 w-6 shrink-0 text-[#56b4e9] sm:w-8 rtl:rotate-180" aria-hidden="true">
            <path d="M2 8h48" stroke="currentColor" strokeWidth={2.5} strokeDasharray="6 6" className="ark-how-dash" />
            <path d="M48 2l8 6-8 6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
    return (
        <div className={`${STAGE} flex items-center justify-center gap-1.5 px-3`}>
            <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0 text-primary-300" fill="currentColor"><path d="M16 30V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M16 16C8 16 5 10 5 4c7 0 11 4 11 12z" opacity=".9" /><path d="M16 20c6 0 10-4 11-11-6 0-11 3-11 11z" opacity=".7" /></svg>
            {arrow}
            <div className="relative flex flex-col items-center gap-1">
                <Icon slug="european-rabbit" size={44} />
                <span className="absolute -bottom-6 flex items-center opacity-50"><Icon slug="european-rabbit" size={30} className="grayscale" /></span>
            </div>
            {arrow}
            <Icon slug="red-fox" size={52} />
            {arrow}
            <Icon slug="golden-eagle" size={44} />
        </div>
    );
}

function Babies() {
    return (
        <div className={`${STAGE} flex items-center justify-center gap-4`}>
            <Icon slug="plains-zebra" size={64} />
            <span aria-hidden="true" className="ark-how-beat text-[30px] leading-none text-[#ff8fa3]">♥</span>
            <Icon slug="plains-zebra" size={64} />
            <span aria-hidden="true" className="text-[26px] font-black text-white/60">=</span>
            <span className="ark-how-pop"><Icon slug="plains-zebra" size={40} /></span>
        </div>
    );
}

function Time({words, twoWeeks}: {words: ArkHowWords; twoWeeks: string}) {
    return (
        <div className={`${STAGE} flex items-center justify-center gap-[6%]`}>
            <svg viewBox="0 0 120 120" className="h-[70%] w-auto" aria-hidden="true">
                <circle cx="60" cy="60" r="52" fill="#0d120f" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
                {Array.from({length: 12}, (_, i) => <line key={i} x1="60" y1="12" x2="60" y2={i % 3 ? 18 : 22} stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${i * 30} 60 60)`} />)}
                <g className="ark-how-spin"><line x1="60" y1="60" x2="60" y2="20" stroke="#c8fa63" strokeWidth="4" strokeLinecap="round" /></g>
                <circle cx="60" cy="60" r="5" fill="#c8fa63" />
            </svg>
            <div className="flex flex-col items-center gap-1 text-center">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-bold text-white">{words.arkYear}</span>
                <span aria-hidden="true" className="text-[22px] font-black leading-none text-white/60">=</span>
                <span className="rounded-full bg-primary-400 px-3 py-1 text-[15px] font-extrabold text-canvas-950">{twoWeeks}</span>
                <span className="ark-how-grow mt-2 inline-flex"><Icon slug="african-bush-elephant" size={44} /></span>
            </div>
        </div>
    );
}

function Fair() {
    return (
        <div className={`${STAGE} flex items-center justify-center lg:aspect-[33/10]`}>
            <svg viewBox="0 0 160 100" className="h-[78%] w-auto" aria-hidden="true">
                <path d="M80 14v70M50 84h60" stroke="rgba(255,255,255,0.75)" strokeWidth="4" strokeLinecap="round" />
                <path d="M30 30h100" stroke="rgba(255,255,255,0.75)" strokeWidth="4" strokeLinecap="round" />
                <circle cx="80" cy="14" r="6" fill="#c8fa63" />
                <path d="M30 30 16 58h28z M130 30l-14 28h28z" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M14 58a16 7 0 0 0 32 0z M114 58a16 7 0 0 0 32 0z" fill="#c8fa63" />
            </svg>
        </div>
    );
}

export type ArkHowStep = {id: string; title: string; caption: string; picture: React.ReactNode};

export function arkHowSteps(words: ArkHowWords, twoWeeks: string): ArkHowStep[] {
    return [
        {id: "captures", title: words.capture, caption: words.captureCaption, picture: <Capture />},
        {id: "islands", title: words.islands, caption: words.islandsCaption, picture: <Islands words={words} />},
        {id: "condition", title: words.thrive, caption: words.thriveCaption, picture: <Thrive />},
        {id: "food", title: words.food, caption: words.foodCaption, picture: <Food />},
        {id: "breeding", title: words.babies, caption: words.babiesCaption, picture: <Babies />},
        {id: "seasons", title: words.time, caption: words.timeCaption, picture: <Time words={words} twoWeeks={twoWeeks} />},
        {id: "fair", title: words.fair, caption: words.fairCaption, picture: <Fair />}
    ];
}

export function ArkHowStyle() {
    return <style dangerouslySetInnerHTML={{__html: STYLE}} />;
}
