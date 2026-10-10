import type {SourceType} from "@/lib/content-video/plan";

// Page-family labels and paths, safe for client components (no data imports).

export const SOURCE_LABELS: Record<SourceType, string> = {
    blog: "Blog post",
    comparison: "Comparison battle",
    hybrid: "Hybrid reveal",
    fusion: "Fusion reveal",
    ranking: "Ranking countdown",
    location: "Location guide"
};

export function sourcePath(type: SourceType, slug: string) {
    switch (type) {
        case "blog": return `/blog/${slug}`;
        case "comparison": return `/comparisons/${slug}`;
        case "hybrid":
        case "fusion": return `/animal-hybrids/${slug}`;
        case "ranking": return `/tier-list/${slug}`;
        case "location": return `/locations/${slug}`;
    }
}
