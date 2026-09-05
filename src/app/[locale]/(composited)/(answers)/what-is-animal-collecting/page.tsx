import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("what-is-animal-collecting", params.locale);
}

export default async function WhatIsAnimalCollectingPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "what-is-animal-collecting", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
