"""Runtime device selection for the nnU-Net engine.

Never hard-requires a GPU. `resolve_device` auto-detects CUDA -> Apple MPS ->
CPU (default CPU) for the general preference, and `resolve_nnunet_device`
applies nnU-Net's own constraint: its 3D convolution/resampling ops are not
fully implemented on Apple MPS, so an `mps` preference is downgraded to `cpu`
(logged) rather than risking a mid-inference op error. This is the "MPS -> CPU
fallback" the build plan calls for, applied proactively so a run never crashes.

torch is imported lazily inside the functions so the FastAPI app and pytest
collection stay import-safe without the scientific stack installed.
"""

from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)


def resolve_device(override: str | None = None) -> str:
    """Pick a compute device string. Preference for `auto`: CUDA, MPS, CPU.

    An explicit `cpu`/`cuda`/`mps` is honored but still falls back to CPU when
    that backend is unavailable, so this never hard-requires a GPU. Source:
    `override`, else the `NNUNET_DEVICE` setting (default `auto`).
    """
    import torch

    pref = (override or settings.nnunet_device or "auto").lower()

    def has_cuda() -> bool:
        return bool(torch.cuda.is_available())

    def has_mps() -> bool:
        backend = getattr(torch.backends, "mps", None)
        return bool(backend and backend.is_available())

    if pref == "cpu":
        return "cpu"
    if pref == "cuda":
        return "cuda" if has_cuda() else "cpu"
    if pref == "mps":
        return "mps" if has_mps() else "cpu"
    # auto
    if has_cuda():
        return "cuda"
    if has_mps():
        return "mps"
    return "cpu"


def resolve_nnunet_device(override: str | None = None):
    """Return a `torch.device` safe for nnU-Net (CUDA or CPU only).

    nnU-Net does not reliably support Apple MPS for 3D ops, so a resolved `mps`
    preference is downgraded to `cpu` and logged. Returns a real `torch.device`
    ready to hand to `nnUNetPredictor` / the trainer.
    """
    import torch

    label = resolve_device(override)
    if label == "mps":
        logger.info("nnU-Net does not support Apple MPS for 3D ops; using CPU instead.")
        label = "cpu"
    return torch.device(label)
