import type {ReactNode} from "react";

/** The Trial card's locked grey, so a step that is not open yet sits back the same way. */
export const LOOP_STEP_QUIET = "#8C8C8C";

/**
 * One Power Loop step's body, drawn exactly like a Trial card: a coloured rail
 * (label left, state right) over a body washed in the same colour. Training and
 * Battle & Fuse use it so the three steps under the loop read as one set, with
 * the Trial cards of step 2 between them.
 *
 * `tone`: "lit" is open and next, "done" is finished, "quiet" is locked.
 */
export default function LoopStepCard({
    accent,
    tone,
    label,
    state,
    children
}: {
    accent: string;
    tone: "lit" | "done" | "quiet";
    label: string;
    state?: ReactNode;
    children: ReactNode;
}) {
    const color = tone === "quiet" ? LOOP_STEP_QUIET : accent;
    const railText = tone === "quiet" ? "text-white/60" : "text-black/85";
    return (
        <div className="flex w-full flex-col border-b border-white/[0.08] bg-white/[0.02] text-left">
            <div
                className="flex w-full items-center gap-2 px-5 py-2"
                style={{backgroundColor: tone === "quiet" ? `${color}33` : tone === "done" ? `${color}8C` : color}}
            >
                <span className={`text-[10px] font-black uppercase tracking-[0.11em] ${railText}`}>{label}</span>
                {state ? <span className={`ml-auto text-[10px] font-black ${railText}`}>{state}</span> : null}
            </div>
            <div
                className="flex w-full flex-col gap-3 px-5 pb-[18px] pt-3.5"
                style={{backgroundImage: `linear-gradient(to bottom, ${color}${tone === "lit" ? "2E" : "1A"}, transparent 60%)`}}
            >
                {children}
            </div>
        </div>
    );
}
