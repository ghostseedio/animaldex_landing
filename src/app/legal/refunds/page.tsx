import {Metadata} from "next";
import policy from "@/data/refund-policy.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

const description = "Read how refunds and cancellations work for AnimalDex purchases made through Paddle, Apple, and Google Play.";

export const metadata: Metadata = withOgCard({
    title: "AnimalDex Refund Policy",
    description,
    alternates: {
        canonical: "/legal/refunds"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Refund Policy",
        description,
        url: `${getSiteUrl()}/legal/refunds`
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Refund Policy",
        description
    },
    robots: {
        index: true,
        follow: true
    }
}, "AnimalDex Refund Policy", "page", "legal", "refunds");

export default function PublicRefundPolicy() {
    return <LegalPage content={policy} />;
}
