"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Play, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./status-badge";
import { MaskOverlayViewer } from "./mask-overlay-viewer";
import { useDeleteJob, useRunJob } from "@/lib/queries";
import { volumeSliceUrl } from "@/lib/api-client";
import type { Job } from "@nnunet-3d-medical-image-segmentation/shared";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function JobDetail({ job }: { job: Job }) {
  const router = useRouter();
  const runJob = useRunJob();
  const deleteJob = useDeleteJob();
  const running = runJob.isPending || job.status === "running";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{job.name}</h1>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={running}
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
            <Play className="mr-1.5 h-4 w-4" />
            {running ? "Running..." : job.status === "completed" ? "Re-run" : "Run segmentation"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/jobs/${job.id}/edit`}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the job record and its mask artifacts under{" "}
                  <code>masks/{job.id}/</code>. The input volume is not touched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    deleteJob
                      .mutateAsync(job.id)
                      .then(() => {
                        toast.success("Job deleted");
                        router.push("/jobs");
                      })
                      .catch((e) =>
                        toast.error("Delete failed", {
                          description: e instanceof Error ? e.message : "Unknown error",
                        })
                      )
                  }
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {job.status === "failed" && job.error && (
        <Alert variant="destructive">
          <AlertTitle>Segmentation failed</AlertTitle>
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Modality" value={job.modality} />
              <Field label="Model" value={job.model} />
              <Field label="Site" value={job.site_id ?? "—"} />
              <Field label="Patient" value={job.patient_id ?? "—"} />
              <Field
                label="Input volume"
                value={
                  <span className="break-all font-mono text-xs">
                    {job.input_volume_key}
                  </span>
                }
              />
              <Field
                label="Mask"
                value={
                  job.mask_key ? (
                    <span className="break-all font-mono text-xs">{job.mask_key}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Tags"
                value={job.tags.length ? job.tags.join(", ") : "—"}
              />
              <Field label="Created" value={new Date(job.created_at).toLocaleString()} />
            </dl>
            {job.notes && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {job.notes}
              </p>
            )}
            {job.metrics && (
              <div className="mt-4 rounded-md border border-border p-3 text-sm">
                <p className="mb-1 font-medium">Metrics</p>
                <p className="text-muted-foreground">
                  Device: <span className="font-mono">{job.metrics.device}</span> ·
                  Foreground voxels:{" "}
                  <span className="font-mono">{job.metrics.foreground_voxels}</span>
                </p>
                {job.metrics.labels.map((l) => (
                  <p key={l.label} className="text-muted-foreground">
                    {l.name}: {l.voxels} voxels ({l.volume_ml} mL)
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">
              {job.status === "completed" ? "Mask overlay" : "Input preview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {job.status === "completed" && job.overlay_slice_keys.length > 0 ? (
              <MaskOverlayViewer jobId={job.id} count={job.overlay_slice_keys.length} />
            ) : (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-border bg-black/90">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={volumeSliceUrl(job.input_volume_key)}
                    alt="Input volume mid-slice"
                    className="aspect-square w-full max-w-md object-contain"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Mid-slice of the input volume. Run the segmentation to produce a
                  mask overlay.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
