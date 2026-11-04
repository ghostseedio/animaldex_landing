import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminMetricsDashboard from "@/app/admin/metrics/admin-metrics-dashboard";

/** Ad spend, organic social, imported reports and the monthly plan: what is entered or synced by hand. */
export default async function AdminMarketingMetricsPage() {
    return withAdminGate(<AdminMetricsDashboard />);
}

export const dynamic = "force-dynamic";
