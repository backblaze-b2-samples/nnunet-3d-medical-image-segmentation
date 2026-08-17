"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Play, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { useRunJob } from "@/lib/queries";
import type { JobSummary } from "@nnunet-3d-medical-image-segmentation/shared";

function RunButton({ job }: { job: JobSummary }) {
  const runJob = useRunJob();
  const busy = runJob.isPending || job.status === "running";
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        runJob
          .mutateAsync(job.id)
          .then(() => toast.success("Segmentation complete"))
          .catch((e) =>
            toast.error("Run failed", {
              description: e instanceof Error ? e.message : "Unknown error",
            })
          )
      }
    >
      {busy ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Play className="mr-1 h-3.5 w-3.5" />
      )}
      {busy ? "Running" : job.status === "completed" ? "Re-run" : "Run"}
    </Button>
  );
}

export function JobTable({ jobs }: { jobs: JobSummary[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>Modality</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">
                <Link href={`/jobs/${job.id}`} className="hover:underline">
                  {job.name}
                </Link>
              </TableCell>
              <TableCell className="max-w-[240px] truncate font-mono text-xs text-muted-foreground">
                {job.input_volume_key.replace(/^volumes\//, "")}
              </TableCell>
              <TableCell>{job.modality}</TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <RunButton job={job} />
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/jobs/${job.id}`}>View</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
