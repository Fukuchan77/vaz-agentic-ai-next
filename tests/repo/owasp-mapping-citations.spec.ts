import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/**
 * X-18 / X-19 / X-20 guard (spec `007-cross-repo-adoption-closeout`):
 *
 * Detects citation rot, vocabulary drift, and missing version dates in the two OWASP
 * threat-mapping documents this hub maintains:
 *   - `docs/owasp-agentic-threats-mitigations-mapping.md` (Agentic, 15 threats)
 *   - `docs/owasp-llm-top10-mapping.md`                   (LLM Top 10)
 *
 * Checks (each guarded by a non-empty pre-assertion so a scan of 0 items stays red):
 *   1. Both files exist (R4.7 — the documents themselves cannot disappear silently).
 *   2. All file-path citations resolve to paths in the repo (R4.1).
 *   3. All symbol citations appear inside the file(s) named on the same key-line (R4.2).
 *   4. All CI citations name a workflow file that exists and a step-name present in that
 *      workflow's `name:` values (R4.3, yaml.parse for structure).
 *   5. Every `- 状態:` token is one of the three canonical values (R4.4).
 *   6. Every section has exactly one `- 状態:` line (R2.1).
 *   7. Sections with an acceptance status carry at least one `- 再評価トリガ:` line (R2.3).
 *   8. Both documents declare a taxonomy version date (ISO-8601) in their preamble (R4.5).
 *   9. The Agentic document's threat index has exactly 15 rows, all pointing to existing
 *      headings, and every threat section appears in the index exactly once (R1.6).
 *
 * What this guard does NOT own:
 *   - Link resolution (that's `doc-links.spec.ts`).
 *   - Cross-repo paths (written as code spans, not links — unreachable from here).
 *   - Correctness of citations (only existence is checked; content review is human work).
 *   - New GitHub Actions workflow files (R4.8 / R12.2 — none added).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------
// Constants — guard-side truth, never learned from the documents themselves
// ---------------------------------------------------------------------------

/** The two documents this guard is responsible for. Order is intentional: Agentic first. */
const MAPPING_DOCS = [
	"docs/owasp-agentic-threats-mitigations-mapping.md",
	"docs/owasp-llm-top10-mapping.md",
] as const;

/**
 * Canonical status vocabulary (verbatim from the source taxonomy; R2.1, R4.4).
 * The guard never learns valid values from the documents — those are the constants here.
 */
const VALID_STATUS_TOKENS = new Set(["Mitigated", "Partial · accepted", "Accepted"] as const);

/** Statuses that mandate at least one `- 再評価トリガ:` entry (R2.3). */
const ACCEPTANCE_STATUSES = new Set(["Partial · accepted", "Accepted"]);

/**
 * File extensions that distinguish a code-span as a **path** rather than a symbol.
 * Matches plan.md IF-3 path/symbol discrimination rule.
 */
const PATH_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".py",
	".sql",
	".yml",
	".yaml",
	".md",
	".json",
	".sh",
	".scss",
]);

/** ISO-8601 date pattern (YYYY-MM-DD) used to find taxonomy version dates in preambles. */
const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type CitationLine = {
	key: "実装" | "テスト" | "CI" | "状態" | "再評価トリガ";
	value: string;
	/** Line number (1-based) for error messages. */
	lineNo: number;
};

type ThreatSection = {
	heading: string;
	headingLineNo: number;
	citations: CitationLine[];
};

/** Extract all backtick code-span contents from a line. */
function extractCodeSpans(line: string): string[] {
	return Array.from(line.matchAll(/`([^`]+)`/g), (m) => m[1]);
}

/**
 * Determine whether a code-span value looks like a path or a symbol.
 *
 * Rule (plan.md IF-3):
 *  - contains `/` AND ends with a known extension → PATH
 *  - starts with `.github/` regardless of extension → PATH
 *  - ends with `/` (directory form) → PATH
 *  - link-form `[text](target)` → PATH (the target is extracted)
 *  - otherwise → SYMBOL
 */
function classifySpan(span: string): "path" | "symbol" {
	if (span.endsWith("/")) return "path";
	// Markdown link form: [text](target)
	const linkMatch = span.match(/^\[[^\]]*\]\(([^)]+)\)$/);
	if (linkMatch) {
		const target = linkMatch[1].split("#")[0];
		const ext = target.match(/(\.[a-z]+)$/i)?.[1]?.toLowerCase() ?? "";
		if (PATH_EXTENSIONS.has(ext) || target.includes("/")) return "path";
	}
	const ext = span.match(/(\.[a-z]+)$/i)?.[1]?.toLowerCase() ?? "";
	if (PATH_EXTENSIONS.has(ext) || span.startsWith(".github/")) return "path";
	if (span.includes("/") && !span.includes(" ")) return "path";
	return "symbol";
}

/** Extract the raw target from a markdown link `[text](target)` or plain code span. */
function rawPath(span: string): string {
	const linkMatch = span.match(/^\[[^\]]*\]\(([^)]+)\)$/);
	if (linkMatch) return linkMatch[1].split("#")[0];
	return span;
}

/**
 * Parse structured citation blocks from a Markdown document.
 *
 * Returns one ThreatSection per level-2 heading (`## …`).
 * Only lines beginning with `- 状態:`, `- 実装:`, `- テスト:`, `- CI:`, or
 * `- 再評価トリガ:` are captured; all other prose is ignored.
 */
function parseSections(content: string): ThreatSection[] {
	const lines = content.split("\n");
	const sections: ThreatSection[] = [];
	let current: ThreatSection | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNo = i + 1;

		// Level-2 heading starts a new threat section.
		const h2Match = line.match(/^##\s+(.+)/);
		if (h2Match) {
			current = { heading: h2Match[1].trim(), headingLineNo: lineNo, citations: [] };
			sections.push(current);
			continue;
		}

		if (!current) continue;

		// Citation key lines.
		const keyMatch = line.match(/^-\s+(状態|実装|テスト|CI|再評価トリガ):\s*(.*)/);
		if (keyMatch) {
			const key = keyMatch[1] as CitationLine["key"];
			const value = keyMatch[2].trim();
			current.citations.push({ key, value, lineNo });
		}
	}

	return sections;
}

/**
 * Parse the threat index table from the Agentic document.
 *
 * Expects a Markdown table with a "脅威" (threat name) column and a "本文書の節" (section heading)
 * column. Returns pairs of [threatName, sectionHeading].
 *
 * We identify the table by the presence of `---` separator rows; the column containing
 * the literal `脅威` header is the threat-name column.
 */
function parseThreatIndex(content: string): Array<{ threat: string; section: string }> {
	const lines = content.split("\n");
	const result: Array<{ threat: string; section: string }> = [];
	let inTable = false;
	let threatCol = -1;
	let sectionCol = -1;
	let headerParsed = false;

	for (const line of lines) {
		if (!line.trim().startsWith("|")) {
			if (inTable) break; // table ended
			continue;
		}

		const cells = line
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());

		// Skip separator rows (| --- | --- |)
		if (cells.every((c) => /^-+$/.test(c))) {
			inTable = true;
			continue;
		}

		if (!headerParsed) {
			// Find column indices from header row.
			threatCol = cells.findIndex((c) => c.includes("脅威"));
			sectionCol = cells.findIndex((c) => c.includes("節") || c.includes("section"));
			if (threatCol === -1) continue; // not the right table
			headerParsed = true;
			continue;
		}

		if (!inTable) continue;
		if (threatCol === -1 || sectionCol === -1) continue;

		const threat = cells[threatCol]?.replace(/\*/g, "").trim();
		const section = cells[sectionCol]?.trim();
		if (threat && section && !threat.startsWith("-")) {
			result.push({ threat, section });
		}
	}

	return result;
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
}

/** Read the preamble (first 40 lines) of a document for version-date detection. */
function preamble(content: string): string {
	return content.split("\n").slice(0, 40).join("\n");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("OWASP mapping document guard (R4, X-18, X-19, X-20)", () => {
	// -----------------------------------------------------------------------
	// 2.1 — Non-empty pre-assertions (must come before all inspection checks)
	// -----------------------------------------------------------------------

	describe("pre-assertions: documents exist and contain parseable content", () => {
		test(`exactly ${MAPPING_DOCS.length} mapping documents are declared (anti-false-green)`, () => {
			// The guard is only meaningful if it covers the right number of files.
			// If MAPPING_DOCS shrinks to 0 or 1, the guard silently covers less than intended.
			expect(MAPPING_DOCS.length).toBe(2);
		});

		test.each(MAPPING_DOCS)("document exists: %s (R4.7)", async (relPath) => {
			const absPath = join(ROOT, relPath);
			expect(await fileExists(absPath), `${relPath} must exist in the repository`).toBe(true);
		});

		test("Agentic document contains at least 1 structured citation (non-empty scan guard)", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[0]);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);
			const allCitations = sections.flatMap((s) => s.citations);
			expect(
				allCitations.length,
				`${MAPPING_DOCS[0]} must contain at least one structured citation line (- 状態: / - 実装: / etc.)`,
			).toBeGreaterThan(0);
		});

		test("LLM document contains at least 1 structured citation (non-empty scan guard)", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[1]);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);
			const allCitations = sections.flatMap((s) => s.citations);
			expect(
				allCitations.length,
				`${MAPPING_DOCS[1]} must contain at least one structured citation line (- 状態: / - 実装: / etc.)`,
			).toBeGreaterThan(0);
		});

		test("Agentic document has at least 1 status token (non-empty status scan guard)", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[0]);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);
			const statusLines = sections.flatMap((s) => s.citations.filter((c) => c.key === "状態"));
			expect(
				statusLines.length,
				`${MAPPING_DOCS[0]} must have at least one "- 状態:" line`,
			).toBeGreaterThan(0);
		});

		test("LLM document has at least 1 status token (non-empty status scan guard)", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[1]);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);
			const statusLines = sections.flatMap((s) => s.citations.filter((c) => c.key === "状態"));
			expect(
				statusLines.length,
				`${MAPPING_DOCS[1]} must have at least one "- 状態:" line`,
			).toBeGreaterThan(0);
		});

		test("Agentic document threat index has exactly 15 rows (R1.6 pre-assertion)", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[0]);
			const content = await readFile(absPath, "utf8");
			const index = parseThreatIndex(content);
			expect(
				index.length,
				`${MAPPING_DOCS[0]} threat index must have exactly 15 rows (one per threat T1–T15)`,
			).toBe(15);
		});
	});

	// -----------------------------------------------------------------------
	// 2.2 — Citation resolution: paths, symbols, CI steps
	// -----------------------------------------------------------------------

	describe("file-path citations resolve to existing repo paths (R4.1)", () => {
		test.each(MAPPING_DOCS)("all path citations in %s exist", async (relPath) => {
			const absPath = join(ROOT, relPath);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);

			const broken: string[] = [];
			for (const section of sections) {
				for (const citation of section.citations) {
					if (citation.key !== "実装" && citation.key !== "テスト") continue;
					const spans = extractCodeSpans(citation.value);
					for (const span of spans) {
						if (classifySpan(span) !== "path") continue;
						const target = rawPath(span).split("#")[0];
						if (!target) continue;
						const resolved = join(ROOT, target);
						if (!(await fileExists(resolved))) {
							broken.push(
								`${relPath}:${citation.lineNo} [${section.heading}] ` +
									`path \`${target}\` not found`,
							);
						}
					}
				}
			}

			expect(broken, `broken path citations:\n${broken.join("\n")}`).toEqual([]);
		});
	});

	describe("symbol citations appear in the file(s) on the same key-line (R4.2)", () => {
		test.each(MAPPING_DOCS)("all symbol citations in %s are resolvable", async (relPath) => {
			const absPath = join(ROOT, relPath);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);

			const broken: string[] = [];
			for (const section of sections) {
				for (const citation of section.citations) {
					if (citation.key !== "実装" && citation.key !== "テスト") continue;
					const spans = extractCodeSpans(citation.value);

					// Collect paths and symbols from this single key-line (no cross-key mixing).
					const pathsOnLine: string[] = [];
					const symbolsOnLine: string[] = [];
					for (const span of spans) {
						if (classifySpan(span) === "path") {
							pathsOnLine.push(rawPath(span).split("#")[0]);
						} else {
							symbolsOnLine.push(span);
						}
					}

					for (const sym of symbolsOnLine) {
						if (pathsOnLine.length === 0) continue; // no paths to check against on this line
						let found = false;
						for (const p of pathsOnLine) {
							const filePath = join(ROOT, p);
							try {
								const fileContent = await readFile(filePath, "utf8");
								if (fileContent.includes(sym)) {
									found = true;
									break;
								}
							} catch {
								// path doesn't exist — already caught by path-existence test
							}
						}
						if (!found) {
							broken.push(
								`${relPath}:${citation.lineNo} [${section.heading}] ` +
									`symbol \`${sym}\` not found in [${pathsOnLine.join(", ")}]`,
							);
						}
					}
				}
			}

			expect(broken, `unresolvable symbol citations:\n${broken.join("\n")}`).toEqual([]);
		});
	});

	describe("CI citations name an existing workflow with the stated step name (R4.3)", () => {
		test.each(MAPPING_DOCS)("all CI citations in %s are valid", async (relPath) => {
			const absPath = join(ROOT, relPath);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);

			const broken: string[] = [];
			for (const section of sections) {
				for (const citation of section.citations) {
					if (citation.key !== "CI") continue;
					const spans = extractCodeSpans(citation.value);
					if (spans.length === 0) continue;

					// First code span is the workflow file path.
					const workflowPath = rawPath(spans[0]);
					const workflowAbsPath = join(ROOT, workflowPath);
					if (!(await fileExists(workflowAbsPath))) {
						broken.push(
							`${relPath}:${citation.lineNo} [${section.heading}] ` +
								`workflow file \`${workflowPath}\` not found`,
						);
						continue;
					}

					// Remaining spans are expected step names (workflow job/step `name:` values).
					const workflowContent = await readFile(workflowAbsPath, "utf8");
					let workflowParsed: unknown;
					try {
						workflowParsed = parseYaml(workflowContent);
					} catch {
						broken.push(
							`${relPath}:${citation.lineNo} [${section.heading}] ` +
								`could not parse workflow YAML: \`${workflowPath}\``,
						);
						continue;
					}

					// Collect all `name:` values from jobs and steps within the workflow.
					function collectNames(obj: unknown): string[] {
						if (!obj || typeof obj !== "object") return [];
						const names: string[] = [];
						if (Array.isArray(obj)) {
							for (const item of obj) names.push(...collectNames(item));
						} else {
							const record = obj as Record<string, unknown>;
							if (typeof record.name === "string") names.push(record.name);
							for (const val of Object.values(record)) names.push(...collectNames(val));
						}
						return names;
					}
					const allNames = collectNames(workflowParsed);

					for (const stepName of spans.slice(1)) {
						if (!allNames.includes(stepName)) {
							broken.push(
								`${relPath}:${citation.lineNo} [${section.heading}] ` +
									`step name \`${stepName}\` not found in \`${workflowPath}\``,
							);
						}
					}
				}
			}

			expect(broken, `broken CI citations:\n${broken.join("\n")}`).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// 2.3 — Vocabulary, triggers, version dates, index bijection
	// -----------------------------------------------------------------------

	describe("status tokens are from the canonical 3-value vocabulary (R4.4)", () => {
		test.each(MAPPING_DOCS)("all status tokens in %s are valid", async (relPath) => {
			const absPath = join(ROOT, relPath);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);

			const invalid: string[] = [];
			for (const section of sections) {
				for (const citation of section.citations) {
					if (citation.key !== "状態") continue;
					if (!VALID_STATUS_TOKENS.has(citation.value as never)) {
						invalid.push(
							`${relPath}:${citation.lineNo} [${section.heading}] ` +
								`invalid status token: "${citation.value}" ` +
								`(must be one of: ${[...VALID_STATUS_TOKENS].join(" / ")})`,
						);
					}
				}
			}

			expect(invalid, `invalid status tokens:\n${invalid.join("\n")}`).toEqual([]);
		});
	});

	describe("each threat section has exactly one status line (R2.1)", () => {
		test.each(MAPPING_DOCS)("status-line count in %s is exactly 1 per section", async (relPath) => {
			const absPath = join(ROOT, relPath);
			const content = await readFile(absPath, "utf8");
			const sections = parseSections(content);

			const violations: string[] = [];
			for (const section of sections) {
				const statusLines = section.citations.filter((c) => c.key === "状態");
				if (statusLines.length !== 1) {
					violations.push(
						`${relPath}:${section.headingLineNo} [${section.heading}] ` +
							`has ${statusLines.length} status line(s) — expected exactly 1`,
					);
				}
			}

			expect(violations, `status-count violations:\n${violations.join("\n")}`).toEqual([]);
		});
	});

	describe("acceptance-status sections carry a re-evaluation trigger (R2.3)", () => {
		test.each(MAPPING_DOCS)(
			"all accepted sections in %s have re-evaluation triggers",
			async (relPath) => {
				const absPath = join(ROOT, relPath);
				const content = await readFile(absPath, "utf8");
				const sections = parseSections(content);

				const missing: string[] = [];
				for (const section of sections) {
					const statusLine = section.citations.find((c) => c.key === "状態");
					if (!statusLine) continue;
					if (!ACCEPTANCE_STATUSES.has(statusLine.value)) continue;

					const hasTrigger = section.citations.some((c) => c.key === "再評価トリガ");
					if (!hasTrigger) {
						missing.push(
							`${relPath}:${section.headingLineNo} [${section.heading}] ` +
								`status is "${statusLine.value}" but has no "- 再評価トリガ:" line`,
						);
					}
				}

				expect(missing, `missing re-evaluation triggers:\n${missing.join("\n")}`).toEqual([]);
			},
		);
	});

	describe("taxonomy version dates are present in both document preambles (R4.5)", () => {
		test.each(MAPPING_DOCS)(
			"%s preamble contains an ISO-8601 taxonomy version date",
			async (relPath) => {
				const absPath = join(ROOT, relPath);
				const content = await readFile(absPath, "utf8");
				const pre = preamble(content);

				expect(
					ISO_DATE_RE.test(pre),
					`${relPath}: preamble (first 40 lines) must contain a taxonomy version date ` +
						`in ISO-8601 format (YYYY-MM-DD) — e.g. "2025-02-17"`,
				).toBe(true);
			},
		);
	});

	describe("Agentic document threat index is a bijection between 15 threats and sections (R1.6)", () => {
		test("index has 15 rows and all point to existing section headings", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[0]);
			const content = await readFile(absPath, "utf8");
			const index = parseThreatIndex(content);
			const sections = parseSections(content);
			const sectionHeadings = new Set(sections.map((s) => s.heading));

			const broken: string[] = [];
			for (const entry of index) {
				// The index "section" column may contain a partial match — check that a section
				// heading contains the index value as a substring (allows heading decorators).
				const found = [...sectionHeadings].some(
					(h) => h.includes(entry.section) || entry.section.includes(h),
				);
				if (!found) {
					broken.push(
						`Index entry "${entry.threat}" → "${entry.section}" has no matching section heading`,
					);
				}
			}

			expect(broken, `index entries with no matching section:\n${broken.join("\n")}`).toEqual([]);
			expect(index.length).toBe(15);
		});

		test("every threat section is listed in the index exactly once", async () => {
			const absPath = join(ROOT, MAPPING_DOCS[0]);
			const content = await readFile(absPath, "utf8");
			const index = parseThreatIndex(content);
			const sections = parseSections(content);

			// Filter to sections that are actual threat sections (have at least one citation line).
			const threatSections = sections.filter((s) => s.citations.length > 0);

			const duplicatesInIndex: string[] = [];
			const seen = new Map<string, number>();
			for (const entry of index) {
				seen.set(entry.section, (seen.get(entry.section) ?? 0) + 1);
			}
			for (const [sec, count] of seen) {
				if (count > 1) duplicatesInIndex.push(`"${sec}" appears ${count} times in the index`);
			}
			expect(
				duplicatesInIndex,
				`duplicate index entries:\n${duplicatesInIndex.join("\n")}`,
			).toEqual([]);

			// Every threat section should be covered by the index.
			const indexedSections = new Set(index.map((e) => e.section));
			const uncovered: string[] = [];
			for (const section of threatSections) {
				const covered = [...indexedSections].some(
					(s) => s.includes(section.heading) || section.heading.includes(s),
				);
				if (!covered) {
					uncovered.push(`Section "${section.heading}" is not covered by the threat index`);
				}
			}

			expect(uncovered, `threat sections not in the index:\n${uncovered.join("\n")}`).toEqual([]);
		});
	});
});
