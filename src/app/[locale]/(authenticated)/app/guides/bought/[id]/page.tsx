import {notFound, redirect} from "next/navigation";
import GuideDetail from "@/components/wildlife-guides/guide-detail";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getBoughtWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

/** A guide you bought: always readable, even after the author pauses it. */
export default async function BoughtGuidePage({params}: {params: {locale: string; id: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(`/${params.locale}/account?next=${encodeURIComponent(`/${params.locale}/app/guides/bought/${params.id}`)}`);
    if (!isUuid(params.id)) notFound();
    const guide = await getBoughtWildlifeGuide(params.id);
    if (!guide) notFound();
    return <GuideDetail guide={guide} locale={params.locale} viewerLoaded />;
}
