"use client";

import {type CSSProperties, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import BattleTierChip from "@/app/[locale]/(composited)/animals/battle-tier-chip";
import SystemWaveform from "@/components/animal-detail/system-dynamics/system-waveform";
import {FrequencyStateChip} from "@/components/animal-detail/system-dynamics/frequency-chip";
import {getBattleTier} from "@/lib/battle-tier";
import {behaviorCompactTitle, resolveVisualSignature} from "@/lib/system-dynamics";
import {
    WELCOME_INTRO_BEATS,
    WELCOME_INTRO_VOICEOVER,
    WELCOME_STAT_METRICS,
    type WelcomeIntroAnimal,
    type WelcomeIntroBeat,
    type WelcomeIntroStrings,
    type WelcomeSystemStory,
    type WelcomeTrialStory,
    type WelcomeVoiceSource,
    localizeWelcomeLineup,
    selectWelcomeCues,
    welcomeCardLabel,
    welcomeDomainTitle,
    welcomeLanguageIsRTL,
    welcomeLanguageTag,
    welcomeLanguageUsesTracking,
    welcomeSystemDynamics,
    welcomeText,
    welcomeVoiceClip
} from "@/lib/welcome-intro";

/**
 * The looping "spot → collect → learn" card on the sign-in page, ported from
 * iOS `WelcomeIntroStage`. Same lineup, timings, voiceover and cue points.
 *
 * Web differences, all forced by the browser: sound starts off (audio cannot
 * play before the visitor interacts with the page), so the page's sound button
 * turns it on, which restarts the current card so the voice lines up with it;
 * and "reduce motion" comes from the `prefers-reduced-motion` media query.
 *
 * Language (CONTRACT.md in the app's docs/welcome-voiceover): the text comes
 * from `strings`, already selected for one language on the server. English
 * plays its bundled clips at the lineup's cue times; another language streams
 * its clips from storage and steps on the manifest's cues and durations, or
 * runs silently when it has no audio. English audio never plays under
 * another language's text.
 */

const NEON = "#A7F432";
const NEAR_BLACK = "#070A08";
const CARD_FILL = `linear-gradient(180deg, #10261A, ${NEAR_BLACK})`;
/** iOS's largest card height; smaller cards are this layout scaled down. */
const DESIGN_HEIGHT = 340;

type Sfx = "camera_shutter" | "reward_points" | "reward_credits" | "train_complete";

/** The trial's proof frames: iOS draws SF Symbols, the web stands in with emoji. */
const PROOF_FRAMES = ["🧍", "🤸", "👍"];

/** The intro's on-screen strings for one language; English keys, English fallback. */
const WelcomeTextContext = createContext<WelcomeIntroStrings>({});

function useWelcomeText() {
    const strings = useContext(WelcomeTextContext);
    return useCallback((key: string) => welcomeText(strings, key), [strings]);
}

function sleep(ms: number, isCancelled: () => boolean) {
    return new Promise<boolean>((resolve) => {
        window.setTimeout(() => resolve(!isCancelled()), Math.max(0, ms));
    });
}

/** A clip that started: how long it runs, and its cues when the manifest gives them. */
type SpokenClip = {duration: number | null; cues: number[] | null};

/** Plays the welcome voiceover and sound effects; silent when the browser refuses or the language has no audio. */
function useWelcomeAudio(source: WelcomeVoiceSource) {
    const voice = useRef<HTMLAudioElement | null>(null);
    const sourceRef = useRef(source);
    sourceRef.current = source;

    const stop = useCallback(() => {
        voice.current?.pause();
        voice.current = null;
    }, []);

    /** Starts a clip; resolves with its timing, or null when it can't play. */
    const playVoice = useCallback(async (name: string): Promise<SpokenClip | null> => {
        stop();
        const clip = welcomeVoiceClip(sourceRef.current, name);
        if (!clip) return null;
        const audio = new Audio(clip.url);
        audio.preload = "auto";
        voice.current = audio;
        try {
            await audio.play();
        } catch {
            if (voice.current === audio) voice.current = null;
            return null;
        }
        // A translated clip's timing is the manifest's, measured when it was generated.
        if (clip.duration != null) return {duration: clip.duration, cues: clip.cues};
        if (Number.isFinite(audio.duration) && audio.duration > 0) return {duration: audio.duration, cues: null};
        // Playing but the length isn't known yet: wait briefly for it.
        return new Promise((resolve) => {
            const done = () => resolve({duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null, cues: null});
            audio.addEventListener("loadedmetadata", done, {once: true});
            window.setTimeout(done, 1500);
        });
    }, [stop]);

    const playSfx = useCallback((name: Sfx) => {
        const audio = new Audio(`/audio/welcome/${name}.wav`);
        audio.volume = 0.7;
        void audio.play().catch(() => undefined);
    }, []);

    useEffect(() => stop, [stop]);

    return {playVoice, playSfx, stop};
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    return reduced;
}

export default function WelcomeIntroStage({
    muted,
    soundGeneration,
    cardHeight = 340,
    language = "en",
    strings = {},
    voice = {kind: "bundled"}
}: {
    muted: boolean;
    /** Bumped when sound is turned on: the current card restarts so its voice lines up. */
    soundGeneration: number;
    cardHeight?: number;
    /** The language the card reads and speaks in. Remount (key) the stage to change it: the loop restarts at card 1. */
    language?: string;
    /** That language's strings only, English underneath. */
    strings?: WelcomeIntroStrings;
    voice?: WelcomeVoiceSource;
}) {
    const reduceMotion = usePrefersReducedMotion();
    const {playVoice, playSfx, stop} = useWelcomeAudio(voice);
    const lineup = useMemo(() => localizeWelcomeLineup(strings), [strings]);

    const [index, setIndex] = useState(0);
    const [beat, setBeat] = useState<WelcomeIntroBeat>("spot");
    /** Restarts the current beat's progress fill; `seconds` is how long it takes. */
    const [beatRun, setBeatRun] = useState({key: 0, seconds: 1.3});
    const [revealed, setRevealed] = useState(false);
    const [flipped, setFlipped] = useState(false);
    const [bloom, setBloom] = useState(false);
    const [shine, setShine] = useState(false);
    const [scanSweep, setScanSweep] = useState(false);
    const [scanSeconds, setScanSeconds] = useState(1.3);
    const [cardVisible, setCardVisible] = useState(true);
    const [showForYou, setShowForYou] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [statsGrow, setStatsGrow] = useState(0);
    const [domainIndex, setDomainIndex] = useState(-1);
    const [trialStage, setTrialStage] = useState(-1);

    const indexRef = useRef(0);
    /** Voice and sound play on the first lap after sound is turned on, never after. */
    const lapsRef = useRef(0);
    const startApplied = useRef(false);
    const mutedRef = useRef(muted);
    mutedRef.current = muted;

    const animal = lineup[index];
    // The card is laid out at iOS's largest size and scaled to fit, the way
    // iOS shrinks its text to fit: every card keeps its proportions at any height.
    const scale = cardHeight / DESIGN_HEIGHT;
    const designWidth = Math.round(DESIGN_HEIGHT * 0.74);

    useEffect(() => {
        if (muted) stop();
    }, [muted, stop]);

    useEffect(() => {
        // Turning sound on starts a fresh first lap from the card on screen.
        lapsRef.current = 0;
    }, [soundGeneration]);

    useEffect(() => {
        let cancelled = false;
        const isCancelled = () => cancelled;
        const pause = (seconds: number) => sleep(seconds * 1000, isCancelled);
        const speaks = () => !mutedRef.current && lapsRef.current === 0;
        const sfx = (name: Sfx) => {
            if (speaks()) playSfx(name);
        };
        const startBeat = (next: WelcomeIntroBeat, seconds: number) => {
            setBeat(next);
            setBeatRun((run) => ({key: run.key + 1, seconds}));
        };
        const remaining = (spoken: SpokenClip | null, start: number) =>
            spoken?.duration == null ? 0 : Math.max(0, spoken.duration - (performance.now() - start) / 1000);
        const voicesOnLessonSide = (current: WelcomeIntroAnimal) => Boolean(current.system || current.trial);

        async function runSystemLesson(current: WelcomeIntroAnimal, story: WelcomeSystemStory) {
            const start = performance.now();
            const spoken = speaks() ? await playVoice(current.voiceover) : null;
            const cues = selectWelcomeCues({spoken: spoken != null, englishCues: story.cueSeconds, clipCues: spoken?.cues ?? null, silentCues: [1.6, 4.4, 7.2]});
            const total = Math.max((spoken?.duration ?? 0) + 0.8, (cues[cues.length - 1] ?? 0) + 3.2);
            startBeat("learn", total);
            for (let i = 0; i < cues.length; i += 1) {
                const cue = cues[i];
                if (!(await pause(cue - (performance.now() - start) / 1000))) return;
                setDomainIndex(i);
            }
            await pause(total - (performance.now() - start) / 1000);
        }

        async function runTrialLesson(current: WelcomeIntroAnimal, trial: WelcomeTrialStory) {
            const start = performance.now();
            window.setTimeout(() => !cancelled && setShowForYou(true), 600);
            const spoken = speaks() ? await playVoice(current.voiceover) : null;
            const cues = selectWelcomeCues({spoken: spoken != null, englishCues: trial.cueSeconds, clipCues: spoken?.cues ?? null, silentCues: [3.2, 5.6, 8.0, 9.8]});
            const total = Math.max((spoken?.duration ?? 0) + 1.2, (cues[cues.length - 1] ?? 0) + 3.0);
            startBeat("learn", total);
            for (let i = 0; i < cues.length; i += 1) {
                const cue = cues[i];
                if (!(await pause(cue - (performance.now() - start) / 1000))) return;
                setTrialStage(i);
                if (i === 3) sfx("reward_credits");
            }
            await pause(total - (performance.now() - start) / 1000);
        }

        async function runLesson(current: WelcomeIntroAnimal) {
            if (current.system) await runSystemLesson(current, current.system);
            else if (current.trial) await runTrialLesson(current, current.trial);
        }

        /** Reduce motion: no sweep, flip or tilt; the collected card, then the lesson. */
        async function runStillBeat(current: WelcomeIntroAnimal) {
            setRevealed(true);
            setFlipped(false);
            setCardVisible(true);
            setBeat("collect");
            setBeatRun((run) => ({key: run.key + 1, seconds: 0}));
            setStatsGrow(1);
            setShowStats(true);
            setDomainIndex(-1);
            setTrialStage(-1);
            const voiceStart = performance.now();
            const spoken = speaks() && !voicesOnLessonSide(current) ? await playVoice(current.voiceover) : null;
            if (!(await pause(3.0))) return;
            setShowStats(false);
            setFlipped(true);
            setShowForYou(true);
            setBeat("learn");
            if (voicesOnLessonSide(current)) {
                await runLesson(current);
            } else if (!(await pause(Math.max(4.5, remaining(spoken, voiceStart) + 0.6)))) {
                return;
            }
            if (cancelled) return;
            setShowForYou(false);
            setCardVisible(false);
            if (!(await pause(0.35))) return;
            setFlipped(false);
            setCardVisible(true);
        }

        async function runAnimatedBeat(current: WelcomeIntroAnimal, cardIndex: number) {
            // Reset to a silhouette under the brackets.
            setRevealed(false);
            setFlipped(false);
            setScanSweep(false);
            setShine(false);
            setShowForYou(false);
            setShowStats(false);
            setStatsGrow(0);
            setDomainIndex(-1);
            setTrialStage(-1);

            // First card of the first lap: the intro line plays over a longer scan.
            let scan = 1.3;
            if (speaks() && cardIndex === 0) {
                const intro = await playVoice(WELCOME_INTRO_VOICEOVER);
                if (intro?.duration != null) scan = Math.max(scan, intro.duration + 0.2);
            }
            // One frame at the reset state, so the sweep and the slide-in animate.
            if (!(await pause(0.03))) return;

            setCardVisible(true);
            setScanSeconds(scan);
            startBeat("spot", scan);
            setScanSweep(true);
            if (!(await pause(scan))) return;

            // Snap.
            sfx("camera_shutter");
            setBloom(true);
            if (!(await pause(0.08))) return;
            setRevealed(true);
            setBloom(false);
            setShine(true);
            startBeat("collect", 4.0);
            if (!(await pause(0.25))) return;
            sfx("reward_points");
            if (!(await pause(0.75))) return;

            // Stats draw over the animal; the voice starts on what they say.
            setShowStats(true);
            setStatsGrow(1);
            // System Dynamics and Trial cards hold their voice for the lesson side,
            // where the wave, domains and evidence it talks about are on screen.
            const voiceStart = performance.now();
            const spoken = speaks() && !voicesOnLessonSide(current) ? await playVoice(current.voiceover) : null;
            if (!(await pause(3.0 - (performance.now() - voiceStart) / 1000))) return;

            // Flip to the lesson.
            setShowStats(false);
            setFlipped(true);
            if (!(await pause(0.3))) return;
            if (voicesOnLessonSide(current)) {
                await runLesson(current);
                if (cancelled) return;
                setCardVisible(false);
                await pause(0.34);
                return;
            }
            if (spoken == null) sfx("train_complete");
            // Long enough to read both lines, or to hear the voice finish.
            const hold = Math.max(4.2, remaining(spoken, voiceStart) + 0.6);
            startBeat("learn", hold);
            if (!(await pause(0.9))) return;
            setShowForYou(true);
            if (!(await pause(hold - 0.9))) return;

            // Slide away; the next animal comes in.
            setCardVisible(false);
            await pause(0.34);
        }

        async function runLoop() {
            // Dev only, like iOS's -AnimalDexWelcomeGalleryStart: ?welcomeCard=<n> starts on card n.
            if (process.env.NODE_ENV !== "production" && !startApplied.current) {
                startApplied.current = true;
                const start = Number(new URLSearchParams(window.location.search).get("welcomeCard"));
                if (Number.isInteger(start) && start > 0 && start < lineup.length) {
                    indexRef.current = start;
                    setIndex(start);
                }
            }
            while (!cancelled) {
                const cardIndex = indexRef.current;
                const current = lineup[cardIndex];
                if (reduceMotion) await runStillBeat(current);
                else await runAnimatedBeat(current, cardIndex);
                if (cancelled) return;
                const next = (cardIndex + 1) % lineup.length;
                if (next === 0) lapsRef.current += 1;
                indexRef.current = next;
                setIndex(next);
            }
        }

        void runLoop();
        return () => {
            cancelled = true;
            stop();
        };
    }, [reduceMotion, soundGeneration, playVoice, playSfx, stop, lineup]);

    const motion = !reduceMotion;
    const tier = getBattleTier(animal.stats);

    return (
        <WelcomeTextContext.Provider value={strings}>
            <div
                lang={welcomeLanguageTag(language)}
                dir={welcomeLanguageIsRTL(language) ? "rtl" : "ltr"}
                data-welcome-tracking={welcomeLanguageUsesTracking(language) ? undefined : "off"}
                className="flex flex-col items-center gap-6"
            >
                <div
                    className="relative"
                    style={{width: (designWidth + 40) * scale, height: (DESIGN_HEIGHT + 16) * scale}}
                    role="img"
                    aria-label={welcomeCardLabel(animal)}
                >
                  <div
                    className="absolute left-0 top-0"
                    style={{width: designWidth + 40, height: DESIGN_HEIGHT + 16, transform: `scale(${scale})`, transformOrigin: "0 0", perspective: 1100}}
                  >
                    <StackShadows width={designWidth} height={DESIGN_HEIGHT} />

                    {/* Slide in and out between animals. */}
                    <div
                        className="absolute left-5 top-2"
                        style={{
                            width: designWidth,
                            height: DESIGN_HEIGHT,
                            opacity: cardVisible ? 1 : 0,
                            transform: `translateX(${cardVisible ? 0 : -designWidth * 0.35}px) scale(${cardVisible ? 1 : 0.92})`,
                            transition: motion ? "opacity 320ms ease, transform 550ms cubic-bezier(.2,.9,.3,1.1)" : "none",
                            filter: "drop-shadow(0 22px 30px rgba(0,0,0,0.55))"
                        }}
                    >
                        {/* A slow idle tilt, so the card feels like an object in the hand. */}
                        <div className={`h-full w-full ${motion ? "welcome-card-drift" : ""}`} style={{transformStyle: "preserve-3d"}}>
                            <div
                                className="relative h-full w-full"
                                style={{
                                    transformStyle: "preserve-3d",
                                    transform: `rotateY(${flipped ? 180 : 0}deg)`,
                                    transition: motion ? "transform 800ms cubic-bezier(.25,.9,.3,1)" : "none"
                                }}
                            >
                                <CardFront
                                    animal={animal}
                                    tier={tier}
                                    cardHeight={DESIGN_HEIGHT}
                                    revealed={revealed}
                                    bloom={bloom}
                                    shine={shine}
                                    scanSweep={scanSweep}
                                    scanSeconds={scanSeconds}
                                    showStats={showStats}
                                    statsGrow={statsGrow}
                                    motion={motion}
                                />
                                <CardBack
                                    animal={animal}
                                    tier={tier}
                                    flipped={flipped}
                                    showForYou={showForYou}
                                    domainIndex={domainIndex}
                                    trialStage={trialStage}
                                    motion={motion}
                                />
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                <BeatRail beat={beat} run={beatRun} width={(designWidth + 24) * scale} />
            </div>
        </WelcomeTextContext.Provider>
    );
}

// MARK: - Card faces

const FACE_STYLE: CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    background: CARD_FILL
};

function StackShadows({width, height}: {width: number; height: number}) {
    return (
        <>
            {[2, 1].map((step) => (
                <div
                    key={step}
                    aria-hidden="true"
                    className="absolute left-5 top-2 border"
                    style={{
                        width,
                        height,
                        backgroundColor: "rgba(255,255,255,0.035)",
                        borderColor: "rgba(255,255,255,0.08)",
                        transform: `translate(${step * 9}px, ${step * 3}px) rotate(${step * 4}deg) scale(${1 - step * 0.05})`
                    }}
                />
            ))}
        </>
    );
}

function DexNumber({value}: {value: number}) {
    return (
        <span className="pointer-events-none absolute left-3.5 top-3 font-display text-[15px] font-bold tabular-nums tracking-[0.04em] text-white/70">
            #{String(value).padStart(3, "0")}
        </span>
    );
}

function TierCorner({tier}: {tier: ReturnType<typeof getBattleTier>}) {
    return (
        <span className="pointer-events-none absolute right-2.5 top-2">
            <BattleTierChip tier={tier} compact />
        </span>
    );
}

function CardFront({
    animal,
    tier,
    cardHeight,
    revealed,
    bloom,
    shine,
    scanSweep,
    scanSeconds,
    showStats,
    statsGrow,
    motion
}: {
    animal: WelcomeIntroAnimal;
    tier: ReturnType<typeof getBattleTier>;
    cardHeight: number;
    revealed: boolean;
    bloom: boolean;
    shine: boolean;
    scanSweep: boolean;
    scanSeconds: number;
    showStats: boolean;
    statsGrow: number;
    motion: boolean;
}) {
    const t = useWelcomeText();
    const ease = (ms: number, what = "all") => (motion ? `${what} ${ms}ms ease` : "none");

    return (
        <div className="absolute inset-0 overflow-hidden" style={FACE_STYLE}>
            {/* The soft spotlight the animal stands in. */}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 50% 42%, rgba(167,244,50,${revealed ? 0.2 : 0.05}), transparent ${Math.round(cardHeight * 0.5)}px)`,
                    transition: ease(500, "background")
                }}
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/images/welcome/${animal.image}.webp`}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                    padding: `${cardHeight * 0.09}px ${cardHeight * 0.07}px ${cardHeight * 0.22}px`,
                    // Silhouette until the shutter fires.
                    filter: revealed ? "brightness(1) drop-shadow(0 10px 14px rgba(0,0,0,0.45))" : "brightness(0.03)",
                    opacity: revealed ? (showStats ? 0.22 : 1) : 0.9,
                    transform: `scale(${revealed ? 1 : 0.95})`,
                    transition: motion ? "filter 450ms ease, opacity 250ms ease, transform 500ms cubic-bezier(.2,.9,.3,1.2)" : "none"
                }}
            />

            {!revealed ? (
                <>
                    <ScanBrackets active={scanSweep} seconds={scanSeconds} motion={motion} />
                    <div
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0"
                        style={{
                            transform: `translateY(${scanSweep ? cardHeight - 45 : -45}px)`,
                            transition: motion ? `transform ${scanSeconds}s ease-in-out` : "none"
                        }}
                    >
                        <div className="h-11" style={{background: "linear-gradient(180deg, rgba(167,244,50,0), rgba(167,244,50,0.18))"}} />
                        <div className="h-px" style={{backgroundColor: "rgba(167,244,50,0.9)"}} />
                    </div>
                </>
            ) : null}

            <div
                className="absolute inset-x-4 bottom-4 flex flex-col gap-1"
                style={{opacity: revealed ? 1 : 0, transform: `translateY(${revealed ? 0 : 8}px)`, transition: ease(400)}}
            >
                <span className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{color: NEON}}>{t("Collected")}</span>
                <span className="truncate font-display text-[21px] font-bold leading-tight text-white">{animal.name}</span>
            </div>

            <WelcomeStatPentagon
                animal={animal}
                progress={statsGrow}
                visible={showStats}
                cardHeight={cardHeight}
                motion={motion}
            />

            {revealed ? (
                <>
                    <DexNumber value={animal.dexNumber} />
                    <TierCorner tier={tier} />
                </>
            ) : null}

            {/* Shutter bloom: a quick soft light from the centre. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                    background: "radial-gradient(circle at center, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
                    opacity: bloom ? 1 : 0,
                    transition: motion ? `opacity ${bloom ? 70 : 500}ms ease-out` : "none"
                }}
            />

            {/* One diagonal glint across the card as it's collected. */}
            {motion ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-y-1/4 w-[45%] mix-blend-plus-lighter"
                    style={{
                        background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))",
                        transform: `translateX(${shine ? "330%" : "-180%"}) rotate(20deg)`,
                        transition: shine ? "transform 900ms ease-in-out 150ms" : "none"
                    }}
                />
            ) : null}

            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border"
                style={{borderColor: revealed ? "rgba(167,244,50,0.55)" : "rgba(255,255,255,0.12)", transition: ease(400, "border-color")}}
            />
        </div>
    );
}

function ScanBrackets({active, seconds, motion}: {active: boolean; seconds: number; motion: boolean}) {
    // Four corner brackets, the same mark as the capture viewfinder.
    const corners = [
        "left-4 top-4 border-l-2 border-t-2",
        "right-4 top-4 border-r-2 border-t-2",
        "bottom-4 right-4 border-b-2 border-r-2",
        "bottom-4 left-4 border-b-2 border-l-2"
    ];
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
                opacity: active ? 1 : 0.3,
                transform: `scale(${active ? 1 : 1.1})`,
                transition: motion ? `opacity ${seconds}s ease-in-out, transform ${seconds}s ease-in-out` : "none"
            }}
        >
            {corners.map((corner) => (
                <span key={corner} className={`absolute h-[18px] w-[18px] ${corner}`} style={{borderColor: NEON}} />
            ))}
        </div>
    );
}

/** The same five stats, order and colours as the species page radar, sized to sit over the animal. */
function WelcomeStatPentagon({
    animal,
    progress,
    visible,
    cardHeight,
    motion
}: {
    animal: WelcomeIntroAnimal;
    progress: number;
    visible: boolean;
    cardHeight: number;
    motion: boolean;
}) {
    const size = 200;
    const center = {x: size / 2, y: size / 2 + 4};
    const radius = size * 0.3;
    const point = (r: number, i: number) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return {x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r};
    };
    const polygon = (values: number[], r: number) =>
        values.map((value, i) => point((r * Math.max(0, Math.min(100, value))) / 100, i)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const metrics = WELCOME_STAT_METRICS.map((metric) => ({...metric, value: animal.stats[metric.key]}));
    const gradientId = `welcome-pentagon-${animal.image}`;

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0"
            style={{
                top: cardHeight * 0.1,
                bottom: cardHeight * 0.24,
                paddingInline: cardHeight * 0.06,
                opacity: visible ? 1 : 0,
                transition: motion ? "opacity 250ms ease" : "none"
            }}
        >
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full overflow-visible">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(167,244,50,0.35)" />
                        <stop offset="100%" stopColor="rgba(148,84,250,0.25)" />
                    </linearGradient>
                </defs>
                {[1, 2, 3, 4].map((level) => (
                    <polygon
                        key={level}
                        points={polygon([100, 100, 100, 100, 100], (radius * level) / 4)}
                        fill="none"
                        stroke={`rgba(255,255,255,${level === 4 ? 0.22 : 0.09})`}
                        strokeWidth={0.75}
                    />
                ))}
                {metrics.map((_, i) => {
                    const end = point(radius, i);
                    return <line key={i} x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.1)" strokeWidth={0.75} />;
                })}
                <g
                    style={{
                        transform: `scale(${progress})`,
                        transformOrigin: `${center.x}px ${center.y}px`,
                        transition: motion ? "transform 800ms cubic-bezier(.2,.9,.3,1.15)" : "none"
                    }}
                >
                    <polygon points={polygon(metrics.map((metric) => metric.value), radius)} fill={`url(#${gradientId})`} stroke={NEON} strokeWidth={1.5} strokeLinejoin="round" />
                </g>
                {metrics.map((metric, i) => {
                    const isKey = animal.keyStats.includes(metric.key);
                    const at = point(radius + 20, i);
                    return (
                        <g key={metric.key} fill={isKey ? metric.tint : "rgba(255,255,255,0.55)"} textAnchor="middle">
                            <text x={at.x} y={at.y - (isKey ? 7 : 5)} fontSize={8} fontWeight={700} letterSpacing={1}>{metric.shortTitle}</text>
                            <text x={at.x} y={at.y + (isKey ? 11 : 8)} fontSize={isKey ? 18 : 13} fontWeight={700} className="font-display">{metric.value}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function KeyStatChips({animal}: {animal: WelcomeIntroAnimal}) {
    const metrics = WELCOME_STAT_METRICS.filter((metric) => animal.keyStats.includes(metric.key));
    return (
        <div className="flex justify-center gap-1.5">
            {metrics.map((metric) => (
                <span
                    key={metric.key}
                    className="inline-flex items-center gap-1 border px-2 py-[3px]"
                    style={{color: metric.tint, borderColor: `color-mix(in srgb, ${metric.tint} 60%, transparent)`}}
                >
                    <span className="text-[9px] font-bold tracking-[0.12em]">{metric.shortTitle}</span>
                    <span className="font-display text-[13px] font-bold tabular-nums">{animal.stats[metric.key]}</span>
                </span>
            ))}
        </div>
    );
}

function PowerEyebrow({children}: {children: string}) {
    return (
        <p className="truncate text-center text-[9px] font-bold uppercase tracking-[0.24em]" style={{color: NEON}}>
            {children}
        </p>
    );
}

function CardBack({
    animal,
    tier,
    flipped,
    showForYou,
    domainIndex,
    trialStage,
    motion
}: {
    animal: WelcomeIntroAnimal;
    tier: ReturnType<typeof getBattleTier>;
    flipped: boolean;
    showForYou: boolean;
    domainIndex: number;
    trialStage: number;
    motion: boolean;
}) {
    return (
        <div className="absolute inset-0 overflow-hidden" style={{...FACE_STYLE, transform: "rotateY(180deg)"}}>
            {/* The animal, ghosted large behind the lesson. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/images/welcome/${animal.image}.webp`}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain p-[4%] opacity-[0.09] grayscale"
            />

            {animal.system ? (
                <SystemLesson animal={animal} story={animal.system} flipped={flipped} domainIndex={domainIndex} motion={motion} />
            ) : animal.trial && trialStage >= 0 ? (
                <TrialFlow animal={animal} trial={animal.trial} stage={trialStage} motion={motion} />
            ) : (
                <PlainLesson animal={animal} showForYou={showForYou} motion={motion} />
            )}

            <DexNumber value={animal.dexNumber} />
            <TierCorner tier={tier} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 border" style={{borderColor: "rgba(167,244,50,0.55)"}} />
        </div>
    );
}

function PlainLesson({animal, showForYou, motion}: {animal: WelcomeIntroAnimal; showForYou: boolean; motion: boolean}) {
    const t = useWelcomeText();
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-[18px] pb-4 pt-[38px] text-center">
            <PowerEyebrow>{animal.power}</PowerEyebrow>
            <KeyStatChips animal={animal} />
            <p className="font-display text-[32px] font-black leading-[0.95] text-white">{animal.motto}</p>
            {/* The motto in the reader's own life. */}
            <div
                className="mt-1 flex flex-col gap-1"
                style={{opacity: showForYou ? 1 : 0, transform: `translateY(${showForYou ? 0 : 6}px)`, transition: motion ? "all 450ms ease-out" : "none"}}
            >
                <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-white/45">{t("For you")}</span>
                <span className="text-[13px] font-semibold leading-snug text-white/90">{animal.forYou}</span>
            </div>
        </div>
    );
}

/** Motto, the animal's frequency wave, then where the same pattern shows up in human life. */
function SystemLesson({
    animal,
    story,
    flipped,
    domainIndex,
    motion
}: {
    animal: WelcomeIntroAnimal;
    story: WelcomeSystemStory;
    flipped: boolean;
    domainIndex: number;
    motion: boolean;
}) {
    const strings = useContext(WelcomeTextContext);
    const dynamics = useMemo(() => welcomeSystemDynamics(story), [story]);
    const signature = useMemo(() => (dynamics ? resolveVisualSignature(dynamics) : null), [dynamics]);
    if (!dynamics || !signature) return <PlainLesson animal={animal} showForYou motion={motion} />;
    const modes = dynamics.frequencyProfile.modes.filter((mode) => mode.frequency !== "UNKNOWN");
    const line = story.domains[domainIndex];

    return (
        <div className="absolute inset-0 flex flex-col items-center gap-[9px] px-4 pb-3.5 pt-[38px] text-center">
            <PowerEyebrow>{animal.power}</PowerEyebrow>
            <KeyStatChips animal={animal} />
            <p className="font-display text-[22px] font-black leading-[1.02] text-white">{animal.motto}</p>

            <div className="flex w-full flex-col items-center gap-1">
                <div className="flex items-center gap-[5px]">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/50">
                        {behaviorCompactTitle(dynamics.frequencyProfile.behavior)}
                    </span>
                    {modes.map((mode, i) => (
                        <span key={`${mode.frequency}-${i}`} className="flex items-center gap-[5px]">
                            {i > 0 ? <span aria-hidden="true" className="text-[8px] font-bold text-white/40">→</span> : null}
                            <FrequencyStateChip frequency={mode.frequency} />
                        </span>
                    ))}
                </div>
                {/* Drawn on, left to right, once the card has flipped to this side. */}
                {flipped ? (
                    <div
                        className={`h-11 w-full overflow-hidden [&_svg]:!h-11 ${motion ? "welcome-wave-draw" : ""}`}
                    >
                        <SystemWaveform signature={signature} fallbackWaveform={dynamics.waveform} style="compact" />
                    </div>
                ) : (
                    <div className="h-11" />
                )}
            </div>

            <div className="flex w-full flex-1 flex-col items-center">
                {line ? (
                    <div key={domainIndex} className={`flex flex-col gap-1 ${motion ? "welcome-rise-in" : ""}`}>
                        <span className="text-[8px] font-bold uppercase tracking-[0.22em]" style={{color: "rgba(167,244,50,0.85)"}}>
                            {welcomeText(strings, "Seen in")} {welcomeDomainTitle(strings, line.domain)}
                        </span>
                        <span className="text-[12.5px] font-semibold leading-snug text-white/90">{line.text}</span>
                    </div>
                ) : null}
                <div className="mt-auto flex gap-1">
                    {story.domains.map((_, i) => (
                        <span key={i} className="h-0.5 w-3.5" style={{backgroundColor: i <= domainIndex ? NEON : "rgba(255,255,255,0.18)"}} />
                    ))}
                </div>
            </div>
        </div>
    );
}

/** The Trial, then its evidence flow: record → AI check → Power earned. */
function TrialFlow({animal, trial, stage, motion}: {animal: WelcomeIntroAnimal; trial: WelcomeTrialStory; stage: number; motion: boolean}) {
    const t = useWelcomeText();
    return (
        <div className={`absolute inset-0 flex flex-col items-center gap-[9px] px-4 pb-3 pt-9 text-center ${motion ? "welcome-rise-in" : ""}`}>
            <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{color: NEON}}>{t("Trial")}</span>
                <p className="font-display text-[21px] font-black leading-[1.02] text-white">{trial.title}</p>
                <p className="text-[11.5px] font-medium leading-snug text-white/75">{trial.instruction}</p>
            </div>

            <div className="flex gap-[5px]">
                {[trial.proofLabel, `${trial.minutes} ${t("min")}`, `+${trial.rewardCredits}`].map((chip, i) => (
                    <span key={chip} className="inline-flex items-center gap-[3px] border border-white/20 px-1.5 py-[3px] text-[8.5px] font-bold uppercase tracking-[0.08em] text-white/80">
                        <span aria-hidden="true">{["●", "◷", "✦"][i]}</span>
                        {chip}
                    </span>
                ))}
            </div>

            <div className="flex w-full flex-1 items-center justify-center">
                {stage === 1 ? (
                    <RecordingViewfinder />
                ) : stage >= 2 ? (
                    <div className="flex flex-col items-center gap-[7px]">
                        {/* The clip, sent as frames: what the AI actually reviews. */}
                        <div className="relative flex gap-[5px]">
                            {PROOF_FRAMES.map((frame) => (
                                <ProofFrame key={frame} symbol={frame} className="h-10 w-[52px] text-xl" />
                            ))}
                            {stage === 2 && motion ? <span aria-hidden="true" className="welcome-evidence-scan absolute inset-y-0 w-[1.5px]" style={{backgroundColor: NEON, boxShadow: `0 0 4px ${NEON}`}} /> : null}
                            {stage >= 3 ? (
                                <span
                                    className={`absolute left-1/2 top-1/2 flex flex-col items-center px-2.5 py-1.5 shadow-[0_4px_8px_rgba(0,0,0,0.5)] ${motion ? "welcome-stamp-in" : ""}`}
                                    style={{backgroundColor: NEON, color: NEAR_BLACK, transform: "translate(-50%,-50%) rotate(-6deg)"}}
                                >
                                    <span className="whitespace-nowrap font-display text-[15px] font-black uppercase leading-none tracking-[0.08em]">{t("Power earned")}</span>
                                    <span className="whitespace-nowrap text-[9px] font-bold opacity-80">{animal.power}</span>
                                </span>
                            ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-[3px]">
                            {trial.checks.map((check) => (
                                <span key={check} className="flex items-center gap-[5px] text-[10.5px] font-semibold text-white/85">
                                    <span aria-hidden="true" style={{color: NEON}}>✓</span>
                                    {check}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="flex items-center gap-1.5">
                {["Record", "AI check", "Earned"].map((step, i) => (
                    <span key={step} className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold uppercase tracking-[0.15em]" style={{color: stage >= i + 1 ? NEON : "rgba(255,255,255,0.35)"}}>{t(step)}</span>
                        {i < 2 ? <span className="h-px w-3" style={{backgroundColor: stage >= i + 1 ? "rgba(167,244,50,0.6)" : "rgba(255,255,255,0.15)"}} /> : null}
                    </span>
                ))}
            </div>
        </div>
    );
}

function ProofFrame({symbol, className = ""}: {symbol: string; className?: string}) {
    return (
        <span
            aria-hidden="true"
            className={`grid place-items-center border border-white/20 ${className}`}
            style={{background: "linear-gradient(135deg, #1E3A2A, #0B1A12)"}}
        >
            {symbol}
        </span>
    );
}

/** Recording: a viewfinder playing the illustrated attempt. */
function RecordingViewfinder() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setTick((value) => value + 1), 700);
        return () => window.clearInterval(id);
    }, []);
    return (
        <span className="relative">
            <ProofFrame symbol={PROOF_FRAMES[tick % PROOF_FRAMES.length]} className="h-24 w-[150px] text-[42px]" />
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" style={{opacity: tick % 2 === 0 ? 1 : 0.35}} />
                <span className="text-[9px] font-bold tabular-nums text-white">00:{String(3 + (tick % 9)).padStart(2, "0")}</span>
            </span>
        </span>
    );
}

// MARK: - Beat rail

/** Three words over thin progress segments, like story progress bars. */
function BeatRail({beat, run, width}: {beat: WelcomeIntroBeat; run: {key: number; seconds: number}; width: number}) {
    const t = useWelcomeText();
    const current = WELCOME_INTRO_BEATS.findIndex((step) => step.id === beat);
    return (
        <div aria-hidden="true" className="flex gap-2" style={{width}}>
            {WELCOME_INTRO_BEATS.map((step, i) => (
                <div key={step.id} className="flex flex-1 flex-col gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-200 ${i === current ? "text-white" : "text-white/40"}`}>
                        {t(step.title)}
                    </span>
                    <span className="relative h-0.5 overflow-hidden bg-white/[0.14]">
                        {i < current ? (
                            <span className="absolute inset-0" style={{backgroundColor: NEON}} />
                        ) : i === current ? (
                            <span
                                key={run.key}
                                className="welcome-beat-fill absolute inset-y-0 left-0"
                                style={{backgroundColor: NEON, animationDuration: `${run.seconds}s`}}
                            />
                        ) : null}
                    </span>
                </div>
            ))}
        </div>
    );
}
