import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminContentStudio from "@/app/admin/seo/admin-content-studio";

export default async function AdminSeoPage() {
    return withAdminGate(<AdminContentStudio />);
}

export const dynamic = "force-dynamic";
