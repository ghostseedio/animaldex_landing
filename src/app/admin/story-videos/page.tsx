import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminStoryVideos from "@/app/admin/story-videos/admin-story-videos";
import {getSiteUrl} from "@/lib/site";

export default async function AdminStoryVideosPage() {
    return withAdminGate(<AdminStoryVideos siteUrl={getSiteUrl()} />);
}

export const dynamic = "force-dynamic";
