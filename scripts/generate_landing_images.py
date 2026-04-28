"""
Generate PlumberOS marketing landing photography with Google's Nano Banana
(`gemini-2.5-flash-image`). Reads prompts from `scripts/landing-images.json`
and writes JPGs into `public/landing/`. The Next.js landing page (see
`src/app/(marketing)/_components/landing-images.ts`) prefers the generated
JPG when present and falls back to the committed SVG placeholders otherwise.

Usage:

    python -m venv .venv && .venv/Scripts/activate   # (or source .venv/bin/activate)
    pip install -r scripts/requirements-landing.txt
    export GEMINI_API_KEY=...                        # Windows: $env:GEMINI_API_KEY=...
    python scripts/generate_landing_images.py

Optional flags:
    --only slot1,slot2    regenerate just these slots
    --dry-run             print prompts without calling the API

The script is safe to re-run; each call overwrites the JPG.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "scripts" / "landing-images.json"
DEFAULT_OUTPUT_DIR = ROOT / "public" / "landing"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Missing config: {CONFIG_PATH}")
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(base_style: str, negative: str, slot: dict) -> str:
    return (
        f"{slot['prompt']}\n\n"
        f"Style: {base_style}\n"
        f"Do not include: {negative}\n"
        f"Target aspect ratio: {slot['aspect_ratio']} "
        f"({slot['width']}x{slot['height']})."
    )


def decode_inline_data(part) -> bytes:
    """Extract raw bytes from a Gemini image part regardless of SDK version."""
    inline = getattr(part, "inline_data", None) or getattr(part, "inlineData", None)
    if not inline:
        return b""
    data = getattr(inline, "data", None)
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    if isinstance(data, str):
        try:
            return base64.b64decode(data)
        except Exception:
            return b""
    return b""


def save_as_jpeg(raw: bytes, dest: Path, target_size: tuple[int, int]) -> None:
    """Normalize generated image to RGB JPEG at the desired pixel dimensions."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(io.BytesIO(raw)) as img:
        img = img.convert("RGB")
        if img.size != target_size:
            img = img.resize(target_size, Image.LANCZOS)
        img.save(dest, format="JPEG", quality=88, optimize=True, progressive=True)


def run(only: set[str] | None, dry_run: bool) -> int:
    cfg = load_config()
    slots = [s for s in cfg["slots"] if (only is None or s["name"] in only)]
    if not slots:
        print("No slots matched.", file=sys.stderr)
        return 1

    if dry_run:
        for slot in slots:
            print(f"=== {slot['name']} ({slot['aspect_ratio']}) ===")
            print(build_prompt(cfg["style"], cfg["negative"], slot))
            print()
        return 0

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is not set in the environment.")

    try:
        from google import genai
    except ImportError as exc:
        raise SystemExit(
            "google-genai is required. Run: pip install -r scripts/requirements-landing.txt"
        ) from exc

    client = genai.Client(api_key=api_key)
    model = cfg.get("model", "gemini-2.5-flash-image")

    for slot in slots:
        name = slot["name"]
        target_size = (int(slot["width"]), int(slot["height"]))
        slot_out_dir = slot.get("output_dir")
        if slot_out_dir:
            out_dir = (ROOT / slot_out_dir).resolve()
        else:
            out_dir = DEFAULT_OUTPUT_DIR
        dest = out_dir / f"{name}.jpg"
        print(f"[{name}] generating ({target_size[0]}x{target_size[1]}) -> {dest}")

        prompt = build_prompt(cfg["style"], cfg["negative"], slot)
        response = client.models.generate_content(model=model, contents=prompt)

        candidates = getattr(response, "candidates", None) or []
        raw: bytes = b""
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                raw = decode_inline_data(part)
                if raw:
                    break
            if raw:
                break

        if not raw:
            print(f"  ! no image bytes returned for slot '{name}', skipping.", file=sys.stderr)
            continue

        save_as_jpeg(raw, dest, target_size)
        try:
            rel = dest.relative_to(ROOT)
        except ValueError:
            rel = dest
        print(f"  ok -> {rel}")

    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate PlumberOS landing imagery.")
    parser.add_argument(
        "--only",
        type=str,
        default="",
        help="Comma-separated slot names to regenerate (default: all).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts without contacting the API.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    only = {s.strip() for s in args.only.split(",") if s.strip()} or None
    return run(only=only, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
