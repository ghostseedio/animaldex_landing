import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("animal-identifier-app");
}

export default async function AnimalIdentifierAppPage() {
    return AnswerPage({slug: "animal-identifier-app"});
}
