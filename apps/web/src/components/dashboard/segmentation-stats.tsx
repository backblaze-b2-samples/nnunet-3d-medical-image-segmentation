"use client";

import { Boxes, Layers, CheckCircle2, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingNotice } from "@/components/common/loading-notice";
import { useJobStats } from "@/lib/queries";

export function SegmentationStats() {
  const { data: stats, isLoading, error, refetch } = useJobStats();

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { title: "Volumes", value: stats?.total_volumes ?? 0, icon: Boxes },
    { title: "Masks", value: stats?.total_masks ?? 0, icon: Layers },
    { title: "Jobs completed", value: stats?.completed_jobs ?? 0, icon: CheckCircle2 },
    {
      title: "Model on B2",
      value: stats?.checkpoints_bytes_human ?? "0 B",
      icon: HardDrive,
    },
  ];

  const artifacts = [
    { label: "Raw volumes", value: stats?.raw_bytes_human ?? "0 B" },
    { label: "Preprocessed", value: stats?.preprocessed_bytes_human ?? "0 B" },
    { label: "Masks", value: stats?.masks_bytes_human ?? "0 B" },
    { label: "Checkpoints", value: stats?.checkpoints_bytes_human ?? "0 B" },
  ];

  return (
    <div className="space-y-6">
      {isLoading && <LoadingNotice className="mb-3" subject="cohort stats" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card
            key={card.title}
            className={`card-hover animate-fade-in-up stagger-${i + 1}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className="stat-icon-wrap">
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-4">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="stat-value">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="animate-fade-in-up stagger-5">
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Storage by artifact type</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            One raw volume fans out into a preprocessed tensor, a segmentation
            mask, and a share of the multi-fold checkpoint — every artifact type
            archived on Backblaze B2.
          </p>
          <dl className="grid gap-4 sm:grid-cols-4">
            {artifacts.map((a) => (
              <div key={a.label} className="space-y-0.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {a.label}
                </dt>
                <dd className="font-mono text-sm tabular-nums">
                  {isLoading ? <Skeleton className="h-5 w-16" /> : a.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
