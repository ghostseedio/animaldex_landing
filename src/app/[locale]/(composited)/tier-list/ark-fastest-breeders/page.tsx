import type {Metadata} from "next";
import {ArkBreedersView, arkBreedersMetadata} from "@/app/[locale]/(composited)/rankings/_components/ark-breeders-view";

// /tier-list/ark-fastest-breeders: the Ark's live ranking, static and revalidated hourly like the tier lists beside it
// (the numbers are built once an hour per process from the data cache). English and Indonesian by the site
// locale; /tier-list/ark-fastest-breeders/lang/<language> reads it in any of the Ark's 45 languages.
export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

type Props = {params: {locale: string}};

export function generateMetadata({params}: Props): Promise<Metadata> {
    return arkBreedersMetadata({locale: params.locale});
}

export default async function Page({params}: Props) {
    return ArkBreedersView({locale: params.locale});
}
