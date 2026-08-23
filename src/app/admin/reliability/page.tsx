import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminReliabilityClient from "@/app/admin/reliability/admin-reliability-client";

export default async function AdminReliabilityPage() {
    return withAdminGate(
        <main className="min-h-screen bg-canvas-950 px-6 py-10 text-ink-100">
            <div className="mx-auto w-full max-w-[90rem]">
                <AdminReliabilityClient />
            </div>
        </main>
    );
}

export const dynamic = "force-dynamic";
