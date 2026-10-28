"use client";

import { usePathname } from "next/navigation";
import StoreLink from "@/components/store/store-link";
import { pageStorePlacement, storeLinks, type StorePlacement } from "@/lib/store-links";

type StoreLinksProps = {
  className?: string;
  buttonClassName?: string;
  variant?: "button" | "text";
  /** Where these buttons are, for install attribution; by default the page's section (`page_animals`). */
  placement?: StorePlacement;
};

export default function StoreLinks({
  className = "",
  buttonClassName = "",
  variant = "button",
  placement,
}: StoreLinksProps) {
  const pathname = usePathname();
  const resolvedPlacement = placement ?? pageStorePlacement(pathname);

  if (variant === "text") {
    return (
      <div
        className={`mt-8 flex justify-center flex-wrap gap-x-6 gap-y-3 ${className}`}
      >
        {storeLinks.map((store) => (
          <StoreLink
            key={store.store}
            store={store.store}
            placement={resolvedPlacement}
            className="group text-primary-200 text-base sm:text-lg hover:text-primary-100 transition-colors"
          >
            {store.name}
            <span className="block w-full scale-x-0 group-hover:scale-x-100 h-1 mt-1 rounded-full bg-primary-200 transition-transform duration-300 ease-in-out" />
          </StoreLink>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 ${className}`}
    >
      {storeLinks.map((store) => (
        <StoreLink
          key={store.store}
          store={store.store}
          placement={resolvedPlacement}
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
        </StoreLink>
      ))}
    </div>
  );
}
