import {Metadata} from "next";
import policy from "@/data/privacy-policy.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";

export const metadata: Metadata = {
    title: "AnimalDex Privacy Policy",
    description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion.",
    alternates: {
        canonical: "/legal/privacy"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Privacy Policy",
        description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion.",
        url: `${getSiteUrl()}/legal/privacy`,
        images: [
            {
                url: "/images/og.png",
                width: 1200,
                height: 630,
                alt: "AnimalDex Privacy Policy"
            }
        ]
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Privacy Policy",
        description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion.",
        images: ["/images/og.png"]
    },
    robots: {
        index: true,
        follow: true
    }
};

export default function PublicPrivacyPolicy() {
    return <LegalPage content={policy} />;
}
