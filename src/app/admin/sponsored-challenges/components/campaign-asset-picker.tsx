"use client";

/* Supabase and local asset URLs are resolved at runtime. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

export type LibraryAsset = {
  path: string;
  url: string;
  filename: string;
  source?: string;
};

export function CampaignAssetPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || assets.length) return;
    setLoading(true);
    fetch("/api/admin/assets?limit=60", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok: boolean;
          assets?: LibraryAsset[];
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load assets");
        }
        setAssets(
          (payload.assets ?? []).filter((asset) => /\.(jpe?g|png|webp)$/i.test(asset.filename)),
        );
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Unable to load assets"),
      )
      .finally(() => setLoading(false));
  }, [assets.length, open]);

  return (
    <div className="rounded-xl border border-line-300 bg-canvas-950/30 p-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="text-xs font-bold text-primary-100 disabled:opacity-50"
      >
        {open ? "Hide asset library" : "Choose from /assets"}
      </button>
      {open ? (
        <div className="mt-3">
          {loading ? <p className="text-xs text-ink-400">Loading assets...</p> : null}
          {error ? <p className="text-xs text-rose-100">{error}</p> : null}
          {!loading && !error ? (
            assets.length ? (
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                {assets.map((asset) => (
                  <button
                    key={asset.path}
                    type="button"
                    disabled={disabled}
                    title={`Use ${asset.filename}`}
                    onClick={() => {
                      onSelect(asset.url);
                      setOpen(false);
                    }}
                    className="overflow-hidden rounded-lg border border-line-300 text-left disabled:opacity-50"
                  >
                    <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-[9px] text-ink-300">
                      {asset.filename}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-400">
                No JPG, PNG, or WebP images are available in /assets yet.
              </p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
