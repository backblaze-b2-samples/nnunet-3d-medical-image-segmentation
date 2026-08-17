"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobTable } from "@/components/jobs/job-table";
import { useJobs } from "@/lib/queries";

export function RecentJobs() {
  const { data: jobs, isLoading } = useJobs();
  const recent = (jobs ?? []).slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent segmentations</CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link href="/jobs">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No segmentation jobs yet"
            description="Create one from an ingested volume, or run `pnpm run seed`."
            action={
              <Button asChild size="sm">
                <Link href="/jobs/new">New job</Link>
              </Button>
            }
          />
        ) : (
          <JobTable jobs={recent} />
        )}
      </CardContent>
    </Card>
  );
}
