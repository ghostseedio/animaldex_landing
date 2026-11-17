import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminFeedbackPollsClient from "@/app/admin/feedback-polls/admin-feedback-polls-client";

export default async function AdminFeedbackPollsPage() {
    return withAdminGate(<AdminFeedbackPollsClient />);
}

export const dynamic = "force-dynamic";
