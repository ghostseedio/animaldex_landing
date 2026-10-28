import type {SourceType} from "@/lib/content-video/plan";
import type {Experiment, TextFormat} from "@/lib/social-lab/arms";
import type {ShareCopy} from "@/lib/social/share-copy";

// What the official accounts post besides videos (admin_social_content,
// supabase/migrations/20261028120000_social_growth_engine.sql): swipeable image
// carousels rendered from one of our pages, and text posts (hot takes, polls,
// would-you-rathers) for X, Threads, Bluesky and Facebook.

export const CAROUSEL_TEMPLATES = ["countdown", "versus", "facts", "myth_fact", "guess"] as const;
export type CarouselTemplate = (typeof CAROUSEL_TEMPLATES)[number];

/** cover: photo + hook. item: photo/artwork + headline. text: brand background, big words. cta: the closing question. */
export const SLIDE_LAYOUTS = ["cover", "item", "text", "cta"] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export type Slide = {
    layout: SlideLayout;
    /** Small label above the headline: "#3", "MYTH", "CLUE 2", "TIER LIST". */
    kicker: string;
    title: string;
    body: string;
    /** A source photo number, or null. */
    image: number | null;
    stat: {label: string; value: string} | null;
};

export type CarouselSpec = {template: CarouselTemplate; slides: Slide[]};

export type TextSpec = {
    format: TextFormat;
    /** X and Bluesky: up to ~270 characters. */
    text: string;
    /** Threads and Facebook: up to ~480 characters, a little more context. */
    long: string;
    /** X poll options (2–4, ≤ 25 characters each); null for other formats. */
    poll: string[] | null;
};

/** Rendered slide paths in the public content-videos bucket. */
export type CarouselImages = {
    /** 1080×1350 (4:5): Instagram, Facebook, Threads, X, Bluesky. */
    feed?: string[];
    /** 1080×1920 (9:16): TikTok photo mode. */
    tall?: string[];
    /** 1000×1500 (2:3) cover: Pinterest. */
    pin?: string;
};

export type SocialContentKind = "carousel" | "text";

export type SocialContentRow = {
    id: string;
    kind: SocialContentKind;
    source_type: SourceType;
    source_slug: string;
    source_title: string;
    status: "ready" | "failed";
    spec: CarouselSpec | TextSpec;
    images: CarouselImages;
    share: ShareCopy | Record<string, never>;
    experiment: Experiment | null;
    estimated_usd: number;
    error: string | null;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
};

/** The share-log media_path of a carousel or text post. */
export function contentMediaPath(id: string) {
    return `social/${id}`;
}

export function contentIdFromMediaPath(mediaPath: string) {
    const match = /^social\/([0-9a-f-]{36})$/.exec(mediaPath);
    return match ? match[1] : null;
}

/** Which carousel shapes fit each page family (the writer picks one). Hybrids and fusions have no real photos. */
export const TEMPLATES_FOR_SOURCE: Partial<Record<SourceType, CarouselTemplate[]>> = {
    ranking: ["countdown"],
    comparison: ["versus"],
    location: ["countdown", "guess", "facts"],
    blog: ["facts", "myth_fact", "countdown", "guess"]
};
