"""Behavioral tests for this lane's leg of the hub pre-commit hook (spec `008`).

`scripts/hooks/pre-commit.sh` restores what this lane's `.pre-commit-config.yaml`
enforced before spec `006` imported it into the hub (Req 12.1, Req 15): the
`real-tool-conventions-guard` and the `pip-audit` leg. gitleaks and the model-id
guard are not repeated here because the hub's own pre-commit runs both for every
commit. Each test builds a throwaway git repo shaped like the hub (paths under
`services/api/`) and stubs `mise`, so nothing real is linted or audited.
"""

import os
import stat
import subprocess
from pathlib import Path

import pytest


HOOK_PATH = Path("scripts/hooks/pre-commit.sh").resolve()

_FAKE_MISE = """#!/usr/bin/env bash
echo "mise $*" >> "$CALL_LOG"
exit 0
"""


@pytest.fixture
def hub(tmp_path: Path) -> Path:
    """An empty git repo standing in for the hub root."""
    repo = tmp_path / "hub"
    repo.mkdir()
    subprocess.run(["git", "-C", str(repo), "init", "-q"], check=True)
    return repo


@pytest.fixture
def call_log(tmp_path: Path) -> Path:
    """Path the stub `mise` appends its invocation args to."""
    return tmp_path / "calls.log"


def _stage(repo: Path, rel: str, content: str) -> None:
    path = repo / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    subprocess.run(["git", "-C", str(repo), "add", rel], check=True)


def _run_hook(repo: Path, call_log: Path, tmp_path: Path) -> subprocess.CompletedProcess:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    mise = bin_dir / "mise"
    mise.write_text(_FAKE_MISE)
    mise.chmod(mise.stat().st_mode | stat.S_IEXEC)
    env = dict(os.environ)
    env["PATH"] = f"{bin_dir}:{env['PATH']}"
    env["CALL_LOG"] = str(call_log)
    return subprocess.run(
        ["sh", str(HOOK_PATH)], cwd=repo, env=env, capture_output=True, text=True, timeout=10
    )


def test_skips_when_nothing_under_services_api_is_staged(
    hub: Path, call_log: Path, tmp_path: Path
) -> None:
    """A TS-only commit must not need a Python toolchain (NFR-1)."""
    _stage(hub, "apps/web/page.tsx", "export {}\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode == 0
    assert not call_log.exists()


def test_lints_but_does_not_audit_a_code_only_change(
    hub: Path, call_log: Path, tmp_path: Path
) -> None:
    """`api:audit` only runs when the dependency set itself changed."""
    _stage(hub, "services/api/app/main.py", "x = 1\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode == 0
    calls = call_log.read_text()
    assert "run api:lint" in calls
    assert "api:audit" not in calls


@pytest.mark.parametrize("rel", ["services/api/pyproject.toml", "services/api/uv.lock"])
def test_audits_a_dependency_change(hub: Path, call_log: Path, tmp_path: Path, rel: str) -> None:
    """A staged pyproject.toml / uv.lock runs pip-audit (Req 12.1)."""
    _stage(hub, rel, "# changed\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode == 0
    assert "run api:audit" in call_log.read_text()


def test_blocks_a_real_agent_tool(hub: Path, call_log: Path, tmp_path: Path) -> None:
    """Req 15: a non-mock `@agent.tool` under app/agents/ fails the commit."""
    _stage(hub, "services/api/app/agents/search.py", "@agent.tool\ndef search(): ...\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode != 0
    assert "tool-design-conventions.md" in result.stderr


def test_allows_the_mock_tools_module(hub: Path, call_log: Path, tmp_path: Path) -> None:
    """`tools_mock.py` is the one sanctioned home for `@agent.tool` today."""
    _stage(hub, "services/api/app/agents/tools_mock.py", "@agent.tool\ndef mock(): ...\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode == 0


def test_reads_the_staged_blob_not_the_working_tree(
    hub: Path, call_log: Path, tmp_path: Path
) -> None:
    """An unstaged edit that removes the decorator must not hide the staged one."""
    _stage(hub, "services/api/app/agents/search.py", "@agent.tool\ndef search(): ...\n")
    (hub / "services/api/app/agents/search.py").write_text("def search(): ...\n")

    result = _run_hook(hub, call_log, tmp_path)

    assert result.returncode != 0
