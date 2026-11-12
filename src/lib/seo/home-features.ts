import {formatAnimalCount} from "@/lib/animal-count";

/**
 * What the app does, for the home page's structured data (`featureList`), in
 * the owner's positioning (2026-11-12): catch real animals, AI companions, the
 * Ark. Every line is true of the app and the Ark today.
 */
export function homeFeatureList(locale: string): string[] {
    const count = formatAnimalCount(locale);
    if (locale === "id") {
        return [
            "Potret hewan sungguhan dan kenali spesiesnya",
            "Setiap hewan yang kamu tangkap menjadi teman AI yang bicara dari sudut pandang jenisnya",
            "Ark: dunia 3D bersama tempat hewan-hewan yang ditangkap orang hidup, makan, berkembang biak, dan menua dengan aturan dari panduan lapangan setiap hewan",
            "Rantai makanan yang diambil dari panduan lapangan setiap hewan",
            `Panduan lapangan untuk ${count} spesies hewan`
        ];
    }
    return [
        "Photograph real animals and identify their species",
        "Every animal you catch becomes an AI companion that talks from its own kind's point of view",
        "The Ark: a shared 3D world where the animals people catch live, eat, breed and grow old by rules built from each animal's field guide",
        "Food chains drawn from each animal's field guide",
        `Field guides for ${count} animal species`
    ];
}
