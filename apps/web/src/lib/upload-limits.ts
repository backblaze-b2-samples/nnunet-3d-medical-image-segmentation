import { humanizeBytes } from "@/lib/utils";

/**
 * Client-side upload cap. Single source of truth for the dropzone and the
 * upload queue. Mirrors the backend `max_file_size`
 * (`services/api/app/config/settings.py` — `512 * 1024 * 1024`). The server
 * re-validates every upload; this cap only gives instant client-side feedback.
 * 3D CT/MRI volumes routinely exceed 100 MB, so the cap must match the backend.
 * Keep the two in sync.
 */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/**
 * Human-readable cap, rendered with the same 1024-based unit `humanizeBytes`
 * uses everywhere else in the UI. Deriving the label from the same constant and
 * the same formatter means the limit label and any humanized file size always
 * agree (no MiB-vs-MB drift) and match the backend's "Max size: …" error text.
 */
export const MAX_UPLOAD_LABEL = humanizeBytes(MAX_UPLOAD_BYTES);
