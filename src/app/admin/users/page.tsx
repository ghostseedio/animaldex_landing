import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminUsersClient from "@/app/admin/users/admin-users-client";

export default async function AdminUsersPage() {
    return withAdminGate(<AdminUsersClient />);
}

export const dynamic = "force-dynamic";
