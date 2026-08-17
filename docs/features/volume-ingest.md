<!-- last_verified: 2026-08-17 -->
# Feature: Volume ingest

## Purpose
Upload a 3D imaging volume (NIfTI `.nii` / `.nii.gz`, or a zipped DICOM series)
directly to Backblaze B2 under the `volumes/` prefix, so it becomes selectable
as a segmentation-job input.

## Used By
- UI: `/upload` (Ingest volume), linked from `/volumes` and the create-job form
- API: `POST /upload/presign`, `POST /upload/verify`

## Core Functions
- `app/service/upload.py::create_presigned_upload` — validate + sign a PUT
- `app/service/upload.py::verify_upload` — inspect the stored object
- `app/repo/b2_upload.py::generate_presigned_upload`

## Inputs
- filename, content_type, size_bytes (declared before upload)
- the raw bytes (PUT directly to B2 — they never traverse the API)

## Outputs
- an object under `volumes/<filename>` (the seed writes a richer `volumes/<site>/<modality>/<patient>/` hierarchy)

## Flow
- Browser requests a presigned PUT; the API validates type/size and mints the key under `volumes/`
- Browser PUTs the bytes straight to B2 (lifts the serverless payload ceiling)
- Browser calls verify; the API HEADs the object and confirms it

## Edge Cases
- Empty `File.type` for `.nii.gz` → the client derives `application/gzip` (`resolveUploadContentType`)
- Oversize (> 512 MB) or disallowed type → rejected at presign
- Volumes are not browser-previewable → the Volumes view renders a server-side mid-slice PNG

## UX States
- Empty: dropzone
- Uploading: per-file progress
- Error: named cause (offline, CORS on a deployed origin, type/size)

## Verification
- Test files: `services/api/tests/test_upload_validation.py`, `apps/web/src/lib/upload-file-types.test.ts`
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: a `.nii.gz` PUT lands under `volumes/` and appears in `GET /volumes`

## Related Docs
- [mask-preview.md](mask-preview.md)
- [file-browser.md](file-browser.md)
