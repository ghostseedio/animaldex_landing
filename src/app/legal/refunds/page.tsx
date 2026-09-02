import {Metadata} from "next";
import policy from "@/data/refund-policy.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";

const description = "Read how refunds and cancellations work for AnimalDex purchases made through Paddle, Apple, and Google Play.";

export const metadata: Metadata = {
    title: "AnimalDex Refund Policy",
    description,
    alternates: {
        canonical: "/legal/refunds"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex Refund Policy",
        description,
        url: `${getSiteUrl()}/legal/refunds`,
        images: [{
            url: "/images/og.png",
            width: 1200,
            height: 630,
            alt: "AnimalDex Refund Policy"
        }]
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex Refund Policy",
        description,
        images: ["/images/og.png"]
    },
    robots: {
        index: true,
        follow: true
    }
};

export default function PublicRefundPolicy() {
    return <LegalPage content={policy} />;
}
