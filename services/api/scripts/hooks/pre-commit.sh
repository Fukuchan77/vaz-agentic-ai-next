#!/bin/sh
# services/api leg of the hub's pre-commit hook (spec 008 Task 2).
#
# Restores the checks this lane's own `.pre-commit-config.yaml` ran before spec 006
# imported it into the hub, minus the two the hub already runs for every commit
# (gitleaks via `secret-scan:staged`, the model-id gate via `lint:model-ids`, whose
# scan covers `services/**/*.py`). Invoked by `.githooks/pre-commit` at the hub root;
# a no-op unless a staged path sits under `services/api/`, so a TS-only commit never
# needs a Python toolchain (NFR-1).
#
#   1. api:lint            ruff + ty (staged change touches services/api/)
#   2. tool-conventions    a non-mock `@agent.tool` under app/agents/ fails the commit
#                          until docs/tool-design-conventions.md has been reviewed
#   3. api:audit           pip-audit (only when pyproject.toml / uv.lock is staged)
#
# Run from the hub root. To skip temporarily: git commit --no-verify
set -e

staged=$(git diff --cached --name-only --diff-filter=ACMR)
api_staged=$(printf '%s\n' "$staged" | grep '^services/api/' || true)

if [ -z "$api_staged" ]; then
	echo "[pre-commit:api] no staged change under services/api/ — skipping"
	exit 0
fi

echo "[pre-commit:api] 1/3 lint & typecheck (ruff + ty)"
mise run api:lint

echo "[pre-commit:api] 2/3 real-tool-conventions guard"
offenders=""
for path in $(printf '%s\n' "$api_staged" | grep -E '^services/api/app/agents/.*\.py$' || true); do
	case "$path" in
	services/api/app/agents/tools_mock.py | services/api/app/agents/__init__.py) continue ;;
	esac
	# Read the *staged* blob, not the working tree: an unstaged fix must not hide it.
	if git show ":$path" | grep -qE '^[[:space:]]*@agent\.tool\b'; then
		offenders="$offenders $path"
	fi
done
if [ -n "$offenders" ]; then
	echo "[pre-commit:api] ✗ real (non-mock) agent tool detected:$offenders" >&2
	echo "[pre-commit:api]   review services/api/docs/tool-design-conventions.md, then" >&2
	echo "[pre-commit:api]   commit with --no-verify once the conventions are applied." >&2
	exit 1
fi

if printf '%s\n' "$api_staged" | grep -qE '^services/api/(pyproject\.toml|uv\.lock)$'; then
	echo "[pre-commit:api] 3/3 dependency audit (pip-audit)"
	mise run api:audit
else
	echo "[pre-commit:api] 3/3 dependency audit — skipped (no pyproject.toml / uv.lock change)"
fi

echo "[pre-commit:api] ✅ services/api checks passed"
