import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("animal-collection-game", params.locale);
}

export default async function AnimalCollectionGamePage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "animal-collection-game", locale: params.locale});
}
