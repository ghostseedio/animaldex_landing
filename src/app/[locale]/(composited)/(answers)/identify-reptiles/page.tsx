import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-reptiles", params.locale);
}

export default async function IdentifyReptilesPage({params, searchParams}: {params: {locale: string}; searchParams?: {cmsSource?: string}}) {
    return AnswerPage({slug: "identify-reptiles", locale: params.locale, cmsSource: searchParams?.cmsSource === "1"});
}
