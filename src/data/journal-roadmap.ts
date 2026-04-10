export type JournalRoadmapStatus = "research" | "drafting" | "planned";

export type JournalRoadmapItem = {
    slug: string;
    title: string;
    description: string;
    targetMonth: string;
    status: JournalRoadmapStatus;
    audiences: string[];
    searchIntents: string[];
};

const journalRoadmapData: JournalRoadmapItem[] = [
    {
        slug: "animal-breed-identifier-guide-for-pets-and-lookalikes",
        title: "Animal breed identifier guide for pets and close lookalikes",
        description: "How to use visual clues to narrow down dog, cat, and common pet breed lookalikes without overconfidence.",
        targetMonth: "2026-05",
        status: "drafting",
        audiences: ["Animal lovers", "Families", "Curious explorers"],
        searchIntents: ["animal breed identifier", "animal breed detector", "identify pet breeds"]
    },
    {
        slug: "best-zoo-animals-to-spot-with-kids",
        title: "Best zoo animals to spot with kids and what to notice",
        description: "A practical family route for spotting, comparing, and remembering animals at the zoo.",
        targetMonth: "2026-05",
        status: "planned",
        audiences: ["Families", "Animal lovers", "Wildlife learners"],
        searchIntents: ["zoo animal app", "family-friendly animal learning app", "animals to see at the zoo"]
    },
    {
        slug: "safari-animal-checklist-by-habitat",
        title: "Safari animal checklist by habitat for first-time travelers",
        description: "What to look for in savannah, wetland, and woodland contexts to make safari spotting more successful.",
        targetMonth: "2026-05",
        status: "planned",
        audiences: ["Travelers", "Photographers", "Wildlife learners"],
        searchIntents: ["safari animal app", "wildlife spotting app", "safari animal checklist"]
    },
    {
        slug: "animal-field-guide-basics-for-beginners",
        title: "Animal field guide basics for beginners",
        description: "How to read habitat, behaviour, and lookalike clues like a field guide user instead of relying on one label.",
        targetMonth: "2026-06",
        status: "research",
        audiences: ["Wildlife learners", "Animal lovers", "Families"],
        searchIntents: ["animal field guide app", "wild animal learning app", "animal discovery app"]
    },
    {
        slug: "pokemon-like-animal-app-vs-real-animal-collecting",
        title: "Pokemon-like creature collecting vs collecting real animals",
        description: "What collectors gain when game loops meet real sightings, real habitats, and real species diversity.",
        targetMonth: "2026-06",
        status: "research",
        audiences: ["Collectors", "Competitive players", "Curious explorers"],
        searchIntents: ["Pokemon-like animal app", "species collecting game", "animal collection app"]
    },
    {
        slug: "top-trumps-style-animal-card-strategy-guide",
        title: "Top Trumps style animal card strategy for sets and battles",
        description: "How to think about rarity, set completion, and battle utility without losing the learning side.",
        targetMonth: "2026-06",
        status: "planned",
        audiences: ["Collectors", "Competitive players"],
        searchIntents: ["Top Trumps-like animal app", "animal card collecting app", "animal battle app"]
    },
    {
        slug: "wildlife-photography-settings-for-beginners",
        title: "Wildlife photography settings beginners can actually use",
        description: "Simple field-ready camera and phone setup guidance for better animal identification and cleaner sightings.",
        targetMonth: "2026-07",
        status: "planned",
        audiences: ["Photographers", "Travelers", "Wildlife learners"],
        searchIntents: ["wildlife photography app", "wildlife photography tips", "animal scanner app for photos"]
    },
    {
        slug: "animal-grading-and-rarity-in-collectible-apps",
        title: "Animal grading and rarity systems explained for collectors",
        description: "How grading, rarity, and progression can stay fair and useful in species collecting games.",
        targetMonth: "2026-07",
        status: "research",
        audiences: ["Collectors", "Competitive players"],
        searchIntents: ["animal grading app", "animal set collection game", "species collecting game"]
    },
    {
        slug: "respectful-wildlife-observation-rules-for-families",
        title: "Respectful wildlife observation rules families can actually follow",
        description: "Simple habits for curious observation that protect animal comfort while making spotting better.",
        targetMonth: "2026-07",
        status: "drafting",
        audiences: ["Families", "Animal lovers", "Wildlife learners"],
        searchIntents: ["respectful wildlife observation", "family wildlife tips", "educational animal app"]
    },
    {
        slug: "travel-animal-journal-ideas-for-vacations",
        title: "Travel animal journal ideas for vacations and road trips",
        description: "How to turn travel sightings into albums, stories, and repeatable set goals across destinations.",
        targetMonth: "2026-08",
        status: "planned",
        audiences: ["Travelers", "Families", "Collectors"],
        searchIntents: ["animal journal app", "wildlife collection app", "travel animal app"]
    }
];

export const journalRoadmap: JournalRoadmapItem[] = [...journalRoadmapData]
    .sort((a, b) => a.targetMonth.localeCompare(b.targetMonth) || a.title.localeCompare(b.title));
