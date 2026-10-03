"""Live-contract guard for the hub's committed TS snapshots (spec `008` R3).

`mise run openapi:gen` (hub root) exports this lane's OpenAPI document and SSE
union into `packages/schemas/src/generated/api-service.*`, and the hub's TS drift
test (`packages/schemas/tests/api-service-contract-drift.spec.ts`) checks the TS
side against *those snapshots*. Neither side notices when the Python models
change and nobody re-runs the export - this test closes that gap by comparing
the live app against the committed snapshots, so a boundary change fails this
lane's CI until the snapshots (and the thin Zod schemas) are regenerated.
"""

import json
from pathlib import Path

import pytest
from pydantic import TypeAdapter

from app.main import create_app
from app.patterns.sse import SSEEvent
from tests.conftest import build_test_settings


GENERATED_DIR = Path(__file__).resolve().parents[4] / "packages" / "schemas" / "src" / "generated"
OPENAPI_SNAPSHOT = GENERATED_DIR / "api-service.openapi.snapshot.json"
SSE_SNAPSHOT = GENERATED_DIR / "api-service.sse-events.schema.json"

_HINT = "services/api's HTTP boundary changed: run `mise run openapi:gen` from the hub root"

pytestmark = pytest.mark.skipif(
    not GENERATED_DIR.is_dir(),
    reason="not running inside the vaz-agentic-ai-next hub (no packages/schemas)",
)


def test_openapi_document_matches_committed_snapshot() -> None:
    """The live OpenAPI document equals the snapshot the TS types were generated from."""
    live = create_app(settings=build_test_settings()).openapi()
    assert live == json.loads(OPENAPI_SNAPSHOT.read_text()), _HINT


def test_sse_event_schema_matches_committed_snapshot() -> None:
    """The live SSE union's JSON Schema equals the snapshot the Zod union is checked against."""
    live = TypeAdapter(SSEEvent).json_schema()
    assert live == json.loads(SSE_SNAPSHOT.read_text()), _HINT
