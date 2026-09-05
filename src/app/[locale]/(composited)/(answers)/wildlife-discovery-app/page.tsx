import AnswerPage, {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("wildlife-discovery-app", params.locale);
}

export default async function WildlifeDiscoveryAppPage({params}: {params: {locale: string}}) {
    return AnswerPage({slug: "wildlife-discovery-app", locale: params.locale});
}
