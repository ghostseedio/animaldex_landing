import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminApiStatusClient from "@/app/admin/api-status/admin-api-status-client";

export default async function AdminApiStatusPage() {
    return withAdminGate(<AdminApiStatusClient />);
}

export const dynamic = "force-dynamic";
