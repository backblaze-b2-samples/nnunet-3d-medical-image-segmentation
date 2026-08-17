"use client";

import Link from "next/link";
import { Boxes, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { VolumeGrid } from "@/components/volumes/volume-grid";
import { useVolumes } from "@/lib/queries";

export default function VolumesPage() {
  const { data: volumes, isLoading, error, refetch } = useVolumes();

  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Volumes</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Ingested 3D imaging volumes under the <code>volumes/</code> prefix.
            This sample-scoped view sits alongside the full-bucket{" "}
            <Link href="/files" className="underline">
              Files
            </Link>{" "}
            explorer. Thumbnails are server-rendered mid-slices.
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="mr-1.5 h-4 w-4" />
            Ingest volume
          </Link>
        </Button>
      </div>

      <div className="animate-fade-in-up stagger-2">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (volumes?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No volumes ingested yet"
            description="Ingest a .nii.gz volume, or run `pnpm run seed` to populate a synthetic cohort under volumes/."
            action={
              <Button asChild>
                <Link href="/upload">Ingest volume</Link>
              </Button>
            }
          />
        ) : (
          <VolumeGrid volumes={volumes ?? []} />
        )}
      </div>
    </div>
  );
}
