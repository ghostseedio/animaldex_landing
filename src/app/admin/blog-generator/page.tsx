import {withAdminGate} from "@/app/admin/_components/admin-auth-gate";
import AdminBlogGenerator from "@/app/admin/blog-generator/admin-blog-generator";

export default async function AdminBlogGeneratorPage() {
    return withAdminGate(<AdminBlogGenerator />);
}

export const dynamic = "force-dynamic";
