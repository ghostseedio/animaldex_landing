import {redirect} from "next/navigation";
import CompanionsPage from "@/app/[locale]/(authenticated)/app/companions/companions-page";
import {getLocalePath} from "@/lib/site";

// The first tab is Companions (docs/companion-loop/SPEC.md, phase 4): every
// animal you hold, the ones with something for you first. The feed that used
// to live here is Explore's Feed; its old `?view=collectors` link still lands.
export default function AppHomePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    if (searchParams?.view === "collectors") redirect(getLocalePath(params.locale, "/app/explore?view=collectors"));
    return <CompanionsPage />;
}
