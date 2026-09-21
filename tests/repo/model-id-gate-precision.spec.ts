import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * R6.4/R6.5 guard (spec `006-repo-consolidation`, ADR-0003): `scripts/forbid-model-ids.sh`
 * was refined from a bare vendor-substring match to an assignment-form-only match
 * (`[:=]\s*"..."`) specifically so bringing in `services/api` — whose docstrings
 * legitimately write `(e.g., "openai:gpt-4o")` to explain the "provider:model" →
 * LiteLLM "provider/model" conversion — doesn't trip 3 false positives with zero
 * real violations behind them (see the script's own header comment).
 *
 * This is a drift guard, not a duplicate of the script itself: `services/api` carries
 * its own independent pytest guard (`tests/unit/test_no_hardcoded_model_ids.py`) with
 * its own assignment-form regex, reasoned about from the Python side. Nothing forces
 * the two patterns to stay in agreement — a future edit could "simplify" either one
 * back to a bare substring match, quietly reintroducing false positives that get
 * "fixed" by piling on carve-out paths instead of understanding why the precision
 * was there. Both sides are asserted here, independently, against real subprocess
 * behavior rather than by parsing the regex source text — a regex that looks right
 * but was mistyped would still fail these tests.
 */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const SCRIPT = join(REPO_ROOT, "scripts", "forbid-model-ids.sh");

/**
 * Copies the real script into a throwaway fixture directory, rewriting only its
 * `ROOT=` line so `ROOT` resolves to that fixture directory itself (the original
 * expects to live one level under `scripts/`). The `PATTERN` and carve-out
 * pipeline are copied verbatim, so this exercises the actual deployed regex, not
 * a hand-copied approximation of it.
 */
function copyScriptInto(dir: string): string {
	const original = readFileSync(SCRIPT, "utf8");
	const rewritten = original.replace(
		'ROOT="$(cd "$(dirname "$0")/.." && pwd)"',
		'ROOT="$(cd "$(dirname "$0")" && pwd)"',
	);
	const scriptCopy = join(dir, "forbid-model-ids.sh");
	writeFileSync(scriptCopy, rewritten);
	mkdirSync(join(dir, "apps"), { recursive: true });
	mkdirSync(join(dir, "packages"), { recursive: true });
	return scriptCopy;
}

describe("scripts/forbid-model-ids.sh precision (R6.4/R6.5)", () => {
	test("the deployed gate is green against the real repo right now", () => {
		// Documents the expectation this refinement exists to satisfy: with
		// services/api present, the gate must be green without needing new
		// carve-out paths. A non-zero exit here means the precision regressed.
		expect(() => execFileSync("bash", [SCRIPT], { cwd: REPO_ROOT, stdio: "pipe" })).not.toThrow();
	});

	test("assignment-form services/api-style strings are flagged (true positive)", () => {
		const dir = mkdtempSync(join(tmpdir(), "model-id-gate-tp-"));
		try {
			const scriptCopy = copyScriptInto(dir);
			const targetDir = join(dir, "services", "sandbox");
			mkdirSync(targetDir, { recursive: true });
			writeFileSync(join(targetDir, "settings.py"), 'llm_model: str = "openai:gpt-4o"\n');

			expect(() => execFileSync("bash", [scriptCopy], { cwd: dir, stdio: "pipe" })).toThrow();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("docstring-prose services/api-style mentions are not flagged (false positive guard)", () => {
		const dir = mkdtempSync(join(tmpdir(), "model-id-gate-fp-"));
		try {
			const scriptCopy = copyScriptInto(dir);
			const targetDir = join(dir, "services", "sandbox");
			mkdirSync(targetDir, { recursive: true });
			writeFileSync(
				join(targetDir, "settings.py"),
				'"""\n    llm_model: LLM model identifier in "provider:model" format\n' +
					'        (e.g., "openai:gpt-4o", "anthropic:claude-3-5-sonnet-20241022")\n"""\n',
			);

			expect(() => execFileSync("bash", [scriptCopy], { cwd: dir, stdio: "pipe" })).not.toThrow();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("services/api's own pytest guard still requires assignment-form context, not a bare substring", async () => {
		const pythonGuardPath = join(
			REPO_ROOT,
			"services",
			"api",
			"tests",
			"unit",
			"test_no_hardcoded_model_ids.py",
		);
		const source = await readFile(pythonGuardPath, "utf8");

		expect(source).toContain("_PATTERN");
		// The Python guard's own pattern must require `:`/`=` directly before the
		// quote, mirroring the shell gate's precision. If this string disappears,
		// someone loosened the Python side back to a bare substring match without
		// updating the shell side (or vice versa) — exactly the drift this file
		// exists to catch.
		expect(source).toMatch(/\[:=\]\\s\*"/);
	});
});
