import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("wildlife-discovery-app");
}

export default async function WildlifeDiscoveryAppPage() {
    return AnswerPage({slug: "wildlife-discovery-app"});
}
