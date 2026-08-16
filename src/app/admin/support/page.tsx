import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import SupportInboxClient from "@/app/admin/support/support-inbox-client";

export default async function SupportInboxPage() {
    return withAdminGate(<SupportInboxClient />);
}

export const dynamic = "force-dynamic";
