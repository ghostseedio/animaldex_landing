import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminAssetLibrary from "@/app/admin/assets/admin-asset-library";

export default async function AdminAssetsPage() {
    return withAdminGate(<AdminAssetLibrary />);
}

export const dynamic = "force-dynamic";
