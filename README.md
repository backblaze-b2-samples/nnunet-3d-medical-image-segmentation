<!-- last_verified: 2026-08-17 -->
# nnU-Net 3D Medical Image Segmentation

A B2-backed dashboard for **automated 3D medical-image segmentation with [nnU-Net](https://github.com/MIC-DKFZ/nnUNet)**. Ingest 3D CT/MRI volumes (NIfTI), run **real nnU-Net inference locally**, and archive every artifact — raw volumes, preprocessed tensors, segmentation masks, and the model checkpoint itself — on **[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation)**, the central store for a multi-site research consortium.

It runs on local OSS only — **no second API key; your B2 credentials are the only secret.**

**What you get out of the box:**
- Real `nnunetv2` segmentation: pick an ingested volume, run inference, get a real NIfTI mask + a mid-slice overlay preview — the trained checkpoint lives on B2.
- A **train-once** demo model minted by a genuine short nnU-Net training run at seed time (on tiny synthetic volumes), archived to B2.
- Two explorers: a domain-scoped **Volumes** view and the kept **full-bucket Files** browser.
- Full Segmentation Job lifecycle (create / read / edit / delete / run) with B2 as the only store — no database.
- Next.js 16 + React 19 + Tailwind v4 + shadcn/ui frontend; FastAPI backend with a strict layered architecture and structural tests.

## What it looks like

> Screenshots live in `docs/images/` (added by the screenshot step). The money
> shot is a completed job's **mid-axial-slice PNG with the segmentation mask
> overlaid** — volumes aren't browser-native, so the server renders the slice.

## The write-amplification story

Segmentation is a **write-amplifying** pipeline, which is exactly where B2 earns its place: one raw volume fans out into a preprocessed tensor, a mask, and a share of a multi-fold checkpoint. Every artifact type lands on B2 over the **S3-compatible API** with a custom user agent:

```
volumes/<site>/<modality>/<patient>/<case>.nii.gz   # raw imaging volumes (ingest)
preprocessed/<task>/...                              # nnU-Net preprocessed tensors
masks/<job_id>/segmentation.nii.gz                   # per-job segmentation masks + overlays
checkpoints/<task>.tar.gz                            # the trained model — the model lives on B2
jobs/<job_id>.json                                   # the Segmentation Job record (B2 is the DB)
manifests/cohort.jsonl                               # patient -> volume/mask mapping
```

The default seed preset is tiny (a handful of 64³ synthetic volumes) so it runs in minutes on CPU and screenshots stay fast. A larger `--cases` preset documents the 10k-volume ≈ 2 TB scale story.

## Quick Start

You need: Node.js >= 20, pnpm >= 9, Python >= 3.12, and a free **[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation)**.

### Setup

**1. Run setup**

```bash
pnpm run setup
```

This copies `.env.example` to `.env` (only when `.env` does not already exist), installs workspace dependencies from `pnpm-lock.yaml`, creates `services/api/.venv` if missing, validates Python 3.12+, and installs the API's committed Python 3.12 resolution from `services/api/requirements.lock`. That lock includes the nnU-Net + torch closure, so first-time setup downloads a few hundred MB; it is safe to rerun and never overwrites an existing `.env`.

> Use the `pnpm run` form: `setup` (like `doctor`) is a built-in pnpm command before pnpm 11, so bare `pnpm setup` would run pnpm's own command instead of this script.

**2. Add your B2 credentials**

Open `.env` and, from the [Backblaze B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation):

1. **Create a bucket** and set:
   - **Bucket Unique Name** → `B2_BUCKET_NAME`
   - **Region** (the middle segment of the S3 endpoint, e.g. `us-west-004`) → `B2_REGION`
2. **Create an application key** with `Read and Write` permission and set:
   - **keyID** → `B2_APPLICATION_KEY_ID`
   - **applicationKey** → `B2_APPLICATION_KEY` *(only shown once — paste it now)*

The S3 endpoint is derived from `B2_REGION` (`https://s3.<region>.backblazeb2.com`); there is no hardcoded region in the source.

> Want a walkthrough? See the docs for [creating a bucket](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation) and [creating app keys](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation).

**3. Seed a real model + a demo cohort**

```bash
pnpm run seed
```

This generates tiny synthetic labeled volumes, uploads them under `volumes/`, runs a **real short nnU-Net training run** (~1 epoch on CPU, minutes) to mint the checkpoint, archives it to `checkpoints/`, uploads the preprocessed tensors and a couple of example masks, and writes `manifests/cohort.jsonl`. It is idempotent — it skips training if a checkpoint already exists locally or on B2. Pass `--cases N` for a bigger cohort.

**4. Run it**

```bash
pnpm dev
```

Frontend at `localhost:3000`, API at `localhost:8000`. Open **Segmentations → New job**, pick a seeded volume, and click **Run segmentation** to execute real nnU-Net inference. Interactive API docs (Swagger UI) are at `localhost:8000/docs`.

`pnpm dev` runs the preflight check first (`pnpm run doctor`), which catches the common setup gotchas (wrong Node/Python version, missing venv, missing or placeholder `.env`, ports already taken).

### Device selection

Inference and training auto-detect the compute device **CUDA → Apple MPS → CPU, defaulting to CPU** — no GPU is ever required. nnU-Net's 3D ops aren't reliable on Apple MPS, so an MPS preference is downgraded to CPU (logged). Force a device with `NNUNET_DEVICE=cpu|cuda|mps` in `.env`.

### Supported local environments

Local scripts run on macOS, Linux, and WSL2 — native Windows isn't supported yet (the dev scripts use POSIX shell). See [docs/verification.md](docs/verification.md#local-environments) for sandbox, port-fallback, and IPv6 behavior.

## When to use

Use this repository when you are evaluating B2 as the storage backbone for a segmentation / imaging pipeline, or when an AI coding agent is scaffolding one. It shows, concretely and end-to-end, how a write-amplifying nnU-Net pipeline (ingest → preprocess → train → segment → serve) can use B2 as its single store over the S3-compatible API, with real models and real artifacts at a tiny, screenshot-fast scale.

## When not to use

Do not choose this repository expecting a hosted, validated clinical product. It is a template/sample: no managed hosting, no user accounts, no authentication, no tenant isolation, and **no clinical validation or regulatory clearance**. The demo task segments a synthetic lesion, not real pathology. Do not point it at real patient data without adding auth, per-tenant scoping, and PHI governance (see [docs/SECURITY.md](docs/SECURITY.md)).

## Why Backblaze B2?

[Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation) is the object storage this sample is built around — a deliberate default, not just a demo backend:

- **S3-compatible API.** B2 speaks the S3 API, so the `boto3` calls you already use for AWS S3 work unchanged — you just point them at B2's regional endpoint. All B2 access is isolated in `services/api/app/repo/` and carries a custom user agent; nnU-Net/torch never touch the network.
- **Built for data-heavy, write-amplifying workloads.** Imaging cohorts fan every raw volume into preprocessed tensors, masks, and checkpoints. B2 runs at a fraction of hyperscaler pricing with generous free egress — what you want when the pipeline multiplies bytes.
- **The model lives on B2.** The trained checkpoint is archived to `checkpoints/` and pulled on demand, so any host can serve inference without re-training.
- **Free to start.** A [free B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation) is enough to run everything here.

## Core Features

- [Segmentation](docs/features/segmentation.md) — real `nnunetv2` inference on a selected volume, producing a NIfTI mask on B2
- [Model checkpoints on B2](docs/features/model-checkpoints.md) — train-once at seed time; the app resolves the model from cache or pulls it from B2
- [Volume ingest](docs/features/volume-ingest.md) — direct-to-B2 presigned upload of `.nii.gz` / DICOM-zip volumes under `volumes/`
- [Mask preview](docs/features/mask-preview.md) — server-rendered mid-axial-slice PNG with the mask overlaid
- [Cohort manifest](docs/features/cohort-manifest.md) — a JSONL mapping patients → volume/mask keys, browsable on B2
- [File Browser](docs/features/file-browser.md) — the kept full-bucket explorer alongside the scoped Volumes view
- [Dashboard](docs/features/dashboard.md) — volumes, masks, jobs completed, and storage by artifact type
- [Design System](docs/design-system.md) — tokens, primitives, error/empty states. Live preview at `/design`.

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui
- TanStack Query — caching, dedup, retry for every fetch
- Python 3.12+, FastAPI, boto3, Pydantic v2
- **nnU-Net v2 (`nnunetv2`) + PyTorch** — the real segmentation engine (contained in `services/api/app/service/`)
- nibabel / pydicom / SimpleITK for volume I/O; Pillow for slice rendering
- Backblaze B2 (S3-compatible object storage)
- pnpm workspaces (monorepo)

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm run setup` | One-time cold start: copy `.env.example` → `.env` (only if missing), install workspace deps, create the backend venv, install locked API deps (incl. nnU-Net + torch) |
| `pnpm run seed` | Generate synthetic volumes, train a real short nnU-Net model, and archive the cohort + checkpoint to B2 |
| `pnpm dev` | Start frontend + backend (runs the `pnpm run doctor` preflight first) |
| `pnpm verify` | Credential-free pre-PR suite — runs `check:agent-docs`, `verify:api`, then `verify:web` |
| `pnpm contract:export` / `pnpm contract:check` | Export / verify the FastAPI OpenAPI contract in `docs/api/openapi.json` |

`pnpm verify` is the gate to run before a PR. It chains `pnpm check:agent-docs`, then `pnpm verify:api` (backend lint, tests, structure), then `pnpm verify:web` (frontend lint, unit tests, typecheck + build). Use `pnpm verify:full` when Playwright E2E and live-service prerequisites are available.

The real nnU-Net round-trip is an opt-in test: `RUN_LIVE_NNUNET_TESTS=1 pnpm --dir services/api exec pytest live_tests/test_nnunet_roundtrip.py -m live`. For the full command reference see [docs/dev-workflows.md](docs/dev-workflows.md#commands).

## Deployment

This app has two tiers with different hosting needs:

- **Web tier (Next.js)** — deploys to Vercel or any static/Node host.
- **nnU-Net API (FastAPI + torch)** — is **not** Vercel-serverless-deployable: torch + nnU-Net far exceed serverless size/RAM limits and need real (optionally GPU) compute. Run it locally, on a GPU box, or on **Railway** (see [infra/railway/README.md](infra/railway/README.md)). The [Vercel contract](infra/vercel/README.md) covers the web tier and the caveats.

Deploying is always a human-approved action. A deployed API is unauthenticated and bucket-wide — use a dedicated B2 bucket/prefix and key, and set the bucket's CORS for browser upload (`services/api/scripts/setup_b2_cors.py`).

## Documentation Map

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, nnU-Net containment, job-as-B2-JSON |
| [docs/features/](docs/features/) | Feature docs (segmentation, volume ingest, checkpoints, mask preview, cohort manifest) |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows, command index, releases |
| [docs/verification.md](docs/verification.md) | What each gate checks, and failure recovery |
| [docs/frontend-conventions.md](docs/frontend-conventions.md) | Frontend conventions, screens, data fetching |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |
| [docs/api/openapi.json](docs/api/openapi.json) | Checked contract for the local FastAPI API |
| [infra/vercel/README.md](infra/vercel/README.md) | Vercel (web tier) contract |
| [infra/railway/README.md](infra/railway/README.md) | Railway (API) contract |
| [docs/exec-plans/](docs/exec-plans/) | Execution plans and tech debt tracker |

## FAQ

**What does this sample do?**
It runs real automated 3D segmentation with nnU-Net: you ingest a CT/MRI volume, run inference, and get a NIfTI mask plus a mid-slice overlay — with the raw volume, preprocessed tensors, mask, and the trained model checkpoint all stored on Backblaze B2 over the S3-compatible API.

**Is the segmentation real, or mocked?**
Real. The seed runs a genuine (short) nnU-Net training run to mint a checkpoint, and each job runs real `nnUNetPredictor` inference. There is no thresholding/mock fallback — an empty or missing model fails the run rather than faking a mask.

**Do I need a GPU?**
No. The device auto-detects CUDA → MPS → CPU and defaults to CPU; the tiny demo trains and infers in minutes on CPU.

**Is it free?**
Yes. MIT-licensed (see [License](#license)); a free B2 account runs everything. No second API key is needed.

**Can I use it in production / on real patients?**
No, not as-is. It is a template/sample with no auth, no tenant isolation, and no clinical validation. You own the security, operations, compliance, and validation for anything you adapt. See [When not to use](#when-not-to-use).

**Do I have to use Backblaze B2?**
It integrates B2 through the S3-compatible API and B2 is the store it is built around. You supply your own bucket and application key during setup.

**How do I rebrand it?**
Edit `apps/web/src/lib/app-config.ts` (`APP_NAME`, `APP_DESCRIPTION`); the page title, sidebar, and API title derive from it.

**Does it work on Windows?**
Local scripts are supported on macOS, Linux, and WSL2. Use WSL2 on Windows.

**Where do I get help or report bugs?**
Report repository defects through [GitHub Issues](https://github.com/backblaze-b2-samples/nnunet-3d-medical-image-segmentation/issues). For B2 account, billing, service, or API help, use [Backblaze Support](https://www.backblaze.com/help?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation).

## Maintenance and support

Backblaze maintains this open-source template/sample to help developers get started with B2. Production use is possible with caution and requires your own validation. Report repository defects through [GitHub Issues](https://github.com/backblaze-b2-samples/nnunet-3d-medical-image-segmentation/issues); for B2 account, billing, service, or API help, use [Backblaze Support](https://www.backblaze.com/help?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-nnunet-3d-medical-image-segmentation). This template/sample is not covered by the Backblaze service level agreement, and no SLA is provided for the repository software.

## Contributing

Start with [AGENTS.md](AGENTS.md). It's the map — everything else is discoverable from there. For local commit hooks, follow [the pre-commit workflow](docs/verification.md#pre-commit).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related projects

**Claude Agent B2 Skill** — manage Backblaze B2 from your terminal using natural language. Repo: [claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage).
