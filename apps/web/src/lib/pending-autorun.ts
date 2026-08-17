// Job IDs the New-job form asked to auto-run ("Create & run"). The detail page
// consumes the flag on mount and triggers the run ITSELF, so the run is owned by
// the still-mounted `/jobs/[id]` page — its optimistic "running" state, live
// poll, and terminal reconcile behave exactly like the in-place Run button
// (rather than a run fired from the form, whose React Query callbacks would not
// reliably reconcile the cache once the form unmounts on navigation).
//
// A module-level Set (not a URL query param) keeps `/jobs/[id]` free of a
// Suspense-forcing `useSearchParams()`, matching this repo's deep-link
// convention (see `lib/preview-deep-link.ts`). It is consumed exactly once: the
// detail page deletes the id before running, and a full page reload starts with
// an empty Set, so a reload never re-triggers a run.
export const pendingAutoRun = new Set<string>();
