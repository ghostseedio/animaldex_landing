import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminReliabilityClient from "@/app/admin/reliability/admin-reliability-client";

export default async function AdminReliabilityPage() {
    return withAdminGate(<AdminReliabilityClient />);
}

export const dynamic = "force-dynamic";
