"""The nnU-Net segmentation engine — the REAL primary feature.

Runs genuine `nnunetv2` inference (`nnUNetPredictor`) on a 3D volume and returns
a real NIfTI segmentation mask plus mid-slice overlay previews. There is no
mock/threshold fallback: the mask is produced by the trained network or the run
fails.

ALL heavy scientific imports (torch, nnunetv2, nibabel, numpy) are LAZY, done
inside functions, so the FastAPI app and pytest collection load without the ML
stack. Never move them to module top level. Per the repo layering, this lives
in `service/` (not `repo/`, which is the boto3-only surface).

Model resolution demonstrates "the model lives on B2": if the trained checkpoint
is not in the local `.data/nnUNet_results/` cache, it is pulled from B2
(`checkpoints/`) and extracted before inference.
"""

from __future__ import annotations

import io
import logging
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.repo import get_object_bytes
from app.service.device import resolve_nnunet_device
from app.service.nnunet_env import (
    CHECKPOINT_NAME,
    FOLD,
    LABELS,
    checkpoint_object_key,
    checkpoint_path,
    configure_paths,
    data_root,
    model_folder,
)
from app.service.rendering import render_overlay_previews
from app.service.volume_io import load_volume
from app.types.jobs import MAX_PREVIEW_SLICES

logger = logging.getLogger(__name__)


class ModelUnavailableError(RuntimeError):
    """Raised when no trained checkpoint is available locally or on B2."""


@dataclass
class SegmentationOutput:
    mask_nifti: bytes
    overlay_pngs: list          # list[bytes] — PNG per axial slice
    labels: list                # list[dict]: label, name, voxels, volume_ml
    spacing: list               # [sx, sy, sz] mm
    shape: list                 # mask shape
    device: str
    foreground_voxels: int


# --- Model resolution (local cache, else pull from B2) ---------------------

def ensure_model_available() -> None:
    """Guarantee the trained checkpoint is on local disk.

    Uses the gitignored `.data/nnUNet_results/` cache if present; otherwise
    downloads the archived model tarball from B2 (`checkpoints/`) and extracts
    it. Raises ModelUnavailableError if neither source has the model — the seed
    (`pnpm run seed`) mints and uploads it.
    """
    configure_paths()
    if checkpoint_path().exists():
        return

    key = checkpoint_object_key()
    logger.info("Model not cached locally; pulling checkpoint from B2: %s", key)
    try:
        data = get_object_bytes(key)
    except RuntimeError as e:
        raise ModelUnavailableError(
            "No trained nnU-Net model found locally or on B2 "
            f"({key}). Run `pnpm run seed` to train and archive it."
        ) from e

    results_root = data_root() / "nnUNet_results"
    results_root.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        # filter="data" (Python 3.12) blocks path traversal / device nodes.
        tar.extractall(results_root, filter="data")

    if not checkpoint_path().exists():
        raise ModelUnavailableError(
            f"Checkpoint tarball {key} did not contain {CHECKPOINT_NAME}."
        )


# --- NIfTI helpers ---------------------------------------------------------

def _write_input_nifti(volume, affine, path: Path) -> None:
    import nibabel as nib
    import numpy as np

    image = nib.Nifti1Image(
        np.asarray(volume, dtype=np.float32), np.asarray(affine, dtype=np.float32)
    )
    nib.save(image, str(path))


def _label_volumes(mask, spacing) -> list[dict]:
    import numpy as np

    voxel_ml = (spacing[0] * spacing[1] * spacing[2]) / 1000.0
    out: list[dict] = []
    for label_id in sorted(int(v) for v in np.unique(mask)):
        if label_id == 0:
            continue
        voxels = int((mask == label_id).sum())
        out.append(
            {
                "label": label_id,
                "name": LABELS.get(label_id, f"label_{label_id}"),
                "voxels": voxels,
                "volume_ml": round(voxels * voxel_ml, 3),
            }
        )
    return out


def _predict(predictor, in_path: Path, out_trunc: Path) -> None:
    """Run inference sequentially (no worker subprocesses — CPU/macOS safe)."""
    lists = [[str(in_path)]]
    outputs = [str(out_trunc)]
    if hasattr(predictor, "predict_from_files_sequential"):
        predictor.predict_from_files_sequential(
            lists, outputs, save_probabilities=False, overwrite=True,
            folder_with_segs_from_prev_stage=None,
        )
    else:  # older nnunetv2 without the sequential helper
        predictor.predict_from_files(
            lists, outputs, save_probabilities=False, overwrite=True,
            num_processes_preprocessing=1, num_processes_segmentation_export=1,
        )


# --- Public entry point ----------------------------------------------------

def segment_volume(source_bytes: bytes, source_format: str, modality: str) -> SegmentationOutput:
    """Run real nnU-Net inference on one volume. Returns mask + overlays.

    `modality` is carried for provenance; the demo task is modality-agnostic
    (it segments a bright lesion), so it does not branch the pipeline.
    """
    import numpy as np
    from nnunetv2.inference.predict_from_raw_data import nnUNetPredictor

    ensure_model_available()
    device = resolve_nnunet_device()

    loaded = load_volume(source_bytes, source_format)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        in_path = tmpdir / "case_0000.nii.gz"
        # Feed nnU-Net a canonical .nii.gz built from the loaded geometry — one
        # uniform path for both NIfTI uploads and DICOM-zip series.
        _write_input_nifti(loaded.volume, loaded.affine, in_path)

        predictor = nnUNetPredictor(
            tile_step_size=0.5,
            use_gaussian=True,
            use_mirroring=False,
            perform_everything_on_device=(device.type == "cuda"),
            device=device,
            verbose=False,
            verbose_preprocessing=False,
            allow_tqdm=False,
        )
        predictor.initialize_from_trained_model_folder(
            str(model_folder()), use_folds=(FOLD,), checkpoint_name=CHECKPOINT_NAME
        )
        _predict(predictor, in_path, tmpdir / "case_seg")
        mask_bytes = (tmpdir / "case_seg.nii.gz").read_bytes()

    # Canonicalize the mask the same way as the source so overlays align.
    mask = np.asarray(load_volume(mask_bytes, "nifti").volume).astype(np.int16)
    overlays = render_overlay_previews(loaded.volume, mask, MAX_PREVIEW_SLICES)
    labels = _label_volumes(mask, loaded.spacing)
    fg = int((mask > 0).sum())
    logger.info("Segmentation complete: device=%s foreground_voxels=%d", device, fg)

    return SegmentationOutput(
        mask_nifti=mask_bytes,
        overlay_pngs=overlays,
        labels=labels,
        spacing=[float(s) for s in loaded.spacing],
        shape=[int(v) for v in mask.shape],
        device=str(device),
        foreground_voxels=fg,
    )
