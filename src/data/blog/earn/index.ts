import {businessEarnBlogPosts} from "@/data/blog/earn/business-cluster";
import {creatorEarnBlogPosts} from "@/data/blog/earn/creator-cluster";
import {experienceDiscoveryBlogPosts} from "@/data/blog/earn/experiences-cluster";
import {guideEarnBlogPosts} from "@/data/blog/earn/guide-cluster";
import type {BlogPost} from "@/data/blog/types";

export const earnEconomyBlogPosts: BlogPost[] = [
    ...creatorEarnBlogPosts,
    ...businessEarnBlogPosts,
    ...guideEarnBlogPosts,
    ...experienceDiscoveryBlogPosts
];

export {experienceDiscoveryBlogPosts};
