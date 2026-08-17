<!-- last_verified: 2026-08-17 -->
# Feature: Segmentation (nnU-Net inference)

## Purpose
Run real `nnunetv2` inference on an ingested 3D volume and write a real NIfTI
segmentation mask to Backblaze B2. This is the sample's primary, headline
feature — never mocked.

## Used By
- UI: `/jobs/[id]` (Run segmentation), `/jobs` row Run button
- API: `POST /jobs/{job_id}/run`
- Job: synchronous inference in a threadpool (no separate worker)

## Core Functions
- `app/service/segmentation.py::segment_volume` — the nnU-Net engine
- `app/service/segmentation.py::ensure_model_available` — local cache or pull from B2
- `app/service/jobs.py::run_job` — orchestration + B2 writes
- `app/service/device.py::resolve_nnunet_device` — CUDA → MPS → CPU

## Canonical Files
- Engine: `services/api/app/service/segmentation.py`
- Device policy: `services/api/app/service/device.py`

## Inputs
- input_volume_key: str (a `volumes/` object selected on the job)
- modality: CT | MRI | Other (provenance)
- the trained checkpoint (local `.data/nnUNet_results/` cache, else pulled from `checkpoints/` on B2)

## Outputs
- `masks/<job_id>/segmentation.nii.gz` — the NIfTI mask (B2 write)
- `masks/<job_id>/overlay_XXX.png` — mid-slice overlays (B2 writes)
- job record updated: status `completed`, `metrics` (device, foreground voxels, per-label physical volume in mL)

## Flow
- Set job status `running`, persist `jobs/<id>.json`
- Pull the volume bytes from B2; load with nibabel/SimpleITK
- `ensure_model_available()` — use the cached checkpoint, or download + extract the tarball from B2
- `nnUNetPredictor.predict_from_files_sequential` on the auto-detected device
- Render overlays, compute per-label volumes, write mask + overlays to B2
- Set job status `completed`, persist

## Edge Cases
- No model locally or on B2 → `ModelUnavailableError` → job `failed` with a "run `pnpm run seed`" hint (POST returns 500 with the message, never an uncaught error)
- MPS preference → downgraded to CPU (nnU-Net 3D ops aren't MPS-complete), logged
- Any engine error → job `failed`, `error` recorded, artifacts not written
- Re-run allowed → overwrites the job's mask

## UX States
- Pending: input mid-slice preview, "Run segmentation" button
- Running: polling badge, disabled controls
- Completed: mask-overlay slice viewer + metrics
- Failed: destructive alert with the error

## Verification
- Test files: `services/api/tests/test_segmentation_domain.py` (hermetic), `services/api/live_tests/test_nnunet_roundtrip.py` (real)
- Focused verify command: `RUN_LIVE_NNUNET_TESTS=1 pnpm --dir services/api exec pytest live_tests/test_nnunet_roundtrip.py -m live`
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: real training mints `checkpoint_final.pth`; real inference yields a non-empty foreground mask

## Related Docs
- [model-checkpoints.md](model-checkpoints.md)
- [mask-preview.md](mask-preview.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
