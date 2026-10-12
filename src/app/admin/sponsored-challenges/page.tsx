import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminSponsoredChallengesClient from "@/app/admin/sponsored-challenges/admin-sponsored-challenges-client";

export default async function AdminSponsoredChallengesPage() {
    return withAdminGate(<AdminSponsoredChallengesClient />);
}

export const dynamic = "force-dynamic";
