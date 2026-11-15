import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Erasable-syntax guard (ADR-0010).
 *
 * The worker loads source-only TypeScript through Node's `stripTypeScriptTypes` in
 * `mode: "strip"`, which cannot erase `enum`, `namespace` or parameter properties.
 * `erasableSyntaxOnly` turns those into typecheck errors, so the runtime never meets
 * them. If a tsconfig override flips it off, nothing else fails until the container
 * starts. This guard reads the *effective* value (`tsc --showConfig` resolves
 * `extends`), so an override in a lower tsconfig is caught too.
 *
 * Scope: `apps/worker` (its own `src/`) and `apps/web` (which type-checks the
 * `@vaz/*` sources the worker imports). `packages/evals` typechecks with
 * `--ignoreConfig` and is never loaded by the worker.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TSC = fileURLToPath(new URL("../../node_modules/.bin/tsc", import.meta.url));

interface ShowConfig {
	compilerOptions?: { erasableSyntaxOnly?: boolean };
}

function showConfig(project: string): ShowConfig {
	const result = spawnSync(TSC, ["--showConfig", "-p", project], {
		cwd: ROOT,
		encoding: "utf8",
	});
	expect(result.status, result.stderr).toBe(0);

	// Anti-false-green: the output must be JSON that carries `compilerOptions`, or the
	// `erasableSyntaxOnly` check below would compare `undefined` and could never fail
	// for the right reason.
	const parsed = JSON.parse(result.stdout) as ShowConfig;
	expect(parsed.compilerOptions).toBeTypeOf("object");
	return parsed;
}

describe("erasableSyntaxOnly is on for code the worker loads", () => {
	test.each(["apps/worker/tsconfig.json", "apps/web/tsconfig.json"])(
		"%s resolves to erasableSyntaxOnly: true",
		(project) => {
			expect(showConfig(project).compilerOptions?.erasableSyntaxOnly).toBe(true);
		},
	);
});
