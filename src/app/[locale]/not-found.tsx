import {Metadata} from "next";
import NotFoundBody from "@/app/[locale]/_components/not-found-body";

export const metadata: Metadata = {
    title: "Page not found",
    robots: {index: false, follow: true}
};

export default function ErrorNotFound() {
    return <NotFoundBody />;
}
