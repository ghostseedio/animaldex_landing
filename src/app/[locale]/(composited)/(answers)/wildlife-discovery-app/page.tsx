import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("wildlife-discovery-app");
}

export default async function WildlifeDiscoveryAppPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "wildlife-discovery-app", cmsSource: searchParams?.cmsSource === "1"});
}
