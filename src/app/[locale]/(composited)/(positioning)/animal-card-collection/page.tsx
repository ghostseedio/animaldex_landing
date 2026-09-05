import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("animal-card-collection", params.locale);
}

export default async function AnimalCardCollectionPage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "animal-card-collection", locale: params.locale});
}
