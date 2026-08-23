import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminCreatorReviewsClient from "@/app/admin/creator-reviews/admin-creator-reviews-client";

export default async function AdminCreatorReviewsPage() {
    return withAdminGate(<AdminCreatorReviewsClient />);
}

export const dynamic = "force-dynamic";
