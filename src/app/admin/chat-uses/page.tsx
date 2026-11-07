import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminChatUsesClient from "@/app/admin/chat-uses/admin-chat-uses-client";

export default async function AdminChatUsesPage() {
    return withAdminGate(<AdminChatUsesClient />);
}

export const dynamic = "force-dynamic";
