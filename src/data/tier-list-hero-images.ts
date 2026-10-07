import type {ContentImage} from "@/data/content-schema";

/**
 * Local hero images for tier lists whose AnimalDex CDN image is missing or
 * would repeat another list's card. Freely licensed Wikimedia Commons photos,
 * fetched with scripts/fetch-blog-images.mjs into
 * public/images/blog/tier-list-<ranking-slug>/hero.webp. The same image is the
 * hub card thumbnail and the og:image.
 */
const TIER_LIST_HERO_IMAGES: Record<string, Omit<ContentImage, "src">> = {
    "biggest-animals": {
        alt: "A blue whale surfacing in the Arctic sea, its tall blow rising above its long back",
        width: 1400,
        height: 788,
        caption: "Photo: AWeith, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "largest-introduced-and-invasive-animals": {
        alt: "A feral dromedary camel standing in dry scrubland",
        width: 1400,
        height: 1049,
        caption: "Photo: Caroline Jones, CC0, via Wikimedia Commons."
    },
    "most-invasive-species": {
        alt: "A red lionfish facing the camera with its venomous fin spines fanned out in open blue water",
        width: 1400,
        height: 1014,
        caption: "Photo: Jens Petersen (Edit by Olegiwit), CC BY 2.5, via Wikimedia Commons."
    },
    "animals-with-highest-mating-drive": {
        alt: "A group of bonobos lying together in a close embrace on the grass",
        width: 1400,
        height: 834,
        caption: "Photo: LaggedOnUser, CC BY-SA 2.0, via Wikimedia Commons."
    },
    "most-reviled-animals": {
        alt: "A spotted hyena standing in green grass in Tarangire National Park, Tanzania",
        width: 1400,
        height: 933,
        caption: "Photo: Diego Delso, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "rarest-animals": {
        alt: "Close-up of a kakapo, the critically endangered flightless parrot of New Zealand",
        width: 1400,
        height: 933,
        caption: "Photo: Kimberley Collins, CC BY 2.0, via Wikimedia Commons."
    },
    "deadliest-animals-to-humans-in-the-wild": {
        alt: "Close-up of an Anopheles mosquito, the malaria carrier, feeding on human skin",
        width: 1400,
        height: 932,
        caption: "Photo: CDC/ James Gathany, Public domain, via Wikimedia Commons."
    },
    "most-sacred-animals-in-history": {
        alt: "A Hanuman langur mother and baby in a tree in Ranthambore National Park, India",
        width: 1400,
        height: 933,
        caption: "Photo: Giles Laurent, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "most-communicative-animals-in-the-wild": {
        alt: "A humpback whale lifting its tail flukes above the water near the coast",
        width: 1400,
        height: 933,
        caption: "Photo: Gregory \"Slobirdr\" Smith, CC BY-SA 2.0, via Wikimedia Commons."
    },
    "most-patient-animals": {
        alt: "An American crocodile lying motionless at the waterline of the Tárcoles River, Costa Rica",
        width: 1400,
        height: 933,
        caption: "Photo: Bernard Gagnon, CC0, via Wikimedia Commons."
    },
    "most-loyal-animals": {
        alt: "A pair of waved albatrosses touching bills in their courtship display",
        width: 1400,
        height: 934,
        caption: "Photo: Barfbagger at English Wikipedia, CC BY-SA 3.0, via Wikimedia Commons."
    },
    "bravest-animals": {
        alt: "A honey badger trotting across dry sandy ground",
        width: 1400,
        height: 992,
        caption: "Photo: Gerhard mauracher, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "most-curious-animals": {
        alt: "A common raven standing on the ground in Yosemite National Park",
        width: 1400,
        height: 990,
        caption: "Photo: Diliff, CC BY-SA 3.0, via Wikimedia Commons."
    },
    "most-gentle-animals": {
        alt: "Florida manatees drifting through sunlit water",
        width: 1024,
        height: 686,
        caption: "Photo: U.S. Fish and Wildlife Service Headquarters, Public domain, via Wikimedia Commons."
    },
    "most-protective-animals": {
        alt: "An African elephant mother walking with her small calf at her side in Sabi Sand, South Africa",
        width: 1400,
        height: 1050,
        caption: "Photo: Cosal, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "animals-that-work-together": {
        alt: "Three meerkats standing upright together on lookout",
        width: 1400,
        height: 933,
        caption: "Photo: Charles J. Sharp, CC BY-SA 3.0, via Wikimedia Commons."
    },
    "most-disciplined-animals": {
        alt: "Honey bee workers crowded on a honeycomb",
        width: 1400,
        height: 933,
        caption: "Photo: Alabama Extension, CC0, via Wikimedia Commons."
    },
    "calmest-animals": {
        alt: "A brown-throated three-toed sloth hanging calmly among the branches",
        width: 1400,
        height: 933,
        caption: "Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
    },
    "most-resourceful-animals": {
        alt: "A New Caledonian crow perched on a branch in Sarraméa, New Caledonia",
        width: 1400,
        height: 1050,
        caption: "Photo: benkeen, CC0, via Wikimedia Commons."
    }
};

export function tierListHeroImage(rankingSlug: string): ContentImage {
    const image = TIER_LIST_HERO_IMAGES[rankingSlug];
    if (!image) {
        throw new Error(`No local tier-list hero image for "${rankingSlug}"`);
    }
    return {src: `/images/blog/tier-list-${rankingSlug}/hero.webp`, ...image};
}
