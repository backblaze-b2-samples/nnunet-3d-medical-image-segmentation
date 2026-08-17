<!-- last_verified: 2026-08-06 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard: volumes, masks, jobs completed, storage by artifact type
  - Segmentations (`/jobs`): full lifecycle (create/read/edit/delete/run) + mask-overlay preview
  - Volumes (`/volumes`): sample-scoped explorer with server-rendered thumbnails
  - Files (`/files`): the kept full-bucket explorer
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - REST API for jobs, volumes, ingest, listing, deletion
  - **nnU-Net v2 (`nnunetv2`) + torch** segmentation engine — contained in `service/`
  - B2 S3 integration via boto3 — contained in `repo/`
  - Server-side mid-slice rendering (nibabel/pydicom/Pillow)
  - Health check, structured JSON logging, Prometheus metrics
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models (Job, JobStats, VolumeSummary, …)
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Authored Python files under `services/api/app/` stay under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (FileMetadata, UploadStats, etc.)
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic (upload, files, metadata)
    runtime/               FastAPI route handlers
  tests/                   pytest tests (structural + integration)
```

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No cross-layer mutable state**: Configuration is read-only after init, and no mutable state is shared *between* layers. Intra-layer caches/counters (the listing cache in `repo/list_cache.py`, the B2 connectivity cache in `repo/b2_client.py`, the download counter in `repo/counter.py`, the rate-limit and metrics state in `runtime/`) are module-local and guarded by a `threading.Lock`. The listing cache also owns the only background thread in the app: a stale entry is served immediately while that thread re-scans (stale-while-revalidate), and `main.lifespan` warms it once at startup so no user pays for the cold full-bucket scan.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys reject empty and path-traversal patterns; optional prefix confinement via `ALLOWED_KEY_PREFIX` (off by default).

## nnU-Net segmentation engine

- **Engine containment.** All torch / `nnunetv2` imports live only in
  `service/segmentation.py`, `service/training.py`, and `service/device.py`, and
  are done **lazily inside functions** so the FastAPI app and pytest collection
  load without the ML stack. A structural test
  (`tests/test_structure.py::test_nnunet_engine_contained_in_service`) enforces
  that `repo/`, `runtime/`, `types/`, and `config/` never import the engine —
  the mirror of the boto3-only-in-`repo/` rule.
- **Real, not mocked.** `segment_volume` runs a genuine `nnUNetPredictor`; there
  is no thresholding/mock fallback. A missing model fails the run.
- **The model lives on B2.** The seed runs a real short training run
  (`service/training.py`, ~1 epoch / ~25 iters) to mint `checkpoint_final.pth`,
  tars it, and uploads it to `checkpoints/`. At inference,
  `ensure_model_available()` uses the gitignored `.data/nnUNet_results/` cache or
  pulls + extracts the tarball from B2. nnU-Net's `nnUNet_raw` /
  `nnUNet_preprocessed` / `nnUNet_results` env dirs are pointed at `.data/`.
- **Device auto-detect.** `service/device.py` resolves CUDA → Apple MPS → CPU
  (default CPU) and downgrades MPS → CPU for nnU-Net (its 3D ops aren't
  MPS-complete). No GPU is ever required.
- **torch pin.** torch is pinned `<2.6`: nnU-Net 2.5.x's `PolyLRScheduler` passes
  the `verbose` positional that torch removed in 2.6, which crashes training.

## Job-as-B2-JSON persistence

- **B2 is the only store — no database.** A Segmentation Job is persisted as a
  single `jobs/<id>.json` object; `list_objects_v2(prefix="jobs/")` + `get` is
  the list. Masks/overlays live under `masks/<id>/`; a delete is scoped to those
  prefixes (never bucket-wide).
- **Single-writer caveat.** B2 has no conditional PUT / transactions, so two
  concurrent writers to the same job could clobber each other. This is fine at
  the single-user demo scale this sample targets — the same class of trade-off
  as an Iceberg latest-metadata pointer. A multi-writer clone needs an external
  lock or a real DB.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repository: `web` builds from the
  repository root because it consumes `packages/shared`; `api` builds from
  `services/api`. Each service's versioned config sits at its own root —
  `railway.json` and `services/api/railway.json` — the default path Railway
  discovers, so a one-click template deploy inherits the same build, start, and
  health behavior with nothing to configure by hand. The human-approved
  staging/production contract lives in [infra/railway/README.md](infra/railway/README.md).
- **Vercel** — **web tier only.** The FastAPI service imports torch + nnU-Net,
  which far exceed the serverless Function size/RAM limits, so the API is **not**
  Vercel-serverless-deployable. Deploy the Next.js web app to Vercel and run the
  nnU-Net API elsewhere (local, a GPU box, or Railway). Volume ingest still goes
  directly from the browser to B2 via a presigned PUT (see
  [Volume Ingest](docs/features/volume-ingest.md)); the bucket must allow the
  deploy origin in its CORS. The web-tier contract lives in
  [infra/vercel/README.md](infra/vercel/README.md).

External provisioning and deployment remain explicit user-approved actions.

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API), the sole data store
  - `volumes/` raw imaging volumes · `preprocessed/` nnU-Net tensors ·
    `masks/<job_id>/` masks + overlays · `checkpoints/` the model tarball ·
    `jobs/<id>.json` the job records · `manifests/cohort.jsonl`
  - Listing/metadata via S3 `list_objects_v2` / `head_object`; reads/writes via
    `get_object` / `put_object`; previews via `generate_presigned_url`
  - **No application database** — job records are JSON objects on B2

## External Services

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling). A per-IP rate-limit middleware sits inner to CORS; see [docs/SECURITY.md](docs/SECURITY.md#rate-limiting).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Ingest**: Browser -> `POST /upload/presign` (validate + sign a PUT under `volumes/`) -> Browser PUTs bytes **directly to B2** -> `POST /upload/verify`
- **Create job**: Browser -> `POST /jobs` (JSON) -> service validates volume/model -> writes `jobs/<id>.json` (status `pending`)
- **Run**: Browser -> `POST /jobs/{id}/run` -> service pulls the volume, ensures the model (cache or B2), runs real nnU-Net, writes mask + overlays under `masks/<id>/`, updates the job record (`completed`)
- **Preview**: `GET /volumes/slice?key=…` streams a rendered mid-slice PNG; `GET /jobs/{id}/slices/{i}` returns a presigned overlay URL
- **Delete**: Browser -> `DELETE /jobs/{id}` -> deletes `jobs/<id>.json` + `masks/<id>/` (scoped)

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## API Contract

- Checked-in OpenAPI artifact: `docs/api/openapi.json`
- Export/check command: `pnpm contract:export` / `pnpm contract:check`
- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`
- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`

The frontend client keeps a small `API_CLIENT_ROUTES` registry in
`apps/web/src/lib/api-client.ts`. Tests compare that registry to the checked-in
OpenAPI artifact so route changes fail loudly before the hand-written client can
silently drift from FastAPI. `GET /metrics` is intentionally server-only.

## Canonical Files

- nnU-Net engine: `services/api/app/service/segmentation.py`, `service/training.py`, `service/device.py`, `service/nnunet_env.py`
- Job CRUD + run: `services/api/app/service/jobs.py`; routes `services/api/app/runtime/jobs.py`
- Volumes explorer: `services/api/app/service/volumes.py`; routes `services/api/app/runtime/volumes.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`, `repo/b2_object.py`
- Pydantic models: `services/api/app/types/` (`jobs.py`, `volumes.py`, `files.py`, …)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Seed: `services/api/scripts/seed_b2.py`
- Structural tests: `services/api/tests/test_structure.py`
- OpenAPI contract: `docs/api/openapi.json`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Segmentation](docs/features/segmentation.md)
- [Model checkpoints on B2](docs/features/model-checkpoints.md)
- [Volume ingest](docs/features/volume-ingest.md)
- [Mask preview](docs/features/mask-preview.md)
- [Cohort manifest](docs/features/cohort-manifest.md)
- [File Browser](docs/features/file-browser.md)
- [Dashboard](docs/features/dashboard.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
