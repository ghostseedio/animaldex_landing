import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminIntegrityClient from "@/app/admin/integrity/admin-integrity-client";

export default async function AdminIntegrityPage() {
    return withAdminGate(<AdminIntegrityClient />);
}

export const dynamic = "force-dynamic";
