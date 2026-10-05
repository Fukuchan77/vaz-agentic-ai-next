"""Inventory test: every direct Model.request() call site.

REQ-032 (spec 009 task 6.3): all places in `services/api` that call
`Model.request()` directly (bypassing `Agent.run()` / `Agent.iter()`) must be
listed here and each must carry a documented reason for the bypass.

At time of spec 009 audit (2026-10), only one call site exists:
`app/api/health.py::_probe_llm_provider` — the readiness probe that checks
LLM provider connectivity with a minimal single-token request. It intentionally
passes no tools (the probe only checks connectivity, not tool routing) and uses
`max_tokens: 1` to minimise cost.

This test will fail if a new direct `Model.request()` call is introduced without
updating both this inventory and the evidence document
(`services/api/docs/python-beta-intake-2026-10.md`).
"""

from __future__ import annotations

import ast
from pathlib import Path


# Path to services/api/app — three parents up from tests/unit/<file>.
_SERVICES_API_APP_DIR = Path(__file__).resolve().parent.parent.parent / "app"

# Every approved direct Model.request() call site.
# Format: (relative_path_from_services_api, function_name, reason)
# To add a new call site: add an entry here AND update the evidence doc.
_APPROVED_CALL_SITES: tuple[tuple[str, str, str], ...] = (
    (
        "app/api/health.py",
        "_probe_llm_provider",
        # REQ-032: intentional direct call; the readiness probe needs only a
        # round-trip proof-of-life, not tool routing — passing no tools is correct
        # behaviour, not an omission.  max_tokens=1 minimises billable cost.
        "readiness probe: intentional direct call without tools",
    ),
)


def _collect_direct_model_request_calls(app_dir: Path) -> list[tuple[str, str]]:
    """Walk all Python source files under `app_dir` and find `Model.request()` calls.

    Uses AST inspection to find any attribute call whose method name is "request"
    and whose receiver resolves to a variable named "model" (the conventional name
    for a `Model` or `FallbackModel` instance in this codebase).

    Returns:
        List of (relative_path, enclosing_function_name) tuples for every match.
    """
    found: list[tuple[str, str]] = []

    for py_file in sorted(app_dir.rglob("*.py")):
        if "__pycache__" in py_file.parts:
            continue
        source = py_file.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            continue

        rel_path = str(py_file.relative_to(app_dir.parent))

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            # Match `<something>.request(...)` where <something> is a Name node
            # — catches `model.request(...)` and similar patterns.
            if (
                isinstance(func, ast.Attribute)
                and func.attr == "request"
                and isinstance(func.value, ast.Name)
            ):
                # Find the enclosing function definition.
                enclosing = _enclosing_function(tree, node)
                found.append((rel_path, enclosing))

    return found


def _enclosing_function(tree: ast.AST, target: ast.AST) -> str:
    """Return the name of the innermost function that contains `target`."""
    # Build a parent map so we can walk upward.
    parent: dict[int, ast.AST] = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parent[id(child)] = node

    current: ast.AST | None = target
    while current is not None:
        if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return current.name
        current = parent.get(id(current))
    return "<module>"


class TestModelRequestInventory:
    """REQ-032: direct Model.request() usage is limited to approved call sites.

    Every call site must be documented in `_APPROVED_CALL_SITES` above AND in
    `services/api/docs/python-beta-intake-2026-10.md`.
    """

    def test_only_approved_call_sites_exist(self) -> None:
        """Every direct `model.request()` call in app/ is on the approved list.

        If this test fails after you added a new direct call, add it to
        `_APPROVED_CALL_SITES` in this file with a documented reason, and update
        `services/api/docs/python-beta-intake-2026-10.md`.
        """
        found = _collect_direct_model_request_calls(_SERVICES_API_APP_DIR)

        approved_set = {
            (rel_path, fn_name)
            for rel_path, fn_name, _ in _APPROVED_CALL_SITES
        }

        unapproved = [
            (path, fn) for path, fn in found if (path, fn) not in approved_set
        ]
        assert not unapproved, (
            "Unapproved direct Model.request() call(s) found.\n"
            "Add each to `_APPROVED_CALL_SITES` in this file with a documented reason,\n"
            "and update services/api/docs/python-beta-intake-2026-10.md:\n"
            + "\n".join(f"  {path}::{fn}" for path, fn in unapproved)
        )

    def test_approved_call_sites_still_exist(self) -> None:
        """Every approved call site still exists in the source tree.

        Prevents the approved list from silently going stale when a call site
        is removed without updating this inventory.
        """
        found = _collect_direct_model_request_calls(_SERVICES_API_APP_DIR)
        found_set = set(found)

        missing = [
            (rel_path, fn_name, reason)
            for rel_path, fn_name, reason in _APPROVED_CALL_SITES
            if (rel_path, fn_name) not in found_set
        ]
        assert not missing, (
            "Approved call site(s) no longer exist in the source tree.\n"
            "If they were intentionally removed, delete their entry from "
            "`_APPROVED_CALL_SITES` in this file and update "
            "services/api/docs/python-beta-intake-2026-10.md:\n"
            + "\n".join(
                f"  {rel_path}::{fn_name} — {reason}"
                for rel_path, fn_name, reason in missing
            )
        )

    def test_health_probe_passes_no_tools(self) -> None:
        """_probe_llm_provider calls Model.request without any tool definitions.

        The readiness probe must not pass tools; doing so would add unnecessary
        schema overhead and might trigger tool-routing behaviour on models that
        eagerly invoke tools.  This test reads the AST to confirm the call site
        only passes positional/keyword arguments that do not include a tools
        parameter.
        """
        health_path = _SERVICES_API_APP_DIR.parent / "app" / "api" / "health.py"
        source = health_path.read_text(encoding="utf-8")
        tree = ast.parse(source)

        probe_calls: list[ast.Call] = []
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "request"
                and isinstance(node.func.value, ast.Name)
            ):
                # Check we are inside _probe_llm_provider
                fn = _enclosing_function(tree, node)
                if fn == "_probe_llm_provider":
                    probe_calls.append(node)

        assert probe_calls, "_probe_llm_provider must contain a model.request() call"
        call = probe_calls[0]
        keyword_names = {kw.arg for kw in call.keywords if kw.arg is not None}
        assert "tools" not in keyword_names, (
            "_probe_llm_provider must not pass tools= to Model.request()"
        )
        # The call should have exactly 3 positional args: messages, settings, parameters.
        assert len(call.args) == 3, (
            f"_probe_llm_provider model.request() expected 3 positional args, "
            f"got {len(call.args)}"
        )
