import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminIdentityReviewClient from "@/app/admin/identity-review/admin-identity-review-client";

export default async function AdminIdentityReviewPage() {
    return withAdminGate(
        <main className="px-3 py-4 text-ink-100 sm:px-5 lg:px-7 lg:py-5">
            <div className="mx-auto w-full max-w-[90rem]">
                <AdminIdentityReviewClient />
            </div>
        </main>
    );
}

export const dynamic = "force-dynamic";
