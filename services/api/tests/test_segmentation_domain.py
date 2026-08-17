"""Fast, hermetic tests for the segmentation domain (no ML training, no B2).

These exercise the import-safe surfaces: synthetic data generation, device
selection, slice rendering, and job/volume validation paths that raise BEFORE
any B2 write. The heavy real nnU-Net round-trip lives in live_tests/.
"""

import numpy as np
import pytest

from app.service import device, rendering, synthetic, volumes
from app.service.jobs import JobValidationError, create_job
from app.types.jobs import JobCreate


def test_synthetic_case_has_foreground():
    image, label = synthetic.make_case(shape=(32, 32, 32))
    assert image.shape == (32, 32, 32)
    assert label.shape == (32, 32, 32)
    # The lesion voxels must exist and be brighter than background.
    assert int(label.sum()) > 0
    assert image[label == 1].mean() > image[label == 0].mean()


def test_device_resolver_never_requires_gpu():
    # Explicit cpu always resolves to cpu; auto falls back to cpu when no
    # accelerator is present — never raises.
    assert device.resolve_device("cpu") == "cpu"
    assert device.resolve_device("auto") in {"cpu", "cuda", "mps"}


def test_overlay_render_produces_png():
    vol = np.random.default_rng(0).normal(size=(16, 16))
    mask = np.zeros((16, 16), dtype=np.int16)
    mask[4:8, 4:8] = 1
    png = rendering.overlay_slice_png(vol, mask)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"


def test_detect_source_format():
    assert volumes.detect_source_format("volumes/a.nii.gz") == "nifti"
    assert volumes.detect_source_format("volumes/a.nii") == "nifti"
    assert volumes.detect_source_format("volumes/a.zip") == "dicom_zip"
    with pytest.raises(volumes.VolumeError):
        volumes.detect_source_format("volumes/a.txt")


def test_create_job_rejects_unknown_model():
    with pytest.raises(JobValidationError):
        create_job(
            JobCreate(
                name="x",
                input_volume_key="volumes/a.nii.gz",
                model="does-not-exist",
            )
        )


def test_create_job_rejects_non_volume_key():
    with pytest.raises(JobValidationError):
        create_job(
            JobCreate(name="x", input_volume_key="uploads/a.nii.gz", model="demo-lesion")
        )
