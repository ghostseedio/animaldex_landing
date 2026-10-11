import {redirect} from "next/navigation";
import {ProfilePageBody} from "@/app/[locale]/(composited)/u/[handle]/profile-page-body";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getLocalePath} from "@/lib/site";

export default async function ProfilePage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const username = context.profile.username?.trim();
    // iOS asks for a username first ("Complete your profile"); /account would
    // send a signed-in person straight back here.
    if (!username) redirect(getLocalePath(params.locale, "/app/profile/edit"));
    return ProfilePageBody({locale: params.locale, handle: username, surface: "app"});
}
