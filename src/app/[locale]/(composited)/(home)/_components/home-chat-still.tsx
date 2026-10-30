import Image from "next/image";

export type HomeChatStillWords = {
    /** For a screen reader: what the picture is. */
    label: string;
    animal: string;
    /** "Its Power · Flexible Intelligence". */
    power: string;
    you: string;
    reply: string;
    stepLabel: string;
    step: string;
    accept: string;
    other: string;
    caption: string;
};

/**
 * The home page's picture of AnimalDex (newcomer UX vet, 2026-10-30, P0-4):
 * a still of one conversation, in place of the tier, grade and price phone
 * mock-up. You tell the animal what's going on, it answers from how its kind
 * lives, and it sets you one step; the caption says what doing it earns.
 *
 * A still, not a chat: nothing here is pressable, and the words are the
 * page's, shown as an example. The animal is drawn as its icon art, as every
 * chat draws it.
 */
export default function HomeChatStill({words, image}: {words: HomeChatStillWords; image: string}) {
    return (
        <figure className="relative mx-auto w-full max-w-[24rem]" aria-label={words.label}>
            <div aria-hidden="true" className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.18),transparent_65%)] blur-2xl" />
            <div className="theme-dark overflow-hidden rounded-[2rem] border border-white/[0.12] bg-[#070A08]/95 shadow-[0_40px_120px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]">
                {/* The animal, as a chat heads it. */}
                <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
                        <Image src={image} alt="" fill sizes="44px" className="object-contain p-1" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-display text-lg font-bold leading-tight text-white">{words.animal}</span>
                        <span className="block truncate text-xs font-semibold text-primary-200/90">{words.power}</span>
                    </span>
                </div>

                <div className="flex flex-col gap-3 px-4 py-5 text-left text-[0.9375rem] leading-6">
                    <p className="ml-10 self-end rounded-[1.25rem] rounded-br-md bg-primary-400 px-4 py-2.5 font-semibold text-canvas-950">
                        {words.you}
                    </p>
                    <p className="mr-8 self-start rounded-[1.25rem] rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-2.5 text-white/90">
                        {words.reply}
                    </p>

                    {/* The one step it sets. */}
                    <div className="mt-1 border-l-2 border-primary-400 bg-primary-400/[0.07] px-4 py-3.5">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary-200">{words.stepLabel}</p>
                        <p className="mt-1.5 font-semibold text-white">{words.step}</p>
                        <div className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
                            <span className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black text-canvas-950">{words.accept}</span>
                            <span className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/80">{words.other}</span>
                        </div>
                    </div>
                </div>
            </div>
            <figcaption className="mt-4 text-center text-sm font-semibold text-white/80">{words.caption}</figcaption>
        </figure>
    );
}
