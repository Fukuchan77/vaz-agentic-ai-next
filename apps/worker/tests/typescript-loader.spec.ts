import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Every case spawns `process.execPath`, so the Node that runs this file is the
// Node under test (CI runs Node 26; the upgrade also runs it on Node 24 and Node 26 by hand).
const workerDir = fileURLToPath(new URL("..", import.meta.url));
const registerLoader = fileURLToPath(new URL("../register-typescript-loader.mjs", import.meta.url));

type Spawned = { status: number | null; stdout: string; stderr: string };

function run(args: string[], cwd: string): Spawned {
	const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// A fixture package placed as REAL files under `node_modules/`. The workspace's
// `apps/worker/node_modules/@vaz/*` entries are symlinks to `packages/*`, which
// Node resolves to their real path (outside `node_modules`), so they never hit
// the node_modules type-stripping refusal that the `load` hook exists to bypass.
// Only a real file under `node_modules/` (what `pnpm deploy` produces) does.
const fixtureRoot = mkdtempSync(join(tmpdir(), "vaz-loader-"));
const fixtureSrc = join(fixtureRoot, "node_modules", "@vaz", "fixture", "src");

// Line 2 carries type annotations BEFORE the throw expression on the same line,
// so a transform that rewrites the line (instead of blanking types in place)
// moves the reported line and column.
const THROWS_SOURCE = [
	"export const first: number = 1;",
	'const a: number = 1; const b: string = "x"; throw new Error("fixture-boom " + a + b);',
	"",
].join("\n");

beforeAll(() => {
	mkdirSync(fixtureSrc, { recursive: true });
	writeFileSync(
		join(fixtureRoot, "node_modules", "@vaz", "fixture", "package.json"),
		JSON.stringify({
			name: "@vaz/fixture",
			type: "module",
			exports: { "./*": "./src/*.ts" },
		}),
	);
	writeFileSync(join(fixtureSrc, "non-erasable.ts"), "export enum Color { Red, Green }\n");
	writeFileSync(join(fixtureSrc, "throws.ts"), THROWS_SOURCE);
	writeFileSync(join(fixtureSrc, "typed.ts"), "export const value: number = 42;\n");
});

afterAll(() => {
	rmSync(fixtureRoot, { recursive: true, force: true });
});

function importFixture(name: string, withLoader: boolean): Spawned {
	return run(
		[
			...(withLoader ? ["--import", registerLoader] : []),
			"--input-type=module",
			"--eval",
			`try { const m = await import('@vaz/fixture/${name}'); process.stdout.write(String(m.value)); } catch (e) { process.stderr.write(String(e.code) + "\\n" + String(e.stack)); process.exit(1); }`,
		],
		fixtureRoot,
	);
}

describe("worker TypeScript runtime loader", () => {
	const workerModules = readdirSync(join(workerDir, "src")).filter((f) => f.endsWith(".ts"));
	const EVAL = [
		'const { readdirSync } = await import("node:fs");',
		'const files = readdirSync("./src").filter((f) => f.endsWith(".ts")).sort();',
		'if (files.length === 0) throw new Error("no worker modules found");',
		'for (const f of files) await import("./src/" + f);',
		'await import("@vaz/config/logger");',
		'process.stdout.write("all-loaded " + files.length);',
	].join("\n");
	const loadAll = () =>
		run(
			["--throw-deprecation", "--import", registerLoader, "--input-type=module", "--eval", EVAL],
			workerDir,
		);

	// L-1: exercises the `resolve` hook (extensionless relative imports) over every module.
	test("L-1 loads every worker module and a workspace package", () => {
		expect(workerModules.length).toBeGreaterThan(0);
		const result = loadAll();

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toBe(`all-loaded ${workerModules.length}`);
	});

	// L-2: Node 26 runtime-deprecates `module.register()` (DEP0205); the loader must be
	// installed through an API that neither Node 24 nor Node 26 warns about.
	test("L-2 raises no deprecation warning while loading", () => {
		const result = loadAll();

		expect(result.stderr).not.toContain("DeprecationWarning");
		expect(result.status, result.stderr).toBe(0);
	});

	// L-3: strip mode only. Non-erasable syntax must fail loudly (ADR-0010), not be transformed.
	test("L-3 rejects non-erasable syntax instead of transforming it", () => {
		const result = importFixture("non-erasable", true);

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
		expect(result.stderr).not.toContain("ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING");
	});

	// L-4: strip mode keeps positions, so stack traces point at the original source.
	test("L-4 reports stack positions that match the original source", () => {
		const lines = THROWS_SOURCE.split("\n");
		const expectedLine = lines.findIndex((l) => l.includes('new Error("fixture-boom')) + 1;
		const expectedColumn = (lines[expectedLine - 1] ?? "").indexOf("new Error(") + 1;
		expect(expectedLine).toBeGreaterThan(0);
		expect(expectedColumn).toBeGreaterThan(0);

		const result = importFixture("throws", true);

		expect(result.status).not.toBe(0);
		const frame = /throws\.ts:(\d+):(\d+)/.exec(result.stderr);
		expect(frame, result.stderr).not.toBeNull();
		expect({ line: Number(frame?.[1]), column: Number(frame?.[2]) }).toEqual({
			line: expectedLine,
			column: expectedColumn,
		});
	});

	// L-5: the `load` hook is what makes a real `node_modules/**/*.ts` file readable.
	test("L-5 loads a real node_modules .ts file only with the loader registered", () => {
		const withLoader = importFixture("typed", true);
		expect(withLoader.status, withLoader.stderr).toBe(0);
		expect(withLoader.stdout).toBe("42");

		const withoutLoader = importFixture("typed", false);
		expect(withoutLoader.status).not.toBe(0);
		expect(withoutLoader.stderr).toContain("ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING");
	});
});
