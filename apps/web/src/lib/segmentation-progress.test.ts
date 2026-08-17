import { describe, expect, it } from "vitest";

import {
  SEGMENTATION_ESTIMATE_MS,
  SEGMENTATION_PROGRESS_CAP,
  SEGMENTATION_STAGES,
  segmentationProgress,
} from "./segmentation-progress";

describe("SEGMENTATION_STAGES", () => {
  it("names the real nnU-Net pipeline stages in execution order", () => {
    expect(SEGMENTATION_STAGES.map((s) => s.label)).toEqual([
      "Resolving model checkpoint",
      "Preprocessing volume",
      "Running inference",
      "Rendering mask & overlays",
    ]);
  });

  it("has stage weights that sum to 1 (they partition the estimate)", () => {
    const total = SEGMENTATION_STAGES.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("segmentationProgress", () => {
  it("starts at 0% on the first pipeline stage", () => {
    expect(segmentationProgress(0)).toEqual({
      percent: 0,
      stageIndex: 0,
      stageLabel: "Resolving model checkpoint",
    });
  });

  it("advances the bar as the wait grows (determinate, not a spinner)", () => {
    const early = segmentationProgress(1_000).percent;
    const later = segmentationProgress(5_000).percent;
    expect(later).toBeGreaterThan(early);
  });

  it("steps through every stage in order as time passes", () => {
    const stageAt = (ms: number) => segmentationProgress(ms).stageIndex;
    expect(stageAt(0)).toBe(0);
    // The four stages must each be reached at some point during the estimate.
    const reached = new Set<number>();
    for (let ms = 0; ms <= SEGMENTATION_ESTIMATE_MS; ms += 100) {
      reached.add(stageAt(ms));
    }
    expect([...reached].sort()).toEqual([0, 1, 2, 3]);
  });

  it("caps the bar below 100% no matter how long the wait runs", () => {
    for (const ms of [SEGMENTATION_ESTIMATE_MS, SEGMENTATION_ESTIMATE_MS * 3, 300_000]) {
      const { percent } = segmentationProgress(ms);
      expect(percent).toBeLessThanOrEqual(SEGMENTATION_PROGRESS_CAP);
      expect(percent).toBe(SEGMENTATION_PROGRESS_CAP);
    }
  });

  it("never reports a negative elapsed as anything but the start", () => {
    expect(segmentationProgress(-5_000)).toEqual({
      percent: 0,
      stageIndex: 0,
      stageLabel: "Resolving model checkpoint",
    });
  });

  it("keeps the final stage label past the cap while the bar holds", () => {
    // Well beyond the estimate the bar is parked, but the label reads the last,
    // real stage rather than resetting.
    expect(segmentationProgress(SEGMENTATION_ESTIMATE_MS * 2).stageLabel).toBe(
      "Rendering mask & overlays",
    );
  });
});
