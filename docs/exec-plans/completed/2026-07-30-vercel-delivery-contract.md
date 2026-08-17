# Vercel Delivery Contract

## Goal

Support an explicit, human-operated Vercel deployment for the **web tier**
(Next.js `apps/web`) of this monorepo, without creating a Vercel project or
storing environment values in the repository.

## Scope

1. Document the web-only Vercel topology (a single `web` service), variables,
   preview/production workflow, verification, rollback, and cleanup.
2. Point the deployed web tier at an off-Vercel API origin via
   `NEXT_PUBLIC_API_URL`, and set the API host's CORS to the Vercel origin.
3. Keep architecture, security, reliability, and agent delivery instructions
   consistent so Railway (or a local / GPU box) — not Vercel — is described as
   where the FastAPI API runs.

## Superseded: the FastAPI API is not Vercel-serverless-deployable

An earlier revision of this contract shipped a Vercel FastAPI function
entrypoint (`index.py`) and documented a two-Project topology that deployed the
API to Vercel too. That was reverted: `services/api` imports `torch` +
`nnunetv2`, whose installed closure and RAM footprint far exceed Vercel Function
size/memory limits, and inference needs real (optionally GPU) compute. A
one-click full-app Vercel deploy would only produce a guaranteed failure. The
entrypoint and its regression test were removed, and the repo ships **no**
whole-app Vercel button.

## Result

Only the Next.js web tier deploys to Vercel — the repo-root `vercel.json`
declares a single `web` service. The nnU-Net API runs **locally, on a GPU box,
or on Railway** (see [`infra/railway/README.md`](../../../infra/railway/README.md)).
The canonical web-tier runbook is
[`infra/vercel/README.md`](../../../infra/vercel/README.md); the web and API run
on separate origins wired by `NEXT_PUBLIC_API_URL` and the API's
`API_CORS_ORIGINS`.

## Validation

- `pnpm verify` passed: agent documentation, API lint/tests/structure, web
  lint/tests, TypeScript, and production build.
- No Vercel project was linked, provisioned, deployed, or configured.
