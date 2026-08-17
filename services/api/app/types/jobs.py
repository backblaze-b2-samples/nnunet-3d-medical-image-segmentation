"""Domain models for Segmentation Jobs — the primary entity.

A Segmentation Job is the record of one nnU-Net inference on one ingested
volume. Its canonical form is the `jobs/<id>.json` object stored in B2; these
Pydantic models are the (de)serialization contract for it and for the HTTP API.

Import-safe: no heavy scientific stack (torch, nnunetv2, nibabel). Those live
only inside functions in `service/segmentation.py` and `service/training.py`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Lifecycle. A job starts `pending` (record created, not yet run) ->
# `running` (nnU-Net inference in progress) -> `completed` (mask + overlays
# written) | `failed` (`error` explains).
JobStatus = Literal["pending", "running", "completed", "failed"]

# Finite, selectable modality — rendered as a Select in the create/edit forms.
Modality = Literal["CT", "MRI", "Other"]

# Max evenly-spaced axial overlay slices rendered per completed job.
MAX_PREVIEW_SLICES = 12


class ModelInfo(BaseModel):
    key: str
    name: str
    description: str


# Finite, selectable models. The default is the synthetic demo task the seed
# trains. Add real nnU-Net tasks here as they are archived to B2 — the create
# form renders this as a Select. Keep in sync with
# `packages/shared/src/types.ts` SEGMENTATION_MODELS.
SEGMENTATION_MODELS: dict[str, ModelInfo] = {
    "demo-lesion": ModelInfo(
        key="demo-lesion",
        name="Demo Lesion (synthetic)",
        description="Single-lesion 3D segmentation trained by `pnpm run seed` "
        "on tiny synthetic volumes. Runs on CPU in seconds.",
    ),
}

DEFAULT_MODEL = "demo-lesion"
DEFAULT_MODALITY: Modality = "CT"


class LabelVolume(BaseModel):
    """Physical volume of one segmented label."""

    label: int
    name: str
    voxels: int
    volume_ml: float


class JobMetrics(BaseModel):
    """Quantitative outcome of one completed inference run."""

    device: str
    foreground_voxels: int
    labels: list[LabelVolume] = Field(default_factory=list)
    spacing: list[float] | None = None
    shape: list[int] | None = None


class JobCreate(BaseModel):
    """Form fields for creating a job. Inputs are immutable once set."""

    name: str = Field(min_length=1, max_length=120)
    input_volume_key: str = Field(min_length=1)
    modality: Modality = DEFAULT_MODALITY
    model: str = DEFAULT_MODEL
    site_id: str | None = Field(default=None, max_length=120)
    patient_id: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list)


class JobUpdate(BaseModel):
    """Editable metadata ONLY. Inputs (volume/model/modality) are immutable by
    design — a job records one inference on one volume; to change the input,
    create a new job. All fields optional; only provided ones change."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = None


class JobSummary(BaseModel):
    """Compact record for the Segmentations table (one per jobs/<id>.json)."""

    id: str
    name: str
    input_volume_key: str
    modality: Modality
    model: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    site_id: str | None = None
    patient_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    thumbnail_key: str | None = None
    error: str | None = None


class Job(JobSummary):
    """Full record — the source of truth persisted as `jobs/<id>.json`."""

    notes: str | None = None
    mask_key: str | None = None
    overlay_slice_keys: list[str] = Field(default_factory=list)
    metrics: JobMetrics | None = None


class JobStats(BaseModel):
    """Dashboard aggregates over the sample's prefixes."""

    total_jobs: int
    completed_jobs: int
    total_volumes: int
    total_masks: int
    # Storage by artifact type — surfaces the write-amplification story.
    raw_bytes: int
    preprocessed_bytes: int
    masks_bytes: int
    checkpoints_bytes: int
    raw_bytes_human: str
    preprocessed_bytes_human: str
    masks_bytes_human: str
    checkpoints_bytes_human: str
