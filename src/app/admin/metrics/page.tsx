import {redirect} from "next/navigation";
import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AnalyticsDashboard from "@/app/admin/metrics/analytics-dashboard";

export default async function AdminMetricsPage({searchParams}: {searchParams: Record<string, string | string[] | undefined>}) {
    // Spend, social and Plan & log moved to /admin/metrics/marketing; old links
    // (?tab=plan, ?tab=channels, or a ?month= with no range) follow them there.
    const tab = typeof searchParams.tab === "string" ? searchParams.tab : null;
    const month = typeof searchParams.month === "string" ? searchParams.month : null;
    if (tab === "plan" || tab === "channels" || (month && !searchParams.range)) {
        const params = new URLSearchParams();
        if (tab === "plan") params.set("tab", "plan");
        if (month) params.set("month", month);
        const query = params.toString();
        redirect(`/admin/metrics/marketing${query ? `?${query}` : ""}`);
    }
    return withAdminGate(<AnalyticsDashboard />);
}

export const dynamic = "force-dynamic";
