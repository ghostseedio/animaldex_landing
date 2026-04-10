import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata() {
    return generateAnswerPageMetadata("what-is-animal-collecting");
}

export default async function WhatIsAnimalCollectingPage() {
    return AnswerPage({slug: "what-is-animal-collecting"});
}
