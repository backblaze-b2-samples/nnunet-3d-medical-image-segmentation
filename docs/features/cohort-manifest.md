<!-- last_verified: 2026-08-17 -->
# Feature: Cohort manifest

## Purpose
A JSONL index mapping patient IDs → volume/mask keys + task metadata, written to
B2 by the seed. It makes the multi-site cohort browsable and downloadable from
object storage alone.

## Used By
- CLI: `pnpm run seed` (writes it)
- UI/API: browsable via the full-bucket Files explorer (`manifests/cohort.jsonl`)

## Core Functions
- `scripts/seed_b2.py::_upload_manifest`

## Inputs
- the per-case cohort rows assembled during seeding

## Outputs
- `manifests/cohort.jsonl` on B2 — one JSON object per line:
  `{patient_id, site, modality, volume_key, mask_key?, task}`

## Flow
- The seed assigns each synthetic case a site/modality/patient and uploads its volume
- After example masks are produced, the row gains a `mask_key`
- All rows are serialized to JSONL and uploaded under `manifests/`

## Edge Cases
- Re-seeding overwrites the manifest (single-writer, demo scale)
- A larger `--cases` preset produces a proportionally larger manifest

## Verification
- Manual: run `pnpm run seed`, then download `manifests/cohort.jsonl` from the Files explorer
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: the JSONL parses and each row references a real `volumes/` key

## Related Docs
- [segmentation.md](segmentation.md)
- [file-browser.md](file-browser.md)
