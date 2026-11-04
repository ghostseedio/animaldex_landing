import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminAiSpendClient from "@/app/admin/ai-spend/admin-ai-spend-client";

export default async function AdminAiSpendPage() {
    return withAdminGate(<AdminAiSpendClient />);
}

export const dynamic = "force-dynamic";
