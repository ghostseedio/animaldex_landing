// The music beds under blog videos: instrumental tracks generated once with
// ElevenLabs Music, Lyria as fallback (scripts/generate-music-beds.mts), stored with the site
// in public/video-music/. Original audio, so no Content ID claims. The planner
// picks a mood per video; the renderer ducks the bed under the voice.

export const MUSIC_MOODS = ["suspense", "mystery", "intense", "wonder", "epic", "curious", "playful", "somber"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export function isMusicMood(value: unknown): value is MusicMood {
    return typeof value === "string" && (MUSIC_MOODS as readonly string[]).includes(value);
}

/** What each mood is for, as the planner is told. */
export const MUSIC_MOOD_GUIDE: Record<MusicMood, string> = {
    suspense: "danger, threat, a reveal building up (deadly animals, predators, disease)",
    mystery: "unknowns, strange behaviour, unsolved questions, the hidden world",
    intense: "fast action, hunting, fights, survival, records of speed or power",
    wonder: "beauty, awe, nature's design, gentle discovery",
    epic: "huge scale, migrations, ancient giants, evolution, big achievements",
    curious: "quirky facts, how things work, light science, explainers",
    playful: "funny, cute or surprising-in-a-good-way animals, lighthearted posts",
    somber: "loss, extinction, conservation, human impact"
};

export type MusicTrack = {id: string; mood: MusicMood; prompt: string};

const BED = "Instrumental music bed for a vertical wildlife documentary short, about 60 seconds, no vocals, no spoken words. Steady energy from start to finish so it can sit under narration; leave the mid frequencies open for a voice. Clean, modern, cinematic production.";

export const MUSIC_TRACKS: MusicTrack[] = [
    {id: "suspense-1", mood: "suspense", prompt: `${BED} Suspenseful: low pulsing synth bass, soft ticking percussion, distant tense strings, slowly tightening.`},
    {id: "suspense-2", mood: "suspense", prompt: `${BED} Suspenseful thriller pulse: muted heartbeat kick, staccato low strings, eerie high drones, a sense of something approaching.`},
    {id: "mystery-1", mood: "mystery", prompt: `${BED} Mysterious: airy pads, sparse plucked harp and celesta, subtle reversed textures, curious and unresolved.`},
    {id: "mystery-2", mood: "mystery", prompt: `${BED} Dark mystery: deep ambient drones, soft glassy bells, slow brushed percussion, nocturnal jungle atmosphere.`},
    {id: "intense-1", mood: "intense", prompt: `${BED} Intense and driving: fast hybrid percussion, aggressive low synth ostinato, rising string stabs, high adrenaline chase energy.`},
    {id: "intense-2", mood: "intense", prompt: `${BED} Intense: pounding taiko and trap-style hi-hats, distorted bass pulses, urgent and powerful predator-hunt energy.`},
    {id: "wonder-1", mood: "wonder", prompt: `${BED} Wonder and awe: shimmering piano arpeggios, warm strings, gentle swells, uplifting nature-documentary beauty.`},
    {id: "wonder-2", mood: "wonder", prompt: `${BED} Magical wonder: soft marimba and glockenspiel patterns, lush pads, light pulse, delicate and inspiring.`},
    {id: "epic-1", mood: "epic", prompt: `${BED} Epic cinematic: big drums, heroic brass, soaring strings, grand scale, steady powerful momentum.`},
    {id: "epic-2", mood: "epic", prompt: `${BED} Epic orchestral hybrid: deep braams kept subtle, rhythmic strings, choir-like pads without words, ancient and vast.`},
    {id: "curious-1", mood: "curious", prompt: `${BED} Curious and upbeat: pizzicato strings, light electronic beat, quirky woodwinds, smart science-explainer feel.`},
    {id: "curious-2", mood: "curious", prompt: `${BED} Curious modern: bouncy synth plucks, lo-fi drums, playful bass line, inquisitive and friendly.`},
    {id: "playful-1", mood: "playful", prompt: `${BED} Playful and fun: ukulele, claps, whistling-style synth lead without vocals, bright and cheerful.`},
    {id: "somber-1", mood: "somber", prompt: `${BED} Somber and reflective: slow solo piano, soft cello, gentle ambient texture, emotional but hopeful.`}
];

/** The bed for a video: one of its mood's tracks, chosen by the video id so a re-edit keeps the same music. */
export function pickMusicTrack(mood: MusicMood | null | undefined, seed: string): MusicTrack | null {
    const pool = MUSIC_TRACKS.filter((track) => track.mood === (mood ?? "curious"));
    if (!pool.length) return null;
    let hash = 0;
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return pool[hash % pool.length];
}

export function musicTrackPath(cwd: string, track: MusicTrack) {
    return `${cwd}/public/video-music/${track.id}.mp3`;
}
