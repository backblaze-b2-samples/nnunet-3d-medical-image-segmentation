<!-- last_verified: 2026-08-17 -->
# Feature: Object metadata

The starter's office/media metadata extraction (image EXIF, PDF info, checksums)
does not apply to 3D imaging volumes and has been trimmed from the domain
surface. Generic object metadata (size, content type, last-modified via
`head_object`) is still available through the full-bucket Files explorer.

Volume-specific detail — shape, voxel spacing, and modality — surfaces where it
matters instead of in a generic panel:

- the **Volumes** view renders a server-side mid-slice preview per volume;
- a completed **Segmentation Job** records `metrics` (device, foreground voxels,
  per-label physical volume in mL, spacing, shape).

## Related Docs
- [mask-preview.md](mask-preview.md)
- [segmentation.md](segmentation.md)
- [file-browser.md](file-browser.md)
