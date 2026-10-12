import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import {AdminPayoutCorridorsClient} from "./admin-payout-corridors-client";

export const dynamic = "force-dynamic";

export default async function AdminPayoutCorridorsPage() {
    return withAdminGate(<AdminPayoutCorridorsClient />);
}
