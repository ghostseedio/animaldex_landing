import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminSponsoredChallengesClient from "@/app/admin/sponsored-challenges/admin-sponsored-challenges-client";

export default async function AdminSponsoredChallengesPage() {
    return withAdminGate(
        <main className="min-h-screen bg-canvas-950 px-4 py-8 text-ink-100 sm:px-6 lg:px-8">
            <div className="w-full max-w-none">
                <AdminSponsoredChallengesClient />
            </div>
        </main>
    );
}

export const dynamic = "force-dynamic";
