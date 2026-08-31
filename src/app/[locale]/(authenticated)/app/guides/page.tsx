import GuidesClient from "@/app/[locale]/(authenticated)/app/guides/guides-client";

export const dynamic = "force-dynamic";

export default function GuidesPage({searchParams}: {searchParams: {tab?: string}}) {
    const tab = searchParams.tab === "listings" || searchParams.tab === "requests" ? searchParams.tab : "setup";
    return <GuidesClient initialTab={tab} />;
}
