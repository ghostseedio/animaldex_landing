import "server-only";

/**
 * A live voice call with the animal, server side: the web port of the call
 * mode in the apps' `generate-applied-insight` (search `isCall`) and its
 * `_shared/animal-call-voice.ts`.
 *
 * A call turn is an ordinary chat turn sent with `call: true`: it takes one
 * message from today's allowance exactly as a typed message does (the
 * route's `takeAskTurn`; the edge function's `usageFeature: "animal_call"`
 * only labels the model's usage, it is not a meter of its own). On top of it:
 *   - the reply comes from Claude Haiku 5.5 with thinking off
 *     (`CLAUDE_ANIMAL_CALL_MODEL`), effort low, under the call's length line
 *     (`CALL_REPLY_LINE`, as `this_reply`), so its first words arrive fast;
 *   - its voice streams back in the same SSE, sentence by sentence with the
 *     words (`call-voice-stream.ts`), in the animal's chat voice (its row in
 *     `species_chat_voice_overrides`, else its archetype from taxonomy, name
 *     and size), on ElevenLabs Flash (`ANIMAL_CALL_SPEECH_MODEL`).
 *
 * One spoken reply per turn: a signed-in reader's comes from their account's
 * daily spoken replies (`take_animal_chat_speech`, the pool the apps draw on),
 * given back when nothing was heard, exactly as the apps' rule. A reader
 * without an account has no such pool; their calls are bounded by the
 * anonymous message allowance (three a day per address), which is smaller
 * than any spoken-reply allowance, so a spoken reply needs no count of its own.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {ASK_QUESTION_MAX, type AskViewer} from "@/lib/ask-animaldex/request";
import {askAnswerSource, claudeAskKey, type AnswerDeltaSource, type AskProviderName} from "@/lib/ask-animaldex/providers";
import type {AskConversationTurn} from "@/lib/ask-animaldex/prompt";
import {
    ASK_CHAT_VOICE_KEYS,
    chooseAskChatVoiceKey,
    type AskChatVoiceKey,
    type AskPersonaDials,
    type AskPersonaStats,
    type AskSpeciesTaxonomy
} from "@/lib/ask-animaldex/persona";
import {callPace, callPlaybackRate, speechSettings, type CallPace} from "@/lib/ask-animaldex/call-speech";
import {callSpeaker, type CallEventSink, type CallSpeaker, type CallVoice, type CallVoiceSetup} from "@/lib/ask-animaldex/call-voice-stream";

export const DEFAULT_CLAUDE_CALL_MODEL = "claude-haiku-5-5";
export const DEFAULT_CALL_SPEECH_MODEL = "eleven_flash_v2_5";

function elevenLabsKey(): string | null {
    return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

/** The species' chat voice, shaped by its stats, for a call (`resolveCallVoice`). */
export async function resolveCallVoice(service: SupabaseClient, params: {
    speciesProfileId: string;
    animalName: string;
    stats: AskPersonaStats | null;
    dials: AskPersonaDials;
    pace: CallPace | null;
    model?: string | null;
}): Promise<CallVoice | null> {
    const [taxonomyRes, overrideRes] = await Promise.all([
        service.from("species_taxonomy").select("class_name, order_name, family_name")
            .eq("species_profile_id", params.speciesProfileId).maybeSingle(),
        service.from("species_chat_voice_overrides").select("voice_key")
            .eq("species_profile_id", params.speciesProfileId).maybeSingle()
    ]);
    const overrideKey = (overrideRes.data as {voice_key?: string} | null)?.voice_key;
    const voiceKey: AskChatVoiceKey = overrideKey && (ASK_CHAT_VOICE_KEYS as readonly string[]).includes(overrideKey)
        ? overrideKey as AskChatVoiceKey
        : chooseAskChatVoiceKey({
            animalName: params.animalName,
            taxonomy: (taxonomyRes.data ?? null) as AskSpeciesTaxonomy | null,
            stats: params.stats
        });
    const {data: row} = await service
        .from("animal_chat_voices")
        .select("label, elevenlabs_voice_id, base_speed, enabled")
        .eq("voice_key", voiceKey)
        .maybeSingle();
    const voiceRow = row as {label?: string | null; elevenlabs_voice_id?: string | null; base_speed?: number | string | null; enabled?: boolean | null} | null;
    if (!voiceRow?.elevenlabs_voice_id || voiceRow.enabled === false) return null;

    const settings = speechSettings({baseSpeed: Number(voiceRow.base_speed) || 1, dials: params.dials, pace: params.pace});
    const model = params.model?.trim() || DEFAULT_CALL_SPEECH_MODEL;
    return {
        voiceKey,
        label: voiceRow.label ?? null,
        elevenlabsVoiceId: String(voiceRow.elevenlabs_voice_id),
        model,
        settings,
        rate: callPlaybackRate(model, settings),
        pace: callPace(params.pace, params.dials)
    };
}

const NO_VOICE: CallVoiceSetup = {voice: null, allowed: false, allowance: null, refund: () => Promise.resolve()};

/** One spoken reply from today's allowance and the species' voice, looked up together while the model starts. */
async function prepareCallVoice(params: {
    viewer: AskViewer;
    speciesProfileId: string | null;
    animalName: string;
    stats: AskPersonaStats | null;
    dials: AskPersonaDials | null;
    pace: CallPace | null;
}): Promise<CallVoiceSetup> {
    const service = createSupabaseServiceClient();
    if (!service || !params.speciesProfileId || !params.dials || !elevenLabsKey()) return NO_VOICE;
    try {
        const voice = resolveCallVoice(service, {
            speciesProfileId: params.speciesProfileId,
            animalName: params.animalName,
            stats: params.stats,
            dials: params.dials,
            pace: params.pace,
            model: process.env.ANIMAL_CALL_SPEECH_MODEL
        });
        const userId = params.viewer.signedIn ? params.viewer.userId : null;
        if (!userId) {
            // No account, no spoken-reply pool: the message allowance bounds it.
            return {voice: await voice, allowed: true, allowance: null, refund: () => Promise.resolve()};
        }
        const [taken, resolved] = await Promise.all([
            service.rpc("take_animal_chat_speech", {p_user_id: userId}),
            voice
        ]);
        const allowance = (taken.data ?? null) as Record<string, unknown> | null;
        const allowed = !taken.error && allowance?.allowed === true;
        const refund = () => Promise.resolve(service.rpc("refund_animal_chat_speech", {p_user_id: userId}))
            .then(() => undefined, () => undefined);
        // No voice to speak with: the allowance goes straight back.
        if (allowed && !resolved) await refund();
        return {voice: resolved, allowed, allowance, refund};
    } catch (error) {
        console.warn("[ask-animaldex] call voice setup", error instanceof Error ? error.message : String(error));
        return NO_VOICE;
    }
}

/**
 * Claude as the animal on a call: the fast model, thinking off (the first word
 * as soon as possible), no server-side fallback (Haiku 5.5 has none), and
 * room for a long spoken answer when they ask for one. As in the chat, no
 * retries here: Gemini takes over when nothing was said.
 */
function claudeCallAnswerSource(params: {
    key: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    signal?: AbortSignal;
}): AnswerDeltaSource {
    return async (emit) => {
        const client = new Anthropic({apiKey: params.key, timeout: 90_000, maxRetries: 0});
        const stream = client.beta.messages.stream({
            model: params.model,
            max_tokens: 3000,
            thinking: {type: "disabled"},
            output_config: {effort: "low"},
            system: [{type: "text", text: params.systemPrompt, cache_control: {type: "ephemeral"}}],
            messages: [
                ...(params.history ?? []).map((turn) => ({role: turn.role, content: turn.content})),
                {role: "user" as const, content: params.userPrompt}
            ]
        }, {signal: params.signal});
        let emitted = false;
        stream.on("text", (delta) => {
            if (!delta) return;
            emitted = true;
            emit(delta);
        });
        const final = await stream.finalMessage();
        if (process.env.NODE_ENV !== "production") {
            const usage = (final.usage ?? {}) as unknown as Record<string, unknown>;
            console.info(
                `[ask-animaldex] claude call ${final.model} stop=${final.stop_reason}`
                + ` in=${usage.input_tokens ?? "?"} cache_read=${usage.cache_read_input_tokens ?? 0} out=${usage.output_tokens ?? "?"}`
            );
        }
        if (!emitted) {
            throw new Error(final.stop_reason === "refusal"
                ? `claude_refusal:${final.stop_details?.category ?? "unknown"}`
                : `claude_empty:${final.stop_reason}`);
        }
    };
}

/** What was said on a call: two letters is a turn there ("hi"), as in the app; typed questions need three. */
export function resolveAskCallQuestion(raw: unknown): string | null {
    const question = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
    return question.length >= 2 && question.length <= ASK_QUESTION_MAX ? question : null;
}

export type AskCall = {
    /** Where the reply comes from: Haiku for Claude, the chat's own Gemini and OpenAI after it. */
    source: (provider: AskProviderName, params: {
        systemPrompt: string;
        userPrompt: string;
        history?: AskConversationTurn[];
        signal?: AbortSignal;
    }) => AnswerDeltaSource | null;
    /** Speaks the reply into this stream as it arrives; the voice is set up as it starts. */
    speaker: (send: CallEventSink) => CallSpeaker;
};

/**
 * A call turn's extras for the stream route. `signal` is the request's: when
 * the person talks over the animal or hangs up, the voice stops at once.
 */
export function askCallTurn(params: {
    viewer: AskViewer;
    speciesProfileId: string | null;
    animalName: string;
    stats: AskPersonaStats | null;
    dials: AskPersonaDials | null;
    pace: CallPace | null;
    signal: AbortSignal;
}): AskCall {
    return {
        source: (provider, source) => {
            if (provider === "claude") {
                const key = claudeAskKey();
                const model = process.env.CLAUDE_ANIMAL_CALL_MODEL?.trim() || DEFAULT_CLAUDE_CALL_MODEL;
                return key ? claudeCallAnswerSource({...source, key, model}) : null;
            }
            return askAnswerSource(provider, {...source, effort: "low"});
        },
        speaker: (send) => {
            const speaker = callSpeaker(prepareCallVoice(params), send, {apiKey: elevenLabsKey()});
            if (params.signal.aborted) speaker.stop();
            else params.signal.addEventListener("abort", () => speaker.stop(), {once: true});
            return speaker;
        }
    };
}
