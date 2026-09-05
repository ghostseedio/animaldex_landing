import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("learn-from-animals", params.locale);
}

export default async function LearnFromAnimalsPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "learn-from-animals", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
