import type {DiscoverTimelineItem} from "@/data/discover-timeline";

/**
 * What a shared post (`/p/<post id>`) tells search engines and link previews
 * (owner decision 247, 2026-11-12, S1's D7): the animal, its setting, its date
 * and whether there is a video. Never who shared it (no name, no @handle) and
 * never where (no place): the title, the description, the keywords, the Open
 * Graph and Twitter cards and the structured data are all built from these
 * fields. The page itself, for people who open the link, is unchanged.
 */

export type DiscoverPostSeo = {
    title: string;
    description: string;
    imageSrc: string;
    publishedAt: string;
    keywords: string[];
    video: {url: string; mimeType?: string | null} | null;
};

function dateLabel(iso: string): string | null {
    const time = Date.parse(iso);
    if (!Number.isFinite(time) || time <= 0) return null;
    return new Intl.DateTimeFormat("en-US", {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"}).format(new Date(time));
}

function setting(context: string | null | undefined): {title: string | null; text: string} {
    const value = context?.trim().toLowerCase();
    if (value === "wild") return {title: "in the wild", text: "in the wild"};
    if (value === "zoo") return {title: "at the zoo", text: "at the zoo"};
    if (value === "domestic" || value === "farm") return {title: "(domestic)", text: "in a domestic setting"};
    return {title: null, text: "on AnimalDex"};
}

function withDate(title: string, date: string | null): string {
    return date ? `${title}, ${date}` : title;
}

export function discoverPostSeoFields(item: DiscoverTimelineItem): DiscoverPostSeo {
    const date = dateLabel(item.date);
    const on = date ? ` on ${date}` : "";
    if (item.kind === "capture") {
        const animal = item.animalName?.trim() || "Animal";
        const place = setting(item.contextLabel);
        const scientific = item.scientificName?.trim();
        const media = item.hasVideoMedia ? " Watch the short video capture." : "";
        return {
            title: withDate(place.title ? `${animal} ${place.title}` : `${animal} · AnimalDex capture`, date),
            description: `${animal}${scientific ? ` (${scientific})` : ""} ${place.text}, captured and shared on AnimalDex${on}.${media}`,
            imageSrc: item.imageSrc,
            publishedAt: item.date,
            keywords: [
                animal,
                scientific ?? null,
                item.contextLabel ? `${animal} ${item.contextLabel.toLowerCase()}` : null,
                item.contextLabel?.toLowerCase() === "wild" ? `${animal} in the wild` : null,
                item.hasVideoMedia ? `${animal} video` : null,
                "AnimalDex",
                "animal identification"
            ].filter((value): value is string => Boolean(value)),
            video: item.mediaAssets.find((asset) => asset.kind === "video" || asset.kind === "loop") ?? null
        };
    }
    if (item.kind === "alignment") {
        const animal = item.rewardedAnimalName?.trim() || "an animal";
        return {
            title: withDate(`Daily alignment with ${animal}`, date),
            description: `A Daily Alignment with ${animal} on AnimalDex${on}.`,
            imageSrc: item.imageSrc,
            publishedAt: item.date,
            keywords: [animal, "AnimalDex", "daily alignment"],
            video: null
        };
    }
    if (item.kind === "fusion") {
        return {
            title: withDate("Principle fusion on AnimalDex", date),
            description: `A behavior principle fusion with ${item.receiverAnimalName || "an animal"} on AnimalDex${on}.`,
            imageSrc: item.receiverImageSrc,
            publishedAt: item.date,
            keywords: [item.receiverAnimalName, item.donorAnimalName, "AnimalDex", "principle fusion"].filter(Boolean),
            video: null
        };
    }
    if (item.kind === "animal-trial") {
        const animal = item.speciesName?.trim() || "Animal";
        return {
            title: withDate(`${animal} Trial on AnimalDex`, date),
            description: `The ${animal} Animal Trial, taken on AnimalDex${on}.`,
            imageSrc: item.evidenceSrc ?? "/images/placeholders/species-no-image.svg",
            publishedAt: item.date,
            keywords: [animal, item.principleName, "AnimalDex", "animal trial"].filter(Boolean),
            video: null
        };
    }
    if (item.kind === "challenge") {
        const animal = item.attacker.animalName?.trim() || "Animal";
        return {
            title: withDate(`${animal} on AnimalDex`, date),
            description: `${animal} and ${item.defender.animalName || "another animal"} on AnimalDex${on}.`,
            imageSrc: item.attacker.imageSrc,
            publishedAt: item.date,
            keywords: [item.attacker.animalName, item.defender.animalName, "AnimalDex"].filter(Boolean),
            video: null
        };
    }
    return {
        title: withDate("AnimalDex trade", date),
        description: `A trade of ${item.offerer.animalName || "an animal"} for ${item.receiver.animalName || "an animal"} on AnimalDex${on}.`,
        imageSrc: item.offerer.imageSrc,
        publishedAt: item.date,
        keywords: [item.offerer.animalName, item.receiver.animalName, "AnimalDex", "trade"].filter(Boolean),
        video: null
    };
}

/** The post's structured data: the post and its video, published by AnimalDex, with no person named. */
export function discoverPostJsonLd(seo: DiscoverPostSeo, input: {pageUrl: string; imageUrl: string; videoUrl: string | null; siteUrl: string}) {
    const publisher = {"@type": "Organization", name: "AnimalDex", url: input.siteUrl};
    return [
        {
            "@context": "https://schema.org",
            "@type": "SocialMediaPosting",
            "@id": input.pageUrl,
            url: input.pageUrl,
            headline: seo.title,
            datePublished: seo.publishedAt,
            description: seo.description,
            image: input.imageUrl,
            publisher,
            isPartOf: {"@type": "WebSite", name: "AnimalDex", url: input.siteUrl}
        },
        ...(input.videoUrl
            ? [{
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: seo.title,
                description: seo.description,
                thumbnailUrl: [input.imageUrl],
                contentUrl: input.videoUrl,
                uploadDate: seo.publishedAt,
                publisher
            }]
            : [])
    ];
}
