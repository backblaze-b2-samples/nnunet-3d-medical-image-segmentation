import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@nnunet-3d-medical-image-segmentation/shared";

const LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

const CLASSES: Record<JobStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant="secondary" className={CLASSES[status]}>
      {status === "running" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {LABELS[status]}
    </Badge>
  );
}
