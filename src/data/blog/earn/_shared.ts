import type {BlogPost} from "@/data/blog/types";
import {earnPaths, supportArticleHrefs} from "@/data/earn-economy";

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
    guide: {text: "How virtual Wildlife Guides work", slug: "how-do-i-become-a-wildlife-guide", href: supportArticleHrefs.becomeGuide},
    creator: {text: "Creator Rewards", slug: "creator-rewards", href: earnPaths.creatorRewards},
    sponsor: {text: "Sponsor a Challenge", slug: "sponsor-a-challenge", href: earnPaths.sponsor},
    marketplace: {text: "Virtual Wildlife Guides on AnimalDex", slug: "wildlife-guides", href: earnPaths.wildlifeGuidesMarketplace}
};
