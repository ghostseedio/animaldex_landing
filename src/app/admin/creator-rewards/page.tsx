import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import {AdminCreatorRewardsClient} from "./admin-creator-rewards-client";

export const dynamic = "force-dynamic";

export default async function AdminCreatorRewardsPage() {
    return withAdminGate(<AdminCreatorRewardsClient />);
}
