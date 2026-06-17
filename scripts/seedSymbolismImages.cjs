const {existsSync, mkdirSync, copyFileSync} = require("node:fs");
const path = require("node:path");

const SOURCE_HERO = path.join(process.cwd(), "public/images/blog/octopus-symbolism/octopus-symbolism-hero.webp");

const LESSON_BASE = path.join(process.cwd(), "public/images/blog/what-if-every-animal-is-a-lesson");

const HERO_OVERRIDES = {
    lion: path.join(LESSON_BASE, "lion-sovereignty-command-frequency.webp"),
    dolphin: path.join(LESSON_BASE, "dolphin-communication-joy-frequency.webp"),
    eagle: path.join(LESSON_BASE, "eagle-symbolism.webp"),
    cat: path.join(LESSON_BASE, "cat-threshold-awareness-invisible-worlds.webp"),
    jellyfish: path.join(LESSON_BASE, "australian-spotted-jellyfish-frequency.webp"),
    orangutan: path.join(LESSON_BASE, "gorilla-symbolism.webp")
};

const SLUGS = [
    "indus-river-dolphin", "snowy-owl", "blue-ringed-octopus", "beluga-whale", "tiger-salamander",
    "gorilla", "black-rhinoceros", "sumatran-orangutan", "lionfish", "antlion",
    "adelie-penguin", "fox", "remora", "blue-whale", "elephant",
    "philippine-eagle", "giant-pacific-octopus", "polar-bear", "great-white-shark", "african-grey-parrot",
    "alpine-newt", "african-bush-elephant", "andean-goose", "aardwolf", "blue-tongued-skink",
    "lion", "wolf", "dolphin", "eagle", "raven", "cat", "tiger",
    "chameleon", "crocodile", "leopard", "jellyfish", "orangutan", "owl", "dragonfly"
];

const IMAGE_NAMES = (slug) => {
    const short = slug.split("-").pop();
    return [
        `${slug}-symbolism-hero.webp`,
        `what-is-a-${short}.webp`,
        `${short}-biology-symbolism.webp`,
        `${short}-observation-symbolism.webp`,
        `${short}-resilience-symbolism.webp`,
        `${short}-memory-symbolism.webp`,
        `${short}-precision-symbolism.webp`,
        `${short}-adaptability-symbolism.webp`,
        `${short}-teamwork-symbolism.webp`,
        `${short}-efficiency-symbolism.webp`,
        `${short}-stealth-symbolism.webp`,
        `${short}-communication-symbolism.webp`,
        `${short}-cultural-symbolism.webp`,
        `${short}-shadow-symbolism.webp`,
        `${slug}-symbolism-lesson.webp`,
        `${slug}-symbolism-final.webp`
    ];
};

if (!existsSync(SOURCE_HERO)) {
    console.error("Source hero image not found:", SOURCE_HERO);
    process.exit(1);
}

for (const slug of SLUGS) {
    const dir = path.join(process.cwd(), "public/images/blog", `${slug}-symbolism`);
    mkdirSync(dir, {recursive: true});
    const heroSource = HERO_OVERRIDES[slug] && existsSync(HERO_OVERRIDES[slug]) ? HERO_OVERRIDES[slug] : SOURCE_HERO;
    for (const name of IMAGE_NAMES(slug)) {
        const dest = path.join(dir, name);
        const source = name.endsWith("-symbolism-hero.webp") ? heroSource : SOURCE_HERO;
        if (!existsSync(dest)) {
            copyFileSync(source, dest);
        }
    }
}

console.log(`Seeded images for ${SLUGS.length} symbolism post folders.`);
