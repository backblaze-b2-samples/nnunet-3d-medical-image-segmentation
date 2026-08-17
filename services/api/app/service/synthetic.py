"""Synthetic labeled-volume generator for the demo task.

The task is a bright ellipsoid "lesion" in noise — deliberately chosen because
nnU-Net learns it well in a very short training run, so the real masks look
correct at a screenshot-fast scale. Used by the seed (`pnpm run seed`) to mint
training data and by the live round-trip test.

All heavy imports (numpy, nibabel) are lazy. No torch/nnunetv2 here.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.service.nnunet_env import DATASET_NAME, raw_dataset_dir

DEFAULT_SHAPE = (64, 64, 64)
DEFAULT_SPACING = (1.5, 1.5, 1.5)


def make_case(shape=DEFAULT_SHAPE, rng=None):
    """Return (image float32, label uint8) — a bright ellipsoid in CT-like noise."""
    import numpy as np

    rng = rng or np.random.default_rng()
    zz, yy, xx = np.indices(shape).astype(np.float32)
    # Random ellipsoid center (kept well inside the volume) and radii.
    center = [rng.uniform(0.35, 0.65) * s for s in shape]
    radii = [rng.uniform(0.12, 0.22) * s for s in shape]
    dist = (
        ((zz - center[0]) / radii[0]) ** 2
        + ((yy - center[1]) / radii[1]) ** 2
        + ((xx - center[2]) / radii[2]) ** 2
    )
    label = (dist <= 1.0).astype(np.uint8)

    image = rng.normal(loc=100.0, scale=15.0, size=shape).astype(np.float32)
    # The lesion is markedly brighter than background (CT-like HU contrast).
    image[label == 1] += rng.uniform(250.0, 350.0)
    return image, label


def _save_nifti(array, spacing, path: Path) -> None:
    import nibabel as nib
    import numpy as np

    affine = np.diag([spacing[0], spacing[1], spacing[2], 1.0]).astype(np.float32)
    nib.save(nib.Nifti1Image(np.asarray(array), affine), str(path))


def build_raw_dataset(num_cases: int = 8, shape=DEFAULT_SHAPE, force: bool = False) -> Path:
    """Write an nnU-Net raw dataset of synthetic cases under `nnUNet_raw/`.

    Idempotent: returns the existing dataset unless `force` is set. Produces the
    canonical layout (imagesTr/<case>_0000.nii.gz, labelsTr/<case>.nii.gz,
    dataset.json) nnU-Net's planner/preprocessor expect.
    """
    import numpy as np

    root = raw_dataset_dir()
    dataset_json = root / "dataset.json"
    if dataset_json.exists() and not force:
        return root

    images = root / "imagesTr"
    labels = root / "labelsTr"
    images.mkdir(parents=True, exist_ok=True)
    labels.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(1234)
    for i in range(num_cases):
        case = f"lesion_{i:03d}"
        image, label = make_case(shape, rng)
        _save_nifti(image, DEFAULT_SPACING, images / f"{case}_0000.nii.gz")
        _save_nifti(label, DEFAULT_SPACING, labels / f"{case}.nii.gz")

    dataset_json.write_text(
        json.dumps(
            {
                "channel_names": {"0": "CT"},
                "labels": {"background": 0, "lesion": 1},
                "numTraining": num_cases,
                "file_ending": ".nii.gz",
                "name": DATASET_NAME,
                "description": "Synthetic bright-lesion demo task for nnU-Net.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return root


def make_case_nifti_bytes(shape=DEFAULT_SHAPE, rng=None) -> bytes:
    """A single synthetic volume as .nii.gz bytes (for ad-hoc inference tests)."""
    import tempfile

    image, _ = make_case(shape, rng)
    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
        path = Path(tmp.name)
    try:
        _save_nifti(image, DEFAULT_SPACING, path)
        return path.read_bytes()
    finally:
        path.unlink()
