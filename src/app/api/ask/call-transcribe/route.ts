/**
 * A voice call's recognizer for browsers without their own (Firefox): POST
 * one turn of what the reader said (16 kHz 16-bit mono WAV, `?language=` the
 * call's BCP 47 tag) and get back what they said, `{ok: true, text}`.
 *
 * Signed-in readers only, where calls are offered (`askCallsOffered`); a turn
 * of at most 31 s and 1 MB; 30 a minute and 300 an hour a reader
 * (`call-transcribe.ts`). ElevenLabs speech to text (ELEVENLABS_API_KEY),
 * nothing stored. Chrome and Safari keep hearing with their own recognizer.
 */

import {resolveAskViewer} from "@/lib/ask-animaldex/request";
import {askCallsOffered} from "@/lib/ask-animaldex/call-gate";
import {handleCallTranscribe} from "@/lib/ask-animaldex/call-transcribe";
import {checkRateLimit} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    return handleCallTranscribe(request, {
        viewer: () => resolveAskViewer(request),
        callsOffered: askCallsOffered,
        apiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
        model: process.env.ANIMAL_CALL_TRANSCRIBE_MODEL?.trim() || undefined,
        rateLimit: checkRateLimit
    });
}
