"use client";

/**
 * The microphone in the chat header that starts a voice call with the animal
 * (the iOS chat's `speakToAnimalCall`). Shown only when the animal has a
 * talking model published as glTF and this browser can hold a call: a
 * microphone, Web Audio, and a recognizer, its own or (a signed-in reader:
 * Firefox has no Web Speech API) the call's on the server. The call screen,
 * and three.js with it, load only when it is pressed.
 *
 * Each call turn is a turn of this chat: what they said lands in the thread
 * like a typed message and the animal's answer comes back into it, so the
 * conversation carries on in text after the call (iOS `callTurn`). A turn
 * whose voice did not stream is spoken as one clip by the chat's own speech
 * route, from the reader's spoken replies (iOS `speakAnimalChatReply`).
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import dynamic from "next/dynamic";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {primeCallAudio} from "@/components/ask-animaldex/voice-call/call-audio";
import {browserCanCall} from "@/components/ask-animaldex/voice-call/call-listener";
import {PhoneIcon} from "@/components/ask-animaldex/voice-call/call-icons";
import {callCopy} from "@/lib/ask-animaldex/call-copy";
import {callClipSource, type CallClip} from "@/lib/ask-animaldex/call-events";
import {
    loadTalkingModelManifest,
    talkingModelAsset,
    talkingModelSlugFor,
    type TalkingModelAsset
} from "@/lib/talking-models/catalog";

const VoiceCallScreen = dynamic(() => import("@/components/ask-animaldex/voice-call/voice-call-screen"), {ssr: false});

type Send = (question: string, options?: {onCallEvent?: (frame: Record<string, unknown>) => void}) => Promise<string | null>;

export default function AskVoiceCallButton({
    threadKey,
    animalName,
    captureId,
    speciesProfileId,
    serverHearing,
    names,
    locale,
    disabled,
    send,
    stop,
    onOpen,
    onCallChange
}: {
    threadKey: string;
    animalName: string;
    /** Whose voice a whole clip is in: the card, or the species (as the chat's own voice). */
    captureId: string | null;
    speciesProfileId: string | null;
    /** The server's recognizer may hear this reader (signed in): where the browser has none, and over the animal. */
    serverHearing: boolean;
    /** The names its model may be published under, best first (a breed, the species, its slug). */
    names: Array<string | null | undefined>;
    locale: string;
    disabled: boolean;
    send: Send;
    /** Stops the reply in flight, keeping `keepText` of it. */
    stop: (keepText?: string) => void;
    /** The call is opening: the chat's own voice and sounds stop. */
    onOpen?: () => void;
    /** Whether a call is open, so the chat stays quiet under it (iOS holds its sounds and voice). */
    onCallChange?: (open: boolean) => void;
}) {
    const [asset, setAsset] = useState<TalkingModelAsset | null>(null);
    const [open, setOpen] = useState(false);
    const onCallChangeRef = useRef(onCallChange);
    onCallChangeRef.current = onCallChange;
    useEffect(() => {
        onCallChangeRef.current?.(open);
    }, [open]);
    useEffect(() => () => onCallChangeRef.current?.(false), []);
    const nameKey = names.filter(Boolean).join("|");

    useEffect(() => {
        if (!browserCanCall({serverHearing})) return;
        let cancelled = false;
        void loadTalkingModelManifest().then((manifest) => {
            if (cancelled) return;
            setAsset(talkingModelAsset(manifest, talkingModelSlugFor(manifest, nameKey.split("|"))));
        });
        return () => {
            cancelled = true;
        };
    }, [nameKey, serverHearing]);

    /**
     * One turn of a call: what they said goes in the thread like a typed
     * message, and the answer's text comes back, its voice streaming to
     * `onEvent` as it is spoken. They carried on after a pause before the
     * animal answered: the call sends the whole thing, so the unanswered start
     * of it goes.
     */
    const ask = useCallback(async (said: string, onEvent: (frame: Record<string, unknown>) => void) => {
        const thread = askSessionStore.messages(threadKey);
        const last = thread[thread.length - 1];
        if (last && last.role === "user" && said.startsWith(last.text.trim())) {
            askSessionStore.replace(threadKey, thread.slice(0, -1));
        }
        return send(said, {onCallEvent: onEvent});
    }, [threadKey, send]);

    /**
     * The whole reply as one clip, when its voice did not stream: the chat's
     * speech route (the reader's own spoken replies; none without an account).
     */
    const speak = useCallback(async (reply: string, signal: AbortSignal): Promise<CallClip> => {
        if (!captureId && !speciesProfileId) return {kind: "none"};
        const response = await fetch("/api/ask/speech", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({text: reply, captureId, speciesProfileId}),
            signal
        });
        const source = callClipSource(response.ok, await response.json().catch(() => null));
        if (source.kind === "inline") {
            const audio = new ArrayBuffer(source.bytes.byteLength);
            new Uint8Array(audio).set(source.bytes);
            return {kind: "audio", audio};
        }
        if (source.kind !== "url") return source;
        const clip = await fetch(source.url, {signal});
        return clip.ok ? {kind: "audio", audio: await clip.arrayBuffer()} : {kind: "none"};
    }, [captureId, speciesProfileId]);

    /** The turn in flight stops; what the animal had said stays in the thread. */
    const cancelAsk = useCallback(() => {
        const thread = askSessionStore.messages(threadKey);
        const replying = [...thread].reverse().find((message) => message.role === "assistant" && message.status === "streaming");
        stop(replying?.text);
    }, [threadKey, stop]);

    if (!asset) return null;
    const copy = callCopy(locale);
    // "Call Luna": the header's call (the message bar's mic only dictates, DECISIONS section 9).
    const label = copy.call.replace("{animal}", animalName);

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    // Sound may only start from a gesture: the call's audio starts here.
                    primeCallAudio();
                    onOpen?.();
                    setOpen(true);
                }}
                disabled={disabled}
                aria-label={label}
                title={label}
                data-testid="ask-voice-call"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12 disabled:pointer-events-none disabled:opacity-35"
            >
                <PhoneIcon size={16} />
            </button>
            {open && typeof document !== "undefined"
                ? createPortal(
                    <VoiceCallScreen
                        animalName={animalName}
                        asset={asset}
                        locale={locale}
                        ask={ask}
                        cancelAsk={cancelAsk}
                        speak={speak}
                        serverHearing={serverHearing}
                        onClose={() => setOpen(false)}
                    />,
                    document.body
                )
                : null}
        </>
    );
}
