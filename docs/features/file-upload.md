<!-- last_verified: 2026-08-17 -->
# Feature: File upload → Volume ingest

In this sample the direct-to-B2 presigned upload flow is used for **volume
ingest**: the browser PUTs a `.nii.gz` / DICOM-zip straight to B2 under the
`volumes/` prefix. The mechanics (presign → PUT → verify) are unchanged from the
starter; only the accepted types, size ceiling (512 MB), and destination prefix
differ.

See **[volume-ingest.md](volume-ingest.md)** for the current feature doc.

## Related Docs
- [volume-ingest.md](volume-ingest.md)
- [file-browser.md](file-browser.md)
