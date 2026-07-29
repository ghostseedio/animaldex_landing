import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("sell-custom-animal-cards");
}

export default async function SellCustomAnimalCardsPage({searchParams}: {searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "sell-custom-animal-cards", cmsSource: searchParams?.cmsSource === "1"});
}
