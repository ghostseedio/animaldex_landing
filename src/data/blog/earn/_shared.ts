import type {BlogPost} from "@/data/blog/types";
import {earnPaths} from "@/data/earn-economy";

export function earnBlogImage(src: string, alt: string) {
    return {src, alt, width: 1200, height: 630};
}

export function earnBlogPost(
    post: Omit<BlogPost, "author" | "featuredImage"> & {featuredImage: BlogPost["featuredImage"]}
): BlogPost {
    return {
        author: "AnimalDex",
        ...post
    };
}

export const earnRelatedLinks = {
    earn: {text: "Ways to earn on AnimalDex", slug: "earn-on-animaldex", href: earnPaths.earn},
    guide: {text: "Become an AnimalDex Wildlife Guide", slug: "become-a-wildlife-guide", href: earnPaths.becomeGuide},
    creator: {text: "Creator Rewards", slug: "creator-rewards", href: earnPaths.creatorRewards},
    sponsor: {text: "Sponsor a Challenge", slug: "sponsor-a-challenge", href: earnPaths.sponsor},
    marketplace: {text: "Wildlife Guides marketplace", slug: "wildlife-guides", href: earnPaths.wildlifeGuidesMarketplace},
    experiences: {text: "Wildlife experiences on AnimalDex", slug: "wildlife-experiences", href: earnPaths.wildlifeExperiences}
};
