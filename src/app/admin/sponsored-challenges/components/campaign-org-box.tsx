"use client";
import {
  inputClass,
  FieldGrid,
  Field,
} from "./campaign-form-controls";

export function OrgBox({
  disabled,
  loading,
  name,
  slug,
  onName,
  onSlug,
  onCreate,
}: {
  disabled: boolean;
  loading: boolean;
  name: string;
  slug: string;
  onName: (value: string) => void;
  onSlug: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <details className="group rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-display text-2xl text-white">
              Sponsor organization
            </span>
            <span className="mt-1 block text-xs text-ink-400">
              Optional. Leave AnimalDex-authored for first-party Challenges.
            </span>
          </span>
          <span className="text-lg text-ink-500 transition group-open:rotate-45">+</span>
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-ink-400">
          Create an organization here if this Challenge is presented by a sponsor.
          Business membership management is not included.
        </p>
        <FieldGrid>
          <Field label="New organization name">
            <input
              className={inputClass}
              value={name}
              placeholder="e.g. Nusantara Wildlife Foundation; blank for AnimalDex"
              disabled={disabled}
              onChange={(e) => onName(e.target.value)}
            />
          </Field>
          <Field label="Organization slug">
            <input
              className={inputClass}
              value={slug}
              placeholder="e.g. nusantara-wildlife-foundation; blank if no sponsor"
              disabled={disabled}
              onChange={(e) => onSlug(e.target.value)}
            />
          </Field>
        </FieldGrid>
        <button
          type="button"
          disabled={disabled || !name || !slug}
          className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          onClick={onCreate}
        >
          {loading ? "Saving organization..." : "Save organization"}
        </button>
      </div>
    </details>
  );
}
