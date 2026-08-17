"""Volumes explorer HTTP routes (sample-scoped, alongside the full-bucket Files).

`GET /volumes` lists ingested volumes; `GET /volumes/slice` renders one axial
slice to a PNG on the fly (volumes are not browser-previewable, so the server
always renders). Blocking B2 reads + imaging work run in the threadpool.
"""

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.service.volumes import VolumeError, list_volumes, render_slice_png
from app.types.volumes import VolumeSummary

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/volumes", response_model=list[VolumeSummary])
async def list_volumes_endpoint():
    return await run_in_threadpool(list_volumes)


@router.get(
    "/volumes/slice",
    responses={200: {"content": {"image/png": {}}}},
    response_class=Response,
)
async def volume_slice_endpoint(
    key: str = Query(..., description="Object key under volumes/ or masks/"),
    index: int | None = Query(None, description="Axial slice index; default mid-slice"),
):
    try:
        png = await run_in_threadpool(render_slice_png, key, index)
    except VolumeError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None
    return Response(content=png, media_type="image/png")
