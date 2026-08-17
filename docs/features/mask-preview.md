<!-- last_verified: 2026-08-17 -->
# Feature: Mid-slice mask-overlay preview

## Purpose
Volumes are not browser-native, so the server renders an axial mid-slice PNG —
of the raw volume, and (for completed jobs) with the segmentation mask overlaid.
This is the money screenshot.

## Used By
- UI: `/volumes` thumbnails, `/jobs/[id]` overlay viewer
- API: `GET /volumes/slice?key=...&index=...` (streamed PNG), `GET /jobs/{id}/slices/{index}` (presigned overlay URL)

## Core Functions
- `app/service/rendering.py::volume_slice_png`, `overlay_slice_png`
- `app/service/volumes.py::render_slice_png`
- `app/service/jobs.py::get_overlay_url`

## Inputs
- a `volumes/` or `masks/` object key; optional slice index (default mid-slice)

## Outputs
- a PNG image (streamed for volumes, presigned inline for job overlays)

## Flow
- Volume thumbnail: `GET /volumes/slice` loads the volume, renders one axial slice, streams PNG
- Job overlay: the run wrote colored overlay PNGs to `masks/<id>/`; the viewer steps through them via presigned inline URLs

## Edge Cases
- Unknown/unsupported key → 400/404
- Overlay index out of range → 404
- Only `volumes/` and `masks/` keys are renderable (scoped)

## Verification
- Test files: `services/api/tests/test_segmentation_domain.py` (renders a PNG)
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: the endpoints return valid PNG bytes / a presigned URL

## Related Docs
- [segmentation.md](segmentation.md)
- [volume-ingest.md](volume-ingest.md)
