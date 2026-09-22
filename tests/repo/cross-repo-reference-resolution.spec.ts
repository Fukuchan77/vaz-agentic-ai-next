import { glob, readFile } from "node:fs/promises";

/**
 * R9.1 guard (spec `006-repo-consolidation`): `docs/cross-repo-adoption-review.md`
 * was missing for months while 7 references across 3 repos (this hub, `services/api`'s
 * vendored copy of `fastapi-pydantic-ai-agent`, and `pydantic-ai-sandbox`) pointed at it.
 * The rename to `vaz-agentic-ai-next` plus placing the file resolved all 7 with zero
 * edits — see `docs/cross-repo-adoption-review.md` §6 and `specs/006-repo-consolidation/
 * pdca/do.md`.
 *
 * This test covers the subset actually reachable from inside this repo's own tree: this
 * hub's own docs, plus `services/api`'s vendored `CLAUDE.md`/`AGENTS.md`/
 * `docs/cross-repo-adoption-backlog.md` (imported verbatim by the Task 6 subtree merge,
 * still carrying the same reference text). `pydantic-ai-sandbox`'s 2 references
 * (`docs/README.md`, `docs/cross-repo-adoption-backlog.md`) live in a separate repository
 * not vendored anywhere here and are genuinely out of this test's reach — verifying those
 * requires a sibling checkout, which `scripts/verify-cross-repo-references.sh` does
 * manually (not CI-wired, documented in its own header). Both together account for all 7
 * originally-dangling references (X-3's non-empty-assertion principle applies to each).
 */

const ROOT = new URL("../../", import.meta.url);
const CANONICAL_PATH = "docs/cross-repo-adoption-review.md";
const CANONICAL_REPO_QUALIFIED = `vaz-agentic-ai-next/${CANONICAL_PATH}`;

const EXCLUDED_SEGMENTS = ["node_modules", ".venv", "__pycache__", ".git", ".next", "dist"];
// pdca/ logs are an append-only operational record (per-task narration, including
// the literal shell commands run) rather than a "live" reference a reader follows —
// e.g. `pdca/do.md` quotes an old grep exclude pattern verbatim while explaining
// what Task 3 ran, which is not a dangling pointer to fix.
const EXCLUDED_PATH_PATTERN = /(^|\/)specs\/[^/]+\/pdca\//;

// Matches repo-qualified references of the form `<repo-name>/docs/cross-repo-adoption-review.md`.
//
// The character class intentionally excludes `.` so that relative-path segments
// (`.` and `..`) are never captured as a "repo name".  With `.` in the class,
// a relative link like `../../docs/cross-repo-adoption-review.md` would have its
// `..` segment captured as the repo name, then fail the `!== "vaz-agentic-ai-next"`
// check as a false stale hit (I-8, `specs/007-cross-repo-adoption-closeout/research.md`).
//
// Known limitation: code-spans and fenced blocks inside `.md` files are not
// stripped before matching (no `stripCode` equivalent), so text that *discusses*
// a path without linking it can also match.  That second false-positive class is
// documented as an accepted known limit in plan.md C-5 and is not addressed here.
const QUALIFIED_FORM = /([A-Za-z0-9_-]+)\/docs\/cross-repo-adoption-review\.md/g;

async function findReferencingFiles(): Promise<string[]> {
	const hits: string[] = [];
	for await (const relPath of glob("**/*.md", { cwd: ROOT.pathname })) {
		if (EXCLUDED_SEGMENTS.some((seg) => relPath.split("/").includes(seg))) continue;
		if (EXCLUDED_PATH_PATTERN.test(relPath)) continue;
		const text = await readFile(new URL(relPath, ROOT), "utf8");
		if (text.includes("cross-repo-adoption-review")) {
			hits.push(relPath);
		}
	}
	return hits;
}

/**
 * Regression cases for the `..`-as-repo-name false-positive (I-8,
 * `specs/007-cross-repo-adoption-closeout/research.md`).
 *
 * These tests pin the behaviour of the module-level QUALIFIED_FORM regex so
 * that reverting the dot-exclusion fix immediately causes failures here,
 * before any file-system scan is attempted.
 */
describe("QUALIFIED_FORM regression: relative-path fragments must not be treated as repo names (I-8)", () => {
	test("relative link `../../docs/…` yields zero qualified matches (no false stale hit)", () => {
		const input = "[正本レビュー](../../docs/cross-repo-adoption-review.md) を参照";
		const matches = [...input.matchAll(QUALIFIED_FORM)];
		expect(
			matches,
			"../../ should produce no QUALIFIED_FORM match — it contains no repo-name segment",
		).toHaveLength(0);
	});

	test("a genuinely stale repo-qualified reference is still detected", () => {
		const input = "old-repo-name/docs/cross-repo-adoption-review.md の旧リンク";
		const staleMatches = [...input.matchAll(QUALIFIED_FORM)];
		expect(staleMatches).toHaveLength(1);
		expect(staleMatches[0][1]).toBe("old-repo-name");
	});

	test("the current hub's qualified form is accepted (not stale)", () => {
		const input = "vaz-agentic-ai-next/docs/cross-repo-adoption-review.md";
		const currentMatches = [...input.matchAll(QUALIFIED_FORM)];
		expect(currentMatches).toHaveLength(1);
		expect(currentMatches[0][1]).toBe("vaz-agentic-ai-next");
	});
});

describe("cross-repo-adoption-review.md reference resolution (R9.1, reachable subset)", () => {
	test("the canonical file itself exists at the hub root", async () => {
		const text = await readFile(new URL(CANONICAL_PATH, ROOT), "utf8");
		expect(text.length).toBeGreaterThan(0);
	});

	test("scans at least one referencing file (anti-false-green)", async () => {
		const hits = await findReferencingFiles();
		expect(hits.length).toBeGreaterThan(0);
	});

	test("every repo-qualified reference names the current hub, not a stale name", async () => {
		// A file *within* this hub correctly links the canonical review with a
		// plain relative/same-repo path (e.g. `docs/cross-repo-adoption-review.md`,
		// as this repo's own CLAUDE.md/AGENTS.md/docs/guide/ do) — that's not a
		// dangling reference and isn't expected to carry a repo qualifier at all.
		// Only a reference that *does* use the "reponame/docs/..." qualified form
		// (because it's naming this hub from outside its own tree — the case for
		// services/api's vendored copies, and originally for sibling repos) can be
		// stale, by naming the wrong repo. This regex finds every such qualified
		// occurrence and checks its repo name, rather than requiring the qualifier
		// on same-repo links that never needed one.
		const hits = await findReferencingFiles();
		const staleNames: string[] = [];

		for (const relPath of hits) {
			const text = await readFile(new URL(relPath, ROOT), "utf8");
			for (const match of text.matchAll(QUALIFIED_FORM)) {
				const repoName = match[1];
				if (repoName !== "vaz-agentic-ai-next") {
					staleNames.push(`${relPath}: "${match[0]}"`);
				}
			}
		}

		expect(
			staleNames,
			"these repo-qualified references name something other than the current hub " +
				'("vaz-agentic-ai-next") — likely a stale reference predating the rename',
		).toEqual([]);
	});

	test("services/api's vendored copy still carries its original 3 references", async () => {
		// Pins the specific files Task 6's subtree import carried over, so a
		// future edit to services/api that accidentally drops these doesn't
		// silently shrink the reachable-subset count without anyone noticing.
		const expectedFiles = [
			"services/api/CLAUDE.md",
			"services/api/AGENTS.md",
			"services/api/docs/cross-repo-adoption-backlog.md",
		];

		for (const relPath of expectedFiles) {
			const text = await readFile(new URL(relPath, ROOT), "utf8");
			expect(text, `${relPath} should still reference the canonical review`).toContain(
				CANONICAL_REPO_QUALIFIED,
			);
		}
	});
});
