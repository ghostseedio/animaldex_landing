import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminIdentityReviewClient from "@/app/admin/identity-review/admin-identity-review-client";

export default async function AdminIdentityReviewPage() {
    return withAdminGate(<AdminIdentityReviewClient />);
}

export const dynamic = "force-dynamic";
