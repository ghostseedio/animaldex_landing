/**
 * A report about something an animal said, as the Android app files it
 * (`AnimalReplyReport`, 8649e5a): the animal has no account, so the row is
 * filed as `other` against the card the chat is about. Pure.
 */

export const ASK_REPORT_CHOICES = ["Offensive or harmful", "Inaccurate or misleading", "Something else"] as const;
export type AskReportChoice = typeof ASK_REPORT_CHOICES[number];

/** Longer than a direct message's 1,000: a reply can run to several bubbles. */
export const ASK_REPORT_SNAPSHOT_LIMIT = 1500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAskReportChoice(value: unknown): value is AskReportChoice {
    return typeof value === "string" && (ASK_REPORT_CHOICES as readonly string[]).includes(value);
}

export function askReplyReport(params: {
    choice: AskReportChoice;
    animalName: string;
    replyText: string;
    captureId: string | null;
}): {contentId: string | null; reason: string; snapshot: string} {
    const captureId = params.captureId?.trim() ?? "";
    const name = params.animalName.trim() || "Animal";
    const full = `${name}: ${params.replyText.trim()}`;
    return {
        contentId: UUID_PATTERN.test(captureId) ? captureId.toLowerCase() : null,
        // In English, for whoever reviews it.
        reason: `animal_reply: ${params.choice}`,
        snapshot: full.length <= ASK_REPORT_SNAPSHOT_LIMIT ? full : `${full.slice(0, ASK_REPORT_SNAPSHOT_LIMIT - 1).trimEnd()}…`
    };
}
