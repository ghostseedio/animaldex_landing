import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("learn-from-animals");
}

export default async function LearnFromAnimalsPage() {
    return AnswerPage({slug: "learn-from-animals"});
}
