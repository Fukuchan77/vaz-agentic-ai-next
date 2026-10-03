"""Print services/api's HTTP boundary as JSON for the hub's TS codegen (spec 008 R3).

Usage (from services/api, with a valid Settings environment — see the hub's
`openapi:gen` task, which supplies throwaway values):

    PYTHONPATH=. uv run python scripts/export_contract.py openapi    # OpenAPI document
    PYTHONPATH=. uv run python scripts/export_contract.py sse-events # SSE union JSON Schema

The SSE union is exported separately because `POST /v1/agent/stream` returns
`text/event-stream`, so its five event shapes never appear in the OpenAPI document.
"""

import json
import sys

from pydantic import TypeAdapter

from app.main import create_app
from app.patterns.sse import SSEEvent


def main(argv: list[str]) -> int:
    """Write the requested contract to stdout.

    Args:
        argv: Command-line arguments; argv[1] selects `openapi` or `sse-events`.

    Returns:
        Process exit code.
    """
    kind = argv[1] if len(argv) > 1 else ""
    if kind == "openapi":
        document = create_app().openapi()
    elif kind == "sse-events":
        document = TypeAdapter(SSEEvent).json_schema()
    else:
        sys.stderr.write("usage: export_contract.py {openapi|sse-events}\n")
        return 2
    sys.stdout.write(json.dumps(document, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
