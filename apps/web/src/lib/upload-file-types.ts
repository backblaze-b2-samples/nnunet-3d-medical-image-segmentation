/**
 * Client-side allow-list for the dropzone, mirroring the backend's
 * `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` in
 * `services/api/app/service/upload.py`. The server re-validates every upload —
 * this only gives instant feedback and filters the OS file picker. Keep the two
 * in sync when adding or removing a type.
 *
 * Shape matches react-dropzone's `accept`: MIME type → matching extensions.
 */
export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg", ".jfif"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".text", ".log", ".md"],
  "text/csv": [".csv"],
  "application/json": [".json"],
  "application/zip": [".zip"],
  "video/mp4": [".mp4"],
  "audio/mpeg": [".mp3", ".mpeg"],
  "audio/wav": [".wav"],
  "text/markdown": [".md", ".markdown"],
  "application/yaml": [".yaml", ".yml"],
  "application/x-yaml": [".yaml", ".yml"],
  "application/x-ndjson": [".jsonl", ".ndjson"],
  "text/tab-separated-values": [".tsv"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  // 3D imaging volumes for nnU-Net ingest.
  "application/gzip": [".gz", ".nii.gz"],
  "application/x-gzip": [".gz", ".nii.gz"],
  "application/octet-stream": [".nii", ".dcm"],
};

/**
 * Resolve the content type to declare in a presign. Browsers frequently report
 * an empty `File.type` for `.nii.gz` / `.nii` / `.dcm`, which the server's
 * allow-list would reject — fall back to an extension-derived type so volume
 * ingest works. The server re-validates.
 */
export function resolveUploadContentType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".nii.gz") || name.endsWith(".gz")) return "application/gzip";
  if (name.endsWith(".nii") || name.endsWith(".dcm")) return "application/octet-stream";
  if (name.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}
