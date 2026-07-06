const SOUND_ENABLED_KEY = "animaldex.soundEffectsEnabled";

let audioContext: AudioContext | null = null;

function isSoundEnabled() {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SOUND_ENABLED_KEY);
    return stored == null || stored === "true";
}

function getAudioContext() {
    if (typeof window === "undefined") return null;
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
        void audioContext.resume();
    }
    return audioContext;
}

function tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine"
) {
    const ctx = getAudioContext();
    if (!ctx || !isSoundEnabled()) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

export function unlockMatchupAudio() {
    getAudioContext();
}

export function playChallengeCharge() {
    const ctx = getAudioContext();
    if (!ctx || !isSoundEnabled()) return;

    const start = ctx.currentTime;
    tone(380, start, 0.07, 0.09, "triangle");
    tone(620, start + 0.03, 0.08, 0.07, "sine");
}

export function playChallengeResolve() {
    const ctx = getAudioContext();
    if (!ctx || !isSoundEnabled()) return;

    const start = ctx.currentTime;
    const notes = [392, 494, 587, 784];
    notes.forEach((frequency, index) => {
        tone(frequency, start + index * 0.07, 0.16, 0.1 - index * 0.012, "sine");
    });
    tone(196, start, 0.28, 0.05, "triangle");
}

export function playMatchupWin() {
    const ctx = getAudioContext();
    if (!ctx || !isSoundEnabled()) return;

    const start = ctx.currentTime;
    [523, 659, 784].forEach((frequency, index) => {
        tone(frequency, start + index * 0.08, 0.2, 0.09, "sine");
    });
}

export function playMatchupLoss() {
    const ctx = getAudioContext();
    if (!ctx || !isSoundEnabled()) return;

    const start = ctx.currentTime;
    tone(330, start, 0.14, 0.08, "triangle");
    tone(262, start + 0.1, 0.22, 0.09, "sine");
}
