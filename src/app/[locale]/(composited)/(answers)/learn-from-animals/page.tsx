import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("learn-from-animals", params.locale);
}

export default async function LearnFromAnimalsPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "learn-from-animals", locale: params.locale});
}
