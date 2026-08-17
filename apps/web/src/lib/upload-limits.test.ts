import { describe, expect, it } from "vitest";

import { humanizeBytes } from "./utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "./upload-limits";

describe("upload limits", () => {
  it("caps client uploads at the backend max_file_size (512 * 1024 * 1024)", () => {
    // Must match services/api/app/config/settings.py `max_file_size` so the UI
    // never rejects a volume the API would accept.
    expect(MAX_UPLOAD_BYTES).toBe(512 * 1024 * 1024);
  });

  it("labels the cap in the same unit humanizeBytes renders, so limit and size never disagree", () => {
    expect(MAX_UPLOAD_LABEL).toBe(humanizeBytes(MAX_UPLOAD_BYTES));
    expect(MAX_UPLOAD_LABEL).toBe("512.0 MB");
  });
});
