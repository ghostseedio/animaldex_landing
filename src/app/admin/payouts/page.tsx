import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import {AdminPayoutsClient} from "./admin-payouts-client";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
    return withAdminGate(<AdminPayoutsClient />);
}
