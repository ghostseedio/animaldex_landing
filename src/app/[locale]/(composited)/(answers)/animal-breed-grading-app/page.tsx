import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("animal-breed-grading-app", params.locale);
}

export default async function AnimalBreedGradingAppPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "animal-breed-grading-app", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
