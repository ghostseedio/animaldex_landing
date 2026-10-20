import {Metadata} from "next";
import terms from "@/data/wildlife-guide-buyer-terms.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

const title = "Wildlife Guide Buyer Terms";
const description = "The terms for buying a virtual Wildlife Guide on AnimalDex: what you get, access straight away, automatic and 7-day refunds, local contacts and wildlife safety.";

export const metadata: Metadata = withOgCard({
    title: `AnimalDex ${title}`,
    description,
    alternates: {
        canonical: "/legal/wildlife-guide-buyer-terms"
    },
    openGraph: {
        type: "website",
        title: `AnimalDex ${title}`,
        description,
        url: `${getSiteUrl()}/legal/wildlife-guide-buyer-terms`
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
}, `AnimalDex ${title}`, "page", "legal", "wildlife-guide-buyer-terms");

export default function WildlifeGuideBuyerTerms() {
    return <LegalPage content={terms} />;
}
