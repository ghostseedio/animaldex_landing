import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminIndexingClient from "@/app/admin/indexing/admin-indexing-client";

export default async function AdminIndexingPage() {
    return withAdminGate(
        <main className="min-h-screen bg-canvas-950 px-3 py-4 text-ink-100 sm:px-5 lg:px-7 lg:py-5">
            <div className="mx-auto w-full max-w-[90rem]">
                <AdminIndexingClient />
            </div>
        </main>
    );
}

export const dynamic = "force-dynamic";
