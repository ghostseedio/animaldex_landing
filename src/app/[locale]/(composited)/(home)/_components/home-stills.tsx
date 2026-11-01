import Image from "next/image";

/**
 * Two stills for the home page's "more" band (WEB-12), drawn like the hero's
 * chat still: what capturing an animal gives you, and a finished step. They
 * replace the scan-stats and battle-feed mock-ups (tier letters, "won",
 * power scores), which sold a different product. Nothing here is pressable.
 */

const FRAME = "theme-dark relative mx-auto w-full max-w-[24rem] overflow-hidden rounded-[2rem] border border-white/[0.12] bg-[#070A08]/95 shadow-[0_40px_120px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]";

function Stars({filled, label}: {filled: number; label: string}) {
    return (
        <span role="img" aria-label={label} className="flex gap-0.5 text-primary-300">
            {[0, 1, 2, 3, 4].map((index) => (
                <svg key={index} viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${index < filled ? "" : "opacity-25"}`} fill="currentColor" aria-hidden="true">
                    <path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7Z" />
                </svg>
            ))}
        </span>
    );
}

export function HomeRevealStill({words, image}: {
    words: {label: string; eyebrow: string; animal: string; scientificName: string; power: string; motto: string; talk: string; stars: string};
    image: string;
}) {
    return (
        <figure aria-label={words.label} className={FRAME}>
            <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary-200">{words.eyebrow}</p>
                <div className="relative mt-5 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.16),transparent_68%)]">
                    <Image src={image} alt="" fill sizes="176px" className="object-contain p-3" />
                </div>
                <p className="mt-4 font-display text-3xl font-bold leading-none text-white">{words.animal}</p>
                <p className="mt-1.5 text-sm italic text-white/60">{words.scientificName}</p>
                <div className="mt-3"><Stars filled={4} label={words.stars} /></div>
                <div className="mt-5 w-full border-l-2 border-primary-400 bg-primary-400/[0.07] px-4 py-3 text-left">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary-200">{words.power}</p>
                    <p className="mt-1 font-semibold text-white">{words.motto}</p>
                </div>
                <span aria-hidden="true" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary-400 px-5 text-sm font-black text-canvas-950">
                    {words.talk}
                </span>
            </div>
        </figure>
    );
}

export function HomeDoneStill({words, image}: {
    words: {label: string; animal: string; power: string; you: string; reply: string; doneLabel: string; doneText: string};
    image: string;
}) {
    return (
        <figure aria-label={words.label} className={FRAME}>
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
                    <Image src={image} alt="" fill sizes="44px" className="object-contain p-1" />
                </span>
                <span className="min-w-0 text-left">
                    <span className="block truncate font-display text-lg font-bold leading-tight text-white">{words.animal}</span>
                    <span className="block truncate text-xs font-semibold text-primary-200/90">{words.power}</span>
                </span>
            </div>
            <div className="flex flex-col gap-3 px-4 py-5 text-left text-[0.9375rem] leading-6">
                <p className="ml-10 self-end rounded-[1.25rem] rounded-br-md bg-primary-400 px-4 py-2.5 font-semibold text-canvas-950">{words.you}</p>
                <p className="mr-8 self-start rounded-[1.25rem] rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-2.5 text-white/90">{words.reply}</p>
                <div className="mt-1 flex items-start gap-3 border-l-2 border-primary-400 bg-primary-400/[0.07] px-4 py-3.5">
                    <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-400 text-canvas-950">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.4 6.4 11.2 12.5 4.8" /></svg>
                    </span>
                    <span>
                        <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary-200">{words.doneLabel}</span>
                        <span className="mt-1 block font-semibold text-white">{words.doneText}</span>
                    </span>
                </div>
            </div>
        </figure>
    );
}
