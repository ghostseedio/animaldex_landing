import {loadImageBytes} from "@/lib/content-video/source";
import {isClaudeReady, structuredClaude} from "@/lib/social-content/claude";

// Before a drawn first frame is animated (and paid for as a clip), Claude
// looks at it next to the real animal's artwork: text-to-image models mix up
// lookalikes, and a "honey badger" with an anteater's snout ruins a guess
// video. A wrong frame is drawn once more with a correction, then the scene
// falls back to the real photo (runner.ts).

const SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["shows_subject", "seen"],
    properties: {shows_subject: {type: "boolean"}, seen: {type: "string"}}
} as const;

const SYSTEM = `You check AI-drawn wildlife frames before they are animated. Photo 1 is the real animal (reference artwork). Photo 2 is the drawn frame. Answer whether photo 2 unmistakably shows the SAME species as photo 1. Any pose, angle, light, silhouette or close-up of one body part is fine when it is plausible for that species. Answer false only when it clearly shows a different animal, a mix of animals, or extra or missing body parts. "seen": the animal photo 2 actually shows, in a few words.`;

export type KeyframeVerdict = {ok: boolean; seen: string};

/** Whether the drawn frame shows `subject`; null when it cannot be checked (no Claude key, an error): the frame goes ahead. */
export async function keyframeShows(frameUrl: string, subject: string, referenceSrc: string | null): Promise<KeyframeVerdict | null> {
    if (!isClaudeReady() || process.env.CONTENT_VIDEO_KEYFRAME_CHECK?.trim() === "off") return null;
    try {
        const [reference, frame] = await Promise.all([referenceSrc ? loadImageBytes(referenceSrc).catch(() => null) : null, loadImageBytes(frameUrl)]);
        const images = [...(reference ? [{index: 1, bytes: reference}] : []), {index: 2, bytes: frame}];
        const reply = await structuredClaude({
            system: SYSTEM,
            user: `The animal it must show: ${subject}.${reference ? "" : " (No reference photo: judge from the name.)"}`,
            schema: SCHEMA as unknown as Record<string, unknown>,
            images,
            effort: "low"
        });
        const value = reply.value as {shows_subject?: unknown; seen?: unknown};
        return {ok: value.shows_subject !== false, seen: typeof value.seen === "string" ? value.seen.slice(0, 80) : ""};
    } catch (error) {
        console.warn(`[content-video] keyframe check skipped: ${error instanceof Error ? error.message : error}`);
        return null;
    }
}
