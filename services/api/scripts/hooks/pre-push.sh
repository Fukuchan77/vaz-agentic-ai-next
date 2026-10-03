#!/bin/sh
# services/api leg of the hub's pre-push hook (spec 008 Task 2).
#
# Availability-gated, as in this lane's original `.githooks/pre-push` (Req 1.6/1.7):
# Ollama-dependent local tests and the evals suite are too slow/flaky for GitHub
# Actions (AC 1.8), so they run here, but only when Ollama is actually reachable.
# If it isn't, the push proceeds with a warning.
#
# Two hub-specific additions:
#   - It reads git's pre-push stdin (`<local ref> <local sha> <remote ref> <remote sha>`)
#     and runs only when a pushed commit touches services/api/: `api:evals` makes real
#     LLM calls, and a TS-only push must not pay for them. With no stdin (run by hand)
#     it assumes the lane changed.
#   - Ollama is probed at the native API root (no `/v1`), which is what this lane's
#     LiteLLM routing uses. The hub's own OLLAMA_BASE_URL carries `/v1`, so this leg
#     reads API_OLLAMA_BASE_URL instead and does not share the variable.
#
# Invoked by `.githooks/pre-push` at the hub root, with the hook's stdin passed through.
set -eu

ZERO=0000000000000000000000000000000000000000
API_OLLAMA_BASE_URL="${API_OLLAMA_BASE_URL:-http://localhost:11434}"

lane_changed() {
	saw_input=0
	while read -r _local_ref local_sha _remote_ref remote_sha; do
		saw_input=1
		[ "$local_sha" = "$ZERO" ] && continue # branch deletion: nothing to test
		if [ "$remote_sha" = "$ZERO" ]; then
			base=$(git merge-base "$local_sha" origin/main 2>/dev/null || true)
			[ -z "$base" ] && return 0 # unknown base: be safe, run the lane
		else
			base=$remote_sha
		fi
		if git diff --name-only "$base" "$local_sha" 2>/dev/null | grep -q '^services/api/'; then
			return 0
		fi
	done
	[ "$saw_input" -eq 0 ]
}

if [ -t 0 ]; then
	: # interactive / manual run: no ref list to inspect, treat as changed
elif ! lane_changed; then
	echo "[pre-push:api] no pushed commit touches services/api/ — skipping"
	exit 0
fi

if curl --fail --silent --show-error --max-time 5 "${API_OLLAMA_BASE_URL}/api/tags" >/dev/null 2>&1; then
	echo "[pre-push:api] Ollama reachable at ${API_OLLAMA_BASE_URL} - running local tests and evals" >&2
	# Pinned to `tests/local/`'s current `ollama`-marked test count (Req 13.8) -
	# without this, a lane that silently collects zero live cases would report
	# success. Update this count when a test is added to or removed from
	# tests/local/ (`tests/unit/test_local_test_gating.py` guards the literal).
	# Not set on `api:evals`: that lane runs evals/runner.py directly, not pytest.
	EXPECT_LIVE_TESTS=6 mise run api:test:local
	mise run api:evals
else
	echo "[pre-push:api] WARNING - Ollama not reachable at ${API_OLLAMA_BASE_URL}; skipping local tests and evals" >&2
fi
