import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import {AdminPayoutsClient} from "./admin-payouts-client";

export default async function AdminPayoutsPage() {
    return withAdminGate(<AdminPayoutsClient />);
}
