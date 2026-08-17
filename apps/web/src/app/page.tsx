import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentationStats } from "@/components/dashboard/segmentation-stats";
import { RecentJobs } from "@/components/dashboard/recent-jobs";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            nnU-Net 3D segmentation cohort, archived on Backblaze B2.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/jobs/new">
            <Plus className="h-3.5 w-3.5" />
            New segmentation
          </Link>
        </Button>
      </div>
      <SegmentationStats />
      <div className="animate-fade-in-up stagger-4">
        <RecentJobs />
      </div>
    </div>
  );
}
