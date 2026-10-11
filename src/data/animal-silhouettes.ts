// Species art the floating IconCanvas turns into silhouettes (home hero, 404).
// Module-level so the canvas's image-loading effect keeps a stable array.
const animalImageBase = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";

export const animalSilhouetteImages = [
    "mantis-shrimp",
    "mountain-tapir",
    "pekin-duck",
    "red-kite",
    "rex-rabbit",
    "zander",
    "thorny-devil",
    "tibetan-fox",
    "samoyed",
    "swamp-harrier"
].map((slug) => `${animalImageBase}/${slug}.webp`);
