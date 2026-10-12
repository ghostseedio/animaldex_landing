import {AdminPage, Skeleton, StatGridSkeleton, TableSkeleton} from "@/components/admin/ui";

/**
 * Shown inside the admin chrome while the next page's server render is in
 * flight, so a click in the sidebar answers at once instead of freezing.
 */
export default function AdminLoading() {
    return (
        <AdminPage aria-busy="true">
            <div className="border-b border-line-300 pb-5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-3 h-7 w-64" />
                <Skeleton className="mt-3 h-3 w-full max-w-lg" />
            </div>
            <StatGridSkeleton className="mt-6" />
            <div className="mt-6 border border-line-300 bg-surface-900">
                <TableSkeleton rows={7} columns={5} />
            </div>
            <span className="sr-only" role="status">
                Loading…
            </span>
        </AdminPage>
    );
}
