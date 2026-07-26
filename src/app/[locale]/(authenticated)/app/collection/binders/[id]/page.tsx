import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppPage} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import BinderDetailView from "@/app/[locale]/(authenticated)/app/collection/binder-detail-view";
import {getCollectionBinderDetail} from "@/data/collection-binders";

export default async function BinderDetailPage({params}: {params: {id: string}}) {
    const binder = await getCollectionBinderDetail(params.id);
    if (!binder) notFound();

    return (
        <AppPage>
            <Link
                href="/app/collection?segment=binders"
                className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-primary-200"
            >
                <AppIcon name="back" />
                Binders
            </Link>
            <BinderDetailView binder={binder} />
        </AppPage>
    );
}
