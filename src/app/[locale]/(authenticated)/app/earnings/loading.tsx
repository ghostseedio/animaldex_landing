import {StandardAppTabSkeleton} from "@/app/[locale]/(authenticated)/app/_components/app-tab-loading";

// In place, never the launch splash (parity with iOS, 2026-11-06).
export default function Loading() {
    return <StandardAppTabSkeleton />;
}
