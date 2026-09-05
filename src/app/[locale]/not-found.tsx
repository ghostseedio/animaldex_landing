import {Metadata} from "next";
import NotFoundBody from "@/app/[locale]/_components/not-found-body";

export const metadata: Metadata = {
    title: "404",
    robots: {index: false, follow: false}
};

export default function ErrorNotFound() {
    return <NotFoundBody />;
}
