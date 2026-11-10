import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminArkModelsClient from "@/app/admin/ark-models/admin-ark-models-client";

export default async function AdminArkModelsPage() {
    return withAdminGate(<AdminArkModelsClient />);
}

export const dynamic = "force-dynamic";
