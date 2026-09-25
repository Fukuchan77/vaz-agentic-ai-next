import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workerDir = fileURLToPath(new URL("..", import.meta.url));
const registerLoader = fileURLToPath(new URL("../register-typescript-loader.mjs", import.meta.url));

describe("worker TypeScript runtime loader", () => {
	test("loads source-only workspace packages resolved through node_modules", () => {
		const result = spawnSync(
			process.execPath,
			[
				"--import",
				registerLoader,
				"--input-type=module",
				"--eval",
				"await import('@vaz/config/logger'); await import('./src/audit'); process.stdout.write('loaded')",
			],
			{
				cwd: workerDir,
				encoding: "utf8",
			},
		);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toBe("loaded");
	});
});
