import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminSegmentsClient from "@/app/admin/segments/admin-segments-client";

export default async function AdminSegmentsPage() {
    return withAdminGate(<AdminSegmentsClient />);
}

export const dynamic = "force-dynamic";
