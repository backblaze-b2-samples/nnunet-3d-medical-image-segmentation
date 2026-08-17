"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobSliceUrl } from "@/lib/queries";

// A minimal inline slider (the kit has no shadcn slider); a native range input
// styled to match keeps the dependency surface small.
function Slider({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary"
      aria-label="Overlay slice"
    />
  );
}

/**
 * Steps through the completed job's mid-slice mask-overlay PNGs. Each overlay
 * is fetched as a short-lived presigned inline URL (server rendered the volume
 * with the segmentation on top).
 */
export function MaskOverlayViewer({
  jobId,
  count,
}: {
  jobId: string;
  count: number;
}) {
  const [index, setIndex] = useState(Math.floor(count / 2));
  const { data, isLoading } = useJobSliceUrl(jobId, index, count > 0);

  if (count === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/90">
        {isLoading || !data ? (
          <Skeleton className="aspect-square w-full max-w-md" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.url}
            alt={`Segmentation overlay slice ${index + 1} of ${count}`}
            className="aspect-square w-full max-w-md object-contain"
          />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Slider value={index} max={count - 1} onChange={setIndex} />
        <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {index + 1} / {count}
        </span>
      </div>
    </div>
  );
}
