import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("identify-birds", params.locale);
}

export default async function IdentifyBirdsPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "identify-birds", locale: params.locale});
}
