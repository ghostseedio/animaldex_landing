import type {VideoSourceType} from "@/lib/content-video/plan";

// Page-family labels and paths, safe for client components (no data imports).

export const SOURCE_LABELS: Record<VideoSourceType, string> = {
    blog: "Blog post",
    comparison: "Comparison battle",
    hybrid: "Hybrid reveal",
    fusion: "Fusion reveal",
    ranking: "Ranking countdown",
    location: "Location guide",
    lesson: "Animal lesson",
    guess: "Guess the animal",
    scan: "Scan reveal (our footage)",
    you_vs: "You vs the animal",
    would_you_rather: "Would you rather",
    pokemon: "Real-life Pokémon",
    ark: "Ark clip (recorded scene)"
};

export function sourcePath(type: VideoSourceType, slug: string) {
    switch (type) {
        case "blog": return `/blog/${slug}`;
        case "comparison": return `/comparisons/${slug}`;
        case "hybrid":
        case "fusion": return `/animal-hybrids/${slug}`;
        case "ranking": return `/tier-list/${slug}`;
        case "location": return `/locations/${slug}`;
        // A birth-month carousel is twelve animals put together, not one page: it links to the lessons hub.
        case "lesson": return slug.startsWith("birth-month-") ? "/animal-powers" : `/animal-powers/${slug}`;
        case "guess":
        case "scan":
        case "you_vs": return `/animals/${slug}`;
        case "would_you_rather": return `/comparisons/${slug}`;
        case "pokemon": return `/pokemon-animals/${slug}`;
        // An Ark clip is filmed in the shared Ark: its page is the Ark itself.
        case "ark": return "/ark";
    }
}
