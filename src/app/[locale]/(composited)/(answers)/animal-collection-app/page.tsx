import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-collection-app");
}

export default async function AnimalCollectionAppPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-collection-app", cmsSource: searchParams?.cmsSource === "1"});
}
