"use client";

import Link from "next/link";
import { Layers, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobTable } from "@/components/jobs/job-table";
import { useJobs } from "@/lib/queries";

export default function JobsPage() {
  const { data: jobs, isLoading, error, refetch } = useJobs();

  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Segmentations</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Every nnU-Net segmentation job. Create one from an ingested volume,
            run real inference, and review the mask overlay — all archived on
            Backblaze B2.
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New job
          </Link>
        </Button>
      </div>

      <div className="animate-fade-in-up stagger-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (jobs?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Layers}
            title="No segmentation jobs yet"
            description="Create a job from an ingested volume, or run `pnpm run seed` to mint a model and a demo cohort."
            action={
              <Button asChild>
                <Link href="/jobs/new">New job</Link>
              </Button>
            }
          />
        ) : (
          <JobTable jobs={jobs ?? []} />
        )}
      </div>
    </div>
  );
}
