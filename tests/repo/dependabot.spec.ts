import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * X-15 guard: `.github/dependabot.yml` must exist, cover every ecosystem this
 * workspace actually has (npm/pnpm workspace, the uv-managed Python sidecar,
 * GitHub Actions), and keep its `ignore:` list for the npm ecosystem in sync
 * with the 3 majors AGENTS.md/CLAUDE.md record as deliberately held back —
 * so a bump to one of those ranges in root `package.json` doesn't silently
 * leave a stale (or missing) `ignore:` entry behind. Modeled on
 * `fastapi-pydantic-ai-agent/tests/unit/test_dependabot_config.py`
 * (docs/cross-repo-adoption-backlog.md, X-15).
 */

interface DependabotUpdate {
	"package-ecosystem"?: string;
	directory?: string;
	directories?: string[];
	cooldown?: { "default-days"?: number };
	ignore?: Array<{ "dependency-name"?: string; versions?: string[] }>;
}

interface DependabotDoc {
	updates?: DependabotUpdate[];
}

interface PackageJson {
	devDependencies?: Record<string, string>;
}

const ROOT = new URL("../../", import.meta.url);

// Deliberately-held-back majors (AGENTS.md / CLAUDE.md): package.json pins the
// range below; dependabot.yml must ignore the next major and above.
const HELD_BACK: ReadonlyArray<{ name: string; heldMajor: number }> = [
	{ name: "vitest", heldMajor: 4 },
	{ name: "@vitest/coverage-v8", heldMajor: 4 },
	{ name: "typescript", heldMajor: 6 },
	{ name: "@types/node", heldMajor: 24 },
];

/**
 * Every directory containing a `Dockerfile`, as a repo-root-relative Dependabot
 * `directories` path (leading slash, no trailing slash). Skips the directories a
 * Dependabot scan would never look in anyway, and which would otherwise make this walk
 * minutes long: dependency trees, build output and virtualenvs.
 */
const WALK_SKIP = new Set([".git", "node_modules", ".venv", ".next", "dist", "coverage"]);

async function findDockerfileDirs(dir = ROOT, prefix = ""): Promise<string[]> {
	const found: string[] = [];
	for (const entry of await readdir(fileURLToPath(dir), { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (WALK_SKIP.has(entry.name)) continue;
			found.push(
				...(await findDockerfileDirs(new URL(`${entry.name}/`, dir), `${prefix}/${entry.name}`)),
			);
		} else if (entry.name === "Dockerfile") {
			found.push(prefix === "" ? "/" : prefix);
		}
	}
	return found.sort();
}

async function loadDependabotConfig(): Promise<DependabotDoc> {
	const text = await readFile(new URL(".github/dependabot.yml", ROOT), "utf8");
	return parse(text) as DependabotDoc;
}

describe(".github/dependabot.yml (X-15)", () => {
	test("declares every ecosystem this workspace has (anti-false-green)", async () => {
		const doc = await loadDependabotConfig();
		const ecosystems = (doc.updates ?? []).map((u) => u["package-ecosystem"]);

		expect(doc.updates?.length).toBeGreaterThan(0);
		expect(ecosystems).toContain("npm");
		expect(ecosystems).toContain("uv");
		expect(ecosystems).toContain("github-actions");
		// Container base images resolve at `docker build` time and land in no lockfile,
		// so no audit job can see them; Dependabot is their only detection path. Added
		// 2026-09-22, after docker-compose.yml was found 26 minor releases behind on
		// `inngest/inngest` with nothing in CI able to notice.
		expect(ecosystems).toContain("docker");
		expect(ecosystems).toContain("docker-compose");
	});

	test("every directory holding a Dockerfile is covered by the docker ecosystem", async () => {
		const doc = await loadDependabotConfig();
		const dockerfileDirs = await findDockerfileDirs();
		const covered = new Set(
			(doc.updates ?? [])
				.filter((u) => u["package-ecosystem"] === "docker")
				.flatMap((u) => u.directories ?? (u.directory ? [u.directory] : [])),
		);

		// Anti-false-green: a walk that found no Dockerfile would make the diff below
		// trivially empty, which is the failure mode this whole file exists to prevent.
		expect(dockerfileDirs.length).toBeGreaterThan(0);
		expect(covered.size).toBeGreaterThan(0);

		expect(dockerfileDirs.filter((dir) => !covered.has(dir))).toEqual([]);
	});

	test("every package-registry ecosystem mirrors the 24h publish window", async () => {
		const doc = await loadDependabotConfig();
		// docs/dependency-policy.md §7: a bot must not propose a version newer than
		// `pnpm-workspace.yaml`'s `minimumReleaseAge: 1440` allows, and that binds every
		// registry-backed ecosystem rather than whichever blocks were written first.
		// `github-actions` is deliberately excluded — the policy governs package
		// registries, not action refs, and dependabot.yml says why in its own comment.
		const registryEcosystems = (doc.updates ?? []).filter(
			(u) => u["package-ecosystem"] !== "github-actions",
		);

		expect(registryEcosystems.length).toBeGreaterThan(0);

		const missing = registryEcosystems
			.filter((u) => u.cooldown?.["default-days"] !== 1)
			.map((u) => `${u["package-ecosystem"]}:${u.directory ?? u.directories?.join(",")}`);

		expect(missing).toEqual([]);
	});

	test("npm ecosystem ignores exactly the majors held back in package.json", async () => {
		const [doc, packageJsonText] = await Promise.all([
			loadDependabotConfig(),
			readFile(new URL("package.json", ROOT), "utf8"),
		]);
		const packageJson = JSON.parse(packageJsonText) as PackageJson;

		const npmUpdate = doc.updates?.find((u) => u["package-ecosystem"] === "npm");
		expect(npmUpdate).toBeDefined();
		const ignoreByName = new Map(
			(npmUpdate?.ignore ?? []).map((entry) => [entry["dependency-name"], entry.versions ?? []]),
		);

		for (const { name, heldMajor } of HELD_BACK) {
			const declaredRange = packageJson.devDependencies?.[name];
			expect(declaredRange, `${name} must still be a devDependency`).toBeDefined();
			expect(
				declaredRange,
				`package.json's ${name} range must stay on major ${heldMajor} — ` +
					"update this test's HELD_BACK table (and the AGENTS.md/CLAUDE.md bullet) if it changed on purpose",
			).toMatch(new RegExp(`^[~^]?${heldMajor}\\.`));

			const versions = ignoreByName.get(name);
			expect(versions, `dependabot.yml must ignore ${name} >= ${heldMajor + 1}`).toEqual([
				`>=${heldMajor + 1}`,
			]);
		}
	});
});
