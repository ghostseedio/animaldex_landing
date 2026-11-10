"use client";

import {AdminPage, PageHeader} from "@/components/admin/ui";
import {ArkMeasureView, type ArkMeasureResponse} from "@/app/admin/metrics/_analytics/ark";

export default function ArkMetricsGallery({data}: {data: ArkMeasureResponse}) {
    return (
        <AdminPage width="wide" className="min-w-0 bg-canvas-950 py-6">
            <PageHeader eyebrow="Analytics · development fixture" title="Ark" description="The Ark tab of /admin/metrics, drawn from fixture rows." />
            <div className="mt-5">
                <ArkMeasureView data={data} />
            </div>
        </AdminPage>
    );
}
