import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminMaintenanceClient from "@/app/admin/maintenance/admin-maintenance-client";

export default async function AdminMaintenancePage() {
    return withAdminGate(<AdminMaintenanceClient />);
}

export const dynamic = "force-dynamic";
