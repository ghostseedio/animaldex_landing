import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-identifier-app");
}

export default async function AnimalIdentifierAppPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-identifier-app", cmsSource: searchParams?.cmsSource === "1"});
}
