import {redirect} from "next/navigation";

export default function SetsRedirectPage() {
    redirect("/app/collection?segment=binders");
}
