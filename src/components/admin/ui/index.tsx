"use client";

/**
 * Admin-only UI primitives in the shadcn/ui style (source lives in the repo,
 * Radix only where accessibility needs it). Import these from /admin code only
 * so none of it ships to public pages.
 */

import Link from "next/link";
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
  return <section className={cn("min-w-0 border border-line-300 bg-surface-900", className)} {...props} />;
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

export const buttonVariants = cva(
  "inline-flex min-h-9 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[2px] px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-400 text-canvas-950 hover:bg-primary-300",
        outline: "border border-line-300 bg-surface-900 text-white hover:border-primary-300 hover:bg-white/[.03]",
        ghost: "text-ink-300 hover:bg-white/[.05] hover:text-white",
        danger: "border border-red-400/40 bg-red-500/10 text-red-200 hover:border-red-300 hover:bg-red-500/20",
      },
      size: { sm: "min-h-8 px-2.5 text-xs", md: "", lg: "min-h-11 px-5 text-sm" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

/** `loading` swaps the leading icon for a spinner and blocks repeat clicks. */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean }
>(function Button({ className, variant, size, type = "button", loading = false, disabled, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 12 : 14} /> : null}
      {children}
    </button>
  );
});

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
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto border border-line-300 bg-canvas-900 p-0.5", className)}>
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
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
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
  tone,
  loading,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral";
  info?: ReactNode;
  /** Colours the value: good/warn/bad when the number itself is the signal. */
  tone?: "good" | "warn" | "bad";
  /** Holds the tile's height with a placeholder until the number arrives. */
  loading?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
        {label}
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2.5 h-7 w-20" />
      ) : (
        <p
          className={cn(
            "mt-1 font-display text-3xl leading-tight tabular-nums",
            tone === "good" ? "text-primary-100" : tone === "warn" ? "text-amber-200" : tone === "bad" ? "text-red-300" : "text-white",
          )}
        >
          {value}
        </p>
      )}
      {delta && !loading ? (
        <p className={cn("mt-0.5 text-xs font-bold tabular-nums", deltaTone === "good" ? "text-primary-200" : deltaTone === "bad" ? "text-red-300" : "text-ink-400")}>{delta}</p>
      ) : null}
      {hint ? <p className="mt-1 text-[11px] leading-4 text-ink-500">{hint}</p> : null}
    </>
  );
  const className = "block min-w-0 border border-line-300 bg-surface-900 p-4";
  return href ? (
    <Link href={href} className={cn(className, "transition hover:border-primary-400/50 hover:bg-white/[.02]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
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
            className="z-[60] max-w-xs border border-line-300 bg-canvas-950 px-3 py-2 text-xs leading-5 text-ink-200 shadow-2xl"
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

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------

/** The content column every admin page sits in, under the shell's top bar. */
export function AdminPage({ className, width = "default", ...props }: HTMLAttributes<HTMLElement> & { width?: "default" | "wide" | "narrow" }) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8",
        width === "wide" ? "max-w-[1600px]" : width === "narrow" ? "max-w-4xl" : "max-w-[1360px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Title block at the top of a page: section eyebrow, title, one line on what
 * the page is for, and the page's actions on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small status line under the description, e.g. "Updated 2m ago". */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-line-300 pb-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-2xl leading-tight text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-ink-400">{description}</p> : null}
        {meta ? <div className="mt-2 text-xs text-ink-500">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A labelled band within a page. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mt-8", className)}>
      {title || action ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-[11px] font-black uppercase tracking-[.16em] text-ink-400">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-white/[.06] motion-reduce:animate-none", className)} {...props} />;
}

/** Placeholder rows shaped like a table, for the first load of a list. */
export function TableSkeleton({ rows = 6, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("divide-y divide-line-300/60", className)}>
      <div className="flex gap-4 px-3 py-2.5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-2.5 flex-1 opacity-60" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-3 py-3.5">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className={cn("h-3 flex-1", index === 0 && "flex-[2]")} style={{ opacity: 1 - row * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder stack of list cards. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border border-line-300 bg-surface-900 px-4 py-4" style={{ opacity: 1 - row * 0.12 }}>
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <Skeleton className="hidden h-7 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <StatGrid className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border border-line-300 bg-surface-900 p-4">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-3 h-7 w-24" />
        </div>
      ))}
    </StatGrid>
  );
}

/** Inline "working on it" line for panels that load on demand. */
export function LoadingRow({ children = "Loading…", className }: { children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center gap-2.5 px-4 py-6 text-sm font-bold text-ink-400", className)}>
      <Spinner />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty, error and notice states
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center border border-dashed border-line-300 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 grid h-11 w-11 place-items-center border border-line-300 bg-surface-900 text-ink-400">{icon}</div> : null}
      <p className="text-sm font-black text-white">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs leading-5 text-ink-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const alertTones = {
  info: "border-sky-300/30 bg-sky-400/[.07] text-sky-100",
  good: "border-primary-400/30 bg-primary-500/[.07] text-primary-100",
  warn: "border-amber-300/30 bg-amber-400/[.08] text-amber-100",
  bad: "border-red-400/30 bg-red-500/10 text-red-100",
} as const;

const alertDots = { info: "bg-sky-300", good: "bg-primary-300", warn: "bg-amber-300", bad: "bg-red-400" } as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex items-start gap-3 border px-4 py-3 text-sm", alertTones[tone], className)}>
      <span aria-hidden="true" className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", alertDots[tone])} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-black">{title}</p> : null}
        {children ? <div className={cn("leading-6 opacity-80", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The page-level refresh control: spins while a reload is in flight. */
export function RefreshButton({ loading, onClick, label = "Refresh" }: { loading?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="sm" onClick={onClick} disabled={loading} aria-busy={loading || undefined}>
      <svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn("shrink-0", loading && "animate-spin motion-reduce:animate-none")}
      >
        <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loading ? "Refreshing…" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

/** Shared field styling, for inputs, selects and textareas alike. */
export const fieldClass =
  "w-full border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-ink-600 focus:border-primary-300 focus:ring-2 focus:ring-primary-300/20 disabled:opacity-50";

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[.12em] text-ink-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-4 text-ink-500">{hint}</span> : null}
    </label>
  );
}
