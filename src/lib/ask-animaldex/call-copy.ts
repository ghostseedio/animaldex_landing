/**
 * What the call screen says, in the site's two languages. The iOS call's
 * strings (AnimalVoiceCallView.swift), with the web's own wording only where
 * the app's points at a phone's Settings.
 */

export type CallCopy = {
    talkTo: string;
    endCall: string;
    live: string;
    hideCaptions: string;
    showCaptions: string;
    cantBeShown: string;
    you: string;
    sayHello: string;
    mute: string;
    unmute: string;
    interrupt: string;
    sendNow: string;
    microphone: string;
    muted: string;
    connecting: string;
    listening: string;
    tapToSend: string;
    thinking: string;
    tapToInterrupt: string;
    voiceUsedUp: string;
    allowMicrophone: string;
    microphoneUnavailable: string;
    recognitionStopped: string;
    ellipsis: string;
};

const EN: CallCopy = {
    talkTo: "Talk to {animal}",
    endCall: "End call",
    live: "Live · {clock}",
    hideCaptions: "Hide captions",
    showCaptions: "Show captions",
    cantBeShown: "{animal} can't be shown right now.",
    you: "You",
    sayHello: "Say hello to {animal}",
    mute: "Mute",
    unmute: "Unmute",
    interrupt: "Interrupt",
    sendNow: "Send now",
    microphone: "Microphone",
    muted: "Muted",
    connecting: "Connecting…",
    listening: "Listening",
    tapToSend: "Tap to send",
    thinking: "{animal} is thinking",
    tapToInterrupt: "Tap to interrupt",
    voiceUsedUp: "That's today's voice replies used.",
    allowMicrophone: "Allow the microphone for this site to call.",
    microphoneUnavailable: "The microphone is not available right now.",
    recognitionStopped: "Speech recognition stopped. Try calling again.",
    ellipsis: "…"
};

const ID: CallCopy = {
    talkTo: "Bicara dengan {animal}",
    endCall: "Akhiri panggilan",
    live: "Langsung · {clock}",
    hideCaptions: "Sembunyikan teks",
    showCaptions: "Tampilkan teks",
    cantBeShown: "{animal} tidak bisa ditampilkan sekarang.",
    you: "Kamu",
    sayHello: "Sapa {animal}",
    mute: "Bisukan",
    unmute: "Bunyikan",
    interrupt: "Sela",
    sendNow: "Kirim sekarang",
    microphone: "Mikrofon",
    muted: "Dibisukan",
    connecting: "Menghubungkan…",
    listening: "Mendengarkan",
    tapToSend: "Ketuk untuk mengirim",
    thinking: "{animal} sedang berpikir",
    tapToInterrupt: "Ketuk untuk menyela",
    voiceUsedUp: "Balasan suara hari ini sudah habis.",
    allowMicrophone: "Izinkan mikrofon untuk situs ini agar bisa menelepon.",
    microphoneUnavailable: "Mikrofon tidak tersedia saat ini.",
    recognitionStopped: "Pengenalan suara berhenti. Coba telepon lagi.",
    ellipsis: "…"
};

export function callCopy(locale: string): CallCopy {
    return locale.toLowerCase().startsWith("id") ? ID : EN;
}

/** The recognizer's language for the site's locale: the reader's own English where they read in English. */
export function callSpeechLanguage(locale: string): string {
    if (locale.toLowerCase().startsWith("id")) return "id-ID";
    const own = typeof navigator !== "undefined" ? navigator.language : "";
    return /^en(-|$)/i.test(own) ? own : "en-US";
}
