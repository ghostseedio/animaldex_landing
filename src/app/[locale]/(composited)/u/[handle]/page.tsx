import type {Metadata} from "next";
import {ProfilePageBody} from "@/app/[locale]/(composited)/u/[handle]/profile-page-body";
import ShareReferralCapture from "@/components/store/share-referral-capture";
import {getPublicProfileCard, normalizePublicHandle} from "@/data/public-profiles";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

type PublicProfilePageProps = {
    params: {locale: string; handle: string};
};

function profilePath(handle: string) {
    return `/u/${encodeURIComponent(handle)}`;
}

export async function generateMetadata({params}: PublicProfilePageProps): Promise<Metadata> {
    const handle = normalizePublicHandle(params.handle);
    if (!handle) return {};

    const profile = await getPublicProfileCard(handle);
    if (!profile) return {};

    const pathname = profilePath(profile.username);
    const url = getAbsoluteUrl(params.locale, pathname);
    const title = `${profile.displayName} (@${profile.username})`;
    const description = `${profile.displayName}'s public AnimalDex card: ${profile.captureCount} captures, ${profile.speciesCount} species, and a collector score of ${profile.collectorScore}.`;

    return {
        title,
        description,
        alternates: {canonical: getLocalePath(params.locale, pathname)},
        robots: {index: false, follow: true},
        other: {
            "apple-itunes-app": `app-id=6761607780, app-argument=${url}`
        },
        appLinks: {
            ios: {url, app_store_id: "6761607780", app_name: "AnimalDex"},
            android: {url, package: "app.animaldex", app_name: "AnimalDex"}
        },
        openGraph: {
            type: "profile",
            url,
            title,
            description,
            siteName: "AnimalDex",
            images: profile.avatarUrl ? [{url: profile.avatarUrl, alt: `${profile.displayName}'s AnimalDex profile`}]: undefined
        },
        twitter: {
            card: profile.avatarUrl ? "summary" : "summary_large_image",
            title,
            description,
            images: profile.avatarUrl ? [profile.avatarUrl] : undefined
        }
    };
}

export default async function PublicProfilePage({params}: PublicProfilePageProps) {
    const body = await ProfilePageBody({locale: params.locale, handle: params.handle, surface: "marketing"});
    return (
        <>
            {/* A profile shared from the app may carry the sharer's `?ref=`. */}
            <ShareReferralCapture />
            {body}
        </>
    );
}

