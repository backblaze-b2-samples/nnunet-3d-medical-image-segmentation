"""Programmatic short nnU-Net training — mints the checkpoint the app serves.

Called once at seed time (`pnpm run seed`). It runs a REAL nnU-Net pipeline
(fingerprint -> plan -> preprocess -> train) on the tiny synthetic dataset the
seed generates, but with a deliberately short trainer (1 epoch, ~25 iterations)
so it finishes in minutes on CPU. The result is a genuine `checkpoint_final.pth`
the inference engine (`service/segmentation.py`) loads.

The trainer length is set by instantiating `nnUNetTrainer` directly and
overriding its iteration counts — no custom trainer class needs to be
registered inside the installed package. All heavy imports are lazy.
"""

from __future__ import annotations

import logging

from app.service.device import resolve_nnunet_device
from app.service.nnunet_env import (
    CONFIGURATION,
    DATASET_ID,
    DATASET_NAME,
    FOLD,
    PLANS,
    checkpoint_path,
    configure_paths,
)

logger = logging.getLogger(__name__)

# Short-run knobs. Small enough for a minutes-scale CPU train on tiny volumes,
# large enough that the network actually learns the synthetic lesion so masks
# look correct (see docs/features/segmentation.md).
NUM_EPOCHS = 1
NUM_ITERATIONS_PER_EPOCH = 25
NUM_VAL_ITERATIONS_PER_EPOCH = 2


def preprocess_dataset() -> None:
    """Run nnU-Net fingerprint extraction, planning, and preprocessing.

    Operates on the raw dataset the seed wrote to `nnUNet_raw/`. Uses a single
    worker process so it stays stable on macOS spawn with tiny inputs.
    """
    configure_paths()
    from nnunetv2.experiment_planning.plan_and_preprocess_api import (
        extract_fingerprints,
        plan_experiments,
        preprocess,
    )

    logger.info("nnU-Net: extracting dataset fingerprint (id=%d)", DATASET_ID)
    extract_fingerprints([DATASET_ID], num_processes=1, check_dataset_integrity=True)
    logger.info("nnU-Net: planning experiment")
    plan_experiments([DATASET_ID])
    logger.info("nnU-Net: preprocessing configuration=%s", CONFIGURATION)
    preprocess([DATASET_ID], configurations=[CONFIGURATION], num_processes=[1])


def _run_short_training() -> None:
    from batchgenerators.utilities.file_and_folder_operations import join, load_json
    from nnunetv2.paths import nnUNet_preprocessed
    from nnunetv2.training.nnUNetTrainer.nnUNetTrainer import nnUNetTrainer

    device = resolve_nnunet_device()
    preprocessed = join(nnUNet_preprocessed, DATASET_NAME)
    plans = load_json(join(preprocessed, f"{PLANS}.json"))
    dataset_json = load_json(join(preprocessed, "dataset.json"))

    trainer = nnUNetTrainer(
        plans=plans,
        configuration=CONFIGURATION,
        fold=FOLD,
        dataset_json=dataset_json,
        device=device,
    )
    # Override for a short-but-real run before initialize() builds the loop.
    trainer.num_epochs = NUM_EPOCHS
    trainer.num_iterations_per_epoch = NUM_ITERATIONS_PER_EPOCH
    trainer.num_val_iterations_per_epoch = NUM_VAL_ITERATIONS_PER_EPOCH
    logger.info(
        "nnU-Net: training on %s (epochs=%d iters/epoch=%d, device=%s)",
        device, NUM_EPOCHS, NUM_ITERATIONS_PER_EPOCH, device,
    )
    trainer.run_training()  # saves checkpoint_final.pth via on_train_end()


def train_demo_model(force: bool = False) -> str:
    """Preprocess + short-train the demo task. Returns the checkpoint path.

    Idempotent: if a checkpoint already exists and `force` is False, this is a
    no-op — the seed uses that to skip retraining on re-runs.
    """
    configure_paths()
    if checkpoint_path().exists() and not force:
        logger.info("Checkpoint already present, skipping training: %s", checkpoint_path())
        return str(checkpoint_path())

    preprocess_dataset()
    _run_short_training()

    if not checkpoint_path().exists():
        raise RuntimeError(
            f"Training finished but {checkpoint_path()} was not written."
        )
    logger.info("Training complete: %s", checkpoint_path())
    return str(checkpoint_path())
