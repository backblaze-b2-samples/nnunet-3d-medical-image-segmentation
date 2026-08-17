<!-- last_verified: 2026-08-17 -->
# Vercel Delivery Contract (web tier only)

This is the canonical runbook for deploying the **web tier** of this repository
to Vercel. It records the supported topology without linking a local directory,
creating a Vercel project, deploying code, or storing environment values in the
repository. An authorized human performs every external action.

## Scope: the web tier only

Only the Next.js frontend (`apps/web`) deploys to Vercel. The **nnU-Net API is
not Vercel-serverless-deployable**: `services/api` imports `torch` + `nnunetv2`,
whose installed closure and RAM footprint far exceed Vercel Function size and
memory limits, and inference needs real (optionally GPU) compute. Run the API
**locally, on a GPU box, or on Railway** — see the app README's Deployment
section, [ARCHITECTURE.md](../../ARCHITECTURE.md#deployment), and the
[Railway API contract](../railway/README.md).

This repository ships **no** one-click full-app deploy button, and the app
README carries none. A single button cannot stand up the torch/nnU-Net backend,
so offering one would only produce a guaranteed deploy failure.

## Topology: a single web Project

| Service | Root directory | Framework | Public path | Health check |
| --- | --- | --- | --- | --- |
| `web` | `apps/web` | Next.js | `/` | `/` |

The repo-root `vercel.json` declares a **single `web` service** that builds
`apps/web` and installs the pnpm workspace from the repository root
(`cd ../.. && pnpm install`), which resolves `packages/shared`. Importing the
repository root therefore creates a web-only Vercel Project — no Python runtime,
no `torch`/`nnunetv2` install. The FastAPI API is not part of this Project and is
not built by it.

If you prefer, you can instead create the Vercel Project with **root directory
`apps/web`** and let `apps/web/vercel.json` install the workspace from the repo
root; both shapes deploy the same web tier and nothing else.

## Pointing the web tier at the API

The web and API run on **separate origins** — Vercel hosts the web tier, and the
API runs off-Vercel (local / GPU box / Railway). Because they do not share an
origin:

- Set the web Project's **`NEXT_PUBLIC_API_URL`** to the deployed API origin.
  Next.js inlines it at **build time**, so it must be present when the Vercel
  build runs; changing it requires a redeploy. It is public build-time
  configuration and must never contain a credential.
- Set the **API host's** `API_CORS_ORIGINS` to the exact Vercel web origin (and
  redeploy the API), or the browser blocks every cross-origin call. Use an exact
  origin per environment; do not set a broad production origin to accommodate
  rotating preview URLs.

## Dependabot Preview Builds Are Skipped

The root `vercel.json` sets
[`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
to `{ "dependabot/**": false }`, so a push to any Dependabot branch never
triggers a deployment — Vercel skips it before cloning, spending zero build
minutes. The pattern uses [minimatch](https://github.com/isaacs/minimatch)
globstar (`**`) on purpose: real Dependabot branches are multi-segment
(`dependabot/npm_and_yarn/...`) and a single `*` would not cross the `/`. Any
other branch defaults to `true`, so normal PRs — including a grouped dependency
PR opened on a non-`dependabot/` branch — still get a Preview. `git` is a
top-level project key, so it lives at the top level of the config. GitHub
Actions CI is skipped for the same PRs via an actor guard in
`.github/workflows/ci.yml`.

## Variables and Public Exposure

Set values in the Vercel Project and environment. Never put values in
`vercel.json`, source code, an issue, PR, terminal transcript, or screenshot.

The web tier holds **no B2 credentials** — it calls the API, and the API is what
talks to B2. The only variable the Vercel web Project needs is:

| Variable | Classification | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Public build-time configuration | The deployed API origin. Inlined into the browser bundle at build time; contains no credential. |

The B2 credentials (`B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`), bucket
configuration (`B2_REGION`, `B2_BUCKET_NAME`, `B2_PUBLIC_URL_BASE`),
`API_CORS_ORIGINS`, and the upload cap `MAX_FILE_SIZE` (default **512 MB**) are
all set on the **API host** (Railway / GPU box / local), never on Vercel — see
the [Railway API contract](../railway/README.md).

## Direct-to-B2 Upload and Bucket CORS

Volume ingest uploads bytes **directly from the browser to B2** via a presigned
PUT the API mints (see [Volume Ingest](../../docs/features/volume-ingest.md)), so
the bytes never traverse Vercel or the API. Two consequences:

- The API's `MAX_FILE_SIZE` (default **512 MB**) — not any Vercel limit — bounds
  a single upload. 3D imaging volumes are large, so the default is generous; set
  your own cap on the API host if needed.
- The **bucket's CORS must allow the Vercel web origin** (method `PUT` + the
  `content-type` header). After you know your URL, run once against the API host:

  ```bash
  python services/api/scripts/setup_b2_cors.py --origin https://your-app.vercel.app --apply
  ```

  The helper merges the origin into the bucket's CORS, preserving existing rules
  (dry-run by default; add `--apply` to write). You can also set the rule via the
  B2 console or `aws s3api put-bucket-cors`.

The deployed API is unauthenticated and bucket-wide by design. Create a separate
B2 bucket/prefix and credentials for test or preview environments; do not expose
a production bucket to a preview origin.

## Setup: Human-Approved Only

1. Select the correct Vercel team and import the repository. Vercel reads the
   repo-root `vercel.json` and creates the web-only Project (or set the Project's
   root directory to `apps/web`).
2. Set `NEXT_PUBLIC_API_URL` to the deployed API origin (per environment) before
   the build runs, and configure isolated Preview and Production values.
3. Deploy a Preview from the approved branch or commit. Add a custom domain only
   after a human reviews visibility, the API origin/CORS, and the environment's
   purpose.
4. For production, deploy the reviewed commit only after the latest approved
   Preview result. Configure Git deployment behavior deliberately; a Project
   import must not silently turn an unreviewed branch into a production domain.

Never create a project, preview, domain, production deployment, or environment
variable without the user's explicit approval. A request to edit repository
documentation or configuration is not approval to perform any of those actions.

## Promotion, Verification, and Rollback

1. Confirm the target commit passed `pnpm verify` and review the Vercel config
   and environment target (especially `NEXT_PUBLIC_API_URL`).
2. Verify the **API host** is reachable and healthy first — `GET /health` on the
   API origin must report `b2_connected: true` (HTTP 200 alone can mean
   `degraded` when B2 is unavailable).
3. Verify the Vercel web root loads, the affected user flow works end-to-end
   against the API origin, and browser CORS is correct on both sides — the API's
   `API_CORS_ORIGINS` and the bucket's upload CORS. Use a volume comfortably
   under `MAX_FILE_SIZE` for the upload smoke test.
4. Record the deployed commit, preview/production URLs, the API origin, health
   evidence, smoke-test result, approver, and skipped checks in the PR or change
   record.

If verification fails, stop promotion and have an authorized human redeploy the
last known-good Vercel web deployment (and/or roll back the API host). Recheck
the web root, the API `/health` `b2_connected`, and the affected flow. Treat a
B2 outage separately from an application rollback: the API remains reachable but
reports `degraded`.

The Vercel Project owner is accountable for Vercel membership, domains,
deployment history, and removing temporary Projects, domains, variables, and
preview environments after their approved purpose. The API host owner is
accountable for API compute, B2 storage/egress, and API credentials.

## References

- [Railway API contract](../railway/README.md) — where the nnU-Net API runs
- [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
