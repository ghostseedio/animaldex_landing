import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("collect-real-animals-app", params.locale);
}

export default async function CollectRealAnimalsAppPage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "collect-real-animals-app", locale: params.locale});
}
