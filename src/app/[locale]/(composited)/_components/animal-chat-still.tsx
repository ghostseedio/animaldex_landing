import {
    AskAnimalFace,
    AskReplyBubbles,
    AskSpecialLabel,
    AskUserBubble,
    AskWalkIcon
} from "@/components/ask-animaldex/ask-messenger";

export type AnimalChatStillProps = {
    /** What the picture is, for a screen reader. */
    label: string;
    /** "You said:", before the person's words for a screen reader. */
    youLabel: string;
    you: string;
    animal: {
        name: string;
        /** "Its Power · Prickled Courage". */
        power: string;
        /** The species icon art, never a capture photo. */
        avatarUrl: string;
        /** One bubble per paragraph, as the chat splits a reply. */
        bubbles: string[];
    };
    /** The quiet line under the animal's name (spec §3.3). */
    note?: string;
    step?: {label: string; text: string; accept: string; other: string};
    className?: string;
};

const CHIP = "inline-flex min-h-9 items-center justify-center rounded-full px-[14px] py-1.5 text-xs leading-4";

/**
 * One conversation as a still, drawn by the chat's own pieces: the person's
 * green bubble, the animal's bubbles beside its face, and the step as the
 * special message in its last bubble (neon edge, faint wash, its label).
 * Nothing in it is pressable; the words are the page's, shown as an example.
 */
export default function AnimalChatStill({label, youLabel, you, animal, note, step, className = ""}: AnimalChatStillProps) {
    const special = step ? (
        <div className="flex flex-col gap-2.5">
            <AskSpecialLabel icon={<AskWalkIcon />}>{step.label}</AskSpecialLabel>
            <p className="font-bold leading-6">{step.text}</p>
            <div className="flex flex-wrap gap-2" aria-hidden="true">
                <span className={`${CHIP} bg-primary-400 font-black text-black`}>{step.accept}</span>
                <span className={`${CHIP} border border-white/12 bg-white/[0.07] font-bold text-white light:border-black/10 light:bg-black/[0.04]`}>{step.other}</span>
            </div>
        </div>
    ) : null;

    return (
        <figure
            aria-label={label}
            className={`flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-line-200 bg-canvas-950 shadow-[0_30px_90px_rgba(0,0,0,0.35)] light:shadow-[0_20px_60px_rgba(12,26,17,0.10)] ${className}`}
        >
            {/* The animal, as the top of its chat shows it. */}
            <div className="flex items-start gap-3 border-b border-line-300 px-4 py-3.5">
                <AskAnimalFace url={animal.avatarUrl} size={40} className="ring-1 ring-primary-400/30" />
                <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold leading-tight text-white">{animal.name}</p>
                    <p className="truncate text-xs font-semibold text-primary-200">{animal.power}</p>
                    {note ? <p className="mt-1 text-[11px] leading-4 text-ink-400">{note}</p> : null}
                </div>
            </div>
            <div className="flex flex-col gap-3 px-3 py-4">
                <AskUserBubble text={you} label={youLabel} />
                <AskReplyBubbles
                    text={animal.bubbles.join("\n\n")}
                    isLive={false}
                    avatarUrl={animal.avatarUrl}
                    speakerName={animal.name}
                    photoUrl={null}
                    photoAlt=""
                    special={special}
                />
            </div>
        </figure>
    );
}
