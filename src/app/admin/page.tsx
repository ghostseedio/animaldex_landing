import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminOverviewClient from "@/app/admin/admin-overview-client";

export default async function AdminDashboardPage() {
    return withAdminGate(<AdminOverviewClient />);
}

export const dynamic = "force-dynamic";
