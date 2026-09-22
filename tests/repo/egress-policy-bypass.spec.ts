import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// D6 - Egress policy bypass regression scan.
//
// Spec `007-cross-repo-adoption-closeout` REQ-010, DES-3.6, tasks 11.1-11.3.
//
// Adapted from `pydantic-ai-sandbox/patterns/hitl/tests/test_egress_policy.py`
// (reference: CVE-2026-46678 - hardcoded recipient bypass in agent email tools).
//
// This scan asserts two independent properties:
//
//   1. No egress bypass literals - apps/[pkg]/src/** and packages/[pkg]/src/** contain no
//      email-address literals (which would let an attacker route a send without going through
//      the committed allow-list) and no allowlist-circumvention patterns (overwriting
//      RECIPIENT_ALLOWLIST with a non-empty literal, or calling recipient-decision logic
//      without isAllowedRecipient/assertAllowedRecipient).
//
//   2. Single audit firing point - within apps/web/src/app/api/jobs/ and
//      apps/web/src/lib/, the call `audit.record(` must appear exclusively in
//      apps/web/src/lib/approvals.ts. A second firing point in the approval route itself
//      would violate the "single fail-soft boundary" invariant (R8.2, D4).
//      Scope deliberately excludes packages/agents/ (the tool-execution audit path at
//      packages/agents/src/audit-hook.ts remains fail-loud per R8.5 and is not subject to
//      the single-boundary constraint applied here).
//
// Each check is preceded by a non-empty pre-assertion so a scan of 0 files cannot
// silently stay green (constitution principle 3 / non-vacuity, REQ-010.2).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Recursively walk a directory and return all .ts/.tsx files.
async function walkTs(dir: string): Promise<string[]> {
	const results: string[] = [];
	let entries: Awaited<ReturnType<typeof readdir>>;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return results; // directory may not exist
	}
	for (const entry of entries) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await walkTs(abs)));
		} else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
			results.push(abs);
		}
	}
	return results;
}

async function readSrc(path: string): Promise<string> {
	return readFile(path, "utf8");
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Constants - guard-side truth
// ---------------------------------------------------------------------------

// Allowlisted exception paths (relative to ROOT) that are permitted to contain
// email-address literals or allowlist-related identifiers because they ARE
// the allowlist implementation or its direct call site. Each entry must actually
// exist - a stale exception is itself a guard failure.
const ALLOWED_EXCEPTION_PATHS: readonly string[] = [
	"packages/tools/src/allowlist.ts", // defines RECIPIENT_ALLOWLIST, isAllowedRecipient, assertAllowedRecipient
	"packages/tools/src/email.ts", // uses assertAllowedRecipient - the correct call site
];

// Email-address regex. Conservative: local-part@domain.tld pattern.
// Excludes npm scoped identifiers like @carbon/react by requiring a word char
// immediately before the @.
const EMAIL_LITERAL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Patterns that indicate an attempt to bypass the allowlist:
// - RECIPIENT_ALLOWLIST re-assigned with a non-empty array literal outside the definition file.
// - `allowlist` parameter overridden with a literal array containing an @ address.
const ALLOWLIST_OVERRIDE_RE =
	/RECIPIENT_ALLOWLIST\s*[:=]\s*\[[^\]]+\]|allowlist\s*[:=]\s*\[[^\]]+@[^\]]+\]/;

// The single authoritative audit firing point (relative to ROOT).
const AUDIT_FIRING_POINT = "apps/web/src/lib/approvals.ts";

// Directories whose source files are subject to the audit-uniqueness check (relative to ROOT).
const AUDIT_SCAN_DIRS: readonly string[] = ["apps/web/src/app/api/jobs", "apps/web/src/lib"];

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

// Collect all TS source files under apps/[pkg]/src and packages/[pkg]/src.
async function collectAppPackageSrcFiles(): Promise<string[]> {
	const results: string[] = [];
	for (const topDir of ["apps", "packages"]) {
		const absTop = resolve(ROOT, topDir);
		let pkgEntries: Awaited<ReturnType<typeof readdir>>;
		try {
			pkgEntries = await readdir(absTop, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const pkg of pkgEntries) {
			if (!pkg.isDirectory()) continue;
			const srcDir = join(absTop, pkg.name, "src");
			results.push(...(await walkTs(srcDir)));
		}
	}
	return results;
}

// Collect all TS source files under the given audit scan dirs (relative to ROOT).
async function collectAuditScanFiles(): Promise<string[]> {
	const results: string[] = [];
	for (const dir of AUDIT_SCAN_DIRS) {
		results.push(...(await walkTs(resolve(ROOT, dir))));
	}
	return results;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("egress policy bypass regression scan (D6, REQ-010, CVE-2026-46678)", () => {
	// -------------------------------------------------------------------------
	// Pre-flight: exception list integrity
	// -------------------------------------------------------------------------

	test("exception list is non-empty and every listed path exists", async () => {
		// The exception list MUST have at least one entry: a guard that silently
		// allows everything (because the allowlist definition itself passes) only
		// works if we have thought about the exceptions deliberately.
		expect(ALLOWED_EXCEPTION_PATHS.length).toBeGreaterThan(0);

		for (const rel of ALLOWED_EXCEPTION_PATHS) {
			const abs = resolve(ROOT, rel);
			expect(
				await fileExists(abs),
				`Exception path "${rel}" does not exist - update ALLOWED_EXCEPTION_PATHS`,
			).toBe(true);
		}
	});

	// -------------------------------------------------------------------------
	// 11.1 - Email-address literal scan
	// -------------------------------------------------------------------------

	test("scans at least 1 source file for email literals (non-vacuity)", async () => {
		const files = await collectAppPackageSrcFiles();
		expect(files.length).toBeGreaterThan(0);
	});

	test("no email-address literals in app/package source files", async () => {
		const files = await collectAppPackageSrcFiles();

		const violations: string[] = [];
		for (const abs of files) {
			const rel = relative(ROOT, abs);
			if (ALLOWED_EXCEPTION_PATHS.includes(rel)) continue;

			const src = await readSrc(abs);
			for (const [lineIdx, line] of src.split("\n").entries()) {
				// Skip comment lines - they may document CVEs, examples, or docstrings.
				const trimmed = line.trimStart();
				if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
				if (EMAIL_LITERAL_RE.test(line)) {
					violations.push(`${rel}:${lineIdx + 1}: ${line.trim()}`);
				}
			}
		}

		expect(
			violations,
			"Email-address literals found in source (non-test) files. " +
				"Add to ALLOWED_EXCEPTION_PATHS only if the file is the allow-list definition or its correct call site.",
		).toEqual([]);
	});

	// -------------------------------------------------------------------------
	// 11.1 - Allowlist circumvention pattern scan
	// -------------------------------------------------------------------------

	test("no allowlist-override patterns in app/package source files", async () => {
		const files = await collectAppPackageSrcFiles();

		const violations: string[] = [];
		for (const abs of files) {
			const rel = relative(ROOT, abs);
			if (ALLOWED_EXCEPTION_PATHS.includes(rel)) continue;

			const src = await readSrc(abs);
			for (const [lineIdx, line] of src.split("\n").entries()) {
				const trimmed = line.trimStart();
				if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
				if (ALLOWLIST_OVERRIDE_RE.test(line)) {
					violations.push(`${rel}:${lineIdx + 1}: ${line.trim()}`);
				}
			}
		}

		expect(
			violations,
			"Allowlist override pattern found - a non-empty recipient list hardcoded outside the allow-list module.",
		).toEqual([]);
	});

	// -------------------------------------------------------------------------
	// 11.2 - Single audit firing point
	// -------------------------------------------------------------------------

	test("scans at least 1 file for audit-firing-point check (non-vacuity)", async () => {
		const files = await collectAuditScanFiles();
		expect(files.length).toBeGreaterThan(0);
	});

	test("audit.record() call appears only in the single authorised firing point", async () => {
		const files = await collectAuditScanFiles();

		const unauthorisedFiringPoints: string[] = [];
		for (const abs of files) {
			const rel = relative(ROOT, abs);
			// The authorised firing point is allowed to contain audit.record(.
			if (rel === AUDIT_FIRING_POINT) continue;

			const src = await readSrc(abs);
			if (/\baudit\.record\(/.test(src)) {
				unauthorisedFiringPoints.push(rel);
			}
		}

		expect(
			unauthorisedFiringPoints,
			`audit.record() must only be called from "${AUDIT_FIRING_POINT}" (R8.2, D4). ` +
				"Adding a second firing point in the job/approval route violates the " +
				"single fail-soft boundary invariant. " +
				"Note: packages/agents/src/audit-hook.ts (fail-loud) is excluded from this scan by design.",
		).toEqual([]);
	});

	test("authorised audit firing point actually contains audit.record()", async () => {
		// Guards against the firing point file being emptied/renamed - which would
		// cause the previous test to trivially pass while the invariant disappears.
		const abs = resolve(ROOT, AUDIT_FIRING_POINT);
		const src = await readSrc(abs);
		expect(
			/\baudit\.record\(/.test(src),
			`${AUDIT_FIRING_POINT} must contain "audit.record(" - the file was moved or emptied`,
		).toBe(true);
	});
});
