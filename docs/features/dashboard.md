<!-- last_verified: 2026-08-17 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of the segmentation cohort: volumes, masks, jobs
completed, and storage by artifact type (the write-amplification story).

## Used By
- UI: `/` page (dashboard home)
- API: `GET /jobs/stats`, `GET /jobs`

## Core Functions
- `apps/web/src/components/dashboard/segmentation-stats.tsx` — stat cards + storage-by-artifact breakdown
- `apps/web/src/components/dashboard/recent-jobs.tsx` — the most recent segmentation jobs
- `services/api/app/service/jobs.py::get_job_stats` — aggregates over the sample's prefixes
- `apps/web/src/lib/queries.ts` — `useJobStats()`, `useJobs()`

## Canonical Files
- Dashboard page: `apps/web/src/app/page.tsx`
- Stats service logic: `services/api/app/service/jobs.py`

## Inputs
- None (loads automatically)

## Outputs
- `GET /jobs/stats` → `JobStats` (total_volumes, total_masks, completed_jobs, and per-artifact byte totals: raw/preprocessed/masks/checkpoints)
- `GET /jobs` → `JobSummary[]` for the recent-jobs table

## Flow
- Page loads → `useJobStats()` and `useJobs()` fire
- Stat cards show volumes, masks, jobs completed, and the model size on B2
- A "Storage by artifact type" card breaks down raw / preprocessed / masks / checkpoints bytes
- The recent-segmentations table lists the newest jobs with a Run action

## Edge Cases
- API unavailable → inline error state with retry
- No jobs/volumes yet → empty states pointing at `pnpm run seed` / New job
- A running job → the tables/badges poll every ~2.5s until it settles

## UX States
- Loading: skeletons + a loading notice while the prefix listings run
- Empty: "No segmentation jobs yet"
- Loaded: populated cards, breakdown, and recent-jobs table

## Verification
- Test files: `services/api/tests/test_segmentation_domain.py`
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: stats aggregate correctly and the dashboard renders them

## Related Docs
- [segmentation.md](segmentation.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
