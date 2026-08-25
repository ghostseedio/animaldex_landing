import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminGuidesClient from "@/app/admin/guides/admin-guides-client";

export default async function AdminGuidesPage() {
    return withAdminGate(<AdminGuidesClient />);
}

export const dynamic = "force-dynamic";
