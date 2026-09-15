"use client";

/**
 * Admin-only UI primitives in the shadcn/ui style (source lives in the repo,
 * Radix only where accessibility needs it). Import these from /admin code only
 * so none of it ships to public pages.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  // min-w-0 so a wide table or chart scrolls inside the card instead of
  // stretching its grid column past the screen.
  return <section className={cn("min-w-0 rounded-xl border border-line-300 bg-surface-900", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 border-b border-line-300 px-4 py-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg text-white">{title}</h2>
        {description ? <p className="mt-0.5 max-w-3xl text-xs leading-5 text-ink-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em]",
  {
    variants: {
      tone: {
        neutral: "border-line-300 text-ink-300",
        good: "border-primary-400/30 bg-primary-500/10 text-primary-100",
        warn: "border-amber-300/30 bg-amber-400/10 text-amber-200",
        bad: "border-red-400/30 bg-red-500/10 text-red-200",
        ios: "border-sky-300/30 bg-sky-400/10 text-sky-200",
        android: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
        web: "border-violet-300/30 bg-violet-400/10 text-violet-200",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-400 text-canvas-950 hover:bg-primary-300",
        outline: "border border-line-300 text-white hover:border-primary-300",
        ghost: "text-ink-300 hover:bg-white/[.05] hover:text-white",
      },
      size: { sm: "min-h-8 px-2.5 text-xs", md: "" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>>(
  function Button({ className, variant, size, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);

// ---------------------------------------------------------------------------
// Segmented control (tabs, filters)
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode; count?: number | null }>;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border border-line-300 bg-canvas-900 p-0.5", className)}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              on ? "bg-primary-400 text-canvas-950" : "text-ink-400 hover:text-white",
            )}
          >
            {option.label}
            {option.count != null ? <span className={cn("tabular-nums", on ? "text-canvas-950/70" : "text-ink-500")}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({ className, children, minWidth = 640 }: { className?: string; children: ReactNode; minWidth?: number }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function TH({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-line-300 px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-ink-500",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("border-b border-line-300/60 px-3 py-2.5 align-top text-ink-200", numeric && "whitespace-nowrap text-right tabular-nums", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  delta,
  deltaTone,
  info,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral";
  info?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-ink-400">
        {label}
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      <p className="mt-1 font-display text-3xl leading-tight text-white tabular-nums">{value}</p>
      {delta ? (
        <p className={cn("mt-0.5 text-xs font-bold tabular-nums", deltaTone === "good" ? "text-primary-200" : deltaTone === "bad" ? "text-red-300" : "text-ink-400")}>{delta}</p>
      ) : null}
      {hint ? <p className="mt-1 text-[11px] leading-4 text-ink-500">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export function InfoTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className="grid h-4 w-4 place-items-center rounded-full border border-line-300 text-[9px] font-black text-ink-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            i
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-[60] max-w-xs rounded-lg border border-line-300 bg-canvas-950 px-3 py-2 text-xs leading-5 text-ink-200 shadow-2xl"
          >
            {children}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ---------------------------------------------------------------------------
// Sheet (side drawer)
// ---------------------------------------------------------------------------

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line-300 bg-surface-900 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-line-300 px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-xl text-white">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-ink-400">{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                ✕
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-line-300 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
