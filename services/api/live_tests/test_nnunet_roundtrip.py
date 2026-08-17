"""Opt-in real nnU-Net + B2 round-trips, excluded from the normal testpaths.

The local round-trip trains a real (short) nnU-Net on tiny synthetic volumes and
runs real inference, asserting a non-empty foreground mask — the primary-feature
proof. It needs the ML stack installed and takes ~1 minute on CPU, so it is
gated behind RUN_LIVE_NNUNET_TESTS=1. The B2 round-trip is prefix-scoped and
gated behind RUN_LIVE_B2_TESTS=1.
"""

import os
import uuid

import pytest


@pytest.mark.live
def test_real_nnunet_train_and_predict():
    if os.environ.get("RUN_LIVE_NNUNET_TESTS") != "1":
        pytest.skip("set RUN_LIVE_NNUNET_TESTS=1 to run the real nnU-Net round-trip")

    from app.service import synthetic, training
    from app.service.segmentation import segment_volume

    synthetic.build_raw_dataset(num_cases=6, force=True)
    training.train_demo_model(force=True)

    volume = synthetic.make_case_nifti_bytes()
    result = segment_volume(volume, "nifti", "CT")

    assert result.foreground_voxels > 0, "segmentation produced an empty mask"
    assert result.mask_nifti[:2] == b"\x1f\x8b", "mask is not a gzip NIfTI"
    assert result.overlay_pngs, "no overlay previews rendered"


@pytest.mark.live
def test_prefix_scoped_b2_round_trip():
    if os.environ.get("RUN_LIVE_B2_TESTS") != "1":
        pytest.skip("set RUN_LIVE_B2_TESTS=1 to allow a real B2 request")

    from app.repo import delete_prefix, get_object_bytes, put_bytes

    prefix = f"_livetest/{uuid.uuid4().hex}/"
    key = f"{prefix}hello.txt"
    payload = b"nnunet-live-roundtrip"
    try:
        put_bytes(key, payload, "text/plain")
        assert get_object_bytes(key) == payload
    finally:
        deleted = delete_prefix(prefix)
        assert deleted >= 1
