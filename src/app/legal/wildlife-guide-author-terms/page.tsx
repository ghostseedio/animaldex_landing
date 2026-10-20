import {Metadata} from "next";
import terms from "@/data/wildlife-guide-author-terms.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

const title = "Wildlife Guide Author Terms";
const description = "The terms for selling a virtual Wildlife Guide on AnimalDex: who can sell, answering buyers within 48 hours, wildlife safety, refunds and payment.";

export const metadata: Metadata = withOgCard({
    title: `AnimalDex ${title}`,
    description,
    alternates: {
        canonical: "/legal/wildlife-guide-author-terms"
    },
    openGraph: {
        type: "website",
        title: `AnimalDex ${title}`,
        description,
        url: `${getSiteUrl()}/legal/wildlife-guide-author-terms`
    },
    twitter: {
        card: "summary_large_image",
        title: `AnimalDex ${title}`,
        description
    },
    robots: {
        index: true,
        follow: true
    }
}, `AnimalDex ${title}`, "page", "legal", "wildlife-guide-author-terms");

export default function WildlifeGuideAuthorTerms() {
    return <LegalPage content={terms} />;
}
