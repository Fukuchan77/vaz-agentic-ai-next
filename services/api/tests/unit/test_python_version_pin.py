"""Guard that the Python toolchain is pinned, not merely floored.

`pyproject.toml` declares `requires-python = ">=3.13"`, which is a floor: any
newer interpreter satisfies it. With nothing pinning the actual version, CI
resolved a newer CPython than local development had, and the suite failed 63
tests with 12 errors on that difference alone (PR CI run 31880991303) while the
identical commit passed locally.

The mechanism was specific to this project's dependency pins at the time:
Python 3.14 deprecates `asyncio.iscoroutinefunction`, `starlette` 0.52.x and
`slowapi` 0.1.10 both called it, and `filterwarnings =
["error::DeprecationWarning"]` turned each call into a hard failure. Both are
gone since 2026-10-03 (slowapi removed, starlette on 1.x), but the general
lesson stands: the bare filter makes every interpreter change a re-census, so
the version stays pinned and moves only as a reviewed change (3.14 next;
3.15 lacks onnxruntime/torch wheels for this dependency set).

Path note (2026-09-21, spec `006-repo-consolidation` Task 6): this repo now
lives at `services/api` of the `vaz-agentic-ai-next` hub. `test_mise_pins_the_same_python_series`
was removed rather than repointed: the hub's root `mise.toml` deliberately does
not carry a `[tools].python` pin for this lane (or for `services/agent`, its
sibling) - each independent Python lane provisions its interpreter from its own
`.python-version` via `uv`, so there is no second pin left to drift out of
agreement with it. The single-source-of-truth structure this test used to
enforce by comparison is now enforced by construction (there is nothing else
to compare against); the remaining three tests below (which check
`.python-version` itself, that it satisfies `requires-python`, and that the
interpreter actually running the suite matches it) still guard the real risk.
"""

import tomllib
from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parents[2]
PYTHON_VERSION_FILE = _REPO_ROOT / ".python-version"
PYPROJECT = _REPO_ROOT / "pyproject.toml"

_EXPECTED_SERIES = "3.13"


def test_python_version_file_pins_the_series() -> None:
    """`.python-version` is what `uv` reads to choose an interpreter."""
    assert PYTHON_VERSION_FILE.is_file(), (
        ".python-version is missing; uv would fall back to resolving the newest "
        "interpreter allowed by requires-python"
    )
    assert PYTHON_VERSION_FILE.read_text(encoding="utf-8").strip() == _EXPECTED_SERIES


def test_pinned_series_satisfies_requires_python() -> None:
    """The pin must sit inside the range the package declares it supports."""
    config = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    requires_python = config["project"]["requires-python"]

    floor = requires_python.removeprefix(">=").split(",")[0].strip()
    pinned_parts = tuple(int(part) for part in _EXPECTED_SERIES.split("."))
    floor_parts = tuple(int(part) for part in floor.split("."))

    assert pinned_parts >= floor_parts, (
        f"pinned Python {_EXPECTED_SERIES} is below requires-python {requires_python}"
    )


def test_running_interpreter_matches_the_pin() -> None:
    """The interpreter actually executing the suite is the pinned one.

    This is the assertion that would have failed in CI instead of 63 unrelated
    tests failing with an opaque DeprecationWarning.
    """
    import sys

    running = f"{sys.version_info.major}.{sys.version_info.minor}"
    assert running == _EXPECTED_SERIES, (
        f"tests are running on Python {running}, not the pinned {_EXPECTED_SERIES}. "
        f"filterwarnings turns any deprecation into a hard failure, so an interpreter "
        f"change must re-run the warnings census before moving the pin."
    )
