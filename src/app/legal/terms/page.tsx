import {Metadata} from "next";
import terms from "@/data/terms-of-service.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";

export const metadata: Metadata = {
    title: "AnimalDex Terms of Use",
    description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion.",
    alternates: {
        canonical: "/legal/terms"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Terms of Use",
        description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion.",
        url: `${getSiteUrl()}/legal/terms`,
        images: [
            {
                url: "/images/og.png",
                width: 1200,
                height: 630,
                alt: "AnimalDex Terms of Use"
            }
        ]
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Terms of Use",
        description: "Read the terms for AnimalDex accounts, subscriptions, purchases, user content, moderation, AI results, and account deletion.",
        images: ["/images/og.png"]
    },
    robots: {
        index: true,
        follow: true
    }
};

export default function PublicTermsOfUse() {
    return <LegalPage content={terms} />;
}
