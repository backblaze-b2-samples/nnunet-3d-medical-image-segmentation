/**
 * Honest, elapsed-time-driven progress estimate for a running segmentation.
 *
 * A single segmentation is one synchronous request — the backend does not stream
 * progress — so the frontend cannot report a true completion percentage. What it
 * CAN do honestly: name the real nnU-Net pipeline stages, in order, and advance a
 * determinate bar against a typical run duration, capped below 100% so the bar
 * never claims a completion the server has not confirmed.
 *
 * The stage labels mirror `segment_volume` in
 * `services/api/app/service/segmentation.py`, in execution order:
 *   1. `ensure_model_available()` — resolve / pull the trained checkpoint (B2)
 *   2. `load_volume` + `_write_input_nifti` — load and preprocess the volume
 *   3. `nnUNetPredictor` inference (`_predict`)
 *   4. `render_overlay_previews` + `_label_volumes` — mask + overlay render
 *
 * Pure on purpose (a component owns the clock) so the stages, pacing, and cap are
 * unit-testable.
 */

/**
 * Typical CPU run duration used to pace the estimate. Observed runs are ~13s on
 * CPU; a slightly higher default keeps the bar from parking at the cap before a
 * nominal run finishes. Tune here.
 */
export const SEGMENTATION_ESTIMATE_MS = 15_000;

/**
 * The bar holds here until the job reaches a terminal state. It is an estimate,
 * not a live signal, so it must never claim 100% before the server confirms
 * completion — the completed UI (mask overlay + metrics) is the real "done".
 */
export const SEGMENTATION_PROGRESS_CAP = 92;

/**
 * The real nnU-Net pipeline stages, in execution order. `weight` is each stage's
 * share of the estimated duration (weights sum to 1); inference dominates, as it
 * does in the actual run.
 */
export const SEGMENTATION_STAGES = [
  { label: "Resolving model checkpoint", weight: 0.15 },
  { label: "Preprocessing volume", weight: 0.15 },
  { label: "Running inference", weight: 0.5 },
  { label: "Rendering mask & overlays", weight: 0.2 },
] as const;

export interface SegmentationProgressState {
  /** 0–SEGMENTATION_PROGRESS_CAP while the run is in flight. */
  percent: number;
  /** Index into SEGMENTATION_STAGES. */
  stageIndex: number;
  /** The current real pipeline stage label. */
  stageLabel: string;
}

/**
 * Estimated progress for a run that has been in flight `elapsedMs`.
 *
 * The bar advances linearly with elapsed time and parks at
 * `SEGMENTATION_PROGRESS_CAP`. The stage label is driven by the *un-capped*
 * fraction against the cumulative stage weights, so the label keeps advancing
 * through the final stage even after the bar has reached the cap.
 */
export function segmentationProgress(elapsedMs: number): SegmentationProgressState {
  const elapsed = Math.max(0, elapsedMs);
  const rawFraction = elapsed / SEGMENTATION_ESTIMATE_MS;
  const percent = Math.min(rawFraction, SEGMENTATION_PROGRESS_CAP / 100) * 100;

  const fractionForStage = Math.min(rawFraction, 0.999);
  let cumulative = 0;
  let stageIndex = SEGMENTATION_STAGES.length - 1;
  for (let i = 0; i < SEGMENTATION_STAGES.length; i++) {
    cumulative += SEGMENTATION_STAGES[i].weight;
    if (fractionForStage < cumulative) {
      stageIndex = i;
      break;
    }
  }

  return { percent, stageIndex, stageLabel: SEGMENTATION_STAGES[stageIndex].label };
}
