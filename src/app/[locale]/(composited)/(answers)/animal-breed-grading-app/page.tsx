import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-breed-grading-app");
}

export default async function AnimalBreedGradingAppPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-breed-grading-app", cmsSource: searchParams?.cmsSource === "1"});
}
