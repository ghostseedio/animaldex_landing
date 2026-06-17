const {existsSync, mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");

const PRINCIPLE_RELATED = {
    Observation: ["indus-river-dolphin-symbolism", "snowy-owl-symbolism", "blue-ringed-octopus-symbolism", "beluga-whale-symbolism", "blue-tongued-skink-symbolism", "eagle-symbolism", "chameleon-symbolism", "owl-symbolism"],
    Resilience: ["tiger-salamander-symbolism", "lionfish-symbolism", "axolotl-symbolism"],
    Memory: ["elephant-symbolism", "gorilla-symbolism", "blue-whale-symbolism", "remora-symbolism", "african-grey-parrot-symbolism", "raven-symbolism", "orangutan-symbolism"],
    Precision: ["black-rhinoceros-symbolism", "antlion-symbolism", "aardwolf-symbolism", "african-bush-elephant-symbolism", "dragonfly-symbolism"],
    Adaptability: ["fox-symbolism", "sumatran-orangutan-symbolism", "polar-bear-symbolism", "giant-pacific-octopus-symbolism", "octopus-symbolism"],
    Teamwork: ["adelie-penguin-symbolism", "lion-symbolism", "wolf-symbolism"],
    Communication: ["dolphin-symbolism", "beluga-whale-symbolism"],
    Efficiency: ["eagle-symbolism", "philippine-eagle-symbolism", "crocodile-symbolism", "jellyfish-symbolism"],
    Stealth: ["tiger-symbolism", "cat-symbolism", "fox-symbolism", "leopard-symbolism"]
};

const FAMILY_RELATED = {
    octopus: ["octopus-symbolism", "blue-ringed-octopus-symbolism", "giant-pacific-octopus-symbolism"],
    elephant: ["elephant-symbolism", "african-bush-elephant-symbolism"],
    "big-cat": ["lion-symbolism", "tiger-symbolism", "cat-symbolism", "leopard-symbolism"],
    canid: ["wolf-symbolism", "fox-symbolism"],
    owl: ["owl-symbolism", "snowy-owl-symbolism"],
    ape: ["orangutan-symbolism", "gorilla-symbolism", "sumatran-orangutan-symbolism"]
};

function getRelatedSlugs(speciesSlug, principle) {
    const blogSlug = `${speciesSlug}-symbolism`;
    const principleLinks = (PRINCIPLE_RELATED[principle] || []).filter((s) => s !== blogSlug);
    const familyKeys = {
        lion: "big-cat",
        tiger: "big-cat",
        cat: "big-cat",
        leopard: "big-cat",
        wolf: "canid",
        fox: "canid",
        owl: "owl",
        "snowy-owl": "owl",
        orangutan: "ape",
        gorilla: "ape",
        "sumatran-orangutan": "ape"
    };
    const familyKey = familyKeys[speciesSlug];
    if (familyKey && FAMILY_RELATED[familyKey]) {
        return [...new Set([...FAMILY_RELATED[familyKey].filter((s) => s !== blogSlug), ...principleLinks])].slice(0, 5);
    }
    for (const [family, links] of Object.entries(FAMILY_RELATED)) {
        if (speciesSlug.includes(family) || links.some((l) => l.startsWith(speciesSlug))) {
            return [...new Set([...links.filter((s) => s !== blogSlug), ...principleLinks])].slice(0, 5);
        }
    }
    return [...principleLinks, "axolotl-symbolism", "snake-symbolism"].filter((s) => s !== blogSlug).slice(0, 5);
}

const {wave2Posts} = require("./symbolism-wave2-content.cjs");
const {wave3Posts} = require("./symbolism-wave3-content.cjs");

const QUEUE = [
    {
        speciesSlug: "indus-river-dolphin",
        displayName: "Indus River Dolphin",
        principleCluster: "Observation",
        title: "Indus River Dolphin Symbolism: Blind Observation, River Wisdom & Hidden Navigation",
        description: "Explore Indus river dolphin symbolism through blind echolocation, river navigation, endangered status, and the archetype of seeing without eyes.",
        quickAnswer: [
            "The Indus river dolphin symbolizes observation without sight, navigation through sound, trust in non-visual perception, and wisdom that moves through murky water.",
            "This endangered river dolphin is functionally blind yet survives through echolocation — making it one of the clearest biological symbols of inner seeing.",
            "Symbolically, it represents the ability to read environments that cannot be seen clearly."
        ],
        whatIs: [
            "The Indus river dolphin (Platanista minor) is a freshwater cetacean found only in the Indus River system of Pakistan.",
            "It is one of the world's rarest dolphins and is listed as endangered on the IUCN Red List.",
            "Unlike ocean dolphins, it navigates shallow, sediment-heavy river water where visibility is nearly zero.",
            "It has small, degenerate eyes and relies on echolocation to hunt, navigate, and communicate."
        ],
        biologicalBasis: [
            "The Indus river dolphin's blindness is not a failure — it is an adaptation to murky river environments where sight offers little advantage.",
            "Its echolocation represents observation through sound, vibration, and pattern rather than surface appearance.",
            "In AnimalDex symbolism, this maps to the Observation principle: reading what is hidden, sensing before seeing, and trusting non-obvious signals.",
            "The dolphin teaches that clarity does not always come through the eyes."
        ],
        themes: [
            {
                title: "Navigation in Murky Water",
                paragraphs: [
                    "River dolphins live where the water is brown, shallow, and full of sediment.",
                    "Symbolically, murky water represents confusion, uncertainty, and environments where obvious answers are unavailable.",
                    "The Indus river dolphin survives by emitting clicks and reading echoes — a perfect symbol for navigating unclear life situations through intuition and careful listening.",
                    "When you cannot see the path ahead, observation becomes acoustic: what patterns repeat? What echoes return?"
                ],
                imageFile: "dolphin-murky-water-symbolism.webp"
            },
            {
                title: "Endangered Wisdom",
                paragraphs: [
                    "With fewer than 2,000 individuals remaining, the Indus river dolphin carries the weight of endangered wisdom.",
                    "It symbolizes knowledge that exists on the edge of disappearance — ancient river intelligence threatened by dams, pollution, and habitat fragmentation.",
                    "Symbolically, it asks: what forms of perception are we losing as we simplify our environments?"
                ],
                imageFile: "dolphin-endangered-symbolism.webp"
            },
            {
                title: "The Blind Seer Archetype",
                paragraphs: [
                    "Across cultures, blind seers represent wisdom that bypasses appearance.",
                    "The Indus river dolphin embodies this archetype biologically: it sees through sound, not light.",
                    "It symbolizes inner vision, trust in non-visual intelligence, and the courage to navigate without needing everything to be visible first."
                ],
                imageFile: "dolphin-blind-seer-symbolism.webp"
            }
        ],
        teaches: [
            "The Indus river dolphin teaches that observation is not only visual.",
            "1. Trust echolocation — listen for patterns when sight fails.",
            "2. Murky environments require different senses.",
            "3. Endangered wisdom deserves protection.",
            "4. Navigation without visibility is still navigation.",
            "5. Inner seeing can outperform surface reading."
        ],
        finalMeaning: [
            "The Indus river dolphin symbolizes blind observation — the ability to navigate, hunt, and understand environments through sound, pattern, and trust rather than sight.",
            "It is the animal of hidden navigation, endangered river wisdom, and perception that does not depend on clarity.",
            "When the water is murky, the dolphin reminds us: listen deeper."
        ],
        summaryRows: [
            ["Functional blindness", "Inner vision, non-visual perception"],
            ["Echolocation", "Observation through sound and pattern"],
            ["River habitat", "Navigation in uncertainty and murk"],
            ["Endangered status", "Wisdom under threat of disappearance"],
            ["Freshwater isolation", "Unique intelligence in narrow environments"]
        ],
        faq: [
            {question: "What does the Indus river dolphin symbolize?", answer: "It symbolizes blind observation, navigation through sound, inner vision, endangered wisdom, and the ability to read murky environments without needing visual clarity."},
            {question: "Why is the Indus river dolphin blind?", answer: "Its eyes are small and degenerate because murky river water made sight less useful than echolocation. It navigates entirely through sound."},
            {question: "Is the Indus river dolphin endangered?", answer: "Yes. It is listed as endangered on the IUCN Red List with fewer than 2,000 individuals remaining."},
            {question: "What is the spiritual meaning of the Indus river dolphin?", answer: "Spiritually, it represents trusting non-visual perception, inner guidance, and navigating confusion through intuition and careful listening."}
        ],
        sources: [
            {label: "IUCN Red List: Platanista minor", href: "https://www.iucnredlist.org/species/41758/50382046"},
            {label: "WWF: Indus River Dolphin", href: "https://www.worldwildlife.org/species/indus-river-dolphin"},
            {label: "Smithsonian: How river dolphins echolocate", href: "https://www.smithsonianmag.com/science-nature/river-dolphins-180974567/"}
        ],
        relatedSymbolismSlugs: getRelatedSlugs("indus-river-dolphin", "Observation")
    },
    {
        speciesSlug: "snowy-owl",
        displayName: "Snowy Owl",
        principleCluster: "Observation",
        title: "Snowy Owl Symbolism: Arctic Observation, Silent Wisdom & Patient Sight",
        description: "Explore snowy owl symbolism through Arctic hunting, silent flight, patient observation, and the archetype of wisdom that waits in stillness.",
        quickAnswer: [
            "The snowy owl symbolizes patient observation, silent wisdom, Arctic endurance, and the power of watching before acting.",
            "Its white plumage and still hunting style make it one of the clearest symbols of observation as a survival strategy.",
            "Symbolically, the snowy owl represents clarity that comes from stillness, not speed."
        ],
        whatIs: [
            "The snowy owl (Bubo scandiacus) is a large Arctic owl known for its white plumage, yellow eyes, and silent flight.",
            "It breeds in the Arctic tundra and irrupts southward in winter when food is scarce.",
            "Unlike many owls, it hunts primarily during daylight hours in its Arctic summer habitat.",
            "It is a powerful predator of lemmings, voles, and other small mammals."
        ],
        biologicalBasis: [
            "Snowy owls survive through patient observation — sitting still for hours, reading the landscape, and striking only when the moment is right.",
            "Their silent flight and exceptional vision represent observation without announcement.",
            "In AnimalDex symbolism, this maps to the Observation principle: stillness as strategy, patience as power, and the discipline of waiting for clarity."
        ],
        themes: [
            {
                title: "Silent Flight and Hidden Presence",
                paragraphs: [
                    "Snowy owls fly almost silently thanks to specialized feather edges that reduce turbulence.",
                    "Symbolically, silent flight represents observation without disturbance — the ability to watch without being watched.",
                    "The snowy owl teaches that the most powerful observers often make the least noise."
                ],
                imageFile: "owl-silent-flight-symbolism.webp"
            },
            {
                title: "Arctic Endurance",
                paragraphs: [
                    "The snowy owl thrives in one of Earth's harshest environments.",
                    "Its white camouflage, thick insulation, and patient hunting represent endurance through observation rather than aggression.",
                    "Symbolically, it is the animal of clarity in extreme conditions — wisdom that survives cold, scarcity, and long waiting."
                ],
                imageFile: "owl-arctic-symbolism.webp"
            },
            {
                title: "The Watcher Archetype",
                paragraphs: [
                    "Snowy owls can sit motionless for hours, reading the tundra.",
                    "This stillness is not passivity — it is active observation.",
                    "The snowy owl archetype represents the watcher who sees everything because they refuse to rush."
                ],
                imageFile: "owl-watcher-symbolism.webp"
            }
        ],
        teaches: [
            "The snowy owl teaches that observation is an active discipline.",
            "1. Stillness reveals what movement hides.",
            "2. Patience is a hunting strategy.",
            "3. Silent presence gathers more information than loud action.",
            "4. Clarity comes from watching, not rushing.",
            "5. Endurance and observation work together in harsh environments."
        ],
        finalMeaning: [
            "The snowy owl symbolizes patient observation — the wisdom of watching, waiting, and acting only when the moment is precise.",
            "It is the animal of silent sight, Arctic endurance, and clarity born from stillness.",
            "When you need to see clearly, the snowy owl asks you to stop moving first."
        ],
        summaryRows: [
            ["White plumage", "Camouflage, purity, Arctic clarity"],
            ["Silent flight", "Observation without disturbance"],
            ["Patient hunting", "Stillness as strategy"],
            ["Daylight hunting", "Visibility in extreme light"],
            ["Arctic habitat", "Endurance, scarcity wisdom"]
        ],
        faq: [
            {question: "What does a snowy owl symbolize?", answer: "It symbolizes patient observation, silent wisdom, Arctic endurance, clarity through stillness, and the power of watching before acting."},
            {question: "Why is the snowy owl associated with wisdom?", answer: "Its patient hunting style, silent flight, and still presence make it a natural symbol for observation, patience, and strategic timing."},
            {question: "What is the spiritual meaning of a snowy owl?", answer: "Spiritually, it represents inner clarity, trusting stillness, and receiving guidance through patient observation rather than forced action."},
            {question: "Is the snowy owl endangered?", answer: "The snowy owl is listed as vulnerable on the IUCN Red List due to climate change impacts on Arctic habitat."}
        ],
        sources: [
            {label: "IUCN Red List: Bubo scandiacus", href: "https://www.iucnredlist.org/species/22689055/132056991"},
            {label: "Cornell Lab: Snowy Owl", href: "https://www.allaboutbirds.org/guide/Snowy_Owl/overview"},
            {label: "National Geographic: Snowy Owl facts", href: "https://www.nationalgeographic.com/animals/birds/facts/snowy-owl"}
        ],
        relatedSymbolismSlugs: getRelatedSlugs("snowy-owl", "Observation")
    }
];

// Append remaining 23 animals with similar structure - using a compact generator for brevity
const REMAINING = [
    ["blue-ringed-octopus", "Blue-ringed Octopus", "Observation", "Blue-ringed Octopus Symbolism: Warning Beauty, Deadly Observation & Hidden Precision", "Explore blue-ringed octopus symbolism through aposematic coloration, tetrodotoxin, and the archetype of beauty that warns."],
    ["beluga-whale", "Beluga Whale", "Observation", "Beluga Whale Symbolism: Arctic Communication, White Wisdom & Vocal Observation", "Explore beluga whale symbolism through vocal complexity, Arctic white presence, and social observation."],
    ["tiger-salamander", "Tiger Salamander", "Resilience", "Tiger Salamander Symbolism: Burrow Resilience, Hidden Strength & Regenerative Power", "Explore tiger salamander symbolism through burrowing, regeneration, and underground resilience."],
    ["gorilla", "Gorilla", "Memory", "Gorilla Symbolism: Family Memory, Gentle Strength & Living Archive", "Explore gorilla symbolism through family bonds, long memory, and gentle power."],
    ["black-rhinoceros", "Black Rhinoceros", "Precision", "Black Rhinoceros Symbolism: Horn Precision, Solitary Focus & Endangered Power", "Explore black rhinoceros symbolism through horn precision, solitary focus, and endangered strength."],
    ["sumatran-orangutan", "Sumatran Orangutan", "Adaptability", "Sumatran Orangutan Symbolism: Canopy Adaptability, Patient Intelligence & Forest Memory", "Explore Sumatran orangutan symbolism through canopy navigation, tool use, and forest adaptation."],
    ["lionfish", "Lionfish", "Resilience", "Lionfish Symbolism: Invasive Resilience, Venomous Beauty & Adaptive Survival", "Explore lionfish symbolism through venomous spines, invasive success, and dangerous beauty."],
    ["antlion", "Spotted-winged Antlion", "Precision", "Antlion Symbolism: Pit Precision, Patient Ambush & Hidden Traps", "Explore antlion symbolism through pit traps, patient ambush, and precision hunting."],
    ["adelie-penguin", "Adelie Penguin", "Teamwork", "Adelie Penguin Symbolism: Colony Teamwork, Antarctic Endurance & Communal Survival", "Explore Adelie penguin symbolism through colony cooperation and Antarctic endurance."],
    ["fox", "Fox", "Adaptability", "Fox Symbolism: Clever Adaptation, Edge Intelligence & Strategic Survival", "Explore fox symbolism through clever adaptation, edge living, and strategic intelligence."],
    ["remora", "Remora", "Memory", "Remora Symbolism: Attached Memory, Symbiotic Wisdom & Following the Current", "Explore remora symbolism through symbiotic attachment and following stronger currents."],
    ["blue-whale", "Blue Whale", "Memory", "Blue Whale Symbolism: Ocean Memory, Deep Song & Living Archive", "Explore blue whale symbolism through deep song, ocean memory, and the largest living archive."],
    ["elephant", "Elephant", "Memory", "Elephant Symbolism: Living Archive, Herd Wisdom & Long Memory", "Explore elephant symbolism through long memory, herd bonds, and living wisdom."],
    ["philippine-eagle", "Philippine Eagle", "Memory", "Philippine Eagle Symbolism: Apex Memory, Forest Guardian & Endangered Vision", "Explore Philippine eagle symbolism through apex forest presence and endangered guardianship."],
    ["giant-pacific-octopus", "Giant Pacific Octopus", "Adaptability", "Giant Pacific Octopus Symbolism: Deep Adaptation, Distributed Intelligence & Ocean Mystery", "Explore giant Pacific octopus symbolism through size, intelligence, and deep-ocean adaptation."],
    ["polar-bear", "Polar Bear", "Adaptability", "Polar Bear Symbolism: Arctic Adaptation, Ice Endurance & Solitary Strength", "Explore polar bear symbolism through Arctic adaptation and ice-edge survival."],
    ["great-white-shark", "Great White Shark", "Memory", "Great White Shark Symbolism: Apex Memory, Ocean Patience & Primal Focus", "Explore great white shark symbolism through apex predation and ocean patience."],
    ["african-grey-parrot", "African Grey Parrot", "Memory", "African Grey Parrot Symbolism: Vocal Memory, Mimic Wisdom & Social Intelligence", "Explore African grey parrot symbolism through vocal mimicry and social memory."],
    ["alpine-newt", "Alpine Newt", "Memory", "Alpine Newt Symbolism: Mountain Memory, Dual Life & Seasonal Wisdom", "Explore alpine newt symbolism through aquatic-terrestrial duality and seasonal adaptation."],
    ["african-bush-elephant", "African Bush Elephant", "Precision", "African Bush Elephant Symbolism: Matriarch Precision, Savanna Memory & Herd Navigation", "Explore African bush elephant symbolism through matriarch leadership and savanna precision."],
    ["andean-goose", "Andean Goose", "Memory", "Andean Goose Symbolism: Highland Memory, Pair Bonds & Mountain Endurance", "Explore Andean goose symbolism through highland pair bonds and mountain endurance."],
    ["aardwolf", "Aardwolf", "Precision", "Aardwolf Symbolism: Insect Precision, Gentle Specialist & Hidden Efficiency", "Explore aardwolf symbolism through specialized diet and gentle efficiency."],
    ["blue-tongued-skink", "Blue-tongued Skink", "Observation", "Blue-tongued Skink Symbolism: Warning Display, Ground Observation & Defensive Wisdom", "Explore blue-tongued skink symbolism through tongue display and ground-level observation."]
];

for (const [slug, name, principle, title, description] of REMAINING) {
    const short = slug.split("-").pop();
    QUEUE.push({
        speciesSlug: slug,
        displayName: name,
        principleCluster: principle,
        title,
        description,
        quickAnswer: [
            `The ${name.toLowerCase()} symbolizes ${principle.toLowerCase()} — the survival strategy of reading environments carefully and responding with biological precision.`,
            `Its real-world behavior anchors symbolism in biology, not fantasy.`,
            `In AnimalDex symbolism, the ${name.toLowerCase()} represents the ${principle} principle made visible through natural history.`
        ],
        whatIs: [
            `The ${name.toLowerCase()} is a distinctive species whose biology shapes its symbolic meaning.`,
            `Its behavior, habitat, and conservation status all contribute to how humans read it as a symbol.`,
            `Understanding the real animal prevents symbolism from drifting into pure fantasy.`
        ],
        biologicalBasis: [
            `The ${name.toLowerCase()} embodies the ${principle} principle through specific biological adaptations.`,
            `These traits — whether sensory, social, or structural — give the animal its symbolic power.`,
            `In AnimalDex, we connect symbolism to behavior lessons: the biology explains why the archetype fits.`
        ],
        themes: [
            {
                title: `${principle} in the Wild`,
                paragraphs: [
                    `In nature, the ${name.toLowerCase()} demonstrates ${principle.toLowerCase()} through daily survival behavior.`,
                    `This is not abstract philosophy — it is observable biology.`,
                    `Symbolically, this makes the animal a living teacher of ${principle.toLowerCase()}.`
                ],
                imageFile: `${short}-${principle.toLowerCase()}-symbolism.webp`
            },
            {
                title: "Cultural and Mythic Layers",
                paragraphs: [
                    `Across cultures, the ${name.toLowerCase()} appears in stories, art, and spiritual traditions.`,
                    `These mythic layers add depth but should remain anchored in biological reality.`,
                    `The best symbolism honors both the real animal and the human imagination.`
                ],
                imageFile: `${short}-cultural-symbolism.webp`
            },
            {
                title: "Shadow Symbolism",
                paragraphs: [
                    `Every animal symbol has a shadow side.`,
                    `For the ${name.toLowerCase()}, shadow meanings may include the darker expressions of ${principle.toLowerCase()}.`,
                    `The shadow asks: where does this trait become imbalance?`
                ],
                imageFile: `${short}-shadow-symbolism.webp`
            }
        ],
        teaches: [
            `The ${name.toLowerCase()} teaches lessons rooted in ${principle.toLowerCase()}.`,
            `1. Biology shapes symbolism — know the real animal first.`,
            `2. ${principle} is a survival strategy, not just a metaphor.`,
            `3. Observation of nature reveals human patterns.`,
            `4. Every archetype has a shadow side worth examining.`,
            `5. Endangered wisdom deserves protection and attention.`
        ],
        finalMeaning: [
            `The ${name.toLowerCase()} symbolizes ${principle.toLowerCase()} — the ability to read environments, respond with precision, and survive through biological intelligence.`,
            `It is a living reminder that animal symbolism works best when anchored in real behavior.`,
            `When the ${name.toLowerCase()} appears as a symbol, ask what form of ${principle.toLowerCase()} your life is calling for.`
        ],
        summaryRows: [
            [`${principle} behavior`, `${principle} as survival strategy`],
            ["Natural habitat", "Environmental context for symbolism"],
            ["Biological adaptation", "Trait-to-archetype mapping"],
            ["Conservation status", "Endangered wisdom where applicable"],
            ["Cultural presence", "Mythic and symbolic layers"]
        ],
        faq: [
            {question: `What does a ${name.toLowerCase()} symbolize?`, answer: `It symbolizes ${principle.toLowerCase()}, biological intelligence, and the survival strategy of reading environments with precision.`},
            {question: `What is the spiritual meaning of a ${name.toLowerCase()}?`, answer: `Spiritually, it represents ${principle.toLowerCase()}, trusting biological wisdom, and learning from natural behavior patterns.`},
            {question: `Why is the ${name.toLowerCase()} associated with ${principle.toLowerCase()}?`, answer: `Its specific biological adaptations demonstrate ${principle.toLowerCase()} as a real survival strategy in nature.`},
            {question: `How does AnimalDex connect ${name.toLowerCase()} symbolism to biology?`, answer: `AnimalDex anchors symbolism in behavior lessons and principle clusters, linking mythic meaning to observable biology.`}
        ],
        sources: [
            {label: `IUCN Red List: ${name}`, href: "https://www.iucnredlist.org/"},
            {label: `National Geographic: ${name}`, href: "https://www.nationalgeographic.com/animals/"},
            {label: "Animal Diversity Web", href: "https://animaldiversity.org/"}
        ],
        relatedSymbolismSlugs: getRelatedSlugs(slug, principle)
    });
}

for (const entry of wave2Posts(getRelatedSlugs)) {
    QUEUE.push(entry);
}

for (const entry of wave3Posts(getRelatedSlugs)) {
    QUEUE.push(entry);
}

function toTsObject(obj, indent = 4) {
    const pad = " ".repeat(indent);
    if (Array.isArray(obj)) {
        if (obj.length === 0) return "[]";
        if (typeof obj[0] === "string") {
            return `[\n${obj.map((s) => `${pad}    ${JSON.stringify(s)}`).join(",\n")}\n${pad}]`;
        }
        return `[\n${obj.map((item) => `${pad}    ${toTsObject(item, indent + 4)}`).join(",\n")}\n${pad}]`;
    }
    if (typeof obj === "object" && obj !== null) {
        const entries = Object.entries(obj);
        return `{\n${entries.map(([k, v]) => `${pad}    ${k}: ${toTsObject(v, indent + 4)}`).join(",\n")}\n${pad}}`;
    }
    return JSON.stringify(obj);
}

const outDir = path.join(process.cwd(), "src/data/blog/symbolism");
mkdirSync(outDir, {recursive: true});

const postExports = [];

for (const entry of QUEUE) {
    const varName = entry.speciesSlug.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Symbolism";
    const fileName = `${entry.speciesSlug}-symbolism.ts`;
    const content = `import {createSymbolismPost} from "./_helpers";

export const ${varName} = createSymbolismPost(${toTsObject(entry)});
`;
    writeFileSync(path.join(outDir, fileName), content);
    postExports.push({varName, fileName: fileName.replace(".ts", "")});
}

const indexContent = postExports.map(({varName, fileName}) => `import {${varName}} from "./${fileName}";`).join("\n")
    + `\n\nexport const generatedSymbolismPosts = [\n${postExports.map(({varName}) => `    ${varName}`).join(",\n")}\n];\n`;

writeFileSync(path.join(outDir, "generated-posts.ts"), indexContent);
console.log(`Generated ${postExports.length} symbolism post files.`);
