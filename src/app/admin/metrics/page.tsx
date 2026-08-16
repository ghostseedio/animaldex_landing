import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminMetricsDashboard from "@/app/admin/metrics/admin-metrics-dashboard";

export default async function AdminMetricsPage() {
    return withAdminGate(<AdminMetricsDashboard />);
}

export const dynamic = "force-dynamic";
