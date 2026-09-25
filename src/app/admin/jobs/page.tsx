import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminJobsClient from "@/app/admin/jobs/admin-jobs-client";

export default async function AdminJobsPage() {
    return withAdminGate(<AdminJobsClient />);
}

export const dynamic = "force-dynamic";
