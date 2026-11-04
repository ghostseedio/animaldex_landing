import {Metadata} from "next";
import policy from "@/data/ai-and-safety.md";
import LegalPage from "@/app/legal/legal-page";
import {getSiteUrl} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

const description = "The animals on AnimalDex are AI. How conversations work, what happens to what you write, how we handle a crisis, and teen mode.";

export const metadata: Metadata = withOgCard({
    title: "AnimalDex AI and Safety",
    description,
    alternates: {
        canonical: "/legal/ai-and-safety"
    },
    openGraph: {
        type: "website",
        title: "AnimalDex AI and Safety",
        description,
        url: `${getSiteUrl()}/legal/ai-and-safety`
    },
    twitter: {
        card: "summary_large_image",
        title: "AnimalDex AI and Safety",
        description
    },
    robots: {
        index: true,
        follow: true
    }
}, "AnimalDex AI and Safety", "page", "legal", "ai-and-safety");

export default function PublicAiAndSafety() {
    return <LegalPage content={policy} />;
}
