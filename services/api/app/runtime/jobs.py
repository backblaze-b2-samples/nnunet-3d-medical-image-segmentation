"""Segmentation Job lifecycle HTTP routes.

Handlers stay thin: they translate service exceptions into HTTP status codes and
offload blocking work (B2 I/O and the heavy nnU-Net run) to Starlette's
threadpool so a slow inference never stalls the event loop.

SECURITY: these routes are intentionally UNAUTHENTICATED and single-tenant (see
docs/SECURITY.md). Deletes are scoped to one job's prefixes, but there is no
per-user isolation — a multi-tenant clone must add auth AND scope jobs to the
caller. Do not point this at real PHI without both.
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.service.jobs import (
    JobNotFoundError,
    JobProcessingError,
    JobValidationError,
    create_job,
    delete_job,
    get_job,
    get_job_stats,
    get_overlay_url,
    list_jobs,
    run_job,
    update_job,
)
from app.types.jobs import Job, JobCreate, JobStats, JobSummary, JobUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/jobs", response_model=list[JobSummary])
def list_jobs_endpoint():
    return list_jobs()


@router.post("/jobs", response_model=Job, status_code=201)
def create_job_endpoint(body: JobCreate):
    try:
        return create_job(body)
    except JobValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to write job to storage") from None


@router.get("/jobs/stats", response_model=JobStats)
def job_stats_endpoint():
    return get_job_stats()


@router.get("/jobs/{job_id}", response_model=Job)
def get_job_endpoint(job_id: str):
    try:
        return get_job(job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.patch("/jobs/{job_id}", response_model=Job)
def update_job_endpoint(job_id: str, body: JobUpdate):
    try:
        return update_job(job_id, body)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except JobValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None


@router.delete("/jobs/{job_id}")
def delete_job_endpoint(job_id: str):
    try:
        delete_job(job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to delete job") from None
    return {"deleted": True, "id": job_id}


@router.post("/jobs/{job_id}/run", response_model=Job)
async def run_job_endpoint(job_id: str):
    try:
        # Long-running (CPU inference + B2 writes): keep it off the loop.
        return await run_in_threadpool(run_job, job_id)
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except JobProcessingError as e:
        raise HTTPException(status_code=500, detail=e.detail) from None


@router.get("/jobs/{job_id}/slices/{index}")
def job_slice_endpoint(job_id: str, index: int):
    try:
        return {"url": get_overlay_url(job_id, index)}
    except JobNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
