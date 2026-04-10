import {generateCollectorMetadata} from "@/app/[locale]/(composited)/(positioning)/_shared";
import CollectorLandingPage from "@/app/[locale]/(composited)/(positioning)/_shared";

export async function generateMetadata() {
    return generateCollectorMetadata("collect-real-animals-app");
}

export default async function CollectRealAnimalsAppPage() {
    return CollectorLandingPage({slug: "collect-real-animals-app"});
}
