import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminCatalogClient from "@/app/admin/catalog/admin-catalog-client";

export default async function AdminCatalogPage() {
    return withAdminGate(<AdminCatalogClient />);
}

export const dynamic = "force-dynamic";
