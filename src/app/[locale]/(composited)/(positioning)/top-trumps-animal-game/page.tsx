import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateCollectorMetadata("top-trumps-animal-game", params.locale);
}

export default async function TopTrumpsAnimalGamePage({params}: {params: {locale: string}}) {
    return CollectorLandingPage({slug: "top-trumps-animal-game", locale: params.locale});
}
