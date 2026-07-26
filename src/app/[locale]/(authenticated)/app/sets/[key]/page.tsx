import {redirect} from "next/navigation";

export default function SetsDetailRedirectPage({params}: {params: {key: string}}) {
    // Power-set keys are retired; deep links land on the binders shelf.
    void params.key;
    redirect("/app/collection?segment=binders");
}
