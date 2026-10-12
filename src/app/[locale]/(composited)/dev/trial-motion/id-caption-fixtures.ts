/**
 * DEV ONLY: `trial_motion_caption_translations` rows (lang `id`) for the spec's
 * examples, standing in for the live table until it fills. `grizzly-LOW` is
 * deliberately stale (translated from older captions), so the preview also
 * shows the fallback to English.
 */

import examples from "@/lib/trial-motion/__fixtures__/examples.json";

const INDONESIAN: Record<string, string[]> = {
    "cheetah-LOW": ["Tahan posisi jongkok datar selama lima detik", "Turun lalu langsung melompat keluar", "Bandingkan kedua pasang tanda"],
    "koala-MID": ["Hitung tumpukan yang sebenarnya dengan suara keras", "Tutup semuanya kecuali dua, satu per satu", "Selesaikan dengan dua yang tersisa"],
    "honeybee-MID": ["Pilih satu temuan yang benar-benar berguna", "Ucapkan sebagai petunjuk arah yang tepat", "Kirimkan ke obrolan grup"],
    "grizzly-LOW": ["Tulis urutan tetapnya lebih dulu", "Jalankan tanpa memutuskan ulang"],
    "sparrow-HIGH": ["Temukan sisa yang sudah akan terbuang", "Ambil tanpa mengambil dari siapa pun", "Bangun sesuatu yang berguna sepenuhnya darinya"],
    "observation-sample": ["Duduk diam dan amati satu titik", "Hitung setiap pengunjung yang kamu lihat"]
};

/** The fixture row for an example: `{sourceCaptions, captions}`, as the snapshot stores it. */
export function idCaptionFixture(key: string) {
    const example = (examples as Array<{key: string; storyboard: {beats: Array<{caption: string}>}}>).find((item) => item.key === key);
    const captions = INDONESIAN[key];
    if (!example || !captions) return null;
    const sourceCaptions = example.storyboard.beats.map((beat) => beat.caption);
    // Stale on purpose: the storyboard's second caption changed after translation.
    if (key === "grizzly-LOW") sourceCaptions[1] = "Work through it without thinking";
    return {sourceCaptions, captions};
}
