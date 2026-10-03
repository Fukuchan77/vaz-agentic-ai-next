import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * X-11-adjacent guard: every relative Markdown link in a committed `.md` file
 * must resolve to a path that exists in this repo.
 *
 * A dangling link is the cheapest form of doc drift — it survives review
 * because nothing executes it. Three of them shipped here: a backlog that
 * named a "正本" document never committed to this repo, and two spec snapshots
 * still linking pre-migration `src/**` paths that the 001 monorepo migration
 * deleted (docs/cross-repo-adoption-backlog.md §4). This is the repo-side
 * analogue of `agentic-ai-sandbox`'s `scripts/check_doc_links.py`, run inside
 * the existing `repo` Vitest project rather than as a second CI path
 * (principle 5 — no new workflow file).
 *
 * Scope: relative targets only, in prose. Absolute URLs (`https:`/`mailto:`),
 * pure anchors (`#section`), anything inside code spans or fenced blocks (a
 * signature like `class Judge[SubjectT](Protocol)` is not a link), and
 * cross-repo references — which are written as code spans, not links, precisely
 * because this guard cannot reach another repository — are all out of scope by
 * construction. Vendored subtrees are skipped: see {@link VENDORED_ROOTS}.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Directories that never hold reviewed prose (installed or generated trees). */
const SKIP_DIRS = new Set([
	".git",
	"node_modules",
	".next",
	"coverage",
	"playwright-report",
	"test-results",
	".venv",
	"__pycache__",
]);

/**
 * Subtrees imported verbatim from another repository and still owned upstream,
 * whose Markdown it is not this repo's job to keep correct. Empty since spec 008:
 * `services/api` (imported via `git subtree add --squash` in spec 006 Task 6) is
 * now this repo's own source of truth (`docs/adr/0007-fastapi-single-source-of-truth.md`),
 * so its docs are checked like any other, and the upstream-era broken links it
 * carried were repointed. Add an entry only for a future import that is genuinely
 * still maintained elsewhere; the "every vendored root still exists" test keeps
 * any entry from going stale.
 */
const VENDORED_ROOTS: string[] = [];

/**
 * `[text](target)` and `![alt](target)`. The target stops at whitespace (a
 * trailing `"title"`) or the closing paren; angle-bracket targets
 * (`[x](<a b.md>)`) are unwrapped by {@link cleanTarget}.
 */
const MD_LINK = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^()\s]+)(?:\s+"[^"]*")?\s*\)/g;

/** Blanks out fenced blocks and inline code spans so code is never read as prose. */
function stripCode(markdown: string): string {
	return markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const found: string[] = [];
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			found.push(...(await collectMarkdownFiles(join(dir, entry.name))));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			found.push(join(dir, entry.name));
		}
	}
	return found;
}

/** Strips angle brackets, the `#fragment`/`?query` suffix, and URL escapes. */
function cleanTarget(raw: string): string {
	const unwrapped = raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
	const withoutSuffix = unwrapped.split("#")[0].split("?")[0];
	try {
		return decodeURIComponent(withoutSuffix);
	} catch {
		// A literal `%` that is not a valid escape — compare the raw text.
		return withoutSuffix;
	}
}

function isRelative(target: string): boolean {
	return target !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("//");
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Every `.md` this repo is responsible for: the whole tree minus the vendored roots. */
async function collectOwnMarkdownFiles(): Promise<string[]> {
	const all = await collectMarkdownFiles(REPO_ROOT);
	return all.filter((file) => {
		const rel = relative(REPO_ROOT, file);
		return !VENDORED_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`));
	});
}

describe("Markdown link hygiene", () => {
	test("scans at least one Markdown file (anti-false-green)", async () => {
		const files = await collectOwnMarkdownFiles();
		expect(files.length).toBeGreaterThan(0);
	});

	test("every vendored root still exists (the exclusion list cannot go stale)", async () => {
		for (const root of VENDORED_ROOTS) {
			expect(await exists(resolve(REPO_ROOT, root)), `${root} is no longer present`).toBe(true);
		}
	});

	test("every relative Markdown link resolves to a path in this repo", async () => {
		const files = await collectOwnMarkdownFiles();
		const broken: string[] = [];
		let checkedLinks = 0;

		for (const file of files) {
			const text = stripCode(await readFile(file, "utf8"));
			for (const match of text.matchAll(MD_LINK)) {
				const target = cleanTarget(match[1]);
				if (!isRelative(target)) continue;
				checkedLinks += 1;
				if (!(await exists(resolve(dirname(file), target)))) {
					broken.push(`${relative(REPO_ROOT, file)} → ${target}`);
				}
			}
		}

		// Guards the regex itself: a rewrite that stops matching links would
		// otherwise report a clean run over zero links.
		expect(checkedLinks).toBeGreaterThan(0);
		expect(broken).toEqual([]);
	});
});
