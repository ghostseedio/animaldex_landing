import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminWildlifeGuidesClient from "@/app/admin/wildlife-guides/admin-wildlife-guides-client";

export default async function AdminWildlifeGuidesPage() {
    return withAdminGate(<AdminWildlifeGuidesClient />);
}

export const dynamic = "force-dynamic";
