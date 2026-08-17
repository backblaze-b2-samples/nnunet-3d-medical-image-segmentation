"""Seed B2 with a full, REAL nnU-Net cohort — the write-amplification story.

`pnpm run seed` runs this end to end:
  1. Generate N tiny synthetic labeled volumes (bright ellipsoid lesion in noise).
  2. Upload the raw volumes to B2 under `volumes/<site>/<modality>/<patient>/`.
  3. Run a REAL short nnU-Net train (preprocess -> ~1 epoch) to mint the checkpoint.
  4. Archive the checkpoint tarball to `checkpoints/` (the model lives on B2).
  5. Upload the preprocessed tensors to `preprocessed/` (the fan-out).
  6. Run real inference on a couple of volumes -> example masks under `masks/`.
  7. Write a cohort manifest JSONL to `manifests/`.

Idempotent: skips training if a checkpoint already exists locally or on B2
(unless --force). Keep --cases small (default 8) so the whole run is
minutes-scale on CPU; pass a larger value for the scale story.

Reads B2 credentials from the repo-root .env exactly like the app. Never prints
credentials.
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import sys
import tarfile
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.config import settings  # noqa: E402
from app.repo import get_object_bytes, put_bytes  # noqa: E402
from app.service import synthetic, training  # noqa: E402
from app.service.nnunet_env import (  # noqa: E402
    DATASET_NAME,
    checkpoint_object_key,
    checkpoint_path,
    configure_paths,
    raw_dataset_dir,
    results_dataset_dir,
)
from app.service.segmentation import segment_volume  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("seed")

# Round-robin site/modality assignment for the cohort keys.
_SITES = ["site-a", "site-b"]
_MODALITIES = ["CT", "MRI"]


def _require_b2() -> None:
    missing = [
        name
        for attr, name in (
            ("b2_application_key_id", "B2_APPLICATION_KEY_ID"),
            ("b2_application_key", "B2_APPLICATION_KEY"),
            ("b2_bucket_name", "B2_BUCKET_NAME"),
            ("b2_region", "B2_REGION"),
        )
        if not getattr(settings, attr)
    ]
    if missing:
        logger.error("Missing B2 configuration: %s. Fill .env first.", ", ".join(missing))
        raise SystemExit(2)


def _checkpoint_on_b2() -> bool:
    try:
        get_object_bytes(checkpoint_object_key())
        return True
    except RuntimeError:
        return False


def _upload_volumes(num_cases: int) -> list[dict]:
    """Upload each raw volume under volumes/<site>/<modality>/<patient>/ and
    return cohort rows."""
    images_dir = raw_dataset_dir() / "imagesTr"
    rows: list[dict] = []
    for i in range(num_cases):
        case = f"lesion_{i:03d}"
        src = images_dir / f"{case}_0000.nii.gz"
        if not src.exists():
            continue
        site = _SITES[i % len(_SITES)]
        modality = _MODALITIES[i % len(_MODALITIES)]
        patient = f"patient-{i:03d}"
        key = f"volumes/{site}/{modality}/{patient}/{case}.nii.gz"
        put_bytes(key, src.read_bytes(), "application/gzip")
        rows.append(
            {
                "patient_id": patient,
                "site": site,
                "modality": modality,
                "volume_key": key,
                "task": DATASET_NAME,
            }
        )
    logger.info("Uploaded %d raw volumes under volumes/", len(rows))
    return rows


def _upload_checkpoint() -> None:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        tar.add(results_dataset_dir(), arcname=DATASET_NAME)
    put_bytes(checkpoint_object_key(), buffer.getvalue(), "application/gzip")
    logger.info("Archived checkpoint to B2: %s", checkpoint_object_key())


def _upload_preprocessed() -> int:
    pre = configure_paths()["preprocessed"] / DATASET_NAME
    count = 0
    for path in sorted(pre.rglob("*")):
        if path.is_file() and path.suffix in (".npz", ".npy", ".json", ".pkl"):
            rel = path.relative_to(pre)
            put_bytes(f"preprocessed/{DATASET_NAME}/{rel}", path.read_bytes(),
                      "application/octet-stream")
            count += 1
    logger.info("Uploaded %d preprocessed artifacts under preprocessed/", count)
    return count


def _seed_example_masks(rows: list[dict], num_examples: int = 2) -> None:
    for row in rows[:num_examples]:
        source = get_object_bytes(row["volume_key"])
        result = segment_volume(source, "nifti", row["modality"])
        case = row["volume_key"].rsplit("/", 1)[-1].removesuffix(".nii.gz")
        mask_key = f"masks/seed/{case}/segmentation.nii.gz"
        put_bytes(mask_key, result.mask_nifti, "application/gzip")
        for index, png in enumerate(result.overlay_pngs):
            put_bytes(f"masks/seed/{case}/overlay_{index:03d}.png", png, "image/png")
        row["mask_key"] = mask_key
        logger.info("Seeded example mask: %s (fg voxels=%d)", mask_key, result.foreground_voxels)


def _upload_manifest(rows: list[dict]) -> None:
    body = "\n".join(json.dumps(r) for r in rows).encode("utf-8")
    put_bytes("manifests/cohort.jsonl", body, "application/x-ndjson")
    logger.info("Wrote cohort manifest: manifests/cohort.jsonl (%d rows)", len(rows))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=int, default=8, help="Synthetic volumes to generate")
    parser.add_argument("--force", action="store_true", help="Retrain even if a checkpoint exists")
    args = parser.parse_args()

    _require_b2()
    configure_paths()

    logger.info("Generating %d synthetic volumes...", args.cases)
    synthetic.build_raw_dataset(num_cases=args.cases, force=args.force)
    rows = _upload_volumes(args.cases)

    have_local = checkpoint_path().exists()
    if not args.force and (have_local or _checkpoint_on_b2()):
        logger.info("Checkpoint already present (local=%s); skipping training.", have_local)
        if not have_local:
            # Model is on B2 but not local — inference will pull it on demand.
            logger.info("Model available on B2 at %s", checkpoint_object_key())
    else:
        logger.info("Training a real short nnU-Net model...")
        training.train_demo_model(force=args.force)
        _upload_checkpoint()
        _upload_preprocessed()

    if checkpoint_path().exists():
        _seed_example_masks(rows)
    _upload_manifest(rows)

    logger.info("Seed complete. Bucket now holds volumes/, checkpoints/, "
                "preprocessed/, masks/, manifests/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
