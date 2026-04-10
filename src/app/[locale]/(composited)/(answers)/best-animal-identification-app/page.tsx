import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("best-animal-identification-app");
}

export default async function BestAnimalIdentificationAppPage() {
    return AnswerPage({slug: "best-animal-identification-app"});
}
