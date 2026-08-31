import {AppPage, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";

export default function GuidesLoading() {
    return (
        <AppPage narrow>
            <AppSurface><p className="text-sm text-white/45">Loading Wildlife Guides…</p></AppSurface>
        </AppPage>
    );
}
