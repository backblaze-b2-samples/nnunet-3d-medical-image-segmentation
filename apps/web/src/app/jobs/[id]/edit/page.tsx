"use client";

import { use } from "react";
import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobEditForm } from "@/components/jobs/job-edit-form";
import { useJob } from "@/lib/queries";

export default function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: job, isLoading, error, refetch } = useJob(id);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <Link
          href={`/jobs/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to job
        </Link>
        <h1 className="page-title mt-2">Edit job</h1>
      </div>
      <div className="animate-fade-in-up stagger-2">
        {isLoading ? (
          <Skeleton className="h-64 w-full max-w-2xl" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : job ? (
          <JobEditForm job={job} />
        ) : null}
      </div>
    </div>
  );
}
