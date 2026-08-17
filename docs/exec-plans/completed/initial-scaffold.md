# Build plan — `nnunet-3d-medical-image-segmentation`

Source of truth (starter kit, cloned fresh in Phase 0):
`.claude/scratch/vcsk-b077ccc5-1402-4311-8220-342e7e2c61c2/`. Build target:
`./nnunet-3d-medical-image-segmentation`. Compute the keep/trim/add delta against
that tree only — do NOT read a sibling starter checkout.

Exemplar to mirror: `../clam-wsi-feature-extraction` (a shipped heavy-ML *medical*
sample built from the same starter). It keeps the full-bucket `files` explorer and
adds a domain entity page (`slides`) with a heavy-ML "run" (feature extraction),
torch contained in `service/`, boto3 contained in `repo/`. This plan follows that
shape exactly, substituting nnU-Net + 3D volumes for CLAM + WSIs.

---

## 1. Purpose

A B2-backed dashboard for **automated 3D medical-image segmentation with nnU-Net**.
Radiology and clinical-research teams ingest 3D CT/MRI volumes (NIfTI), run
nnU-Net **locally** for fully-automatic segmentation, and archive every artifact —
raw volumes, preprocessed tensors, segmentation masks, and model checkpoints — on
**Backblaze B2**, the central store for a multi-site research consortium. The
sample makes B2's role concrete: it is the storage layer for a write-amplifying
imaging pipeline (one raw volume fans out into a preprocessed tensor + a mask + a
share of a multi-fold checkpoint), all accessed over the **S3-compatible API** with
a custom user agent and the standard `B2_*` env vars. It runs on local OSS only —
**no second API key; B2 credentials are the only secret.**

The interactive headline is **segmentation (inference)**: pick an ingested volume,
run real nnU-Net, and get a real mask + a mid-slice overlay preview, with the model
checkpoint itself living on B2. Training is real too but runs once at seed time (a
short real nnU-Net training run on tiny synthetic volumes) to produce the checkpoint
the app serves inference from — so the whole pipeline (ingest → preprocess → train →
segment → serve) is exercised with **real nnU-Net and real B2 objects**, at a tiny,
screenshot-fast scale.

Audience: ML/imaging engineers and research-IT teams evaluating B2 as the storage
backbone for a segmentation pipeline, and AI coding agents scaffolding one.

---

## 2. Architecture delta from `vibe-coding-starter-kit`

The starter kit is the ceiling — strip what a segmentation app doesn't need, keep
the dashboard/upload/explorer/settings chrome, add the nnU-Net domain.

### KEEP (as-is or lightly rebranded)
- **Whole monorepo shell**: `apps/web` (Next 16 + React 19 + Tailwind v4 + shadcn),
  `services/api` (FastAPI, layered `config`/`repo`/`runtime`/`service`/`types`),
  `packages/shared` types, root scripts (`setup.mjs`, `doctor.mjs`, `dev.sh`),
  pnpm workspace, contract/export tooling, e2e harness, `docs/` skeleton.
- **`repo/b2_client.py` + `repo/list_cache.py` + `repo/b2_upload.py`/`b2_object.py`**
  — the whole S3 access layer (list/head/get/put/delete/presign + the
  stale-while-revalidate full-bucket cache). This is the single boto3 surface and
  carries the custom UA. Extend, don't replace.
- **Full-bucket file explorer** (`app/files/page.tsx`, `components/files/*`,
  `runtime/files.py`, `service/files.py`) — **NON-NEGOTIABLE KEEP.** The
  browse-everything view stays as the "Files" nav item so a user can see every raw
  object across all prefixes (`volumes/`, `preprocessed/`, `masks/`, `checkpoints/`,
  `jobs/`, `manifests/`). Never remove it.
- **Direct-to-B2 presigned upload flow** (`runtime/upload.py`, `service/upload.py`,
  `components/upload/*`) — reused for **volume ingest** (browser PUTs the `.nii.gz`
  straight to B2). Bumps `max_file_size` and accepts NIfTI/DICOM-zip content types.
- **Dashboard shell** (`app/page.tsx`, `components/dashboard/*`), **stats/activity**
  endpoints, **health banner**, **command palette**, **sidebar/header**, **settings
  page + theme**, **Design System page**, **danger-zone**.
- **Settings form** (`components/settings/settings-form.tsx`) — kept as the
  demo-honest exemplar AND reused as the pattern for the Job create/edit forms
  (selectors for finite fields, safe-default hints). Keep its "this is a demo"
  banner honesty.

### TRIM (remove from starter)
- **Rich per-file metadata-extraction internals** aimed at office/media files
  (`service/metadata.py` image/PDF/checksum recompute, `metadata-extraction`
  feature doc) — replace the *domain* of "detail" with volume header fields
  (shape, spacing, modality) rather than EXIF/PDF. Keep the generic head_object
  metadata; drop the image/PDF-specific extraction and its `/detail` heavy path if
  it doesn't fit volumes (or repoint it at NIfTI header parsing — builder's call,
  but don't leave dead office-file code paths).
- **Media preview** (`file-preview-media.tsx` for images/audio/video/PDF) — volumes
  are not browser-previewable; the domain preview is a **rendered mid-slice PNG**
  (see ADD). Keep the generic preview modal shell; trim the media-type branches that
  can't apply, or leave them inert for the full-bucket explorer only.
- Starter marketing copy in `README.md`, `PRODUCT.md`, `ARCHITECTURE.md` about
  "vibe coding / build me a dashboard" → rewrite for the segmentation story.
- Deploy-to-Vercel one-click button that assumes a stateless upload app — a local
  nnU-Net/torch backend is **not** Vercel-serverless-deployable. Demote the Vercel
  button to a "the web tier can deploy to Vercel; the nnU-Net API runs locally / on a
  GPU box or Railway" note (see risks). Do not advertise one-click deploy of the API.

### ADD (new for `nnunet-3d-medical-image-segmentation`)
- **Primary entity — Segmentation Job.** New vertical slice mirroring clam's
  `slides`:
  - `services/api/app/types/jobs.py` — `SegmentationJob`, `JobStatus`
    (`pending|running|completed|failed`), create/edit request models, `JobMetrics`.
  - `services/api/app/service/jobs.py` — CRUD orchestration; **job records persist as
    JSON objects on B2** under `jobs/<job_id>.json` (B2 is the store — no DB added).
    List = `list_objects_v2(prefix="jobs/")` + get; single-user demo scale, note the
    single-writer/no-conditional-PUT caveat in `ARCHITECTURE.md`.
  - `services/api/app/service/segmentation.py` — the **nnU-Net inference engine**
    (the real primary feature; see §4). Contains torch/nnunetv2 imports (NOT in
    `repo/` — `repo/` is the boto3-only surface, per clam's split).
  - `services/api/app/service/training.py` — programmatic short real nnU-Net training
    used by the seed to mint the checkpoint (see §4).
  - `services/api/app/service/rendering.py` — render a mid-axial-slice PNG of a volume
    with the mask overlaid (matplotlib/Pillow), for the preview + screenshot.
  - `services/api/app/service/volumes.py` — list/describe volumes & masks scoped to
    the sample's prefixes (feeds the Volumes explorer + the create-job volume
    selector).
  - `services/api/app/runtime/jobs.py` — routes: `GET /jobs`, `POST /jobs`,
    `GET /jobs/{id}`, `PATCH /jobs/{id}`, `DELETE /jobs/{id}`, `POST /jobs/{id}/run`.
  - `services/api/app/runtime/volumes.py` — `GET /volumes` (scoped listing),
    `GET /volumes/{key}/slice` (presigned or streamed preview PNG).
- **Sample-specific asset explorer — "Volumes"** (`app/volumes/page.tsx`): a
  domain-scoped view of ingested volumes and their masks (thumbnail = mid-slice),
  with "Ingest volume" (reuses the presigned upload, scoped to `volumes/`). This is
  the mandated sample-specific explorer that sits ALONGSIDE the kept full-bucket
  Files explorer.
- **Segmentations UI** (`app/jobs/page.tsx` list + `app/jobs/new/page.tsx` create +
  `app/jobs/[id]/page.tsx` detail with edit/delete/run + slice-overlay preview).
  `components/jobs/*` (job-table, job-form, job-detail, mask-overlay-viewer).
- **Seed script** `services/api/scripts/seed_b2.py` (+ `pnpm run seed`): generate N
  tiny synthetic labeled volumes (bright ellipsoid "lesion" in noise), upload under
  `volumes/<site>/<modality>/<patient>/`, run nnU-Net preprocess + short train, and
  upload preprocessed tensors (`preprocessed/`), the checkpoint tarball
  (`checkpoints/<task>/`), a couple of prebuilt example masks (`masks/`), and a cohort
  manifest JSONL (`manifests/cohort.jsonl`). Idempotent; skips train if a checkpoint
  already exists on B2.
- **Device selection util** `services/api/app/service/device.py` — auto-detect
  CUDA → MPS → CPU (default CPU), with nnU-Net MPS→CPU fallback (see §4/§9).
- Dashboard stat cards rebranded to the domain: total volumes, total masks,
  storage by artifact type (raw/preprocessed/masks/checkpoints), jobs completed.
- Nav (sidebar): **Dashboard · Segmentations · Volumes · Files · Settings**
  (+ Design System under Reference). "Upload" folds into Volumes as "Ingest volume".

---

## 3. B2 surface (all S3-compatible; **no b2-native**)

Single boto3 client in `repo/b2_client.py`, `user_agent_extra="b2ai-nnunet-3d-medical-image-segmentation"`.

| Operation | S3 call | Where |
|---|---|---|
| Ingest a volume (browser direct) | presigned `put_object` (PUT) | `service/upload.py` (kept) |
| Server-side writes (preprocessed, mask, checkpoint tarball, manifest, job JSON) | `put_object` | `repo/b2_client.py` via services |
| Pull volume for inference; pull checkpoint tarball; pull job JSON | `get_object` | `repo/b2_client.py` |
| List volumes/masks/jobs; dashboard stats | `list_objects_v2` (paginated + cached) | `repo/list_cache.py` (kept) |
| Object metadata (shape/size) | `head_object` | `repo/b2_client.py` (kept) |
| Preview/download volumes & masks; serve slice PNG | `generate_presigned_url` (GET) | `repo/b2_client.py` (kept) |
| Delete a job + its scoped artifacts | `delete_object` | `service/jobs.py` (scoped to `jobs/<id>` + `masks/<id>/`) |

**b2-native use: none.** Everything is S3 (boto3, sig v4). No `b2_authorize_account`,
no `b2_upload_file`. nnU-Net touches only the local filesystem; B2 I/O is exclusively
the boto3 client. **Delete scoping** (local `CLAUDE.local.md`): every job delete is
scoped to that job's own prefixes — never a bucket-wide wipe.

---

## 4. Key features

All features are **`deployment: local`** — the heavy work (nnU-Net preprocess, train,
inference) runs on-device. **No external API provider is used** (the brief mandates
"no second API key, B2 credentials only"), so `api-provider-selection.md` does not
apply and no provider/model/cost/key row is needed. Per the local-default hard rule,
every local feature auto-detects **CUDA → MPS → CPU, defaulting to CPU**.
**Genblaze: not applicable** — the brief does not mention Genblaze / `genblaze-*` /
`genblaze-s3` / a "Suggested stack", so provider calls are NOT routed through the
Genblaze SDK; boto3 is used directly and contained in `repo/`.

1. **Automatic 3D segmentation with nnU-Net (REAL primary feature).** The app runs
   genuine `nnunetv2` inference (`nnUNetPredictor`) on a selected volume and writes a
   real NIfTI mask to B2. `deployment: local`. Device auto-detected. This is the
   headline and MUST be real end-to-end — never mock or substitute the model.
2. **Train-once model on B2 (real short training).** The seed runs a real, short
   nnU-Net training run (programmatic `nnUNetTrainer` subclass, ~1 epoch × ~25 iters)
   on tiny synthetic labeled volumes and archives the checkpoint to
   `checkpoints/<task>/`. The app resolves the model from a local cache
   (`.data/nnUNet_results/`, gitignored) or, if absent, **pulls the checkpoint from
   B2** — demonstrating "the model lives on B2".
3. **Volume ingest + cohort archive (write-amplification story).** Ingest `.nii.gz`
   (and DICOM-zip) volumes to `volumes/<site>/<modality>/<patient>/`; the pipeline
   fans each into a preprocessed tensor, a mask, and a share of the checkpoint —
   every artifact type on B2. Tiny by default; a larger preset documents the
   10k-volume ≈ 2 TB scale story.
4. **Mid-slice mask-overlay preview.** Server renders an axial mid-slice PNG of the
   volume with the segmentation overlaid (the money screenshot); volumes aren't
   browser-native so this is the domain preview.
5. **Cohort manifest.** A JSONL (`manifests/cohort.jsonl`) mapping patient IDs →
   volume/mask keys + task metadata, browsable and downloadable from B2.
6. **Dual explorers.** Domain-scoped **Volumes** view + the kept full-bucket
   **Files** view.

Feature docs to stub under `docs/features/`: `segmentation.md`, `volume-ingest.md`,
`model-checkpoints.md`, `cohort-manifest.md`, `mask-preview.md` (README feature list
mirrors these).

### Primary-entity lifecycle (UI completeness) — entity: **Segmentation Job**

Default is ALL verbs built; the app supports all of them, so all are in the UI.
`omitted_ui_verbs = []`.

| Verb | Built? | UI surface |
|---|---|---|
| **create** | ✅ | `app/jobs/new` — form: name, input-volume selector, modality, model/task, tags/notes. Status starts `pending`. |
| **read** | ✅ | `app/jobs` list + `app/jobs/[id]` detail (status, input/output keys, metrics, slice-overlay preview). |
| **edit** | ✅ | `app/jobs/[id]` edit — **metadata only** (name, tags, notes). Inputs are immutable by design: a job is the record of one inference on one volume; to change the volume/model, create a new job. This is a scoped-edit clarification, not an omission. |
| **delete** | ✅ | `app/jobs/[id]` delete → removes the job JSON + its `masks/<id>/` artifacts (scoped). |
| **run** | ✅ | `app/jobs/[id]` (and list row) "Run segmentation" → executes nnU-Net inference; re-run allowed (overwrites the job's mask). |

### Form UX conventions (create/edit Segmentation Job)

- **Finite-option fields → selectors** (both create & edit; per the `settings-form.tsx`
  exemplar):
  - `modality`: `CT | MRI | Other` → `Select` / `RadioGroup`.
  - `model` (task/preset): `Select` populated from available models (default:
    "Demo Lesion (synthetic)"; extensible).
  - `input_volume`: `Select` populated from `GET /volumes` (ingested volumes), with an
    inline "Ingest a volume" link to the Volumes page.
- **Free-text**: `name`, `site_id`, `patient_id`, `notes`, comma-tags.
- **Create-form safe-default hints** (placeholder / `FormDescription` only — never an
  autofill button): `name` placeholder e.g. `"liver-lesion-0001"`; `modality` defaults
  to `CT`; `model` defaults to the demo model; volume selector description "Pick a
  volume seeded under `volumes/` or ingest a `.nii.gz`." The **edit** form opens
  pre-filled from the real job and shows no default hints.

---

## 5. Doc transforms

- **Rewrite**: `README.md` (segmentation story, quickstart incl. `pnpm run seed`,
  the scale story, screenshots placeholders, honest deploy note), `PRODUCT.md`,
  `ARCHITECTURE.md` (add: nnU-Net engine containment in `service/`, job-as-B2-JSON
  persistence + single-writer caveat, checkpoint-on-B2 resolution, device
  auto-detect, S3-only rationale), `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` app identity.
- **Replace feature docs**: delete `metadata-extraction.md`; rewrite `dashboard.md`,
  `file-upload.md`→`volume-ingest.md`, `file-browser.md` (dual explorers),
  `settings.md` (keep demo-honesty). Add `segmentation.md`, `model-checkpoints.md`,
  `cohort-manifest.md`, `mask-preview.md`.
- **Keep**: `SECURITY.md` (update the B2 env names + single-tenant/unauth stance,
  which still holds), `RELIABILITY.md`, `verification.md`, `frontend-conventions.md`,
  `design-system.md`, `dev-workflows.md`, `app-workflows.md` (adapt route names).
- Move THIS plan to `docs/exec-plans/completed/initial-scaffold.md` on PASS
  (Phase 5).

---

## 6. Rename table (`vibe-coding-starter-kit` → `nnunet-3d-medical-image-segmentation`)

| Kind | From | To |
|---|---|---|
| kebab slug / repo | `vibe-coding-starter-kit` | `nnunet-3d-medical-image-segmentation` |
| root pkg `name` | `vibe-coding-starter-kit` | `nnunet-3d-medical-image-segmentation` |
| web pkg | `@vibe-coding-starter-kit/web` | `@nnunet-3d-medical-image-segmentation/web` |
| shared pkg | `@vibe-coding-starter-kit/shared` | `@nnunet-3d-medical-image-segmentation/shared` |
| `APP_NAME` (`lib/app-config.ts`) | `Vibe Coding Starter Kit` | `nnU-Net 3D Segmentation` |
| `APP_DESCRIPTION` | file dashboard template… | `Automatic 3D CT/MRI segmentation with nnU-Net, archived on Backblaze B2` |
| API title (`main.py`) | `Vibe Coding Starter Kit API` | `nnU-Net 3D Medical Image Segmentation API` |
| user agent (`b2_client.py`) | `b2ai-oss-start` | `b2ai-nnunet-3d-medical-image-segmentation` |
| UTM `utm_content` (all `.md`, sidebar, links) | `b2ai-oss-start` | `b2ai-nnunet-3d-medical-image-segmentation` |
| workflow / deploy slugs (`railway.json`, `vercel.json`, `.github/workflows/*`, infra READMEs) | `vibe-coding-starter-kit` | `nnunet-3d-medical-image-segmentation` |
| Title Case prose | `Vibe Coding Starter Kit` | `nnU-Net 3D Medical Image Segmentation` |

Also fix cached-path breakage after rename (per build-constraints "Renames"):
rewrite `.venv` shebangs/`pyvenv.cfg`, and `rm -rf apps/web/.next apps/web/.turbo
node_modules/.cache`; re-verify with a real `pnpm dev` route probe, not just build.

### Env-var normalization (**MUST** — parent standard #3; the starter deviates)

The starter ships `B2_ENDPOINT` / `B2_KEY_ID` / `B2_PUBLIC_URL` and a hardcoded
region default — `/b2-doctor` flags all of these ❌, and `scripts/doctor.mjs` will
break `pnpm setup`/`predev`. Normalize to the standard names everywhere:

| From | To |
|---|---|
| `B2_ENDPOINT` (+ settings `b2_endpoint`, hardcoded `s3.us-west-004…` default) | `B2_REGION` (settings `b2_region`, **no default**, required at startup); derive `endpoint_url` property = `https://s3.{b2_region}.backblazeb2.com` |
| `B2_KEY_ID` (settings `b2_key_id`) | `B2_APPLICATION_KEY_ID` (settings `b2_application_key_id`) |
| `B2_PUBLIC_URL` (settings `b2_public_url`) | `B2_PUBLIC_URL_BASE` (settings `b2_public_url_base`); commented line in `.env.example` |

Surface to touch (grep-verified): `.env.example`, `services/api/app/config/settings.py`,
`services/api/main.py` (`REQUIRED_B2_SETTINGS` + `PLACEHOLDER_VALUES`),
`services/api/app/repo/b2_client.py`, `services/api/scripts/setup_b2_cors.py`
(build endpoint from region; drop the `us-east-005` fallback),
`scripts/doctor.mjs` (required-env list + placeholder), `README.md` (setup steps +
Vercel button `env=` list), `infra/vercel/README.md`, `infra/railway/README.md`,
`docs/SECURITY.md`. Final `.env.example` has exactly (4 real + 1 commented):
`B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_REGION`,
`# B2_PUBLIC_URL_BASE`. **No hardcoded region strings in source** (outside comments/docs).
Any new env var the app reads (e.g. `NNUNET_DEVICE` override, seed sizes, model prefix)
must also be declared in `.env.example`.

---

## 7. Dependencies (`services/api/requirements.txt`)

Add to the FastAPI/boto3 base (verify a mutually-compatible set in a **fresh venv**
and regenerate `requirements.lock`, per build-constraints):
- `nnunetv2` (pin a known-good, e.g. `>=2.5,<2.6`) — pulls torch, scipy,
  batchgenerators, dynamic-network-architectures, acvl-utils, SimpleITK, etc.
- `torch>=2.4.0,<2.9.0` (CPU/MPS wheel on macOS arm64 — do **not** pin a CUDA build).
- `nibabel` (NIfTI I/O), `SimpleITK` (if not already pulled by nnunetv2).
- `numpy` — start at `>=1.26,<2.0` (matches the clam medical exemplar; many
  med-imaging libs still assume numpy<2). If `nnunetv2` requires numpy≥2 in the fresh
  venv, relax and note it.
- `matplotlib` or Pillow for slice rendering (Pillow already present; matplotlib gives
  easy overlay colormaps).

Keep the seed preset **tiny** (~8–12 synthetic 64³ volumes) so preprocess+train stay
minutes-scale on CPU and verify/screenshots stay fast. Offer a larger `--cases`
preset for the scale story.

---

## 8. Standards compliance (parent CLAUDE.md) — reviewer/`b2-doctor` gate

1. **S3 default** — boto3 sig-v4 only; zero b2-native. ✅ by construction.
2. **Custom UA on every S3 client** — the single `repo/b2_client.py` boto3 client sets
   `user_agent_extra="b2ai-nnunet-3d-medical-image-segmentation"`. Add/keep the
   structural test asserting boto3 lives only in `repo/`.
3. **Standard env names** — `.env.example` = the 5 standard keys, no aliases, no
   hardcoded region (see §6). This is the most likely ❌ if the normalization is
   skipped — do it.
4. **UTM** on every `backblaze.com` link = full set with
   `utm_content=b2ai-nnunet-3d-medical-image-segmentation`, or the `blze.ai/storage`
   short link.
5. **No secrets** committed; real creds only in gitignored `.env`.

---

## 9. Known risks / gotchas (bake into the build)

- **nnU-Net is genuinely heavy.** Keep synthetic volumes tiny (64³), few cases, and a
  short programmatic trainer (`num_epochs=1`, `num_iterations_per_epoch≈25`,
  `num_val_iterations_per_epoch≈2`) so a real train finishes in minutes on CPU. Cache
  the trained model under `.data/nnUNet_results/` (gitignored) and mirror to B2 so the
  app never re-trains on every run. Set nnU-Net's `nnUNet_raw`/`nnUNet_preprocessed`/
  `nnUNet_results` env vars to gitignored `.data/` subdirs at runtime.
- **Device fallback**: auto-detect CUDA → MPS → CPU (default CPU). nnU-Net's 3D ops may
  not all support Apple MPS — wrap inference/training so an MPS op error falls back to
  CPU and logs it. Never hard-require a GPU; no unconditional `.cuda()`/`device="cuda"`.
  Expect (and contain) native-ML/OpenMP macOS banners — surface one only if it BLOCKS
  the run.
- **Segmentation must be REAL** — the synthetic task (bright ellipsoid in noise) is
  chosen because nnU-Net learns it well in a short run, so masks look correct. Do not
  fall back to thresholding/mock "segmentation"; that's a defect even though it'd be
  faster.
- **Volumes are not browser-previewable** — always go through the server slice-render
  path; don't try to `<img>` a `.nii.gz`.
- **Job-as-B2-JSON has no transactions / no conditional PUT** — fine at single-user
  demo scale; document the single-writer caveat in `ARCHITECTURE.md` (same class of
  trade-off as the Iceberg-pointer note in build-constraints).
- **Vercel one-click can't host the nnU-Net API** — the web tier can deploy to Vercel,
  but the torch/nnU-Net backend needs a real host (local, a GPU box, or Railway).
  Rewrite the deploy section honestly; don't advertise one-click API deploy.
- **Rename bakes absolute paths** — after renaming, fix `.venv` shebangs/`pyvenv.cfg`
  and clear `.next`/`.turbo` caches, then re-probe routes with `pnpm dev`.
- **numpy/torch/nnunetv2 pin conflicts** surface only on a fresh venv — install clean,
  resolve, regenerate the lock, and ship a real local round-trip test (synthetic
  volume → nnU-Net predict → mask → assert non-empty foreground) plus an opt-in
  `@pytest.mark.live` prefix-scoped B2 round-trip.
