"use client";

import Button from "@/app/[locale]/_components/button";
import Link from "@/app/[locale]/_components/link";
import {storeLinks} from "@/lib/store-links";

type StoreLinksProps = {
    className?: string;
    buttonClassName?: string;
    variant?: "button" | "text";
};

export default function StoreLinks({className = "", buttonClassName = "", variant = "button"}: StoreLinksProps) {
    if (variant === "text") {
        return (
            <div className={`flex justify-center flex-wrap gap-x-5 gap-y-3 ${className}`}>
                {storeLinks.map((store) => (
                    <Link
                        key={store.href}
                        href={store.href}
                        underline
                        className="text-primary-200 text-lg hover:text-primary-100 transition-colors"
                    >
                        {store.name}
                    </Link>
                ))}
            </div>
        );
    }

    return (
        <div className={`flex justify-center flex-wrap gap-3 ${className}`}>
            {storeLinks.map((store) => (
                <Link key={store.href} href={store.href}>
                    <Button as="span" className={buttonClassName}>
                        {store.name}
                    </Button>
                </Link>
            ))}
        </div>
    );
}
