"""Sample-scoped Volumes explorer + mid-slice rendering.

Lists ingested volumes under the `volumes/` prefix (feeding both the Volumes
page and the create-job volume selector) and renders a mid-axial-slice PNG for
a volume on demand — volumes are not browser-previewable, so the server always
renders the slice. This sits ALONGSIDE the kept full-bucket Files explorer.

boto3 stays in `repo/`; the heavy imaging imports (nibabel/pydicom/numpy) are
lazy inside `service/volume_io.py` and `service/rendering.py`.
"""

from __future__ import annotations

import logging

from app.repo import get_object_bytes, list_prefix_objects
from app.service.rendering import volume_slice_png
from app.service.volume_io import load_volume
from app.types.formatting import humanize_bytes
from app.types.volumes import VolumeSummary

logger = logging.getLogger(__name__)

VOLUMES_PREFIX = "volumes/"
MASKS_PREFIX = "masks/"
_VOLUME_SUFFIXES = (".nii.gz", ".nii", ".zip")


class VolumeError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def detect_source_format(key: str) -> str:
    """Map a volume key to the loader format. Raises VolumeError on unknown."""
    lower = key.lower()
    if lower.endswith(".zip"):
        return "dicom_zip"
    if lower.endswith(".nii") or lower.endswith(".nii.gz"):
        return "nifti"
    raise VolumeError(f"Unsupported volume type for key: {key!r}")


def _parse_key(key: str) -> tuple[str | None, str | None, str | None]:
    rest = key[len(VOLUMES_PREFIX):]
    parts = rest.split("/")
    if len(parts) >= 4:
        return parts[0], parts[1], parts[2]
    return None, None, None


def _summary(obj: dict) -> VolumeSummary:
    key = obj["Key"]
    site, modality, patient = _parse_key(key)
    return VolumeSummary(
        key=key,
        filename=key.rsplit("/", 1)[-1],
        size_bytes=obj["Size"],
        size_human=humanize_bytes(obj["Size"]),
        uploaded_at=obj["LastModified"],
        site=site,
        modality=modality,
        patient=patient,
    )


def list_volumes() -> list[VolumeSummary]:
    """Every ingested volume under `volumes/`, newest first."""
    out: list[VolumeSummary] = []
    for obj in list_prefix_objects(VOLUMES_PREFIX):
        key = obj["Key"]
        if key.endswith("/") or not key.lower().endswith(_VOLUME_SUFFIXES):
            continue
        out.append(_summary(obj))
    out.sort(key=lambda v: v.uploaded_at, reverse=True)
    return out


def render_slice_png(key: str, index: int | None = None) -> bytes:
    """Render one axial slice of a volume (or mask) to PNG bytes.

    `index` defaults to the mid-slice — the domain thumbnail/preview. Raises
    VolumeError if the key is not a readable volume.
    """
    if not (key.startswith(VOLUMES_PREFIX) or key.startswith(MASKS_PREFIX)):
        raise VolumeError("Slice rendering is scoped to volumes/ and masks/")
    fmt = detect_source_format(key)
    try:
        data = get_object_bytes(key)
    except RuntimeError as e:
        raise VolumeError("Volume not found", status_code=404) from e
    loaded = load_volume(data, fmt)
    depth = int(loaded.volume.shape[-1])
    if depth <= 0:
        raise VolumeError("Volume has no slices", status_code=422)
    idx = depth // 2 if index is None else max(0, min(index, depth - 1))
    return volume_slice_png(loaded.volume[:, :, idx])
