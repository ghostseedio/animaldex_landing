import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminIndexingClient from "@/app/admin/indexing/admin-indexing-client";

export default async function AdminIndexingPage() {
    return withAdminGate(<AdminIndexingClient />);
}

export const dynamic = "force-dynamic";
