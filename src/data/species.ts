import {ContentImage} from "@/data/content-schema";
import {additionalSpeciesEntriesInput} from "@/data/species-expansion-pack";
import {additionalSpeciesEntriesInputTwo} from "@/data/species-expansion-pack-2";
import {additionalSpeciesEntriesInputThree} from "@/data/species-expansion-pack-3";
import {additionalSpeciesEntriesInputFour} from "@/data/species-expansion-pack-4";
import {additionalSpeciesEntriesInputFive} from "@/data/species-expansion-pack-5";
import {additionalSpeciesEntriesInputSix} from "@/data/species-expansion-pack-6";
import {additionalSpeciesEntriesInputSeven} from "@/data/species-expansion-pack-7";
import {additionalSpeciesEntriesInputEight} from "@/data/species-expansion-pack-8";
import {additionalSpeciesEntriesInputNine} from "@/data/species-expansion-pack-9";
import {additionalSpeciesEntriesInputTen} from "@/data/species-expansion-pack-10";
import {additionalSpeciesEntriesInputEleven} from "@/data/species-expansion-pack-11";
import {additionalSpeciesEntriesInputTwelve} from "@/data/species-expansion-pack-12";

export type SpeciesAnalysis = {
    summary: string;
    scientificName: string;
    category: string;
    identification: string[];
    habitat: string;
    nativeRange: string;
    rarityScore: number; // 0-100 where higher means rarer
    rarityReason: string;
};

export type SpeciesPremiumDetails = {
    behaviorTraits: string[];
    whyInteresting: string[];
    respectfulSpotting: string[];
    lookalikes: string[];
};

export type SpeciesEntry = {
    slug: string;
    name: string;
    speciesProfileId?: string;
    normalizedIdentityKey?: string;
    heroTitle: string;
    publishedAt: string;
    updatedAt: string;
    featuredImage: ContentImage;
    searchIntents: string[];
    analysis: SpeciesAnalysis;
    premiumDetails: SpeciesPremiumDetails;
    relatedSpecies: string[];
};

export type SpeciesDirectoryLetter = "all" | string;

export type SpeciesDirectoryPage = {
    entries: SpeciesEntry[];
    total: number;
    totalPages: number;
    currentPage: number;
    query: string;
    letter: SpeciesDirectoryLetter;
};

export const SPECIES_DIRECTORY_PAGE_SIZE = 48;

type SpeciesEntryInput = Omit<SpeciesEntry, "heroTitle" | "publishedAt" | "updatedAt" | "featuredImage" | "searchIntents" | "relatedSpecies" | "premiumDetails"> & {
    premiumDetails?: SpeciesPremiumDetails;
    relatedSpecies?: string[];
    searchIntents?: string[];
};

function buildDefaultPremiumDetails(name: string, analysis: SpeciesAnalysis): SpeciesPremiumDetails {
    return {
        behaviorTraits: [
            `${name} adjusts movement and feeding to match light, temperature, and food access in its habitat.`,
            `Body design, timing, and shelter choices all help this species stay effective in the wild.`,
            `Patient observation usually reveals more behavior than close approach or fast movement.`
        ],
        whyInteresting: [
            `${name} is a useful example of how anatomy and habitat fit together as one survival system.`,
            `Its shape, movement style, and food strategy make it easy to compare with related animals.`,
            `This species turns one page into a lesson about adaptation, ecosystem role, and identification.`
        ],
        respectfulSpotting: [
            "Keep distance and let the animal choose the space.",
            "Avoid blocking movement routes, nesting areas, or feeding behavior.",
            "Use optics, patience, and quiet observation instead of crowding for a closer view."
        ],
        lookalikes: [
            "Regional relatives may look similar at a distance.",
            "Juveniles, adults, and seasonal forms can differ in color or size.",
            "Light, angle, and habitat context can change how field marks appear."
        ]
    };
}

function createSpeciesEntry({
    slug,
    name,
    speciesProfileId,
    normalizedIdentityKey,
    analysis,
    premiumDetails,
    relatedSpecies = [],
    searchIntents = []
}: SpeciesEntryInput): SpeciesEntry {
    const normalizedName = name.toLowerCase();

    return {
        slug,
        name,
        speciesProfileId,
        normalizedIdentityKey: normalizedIdentityKey ?? slug,
        heroTitle: `${name} — Identification, Habitat, Rarity & Facts`,
        publishedAt: "2026-04-10",
        updatedAt: "2026-04-10",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: `${name} species guide on AnimalDex`,
            width: 1200,
            height: 630
        },
        searchIntents: [
            `${normalizedName} identification`,
            `${normalizedName} habitat`,
            `${normalizedName} behavior`,
            `${normalizedName} facts`,
            `${normalizedName} ecosystem role`,
            ...searchIntents
        ],
        analysis,
        premiumDetails: premiumDetails ?? buildDefaultPremiumDetails(name, analysis),
        relatedSpecies
    };
}

function assertUniqueSpeciesSlugs(entries: SpeciesEntry[]) {
    const seen = new Set<string>();

    for (const entry of entries) {
        if (seen.has(entry.slug)) {
            throw new Error(`Duplicate species slug detected: ${entry.slug}`);
        }

        seen.add(entry.slug);
    }

    return entries;
}

const baseSpeciesData: SpeciesEntry[] = [
    {
        slug: "white-headed-vulture",
        name: "White-headed Vulture",
        heroTitle: "White-headed Vulture — Identification, Habitat, Rarity & Facts",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: "White-headed vulture species guide on AnimalDex",
            width: 1200,
            height: 630
        },
        searchIntents: [
            "white-headed vulture identification",
            "white-headed vulture habitat",
            "white-headed vulture rarity",
            "vulture species facts",
            "wildlife identification app"
        ],
        analysis: {
            summary: "The white-headed vulture is a medium-sized African vulture known for its pale head, bold wing contrast, and low population density compared with more common scavengers.",
            scientificName: "Trigonoceps occipitalis",
            category: "Bird of prey",
            identification: [
                "Distinct pale or white head with dark body",
                "Strong black-and-white contrast in flight",
                "Broad wings and heavy hooked beak",
                "Often seen alone or in pairs rather than large feeding flocks"
            ],
            habitat: "Savannah woodland, open dry forest edges, and mixed scrub zones near large mammal ranges.",
            nativeRange: "Sub-Saharan Africa with fragmented populations across eastern, southern, and parts of western regions.",
            rarityScore: 87,
            rarityReason: "Population pressure from poisoning, habitat disturbance, and lower breeding rates has made sightings meaningfully less common than many other African vultures."
        },
        premiumDetails: {
            behaviorTraits: [
                "Often patrols wide areas at height while scanning for carcasses",
                "Can be more solitary than highly social vulture species",
                "Uses strong vision and soaring efficiency to cover large distances"
            ],
            whyInteresting: [
                "Its striking wing pattern makes in-flight recognition rewarding for birders and photographers.",
                "It is a high-value sighting for anyone tracking rarer African raptors.",
                "It helps illustrate how scavengers support ecosystem cleanup and disease reduction."
            ],
            respectfulSpotting: [
                "Keep distance from perches and nesting areas.",
                "Avoid crowding carcass sites where multiple scavengers may gather.",
                "Prioritize observation through optics rather than approaching directly."
            ],
            lookalikes: ["Lappet-faced vulture", "White-backed vulture", "Hooded vulture"]
        },
        relatedSpecies: ["komodo-dragon", "bald-eagle", "african-wild-dog"]
    },
    {
        slug: "komodo-dragon",
        name: "Komodo Dragon",
        heroTitle: "Komodo Dragon — Identification, Habitat, Rarity & Facts",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: "Komodo dragon species guide on AnimalDex",
            width: 1200,
            height: 630
        },
        searchIntents: [
            "komodo dragon facts",
            "komodo dragon habitat",
            "komodo dragon identification",
            "rare reptiles",
            "animal discovery app"
        ],
        analysis: {
            summary: "The Komodo dragon is the largest living lizard, native to a small island range in Indonesia, and famous for its size, power, and apex-predator role.",
            scientificName: "Varanus komodoensis",
            category: "Reptile",
            identification: [
                "Large, heavy-bodied lizard with muscular tail",
                "Long neck and broad head with forked tongue",
                "Rough armored-looking scales in earth-toned coloration",
                "Low ground-hugging walk with powerful stride"
            ],
            habitat: "Dry tropical savannah, monsoon forest edges, and coastal scrub environments with prey access.",
            nativeRange: "Limited island distribution in eastern Indonesia, especially Komodo, Rinca, Flores, and nearby islands.",
            rarityScore: 82,
            rarityReason: "The species has a restricted native range and relies on stable island ecosystems, making population resilience sensitive to habitat and human pressure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Ambush-oriented predator with strong burst capability",
                "Territorial movement patterns around feeding and basking zones",
                "Uses environmental heat for daily activity rhythm"
            ],
            whyInteresting: [
                "It represents an extreme case of island evolution and apex reptile biology.",
                "It is one of the most recognizable flagship reptiles in global wildlife education.",
                "Its limited range makes every responsible sighting context-rich for conservation learning."
            ],
            respectfulSpotting: [
                "Follow ranger guidance and maintain strict safe distance.",
                "Do not attempt close approach for photos.",
                "Observe from designated paths to reduce habitat disturbance."
            ],
            lookalikes: ["Water monitor", "Asian water monitor (juvenile forms)", "Perentie (Australia, not co-located)"]
        },
        relatedSpecies: ["white-headed-vulture", "african-wild-dog", "maine-coon-cat"]
    },
    {
        slug: "maine-coon-cat",
        name: "Maine Coon Cat",
        heroTitle: "Maine Coon Cat — Identification, Habitat, Rarity & Facts",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: "Maine Coon species guide on AnimalDex",
            width: 1200,
            height: 630
        },
        searchIntents: [
            "maine coon identification",
            "maine coon traits",
            "cat breed identifier",
            "animal breed detector",
            "pet breed learning"
        ],
        analysis: {
            summary: "The Maine Coon is a large domestic cat breed known for its robust frame, tufted ears, thick tail, and adaptable, social temperament.",
            scientificName: "Felis catus (Maine Coon breed line)",
            category: "Domestic breed",
            identification: [
                "Large rectangular body with substantial bone structure",
                "Long shaggy coat and prominent mane-like chest fur",
                "Tufted ears and full plume-like tail",
                "Broad muzzle and expressive oval eyes"
            ],
            habitat: "Domestic environments with enough space, enrichment, and regular grooming care.",
            nativeRange: "Breed history associated with North America, now widely distributed through domestic breeding programs globally.",
            rarityScore: 41,
            rarityReason: "It is a popular but still distinctive breed; availability varies by region and breeder standards rather than wild-population constraints."
        },
        premiumDetails: {
            behaviorTraits: [
                "Generally social and people-tolerant with playful persistence",
                "Often comfortable with climbing and interactive toys",
                "Can remain active and curious well into adulthood"
            ],
            whyInteresting: [
                "Combines dramatic appearance with usually gentle social behavior.",
                "Useful breed-learning example for size, coat, and structural identification traits.",
                "Helps users compare domestic breed signals versus wild species traits in the same app."
            ],
            respectfulSpotting: [
                "Prioritize welfare-focused observation and handling.",
                "Avoid assuming breed from a single angle; compare multiple traits.",
                "Use curiosity to learn, not to label with false certainty."
            ],
            lookalikes: ["Norwegian Forest Cat", "Siberian Cat", "Large mixed-breed longhair cats"]
        },
        relatedSpecies: ["komodo-dragon", "bald-eagle", "african-wild-dog"]
    },
    {
        slug: "bald-eagle",
        name: "Bald Eagle",
        heroTitle: "Bald Eagle — Identification, Habitat, Rarity & Facts",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: "Bald eagle species guide on AnimalDex",
            width: 1200,
            height: 630
        },
        searchIntents: [
            "bald eagle identification",
            "bald eagle habitat",
            "raptor facts",
            "wildlife photography app",
            "animal scanner AI"
        ],
        analysis: {
            summary: "The bald eagle is a large North American raptor recognized by adult white head and tail plumage and strong association with large water bodies.",
            scientificName: "Haliaeetus leucocephalus",
            category: "Bird of prey",
            identification: [
                "Adult white head and white tail with dark body",
                "Large yellow hooked bill",
                "Broad wings suited for soaring",
                "Juveniles are mostly dark and gain white markings over years"
            ],
            habitat: "Lakes, rivers, estuaries, and coastal zones with tall nesting or roosting trees.",
            nativeRange: "North America across the United States, Canada, and northern Mexico in seasonal movement patterns.",
            rarityScore: 49,
            rarityReason: "Recovery efforts have improved many populations, but local sighting frequency still depends on water access, season, and habitat quality."
        },
        premiumDetails: {
            behaviorTraits: [
                "Fish-focused hunting with opportunistic feeding behavior",
                "Strong soaring and thermal use over open landscapes",
                "Territorial nesting pairs in suitable habitat"
            ],
            whyInteresting: [
                "A high-visibility raptor for learning age-based plumage changes.",
                "Useful case study in conservation recovery narratives.",
                "Frequently sought by wildlife photographers due to dramatic flight profile."
            ],
            respectfulSpotting: [
                "Keep distance from nests and avoid disturbance during breeding season.",
                "Use long lens photography rather than close approach.",
                "Stay on approved viewing areas near waterways."
            ],
            lookalikes: ["Golden eagle", "Immature bald eagle vs dark raptors", "White-tailed eagle (outside North America)"]
        },
        relatedSpecies: ["white-headed-vulture", "african-wild-dog", "komodo-dragon"]
    },
    {
        slug: "african-wild-dog",
        name: "African Wild Dog",
        heroTitle: "African Wild Dog — Identification, Habitat, Rarity & Facts",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "/images/og-animaldex.svg",
            alt: "African wild dog species guide on AnimalDex",
            width: 1200,
            height: 630
        },
        searchIntents: [
            "african wild dog facts",
            "african wild dog habitat",
            "rare african mammals",
            "safari animal app",
            "wild animal learning app"
        ],
        analysis: {
            summary: "The African wild dog is a highly social carnivore with distinctive patchy coat patterns and cooperative pack behavior.",
            scientificName: "Lycaon pictus",
            category: "Mammal",
            identification: [
                "Large rounded ears with long-legged athletic frame",
                "Irregular patchwork coat patterns unique to individuals",
                "Lean muzzle and deep chest adapted for endurance",
                "Strong pack movement and coordinated behavior"
            ],
            habitat: "Open woodland, savannah, and lightly wooded grassland with space for wide-range pack movement.",
            nativeRange: "Fragmented populations in sub-Saharan Africa, with stronger presence in selected protected landscapes.",
            rarityScore: 88,
            rarityReason: "Habitat fragmentation, disease risk, and human-wildlife conflict contribute to low and scattered population densities."
        },
        premiumDetails: {
            behaviorTraits: [
                "Cooperative hunting and social pup care",
                "High endurance movement over large territories",
                "Complex communication through posture and vocal signals"
            ],
            whyInteresting: [
                "One of the strongest examples of cooperative strategy among wild carnivores.",
                "Patch patterns make individual-level recognition especially engaging for collectors.",
                "Highlights how ecosystem connectivity affects predator survival."
            ],
            respectfulSpotting: [
                "Keep vehicles and observers at non-intrusive distance.",
                "Do not pressure packs during hunts or den activity.",
                "Follow local guide rules in conservation areas."
            ],
            lookalikes: ["Spotted hyena (at distance)", "Jackal species", "Domestic dog hybrids (context dependent)"]
        },
        relatedSpecies: ["white-headed-vulture", "komodo-dragon", "bald-eagle"]
    }
];

const expandedSpeciesData: SpeciesEntry[] = [];

expandedSpeciesData.push(
    createSpeciesEntry({
        slug: "crow",
        name: "Crow",
        analysis: {
            summary: "Crows are highly adaptable songbirds known for strong memory, social learning, and unusual problem-solving ability in both wild and human-shaped environments.",
            scientificName: "Corvus spp.",
            category: "Bird",
            identification: [
                "Glossy black or charcoal plumage with a sturdy straight bill",
                "Broad wings and fan-shaped tail in flight",
                "Confident upright posture and direct ground-walking gait"
            ],
            habitat: "Woodland edges, farmland, cities, coastlines, and open country with reliable food opportunities.",
            nativeRange: "Widespread across much of Europe, Asia, North America, and many islands depending on species.",
            rarityScore: 24,
            rarityReason: "Most crow species remain common because they tolerate disturbance, use diverse foods, and learn quickly around people."
        },
        premiumDetails: {
            behaviorTraits: [
                "Caches food and revisits hiding spots accurately",
                "Uses social warning calls to track predators and human threats",
                "Experiments with objects and routines when food access changes"
            ],
            whyInteresting: [
                "Crows are one of the strongest bird examples of flexible intelligence outside captive studies.",
                "Their behavior shows how learning speed can matter as much as physical specialization."
            ],
            respectfulSpotting: [
                "Watch from a distance around nest season because crows defend young aggressively.",
                "Observe repeated routines over time rather than trying to lure close interaction."
            ],
            lookalikes: ["Raven", "Rook", "Jackdaw"]
        }
    }),
    createSpeciesEntry({
        slug: "barn-owl",
        name: "Barn Owl",
        analysis: {
            summary: "The barn owl is a pale, long-winged nocturnal raptor famous for heart-shaped facial structure, silent flight, and precise sound-based hunting.",
            scientificName: "Tyto alba",
            category: "Bird of prey",
            identification: [
                "Heart-shaped pale face with dark forward-facing eyes",
                "Buff and grey upperparts with pale underparts",
                "Long wings and buoyant ghostlike flight at dusk or night"
            ],
            habitat: "Farmland, grassland, marsh edges, and open country with nest cavities or barns nearby.",
            nativeRange: "Found on every continent except Antarctica, with regional subspecies across temperate and tropical zones.",
            rarityScore: 46,
            rarityReason: "Barn owls can be locally common but depend on prey-rich open land and suitable nesting sites that are easily lost to landscape change."
        },
        premiumDetails: {
            behaviorTraits: [
                "Hunts primarily by sound over fields and rough grass",
                "Uses low, quartering flight to search for small mammals",
                "Roosts quietly in buildings, trees, or cliff cavities by day"
            ],
            whyInteresting: [
                "Its facial disc and ear placement make it one of the clearest examples of acoustic hunting hardware.",
                "Barn owls reward patient dusk observation because their flight profile is instantly memorable."
            ],
            respectfulSpotting: [
                "Avoid entering nest barns or roost cavities during breeding season.",
                "Use edge-of-field vantage points instead of walking directly into hunting areas."
            ],
            lookalikes: ["Short-eared owl", "Masked owl", "Pale harrier at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "chameleon",
        name: "Chameleon",
        analysis: {
            summary: "Chameleons are visually specialized lizards built for slow arboreal hunting, color change, and precise tongue-based prey capture.",
            scientificName: "Chamaeleonidae",
            category: "Reptile",
            identification: [
                "Laterally compressed body with turret-like eyes",
                "Grasping feet and often a curled prehensile tail",
                "Slow swaying movement through branches and shrubs"
            ],
            habitat: "Forest edges, scrub, savannah woodland, and garden habitats with vertical structure and insect prey.",
            nativeRange: "Most diverse in Madagascar and Africa, with additional species in southern Europe, the Middle East, and Asia.",
            rarityScore: 58,
            rarityReason: "Some chameleons are widespread, but many species have small ranges and lose ground quickly when forests and shrub habitats are fragmented."
        },
        premiumDetails: {
            behaviorTraits: [
                "Tracks different parts of the scene with independently moving eyes",
                "Holds still for long periods before rapid tongue projection",
                "Uses posture and color shifts for stress, display, and thermal regulation"
            ],
            whyInteresting: [
                "Chameleons combine visual surveillance and ballistic feeding in a very compact design.",
                "They are strong examples of how patience can be an active hunting strategy."
            ],
            respectfulSpotting: [
                "Search branches slowly instead of handling vegetation aggressively.",
                "Do not force color-change responses by crowding or touching the animal."
            ],
            lookalikes: ["Anole species", "Leaf-tailed gecko", "Small iguanian lizards"]
        }
    }),
    createSpeciesEntry({
        slug: "crocodile",
        name: "Crocodile",
        analysis: {
            summary: "Crocodiles are powerful semi-aquatic predators built for ambush, with pressure-sensitive jaws, armored bodies, and explosive short-range acceleration.",
            scientificName: "Crocodylidae",
            category: "Reptile",
            identification: [
                "Long V-shaped snout with exposed teeth even when mouth is closed",
                "Armored body and muscular tail adapted for water propulsion",
                "Eyes and nostrils placed high on the head near the skull top"
            ],
            habitat: "Rivers, estuaries, mangroves, floodplains, swamps, and shorelines with reliable basking and ambush cover.",
            nativeRange: "Tropical and subtropical Africa, Asia, Australia, and the Americas depending on species.",
            rarityScore: 61,
            rarityReason: "Some crocodile species remain stable, but many populations are constrained by wetland loss, persecution, and nesting disturbance."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits motionless at access points used by prey",
                "Uses short explosive lunges rather than long chases",
                "Basks to manage body temperature and digestion"
            ],
            whyInteresting: [
                "Crocodiles are classic edge predators whose design is built around terrain control more than speed.",
                "They show how ancient reptile body plans can remain brutally effective."
            ],
            respectfulSpotting: [
                "Stay well back from river margins and launch sites in crocodile habitat.",
                "Never assume a still animal is inactive or uninterested."
            ],
            lookalikes: ["Alligator", "Gharial", "Large caiman"]
        }
    }),
    createSpeciesEntry({
        slug: "dolphin",
        name: "Dolphin",
        analysis: {
            summary: "Dolphins are fast, social marine mammals known for echolocation, coordinated hunting, and flexible behavior in dynamic coastal and open-water systems.",
            scientificName: "Delphinidae",
            category: "Marine mammal",
            identification: [
                "Streamlined grey body with a beak-like snout in many species",
                "Curved dorsal fin and powerful tail flukes",
                "Smooth porpoising movement and frequent surfacing in groups"
            ],
            habitat: "Coastal seas, estuaries, offshore waters, and occasionally large river systems depending on species.",
            nativeRange: "Found worldwide from temperate to tropical oceans, with different species occupying regional marine zones.",
            rarityScore: 43,
            rarityReason: "Several dolphin species are still widespread, but local abundance can drop where bycatch, pollution, or vessel pressure remain high."
        },
        premiumDetails: {
            behaviorTraits: [
                "Coordinates group hunting around fish schools and shallow edges",
                "Uses echolocation clicks to read underwater structure and prey",
                "Maintains strong social bonds through whistles, posture, and synchronized movement"
            ],
            whyInteresting: [
                "Dolphins are among the clearest marine examples of intelligence fused with real-time sensing.",
                "They are useful for studying how communication and movement scale together in open environments."
            ],
            respectfulSpotting: [
                "Observe from regulated distances and never angle boats into moving pods.",
                "Let dolphins choose approach distance rather than chasing surface activity."
            ],
            lookalikes: ["Porpoise", "Small whale species", "Juvenile pilot whale"]
        }
    }),
    createSpeciesEntry({
        slug: "eagle",
        name: "Eagle",
        analysis: {
            summary: "Eagles are large predatory birds recognized for exceptional eyesight, soaring flight, and powerful talons used to capture prey across open landscapes and waterways.",
            scientificName: "Aquila and related eagle genera",
            category: "Bird of prey",
            identification: [
                "Large broad-winged raptor with heavy hooked bill",
                "Powerful feet and thick legs built for gripping prey",
                "High soaring flight with strong, deliberate wingbeats"
            ],
            habitat: "Mountains, cliffs, open woodland, steppe, rivers, coasts, and lakes with hunting space and perches.",
            nativeRange: "Eagle species occur across every continent except Antarctica, with different lineages adapted to regional landscapes.",
            rarityScore: 54,
            rarityReason: "Some eagle species remain widespread, but many are limited by persecution, poisoning, disturbance, and loss of nesting territory."
        },
        premiumDetails: {
            behaviorTraits: [
                "Scans large hunting areas from altitude or exposed perches",
                "Uses thermals and ridge lift to conserve energy",
                "Captures prey with a fast drop or short low chase"
            ],
            whyInteresting: [
                "Eagles make the relationship between vantage point and predatory success unusually easy to see.",
                "They are signature animals for photographers because their flight silhouette reads clearly at distance."
            ],
            respectfulSpotting: [
                "Avoid climbing near active nests or cliff roosts.",
                "Use long observation windows rather than trying to force close flight views."
            ],
            lookalikes: ["Large hawk", "Vulture at distance", "Immature sea eagle"]
        }
    }),
    createSpeciesEntry({
        slug: "elephant",
        name: "Elephant",
        analysis: {
            summary: "Elephants are large social herbivores with remarkable memory, trunk dexterity, and major influence on habitat structure wherever they still roam freely.",
            scientificName: "Elephantidae",
            category: "Mammal",
            identification: [
                "Massive body with pillar-like legs and swinging trunk",
                "Large ears and curved tusks in many adults",
                "Slow but purposeful group movement across open ground or forest tracks"
            ],
            habitat: "Savannah, woodland, dry forest, floodplain, and tropical forest with access to food, shade, and water.",
            nativeRange: "Africa and parts of South and Southeast Asia depending on species.",
            rarityScore: 77,
            rarityReason: "Elephants need large connected landscapes, and many populations remain under pressure from habitat fragmentation, conflict, and illegal killing."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses trunk touch, low rumbles, and posture in social coordination",
                "Remembers water routes and seasonal food areas across long distances",
                "Modifies vegetation by pushing, stripping, and digging"
            ],
            whyInteresting: [
                "Elephants are ecosystem-scale animals whose movement changes opportunities for other species.",
                "Their behavior links memory, family structure, and landscape engineering in one visible package."
            ],
            respectfulSpotting: [
                "Keep vehicles predictable and give herds clear room to move.",
                "Never block access between mothers, calves, and water."
            ],
            lookalikes: ["Asian elephant", "African bush elephant", "African forest elephant"]
        }
    }),
    createSpeciesEntry({
        slug: "firefly",
        name: "Firefly",
        analysis: {
            summary: "Fireflies are soft-bodied beetles famous for bioluminescent signaling, precise flash timing, and dusk or nighttime courtship displays in humid habitats.",
            scientificName: "Lampyridae",
            category: "Insect",
            identification: [
                "Small elongated beetle body with soft wing covers",
                "Light-producing segment on the abdomen in glowing stages",
                "Blinking or pulsing greenish-yellow flashes at night"
            ],
            habitat: "Moist grassland, woodland edges, wetlands, gardens, and stream corridors with low nighttime disturbance.",
            nativeRange: "Firefly species occur across much of the world, especially in warm temperate and tropical regions.",
            rarityScore: 52,
            rarityReason: "Some fireflies remain common locally, but many populations decline where light pollution, pesticides, and wet habitat loss intensify."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses species-specific flash patterns for mate recognition",
                "Depends on calm low-light conditions for effective signaling",
                "Larvae often hunt small invertebrates in damp ground or leaf litter"
            ],
            whyInteresting: [
                "Fireflies turn communication itself into the main visible event of the species.",
                "They are useful indicators of how nighttime habitat quality is changing."
            ],
            respectfulSpotting: [
                "Use dim red light instead of bright phone torches around active displays.",
                "Avoid trampling damp grass or stream edges where larvae develop."
            ],
            lookalikes: ["Click beetle with light organs", "Small moths at dusk", "Glowworm species"]
        }
    }),
    createSpeciesEntry({
        slug: "honey-bee",
        name: "Honey Bee",
        analysis: {
            summary: "Honey bees are social pollinators that collect nectar and pollen, coordinate foraging through shared signals, and help connect flowering plants to wider food systems.",
            scientificName: "Apis mellifera",
            category: "Insect",
            identification: [
                "Compact fuzzy body with striped amber and dark abdomen",
                "Pollen baskets on hind legs in working females",
                "Fast direct flower-to-hive flight paths in productive weather"
            ],
            habitat: "Woodland edges, farmland, gardens, orchards, and meadows with dense flowering resources and nest cavities or hives.",
            nativeRange: "Originally from Africa, Europe, and western Asia, now widely managed and naturalized around the world.",
            rarityScore: 39,
            rarityReason: "Honey bees are widespread through wild and managed colonies, though colony health can drop sharply under disease, pesticide, and forage stress."
        },
        premiumDetails: {
            behaviorTraits: [
                "Shares foraging direction through waggle dance communication",
                "Regulates hive temperature through clustered movement and wing fanning",
                "Collects different floral resources depending on colony demand"
            ],
            whyInteresting: [
                "Honey bees make pollination logistics visible at a scale people can understand quickly.",
                "Their colonies demonstrate how group-level coordination can outperform strong individual units."
            ],
            respectfulSpotting: [
                "Watch flowering patches calmly instead of standing in active flight lines.",
                "Do not block hive entrances or disturb managed boxes in hot weather."
            ],
            lookalikes: ["Bumblebee", "Hoverfly", "Solitary bee species"]
        }
    }),
    createSpeciesEntry({
        slug: "jellyfish",
        name: "Jellyfish",
        analysis: {
            summary: "Jellyfish are gelatinous marine drifters that capture prey with stinging cells and can become highly abundant when ocean conditions favor low-cost bloom dynamics.",
            scientificName: "Scyphozoa and related medusozoans",
            category: "Marine invertebrate",
            identification: [
                "Bell-shaped translucent body with trailing oral arms or tentacles",
                "Rhythmic pulsing movement through the water column",
                "Often visible as drifting clusters in calm or bloom conditions"
            ],
            habitat: "Coastal seas, open ocean, bays, estuaries, and nutrient-rich surface waters depending on species.",
            nativeRange: "Jellyfish occur worldwide from tropical coasts to cold ocean systems.",
            rarityScore: 28,
            rarityReason: "Many jellyfish species are common and can bloom rapidly when marine conditions, food availability, and predator pressure align."
        },
        premiumDetails: {
            behaviorTraits: [
                "Captures plankton and small prey with stinging tentacles",
                "Rides currents while pulsing enough to adjust depth or direction",
                "Forms sudden local concentrations under favorable conditions"
            ],
            whyInteresting: [
                "Jellyfish show how simple body plans can still dominate under the right environmental rules.",
                "Their blooms often reveal broader imbalance in marine systems."
            ],
            respectfulSpotting: [
                "Check local water warnings before swimming in bloom season.",
                "Do not handle stranded animals because tentacles can still sting."
            ],
            lookalikes: ["Salp chains", "Comb jellies", "Floating plastic debris at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "jumping-spider",
        name: "Jumping Spider",
        analysis: {
            summary: "Jumping spiders are visually oriented hunting spiders known for excellent depth perception, curious posture, and accurate short-range leaps onto prey.",
            scientificName: "Salticidae",
            category: "Arachnid",
            identification: [
                "Compact hairy body with large forward-facing eyes",
                "Short legs and alert stop-start movement on surfaces",
                "Frequent head and body turns that suggest active visual tracking"
            ],
            habitat: "Walls, bark, shrubs, leaf litter, grass stems, and sunny edges with abundant small insects.",
            nativeRange: "Jumping spiders occur worldwide, with especially high diversity in warm regions.",
            rarityScore: 21,
            rarityReason: "Many jumping spider species are common at small scales and thrive where insects, sunlight, and structure are available."
        },
        premiumDetails: {
            behaviorTraits: [
                "Tracks prey carefully before a single committed jump",
                "Uses silk safety lines during leaps and escapes",
                "Relies heavily on vision instead of web traps for feeding"
            ],
            whyInteresting: [
                "Their hunting style makes spider decision-making unusually easy to observe directly.",
                "They are some of the best ambassadors for how much sensory precision can fit into a tiny body."
            ],
            respectfulSpotting: [
                "Watch from close range without casting sudden shadows over the animal.",
                "Leave webs, retreat lines, and bark crevices intact while observing."
            ],
            lookalikes: ["Wolf spider juvenile", "Crab spider", "Small orb-weaver off web"]
        }
    }),
    createSpeciesEntry({
        slug: "king-cobra",
        name: "King Cobra",
        analysis: {
            summary: "The king cobra is the world’s longest venomous snake, known for its height when threatened, strong chemosensory tracking, and specialization on reptile prey.",
            scientificName: "Ophiophagus hannah",
            category: "Reptile",
            identification: [
                "Very long olive, brown, or dark body with narrow pale banding",
                "Large head and neck hood raised high above ground when alert",
                "Smooth powerful movement through forest floor or bamboo cover"
            ],
            habitat: "Tropical forest, swamp forest, bamboo thicket, agricultural edge, and streamside cover with abundant snakes.",
            nativeRange: "South and Southeast Asia from India to southern China, Indonesia, and the Philippines.",
            rarityScore: 71,
            rarityReason: "The species covers a wide region but becomes uncommon where intact forest, prey availability, and nesting cover decline."
        },
        premiumDetails: {
            behaviorTraits: [
                "Tracks prey through scent particles gathered by the tongue",
                "Feeds heavily on other snakes and occasionally lizards",
                "Builds and guards a nest, which is unusual for snakes"
            ],
            whyInteresting: [
                "King cobras combine scale, specialization, and defensive presence in a way few reptiles do.",
                "They are especially useful for explaining how predator niches can narrow instead of broaden."
            ],
            respectfulSpotting: [
                "Keep extreme distance and never approach a raised or hooded animal.",
                "Use trained local guides in forest habitats where the species occurs."
            ],
            lookalikes: ["Rat snake", "Spectacled cobra", "Large keelback species at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "mantis-shrimp",
        name: "Mantis Shrimp",
        analysis: {
            summary: "Mantis shrimp are reef-dwelling crustaceans with extraordinary visual systems and spring-loaded raptorial limbs used for smashing or spearing prey.",
            scientificName: "Stomatopoda",
            category: "Marine crustacean",
            identification: [
                "Elongated segmented body with vivid green, blue, or red coloration in many species",
                "Large mobile stalked eyes that scan constantly",
                "Powerful folded front limbs held beneath the head"
            ],
            habitat: "Coral reef slopes, rubble fields, sandy burrows, and tropical coastal shallows.",
            nativeRange: "Tropical and subtropical seas worldwide, especially around Indo-Pacific reefs.",
            rarityScore: 57,
            rarityReason: "Mantis shrimp are locally present on healthy reefs but often missed because many stay hidden in burrows and emerge briefly."
        },
        premiumDetails: {
            behaviorTraits: [
                "Defends burrows aggressively against rivals and intruders",
                "Uses visual displays and sudden strikes during conflict",
                "Specializes either in smashing shells or spearing soft prey depending on lineage"
            ],
            whyInteresting: [
                "Few animals pair such unusual vision with such extreme mechanical force.",
                "They are standout examples of reef specialization rather than general marine flexibility."
            ],
            respectfulSpotting: [
                "Watch burrow entrances without probing or flipping reef rubble.",
                "Avoid putting hands into crevices where hidden individuals may strike."
            ],
            lookalikes: ["Pistol shrimp", "Small lobster juvenile", "Reef mantis nymph stages"]
        }
    }),
    createSpeciesEntry({
        slug: "octopus",
        name: "Octopus",
        analysis: {
            summary: "Octopuses are soft-bodied marine hunters known for flexible problem-solving, camouflage, dexterous arms, and rapid escape through tight spaces.",
            scientificName: "Octopoda",
            category: "Marine invertebrate",
            identification: [
                "Rounded mantle with eight muscular arms bearing suckers",
                "Color and texture shifts that can alter appearance quickly",
                "Fluid body shape able to flatten or squeeze into crevices"
            ],
            habitat: "Rocky reefs, coral rubble, seagrass beds, tidal pools, and seafloor dens from shallow water to depth.",
            nativeRange: "Found in oceans worldwide, with highest diversity in tropical and temperate marine habitats.",
            rarityScore: 49,
            rarityReason: "Octopuses are widespread globally, but many are secretive, short-lived, and easiest to detect in specific reef or den habitats."
        },
        premiumDetails: {
            behaviorTraits: [
                "Explores dens, shells, and objects with highly sensitive arms",
                "Uses camouflage, ink, and sudden escape bursts under threat",
                "Hunts crabs, mollusks, and fish with deliberate positioning"
            ],
            whyInteresting: [
                "Octopuses are among the clearest examples of non-vertebrate intelligence at work.",
                "Their body plan makes flexibility itself part of the survival strategy."
            ],
            respectfulSpotting: [
                "Do not poke dens or force the animal into the open for photos.",
                "Keep fins, hands, and lights away from resting crevice entrances."
            ],
            lookalikes: ["Cuttlefish", "Squid juvenile", "Mimic octopus variants"]
        }
    }),
    createSpeciesEntry({
        slug: "orangutan",
        name: "Orangutan",
        analysis: {
            summary: "Orangutans are large arboreal apes famous for deliberate movement, long learning periods, and strong dependence on complex tropical forest canopies.",
            scientificName: "Pongo spp.",
            category: "Mammal",
            identification: [
                "Long reddish fur with very long arms and grasping hands",
                "Slow controlled climbing in the upper forest canopy",
                "Large adult males may show broad cheek pads and throat sacs"
            ],
            habitat: "Lowland rainforest, peat swamp forest, hill forest, and mixed tropical canopy systems.",
            nativeRange: "Restricted to Borneo and Sumatra, with different species and isolated populations across remaining forests.",
            rarityScore: 89,
            rarityReason: "Orangutans are highly threatened by deforestation, fragmentation, and conflict in a very limited geographic range."
        },
        premiumDetails: {
            behaviorTraits: [
                "Builds fresh night nests in trees from bent branches and leaves",
                "Learns food routes, seasonal fruit timing, and travel structure over years",
                "Moves carefully to avoid falls and wasted energy in the canopy"
            ],
            whyInteresting: [
                "Orangutans reveal how intelligence can be shaped by long-term forest memory rather than social crowding.",
                "They are key flagship animals for Southeast Asian rainforest conservation."
            ],
            respectfulSpotting: [
                "Keep strict disease-safe distance and follow all sanctuary or field guide rules.",
                "Observe quietly from below rather than trying to reposition under every movement."
            ],
            lookalikes: ["Gibbon at distance", "Young gorilla in images", "Proboscis monkey in canopy silhouette"]
        }
    }),
    createSpeciesEntry({
        slug: "termite",
        name: "Termite",
        analysis: {
            summary: "Termites are social insects that process plant material, build climate-regulating mounds, and quietly reshape soil and nutrient systems.",
            scientificName: "Isoptera within Blattodea",
            category: "Insect",
            identification: [
                "Pale soft-bodied workers or darker soldiers depending on caste",
                "Mud tubes, pellet traces, or mound architecture near colonies",
                "Winged alates emerging seasonally in humid weather"
            ],
            habitat: "Savannah, woodland, tropical forest, dry scrub, and built environments with cellulose-rich material and workable soil.",
            nativeRange: "Termites occur globally except in the coldest high-latitude regions, with highest diversity in tropical and subtropical areas.",
            rarityScore: 18,
            rarityReason: "Most termite groups are common and often locally abundant because they exploit widespread plant matter and organized colony living."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses caste specialization for feeding, defense, and reproduction",
                "Maintains humidity and airflow through mound or nest structure",
                "Relies on gut microbes to break down cellulose-rich food"
            ],
            whyInteresting: [
                "Termites are major ecosystem engineers disguised as small insects.",
                "Their colonies are strong case studies in decentralized construction and material conversion."
            ],
            respectfulSpotting: [
                "Observe mound surfaces without kicking or opening chambers.",
                "Look for foraging lines after rain rather than tearing apart logs."
            ],
            lookalikes: ["Ants", "Booklice in wood", "Winged ant swarms"]
        }
    }),
    createSpeciesEntry({
        slug: "tiger",
        name: "Tiger",
        analysis: {
            summary: "The tiger is a large striped cat built for stealth, ambush, and territorial control across forests, wetlands, and grassland edges in Asia.",
            scientificName: "Panthera tigris",
            category: "Mammal",
            identification: [
                "Orange coat with black vertical striping and white facial markings",
                "Massive forequarters and deep chest on a flexible cat frame",
                "Large round paw prints and low deliberate stalking movement"
            ],
            habitat: "Tropical forest, temperate woodland, mangrove, riverine grassland, and swampy edge habitats with cover and prey.",
            nativeRange: "Now fragmented across parts of South Asia, Southeast Asia, the Russian Far East, and isolated protected landscapes.",
            rarityScore: 86,
            rarityReason: "Tigers have lost much of their range and remain limited by habitat fragmentation, prey decline, and conflict pressure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses cover and patience to close distance before attack",
                "Maintains scent-marked territories with overlap patterns shaped by sex and prey",
                "Often drags kills into cover before feeding"
            ],
            whyInteresting: [
                "Tigers are one of the clearest examples of solitary ambush design among large predators.",
                "Their presence strongly influences prey movement and landscape fear patterns."
            ],
            respectfulSpotting: [
                "Follow park distance rules and stay quiet on road or river approaches.",
                "Never pressure a resting cat for a better angle or movement shot."
            ],
            lookalikes: ["Leopard at poor angle", "Large feral cat in low light", "Jaguar in captive comparison only"]
        }
    }),
    createSpeciesEntry({
        slug: "whale-shark",
        name: "Whale Shark",
        analysis: {
            summary: "The whale shark is the largest fish on Earth, a slow-moving filter feeder that cruises productive tropical waters for plankton and small schooling prey.",
            scientificName: "Rhincodon typus",
            category: "Marine fish",
            identification: [
                "Huge broad head and terminal mouth on a thick torpedo-like body",
                "White spots and pale lines arranged over dark grey-blue skin",
                "Very wide tail and slow unhurried swimming near the surface when feeding"
            ],
            habitat: "Warm coastal waters, offshore fronts, reefs, and seasonal plankton aggregation sites.",
            nativeRange: "Tropical and warm temperate oceans worldwide.",
            rarityScore: 74,
            rarityReason: "Whale sharks range widely but are vulnerable to vessel strikes, fishing pressure, and dependence on specific seasonal feeding hotspots."
        },
        premiumDetails: {
            behaviorTraits: [
                "Filter feeds near dense plankton or fish spawn events",
                "Travels long distances between productive marine zones",
                "Often tolerates shallow surface feeding when conditions are right"
            ],
            whyInteresting: [
                "Whale sharks are striking examples of giant size built around filtering rather than high-speed predation.",
                "They are flagship species for marine tourism, but also for careful management of wildlife encounters."
            ],
            respectfulSpotting: [
                "Keep fins, cameras, and boats clear of the animal’s path.",
                "Do not block the head or feeding line during surface passes."
            ],
            lookalikes: ["Basking shark", "Large shark silhouette from above", "Manta ray at quick glance"]
        }
    }),
    createSpeciesEntry({
        slug: "wolf",
        name: "Wolf",
        analysis: {
            summary: "Wolves are endurance-based pack predators known for long-range movement, coordinated hunting, and strong influence on prey behavior across large territories.",
            scientificName: "Canis lupus",
            category: "Mammal",
            identification: [
                "Long-legged canid with broad chest and straight-backed profile",
                "Thick fur, bushy tail, and large narrow muzzle",
                "Purposeful ground-covering trot rather than erratic domestic dog movement"
            ],
            habitat: "Forest, tundra, steppe, mountain, and mixed wild landscapes with space for long-distance travel.",
            nativeRange: "Parts of North America, Europe, the Middle East, and Asia in surviving wild populations.",
            rarityScore: 63,
            rarityReason: "Wolves remain widespread in some regions but are absent or tightly managed in many others due to persecution and habitat fragmentation."
        },
        premiumDetails: {
            behaviorTraits: [
                "Maintains pack cohesion through scent, posture, and vocal communication",
                "Uses long pursuit and coordinated testing to isolate prey",
                "Travels large distances while monitoring territory boundaries"
            ],
            whyInteresting: [
                "Wolves make social coordination and top-down landscape effects unusually visible.",
                "Their behavior is central to modern discussions about predator-driven ecosystem recovery."
            ],
            respectfulSpotting: [
                "Observe from distance with optics and avoid denning areas completely.",
                "Do not feed or habituate roadside animals in wolf country."
            ],
            lookalikes: ["Large domestic dog", "Coyote", "Golden jackal"]
        }
    }),
    createSpeciesEntry({
        slug: "lion",
        name: "Lion",
        analysis: {
            summary: "Lions are social big cats recognized for pride living, coordinated hunts, and heavy-bodied strength on open African landscapes and a small remnant Asian range.",
            scientificName: "Panthera leo",
            category: "Mammal",
            identification: [
                "Large tawny cat with tufted tail and heavy forequarters",
                "Adult males often carry a mane around neck and chest",
                "Broad face and powerful shoulder build compared with leopards"
            ],
            habitat: "Savannah, dry woodland, scrub, and open plains with prey herds and resting cover.",
            nativeRange: "Most wild lions remain in sub-Saharan Africa, with a small surviving population in western India.",
            rarityScore: 72,
            rarityReason: "Lions remain iconic but have lost range and density through habitat pressure, prey decline, and conflict with livestock systems."
        },
        premiumDetails: {
            behaviorTraits: [
                "Rest for long hours and concentrate activity in cooler periods",
                "Females often coordinate group hunts around herd movement",
                "Uses roaring and scent marking to advertise territory"
            ],
            whyInteresting: [
                "Lions are one of the few truly social big cats, which changes how they hunt and defend space.",
                "They are highly visible examples of predator-prey dynamics on open ground."
            ],
            respectfulSpotting: [
                "Give resting prides space and never pressure vehicles around cubs.",
                "Watch herd reactions as well as the cats for a fuller behavioral picture."
            ],
            lookalikes: ["Lioness vs large leopard at distance", "Subadult male lion", "Captive hybrid big cats in photos"]
        }
    }),
    createSpeciesEntry({
        slug: "red-fox",
        name: "Red Fox",
        analysis: {
            summary: "The red fox is a versatile medium-sized canid known for sharp hearing, adaptable diet, and success in habitats ranging from remote countryside to cities.",
            scientificName: "Vulpes vulpes",
            category: "Mammal",
            identification: [
                "Reddish coat with pale underside and black lower legs",
                "Long narrow muzzle and large pointed ears",
                "Very bushy tail often tipped with white"
            ],
            habitat: "Farmland, woodland edge, suburban green space, steppe, moor, and open country with cover.",
            nativeRange: "Widespread across North America, Europe, Asia, and introduced in Australia.",
            rarityScore: 23,
            rarityReason: "Red foxes remain common across huge areas because they exploit varied prey and human-altered landscapes effectively."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses acute hearing to pinpoint prey under vegetation or snow",
                "Adjusts diet quickly from rodents to fruit, carrion, and insects",
                "Travels regular routes between cover, resting sites, and feeding patches"
            ],
            whyInteresting: [
                "Red foxes are excellent examples of adaptable predator behavior in changing environments.",
                "They are easy to compare against wolves and jackals when learning canid shape differences."
            ],
            respectfulSpotting: [
                "Observe quietly at dawn or dusk instead of approaching den sites.",
                "Do not feed urban foxes, which pushes them into risky human dependence."
            ],
            lookalikes: ["Gray fox", "Golden jackal", "Small domestic dog"]
        }
    }),
    createSpeciesEntry({
        slug: "snow-leopard",
        name: "Snow Leopard",
        analysis: {
            summary: "Snow leopards are high-mountain cats built for cold, steep terrain, with long balancing tails, pale patterned coats, and elusive solitary behavior.",
            scientificName: "Panthera uncia",
            category: "Mammal",
            identification: [
                "Pale grey coat with smoky rosettes and thick fur",
                "Very long heavy tail often carried curved behind the body",
                "Short muzzle and wide paws adapted for rock and snow travel"
            ],
            habitat: "Cold alpine and subalpine slopes, rocky ravines, and broken highland terrain.",
            nativeRange: "Central and South Asian mountain systems from the Himalaya to Mongolia.",
            rarityScore: 84,
            rarityReason: "Snow leopards occur across a broad mountain belt but remain thinly distributed and difficult to monitor in rugged terrain."
        },
        premiumDetails: {
            behaviorTraits: [
                "Moves along ridgelines, saddles, and cliff routes used by prey",
                "Hunts blue sheep, ibex, and other mountain ungulates by ambush",
                "Uses scent marking on rock features to communicate territory"
            ],
            whyInteresting: [
                "Snow leopards are among the best examples of terrain-specialized big-cat design.",
                "Their rarity and habitat make every responsible sighting especially valuable."
            ],
            respectfulSpotting: [
                "Use high-powered optics and never attempt off-route pursuit in mountain habitat.",
                "Work with local trackers who prioritize den and prey-area protection."
            ],
            lookalikes: ["Leopard in pale coat", "Lynx at long range", "Goat silhouette on rock in low light"]
        }
    }),
    createSpeciesEntry({
        slug: "giant-panda",
        name: "Giant Panda",
        analysis: {
            summary: "The giant panda is a large bamboo-feeding bear with distinctive black-and-white patterning, powerful jaws, and highly specialized forest foraging behavior.",
            scientificName: "Ailuropoda melanoleuca",
            category: "Mammal",
            identification: [
                "Bold black-and-white coat with dark eye patches",
                "Heavy rounded body and broad powerful head",
                "Slow deliberate movement through dense bamboo stands"
            ],
            habitat: "Cool moist mountain forest with dense bamboo understorey.",
            nativeRange: "Restricted to fragmented mountain ranges in central China.",
            rarityScore: 79,
            rarityReason: "Protection has improved status in parts of its range, but the species remains tied to specific bamboo forests and fragmented mountain habitat."
        },
        premiumDetails: {
            behaviorTraits: [
                "Spends long periods feeding on bamboo stems and shoots",
                "Uses a modified wrist bone as a pseudo-thumb for grasping",
                "Maintains mostly solitary spacing outside breeding interactions"
            ],
            whyInteresting: [
                "Giant pandas are an unusual example of a bear lineage pushed toward a narrow feeding niche.",
                "Their body plan shows how powerful hardware can still be shaped by a low-energy diet."
            ],
            respectfulSpotting: [
                "Stay on managed observation routes in reserve or park settings.",
                "Keep noise low because bamboo foragers can be easy to disturb in dense cover."
            ],
            lookalikes: ["Spectacled bear in photos only", "Sun bear cub color confusion", "Black-and-white domestic animals in poor images"]
        }
    }),
    createSpeciesEntry({
        slug: "giraffe",
        name: "Giraffe",
        analysis: {
            summary: "Giraffes are towering browsing mammals with long necks, patterned coats, and specialized circulation and feeding adaptations for life above most other herbivores.",
            scientificName: "Giraffa camelopardalis",
            category: "Mammal",
            identification: [
                "Extremely long neck and legs on a steep-backed body",
                "Patchwork coat pattern unique in shape and tone by individual and population",
                "Small horn-like ossicones above the head"
            ],
            habitat: "Savannah, open woodland, thorn scrub, and lightly wooded browsing country.",
            nativeRange: "Sub-Saharan Africa in scattered regional populations.",
            rarityScore: 68,
            rarityReason: "Giraffes are still visible in strongholds but have declined significantly in several parts of their range through habitat loss and pressure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Browses high foliage that shorter herbivores cannot easily reach",
                "Moves in loose social groupings rather than tight permanent herds",
                "Uses elevated vantage and strong kicks for predator awareness and defense"
            ],
            whyInteresting: [
                "Giraffes show how feeding height can become a major ecological advantage.",
                "Their circulation and skeletal proportions make them biologically distinctive even among large herbivores."
            ],
            respectfulSpotting: [
                "Keep vehicles from crowding water access or crossing travel lines.",
                "Observe feeding behavior quietly because repeated startle responses waste energy."
            ],
            lookalikes: ["Young giraffe vs okapi in photographs", "Camel silhouette at poor angle", "Tall antelope from extreme distance"]
        }
    }),
    createSpeciesEntry({
        slug: "plains-zebra",
        name: "Plains Zebra",
        analysis: {
            summary: "The plains zebra is a striped African grazer built for open-country movement, herd vigilance, and rapid escape across predator-rich grassland.",
            scientificName: "Equus quagga",
            category: "Mammal",
            identification: [
                "Bold black-and-white stripes across body and legs",
                "Short upright mane and horse-like head profile",
                "Stocky athletic build with fast coordinated herd movement"
            ],
            habitat: "Savannah, open grassland, lightly wooded plains, and seasonal grazing country near water.",
            nativeRange: "Eastern and southern Africa across a wide but fragmented regional range.",
            rarityScore: 44,
            rarityReason: "Plains zebras remain common in some ecosystems, though fencing, land conversion, and local pressure reduce free movement in others."
        },
        premiumDetails: {
            behaviorTraits: [
                "Travels in herds that rely on many eyes and ears at once",
                "Uses explosive acceleration and erratic line changes to evade predators",
                "Maintains strong mother-young recognition through sound and stripe pattern"
            ],
            whyInteresting: [
                "Zebras are useful for understanding how group vigilance shapes open-habitat survival.",
                "Their striping remains a strong visual field mark even under harsh light."
            ],
            respectfulSpotting: [
                "Watch herd spacing and alarm posture before moving closer with a vehicle.",
                "Avoid separating animals at water or road crossings."
            ],
            lookalikes: ["Mountain zebra", "Grevy's zebra", "Escaped domestic equid at long range"]
        }
    })
);

expandedSpeciesData.push(
    createSpeciesEntry({
        slug: "red-kangaroo",
        name: "Red Kangaroo",
        analysis: {
            summary: "The red kangaroo is Australia’s largest marsupial, built for efficient hopping, heat management, and long-distance movement across dry open country.",
            scientificName: "Osphranter rufus",
            category: "Mammal",
            identification: [
                "Tall upright body with huge hind legs and thick balancing tail",
                "Reddish coat in many males and greyer tones in females",
                "Long bounding travel with forelimbs held close to the chest"
            ],
            habitat: "Arid grassland, desert scrub, and open semi-arid plains with scattered cover.",
            nativeRange: "Widespread across inland Australia.",
            rarityScore: 27,
            rarityReason: "Red kangaroos remain common over large areas where open rangeland and seasonal forage persist."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses elastic tendons to travel efficiently over long distances",
                "Feeds mostly at cooler times of day and night",
                "Groups loosely around water and fresh grazing after rain"
            ],
            whyInteresting: [
                "The species is a strong example of locomotion built around energy savings rather than constant speed.",
                "Its body plan is instantly recognizable and highly regional."
            ],
            respectfulSpotting: [
                "Watch from roadsides or tracks without pushing animals into repeated crossings.",
                "Give extra space in heat when kangaroos are conserving energy."
            ],
            lookalikes: ["Eastern grey kangaroo", "Wallaroo", "Large wallaby at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "koala",
        name: "Koala",
        analysis: {
            summary: "Koalas are eucalyptus-feeding arboreal marsupials known for low-energy lifestyles, strong climbing anatomy, and dependence on specific tree communities.",
            scientificName: "Phascolarctos cinereus",
            category: "Mammal",
            identification: [
                "Round fluffy ears and large dark nose on a compact body",
                "Grey woolly coat with pale chest and thick limbs",
                "Often seen wedged into tree forks high above ground"
            ],
            habitat: "Eucalyptus woodland and forest with suitable browse trees and canopy connectivity.",
            nativeRange: "Eastern and southeastern Australia.",
            rarityScore: 69,
            rarityReason: "Koalas remain locally common in some pockets but decline where heat, disease, clearing, and road fragmentation intensify."
        },
        premiumDetails: {
            behaviorTraits: [
                "Sleeps or rests for long hours to manage a low-energy leaf diet",
                "Selects preferred eucalyptus species rather than eating every available leaf",
                "Climbs slowly but securely using strong gripping hands and claws"
            ],
            whyInteresting: [
                "Koalas show what an extreme dietary niche looks like in a tree-dwelling mammal.",
                "Their calm appearance hides a highly selective and constrained ecology."
            ],
            respectfulSpotting: [
                "Use binoculars rather than standing under a tree for long periods.",
                "Never handle or attempt to wake a resting koala."
            ],
            lookalikes: ["Wombat in photos", "Possum silhouette at night", "Stuffed toy misidentification in tourist areas"]
        }
    }),
    createSpeciesEntry({
        slug: "three-toed-sloth",
        name: "Three-toed Sloth",
        analysis: {
            summary: "Three-toed sloths are slow arboreal folivores that survive through low metabolic demand, camouflage, and careful movement in tropical forest canopies.",
            scientificName: "Bradypus variegatus",
            category: "Mammal",
            identification: [
                "Small round head with dark eye mask and long shaggy fur",
                "Three long curved claws on each forelimb",
                "Usually hangs suspended beneath branches rather than standing on top"
            ],
            habitat: "Lowland rainforest, secondary forest, and humid tropical woodland with continuous canopy.",
            nativeRange: "Central and South America.",
            rarityScore: 47,
            rarityReason: "Many sloth populations remain locally stable, but canopy fragmentation makes movement and reproduction more difficult."
        },
        premiumDetails: {
            behaviorTraits: [
                "Moves slowly to avoid attention and conserve energy",
                "Feeds on selected leaves that provide little fast fuel",
                "Often descends rarely despite spending most of life in trees"
            ],
            whyInteresting: [
                "Sloths are good examples of survival built around low output rather than high performance.",
                "Their fur often carries algae and small invertebrates, adding another ecological layer."
            ],
            respectfulSpotting: [
                "Scan treetops patiently instead of expecting obvious movement.",
                "Avoid any wildlife venue that encourages touching or staged handling."
            ],
            lookalikes: ["Two-toed sloth", "Sleeping monkey in dense foliage", "Epiphyte-covered branch cluster"]
        }
    }),
    createSpeciesEntry({
        slug: "capybara",
        name: "Capybara",
        analysis: {
            summary: "Capybaras are giant semi-aquatic rodents known for group living, water-edge vigilance, and calm but highly effective risk management in wetland habitats.",
            scientificName: "Hydrochoerus hydrochaeris",
            category: "Mammal",
            identification: [
                "Large barrel-shaped rodent with blunt muzzle and short ears",
                "Coarse brown coat and almost tail-less rear profile",
                "Often seen standing or resting close to water in groups"
            ],
            habitat: "Marshes, riversides, floodplains, lakeshores, and seasonally wet grassland.",
            nativeRange: "Much of South America east of the Andes.",
            rarityScore: 34,
            rarityReason: "Capybaras are locally common in suitable wetlands, though hunting and habitat conversion reduce numbers in some regions."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses water as a fast escape zone from predators",
                "Maintains social groups with frequent alarm awareness",
                "Grazes heavily on grasses and aquatic vegetation"
            ],
            whyInteresting: [
                "Capybaras show how social calm can still function as a serious anti-predator strategy.",
                "They are unusually good bridge animals for explaining rodent diversity to general audiences."
            ],
            respectfulSpotting: [
                "Stay back from shorelines where groups need clear water access.",
                "Watch herd reactions before moving because resting animals flush quickly."
            ],
            lookalikes: ["Nutria", "Beaver without flat tail", "Large domestic piglet at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "polar-bear",
        name: "Polar Bear",
        analysis: {
            summary: "Polar bears are Arctic marine bears specialized for sea ice hunting, insulation, and long-range movement between seal access points.",
            scientificName: "Ursus maritimus",
            category: "Mammal",
            identification: [
                "Large pale bear with long neck and relatively narrow head",
                "Heavy shoulders and long body suited to swimming and ice travel",
                "Creamy to yellow-white coat over dark skin"
            ],
            habitat: "Sea ice, Arctic coastlines, pack ice margins, and seasonal marine hunting zones.",
            nativeRange: "Circumpolar Arctic regions of North America, Greenland, Europe, and Asia.",
            rarityScore: 83,
            rarityReason: "Polar bears depend on sea ice systems that are changing rapidly, which places long-term pressure on feeding and reproduction."
        },
        premiumDetails: {
            behaviorTraits: [
                "Patrols seal breathing holes and ice edges patiently",
                "Swims long distances when ice routes break apart",
                "Builds energy reserves around seasonal hunting success"
            ],
            whyInteresting: [
                "Polar bears are major examples of mammal specialization built around a disappearing physical platform.",
                "Their physiology and movement make Arctic food-web changes especially visible."
            ],
            respectfulSpotting: [
                "Use trained Arctic guides and stay inside regulated safety protocols.",
                "Never approach a bear on foot or pressure one moving between shore and ice."
            ],
            lookalikes: ["Brown bear with pale coat", "Large ice formations at extreme distance", "Zoo image context confusion"]
        }
    }),
    createSpeciesEntry({
        slug: "cheetah",
        name: "Cheetah",
        analysis: {
            summary: "Cheetahs are lightly built sprinting cats designed for speed, visual tracking, and quick open-ground hunts rather than brute-force wrestling.",
            scientificName: "Acinonyx jubatus",
            category: "Mammal",
            identification: [
                "Slim long-legged cat with small head and deep chest",
                "Solid black spots rather than rosettes across tawny coat",
                "Dark tear marks running from eyes to mouth"
            ],
            habitat: "Open savannah, semi-desert, grassland, and lightly wooded hunting country.",
            nativeRange: "Mainly sub-Saharan Africa with a very small remnant population in Iran.",
            rarityScore: 81,
            rarityReason: "Cheetahs need large connected open habitats and suffer when fencing, persecution, and competition from larger predators intensify."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses vision and stalking to set up short explosive chases",
                "Targets smaller to medium antelope where speed can finish the job quickly",
                "Must recover after intense pursuits because sprinting is metabolically expensive"
            ],
            whyInteresting: [
                "Cheetahs are extreme examples of trade-offs built around acceleration and turning control.",
                "They make it easy to compare speed specialization against more force-heavy big cats."
            ],
            respectfulSpotting: [
                "Do not pressure hunting cats to move before they choose to run.",
                "Watch from a stable distance after a chase because recovery time matters."
            ],
            lookalikes: ["Leopard cub", "Serval at poor angle", "Thin adolescent leopard"]
        }
    }),
    createSpeciesEntry({
        slug: "spotted-hyena",
        name: "Spotted Hyena",
        analysis: {
            summary: "Spotted hyenas are powerful social carnivores with strong jaws, efficient endurance, and complex clan behavior that extends far beyond simple scavenging.",
            scientificName: "Crocuta crocuta",
            category: "Mammal",
            identification: [
                "Sloping back with high shoulders and shorter hindquarters",
                "Rounded ears and heavy neck on a strong front end",
                "Spotted sandy coat with ground-covering trot"
            ],
            habitat: "Savannah, grassland, scrub, and open woodland with prey access and den sites.",
            nativeRange: "Sub-Saharan Africa in regional strongholds and scattered populations.",
            rarityScore: 56,
            rarityReason: "Spotted hyenas are still secure in some ecosystems, but conflict and habitat pressure reduce density elsewhere."
        },
        premiumDetails: {
            behaviorTraits: [
                "Hunts actively as well as scavenging carcasses",
                "Communicates through whoops, scent, and rank-driven interactions",
                "Cracks large bones using exceptional bite force"
            ],
            whyInteresting: [
                "Hyenas are often misunderstood despite being some of the most capable carnivores in African systems.",
                "Their societies offer strong contrasts with canids and big cats."
            ],
            respectfulSpotting: [
                "Watch den areas from distance and avoid blocking paths after dark.",
                "Observe group interactions quietly because vocal exchanges carry a lot of information."
            ],
            lookalikes: ["African wild dog", "Striped hyena", "Large jackal in poor light"]
        }
    }),
    createSpeciesEntry({
        slug: "leopard",
        name: "Leopard",
        analysis: {
            summary: "Leopards are adaptable solitary cats known for rosette-pattern camouflage, climbing ability, and success across an unusually wide range of habitats.",
            scientificName: "Panthera pardus",
            category: "Mammal",
            identification: [
                "Golden to pale coat marked with dark rosettes",
                "Long tail and catlike stalking profile lower than a lion",
                "Powerful shoulders and climbing confidence around trees or rocks"
            ],
            habitat: "Forest, savannah, scrub, mountain slopes, farmland edges, and even some peri-urban wild zones.",
            nativeRange: "Sub-Saharan Africa and parts of the Middle East and Asia in fragmented populations.",
            rarityScore: 67,
            rarityReason: "Leopards remain flexible, but persecution and habitat fragmentation have removed them from many former landscapes."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses dense cover and dusk activity to reduce detection",
                "Caches kills in trees or hidden ground cover",
                "Adjusts prey choice across habitats more readily than many big cats"
            ],
            whyInteresting: [
                "Leopards are strong examples of versatility rather than one extreme specialization.",
                "Their camouflage and stealth make them among the hardest big cats to read well in the field."
            ],
            respectfulSpotting: [
                "Let the animal choose cover and do not crowd a treed or feeding leopard.",
                "Scan branches and shaded edges because many sightings are vertical or partially concealed."
            ],
            lookalikes: ["Jaguar", "Cheetah juvenile", "Clouded leopard in photos only"]
        }
    }),
    createSpeciesEntry({
        slug: "binturong",
        name: "Binturong",
        analysis: {
            summary: "The binturong is a shaggy Southeast Asian civet relative with a prehensile tail, arboreal habits, and a fruit-heavy diet that supports seed movement through forests.",
            scientificName: "Arctictis binturong",
            category: "Mammal",
            identification: [
                "Heavy black shaggy body with long white whiskers",
                "Bushy prehensile tail used in climbing support",
                "Rounded ears with pale fringes and slow deliberate canopy movement"
            ],
            habitat: "Lowland tropical forest, hill forest, and mature canopy systems with fruiting trees.",
            nativeRange: "South and Southeast Asia from India to Indonesia and the Philippines in scattered forest populations.",
            rarityScore: 78,
            rarityReason: "Binturongs depend on remaining forest cover and are pressured by hunting and habitat loss across much of their range."
        },
        premiumDetails: {
            behaviorTraits: [
                "Climbs and feeds slowly through fruiting trees",
                "Uses strong scent marking on branches and pathways",
                "Moves mostly at night but can rest visibly in canopy forks by day"
            ],
            whyInteresting: [
                "Binturongs are visually distinctive yet still widely overlooked outside Southeast Asia.",
                "Their frugivory makes them important for understanding forest seed movement."
            ],
            respectfulSpotting: [
                "Search upper branches quietly at dawn, dusk, or night with low-intensity light.",
                "Avoid disturbing resting individuals in rescue centers or wildlife parks."
            ],
            lookalikes: ["Bearcat in common name confusion only", "Large civet", "Dark arboreal mammal silhouette"]
        }
    }),
    createSpeciesEntry({
        slug: "proboscis-monkey",
        name: "Proboscis Monkey",
        analysis: {
            summary: "Proboscis monkeys are riverine Bornean primates famous for large noses, strong swimming ability, and social groups tied to mangroves and lowland forest edges.",
            scientificName: "Nasalis larvatus",
            category: "Mammal",
            identification: [
                "Large pendulous nose in adult males",
                "Pot-bellied body with orange-brown back and pale limbs",
                "Long tail and confident movement through riverside trees"
            ],
            habitat: "Mangroves, peat swamp forest, river edges, and lowland coastal woodland.",
            nativeRange: "Endemic to Borneo.",
            rarityScore: 82,
            rarityReason: "The species has a limited range and relies heavily on threatened lowland wet forests and river corridors."
        },
        premiumDetails: {
            behaviorTraits: [
                "Travels in social groups linked to riverbank sleeping sites",
                "Crosses water confidently and swims well for a primate",
                "Feeds heavily on leaves, shoots, and unripe fruits"
            ],
            whyInteresting: [
                "Proboscis monkeys are excellent examples of primates adapted to swampy edge habitats rather than inland canopy life alone.",
                "They are signature wildlife for Borneo’s river systems."
            ],
            respectfulSpotting: [
                "Observe from boats at slow speed without cutting off river crossings.",
                "Keep noise low around evening roost trees along riverbanks."
            ],
            lookalikes: ["Macaque species", "Silvered langur", "Young male proboscis monkeys before nose growth"]
        }
    }),
    createSpeciesEntry({
        slug: "sun-bear",
        name: "Sun Bear",
        analysis: {
            summary: "Sun bears are compact tropical bears with long tongues, curved claws, and strong climbing ability suited to forest feeding on insects, fruit, and honey.",
            scientificName: "Helarctos malayanus",
            category: "Mammal",
            identification: [
                "Smallest bear species with short black coat",
                "Pale crescent or chest patch on the upper chest",
                "Long snout and long claws on powerful forefeet"
            ],
            habitat: "Tropical lowland forest, hill forest, swamp forest, and forest-edge mosaic.",
            nativeRange: "South and Southeast Asia.",
            rarityScore: 80,
            rarityReason: "Sun bears remain under strong pressure from forest loss, poaching, and low detectability across a shrinking range."
        },
        premiumDetails: {
            behaviorTraits: [
                "Climbs readily to reach fruit and nest sites",
                "Uses long tongue to extract insects and honey",
                "Forages alone through dense cover and fallen wood"
            ],
            whyInteresting: [
                "Sun bears are unusually specialized for tropical forest feeding compared with larger cold-climate bears.",
                "They are key Southeast Asian mammals that deserve much more public attention."
            ],
            respectfulSpotting: [
                "Use quiet forest edges and canopy vantage points rather than off-trail pursuit.",
                "Avoid wildlife facilities that stage forced-close encounters."
            ],
            lookalikes: ["Black bear juvenile", "Binturong at distance", "Large civet in low light"]
        }
    }),
    createSpeciesEntry({
        slug: "malayan-tapir",
        name: "Malayan Tapir",
        analysis: {
            summary: "The Malayan tapir is a large nocturnal forest browser with a distinctive black-and-white body pattern, flexible snout, and dependence on wet tropical cover.",
            scientificName: "Tapirus indicus",
            category: "Mammal",
            identification: [
                "Large barrel-shaped body with sharp black-and-white saddle pattern",
                "Short trunk-like snout used in browsing",
                "Rounded ears edged in white and heavy deliberate gait"
            ],
            habitat: "Lowland rainforest, swamp forest, river edges, and dense secondary forest.",
            nativeRange: "Southern Thailand, Peninsular Malaysia, and Sumatra.",
            rarityScore: 85,
            rarityReason: "The species has a limited regional range and is strongly affected by fragmentation, roads, and lowland forest loss."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds mostly at night on leaves, shoots, and aquatic vegetation",
                "Uses dense cover and water as daytime protection",
                "Moves along quiet forest trails and river margins"
            ],
            whyInteresting: [
                "Its body pattern is one of the most unusual large-mammal field marks in Asia.",
                "The species is a strong indicator of lowland forest continuity."
            ],
            respectfulSpotting: [
                "Move slowly on night drives because tapirs may freeze rather than flee cleanly.",
                "Never pressure an animal standing near road edges or river crossings."
            ],
            lookalikes: ["Young wild pig", "Pygmy hippopotamus in captivity only", "Dark livestock in headlights"]
        }
    }),
    createSpeciesEntry({
        slug: "sunda-pangolin",
        name: "Sunda Pangolin",
        analysis: {
            summary: "The Sunda pangolin is a scale-covered Southeast Asian mammal specialized for feeding on ants and termites with strong claws and a long adhesive tongue.",
            scientificName: "Manis javanica",
            category: "Mammal",
            identification: [
                "Body covered in overlapping brown keratin scales",
                "Long tapering tail and narrow pointed head",
                "Slow careful walking with large curved foreclaws"
            ],
            habitat: "Lowland forest, secondary woodland, plantations, and forest-edge mosaics with ant and termite abundance.",
            nativeRange: "Southeast Asia including mainland forests and western Indonesian islands.",
            rarityScore: 92,
            rarityReason: "Heavy poaching pressure and habitat loss have made the species extremely vulnerable across much of its range."
        },
        premiumDetails: {
            behaviorTraits: [
                "Opens nests and logs with heavy digging claws",
                "Rolls defensively into a tight scale-covered ball under threat",
                "Forages mostly at night along scent-rich ground routes"
            ],
            whyInteresting: [
                "Pangolins are among the most distinctive mammal body plans alive today.",
                "They are also among the most urgent examples of wildlife trade pressure."
            ],
            respectfulSpotting: [
                "Never publicize precise wild locations for a recent sighting.",
                "Use red light and quiet observation if working with licensed researchers."
            ],
            lookalikes: ["Armadillo in photos", "Large monitor tail section at a glance", "Rolled mammal silhouette in leaf litter"]
        }
    }),
    createSpeciesEntry({
        slug: "meerkat",
        name: "Meerkat",
        analysis: {
            summary: "Meerkats are small desert mongooses known for upright vigilance, social digging, and cooperative group living in open dry habitats.",
            scientificName: "Suricata suricatta",
            category: "Mammal",
            identification: [
                "Slim sandy body with dark eye patches and banded back",
                "Frequently stands upright on hind legs while scanning",
                "Thin pointed face and long tapering tail"
            ],
            habitat: "Arid grassland, scrub, and semi-desert with burrow-friendly soil.",
            nativeRange: "Southern Africa.",
            rarityScore: 32,
            rarityReason: "Meerkats remain locally common in suitable dry habitats, though they are absent where soil, burrow sites, or prey base are poor."
        },
        premiumDetails: {
            behaviorTraits: [
                "Rotates sentry duty while others forage",
                "Digs for insects, lizards, and small vertebrates",
                "Uses alarm calls tuned to different threat types"
            ],
            whyInteresting: [
                "Meerkats make cooperative vigilance easy to see even for casual observers.",
                "They are strong examples of small mammals reducing risk through social structure."
            ],
            respectfulSpotting: [
                "Stay low and still rather than walking directly toward active burrows.",
                "Do not bait groups for close photography around den entrances."
            ],
            lookalikes: ["Mongoose species", "Ground squirrel at poor angle", "Young mongoose troop members"]
        }
    }),
    createSpeciesEntry({
        slug: "red-panda",
        name: "Red Panda",
        analysis: {
            summary: "Red pandas are small Himalayan and Chinese forest mammals known for ringed tails, reddish fur, and cool-climate bamboo browsing in tree-rich mountain habitat.",
            scientificName: "Ailurus fulgens",
            category: "Mammal",
            identification: [
                "Rust-red coat with white facial mask and ringed tail",
                "Cat-sized arboreal body with short face and dark legs",
                "Often curls or rests on branches in cool forest cover"
            ],
            habitat: "Temperate montane forest with bamboo understorey and dense tree structure.",
            nativeRange: "Eastern Himalaya and southwestern China.",
            rarityScore: 81,
            rarityReason: "Red pandas have a limited fragmented range and are sensitive to habitat loss, disturbance, and disease from domestic animals."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds heavily on bamboo but supplements with fruit and small prey",
                "Climbs well and uses tail for balance and insulation",
                "Most active in cool low-light periods"
            ],
            whyInteresting: [
                "Red pandas are biologically distinct enough to sit in their own family.",
                "They are excellent flagship animals for mountain forest conservation."
            ],
            respectfulSpotting: [
                "Use quiet canopy scanning rather than expecting active ground movement.",
                "Keep dogs and loud groups out of known habitat edges."
            ],
            lookalikes: ["Raccoon in photos", "Martens at a glance", "Rust-colored domestic cat in villages"]
        }
    }),
    createSpeciesEntry({
        slug: "fennec-fox",
        name: "Fennec Fox",
        analysis: {
            summary: "The fennec fox is a tiny desert canid with oversized ears, excellent heat management, and nocturnal hunting behavior tuned to dry sandy landscapes.",
            scientificName: "Vulpes zerda",
            category: "Mammal",
            identification: [
                "Very large ears relative to a small pale fox body",
                "Creamy sand-colored coat and dark eyes",
                "Light-footed movement over dunes and sparse scrub"
            ],
            habitat: "Sand desert, dune fields, and arid scrub with burrow sites.",
            nativeRange: "North African deserts and adjacent arid regions.",
            rarityScore: 49,
            rarityReason: "The species remains widespread across desert systems but is patchy and not easy to detect because of nocturnal habits."
        },
        premiumDetails: {
            behaviorTraits: [
                "Listens for prey movement beneath sand using oversized ears",
                "Avoids heat by staying in burrows through the day",
                "Feeds opportunistically on insects, rodents, and fruit"
            ],
            whyInteresting: [
                "Fennecs are compact examples of desert design built around heat and hearing.",
                "Their silhouette is immediately recognizable even for non-specialists."
            ],
            respectfulSpotting: [
                "Use low light and slow movement during night observation.",
                "Avoid stepping on burrow systems in soft dune habitat."
            ],
            lookalikes: ["Kit fox", "Cape fox", "Small domestic dog in desert camps"]
        }
    }),
    createSpeciesEntry({
        slug: "ring-tailed-lemur",
        name: "Ring-tailed Lemur",
        analysis: {
            summary: "Ring-tailed lemurs are ground-using Malagasy primates recognized for striped tails, social groups, and heavy reliance on scent and sunning behavior.",
            scientificName: "Lemur catta",
            category: "Mammal",
            identification: [
                "Grey body with white face and black eye patches",
                "Long black-and-white ringed tail often carried upright",
                "Frequent ground travel compared with many other lemurs"
            ],
            habitat: "Dry forest, gallery forest, scrub, and spiny woodland.",
            nativeRange: "Southern and southwestern Madagascar.",
            rarityScore: 78,
            rarityReason: "The species is highly recognizable but remains under pressure from habitat loss, hunting, and fragmentation in Madagascar."
        },
        premiumDetails: {
            behaviorTraits: [
                "Lives in social groups with frequent scent communication",
                "Uses sun-basking posture to warm up in cool mornings",
                "Feeds on fruit, leaves, flowers, and seasonal fallback foods"
            ],
            whyInteresting: [
                "Ring-tailed lemurs are excellent introductions to the distinct primate radiation of Madagascar.",
                "Their social signaling is visible enough to reward careful behavioral watching."
            ],
            respectfulSpotting: [
                "Keep distance even around habituated groups to avoid altering foraging behavior.",
                "Never feed lemurs at tourist sites."
            ],
            lookalikes: ["Other lemur species", "Large mongoose at distance", "Striped domestic cat tail in poor photos"]
        }
    }),
    createSpeciesEntry({
        slug: "babirusa",
        name: "Babirusa",
        analysis: {
            summary: "Babirusas are unusual Indonesian wild pigs famous for curved tusks, long legs, and specialized forest foraging in Sulawesi and nearby islands.",
            scientificName: "Babyrousa celebensis",
            category: "Mammal",
            identification: [
                "Pig-like body with relatively long legs and sparse hair",
                "Adult males show dramatic upward-curving upper tusks",
                "Longer narrower face than many domestic pigs"
            ],
            habitat: "Tropical forest, river margins, swamp forest, and dense lowland cover.",
            nativeRange: "Sulawesi and nearby Indonesian islands.",
            rarityScore: 84,
            rarityReason: "Babirusas have a limited island range and face hunting and habitat pressure across that already restricted distribution."
        },
        premiumDetails: {
            behaviorTraits: [
                "Forages on fruit, roots, leaves, and fallen material in damp forest",
                "Uses wallows and wet ground for cooling and skin care",
                "Moves carefully through dense cover rather than wide open terrain"
            ],
            whyInteresting: [
                "Babirusas are among the most visually distinctive wild pigs in the world.",
                "They are strong examples of island endemism with specialized local conservation value."
            ],
            respectfulSpotting: [
                "Use quiet forest-edge or river observation rather than entering dense cover loudly.",
                "Avoid any attempt to approach or corner tusked males."
            ],
            lookalikes: ["Wild boar", "Bearded pig", "Domestic pig hybrids"]
        }
    }),
    createSpeciesEntry({
        slug: "wolverine",
        name: "Wolverine",
        analysis: {
            summary: "Wolverines are powerful northern mustelids known for stamina, scavenging skill, and the ability to travel huge snowy ranges with little support.",
            scientificName: "Gulo gulo",
            category: "Mammal",
            identification: [
                "Stocky dark body with pale side stripes and bushy tail",
                "Broad head and heavy claws on short strong legs",
                "Low determined movement over snow, rock, or tundra"
            ],
            habitat: "Boreal forest, alpine tundra, mountain wilderness, and cold sparsely populated landscapes.",
            nativeRange: "Northern North America, Europe, and Asia in discontinuous cold-region populations.",
            rarityScore: 73,
            rarityReason: "Wolverines require large cold landscapes and remain naturally low-density, making them vulnerable to fragmentation and warming snow patterns."
        },
        premiumDetails: {
            behaviorTraits: [
                "Ranges widely in search of carrion, trapped prey, and seasonal food",
                "Caches food in cold conditions to reduce spoilage",
                "Uses scent marking to maintain large solitary territories"
            ],
            whyInteresting: [
                "Wolverines are strong examples of toughness built around persistence and opportunism rather than size.",
                "They make excellent case studies in cold-climate scavenger-predator overlap."
            ],
            respectfulSpotting: [
                "Use remote optics and avoid baiting or food-conditioned viewing.",
                "Respect denning and snow-travel restrictions in alpine habitat."
            ],
            lookalikes: ["Badger", "Fisher", "Dark bear cub at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "peregrine-falcon",
        name: "Peregrine Falcon",
        analysis: {
            summary: "The peregrine falcon is a high-speed hunting raptor famous for steep aerial stoops, pointed wings, and success in both wild cliffs and modern cities.",
            scientificName: "Falco peregrinus",
            category: "Bird of prey",
            identification: [
                "Slate-grey back with barred pale underside",
                "Dark hood and moustache mark on the face",
                "Long pointed wings and fast stiff-winged flight"
            ],
            habitat: "Cliffs, coasts, mountains, wetlands, and increasingly tall urban structures near bird-rich feeding areas.",
            nativeRange: "Found across every continent except Antarctica.",
            rarityScore: 41,
            rarityReason: "Many peregrine populations recovered strongly after pesticide bans, though local access still depends on prey concentrations and nesting sites."
        },
        premiumDetails: {
            behaviorTraits: [
                "Captures birds in flight with sudden high-speed dives",
                "Uses elevated perches or soaring setup before attack",
                "Adapts readily to city nesting ledges and bridge structures"
            ],
            whyInteresting: [
                "Peregrines are among the clearest expressions of aerial specialization in birds.",
                "Their urban comeback makes them unusually visible conservation success stories."
            ],
            respectfulSpotting: [
                "Stay away from active cliff or ledge nests during breeding season.",
                "Watch prey flocks and skyline movement rather than searching randomly."
            ],
            lookalikes: ["Hobby", "Merlin", "Prairie falcon"]
        }
    }),
    createSpeciesEntry({
        slug: "greater-flamingo",
        name: "Greater Flamingo",
        analysis: {
            summary: "The greater flamingo is a tall filter-feeding wader recognized for pink-white plumage, long legs, and dense social flocks in saline wetlands.",
            scientificName: "Phoenicopterus roseus",
            category: "Bird",
            identification: [
                "Very long pink legs and long S-curved neck",
                "Pale body with deeper pink wing coverts and black flight feathers",
                "Heavy downturned bill adapted for filter feeding"
            ],
            habitat: "Salt pans, lagoons, estuaries, alkaline lakes, and shallow coastal wetlands.",
            nativeRange: "Parts of Africa, southern Europe, the Middle East, and South Asia.",
            rarityScore: 52,
            rarityReason: "Flamingos can be abundant at strong wetland sites but rely on a limited set of shallow nutrient-rich feeding systems."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds with head inverted while filtering small prey and algae",
                "Moves in dense coordinated flocks that shift with water depth and food",
                "Uses visible group display behavior during breeding periods"
            ],
            whyInteresting: [
                "Flamingos show how specialized feeding hardware can shape an entire body plan.",
                "Their flocks create highly visible links between water chemistry and bird abundance."
            ],
            respectfulSpotting: [
                "Keep far back from shallow feeding lines because flock flushes waste a lot of energy.",
                "Use long lenses at wetland hides rather than walking onto exposed flats."
            ],
            lookalikes: ["Lesser flamingo", "Stork at distance", "Heron silhouette in heat haze"]
        }
    }),
    createSpeciesEntry({
        slug: "common-kingfisher",
        name: "Common Kingfisher",
        analysis: {
            summary: "The common kingfisher is a small bright river bird built for perch hunting, rapid dives, and precision fish capture in clear shallow water.",
            scientificName: "Alcedo atthis",
            category: "Bird",
            identification: [
                "Brilliant blue upperparts with orange underparts",
                "Straight dagger-like bill and compact body",
                "Fast low flight skimming close over water"
            ],
            habitat: "Streams, ponds, slow rivers, canals, and wetland margins with perches and small fish.",
            nativeRange: "Europe, North Africa, and much of Asia including Southeast Asia.",
            rarityScore: 48,
            rarityReason: "The species can be common locally where water remains clear and prey-rich, but pollution and bank alteration reduce occupancy."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits on low perches before diving for fish or aquatic invertebrates",
                "Uses rapid direct flight between feeding points",
                "Nests in tunnels cut into earthen banks"
            ],
            whyInteresting: [
                "Kingfishers are excellent for showing how bright coloration can still coexist with stealth at water level.",
                "They reward patient watching because the whole hunting sequence is compact and precise."
            ],
            respectfulSpotting: [
                "Stay hidden near river bends instead of walking exposed banks repeatedly.",
                "Avoid nest-bank disturbance during breeding season."
            ],
            lookalikes: ["Pied kingfisher", "Bee-eater at distance", "Blue swallow blur over water"]
        }
    }),
    createSpeciesEntry({
        slug: "toco-toucan",
        name: "Toco Toucan",
        analysis: {
            summary: "The toco toucan is a large South American forest-edge bird known for its outsized bill, fruit-heavy diet, and striking black, white, and orange coloration.",
            scientificName: "Ramphastos toco",
            category: "Bird",
            identification: [
                "Huge orange bill with dark tip dominating the silhouette",
                "Black body, white throat, and orange facial skin",
                "Long-tailed perch-loving posture in canopy or edge trees"
            ],
            habitat: "Woodland edge, gallery forest, savannah forest, and semi-open tropical mosaic with fruiting trees.",
            nativeRange: "Central and eastern South America.",
            rarityScore: 45,
            rarityReason: "Toco toucans remain common in suitable habitats but depend on tree cavities and fruiting woodland structure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds mainly on fruit but also takes eggs, insects, and small vertebrates",
                "Moves in short direct flights between canopy perches",
                "Uses bill reach to access fruit beyond branch edge"
            ],
            whyInteresting: [
                "The bill makes the species one of the most memorable tropical birds on sight alone.",
                "Toucans are also important seed movers in many forest-edge systems."
            ],
            respectfulSpotting: [
                "Wait near fruiting trees instead of chasing every call through the canopy.",
                "Do not approach nest cavities for photographs."
            ],
            lookalikes: ["Other toucan species", "Hornbill silhouette in non-native settings", "Macaw at poor angle"]
        }
    }),
    createSpeciesEntry({
        slug: "indian-peafowl",
        name: "Indian Peafowl",
        analysis: {
            summary: "The Indian peafowl is a large pheasant known for shimmering plumage, loud calls, and elaborate train displays in open woodland and human-modified landscapes.",
            scientificName: "Pavo cristatus",
            category: "Bird",
            identification: [
                "Male shows metallic blue neck and massive eye-spotted tail train",
                "Crested head and long legs on a heavy ground bird frame",
                "Females are browner with green neck tones and no long train"
            ],
            habitat: "Dry forest edge, scrub, farmland, temple grounds, and village mosaic with cover and open feeding ground.",
            nativeRange: "Indian subcontinent, with introduced populations in some other regions.",
            rarityScore: 33,
            rarityReason: "Indian peafowl remain common in many parts of their range and tolerate human presence where hunting pressure is low."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds on seeds, shoots, insects, and small animals on the ground",
                "Roosts in trees despite spending much of the day on foot",
                "Uses loud calls and visual display during breeding season"
            ],
            whyInteresting: [
                "Peafowl are classic examples of display-driven selection made visually obvious.",
                "They are also surprisingly practical omnivores rather than decorative specialists."
            ],
            respectfulSpotting: [
                "Give displaying males room and avoid walking through active lek areas.",
                "Watch dawn and dusk edges where birds move between roost and feeding ground."
            ],
            lookalikes: ["Green peafowl", "Domestic peafowl variants", "Large pheasant species"]
        }
    }),
    createSpeciesEntry({
        slug: "rhinoceros-hornbill",
        name: "Rhinoceros Hornbill",
        analysis: {
            summary: "The rhinoceros hornbill is a large Southeast Asian forest bird known for its heavy casque, strong pair bonds, and dependence on old trees for nesting.",
            scientificName: "Buceros rhinoceros",
            category: "Bird",
            identification: [
                "Large black-and-white body with heavy red-orange bill and casque",
                "White tail with bold black band",
                "Powerful wingbeats producing audible whooshing in flight"
            ],
            habitat: "Primary and mature secondary tropical forest with large fruiting trees and cavity-bearing giants.",
            nativeRange: "Borneo, Sumatra, the Malay Peninsula, and parts of southern Thailand.",
            rarityScore: 79,
            rarityReason: "Hornbills need intact forest and large nest trees, both of which are heavily reduced in many areas."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds widely on fruit but also takes small animals opportunistically",
                "Uses large tree cavities where females seal themselves in during nesting",
                "Travels long distances between fruiting trees"
            ],
            whyInteresting: [
                "The species combines unforgettable flight sound, shape, and breeding behavior.",
                "It is one of the strongest symbols of Southeast Asian old-growth forest integrity."
            ],
            respectfulSpotting: [
                "Keep away from known nest trees and fruiting figs used repeatedly by flocks.",
                "Use early morning canopy vantage points rather than walking under active feeding trees."
            ],
            lookalikes: ["Great hornbill", "Wreathed hornbill", "Helmeted hornbill silhouette"]
        }
    })
);

expandedSpeciesData.push(
    createSpeciesEntry({
        slug: "southern-cassowary",
        name: "Southern Cassowary",
        analysis: {
            summary: "The southern cassowary is a large flightless rainforest bird known for its helmet-like casque, powerful legs, and major role in moving large forest seeds.",
            scientificName: "Casuarius casuarius",
            category: "Bird",
            identification: [
                "Tall black-bodied bird with blue neck and red wattles",
                "Casque on top of the head and heavy three-toed feet",
                "Flightless but capable of fast sudden movement through dense cover"
            ],
            habitat: "Tropical rainforest, swamp forest, and forest-edge mosaic with fruiting trees.",
            nativeRange: "New Guinea and northeastern Australia.",
            rarityScore: 76,
            rarityReason: "Cassowaries require intact forest and suffer from road strikes, dog attacks, and fragmentation in accessible lowland habitat."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds heavily on fallen fruit and swallows large items whole",
                "Travels between fruiting patches and water through dense forest",
                "Uses powerful kicks in defense when cornered"
            ],
            whyInteresting: [
                "Cassowaries are among the most important large-seed dispersers in some tropical forests.",
                "Their body plan makes them unforgettable and not to be underestimated."
            ],
            respectfulSpotting: [
                "Never approach or feed cassowaries, especially near roads or parks.",
                "Stay calm and back away if a bird is standing on the path ahead."
            ],
            lookalikes: ["Emu", "Juvenile ostrich in captivity", "Large turkey at extreme distance"]
        }
    }),
    createSpeciesEntry({
        slug: "emperor-penguin",
        name: "Emperor Penguin",
        analysis: {
            summary: "The emperor penguin is the largest penguin species, built for deep cold-water diving, severe Antarctic weather, and tightly coordinated breeding colonies on sea ice.",
            scientificName: "Aptenodytes forsteri",
            category: "Bird",
            identification: [
                "Tall black-and-white body with yellow-orange ear patches",
                "Heavy chest and thick neck on an upright penguin silhouette",
                "Waddling gait on ice and efficient torpedo-like swimming in water"
            ],
            habitat: "Antarctic sea ice, coastal ice shelves, and nearby cold marine feeding zones.",
            nativeRange: "Circumpolar Antarctica.",
            rarityScore: 82,
            rarityReason: "The species depends on sea ice breeding platforms and marine prey systems that are sensitive to climate-driven change."
        },
        premiumDetails: {
            behaviorTraits: [
                "Forms dense huddles to reduce heat loss in extreme wind and cold",
                "Makes long foraging dives for fish, squid, and krill",
                "Balances a single egg on the feet during winter breeding"
            ],
            whyInteresting: [
                "Emperor penguins are textbook examples of group thermoregulation at work.",
                "Their breeding cycle is tied to one of the harshest seasonal windows used by any bird."
            ],
            respectfulSpotting: [
                "Follow strict polar tourism and research distances around colonies.",
                "Avoid obstructing movement lines between colony edge and sea access."
            ],
            lookalikes: ["King penguin", "Large penguin silhouette in heavy weather", "Grouped seabirds on ice at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "ruby-throated-hummingbird",
        name: "Ruby-throated Hummingbird",
        analysis: {
            summary: "The ruby-throated hummingbird is a tiny nectar-feeding bird built for hovering flight, rapid metabolism, and precise flower tracking.",
            scientificName: "Archilochus colubris",
            category: "Bird",
            identification: [
                "Very small body with long straight bill",
                "Metallic green back and pale underparts",
                "Adult male shows iridescent red throat in good light"
            ],
            habitat: "Woodland edge, gardens, meadows, and forest openings with reliable flowering plants.",
            nativeRange: "Eastern North America with seasonal migration to Central America.",
            rarityScore: 38,
            rarityReason: "The species remains common in suitable habitat but depends on flower resources during migration and breeding."
        },
        premiumDetails: {
            behaviorTraits: [
                "Hovers precisely while feeding on nectar",
                "Defends productive flower patches or feeders aggressively",
                "Takes small insects as protein despite nectar specialization"
            ],
            whyInteresting: [
                "Hummingbirds make high-metabolism flight and energy management unusually visible.",
                "They are excellent introductions to pollination-linked bird behavior."
            ],
            respectfulSpotting: [
                "Plant or watch native flowers instead of standing directly in active feeding routes.",
                "Keep feeders clean if observing around homes or gardens."
            ],
            lookalikes: ["Other hummingbird species", "Large hovering bee", "Sunbird in non-native photo sets"]
        }
    }),
    createSpeciesEntry({
        slug: "great-blue-heron",
        name: "Great Blue Heron",
        analysis: {
            summary: "The great blue heron is a tall wading bird built for patient stalking, long-necked strike feeding, and flexible use of wetlands, shores, and urban waterways.",
            scientificName: "Ardea herodias",
            category: "Bird",
            identification: [
                "Tall grey-blue body with long neck and dagger bill",
                "Slow deliberate stalking posture in shallow water",
                "Broad rounded wings and tucked-neck flight silhouette"
            ],
            habitat: "Marsh, lake edge, river shallows, tidal flats, and artificial ponds or canals.",
            nativeRange: "North and Central America, parts of the Caribbean, and northern South America.",
            rarityScore: 35,
            rarityReason: "The species is often common where wetland feeding habitat remains available and disturbance is moderate."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits almost motionless before a quick spear-like strike",
                "Feeds on fish, frogs, crustaceans, and small vertebrates",
                "Nests in tree colonies or on secluded wetland platforms"
            ],
            whyInteresting: [
                "Herons are excellent examples of patience turning into very efficient prey capture.",
                "Their large size makes wetland hunting behavior easy to study."
            ],
            respectfulSpotting: [
                "Stay back from feeding shallows and let the bird resume its own rhythm.",
                "Do not approach heronries during breeding season."
            ],
            lookalikes: ["Grey heron", "Great egret", "Cranes in low light"]
        }
    }),
    createSpeciesEntry({
        slug: "wandering-albatross",
        name: "Wandering Albatross",
        analysis: {
            summary: "The wandering albatross is a huge oceanic seabird famous for immense wingspan, dynamic soaring, and long-distance travel over Southern Ocean winds.",
            scientificName: "Diomedea exulans",
            category: "Bird",
            identification: [
                "Enormous long narrow wings held stiff over wave systems",
                "Pale body with dark wing edges in many adults",
                "Large pinkish bill and effortless gliding over open water"
            ],
            habitat: "Open Southern Ocean waters with nesting on remote subantarctic islands.",
            nativeRange: "Southern Hemisphere ocean basins around Antarctica and subantarctic breeding islands.",
            rarityScore: 78,
            rarityReason: "The species ranges widely at sea but breeds at limited colonies and remains vulnerable to longline bycatch and slow reproduction."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses wind gradients over waves to travel with minimal flapping",
                "Forages widely for squid, fish, and surface prey",
                "Returns faithfully to remote nesting islands"
            ],
            whyInteresting: [
                "Few birds demonstrate large-scale energy-efficient travel as clearly as albatrosses.",
                "Their life history shows how ocean scale and slow reproduction interact."
            ],
            respectfulSpotting: [
                "Respect colony restrictions on breeding islands completely.",
                "At sea, keep vessels predictable and avoid baiting behaviors."
            ],
            lookalikes: ["Other albatross species", "Large shearwater", "Giant petrel at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "scarlet-macaw",
        name: "Scarlet Macaw",
        analysis: {
            summary: "The scarlet macaw is a large brilliantly colored parrot known for loud social flight, strong bill power, and canopy foraging in Neotropical forests.",
            scientificName: "Ara macao",
            category: "Bird",
            identification: [
                "Bright red body with yellow and blue wing panels",
                "Long tapered tail and heavy pale upper bill",
                "Loud paired or flock flight above forest canopy"
            ],
            habitat: "Lowland rainforest, riverine forest, and wooded tropical edges with large nesting cavities.",
            nativeRange: "Central America and northern South America.",
            rarityScore: 66,
            rarityReason: "The species remains secure in some strongholds but is pressured elsewhere by trapping and forest loss."
        },
        premiumDetails: {
            behaviorTraits: [
                "Travels in pairs or noisy groups between feeding trees",
                "Uses a powerful bill to crack hard seeds and nuts",
                "Depends on large old trees for nesting cavities"
            ],
            whyInteresting: [
                "Scarlet macaws combine extreme visual impact with strong ecological ties to mature forest structure.",
                "Their social calls make canopy movement easier to detect before the birds are seen."
            ],
            respectfulSpotting: [
                "Watch flight lines from river edges or canopy viewpoints rather than closing on nest trees.",
                "Avoid facilities linked to wild-caught bird demand."
            ],
            lookalikes: ["Green-winged macaw", "Military macaw", "Large parrot flocks at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "shoebill",
        name: "Shoebill",
        analysis: {
            summary: "The shoebill is a huge wetland bird with a massive shoe-shaped bill, slow stealthy movement, and a specialized taste for large swamp prey.",
            scientificName: "Balaeniceps rex",
            category: "Bird",
            identification: [
                "Very large grey bird with heavy shoe-like bill",
                "Tall long-legged stance in dense wetland vegetation",
                "Often stands almost statue-still while hunting"
            ],
            habitat: "Papyrus swamp, marsh, and shallow tropical wetlands with dense floating vegetation.",
            nativeRange: "Central and East African swamp systems.",
            rarityScore: 83,
            rarityReason: "Shoebills have a restricted wetland distribution and are vulnerable to disturbance, drainage, and slow breeding turnover."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits motionless before lunging at lungfish and large aquatic prey",
                "Uses slow deliberate stalking in thick marsh channels",
                "Maintains wide spacing because productive wetland patches are limited"
            ],
            whyInteresting: [
                "Shoebills are striking examples of stillness used as active predatory strategy.",
                "Their unusual bill shape makes them one of the most recognizable wetland birds alive."
            ],
            respectfulSpotting: [
                "Use established channels or hides and never trample marsh vegetation to close distance.",
                "Keep voices down because many sightings happen in quiet enclosed wetlands."
            ],
            lookalikes: ["Heron silhouette", "Stork at distance", "Large crane in poor light"]
        }
    }),
    createSpeciesEntry({
        slug: "secretary-bird",
        name: "Secretarybird",
        analysis: {
            summary: "The secretarybird is a tall African raptor that hunts mostly on foot, using long legs and powerful kicks to kill snakes and other prey in open country.",
            scientificName: "Sagittarius serpentarius",
            category: "Bird of prey",
            identification: [
                "Long-legged eagle-like bird with small hooked bill",
                "Grey body, black flight feathers, and crest-like head plumes",
                "Walks actively through grass rather than perching like most raptors"
            ],
            habitat: "Open savannah, grassland, and lightly wooded plains.",
            nativeRange: "Sub-Saharan Africa.",
            rarityScore: 79,
            rarityReason: "The species needs large open hunting landscapes and has declined in parts of its range through land-use change and disturbance."
        },
        premiumDetails: {
            behaviorTraits: [
                "Stamps and kicks prey with remarkable accuracy",
                "Patrols large areas on foot during the day",
                "Nests in tall flat-topped trees or thorn structures"
            ],
            whyInteresting: [
                "Secretarybirds break the usual raptor pattern by making legs, not talons in flight, the main attack tool.",
                "They are excellent examples of niche separation within birds of prey."
            ],
            respectfulSpotting: [
                "Keep vehicles well back on open plains to avoid interrupting long walking hunts.",
                "Watch from the side rather than cutting across a bird’s travel line."
            ],
            lookalikes: ["Crane species", "Seriema in non-African comparisons", "Large bustard at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "bali-myna",
        name: "Bali Myna",
        analysis: {
            summary: "The Bali myna is a striking white starling with blue skin around the eye, a crest, and an extremely limited natural range on the island of Bali.",
            scientificName: "Leucopsar rothschildi",
            category: "Bird",
            identification: [
                "Mostly white body with pointed crest and black wing tips",
                "Bright blue bare skin around the eye",
                "Clean pale silhouette that stands out in dry woodland"
            ],
            habitat: "Dry monsoon forest, open woodland, and managed restoration habitat.",
            nativeRange: "Endemic to Bali, Indonesia.",
            rarityScore: 95,
            rarityReason: "The wild population is extremely limited and remains under strong pressure from trapping despite conservation work."
        },
        premiumDetails: {
            behaviorTraits: [
                "Moves in pairs or small groups through open forest canopy",
                "Feeds on fruit, insects, and small invertebrates",
                "Uses cavities for nesting in mature trees"
            ],
            whyInteresting: [
                "Bali mynas are among Southeast Asia’s clearest examples of how beauty can increase trade pressure.",
                "They are high-value sightings for conservation-aware birders."
            ],
            respectfulSpotting: [
                "Never share exact recent wild locations publicly.",
                "Follow reserve rules strictly around breeding and release areas."
            ],
            lookalikes: ["White starling species", "Captive ornamental birds", "Leucistic myna at poor angle"]
        }
    }),
    createSpeciesEntry({
        slug: "barn-swallow",
        name: "Barn Swallow",
        analysis: {
            summary: "Barn swallows are agile aerial insectivores known for forked tails, high-speed turning, and close ties to open landscapes and human structures.",
            scientificName: "Hirundo rustica",
            category: "Bird",
            identification: [
                "Deeply forked tail with long outer streamers",
                "Glossy blue upperparts and warm buff underparts",
                "Fast sweeping flight low over fields and water"
            ],
            habitat: "Farmland, grassland, wetlands, villages, and open country with insect-rich airspace and nesting ledges.",
            nativeRange: "Widespread across the Northern Hemisphere with long-distance migration into the Southern Hemisphere.",
            rarityScore: 29,
            rarityReason: "Barn swallows remain widespread and flexible where nesting sites and flying insect supplies stay available."
        },
        premiumDetails: {
            behaviorTraits: [
                "Captures insects continuously on the wing",
                "Builds mud nests on sheltered beams, ledges, or human structures",
                "Migrates over vast distances between breeding and wintering grounds"
            ],
            whyInteresting: [
                "Swallows make aerial feeding efficiency easy to observe at human scale.",
                "Their close association with buildings links wild migration to everyday places."
            ],
            respectfulSpotting: [
                "Do not disturb active mud nests on barns or porches.",
                "Watch feeding loops from open ground instead of standing under nest entrances."
            ],
            lookalikes: ["House martin", "Cliff swallow", "Swift at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "atlantic-puffin",
        name: "Atlantic Puffin",
        analysis: {
            summary: "The Atlantic puffin is a small auk with a colorful bill, excellent underwater propulsion, and dense colony life on northern ocean cliffs and islands.",
            scientificName: "Fratercula arctica",
            category: "Bird",
            identification: [
                "Compact black-and-white seabird with large triangular bill in breeding season",
                "Short wings and upright posture on land",
                "Low direct flight close to waves and strong underwater swimming"
            ],
            habitat: "Cold North Atlantic seas with nesting on offshore cliffs, islands, and burrows.",
            nativeRange: "North Atlantic from eastern North America to northern Europe.",
            rarityScore: 64,
            rarityReason: "Puffins remain abundant in some colonies but are highly sensitive to shifts in marine food availability and breeding conditions."
        },
        premiumDetails: {
            behaviorTraits: [
                "Dives for small schooling fish using wings underwater",
                "Nests in burrows or rock crevices in dense colonies",
                "Carries multiple fish crosswise in the bill during chick feeding"
            ],
            whyInteresting: [
                "Puffins are excellent examples of birds split between seabird and burrow-colony lifestyles.",
                "Their bill shape and fish-carrying behavior are unusually distinctive."
            ],
            respectfulSpotting: [
                "Stay on boardwalks or marked paths at colonies to avoid collapsing burrows.",
                "Keep distance from cliff edges where birds need clear landing routes."
            ],
            lookalikes: ["Horned puffin", "Razorbill", "Guillemot at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "hoopoe",
        name: "Hoopoe",
        analysis: {
            summary: "The hoopoe is a long-billed ground-foraging bird recognized by its fan-shaped crest, bold wing pattern, and probing feeding style.",
            scientificName: "Upupa epops",
            category: "Bird",
            identification: [
                "Cinnamon body with dramatic black-and-white barred wings",
                "Long curved bill and raisable orange crest",
                "Butterfly-like undulating flight over open ground"
            ],
            habitat: "Open woodland, farmland, scrub, parks, and lightly grazed country with exposed ground.",
            nativeRange: "Europe, Africa, Asia, and parts of the Middle East depending on seasonal movement.",
            rarityScore: 42,
            rarityReason: "Hoopoes are still widespread but depend on insect-rich open ground and suitable nesting cavities."
        },
        premiumDetails: {
            behaviorTraits: [
                "Probes soil and leaf litter for insects and larvae",
                "Raises the crest during alarm, landing, or display",
                "Uses cavities and walls for nesting rather than building a typical cup nest"
            ],
            whyInteresting: [
                "Hoopoes are one of the easiest birds to identify once seen well, thanks to their flight pattern and crest.",
                "They reward attention to both shape and feeding style, not color alone."
            ],
            respectfulSpotting: [
                "Stand still near feeding patches rather than walking toward every landing bird.",
                "Avoid approaching nest holes in walls, banks, or tree cavities."
            ],
            lookalikes: ["Woodhoopoe species", "Jay at brief glance", "Butterfly-like flight of wagtails in heat haze"]
        }
    }),
    createSpeciesEntry({
        slug: "laughing-kookaburra",
        name: "Laughing Kookaburra",
        analysis: {
            summary: "The laughing kookaburra is a large kingfisher famous for loud cackling calls, sit-and-wait hunting, and comfort in both woodland and suburban habitats.",
            scientificName: "Dacelo novaeguineae",
            category: "Bird",
            identification: [
                "Stocky bird with large head and heavy bill",
                "Brown and cream plumage with pale underparts",
                "Usually perched conspicuously while scanning below"
            ],
            habitat: "Open woodland, forest edge, parks, gardens, and farmland with perches and prey-rich ground.",
            nativeRange: "Eastern Australia, with introduced populations in some other regions.",
            rarityScore: 26,
            rarityReason: "Kookaburras remain common where tree perches and mixed feeding habitat persist."
        },
        premiumDetails: {
            behaviorTraits: [
                "Drops from perches to seize reptiles, insects, and small vertebrates",
                "Uses loud chorus calls to advertise territory",
                "Often tolerates suburban environments surprisingly well"
            ],
            whyInteresting: [
                "Kookaburras are excellent examples of a kingfisher lineage shifted away from fish-heavy feeding.",
                "Their calls make them one of the most recognizable birds in Australia."
            ],
            respectfulSpotting: [
                "Do not feed meat scraps or human food around homes or campsites.",
                "Watch from beneath shared perches without crowding nesting hollows."
            ],
            lookalikes: ["Blue-winged kookaburra", "Large kingfisher species", "Small raptor perched at distance"]
        }
    }),
    createSpeciesEntry({
        slug: "greater-bird-of-paradise",
        name: "Greater Bird-of-paradise",
        analysis: {
            summary: "The greater bird-of-paradise is a New Guinea display bird known for ornamental flank plumes, lek behavior, and strong ties to mature forest canopy.",
            scientificName: "Paradisaea apoda",
            category: "Bird",
            identification: [
                "Chestnut and yellow body with emerald throat and pale head",
                "Adult males show long golden flank plumes in display",
                "Active canopy movement with dramatic display posture in breeding sites"
            ],
            habitat: "Lowland and foothill rainforest with display trees and fruit resources.",
            nativeRange: "New Guinea and nearby islands.",
            rarityScore: 74,
            rarityReason: "Birds-of-paradise can remain locally present, but many rely on intact forest and specific display territories."
        },
        premiumDetails: {
            behaviorTraits: [
                "Males gather at display sites where females assess performance",
                "Feeds mainly on fruit with supplemental insects",
                "Uses upper canopy routes between display and feeding trees"
            ],
            whyInteresting: [
                "The species is a classic example of display-driven evolution becoming visually extreme.",
                "It is also a strong flagship for New Guinea forest biodiversity."
            ],
            respectfulSpotting: [
                "Keep far from active display trees and avoid playback pressure.",
                "Use guides who prioritize low-disturbance lek viewing."
            ],
            lookalikes: ["Lesser bird-of-paradise", "Raggiana bird-of-paradise", "Bright canopy pigeons at quick glance"]
        }
    }),
    createSpeciesEntry({
        slug: "rainbow-bee-eater",
        name: "Rainbow Bee-eater",
        analysis: {
            summary: "The rainbow bee-eater is a slim brightly colored aerial insect hunter that catches stinging insects on the wing and nests in burrows.",
            scientificName: "Merops ornatus",
            category: "Bird",
            identification: [
                "Slender bird with green, blue, chestnut, and yellow plumage",
                "Black eye stripe and slightly downcurved bill",
                "Long central tail streamers and elegant swooping flight"
            ],
            habitat: "Open woodland, farmland, riverbanks, grassland, and sandy cuttings suitable for burrows.",
            nativeRange: "Australia and parts of Indonesia and New Guinea with migratory movement in some populations.",
            rarityScore: 31,
            rarityReason: "The species is often common in suitable open habitats with aerial insects and soft nesting banks."
        },
        premiumDetails: {
            behaviorTraits: [
                "Catches bees, wasps, and dragonflies on the wing",
                "Beats stinging prey against perches before swallowing",
                "Nests in tunnels dug into sandy banks or flat ground"
            ],
            whyInteresting: [
                "Bee-eaters show how aerial skill and prey handling can work together in a very visible way.",
                "Their color and behavior make them rewarding birds for beginners and experts alike."
            ],
            respectfulSpotting: [
                "Stay well clear of nesting banks during breeding season.",
                "Watch perch lines and open airspace rather than chasing active flight loops."
            ],
            lookalikes: ["Small kingfisher", "Swallow with color blur", "Other bee-eater species"]
        }
    }),
    createSpeciesEntry({
        slug: "green-sea-turtle",
        name: "Green Sea Turtle",
        analysis: {
            summary: "The green sea turtle is a large marine reptile built for long-distance ocean travel, strong foreflipper propulsion, and seagrass or algae-rich feeding grounds.",
            scientificName: "Chelonia mydas",
            category: "Marine reptile",
            identification: [
                "Smooth oval shell with olive to brown patterned scutes",
                "Large paddle-like front flippers",
                "Rounded head with relatively small beak compared with hawksbill turtles"
            ],
            habitat: "Seagrass meadows, coral reef lagoons, coastal shallows, and ocean migration routes.",
            nativeRange: "Tropical and subtropical oceans worldwide.",
            rarityScore: 76,
            rarityReason: "Green turtles travel widely, but nesting success and juvenile survival are heavily affected by fisheries, coastal development, and pollution."
        },
        premiumDetails: {
            behaviorTraits: [
                "Migrates long distances between nesting beaches and feeding areas",
                "Grazes seagrass and algae in shallow coastal habitat",
                "Returns to natal regions for nesting"
            ],
            whyInteresting: [
                "Green turtles tie beach conservation directly to marine food-web function.",
                "They are one of the clearest marine examples of global movement linked to specific local nesting points."
            ],
            respectfulSpotting: [
                "Never block surfacing turtles or ride directly above resting animals.",
                "Avoid white lights and beach disturbance near nesting areas."
            ],
            lookalikes: ["Loggerhead turtle", "Hawksbill turtle", "Large floating debris from the surface"]
        }
    }),
    createSpeciesEntry({
        slug: "american-alligator",
        name: "American Alligator",
        analysis: {
            summary: "The American alligator is a large armored wetland reptile built for ambush, with a broad snout and strong recovery across many southeastern U.S. habitats.",
            scientificName: "Alligator mississippiensis",
            category: "Reptile",
            identification: [
                "Broad U-shaped snout and darker heavy-bodied profile",
                "Eyes and nostrils high on the head for surface-level concealment",
                "Usually only upper teeth visible when the mouth is closed"
            ],
            habitat: "Swamps, marshes, slow rivers, ponds, and freshwater wetland systems.",
            nativeRange: "Southeastern United States.",
            rarityScore: 33,
            rarityReason: "After major recovery efforts, alligators are now common across much of their range where wetland habitat remains."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits at shore edges and vegetation lines for prey opportunities",
                "Basks openly to regulate temperature",
                "Uses low grunts and water display during breeding"
            ],
            whyInteresting: [
                "Alligators are strong case studies in conservation recovery with functioning wetland habitat.",
                "They also shape wetlands by creating trails and depressions used by other species."
            ],
            respectfulSpotting: [
                "Keep clear of water edges, especially at dusk or around nests.",
                "Never feed wild alligators, which quickly creates dangerous habituation."
            ],
            lookalikes: ["Crocodile", "Caiman", "Floating log with visible eyeshine"]
        }
    }),
    createSpeciesEntry({
        slug: "reticulated-python",
        name: "Reticulated Python",
        analysis: {
            summary: "The reticulated python is one of the world’s longest snakes, built for stealth, constriction, and flexible hunting across forests, wetlands, and edge habitats in Southeast Asia.",
            scientificName: "Malayopython reticulatus",
            category: "Reptile",
            identification: [
                "Large heavy snake with intricate net-like gold, brown, and black patterning",
                "Long head with heat-sensing pits along the jaws",
                "Smooth muscular movement through water, branches, or ground cover"
            ],
            habitat: "Rainforest, swamp forest, river edges, caves, mangroves, and human-modified edges with prey access.",
            nativeRange: "South and Southeast Asia including Indonesia and the Philippines.",
            rarityScore: 55,
            rarityReason: "The species remains widespread, but local visibility depends on cover, prey density, and conflict pressure around settlements."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses camouflage and stillness to set up close ambushes",
                "Constrains prey with powerful muscular coils",
                "Moves readily through water as well as dense terrestrial cover"
            ],
            whyInteresting: [
                "Reticulated pythons are among the clearest examples of giant constrictor design in Asia.",
                "Their range overlaps with people often enough to make conflict and coexistence an important topic."
            ],
            respectfulSpotting: [
                "Never attempt self-guided close approach to large snakes in cover.",
                "Use trained local experts and maintain clear retreat distance."
            ],
            lookalikes: ["Burmese python", "Large rat snake", "Water monitor tail section at a glance"]
        }
    }),
    createSpeciesEntry({
        slug: "green-anaconda",
        name: "Green Anaconda",
        analysis: {
            summary: "The green anaconda is a giant semi-aquatic constrictor built for ambush from dark water, with heavy body mass and cryptic olive coloration.",
            scientificName: "Eunectes murinus",
            category: "Reptile",
            identification: [
                "Very thick olive-green body marked with dark round blotches",
                "Head and eyes positioned for low-water concealment",
                "Often partly submerged in slow swamp or marsh habitat"
            ],
            habitat: "Swamp, marsh, flooded forest, oxbow lake, and slow tropical waterways.",
            nativeRange: "Northern and central South America east of the Andes.",
            rarityScore: 62,
            rarityReason: "The species is naturally hard to detect and depends on intact wetland systems that are unevenly protected."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits in water or floating vegetation for prey to come close",
                "Uses body weight and constriction in shallow wetland ambushes",
                "Basks cautiously between feeding bouts"
            ],
            whyInteresting: [
                "Green anacondas are outstanding examples of water-assisted constrictor strategy.",
                "Their size and secrecy make them powerful symbols of tropical wetland function."
            ],
            respectfulSpotting: [
                "Avoid entering marsh vegetation or shallow channels known for large snake presence.",
                "Observe from boats or firm banks with experienced local guidance."
            ],
            lookalikes: ["Large boa", "Reticulated python in captive comparison", "Submerged log in murky water"]
        }
    }),
    createSpeciesEntry({
        slug: "marine-iguana",
        name: "Marine Iguana",
        analysis: {
            summary: "Marine iguanas are Galapagos reptiles specialized for algae feeding along lava coasts, with flattened tails and salt-handling adaptations for life at the sea edge.",
            scientificName: "Amblyrhynchus cristatus",
            category: "Reptile",
            identification: [
                "Dark blunt-headed iguana often covered in pale salt residue",
                "Flattened tail suited to swimming",
                "Low sprawling posture on black volcanic rock"
            ],
            habitat: "Rocky intertidal shore, lava coast, and nearby dry island scrub.",
            nativeRange: "Endemic to the Galapagos Islands.",
            rarityScore: 73,
            rarityReason: "Marine iguanas are restricted to one archipelago and remain sensitive to El Niño events, disturbance, and introduced threats."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds on marine algae in the intertidal zone and shallow water",
                "Warms on dark lava after cold foraging sessions",
                "Sneezes out excess salt through nasal glands"
            ],
            whyInteresting: [
                "Marine iguanas are one of the clearest examples of reptiles entering a marine feeding niche.",
                "Their island specialization makes them biologically distinctive even among iguanas."
            ],
            respectfulSpotting: [
                "Stay on marked lava paths and do not step through basking groups.",
                "Keep shoreline approaches slow because cold animals need clear recovery space."
            ],
            lookalikes: ["Land iguana", "Dark rock shadow formations", "Large lizard silhouette on basalt"]
        }
    }),
    createSpeciesEntry({
        slug: "frilled-lizard",
        name: "Frilled Lizard",
        analysis: {
            summary: "The frilled lizard is an Australian and New Guinean reptile famous for its expandable neck frill, upright sprinting, and dramatic bluff displays.",
            scientificName: "Chlamydosaurus kingii",
            category: "Reptile",
            identification: [
                "Slender long-tailed lizard with very large foldable neck frill",
                "Brown mottled body matching bark and dry woodland tones",
                "Can run upright on hind legs when alarmed"
            ],
            habitat: "Open woodland, savannah forest, and seasonally dry tropical tree habitat.",
            nativeRange: "Northern Australia and southern New Guinea.",
            rarityScore: 51,
            rarityReason: "Frilled lizards are locally regular in intact northern habitat but not easy to find outside warm active periods."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses dramatic open-frill displays to deter threats",
                "Hunts insects and small vertebrates from trunks and ground",
                "Climbs readily but also sprints between trees when disturbed"
            ],
            whyInteresting: [
                "The frill is one of the most visually memorable defensive structures in reptiles.",
                "Its combination of camouflage and sudden display makes behavior interpretation rewarding."
            ],
            respectfulSpotting: [
                "Do not provoke display behavior for photos.",
                "Scan trunks slowly and let animals choose whether to freeze or move."
            ],
            lookalikes: ["Agamid lizards", "Water dragon juvenile", "Bark patterns hiding resting individuals"]
        }
    }),
    createSpeciesEntry({
        slug: "leopard-gecko",
        name: "Leopard Gecko",
        analysis: {
            summary: "The leopard gecko is a ground-dwelling nocturnal gecko known for spotted skin, movable eyelids, and tail-based energy storage in dry rocky habitats.",
            scientificName: "Eublepharis macularius",
            category: "Reptile",
            identification: [
                "Yellow to pale body with dark spotting or banding",
                "Thick tail that stores fat reserves",
                "Large eyes with eyelids, unlike many geckos"
            ],
            habitat: "Dry rocky scrub, semi-desert, and broken stony ground with crevices.",
            nativeRange: "South Asia including Afghanistan, Pakistan, India, and nearby regions.",
            rarityScore: 44,
            rarityReason: "Wild leopard geckos can be locally regular in suitable habitat, though pet trade familiarity often hides how regionally limited they are."
        },
        premiumDetails: {
            behaviorTraits: [
                "Forages at night for insects and small invertebrates",
                "Stores energy in the tail for lean periods",
                "Uses burrows and rock crevices to avoid daytime heat"
            ],
            whyInteresting: [
                "Leopard geckos are useful examples of dryland nocturnal reptile strategy.",
                "They also demonstrate that not all geckos are wall-climbing specialists."
            ],
            respectfulSpotting: [
                "Search with low light around rocks without overturning shelter sites.",
                "Do not handle wild geckos because tail stress responses are costly."
            ],
            lookalikes: ["House gecko", "Fat-tailed gecko", "Juvenile monitor lizard at poor angle"]
        }
    }),
    createSpeciesEntry({
        slug: "black-mamba",
        name: "Black Mamba",
        analysis: {
            summary: "The black mamba is a fast, alert African elapid known for large range use, potent venom, and impressive height when threatened.",
            scientificName: "Dendroaspis polylepis",
            category: "Reptile",
            identification: [
                "Long grey to olive snake with coffin-shaped head",
                "Interior of the mouth appears inky black during threat display",
                "Fast smooth movement with head carried well off the ground"
            ],
            habitat: "Savannah, rocky outcrop, woodland edge, and dry river corridor with shelter sites.",
            nativeRange: "Sub-Saharan Africa in eastern, central, and southern regions.",
            rarityScore: 59,
            rarityReason: "Black mambas range widely but are naturally sparse and usually avoided or killed where they overlap closely with people."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses speed and early detection to avoid conflict when escape is possible",
                "Hunts small mammals and birds with active searching and ambush",
                "Returns to favored shelter cracks or hollows"
            ],
            whyInteresting: [
                "The species is one of Africa’s clearest examples of speed and venom combined in one snake system.",
                "It is also frequently misunderstood as more aggressive than its usual escape-first behavior suggests."
            ],
            respectfulSpotting: [
                "Do not walk into thick rock or bush cover without trained local guidance.",
                "Back away immediately if a snake is elevated or tracking your movement."
            ],
            lookalikes: ["Boomslang", "Large rat snake", "Other mamba species"]
        }
    }),
    createSpeciesEntry({
        slug: "axolotl",
        name: "Axolotl",
        analysis: {
            summary: "The axolotl is an aquatic salamander famous for retaining larval features into adulthood, external gills, and remarkable tissue regeneration.",
            scientificName: "Ambystoma mexicanum",
            category: "Amphibian",
            identification: [
                "External feathery gills projecting from each side of the head",
                "Broad smiling face and long finned tail",
                "Fully aquatic body form even as a reproductive adult"
            ],
            habitat: "Cool freshwater canals, remnant lakes, and slow wetland channels with cover.",
            nativeRange: "Originally endemic to the lake system around Mexico City.",
            rarityScore: 97,
            rarityReason: "Wild axolotls are critically restricted and heavily threatened by urbanization, pollution, and introduced fish."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds on worms, aquatic invertebrates, and small prey by suction",
                "Remains aquatic throughout life rather than shifting fully onto land",
                "Uses still or slow water with submerged cover"
            ],
            whyInteresting: [
                "Axolotls are biologically famous for regeneration and developmental unusualness.",
                "They also show how iconic animals can still be perilously fragile in the wild."
            ],
            respectfulSpotting: [
                "Support legitimate conservation channels rather than novelty wildlife trade.",
                "Treat wild-location details with caution because habitat is extremely limited."
            ],
            lookalikes: ["Mudpuppy", "Larval salamanders", "Captive morph varieties"]
        }
    }),
    createSpeciesEntry({
        slug: "poison-dart-frog",
        name: "Poison Dart Frog",
        analysis: {
            summary: "Poison dart frogs are small tropical amphibians known for bright warning colors, daytime activity, and skin toxins derived through diet and ecology.",
            scientificName: "Dendrobatidae",
            category: "Amphibian",
            identification: [
                "Tiny compact frog with vivid blue, yellow, orange, black, or red patterning",
                "Long legs relative to body size and active hopping on forest floor or low plants",
                "Usually seen by day rather than at night"
            ],
            habitat: "Humid tropical forest, leaf litter, mossy ground, and stream-edge microhabitats.",
            nativeRange: "Central and South America.",
            rarityScore: 67,
            rarityReason: "Some species are local strongholds, but many dart frogs have small ranges and rely on intact humid forest."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses bright coloration as warning signal to predators",
                "Males often guard eggs or transport tadpoles to water pockets",
                "Forages actively by day on ants and tiny invertebrates"
            ],
            whyInteresting: [
                "Dart frogs make the link between signal design and chemical defense easy to see.",
                "Their parental behavior is unusually advanced for very small amphibians."
            ],
            respectfulSpotting: [
                "Avoid handling because skin coatings and stress both matter.",
                "Watch low vegetation and leaf litter slowly rather than disturbing the forest floor."
            ],
            lookalikes: ["Small tree frog species", "Mantella frogs in non-native comparisons", "Leaf beetles in poor photos"]
        }
    })
);

expandedSpeciesData.push(
    createSpeciesEntry({
        slug: "red-eyed-tree-frog",
        name: "Red-eyed Tree Frog",
        analysis: {
            summary: "The red-eyed tree frog is a bright canopy amphibian known for leaf-side resting, explosive color contrast, and breeding tied to humid forest pools.",
            scientificName: "Agalychnis callidryas",
            category: "Amphibian",
            identification: [
                "Bright green back with vivid red eyes",
                "Blue and yellow flank striping and orange feet",
                "Usually rests flattened against leaves in the day"
            ],
            habitat: "Lowland rainforest, wet secondary growth, and forest-edge ponds with overhanging vegetation.",
            nativeRange: "Central America from southern Mexico to northwestern South America.",
            rarityScore: 48,
            rarityReason: "The species remains locally common where humid forest and breeding pools persist, but it declines with drainage and forest loss."
        },
        premiumDetails: {
            behaviorTraits: [
                "Breeds on leaves above water so tadpoles drop in after hatching",
                "Uses still posture and closed eyes to reduce daytime visibility",
                "Becomes highly active during warm wet nights"
            ],
            whyInteresting: [
                "Its color pattern is one of the clearest examples of startle contrast in a frog.",
                "The species is a strong gateway animal for understanding tropical amphibian breeding strategies."
            ],
            respectfulSpotting: [
                "Use dim light at night and avoid handling leaf perches.",
                "Stay on trails around breeding pools to protect eggs and vegetation."
            ],
            lookalikes: ["Other Agalychnis tree frogs", "Glass frog species at quick glance", "Bright green geckos in poor light"]
        }
    }),
    createSpeciesEntry({
        slug: "glass-frog",
        name: "Glass Frog",
        analysis: {
            summary: "Glass frogs are small translucent amphibians known for see-through undersides, leaf-side breeding, and quiet streamside life in humid forest.",
            scientificName: "Centrolenidae",
            category: "Amphibian",
            identification: [
                "Small green frog with pale translucent underside",
                "Often perches on leaves above streams",
                "Fine-limbed delicate body with pale bones or organs partly visible below"
            ],
            habitat: "Cloud forest and humid tropical stream corridors with clean flowing water.",
            nativeRange: "Central and South America.",
            rarityScore: 71,
            rarityReason: "Many glass frogs are narrow-range stream specialists vulnerable to water quality shifts and forest disturbance."
        },
        premiumDetails: {
            behaviorTraits: [
                "Calls from leaves above running water rather than open pond edges",
                "Often guards eggs laid on vegetation over streams",
                "Relies on camouflage and transparency more than strong escape bursts"
            ],
            whyInteresting: [
                "Glass frogs make microhabitat specialization visible at very small scale.",
                "Their breeding and body transparency are both biologically distinctive."
            ],
            respectfulSpotting: [
                "Search streamside leaves carefully without bending or tearing vegetation.",
                "Keep boots and hands out of breeding stream margins where eggs and tadpoles are vulnerable."
            ],
            lookalikes: ["Tree frog species", "Leaf insects in poor light", "Tiny green geckos on leaves"]
        }
    }),
    createSpeciesEntry({
        slug: "chinese-giant-salamander",
        name: "Chinese Giant Salamander",
        analysis: {
            summary: "The Chinese giant salamander is one of the world’s largest amphibians, a river-bottom predator built for cool fast water and hidden rocky shelter.",
            scientificName: "Andrias davidianus",
            category: "Amphibian",
            identification: [
                "Huge flattened body with broad head and wrinkled skin",
                "Small lidless-looking eyes and heavy tail for swimming",
                "Usually hidden among submerged rock crevices"
            ],
            habitat: "Cool mountain streams, rocky rivers, and deep freshwater pools with high oxygen levels.",
            nativeRange: "Historically central and southern China, now heavily reduced and fragmented.",
            rarityScore: 98,
            rarityReason: "Wild populations are critically reduced by overharvest, pollution, and river alteration."
        },
        premiumDetails: {
            behaviorTraits: [
                "Ambushes fish, crustaceans, and other prey from underwater cover",
                "Stays hidden in deep rock cavities by day",
                "Depends on cold clean flow rather than warm pond systems"
            ],
            whyInteresting: [
                "This species shows how large-bodied amphibians can occupy serious predatory roles in rivers.",
                "It is also an urgent conservation example of freshwater decline."
            ],
            respectfulSpotting: [
                "Support habitat protection and licensed conservation work rather than novelty wildlife experiences.",
                "Treat any wild location data as highly sensitive."
            ],
            lookalikes: ["Hellbender", "Large catfish in murky water", "Submerged log under torchlight"]
        }
    }),
    createSpeciesEntry({
        slug: "american-bullfrog",
        name: "American Bullfrog",
        analysis: {
            summary: "The American bullfrog is a large pond and marsh amphibian known for deep calls, strong hind legs, and broad tolerance for warm freshwater habitat.",
            scientificName: "Lithobates catesbeianus",
            category: "Amphibian",
            identification: [
                "Large robust frog with wide mouth and green-brown body",
                "Prominent eardrum behind each eye",
                "Deep resonant call from pond edges in breeding season"
            ],
            habitat: "Ponds, lakes, marshes, canals, and warm slow freshwater with aquatic vegetation.",
            nativeRange: "Eastern North America, with introduced populations in many other regions.",
            rarityScore: 22,
            rarityReason: "Bullfrogs are common and often invasive because they tolerate a wide range of freshwater conditions."
        },
        premiumDetails: {
            behaviorTraits: [
                "Feeds opportunistically on insects, fish, frogs, and small vertebrates",
                "Uses shoreline ambush and sudden lunges during feeding",
                "Calls loudly from shallow water territories"
            ],
            whyInteresting: [
                "Bullfrogs are useful examples of how amphibians can become dominant in altered freshwater systems.",
                "Their invasive spread makes them important in applied ecology."
            ],
            respectfulSpotting: [
                "Watch from pond edges without trampling reed margins.",
                "Learn local status because management rules may differ in invasive regions."
            ],
            lookalikes: ["Green frog", "Large toad at a glance", "Young giant salamander head in murky water"]
        }
    }),
    createSpeciesEntry({
        slug: "hellbender",
        name: "Hellbender",
        analysis: {
            summary: "The hellbender is a large fully aquatic salamander that lives under rocks in clean fast streams and breathes heavily through folded skin.",
            scientificName: "Cryptobranchus alleganiensis",
            category: "Amphibian",
            identification: [
                "Flattened brown body with wrinkled loose skin along the sides",
                "Broad head and tiny eyes on a low river-bottom profile",
                "Large salamander shape tucked beneath rocks in flowing water"
            ],
            habitat: "Cool clear streams and rivers with large flat stones and strong oxygen flow.",
            nativeRange: "Eastern United States in fragmented Appalachian and Ozark systems.",
            rarityScore: 87,
            rarityReason: "Hellbenders require very clean river habitat and decline quickly when sedimentation and pollution increase."
        },
        premiumDetails: {
            behaviorTraits: [
                "Shelters under submerged rocks during daylight hours",
                "Feeds on crayfish and other bottom-associated prey",
                "Depends on skin respiration supported by clean flowing water"
            ],
            whyInteresting: [
                "Hellbenders are powerful freshwater indicators because they need river systems that still function well.",
                "Their unusual body folds make physiology visible to field learners."
            ],
            respectfulSpotting: [
                "Do not lift stream rocks in habitat without permits and proper survey methods.",
                "Keep sediment disturbance low in headwater and river access sites."
            ],
            lookalikes: ["Mudpuppy", "Chinese giant salamander in photos", "Large fish under rocks"]
        }
    }),
    createSpeciesEntry({
        slug: "wallaces-flying-frog",
        name: "Wallace's Flying Frog",
        analysis: {
            summary: "Wallace's flying frog is a Southeast Asian tree frog known for oversized webbing, arboreal breeding, and gliding-style leaps between forest branches.",
            scientificName: "Rhacophorus nigropalmatus",
            category: "Amphibian",
            identification: [
                "Bright green body with very large orange and black webbed feet",
                "Long limbs and large toe pads for canopy life",
                "Expanded webbing visible during long leaps"
            ],
            habitat: "Lowland tropical rainforest and forest pools with overhanging breeding vegetation.",
            nativeRange: "Borneo, Peninsular Malaysia, and nearby parts of Southeast Asia.",
            rarityScore: 75,
            rarityReason: "The species depends on humid forest canopy systems that are increasingly fragmented."
        },
        premiumDetails: {
            behaviorTraits: [
                "Leaps between branches using broad webbing to control descent",
                "Breeds in foam nests over temporary pools or water",
                "Uses high canopy cover and night humidity for activity"
            ],
            whyInteresting: [
                "This frog is one of the clearest examples of gliding-adjacent design in amphibians.",
                "It is also a strong Southeast Asian forest flagship beyond the usual mammals."
            ],
            respectfulSpotting: [
                "Use low light and avoid disturbing breeding pools below nesting branches.",
                "Search canopy edges patiently rather than shaking vegetation."
            ],
            lookalikes: ["Other flying frog species", "Tree frog on broad leaves", "Large leaf with reflected eye shine"]
        }
    }),
    createSpeciesEntry({
        slug: "monarch-butterfly",
        name: "Monarch Butterfly",
        analysis: {
            summary: "The monarch butterfly is a migratory milkweed specialist recognized by orange-and-black wings, long-distance travel, and chemical defense tied to larval host plants.",
            scientificName: "Danaus plexippus",
            category: "Insect",
            identification: [
                "Bright orange wings with black veins and white-spotted borders",
                "Slow strong flapping flight and long glides in open air",
                "Caterpillars banded in black, white, and yellow on milkweed"
            ],
            habitat: "Meadow, garden, field edge, migration corridor, and overwintering woodland depending on season.",
            nativeRange: "North America with migratory and resident populations extending into Central America and beyond.",
            rarityScore: 69,
            rarityReason: "Monarchs remain famous but have declined in several migration systems because milkweed loss and climate pressures reduce resilience."
        },
        premiumDetails: {
            behaviorTraits: [
                "Lays eggs almost exclusively on milkweed species",
                "Migrates over huge distances in some populations",
                "Uses toxic chemistry from host plants as a predator deterrent"
            ],
            whyInteresting: [
                "Monarchs tie migration, plant ecology, and warning coloration into one readable story.",
                "They are also among the best-known insects for citizen science tracking."
            ],
            respectfulSpotting: [
                "Protect nectar and milkweed patches instead of netting adults casually.",
                "Avoid handling butterflies during cool mornings when they are slow to warm up."
            ],
            lookalikes: ["Viceroy butterfly", "Queen butterfly", "Painted lady at quick glance"]
        }
    }),
    createSpeciesEntry({
        slug: "dragonfly",
        name: "Dragonfly",
        analysis: {
            summary: "Dragonflies are aerial predatory insects known for giant compound eyes, powerful flight control, and hunting success over water and open edges.",
            scientificName: "Anisoptera",
            category: "Insect",
            identification: [
                "Long abdomen with two pairs of stiff outstretched wings",
                "Large eyes occupying much of the head",
                "Fast agile flight with hovering and sudden direction changes"
            ],
            habitat: "Ponds, lakes, marshes, slow rivers, and wet meadows where aquatic larvae can develop.",
            nativeRange: "Dragonflies occur worldwide in suitable freshwater-linked habitats.",
            rarityScore: 26,
            rarityReason: "Many dragonflies are common where freshwater systems remain functional, though specialists can decline sharply with water degradation."
        },
        premiumDetails: {
            behaviorTraits: [
                "Hunts small flying insects in open airspace",
                "Spends larval stages underwater as active predators",
                "Uses specific perches and patrol routes over territory"
            ],
            whyInteresting: [
                "Dragonflies are excellent examples of an insect life split between aquatic and aerial predation.",
                "Their flight control makes them useful biomimicry references."
            ],
            respectfulSpotting: [
                "Approach ponds slowly and watch perch reuse rather than chasing active fliers.",
                "Avoid trampling reed edges where emergence and breeding occur."
            ],
            lookalikes: ["Damselfly", "Robber fly", "Large wasp at speed"]
        }
    }),
    createSpeciesEntry({
        slug: "praying-mantis",
        name: "Praying Mantis",
        analysis: {
            summary: "Praying mantises are ambush insects with rotating heads, grasping forelegs, and camouflage that lets them wait close to prey and pollinators.",
            scientificName: "Mantodea",
            category: "Insect",
            identification: [
                "Triangular mobile head with large prominent eyes",
                "Folded spined forelegs held in a grasping posture",
                "Slender body often matching green or brown vegetation"
            ],
            habitat: "Grassland, shrubland, woodland edge, gardens, and flower-rich vegetation.",
            nativeRange: "Mantises occur widely across warm and temperate regions worldwide.",
            rarityScore: 37,
            rarityReason: "Many mantis species are locally common in warm seasons where vegetation structure and insect prey remain abundant."
        },
        premiumDetails: {
            behaviorTraits: [
                "Waits in still ambush posture rather than searching constantly",
                "Tracks movement with head rotation before striking",
                "Captures prey with lightning-fast foreleg extension"
            ],
            whyInteresting: [
                "Mantises make ambush timing and visual tracking unusually obvious in an insect.",
                "Their body posture is so distinctive that identification often starts with silhouette alone."
            ],
            respectfulSpotting: [
                "Watch flower patches and shrubs without pulling stems or branches apart.",
                "Avoid staged handling that forces threat displays."
            ],
            lookalikes: ["Stick insect", "Katydid nymph", "Orchid mantis and other mantis relatives"]
        }
    }),
    createSpeciesEntry({
        slug: "dung-beetle",
        name: "Dung Beetle",
        analysis: {
            summary: "Dung beetles are nutrient-cycling insects known for rolling, burying, or tunneling dung and helping return organic material quickly to soil systems.",
            scientificName: "Scarabaeinae",
            category: "Insect",
            identification: [
                "Compact shiny beetle body with strong digging or pushing legs",
                "Often seen around dung or soil disturbance sites",
                "Some species roll nearly spherical dung balls across open ground"
            ],
            habitat: "Grassland, savannah, woodland, pasture, and forest with mammal activity and workable soil.",
            nativeRange: "Dung beetles occur worldwide with especially high diversity in warm regions.",
            rarityScore: 23,
            rarityReason: "Many species remain common where large herbivores or livestock still provide a steady resource base."
        },
        premiumDetails: {
            behaviorTraits: [
                "Buries or moves dung to feed adults and larvae",
                "Uses scent rapidly to find fresh organic material",
                "Can navigate using sun, sky cues, and landscape memory"
            ],
            whyInteresting: [
                "Dung beetles show how waste-processing can be one of the most important ecosystem jobs on land.",
                "Their orientation behavior is more sophisticated than many people expect from small beetles."
            ],
            respectfulSpotting: [
                "Watch from a crouched distance rather than stepping through active dung sites.",
                "Leave dung pats and surrounding soil intact if observing behavior."
            ],
            lookalikes: ["Other scarab beetles", "Dark carrion beetles", "Ground beetles near livestock areas"]
        }
    }),
    createSpeciesEntry({
        slug: "atlas-moth",
        name: "Atlas Moth",
        analysis: {
            summary: "The atlas moth is one of the world’s largest moths, known for enormous patterned wings and a short adult life focused mainly on reproduction.",
            scientificName: "Attacus atlas",
            category: "Insect",
            identification: [
                "Huge rust-brown wings with pale windows and snake-head-like tips",
                "Heavy fuzzy body compared with most moths",
                "Usually seen resting rather than actively feeding as an adult"
            ],
            habitat: "Tropical forest, plantation edge, and wooded gardens with suitable host plants.",
            nativeRange: "South and Southeast Asia.",
            rarityScore: 58,
            rarityReason: "Atlas moths are local and seasonal rather than truly common, and adults are short-lived even where breeding habitat persists."
        },
        premiumDetails: {
            behaviorTraits: [
                "Adults rely on energy stored from the caterpillar stage",
                "Large wings deter predators and assist short gliding flights",
                "Larvae feed heavily on leaves before rapid growth completion"
            ],
            whyInteresting: [
                "The species is visually spectacular and biologically useful for teaching life-stage trade-offs.",
                "Its adult phase is a strong reminder that not every animal stage is built for feeding."
            ],
            respectfulSpotting: [
                "Do not handle resting moths because wing scales damage easily.",
                "Use soft light and let perched adults remain undisturbed."
            ],
            lookalikes: ["Other giant silk moths", "Leaf clusters on walls", "Bat silhouette in low light"]
        }
    }),
    createSpeciesEntry({
        slug: "leafcutter-ant",
        name: "Leafcutter Ant",
        analysis: {
            summary: "Leafcutter ants are social insects that cut vegetation to farm fungus, building large colonies and highly organized transport trails in tropical systems.",
            scientificName: "Atta and Acromyrmex spp.",
            category: "Insect",
            identification: [
                "Lines of ants carrying fresh leaf fragments above the body",
                "Different worker sizes visible in the same colony",
                "Well-used trails leading to underground nest systems"
            ],
            habitat: "Tropical forest, secondary growth, savannah woodland, and agricultural edges in the Neotropics.",
            nativeRange: "Central and South America.",
            rarityScore: 29,
            rarityReason: "Leafcutter colonies can be abundant locally wherever warm climate and plant material support fungus farming."
        },
        premiumDetails: {
            behaviorTraits: [
                "Cuts leaves as fungus substrate rather than direct food",
                "Uses caste specialization for transport, defense, and nest care",
                "Maintains large subterranean chamber networks"
            ],
            whyInteresting: [
                "Leafcutters are some of the best real-world examples of insect agriculture.",
                "Their trail systems make collective logistics visible at human scale."
            ],
            respectfulSpotting: [
                "Observe active trails without blocking or stomping worker flow.",
                "Avoid digging into nests or opening chambers."
            ],
            lookalikes: ["Army ants", "Termite worker lines", "Other large ant species on vegetation"]
        }
    }),
    createSpeciesEntry({
        slug: "rhinoceros-beetle",
        name: "Rhinoceros Beetle",
        analysis: {
            summary: "Rhinoceros beetles are heavy scarabs known for horned males, strong lifting power, and larval dependence on rotting wood or decaying plant matter.",
            scientificName: "Dynastinae",
            category: "Insect",
            identification: [
                "Robust shiny beetle with horned head or thorax in males",
                "Thick legs and hard wing covers",
                "Slow powerful movement on trunks, lights, or the ground"
            ],
            habitat: "Forest, plantation edge, gardens, and areas with decaying wood or composting plant material.",
            nativeRange: "Rhinoceros beetles occur worldwide, especially in tropical and subtropical regions.",
            rarityScore: 41,
            rarityReason: "Many species are local and seasonal, appearing where breeding material and warm conditions align."
        },
        premiumDetails: {
            behaviorTraits: [
                "Males use horns in pushing contests rather than biting duels",
                "Larvae develop in rotting organic material",
                "Adults often come to lights or sap flows at night"
            ],
            whyInteresting: [
                "Rhinoceros beetles make structural weaponry and beetle strength highly visible.",
                "They are good examples of insect life stages using very different resources."
            ],
            respectfulSpotting: [
                "Leave dead wood and compost habitat undisturbed when possible.",
                "Do not pry horned males off trunks for handling."
            ],
            lookalikes: ["Stag beetle", "Large scarab beetle", "Dark cockroach species at a glance"]
        }
    }),
    createSpeciesEntry({
        slug: "cicada",
        name: "Cicada",
        analysis: {
            summary: "Cicadas are sap-feeding insects known for explosive seasonal emergence, loud mating calls, and long juvenile stages hidden underground.",
            scientificName: "Cicadoidea",
            category: "Insect",
            identification: [
                "Chunky-bodied insect with clear tented wings",
                "Large eyes set wide on the head",
                "Distinctive shed skins often left on trunks after emergence"
            ],
            habitat: "Woodland, forest edge, parks, orchards, and any tree-rich landscape with underground root access.",
            nativeRange: "Cicadas occur worldwide except Antarctica.",
            rarityScore: 31,
            rarityReason: "Many cicada species are common when emergence conditions align, though individual species may be highly seasonal or local."
        },
        premiumDetails: {
            behaviorTraits: [
                "Nymphs spend years underground feeding on root fluids",
                "Males produce loud species-specific calls from trees",
                "Adults emerge in pulses that can change predator feeding behavior"
            ],
            whyInteresting: [
                "Cicadas are excellent examples of long hidden development followed by short intense reproductive windows.",
                "Their soundscape impact makes ecological timing easy to notice."
            ],
            respectfulSpotting: [
                "Look for fresh shed skins and calling trees rather than catching adults repeatedly.",
                "Leave emergence trunks and soft soil undisturbed in peak season."
            ],
            lookalikes: ["Leafhopper relatives", "Large moth pupal shells", "Winged aphids at quick glance"]
        }
    }),
    createSpeciesEntry({
        slug: "orchid-mantis",
        name: "Orchid Mantis",
        analysis: {
            summary: "The orchid mantis is a Southeast Asian ambush predator whose petal-like body form helps it blend into flowers while waiting for pollinating insects.",
            scientificName: "Hymenopus coronatus",
            category: "Insect",
            identification: [
                "White to pink body with flattened petal-like legs",
                "Compact mantis head and grasping forelegs hidden within floral posture",
                "Usually rests among blossoms or pale leaves"
            ],
            habitat: "Humid tropical forest and flowering understory vegetation.",
            nativeRange: "Southeast Asia including Malaysia, Indonesia, and surrounding regions.",
            rarityScore: 66,
            rarityReason: "The species is not widespread in open habitat and depends on humid vegetation structure where camouflage works well."
        },
        premiumDetails: {
            behaviorTraits: [
                "Ambushes pollinators and other insects from flower-like perches",
                "Uses body shape as visual deception rather than just background matching",
                "Relies on stillness and short-range strike speed"
            ],
            whyInteresting: [
                "The orchid mantis is one of the best examples of aggressive camouflage in insects.",
                "Its design is so unusual that it often changes how people think about insect predation."
            ],
            respectfulSpotting: [
                "Inspect flowers carefully without pulling or shaking stems.",
                "Avoid handling because posture damage undermines camouflage and survival."
            ],
            lookalikes: ["Flower crab spider", "Other mantis nymphs", "Petal clusters with shadow contrast"]
        }
    }),
    createSpeciesEntry({
        slug: "clownfish",
        name: "Clownfish",
        analysis: {
            summary: "Clownfish are reef fish known for bold orange-and-white patterning and their protective mutualism with sea anemones.",
            scientificName: "Amphiprion ocellaris",
            category: "Marine fish",
            identification: [
                "Bright orange body with three white bands edged in black",
                "Small oval fish often hovering around a single anemone",
                "Quick darting movement back into tentacle cover"
            ],
            habitat: "Warm shallow coral reefs and lagoon systems with host anemones.",
            nativeRange: "Indo-Pacific region including Southeast Asia and northern Australia.",
            rarityScore: 36,
            rarityReason: "Clownfish are common where healthy anemone hosts and reef habitat remain intact."
        },
        premiumDetails: {
            behaviorTraits: [
                "Lives within and around a host anemone for shelter",
                "Maintains social rank systems tied to body size",
                "Defends local anemone territory against small intruders"
            ],
            whyInteresting: [
                "Clownfish are among the clearest examples of marine mutualism visible to general audiences.",
                "Their reef association makes habitat damage immediately relevant to species behavior."
            ],
            respectfulSpotting: [
                "Do not tap or hover directly over host anemones during dives.",
                "Avoid flash bursts at very close range on nesting pairs."
            ],
            lookalikes: ["Other anemonefish", "Damselfish at distance", "Juvenile butterflyfish in quick reef views"]
        }
    }),
    createSpeciesEntry({
        slug: "seahorse",
        name: "Seahorse",
        analysis: {
            summary: "Seahorses are upright marine fish with grasping tails, tube-like snouts, and unusually slow precise hunting behavior in vegetation-rich coastal waters.",
            scientificName: "Hippocampus spp.",
            category: "Marine fish",
            identification: [
                "Horse-like head on an upright body posture",
                "Prehensile tail wrapped around seagrass or coral structure",
                "Segmented armor rather than obvious fish scales"
            ],
            habitat: "Seagrass beds, mangroves, estuaries, and sheltered coral or sponge habitats.",
            nativeRange: "Temperate and tropical coastal waters worldwide depending on species.",
            rarityScore: 72,
            rarityReason: "Many seahorses are naturally patchy and become vulnerable when shallow nursery habitat is degraded."
        },
        premiumDetails: {
            behaviorTraits: [
                "Anchors to vegetation while sucking in tiny prey with a quick snap",
                "Relies on camouflage and stillness rather than sustained swimming speed",
                "Males brood developing young in a pouch"
            ],
            whyInteresting: [
                "Seahorses make role reversal in reproduction and habitat dependence unusually visible.",
                "They are excellent indicators of fragile coastal nursery systems."
            ],
            respectfulSpotting: [
                "Never grab seagrass or coral where seahorses may be attached.",
                "Keep fin kicks gentle in shallow nursery habitat."
            ],
            lookalikes: ["Pipefish", "Floating algae at a glance", "Decorated shrimp on seagrass"]
        }
    }),
    createSpeciesEntry({
        slug: "manta-ray",
        name: "Manta Ray",
        analysis: {
            summary: "Manta rays are giant plankton-feeding rays known for broad wing-like pectoral fins, cephalic lobes, and efficient cruising through productive ocean water.",
            scientificName: "Mobula birostris",
            category: "Marine fish",
            identification: [
                "Very wide diamond-shaped body with long wing-like fins",
                "Forward cephalic lobes flanking the mouth",
                "Graceful looping or gliding movement through open water"
            ],
            habitat: "Coastal cleaning stations, offshore fronts, reef drop-offs, and plankton-rich ocean zones.",
            nativeRange: "Tropical and subtropical oceans worldwide.",
            rarityScore: 77,
            rarityReason: "Mantas range widely but reproduce slowly and are sensitive to fishing pressure and disturbance at aggregation sites."
        },
        premiumDetails: {
            behaviorTraits: [
                "Filters plankton and small prey while cruising or barrel rolling",
                "Visits cleaning stations repeatedly where reef fish remove parasites",
                "Uses large-scale movement between seasonal feeding areas"
            ],
            whyInteresting: [
                "Mantas combine giant size with filter feeding in a way that reads instantly to divers.",
                "Their cleaning-station behavior is one of the most rewarding marine observation patterns."
            ],
            respectfulSpotting: [
                "Stay low and out of the swimming line at cleaning stations.",
                "Do not chase or block circling feeding behavior from above."
            ],
            lookalikes: ["Mobula ray", "Eagle ray", "Large shadow under surface chop"]
        }
    }),
    createSpeciesEntry({
        slug: "great-white-shark",
        name: "Great White Shark",
        analysis: {
            summary: "The great white shark is a large predatory fish built for fast bursts, strong bite force, and long-range sensory detection in temperate and subtropical seas.",
            scientificName: "Carcharodon carcharias",
            category: "Marine fish",
            identification: [
                "Heavy torpedo-shaped body with grey upperparts and white underside",
                "Large triangular dorsal fin and crescent tail",
                "Conical snout and robust jaw profile"
            ],
            habitat: "Coastal seal colonies, offshore fronts, temperate reefs, and productive upwelling waters.",
            nativeRange: "Temperate and subtropical oceans worldwide.",
            rarityScore: 78,
            rarityReason: "Great whites are globally distributed but naturally sparse and slow to replace where fishing or bycatch pressure occurs."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses scent, vibration, and electroreception to locate prey",
                "Patrols productive marine edges rather than random open ocean space",
                "Can breach or strike upward during focused attacks"
            ],
            whyInteresting: [
                "Great whites are iconic examples of high-performance marine predation without social coordination.",
                "They also illustrate how apex marine fish depend on long maturation and low turnover."
            ],
            respectfulSpotting: [
                "Follow licensed operator rules and avoid any unregulated close-water interaction.",
                "Do not create noisy or erratic surface movement where sharks are actively investigating."
            ],
            lookalikes: ["Mako shark", "Large tuna fin profile", "Bronze whaler in quick view"]
        }
    }),
    createSpeciesEntry({
        slug: "scalloped-hammerhead",
        name: "Scalloped Hammerhead",
        analysis: {
            summary: "The scalloped hammerhead is a schooling shark with a distinctive head shape that improves sensory spacing and maneuvering while hunting in coastal and offshore waters.",
            scientificName: "Sphyrna lewini",
            category: "Marine fish",
            identification: [
                "Wide hammer-shaped head with central notch",
                "Tall curved dorsal fin and slim grey body",
                "Often seen in loose schooling formations around islands or drop-offs"
            ],
            habitat: "Coastal shelves, seamounts, oceanic islands, estuaries, and warm offshore waters.",
            nativeRange: "Tropical and warm temperate oceans worldwide.",
            rarityScore: 88,
            rarityReason: "The species has suffered major declines from fishing pressure and slow population recovery."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses broad head shape to improve prey detection and handling",
                "Forms schools in some daytime settings before dispersing to feed",
                "Moves between offshore sites and coastal nursery zones"
            ],
            whyInteresting: [
                "Hammerheads make sensory design visible in body shape more clearly than most sharks.",
                "Their declines also make them urgent conservation indicators for pelagic systems."
            ],
            respectfulSpotting: [
                "Maintain calm positioning around schooling sharks and never cut across their path.",
                "Choose operators that minimize baiting pressure and crowding."
            ],
            lookalikes: ["Smooth hammerhead", "Great hammerhead", "Large ray wing shadows from above"]
        }
    }),
    createSpeciesEntry({
        slug: "cuttlefish",
        name: "Cuttlefish",
        analysis: {
            summary: "Cuttlefish are intelligent cephalopods known for rapid color change, hovering control, and sophisticated body signaling in coastal marine habitats.",
            scientificName: "Sepiida",
            category: "Marine invertebrate",
            identification: [
                "Broad oval body with side fins running along much of the mantle",
                "Large W-shaped pupils and short arms around the mouth",
                "Fast changes in color, contrast, and skin texture"
            ],
            habitat: "Seagrass, reef edge, sandy bottoms, and temperate or tropical coastal shallows.",
            nativeRange: "Cuttlefish occur widely across Old World seas depending on species.",
            rarityScore: 46,
            rarityReason: "Many cuttlefish are seasonal and local but can be common where breeding and feeding habitat remain suitable."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses dynamic camouflage and signaling during hunting and display",
                "Hovers with fine fin control over reef or sand",
                "Attacks prey with rapid tentacle projection"
            ],
            whyInteresting: [
                "Cuttlefish make active signal manipulation one of the main visible parts of daily behavior.",
                "They are among the strongest marine examples of sensing, camouflage, and intelligence fused together."
            ],
            respectfulSpotting: [
                "Do not corner animals against reef or sand while filming.",
                "Use slow movements because abrupt pursuit disrupts natural signaling behavior."
            ],
            lookalikes: ["Squid", "Octopus juvenile", "Broad-bodied reef fish in dim light"]
        }
    }),
    createSpeciesEntry({
        slug: "chambered-nautilus",
        name: "Chambered Nautilus",
        analysis: {
            summary: "The chambered nautilus is a deep-reef cephalopod with a coiled shell, buoyancy chambers, and a slow scavenging-predatory lifestyle in Indo-Pacific waters.",
            scientificName: "Nautilus pompilius",
            category: "Marine invertebrate",
            identification: [
                "Cream and brown striped spiral shell with many chambers",
                "Soft body extends from shell opening with numerous tentacles",
                "Usually associated with deeper slope habitats rather than shallow reef tops"
            ],
            habitat: "Deep reef slopes and upper continental shelf drop-offs with access to shelter and cooler water.",
            nativeRange: "Indo-Pacific region from Southeast Asia to the western Pacific.",
            rarityScore: 81,
            rarityReason: "Nautilus populations are vulnerable to overcollection and slow recovery because they mature late and remain localized around deep reef systems."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses gas-filled shell chambers to manage buoyancy",
                "Forages on carrion and small prey in dim deeper water",
                "Moves vertically between depth zones over daily cycles"
            ],
            whyInteresting: [
                "The shell turns internal buoyancy control into a visible engineering feature.",
                "Nautiluses also preserve a very different cephalopod strategy from octopus and squid."
            ],
            respectfulSpotting: [
                "Support protection over shell trade and souvenir demand.",
                "Use licensed deep-water operators that do not handle or trap animals casually."
            ],
            lookalikes: ["Argonaut shell in photos", "Ammonite fossils in illustration", "Floating debris from boat decks"]
        }
    }),
    createSpeciesEntry({
        slug: "sea-cucumber",
        name: "Sea Cucumber",
        analysis: {
            summary: "Sea cucumbers are soft-bodied marine echinoderms that process seabed sediment, recycle organic material, and quietly support healthy benthic systems.",
            scientificName: "Holothuroidea",
            category: "Marine invertebrate",
            identification: [
                "Elongated leathery body lying directly on the seabed",
                "Mouth surrounded by feeding tentacles in many species",
                "Slow almost static movement over sand, seagrass, or reef rubble"
            ],
            habitat: "Seagrass beds, sandy lagoons, reef flats, and deeper benthic habitats.",
            nativeRange: "Found in marine systems worldwide with strong tropical diversity.",
            rarityScore: 53,
            rarityReason: "Many sea cucumbers remain common locally, but targeted harvest has depleted important populations in some regions."
        },
        premiumDetails: {
            behaviorTraits: [
                "Processes sediment and detritus while feeding along the bottom",
                "Recycles organic material into more available nutrient forms",
                "Uses body-wall defenses and sometimes toxin release when attacked"
            ],
            whyInteresting: [
                "Sea cucumbers are underappreciated but important cleaners of the seafloor processing layer.",
                "They show how low-profile animals can still perform major system work."
            ],
            respectfulSpotting: [
                "Do not pick up or squeeze sea cucumbers on reef walks or dives.",
                "Move carefully over shallow flats where they may blend into sediment."
            ],
            lookalikes: ["Sea slug", "Soft coral fragments", "Dark seaweed clumps on sand"]
        }
    }),
    createSpeciesEntry({
        slug: "lionfish",
        name: "Lionfish",
        analysis: {
            summary: "Lionfish are venomous reef predators with ornate fins, patient hovering behavior, and major ecological impact where introduced beyond their native range.",
            scientificName: "Pterois volitans",
            category: "Marine fish",
            identification: [
                "Bold red, brown, and white striping across body and fins",
                "Long separated venomous fin spines and fanlike pectoral fins",
                "Hovering stalking posture near reef structure"
            ],
            habitat: "Coral reefs, rocky bottoms, mangroves, and artificial structures in warm marine water.",
            nativeRange: "Indo-Pacific, with invasive populations across the western Atlantic and Caribbean.",
            rarityScore: 34,
            rarityReason: "Lionfish are common in suitable habitat and can become overly abundant where native predators and controls are weak."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses fin displays to corner small reef prey",
                "Hunts at dusk and night but also hovers openly by day",
                "Expands quickly in non-native systems with little predation pressure"
            ],
            whyInteresting: [
                "Lionfish are important examples of how elegant predators can still become destructive invaders.",
                "Their hunting style is easy to observe compared with many reef fish."
            ],
            respectfulSpotting: [
                "Keep hands clear of spines and never attempt casual handling.",
                "Learn local guidance because management differs between native and invasive regions."
            ],
            lookalikes: ["Scorpionfish", "Juvenile turkeyfish", "Decorative aquarium releases in shallow areas"]
        }
    }),
    createSpeciesEntry({
        slug: "bluefin-tuna",
        name: "Bluefin Tuna",
        analysis: {
            summary: "Bluefin tuna are powerful oceanic fish built for sustained fast swimming, heat retention, and long-range movement through productive pelagic systems.",
            scientificName: "Thunnus thynnus",
            category: "Marine fish",
            identification: [
                "Large muscular torpedo-shaped body with metallic blue back",
                "Stiff crescent tail and narrow finlets behind dorsal and anal fins",
                "Fast schooling movement in open water rather than reef association"
            ],
            habitat: "Open ocean, productive fronts, offshore feeding grounds, and seasonal spawning areas.",
            nativeRange: "Atlantic Ocean and connected seas for Atlantic bluefin populations.",
            rarityScore: 73,
            rarityReason: "Bluefin remain highly valued and vulnerable because large-bodied migratory fish recover slowly under intense harvest pressure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Cruises long distances between feeding and spawning zones",
                "Maintains body temperature above ambient water better than many fish",
                "Targets schooling prey with speed and coordinated movement"
            ],
            whyInteresting: [
                "Bluefin tuna make pelagic endurance and thermal performance visible in one body plan.",
                "They are central examples of why migratory fish need broad-scale management."
            ],
            respectfulSpotting: [
                "Observe from licensed pelagic tours or research platforms rather than causing repeated chase behavior.",
                "Support traceable sustainable fisheries information where bluefin are discussed."
            ],
            lookalikes: ["Mackerel tuna", "Yellowfin tuna", "Large sharks from surface fin views"]
        }
    }),
    createSpeciesEntry({
        slug: "white-rhinoceros",
        name: "White Rhinoceros",
        analysis: {
            summary: "White rhinoceroses are massive square-lipped grazers built for bulk feeding, territorial presence, and short explosive charges across open African grassland systems.",
            scientificName: "Ceratotherium simum",
            category: "Mammal",
            identification: [
                "Huge barrel-bodied grazer with broad square mouth held close to the ground",
                "Two horns on the snout with the front horn usually longer",
                "Large shoulder hump and heavy head carried low while feeding"
            ],
            habitat: "Open grassland, savannah, floodplain, and lightly wooded grazing country with access to water and wallows.",
            nativeRange: "Southern Africa with managed and fragmented populations in parts of eastern Africa.",
            rarityScore: 78,
            rarityReason: "White rhinoceroses survive best in protected landscapes, but poaching and fragmentation still keep long-term security under pressure."
        },
        premiumDetails: {
            behaviorTraits: [
                "Grazes for long stretches with the head low and lips sweeping short grass",
                "Uses wallows, scent marks, and spatial routines to manage social pressure",
                "Can shift from calm feeding to very fast short-distance aggression when threatened"
            ],
            whyInteresting: [
                "White rhinoceroses are excellent megaherbivore comparison animals because they turn bulk, horn placement, and grazing design into one clear body plan.",
                "They make elephant versus rhino comparisons much more useful than generic 'big animal' content."
            ],
            respectfulSpotting: [
                "Stay in vehicles or with licensed guides in rhino country and never pressure an animal to move off a preferred path.",
                "Give extra space around calves, wallows, and water access points."
            ],
            lookalikes: ["Black rhinoceros", "Mud-covered hippopotamus at distance", "Cape buffalo from poor angles"]
        },
        relatedSpecies: ["elephant", "lion", "giraffe"],
        searchIntents: [
            "white rhinoceros facts",
            "rhino identification",
            "white rhinoceros habitat",
            "rhino behavior",
            "rhino vs elephant"
        ]
    }),
    createSpeciesEntry({
        slug: "boxer-crab",
        name: "Boxer Crab",
        analysis: {
            summary: "Boxer crabs are small reef crabs famous for carrying tiny sea anemones in their claws, turning borrowed stinging partners into defensive and feeding tools.",
            scientificName: "Lybia tessellata",
            category: "Marine invertebrate",
            identification: [
                "Small pale crab with patterned shell and relatively delicate walking legs",
                "Carries a tiny sea anemone in each claw like living pom-poms",
                "Often moves in a raised defensive stance when disturbed"
            ],
            habitat: "Shallow coral reef, reef rubble, and sheltered Indo-Pacific marine substrate.",
            nativeRange: "Indo-Pacific reef systems.",
            rarityScore: 64,
            rarityReason: "Boxer crabs are small and easy to miss, and healthy reef habitat is patchy and under pressure in many regions."
        },
        premiumDetails: {
            behaviorTraits: [
                "Uses anemones for protection and to help secure tiny food particles",
                "Moves carefully through reef crevices rather than relying on raw shell bulk",
                "Can divide and maintain anemone partners over time"
            ],
            whyInteresting: [
                "Boxer crabs are one of the clearest examples of an animal outsourcing part of its defense system to another species.",
                "They turn a tiny reef crustacean into a vivid lesson in symbiosis and tool-like behavior."
            ],
            respectfulSpotting: [
                "Look slowly through reef rubble or aquarium reef structures rather than touching or lifting the animal repeatedly.",
                "Never separate a boxer crab from its anemones for a photo."
            ],
            lookalikes: ["Tiny porcelain crab", "Decorator crab juvenile", "Small reef crab without anemones in poor light"]
        },
        relatedSpecies: ["crab", "mantis-shrimp", "octopus"],
        searchIntents: [
            "boxer crab facts",
            "boxer crab identification",
            "pom pom crab habitat",
            "boxer crab symbiosis",
            "boxer crab behavior"
        ]
    }),
    createSpeciesEntry({
        slug: "gorilla",
        name: "Gorilla",
        analysis: {
            summary: "Gorillas are the largest living primates, built around immense upper-body strength, social family groups, and forest-based foraging rather than predatory violence.",
            scientificName: "Gorilla spp.",
            category: "Mammal",
            identification: [
                "Massive barrel chest, long muscular arms, and broad dark face",
                "Knuckle-walking posture with heavy shoulders and relatively short legs",
                "Adult males often show a silver saddle across the back"
            ],
            habitat: "Tropical lowland forest, montane forest, swamp forest, and dense equatorial woodland.",
            nativeRange: "Central equatorial Africa in fragmented western and eastern populations.",
            rarityScore: 86,
            rarityReason: "Gorillas are vulnerable because they rely on intact forest blocks and remain under pressure from habitat loss, disease, and hunting."
        },
        premiumDetails: {
            behaviorTraits: [
                "Lives in family groups anchored by adult leadership and social stability",
                "Feeds mainly on vegetation, shoots, fruit, and other forest foods rather than hunting large prey",
                "Uses display, posture, and warning behavior to avoid unnecessary direct conflict"
            ],
            whyInteresting: [
                "Gorillas are useful comparison animals because they combine enormous strength with a life strategy that is not built around active predation.",
                "They also make primate intelligence and social calm visible at a very large body scale."
            ],
            respectfulSpotting: [
                "Follow strict distance and illness-control rules in gorilla trekking zones.",
                "Never block travel paths or crowd a silverback during feeding or social display."
            ],
            lookalikes: ["Large chimpanzee at distance", "Orangutan in captive comparison only", "Dark boulder or stump in dense shade"]
        },
        relatedSpecies: ["orangutan", "elephant", "tiger"],
        searchIntents: [
            "gorilla facts",
            "gorilla identification",
            "gorilla habitat",
            "gorilla behavior",
            "gorilla strength"
        ]
    })
);

const speciesData: SpeciesEntry[] = [
    ...baseSpeciesData,
    ...expandedSpeciesData,
    ...additionalSpeciesEntriesInput.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputTwo.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputThree.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputFour.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputFive.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputSix.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputSeven.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputEight.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputNine.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputTen.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputEleven.map(createSpeciesEntry),
    ...additionalSpeciesEntriesInputTwelve.map(createSpeciesEntry)
];

export const speciesEntries: SpeciesEntry[] = [...assertUniqueSpeciesSlugs(speciesData)]
    .sort((a, b) => a.name.localeCompare(b.name));

export function getSpeciesBySlug(slug: string) {
    return speciesEntries.find((entry) => entry.slug === slug);
}

export function getSpeciesDirectoryPage({
    page = 1,
    query = "",
    letter = "all",
    pageSize = SPECIES_DIRECTORY_PAGE_SIZE
}: {
    page?: number;
    query?: string;
    letter?: SpeciesDirectoryLetter;
    pageSize?: number;
}): SpeciesDirectoryPage {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLetter = letter === "all" ? "all" : letter.trim().slice(0, 1).toUpperCase();

    const filtered = speciesEntries.filter((entry) => {
        const matchesLetter = normalizedLetter === "all" || entry.name.toUpperCase().startsWith(normalizedLetter);

        if (!matchesLetter) {
            return false;
        }

        if (!normalizedQuery) {
            return true;
        }

        const haystack = [
            entry.name,
            entry.analysis.scientificName,
            entry.analysis.category,
            entry.analysis.summary
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(normalizedQuery);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;

    return {
        entries: filtered.slice(start, start + pageSize),
        total,
        totalPages,
        currentPage,
        query,
        letter: normalizedLetter
    };
}

export function getRelatedSpecies(slug: string, limit = 3) {
    const current = getSpeciesBySlug(slug);

    if (!current) {
        return [];
    }

    const explicit = current.relatedSpecies
        .map((relatedSlug) => getSpeciesBySlug(relatedSlug))
        .filter((entry): entry is SpeciesEntry => Boolean(entry));

    const backfill = speciesEntries
        .filter((entry) => entry.slug !== slug && !current.relatedSpecies.includes(entry.slug))
        .slice(0, Math.max(0, limit - explicit.length));

    return [...explicit, ...backfill].slice(0, limit);
}

export function rarityLabel(score: number) {
    if (score >= 85) return "Very rare";
    if (score >= 70) return "Rare";
    if (score >= 50) return "Uncommon";
    return "Relatively common";
}
