import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-birds");
}

export default async function IdentifyBirdsPage() {
    return AnswerPage({slug: "identify-birds"});
}
