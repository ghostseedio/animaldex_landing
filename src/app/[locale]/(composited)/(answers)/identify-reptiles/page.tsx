import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("identify-reptiles");
}

export default async function IdentifyReptilesPage() {
    return AnswerPage({slug: "identify-reptiles"});
}
