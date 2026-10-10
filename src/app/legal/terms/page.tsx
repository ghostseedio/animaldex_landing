import {Metadata} from "next";
import terms from "@/data/terms-of-service.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

export const metadata: Metadata = withOgCard({
    title: "AnimalDex Terms of Use",
    description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion.",
    alternates: {
        canonical: "/legal/terms"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Terms of Use",
        description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion.",
        url: `${getSiteUrl()}/legal/terms`
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Terms of Use",
        description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion."
    },
    robots: {
        index: true,
        follow: true
    }
}, "AnimalDex Terms of Service", "page", "legal", "terms");

export default function PublicTermsOfUse() {
    return <LegalPage content={terms} />;
}
