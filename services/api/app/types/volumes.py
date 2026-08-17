"""Domain models for the sample-scoped Volumes explorer.

A Volume is an ingested 3D imaging file living under the `volumes/` prefix (a
`.nii.gz` or a DICOM-zip). These are compact views over B2 object listings —
the volumes themselves are the source of truth, there is no separate manifest.
Import-safe: no heavy scientific stack.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class VolumeSummary(BaseModel):
    """One ingested volume, plus the site/modality/patient parsed from its key.

    Keys seeded by `pnpm run seed` follow
    `volumes/<site>/<modality>/<patient>/<file>`; browser-ingested volumes land
    flat under `volumes/<file>` and leave the parsed fields null.
    """

    key: str
    filename: str
    size_bytes: int
    size_human: str
    uploaded_at: datetime
    site: str | None = None
    modality: str | None = None
    patient: str | None = None
