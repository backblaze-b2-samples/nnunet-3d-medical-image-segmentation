"use client";

import { use } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobDetail } from "@/components/jobs/job-detail";
import { useJob } from "@/lib/queries";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: job, isLoading, error, refetch } = useJob(id);

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to segmentations
      </Link>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorState error={error} onRetry={() => refetch()} />
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/jobs">Back to segmentations</Link>
            </Button>
          </div>
        </div>
      ) : job ? (
        <JobDetail job={job} />
      ) : null}
    </div>
  );
}
