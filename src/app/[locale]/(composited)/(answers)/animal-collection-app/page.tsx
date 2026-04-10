import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-collection-app");
}

export default async function AnimalCollectionAppPage() {
    return AnswerPage({slug: "animal-collection-app"});
}
