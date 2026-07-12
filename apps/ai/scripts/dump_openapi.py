#!/usr/bin/env python3
"""Write the FastAPI OpenAPI schema to apps/ai/openapi.json (no secrets required)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "openapi.json"

DUMMY_ENV: dict[str, str] = {
    "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "dummy-anon-key",
    "OPENAI_API_KEY": "dummy-openai-key",
    "ANTHROPIC_API_KEY": "dummy-anthropic-key",
    "EVAL_USER_EMAIL": "eval@example.com",
    "EVAL_USER_PASSWORD": "dummy-password",
}


def main() -> None:
    os.chdir(ROOT)
    for key, value in DUMMY_ENV.items():
        os.environ[key] = value

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    from app.main import app

    schema = app.openapi()
    OUTPUT.write_text(
        json.dumps(schema, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
