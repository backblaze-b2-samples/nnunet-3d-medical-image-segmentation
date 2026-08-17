export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  /** Set when a format-specific extractor was skipped or failed (e.g. an image
   *  above the decompression-bomb decode limit). Core fields stay exact. */
  metadata_warning: string | null;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

/** A short-lived presigned PUT the browser uploads a file directly to B2 with.
 *  `headers` are signed into the URL, so the browser must send them verbatim. */
export interface PresignUploadResponse {
  key: string;
  url: string;
  method: string;
  content_type: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- nnU-Net Segmentation domain ------------------------------------------

export type JobStatus = "pending" | "running" | "completed" | "failed";
export type Modality = "CT" | "MRI" | "Other";

export interface ModelInfo {
  key: string;
  name: string;
  description: string;
}

// Finite, selectable models — mirror services/api/app/types/jobs.py
// SEGMENTATION_MODELS. The create form renders these as a Select.
export const SEGMENTATION_MODELS: ModelInfo[] = [
  {
    key: "demo-lesion",
    name: "Demo Lesion (synthetic)",
    description:
      "Single-lesion 3D segmentation trained by `pnpm run seed` on tiny synthetic volumes.",
  },
];

export const MODALITIES: Modality[] = ["CT", "MRI", "Other"];

export interface LabelVolume {
  label: number;
  name: string;
  voxels: number;
  volume_ml: number;
}

export interface JobMetrics {
  device: string;
  foreground_voxels: number;
  labels: LabelVolume[];
  spacing: number[] | null;
  shape: number[] | null;
}

export interface JobSummary {
  id: string;
  name: string;
  input_volume_key: string;
  modality: Modality;
  model: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  site_id: string | null;
  patient_id: string | null;
  tags: string[];
  thumbnail_key: string | null;
  error: string | null;
}

export interface Job extends JobSummary {
  notes: string | null;
  mask_key: string | null;
  overlay_slice_keys: string[];
  metrics: JobMetrics | null;
}

export interface JobStats {
  total_jobs: number;
  completed_jobs: number;
  total_volumes: number;
  total_masks: number;
  raw_bytes: number;
  preprocessed_bytes: number;
  masks_bytes: number;
  checkpoints_bytes: number;
  raw_bytes_human: string;
  preprocessed_bytes_human: string;
  masks_bytes_human: string;
  checkpoints_bytes_human: string;
}

export interface VolumeSummary {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  site: string | null;
  modality: string | null;
  patient: string | null;
}
