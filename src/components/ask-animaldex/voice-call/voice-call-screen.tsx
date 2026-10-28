"use client";

/**
 * The call screen: the web counterpart of the iOS `AnimalVoiceCallView`.
 *
 * Where the animal lives behind it (its habitat scene, fading to near black
 * under the words and the controls; the green studio until the scene
 * arrives), the animal itself (`TalkingModelView`), the exchange as a band
 * across the screen — their words, then the animal's, each word lit as it is
 * said and scrolling with it — and the microphone with the sound moving
 * round it, mute beside it and the red end button. Always dark, as the app's.
 */

import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from "react";
import TalkingModelView from "@/components/ask-animaldex/voice-call/talking-model-view";
import {VoiceCallController, type CallAsk, type CallState} from "@/components/ask-animaldex/voice-call/voice-call-controller";
import {callAudioContext} from "@/components/ask-animaldex/voice-call/call-audio";
import {CaptionsIcon, ChevronDownIcon, EllipsisIcon, HandIcon, MicIcon, MicSlashIcon, XMarkIcon} from "@/components/ask-animaldex/voice-call/call-icons";
import {callClock, callSpokenIndex, type CallSpokenWord} from "@/lib/ask-animaldex/call-events";
import {callCopy, callSpeechLanguage} from "@/lib/ask-animaldex/call-copy";
import {WaveMeter} from "@/lib/talking-models/model-math";
import {talkingModelSceneUrl, type TalkingModelAsset} from "@/lib/talking-models/catalog";

const LIME = "#A7F432";
const PRIMARY_GREEN = "#21C05E";
const NEAR_BLACK = "#07100B";
const CAUTION = "rgb(250, 184, 61)";
const END_RED = "#FF453A";

const IDLE_STATE: CallState = {
    phase: "starting",
    failure: null,
    heard: "",
    said: "",
    spokenWords: [],
    timings: null,
    startedAt: Date.now(),
    isMuted: false
};

const noSubscription = () => () => undefined;

/** Development only: `?callScript=first thing|second thing` says these instead of listening (iOS `ANIMALDEX_CALL_SCRIPT`). */
function developmentCallScript(): string[] | null {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("callScript");
    return raw ? raw.split("|").map((line) => line.trim()).filter(Boolean) : null;
}

export default function VoiceCallScreen({
    animalName,
    asset,
    locale,
    ask,
    cancelAsk,
    onClose
}: {
    animalName: string;
    /** The animal's model files. */
    asset: TalkingModelAsset;
    locale: string;
    ask: CallAsk;
    cancelAsk: () => void;
    onClose: () => void;
}) {
    const copy = callCopy(locale);
    const t = (text: string) => text.replace("{animal}", animalName);
    const [controller, setController] = useState<VoiceCallController | null>(null);
    const [showsCaptions, setShowsCaptions] = useState(true);
    const [scene, setScene] = useState<string | null>(null);
    const askRef = useRef(ask);
    askRef.current = ask;
    const cancelRef = useRef(cancelAsk);
    cancelRef.current = cancelAsk;

    // One controller per opening (made in the effect, so a remount gets a fresh one).
    useEffect(() => {
        const context = callAudioContext();
        if (!context) return;
        const call = new VoiceCallController({
            context,
            language: callSpeechLanguage(locale),
            hints: [animalName],
            copy: callCopy(locale),
            ask: (said, onEvent) => askRef.current(said, onEvent),
            cancelAsk: () => cancelRef.current(),
            script: developmentCallScript()
        });
        setController(call);
        call.start();
        return () => call.end();
    }, [animalName, locale]);

    const state = useSyncExternalStore(
        controller?.subscribe ?? noSubscription,
        controller?.snapshot ?? (() => IDLE_STATE),
        () => IDLE_STATE
    );

    const end = useCallback(() => {
        controller?.end();
        onClose();
    }, [controller, onClose]);

    useEffect(() => {
        let cancelled = false;
        void talkingModelSceneUrl(asset.slug).then((url) => {
            if (!url || cancelled) return;
            // Shown once it has arrived, faded in.
            const image = new Image();
            image.onload = () => {
                if (!cancelled) setScene(url);
            };
            image.src = url;
        });
        return () => {
            cancelled = true;
        };
    }, [asset.slug]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") end();
        };
        window.addEventListener("keydown", onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
        };
    }, [end]);

    const voiceDecibels = useCallback(() => controller?.voice.decibels() ?? -120, [controller]);

    const status = (() => {
        if (state.isMuted) return copy.muted;
        switch (state.phase) {
            case "starting":
                return copy.connecting;
            case "listening":
                return state.heard ? copy.tapToSend : copy.listening;
            case "thinking":
                return t(copy.thinking);
            case "speaking":
                return copy.tapToInterrupt;
            case "voiceUsedUp":
                return copy.voiceUsedUp;
            case "failed":
                return state.failure ?? copy.recognitionStopped;
        }
    })();
    const statusTint = state.phase === "failed" || state.phase === "voiceUsedUp"
        ? CAUTION
        : state.phase === "listening" && !state.isMuted
            ? LIME
            : "rgba(255, 255, 255, 0.7)";
    const microphoneLabel = state.phase === "speaking" ? copy.interrupt : state.phase === "listening" ? copy.sendNow : copy.microphone;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t(copy.talkTo)}
            className="theme-dark fixed inset-0 z-[90] overflow-hidden text-white"
            style={{backgroundColor: NEAR_BLACK, colorScheme: "dark"}}
            data-testid="animal-voice-call"
        >
            <CallBackdrop scene={scene} />
            <div className="relative flex h-full flex-col" style={{paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)"}}>
                {/* Top */}
                <div className="flex items-center px-4 pt-1.5">
                    <RoundButton label={copy.endCall} onClick={end}>
                        <ChevronDownIcon size={16} />
                    </RoundButton>
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-2">
                        <p className="max-w-full truncate text-[19px] font-semibold leading-tight text-white">{animalName}</p>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{backgroundColor: LIME, boxShadow: `0 0 6px ${LIME}`}} />
                            <LiveClock startedAt={state.startedAt} format={copy.live} />
                        </div>
                    </div>
                    <RoundButton
                        label={showsCaptions ? copy.hideCaptions : copy.showCaptions}
                        onClick={() => setShowsCaptions((current) => !current)}
                    >
                        <CaptionsIcon size={18} filled={showsCaptions} />
                    </RoundButton>
                </div>

                {/* The animal. The floor and its shadow fade out instead of ending at an edge. */}
                <div
                    className="relative shrink-0"
                    style={{
                        height: "42%",
                        WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                        maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)"
                    }}
                    aria-label={animalName}
                >
                    <TalkingModelView
                        asset={asset}
                        decibels={voiceDecibels}
                        unavailableLabel={t(copy.cantBeShown)}
                        onTap={() => controller?.interrupt()}
                    />
                </div>

                {/* What was said, as a band across the screen: their words, then the animal's. */}
                <div
                    className={`border-y border-white/10 bg-black/[0.28] transition-opacity duration-200 ${showsCaptions ? "opacity-100" : "pointer-events-none h-0 overflow-hidden border-transparent opacity-0"}`}
                    data-testid="animal-voice-call-transcript"
                >
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-5 py-4">
                        {state.heard ? (
                            <div className="flex flex-col gap-[3px]">
                                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-white/45">{copy.you}</p>
                                <p className="line-clamp-2 text-[15px] leading-snug text-white/[0.72]">{state.heard}</p>
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-[3px]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{color: LIME}}>{animalName}</p>
                            {state.spokenWords.length === 0 ? (
                                <p className="line-clamp-4 text-[17px] font-medium leading-snug text-white">
                                    {state.said || t(copy.sayHello)}
                                </p>
                            ) : (
                                <SpokenText words={state.spokenWords} heard={() => controller?.voice.heardSeconds() ?? null} />
                            )}
                        </div>
                        {process.env.NODE_ENV !== "production" && state.timings ? (
                            <p className="text-[10px] tabular-nums text-white/35" data-testid="animal-voice-call-timings">
                                first sound {state.timings.firstSound !== null ? `${state.timings.firstSound.toFixed(1)}s` : "–"} · whole reply {state.timings.reply.toFixed(1)}s
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="min-h-[8px] flex-1" />

                {/* Controls */}
                <div className="flex flex-col items-center gap-1.5 pb-3">
                    <p className="text-sm font-semibold transition-colors" style={{color: statusTint}} role="status" data-testid="animal-voice-call-status">
                        {status}
                    </p>
                    <div className="flex w-full max-w-xl items-center">
                        <div className="flex flex-1 justify-center">
                            <RoundButton
                                label={state.isMuted ? copy.unmute : copy.mute}
                                size={54}
                                highlighted={state.isMuted}
                                onClick={() => controller?.toggleMute()}
                            >
                                <MicSlashIcon size={20} filled={state.isMuted} />
                            </RoundButton>
                        </div>
                        <div className="relative grid h-[210px] w-[210px] shrink-0 place-items-center">
                            <CallWaves
                                level={() => controller?.level() ?? -120}
                                tint={state.phase === "speaking" ? PRIMARY_GREEN : LIME}
                                calm={state.phase === "thinking" || state.phase === "starting"}
                            />
                            <button
                                type="button"
                                onClick={() => controller?.tapMicrophone()}
                                aria-label={microphoneLabel}
                                data-testid="animal-voice-call-microphone"
                                className="relative grid h-[88px] w-[88px] place-items-center rounded-full border border-white/35 text-black/85 transition-transform active:scale-95"
                                style={{
                                    background: state.isMuted
                                        ? "linear-gradient(135deg, rgb(89, 89, 89), rgb(56, 56, 56))"
                                        : `linear-gradient(135deg, ${LIME}, ${PRIMARY_GREEN})`,
                                    boxShadow: state.isMuted ? "none" : "0 0 36px rgba(167, 244, 50, 0.45)"
                                }}
                            >
                                {state.isMuted
                                    ? <MicSlashIcon size={30} filled />
                                    : state.phase === "speaking"
                                        ? <HandIcon size={30} />
                                        : state.phase === "thinking" || state.phase === "starting"
                                            ? <EllipsisIcon size={30} />
                                            : <MicIcon size={30} />}
                            </button>
                        </div>
                        <div className="flex flex-1 justify-center">
                            <RoundButton label={copy.endCall} size={54} tint={END_RED} onClick={end}>
                                <XMarkIcon size={20} />
                            </RoundButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoundButton({
    label,
    onClick,
    children,
    size = 40,
    tint,
    highlighted = false
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    size?: number;
    tint?: string;
    highlighted?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="grid shrink-0 place-items-center rounded-full transition-colors"
            style={{
                width: size,
                height: size,
                color: highlighted ? "#000" : "#fff",
                backgroundColor: tint ?? (highlighted ? "#fff" : "rgba(255, 255, 255, 0.10)"),
                border: tint ? "none" : "1px solid rgba(255, 255, 255, 0.14)"
            }}
        >
            {children}
        </button>
    );
}

function LiveClock({startedAt, format}: {startedAt: number; format: string}) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <span className="text-[13px] font-medium tabular-nums text-white/70">
            {format.replace("{clock}", callClock((now - startedAt) / 1000))}
        </span>
    );
}

/**
 * The animal's answer as it is spoken: each word lights up as it is heard,
 * the words already said stay bright and those to come are dim, and the
 * text scrolls to keep the word being said in view, however long it runs.
 */
function SpokenText({words, heard}: {words: CallSpokenWord[]; heard: () => number | null}) {
    const [current, setCurrent] = useState(-1);
    const [finished, setFinished] = useState(false);
    const currentRef = useRef(-1);
    const finishedRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const wordsRef = useRef(words);
    wordsRef.current = words;
    const heardRef = useRef(heard);
    heardRef.current = heard;

    // Follows the voice every frame; a word changes a few times a second.
    useEffect(() => {
        let frame = 0;
        const follow = () => {
            frame = requestAnimationFrame(follow);
            const seconds = heardRef.current();
            if (seconds === null) {
                // The voice has stopped (finished or interrupted): all of it stands.
                if (currentRef.current >= 0 && !finishedRef.current) {
                    finishedRef.current = true;
                    setFinished(true);
                }
                return;
            }
            if (finishedRef.current) {
                finishedRef.current = false;
                setFinished(false);
            }
            const index = callSpokenIndex(wordsRef.current, seconds);
            if (index !== currentRef.current) {
                currentRef.current = index;
                setCurrent(index);
            }
        };
        frame = requestAnimationFrame(follow);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (current < 0) return;
        const box = scrollRef.current;
        const word = box?.querySelector<HTMLElement>(`[data-word="${current}"]`);
        if (!box || !word) return;
        box.scrollTo({top: word.offsetTop - box.clientHeight / 2 + word.offsetHeight / 2, behavior: "smooth"});
    }, [current]);

    return (
        <div ref={scrollRef} className="relative max-h-[100px] overflow-hidden" data-testid="animal-voice-call-words">
            {/* A normal space between words; the highlight reaches past the word without pushing its neighbours away. */}
            <p className="flex flex-wrap gap-x-[4.5px] py-0.5 text-[17px] font-medium leading-snug">
                {words.map((word, index) => (
                    <span
                        key={index}
                        data-word={index}
                        className="relative transition-colors duration-100"
                        style={{color: finished || index <= current ? "#fff" : "rgba(255, 255, 255, 0.45)"}}
                    >
                        {index === current ? (
                            <span aria-hidden="true" className="absolute -inset-x-[3px] -inset-y-px rounded-[2px]" style={{backgroundColor: "rgba(167, 244, 50, 0.28)"}} />
                        ) : null}
                        <span className="relative">{word.text}</span>
                    </span>
                ))}
            </p>
        </div>
    );
}

/** Rings of sound round the microphone that swell and ripple with how loud the voice is; slow and small while the animal thinks. */
function CallWaves({level, tint, calm}: {level: () => number; tint: string; calm: boolean}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const props = useRef({level, tint, calm});
    props.current = {level, tint, calm};

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const meter = new WaveMeter();
        const size = 210;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = size * ratio;
        canvas.height = size * ratio;
        let frame = 0;
        const draw = () => {
            frame = requestAnimationFrame(draw);
            const {level: read, tint: color, calm: isCalm} = props.current;
            const time = performance.now() / 1000;
            const loud = isCalm ? 0.12 + 0.08 * Math.sin(time * 2.2) : meter.update(read(), time);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, size, size);
            const center = size / 2;
            const orb = 44;
            // A soft glow that breathes with the voice.
            const glow = orb * (1.05 + 0.55 * loud);
            const gradient = context.createRadialGradient(center, center, Math.max(glow - 22, 0), center, center, glow + 22);
            gradient.addColorStop(0, withAlpha(color, 0.30 + 0.35 * loud));
            gradient.addColorStop(1, withAlpha(color, 0));
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(center, center, glow + 22, 0, Math.PI * 2);
            context.fill();
            for (let ring = 0; ring < 4; ring++) {
                const base = orb + 10 + ring * 13;
                const swell = (3 + 26 * loud) * (1 - ring * 0.16);
                context.beginPath();
                for (let step = 0; step <= 120; step++) {
                    const a = step / 120 * 2 * Math.PI;
                    const ripple = 0.5 * Math.sin(3 * a + time * 1.9 + ring)
                        + 0.3 * Math.sin(5 * a - time * 2.7 + ring * 1.7)
                        + 0.2 * Math.sin(2 * a + time * 1.1 - ring);
                    const r = base + swell * (0.55 + 0.45 * ripple);
                    const x = center + r * Math.cos(a);
                    const y = center + r * Math.sin(a);
                    if (step === 0) context.moveTo(x, y);
                    else context.lineTo(x, y);
                }
                context.closePath();
                context.strokeStyle = withAlpha(color, (0.55 - ring * 0.11) * (0.55 + 0.45 * loud));
                context.lineWidth = 2 - ring * 0.35;
                context.stroke();
            }
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, []);

    return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-[210px] w-[210px]" />;
}

function withAlpha(hex: string, alpha: number): string {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * Behind the animal: where it lives, softly out of focus, fading to near
 * black where the words and the controls are; the green studio until the
 * scene arrives, or when it has none. The scene's ground (the lower third of
 * each) lands where the animal stands.
 */
function CallBackdrop({scene}: {scene: string | null}) {
    return (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
                className="absolute inset-0"
                style={{
                    background: [
                        "radial-gradient(280px circle at 50% 26%, rgba(167, 244, 50, 0.16), transparent)",
                        `linear-gradient(to bottom, #1F7A42 0%, #0F4426 22%, #0A2615 42%, ${NEAR_BLACK} 62%, #040906 100%)`
                    ].join(", ")
                }}
            />
            <div className={`absolute inset-x-0 top-0 h-[62%] transition-opacity duration-[400ms] ${scene ? "opacity-100" : "opacity-0"}`}>
                {scene ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.18) 14%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.1) 70%, ${NEAR_BLACK} 100%)`
                    }}
                />
            </div>
        </div>
    );
}
