"""Segmentation Job CRUD + nnU-Net run orchestration over B2.

The `jobs/<id>.json` object IS the record — B2 is the store, no database. This
layer validates input, persists the job record, and is the ONLY place that
composes repo I/O with the nnU-Net engine. Heavy work is delegated to
`service.segmentation` (lazy torch/nnunetv2).

Single-writer caveat (documented in ARCHITECTURE.md): B2 has no conditional PUT,
so concurrent writers to the same job could clobber each other. Fine at the
single-user demo scale this sample targets.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, datetime

from app.repo import (
    delete_file,
    delete_prefix,
    get_object_bytes,
    get_presigned_url,
    list_prefix_objects,
    put_bytes,
)
from app.service.segmentation import ModelUnavailableError, segment_volume
from app.service.volumes import (
    MASKS_PREFIX,
    VOLUMES_PREFIX,
    detect_source_format,
)
from app.types.formatting import humanize_bytes
from app.types.jobs import (
    SEGMENTATION_MODELS,
    Job,
    JobCreate,
    JobMetrics,
    JobStats,
    JobSummary,
    JobUpdate,
    LabelVolume,
)

logger = logging.getLogger(__name__)

JOBS_PREFIX = "jobs/"
PREPROCESSED_PREFIX = "preprocessed/"
CHECKPOINTS_PREFIX = "checkpoints/"
_ID_RE = re.compile(r"^[a-f0-9]{12,40}$")


class JobValidationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class JobNotFoundError(Exception):
    def __init__(self, detail: str = "Job not found"):
        self.detail = detail
        super().__init__(detail)


class JobProcessingError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _job_key(job_id: str) -> str:
    return f"{JOBS_PREFIX}{job_id}.json"


def _validate_id(job_id: str) -> None:
    if not _ID_RE.fullmatch(job_id or ""):
        raise JobNotFoundError()


def _persist(job: Job) -> Job:
    put_bytes(_job_key(job.id), job.model_dump_json().encode("utf-8"), "application/json")
    return job


def create_job(payload: JobCreate) -> Job:
    if payload.model not in SEGMENTATION_MODELS:
        raise JobValidationError(
            f"Unknown model. Choose one of {list(SEGMENTATION_MODELS)}"
        )
    if not payload.input_volume_key.startswith(VOLUMES_PREFIX):
        raise JobValidationError(
            f"input_volume_key must be an ingested volume under '{VOLUMES_PREFIX}'"
        )
    try:
        detect_source_format(payload.input_volume_key)
    except Exception as e:
        raise JobValidationError(str(e)) from None

    job_id = uuid.uuid4().hex
    now = datetime.now(UTC)
    job = Job(
        id=job_id,
        name=payload.name,
        input_volume_key=payload.input_volume_key,
        modality=payload.modality,
        model=payload.model,
        status="pending",
        created_at=now,
        updated_at=now,
        site_id=payload.site_id,
        patient_id=payload.patient_id,
        notes=payload.notes,
        tags=payload.tags,
    )
    logger.info("Job created: id=%s volume=%s", job_id, payload.input_volume_key)
    return _persist(job)


def list_jobs() -> list[JobSummary]:
    summaries: list[JobSummary] = []
    for obj in list_prefix_objects(JOBS_PREFIX):
        if not obj["Key"].endswith(".json"):
            continue
        try:
            summaries.append(JobSummary.model_validate_json(get_object_bytes(obj["Key"])))
        except Exception:
            logger.warning("Skipping unreadable job record: %s", obj["Key"])
    summaries.sort(key=lambda j: j.created_at, reverse=True)
    return summaries


def get_job(job_id: str) -> Job:
    _validate_id(job_id)
    try:
        data = get_object_bytes(_job_key(job_id))
    except RuntimeError as e:
        raise JobNotFoundError() from e
    return Job.model_validate_json(data)


def update_job(job_id: str, patch: JobUpdate) -> Job:
    """Metadata-only edit (name/notes/tags). Inputs are immutable by design."""
    job = get_job(job_id)
    if patch.name is not None:
        job.name = patch.name
    if patch.notes is not None:
        job.notes = patch.notes
    if patch.tags is not None:
        job.tags = patch.tags
    job.updated_at = datetime.now(UTC)
    return _persist(job)


def delete_job(job_id: str) -> None:
    """Delete the job record + its scoped mask artifacts. Never bucket-wide."""
    _validate_id(job_id)
    delete_file(_job_key(job_id))
    deleted = delete_prefix(f"{MASKS_PREFIX}{job_id}/")
    logger.info("Job deleted: id=%s mask_objects=%d", job_id, deleted)


def run_job(job_id: str) -> Job:
    """Run real nnU-Net inference for a job and persist the derived artifacts."""
    job = get_job(job_id)
    job.status = "running"
    job.updated_at = datetime.now(UTC)
    job.error = None
    _persist(job)

    try:
        source = get_object_bytes(job.input_volume_key)
        source_format = detect_source_format(job.input_volume_key)
        result = segment_volume(source, source_format, job.modality)

        base = f"{MASKS_PREFIX}{job_id}"
        mask_key = f"{base}/segmentation.nii.gz"
        put_bytes(mask_key, result.mask_nifti, "application/gzip")
        overlay_keys: list[str] = []
        for index, png in enumerate(result.overlay_pngs):
            key = f"{base}/overlay_{index:03d}.png"
            put_bytes(key, png, "image/png")
            overlay_keys.append(key)

        job.status = "completed"
        job.mask_key = mask_key
        job.overlay_slice_keys = overlay_keys
        job.thumbnail_key = overlay_keys[len(overlay_keys) // 2] if overlay_keys else None
        job.metrics = JobMetrics(
            device=result.device,
            foreground_voxels=result.foreground_voxels,
            labels=[LabelVolume(**label) for label in result.labels],
            spacing=result.spacing,
            shape=result.shape,
        )
        job.updated_at = datetime.now(UTC)
        logger.info("Job completed: id=%s device=%s", job_id, result.device)
        return _persist(job)
    except ModelUnavailableError as e:
        return _fail(job, str(e))
    except Exception as e:  # record any engine failure on the job, never leak a 500
        logger.exception("Job failed: id=%s", job_id)
        return _fail(job, str(e), reraise=JobProcessingError(str(e)))


def _fail(job: Job, message: str, reraise: Exception | None = None) -> Job:
    job.status = "failed"
    job.error = message
    job.updated_at = datetime.now(UTC)
    _persist(job)
    if reraise is not None:
        raise reraise
    raise JobProcessingError(message)


def get_overlay_url(job_id: str, index: int) -> str:
    job = get_job(job_id)
    if index < 0 or index >= len(job.overlay_slice_keys):
        raise JobNotFoundError("Overlay slice index out of range")
    return get_presigned_url(job.overlay_slice_keys[index], disposition="inline")


def _prefix_bytes(objects: list[dict], prefix: str) -> int:
    return sum(o["Size"] for o in objects if o["Key"].startswith(prefix))


def get_job_stats() -> JobStats:
    summaries = list_jobs()
    volumes = list_prefix_objects(VOLUMES_PREFIX)
    masks = list_prefix_objects(MASKS_PREFIX)
    preprocessed = list_prefix_objects(PREPROCESSED_PREFIX)
    checkpoints = list_prefix_objects(CHECKPOINTS_PREFIX)

    raw_bytes = sum(o["Size"] for o in volumes)
    pre_bytes = sum(o["Size"] for o in preprocessed)
    masks_bytes = sum(o["Size"] for o in masks)
    ck_bytes = sum(o["Size"] for o in checkpoints)
    return JobStats(
        total_jobs=len(summaries),
        completed_jobs=sum(1 for j in summaries if j.status == "completed"),
        total_volumes=sum(
            1 for o in volumes if o["Key"].lower().endswith((".nii", ".nii.gz", ".zip"))
        ),
        total_masks=sum(1 for o in masks if o["Key"].endswith(".nii.gz")),
        raw_bytes=raw_bytes,
        preprocessed_bytes=pre_bytes,
        masks_bytes=masks_bytes,
        checkpoints_bytes=ck_bytes,
        raw_bytes_human=humanize_bytes(raw_bytes),
        preprocessed_bytes_human=humanize_bytes(pre_bytes),
        masks_bytes_human=humanize_bytes(masks_bytes),
        checkpoints_bytes_human=humanize_bytes(ck_bytes),
    )
