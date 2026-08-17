import { describe, expect, it } from "vitest";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";

describe("app identity", () => {
  it("ships the canonical app name and description", () => {
    expect(APP_NAME).toBe("nnU-Net 3D Medical Image Segmentation");
    expect(APP_DESCRIPTION).toBe(
      "Automatic 3D CT/MRI segmentation with nnU-Net, archived on Backblaze B2"
    );
  });
});
