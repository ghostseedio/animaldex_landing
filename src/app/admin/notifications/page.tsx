import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminNotificationsClient from "@/app/admin/notifications/admin-notifications-client";

export default async function AdminNotificationsPage() {
    return withAdminGate(<AdminNotificationsClient />);
}

export const dynamic = "force-dynamic";
