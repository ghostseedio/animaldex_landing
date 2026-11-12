import {Metadata} from "next";
import {languageAlternates} from "@/lib/seo/page-metadata";
import policy from "@/data/privacy-policy.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

export const metadata: Metadata = withOgCard({
    title: "AnimalDex Privacy Policy",
    description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion.",
    alternates: {
        canonical: "/legal/privacy",
        // Written in English only: en and x-default (SEO lane S3).
        languages: languageAlternates("/legal/privacy", {englishOnly: true})
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Privacy Policy",
        description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion.",
        url: `${getSiteUrl()}/legal/privacy`
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Privacy Policy",
        description: "Read how AnimalDex handles account data, animal captures, location data, purchases, community features, moderation, and account deletion."
    },
    robots: {
        index: true,
        follow: true
    }
}, "AnimalDex Privacy Policy", "page", "legal", "privacy");

export default function PublicPrivacyPolicy() {
    return <LegalPage content={policy} />;
}
