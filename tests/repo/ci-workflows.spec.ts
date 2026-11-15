import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";

/**
 * X-1 guard: every `.github/workflows/*.yml` `uses:` reference must be pinned to a
 * 40-hex-char commit SHA (never a mutable tag/branch), and every workflow must
 * declare its own `permissions:` block rather than relying on the org/repo
 * default (which can be `write-all`). Modeled on
 * `fastapi-pydantic-ai-agent/tests/unit/test_ci_workflows.py`, the sibling repo
 * this repo scored 0/22 and 0/6 against in the cross-repo review (docs/cross-repo-adoption-backlog.md, X-1).
 */

const WORKFLOWS_DIR = new URL("../../.github/workflows/", import.meta.url);
const SHA_PIN = /^[^@]+@[0-9a-f]{40}$/;

interface WorkflowStep {
	uses?: string;
	run?: string;
	with?: Record<string, unknown>;
	env?: Record<string, unknown>;
}

interface WorkflowJob {
	steps?: WorkflowStep[];
	permissions?: unknown;
	env?: Record<string, unknown>;
}

interface WorkflowDoc {
	permissions?: unknown;
	env?: Record<string, unknown>;
	jobs?: Record<string, WorkflowJob>;
}

async function loadWorkflows(): Promise<Array<{ file: string; doc: WorkflowDoc }>> {
	const entries = await readdir(WORKFLOWS_DIR);
	const files = entries.filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
	return Promise.all(
		files.map(async (file) => {
			const text = await readFile(new URL(file, WORKFLOWS_DIR), "utf8");
			return { file, doc: parse(text) as WorkflowDoc };
		}),
	);
}

describe("GitHub Actions workflow hygiene (X-1)", () => {
	test("scans at least one workflow file (anti-false-green)", async () => {
		const workflows = await loadWorkflows();
		expect(workflows.length).toBeGreaterThan(0);
	});

	test("every `uses:` step reference is pinned to a commit SHA", async () => {
		const workflows = await loadWorkflows();
		const unpinned: string[] = [];
		let scannedUses = 0;

		for (const { file, doc } of workflows) {
			for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
				for (const step of job.steps ?? []) {
					if (!step.uses) continue;
					scannedUses += 1;
					if (!SHA_PIN.test(step.uses)) {
						unpinned.push(`${file}#${jobId}: ${step.uses}`);
					}
				}
			}
		}

		expect(scannedUses).toBeGreaterThan(0);
		expect(unpinned).toEqual([]);
	});

	test("every workflow declares its own `permissions:` block", async () => {
		const workflows = await loadWorkflows();
		const missing = workflows
			.filter(({ doc }) => doc.permissions === undefined)
			.map(({ file }) => file);

		expect(missing).toEqual([]);
	});
});

/**
 * Node pin guard (spec 011 R2.4).
 *
 * `mise.toml` `[tools] node` is the single source of the Node major; CI gets it
 * through `jdx/mise-action`, which reads `mise.toml`. So a workflow must not name a
 * Node version of its own. Four negative conditions, plus one precondition:
 *
 *  1. no `actions/setup-node` step,
 *  2. no `node-version` key under `with:`,
 *  3. no `NODE_VERSION` environment variable,
 *  4. no input that overrides mise's resolution: `install_args` / `mise_toml` under a
 *     `jdx/mise-action` step's `with:`, or any `MISE_*` key in a workflow-, job- or
 *     step-level `env:` (`MISE_NODE_VERSION` would install a Node that `mise.toml`
 *     does not name, for CI only).
 *
 * The check is negative-only on purpose: `codeql.yml` and `dependency-review.yml` use
 * neither mise nor Node, so "every workflow uses mise-action" would be false.
 *
 * Limit: this proves no *other* Node version is declared. It does not prove that
 * `jdx/mise-action` reads `mise.toml` — that is the action's documented behaviour.
 */
const MISE_ACTION = /^jdx\/mise-action@/;

function envKeys(env: Record<string, unknown> | undefined): string[] {
	return Object.keys(env ?? {});
}

async function scanNodePins() {
	const workflows = await loadWorkflows();
	const findings: string[] = [];
	let miseActionSteps = 0;

	for (const { file, doc } of workflows) {
		for (const key of envKeys(doc.env)) {
			if (key === "NODE_VERSION") findings.push(`${file}: env NODE_VERSION`);
			if (key.startsWith("MISE_")) findings.push(`${file}: workflow env ${key}`);
		}
		for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
			for (const key of envKeys(job.env)) {
				if (key === "NODE_VERSION") findings.push(`${file}#${jobId}: env NODE_VERSION`);
				if (key.startsWith("MISE_")) findings.push(`${file}#${jobId}: job env ${key}`);
			}
			for (const step of job.steps ?? []) {
				const where = `${file}#${jobId}`;
				if (step.uses?.startsWith("actions/setup-node@")) findings.push(`${where}: setup-node`);
				if (step.with && "node-version" in step.with) findings.push(`${where}: with node-version`);
				for (const key of envKeys(step.env)) {
					if (key === "NODE_VERSION") findings.push(`${where}: env NODE_VERSION`);
					if (key.startsWith("MISE_")) findings.push(`${where}: step env ${key}`);
				}
				if (step.uses && MISE_ACTION.test(step.uses)) {
					miseActionSteps += 1;
					for (const input of ["install_args", "mise_toml"]) {
						if (step.with && input in step.with) findings.push(`${where}: mise-action ${input}`);
					}
				}
			}
		}
	}

	return { scanned: workflows.length, miseActionSteps, findings };
}

describe("CI takes the Node version from mise.toml only (R2.4)", () => {
	test("scans workflows and at least one jdx/mise-action step (anti-false-green)", async () => {
		const { scanned, miseActionSteps } = await scanNodePins();

		expect(scanned).toBeGreaterThan(0);
		// With zero mise-action steps, the MISE_* / install_args checks below see nothing.
		expect(miseActionSteps).toBeGreaterThan(0);
	});

	test("no workflow declares a Node version or overrides mise's resolution", async () => {
		const { findings } = await scanNodePins();

		expect(findings).toEqual([]);
	});
});

/**
 * `security-daily.yml` is the only standing detection net for an advisory that lands
 * against an *unchanged* lockfile: every other audit path is path-filtered
 * (`tests.yml` to the npm workspace, `python.yml` to services/agent, `api.yml` to
 * services/api) and so never fires on that case. A lane missing from this workflow
 * therefore fails silently — no red job, just no coverage, which is how services/api
 * went unwatched from its import until 2026-09-22. This guard pins the mapping in the
 * direction that matters: every audit task mise.toml defines must be reachable from
 * security-daily.yml, so adding a fourth lane's audit task without wiring it up here
 * fails the build instead of quietly shipping a blind spot.
 */
const MISE_TOML = new URL("../../mise.toml", import.meta.url);
const SECURITY_DAILY = new URL("security-daily.yml", WORKFLOWS_DIR);

/** `[tasks.audit]` and `[tasks."py:audit"]` alike — quoted or bare. */
const TASK_HEADER = /^\[tasks\.(?:"([^"]+)"|([A-Za-z0-9:_-]+))\]/gm;

/** Task name + the shell command it runs, for every `*:audit`/`audit` task. */
async function loadAuditTasks(): Promise<Array<{ name: string; command: string }>> {
	const text = await readFile(MISE_TOML, "utf8");
	const headers = [...text.matchAll(TASK_HEADER)];

	return headers.flatMap((header, index) => {
		const name = header[1] ?? header[2];
		if (name !== "audit" && !name.endsWith(":audit")) return [];

		// Body runs to the next task header (or EOF for the last task).
		const start = header.index + header[0].length;
		const end = headers[index + 1]?.index ?? text.length;
		const command = /^run = "(.+)"$/m.exec(text.slice(start, end))?.[1] ?? "";
		return [{ name, command }];
	});
}

describe("security-daily covers every audit lane", () => {
	test("every mise `audit` task is invoked by security-daily.yml", async () => {
		const auditTasks = await loadAuditTasks();
		const doc = parse(await readFile(SECURITY_DAILY, "utf8")) as WorkflowDoc;
		const runs = Object.values(doc.jobs ?? {}).flatMap((job) =>
			(job.steps ?? []).map((step) => step.run ?? ""),
		);

		// Anti-false-green: a scan that found no tasks, or no steps, proves nothing.
		expect(auditTasks.length).toBeGreaterThan(0);
		expect(runs.length).toBeGreaterThan(0);

		// A lane counts as covered either way it can be wired: delegated to the mise
		// task (`mise run py:audit`) or running the task's own command inline, which
		// is how the npm leg spells `pnpm audit --audit-level=moderate`.
		const uncovered = auditTasks
			.filter(
				({ name, command }) =>
					!runs.some((run) => run.includes(`mise run ${name}`)) &&
					!(command !== "" && runs.some((run) => run.includes(command))),
			)
			.map(({ name }) => name);

		expect(uncovered).toEqual([]);
	});
});
