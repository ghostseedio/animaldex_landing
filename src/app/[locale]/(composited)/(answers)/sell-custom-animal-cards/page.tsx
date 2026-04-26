import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("sell-custom-animal-cards");
}

export default async function SellCustomAnimalCardsPage() {
    return AnswerPage({slug: "sell-custom-animal-cards"});
}
