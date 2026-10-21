import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("talk-to-animals", params.locale);
}

export default async function TalkToAnimalsPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "talk-to-animals", locale: params.locale});
}
