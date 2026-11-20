import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminDisputesClient from "@/app/admin/disputes/admin-disputes-client";

export default async function AdminDisputesPage() {
    return withAdminGate(<AdminDisputesClient />);
}

export const dynamic = "force-dynamic";
