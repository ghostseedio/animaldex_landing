"use client";

import Link from "@/app/[locale]/_components/link";
import { storeLinks } from "@/lib/store-links";

type StoreLinksProps = {
  className?: string;
  buttonClassName?: string;
  variant?: "button" | "text";
};

export default function StoreLinks({
  className = "",
  buttonClassName = "",
  variant = "button",
}: StoreLinksProps) {
  if (variant === "text") {
    return (
      <div
        className={`mt-8 flex justify-center flex-wrap gap-x-6 gap-y-3 ${className}`}
      >
        {storeLinks.map((store) => (
          <Link
            key={store.href}
            href={store.href}
            underline
            className="text-primary-200 text-base sm:text-lg hover:text-primary-100 transition-colors"
          >
            {store.name}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 ${className}`}
    >
      {storeLinks.map((store) => (
        <Link
          key={store.href}
          href={store.href}
          className="w-full max-w-[280px] sm:w-auto"
        >
          <span
            className={`
              flex h-14 min-w-[220px] items-center justify-center rounded-2xl
              bg-primary-400/95 px-7 text-lg font-bold text-black
              shadow-[0_0_24px_rgba(34,197,94,0.25)]
              ring-1 ring-white/10
              transition-all duration-200
              hover:-translate-y-0.5 hover:bg-primary-300 hover:shadow-[0_0_32px_rgba(34,197,94,0.35)]
              active:translate-y-0
              ${buttonClassName}
            `}
          >
            {store.name}
          </span>
        </Link>
      ))}
    </div>
  );
}