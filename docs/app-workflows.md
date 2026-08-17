<!-- last_verified: 2026-08-06 -->
# App Workflows

User journeys inside the application.

## Ingest a Volume

- User navigates to `/upload` ("Ingest volume", linked from the Volumes page)
- Drops or selects a NIfTI (`.nii` / `.nii.gz`) or zipped DICOM series (max 512MB)
- Files upload **directly from the browser to B2** under `volumes/` (a presigned PUT). A determinate progress bar tracks the bytes; then the row switches to "Verifying upload..." while the API HEADs the stored object
- On success: toast + the volume appears on the Volumes page and in the create-job selector
- On failure: red status icon with error message (offline, CORS on a deployed origin, or type/size)
- Alternatively, `pnpm run seed` populates a synthetic cohort under `volumes/` with no browser step
- See: [Volume ingest](features/volume-ingest.md)

## Run a Segmentation Job

- User navigates to `/jobs` → "New job"
- Picks an ingested volume (Select), a modality (CT/MRI/Other), and a model; optionally sets site/patient/tags/notes. The job is created with status `pending`
- On the job detail page (`/jobs/[id]`), the input volume's mid-slice preview renders; clicking **Run segmentation** executes **real nnU-Net inference** on the auto-detected device (default CPU)
- While running, the status badge polls; on completion the mask-overlay slice viewer and metrics (device, foreground voxels, per-label mL) appear, and the mask lands under `masks/<id>/` on B2
- **Edit** changes metadata only (name/tags/notes) — the input volume/model are immutable; to change them, create a new job
- **Delete** removes the job record and its scoped `masks/<id>/` artifacts; the input volume is untouched
- **Re-run** is allowed and overwrites the job's mask
- See: [Segmentation](features/segmentation.md)

## Browse and Manage Files

- User navigates to `/files`
- Page loads the 100 most recent objects from the API (sorted most recent first). While it loads, the page says so on screen and escalates the wording if the wait runs long — a full bucket listing measured 2.8s-21s cold
- If that limit was hit, a notice states how many objects the bucket actually holds — the page never claims to show everything
- Files displayed in tree view with folders and type-specific icons
- Folders auto-expand on load until the *majority* of the listed files are reachable without clicking, so the page's own "click a file" instruction is always actionable. Stopping at the first visible file was not enough: one stray top-level object left the other 99 sealed in collapsed folders while the page claimed to show 100
- Clicking a file row opens its preview; the per-row actions menu (preview / download / delete) is always visible, on every viewport
- Arriving at `/files?preview=<key>` expands that file's folders and opens its preview directly. This is how the ⌘K palette and the dashboard's recent-uploads rows hand off a *specific* file; the param is consumed on arrival so it doesn't re-fire later
- **Preview**: opens dialog with image/PDF preview + metadata panel, and the file's Download / Delete actions — the advertised "click a file" path offers everything the row menu does. The loading state holds until the media paints; a failure offers "Open in a new tab". The preview URL is signed with `Content-Disposition: inline` so PDFs render in place
- **Download**: shows a pending state on the row plus a toast while the presigned URL is fetched, then starts the download via an anchor click (which, unlike a popup, still works if the click's user activation expired during a slow presign). Failures are reported; the click can never silently do nothing
- **Delete**: the confirmation dialog stays open showing "Deleting..." until the request settles, then the row disappears with the toast (optimistic cache update) and the list reconciles with the server. The dialog is held deliberately — Radix closes on action click by default, which dismissed the only pending state and left the row looking untouched while the delete was still in flight
- Empty bucket shows "No files found" with upload prompt
- See: [File Browser](features/file-browser.md)

## View Dashboard

- User navigates to `/` (home)
- `useJobStats()` and `useJobs()` load the cohort aggregates and recent jobs
- Stat cards show: volumes, masks, jobs completed, and the model size on B2
- A "Storage by artifact type" card breaks down raw / preprocessed / masks / checkpoints bytes — the write-amplification story
- A recent-segmentations table lists the newest jobs with a Run action; a running job makes the table poll until it settles
- Empty state: "No segmentation jobs yet" pointing at `pnpm run seed` / New job
- See: [Dashboard](features/dashboard.md)

## Change Preferences

- User navigates to `/settings`
- A banner at the top states that the page is mostly a demonstration: only Theme is wired up for real, the rest showcases what a settings page can look like when you adapt the kit
- **Theme** (real): editing it and saving applies it immediately and persists it (`next-themes`), and the header's theme toggle drives the same state
- **Profile and preference fields** (demo): Display name, Bio, Default file view (Tree/List/Grid), Email me on every upload, Warn me when approaching quota + threshold. Each is labelled "Demo field", persists to `localStorage` only, and drives no behaviour — there is no account system, mailer, quota banner, activity log, or List/Grid view behind them yet
- Saving reports honestly: a success toast that separates the real theme change from the locally-stored demo values, or a warning toast if the browser blocked storage (theme still changes). It never claims a save that did not happen — the original page toasted "Settings saved" for fields that changed nothing
- Danger Zone actions are a demo — no real delete runs
- See: [Settings](features/settings.md)
