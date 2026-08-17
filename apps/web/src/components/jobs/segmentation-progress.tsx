"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import {
  SEGMENTATION_STAGES,
  segmentationProgress,
} from "@/lib/segmentation-progress";

/** How often the estimate advances — smooth enough for a ~15s bar. */
const TICK_MS = 250;

/**
 * Honest staged-progress panel for a running segmentation.
 *
 * It is mounted only while the run is in flight (the same running-state
 * detection that drives the spinner button and "Running" badge), so mounting
 * starts the clock and unmounting — on completion, on re-run, or on navigation —
 * resets it cleanly. There is no server-streamed progress, so this is an
 * elapsed-time estimate: a determinate bar paced to a typical CPU run, capped
 * below 100% until the server confirms completion, with stage labels that are
 * the REAL nnU-Net pipeline stages (see `@/lib/segmentation-progress`).
 */
export function SegmentationProgress() {
  // Starts at 0 on mount; the clock is read inside the effect (never during
  // render) and state is updated only from the interval callback.
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { percent, stageIndex, stageLabel } = segmentationProgress(elapsedMs);

  return (
    <div
      className="space-y-2 rounded-lg border border-border bg-muted/30 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2
          className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <span>{stageLabel}</span>
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          Step {stageIndex + 1} of {SEGMENTATION_STAGES.length}
        </span>
      </div>
      <Progress value={percent} aria-label={`Segmentation progress: ${stageLabel}`} />
      <p className="text-xs text-muted-foreground">
        Estimated progress — nnU-Net runs on CPU here, so a full segmentation
        takes several seconds.
      </p>
    </div>
  );
}
