"""Shared nnU-Net environment + dataset constants.

nnU-Net is driven entirely by three environment variables (`nnUNet_raw`,
`nnUNet_preprocessed`, `nnUNet_results`) that it reads when `nnunetv2.paths` is
imported. `configure_paths()` points them at gitignored `.data/` subdirs and
MUST run before any `nnunetv2` import — the segmentation engine, the trainer,
and the seed script all call it first.

No heavy imports here (no torch/nnunetv2), so this stays import-safe and can be
shared by every layer without pulling the scientific stack into test
collection.
"""

from __future__ import annotations

import os
from pathlib import Path

# services/api — the .data/ dir lives here (gitignored), alongside the venv.
_API_ROOT = Path(__file__).resolve().parents[2]
_DATA_ROOT = Path(os.getenv("NNUNET_DATA_DIR", str(_API_ROOT / ".data")))

# The single demo task the seed trains and the app serves inference from.
DATASET_ID = 1
DATASET_NAME = "Dataset001_DemoLesion"
CONFIGURATION = "3d_fullres"
FOLD = 0
TRAINER = "nnUNetTrainer"
PLANS = "nnUNetPlans"
CHECKPOINT_NAME = "checkpoint_final.pth"

# Label ids produced by the demo task (background + one lesion).
LABELS = {0: "background", 1: "lesion"}


def data_root() -> Path:
    return _DATA_ROOT


def configure_paths() -> dict[str, Path]:
    """Point nnU-Net's env vars at gitignored `.data/` dirs. Idempotent.

    Also sets a couple of safety defaults for tiny CPU runs on macOS: a single
    data-augmentation worker (nnU-Net also reuses this value as a torch thread
    count in its planner, which rejects 0) and no torch.compile (slow/fragile on
    CPU). Call this BEFORE importing nnunetv2.
    """
    raw = _DATA_ROOT / "nnUNet_raw"
    preprocessed = _DATA_ROOT / "nnUNet_preprocessed"
    results = _DATA_ROOT / "nnUNet_results"
    for path in (raw, preprocessed, results):
        path.mkdir(parents=True, exist_ok=True)
    # nnU-Net reads these EXACT mixed-case env var names; do not uppercase them.
    os.environ["nnUNet_raw"] = str(raw)  # noqa: SIM112
    os.environ["nnUNet_preprocessed"] = str(preprocessed)  # noqa: SIM112
    os.environ["nnUNet_results"] = str(results)  # noqa: SIM112
    os.environ.setdefault("nnUNet_n_proc_DA", "1")
    os.environ.setdefault("nnUNet_compile", "0")
    return {"raw": raw, "preprocessed": preprocessed, "results": results}


def raw_dataset_dir() -> Path:
    return _DATA_ROOT / "nnUNet_raw" / DATASET_NAME


def results_dataset_dir() -> Path:
    return _DATA_ROOT / "nnUNet_results" / DATASET_NAME


def model_folder() -> Path:
    """The trainer output dir nnUNetPredictor is initialized from."""
    return results_dataset_dir() / f"{TRAINER}__{PLANS}__{CONFIGURATION}"


def checkpoint_path() -> Path:
    return model_folder() / f"fold_{FOLD}" / CHECKPOINT_NAME


def checkpoint_object_key() -> str:
    """B2 key for the archived model tarball (the model that lives on B2)."""
    from app.config import settings

    return f"{settings.model_prefix}{DATASET_NAME}.tar.gz"
