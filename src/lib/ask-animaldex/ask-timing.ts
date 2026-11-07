/**
 * The web turn's timing line (2026-11-07), shaped like the apps' function's
 * `animal_chat_timing` line (`supabase/functions/_shared/turn-timing.ts`), so
 * the two read alike: the label, the answer's length, the total, the first
 * frame, and in `notes` what the reply drew (`reply-drawings.ts`: its fences
 * by kind, `{}` for nothing) and whether it took the small-talk shortcut.
 *
 * Nothing of the reply's words is in it: a length, times and fence kinds.
 */

import {replyDrawings} from "@/lib/ask-animaldex/reply-drawings";

const round = (value: number) => Math.round(value * 10) / 10;

export function askTimingLine(input: {
    /** The answer as shown (no follow-ups, no hidden lines). */
    answer: string;
    /** Since the request arrived. */
    totalMs: number;
    /** When the first words were sent, since the request arrived; null if none were. */
    firstFrameMs: number | null;
    smallTalk?: boolean;
}): string {
    const report = {
        label: "ask_stream",
        answer_chars: input.answer.length,
        total_ms: round(input.totalMs),
        marks: input.firstFrameMs === null ? [] : [{name: "first_frame", at_ms: round(input.firstFrameMs)}],
        notes: {
            drew: replyDrawings(input.answer),
            ...(input.smallTalk ? {small_talk: true} : {})
        }
    };
    return `animal_chat_timing ${JSON.stringify(report)}`;
}
