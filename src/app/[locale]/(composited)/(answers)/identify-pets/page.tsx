import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-pets");
}

export default async function IdentifyPetsPage() {
    return AnswerPage({slug: "identify-pets"});
}
