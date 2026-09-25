import { readFile } from "node:fs/promises";

/**
 * E2E webServer process-group regression guard.
 *
 * `playwright.config.ts`'s `webServer.command` used to start the Next server
 * through `pnpm --filter @vaz/web exec next ...`. On pnpm 12, that `exec`
 * wrapper puts the Next child in a *different* process group than the pnpm
 * process Playwright spawns (verified: pnpm's own PID becomes its own PGID,
 * and the Next grandchild gets a third, independent PGID). Playwright's
 * teardown kills the group it spawned with `process.kill(-pid, "SIGKILL")` —
 * that reaches the pnpm wrapper, not the detached Next child, which then
 * keeps the port open and the test run never sees the `"close"` event it is
 * waiting for. Locally this hangs pre-push indefinitely; in CI it burns the
 * full job timeout before failing.
 *
 * The fix (see playwright.config.ts's own comment on `webServer.command`)
 * invokes the Next binary directly so it stays in Playwright's own process
 * group. This guard pins that property so a well-intentioned "simplify this
 * back to `pnpm --filter ... exec`" edit gets caught here instead of by a
 * hung pre-push hook or a CI timeout.
 */

const PLAYWRIGHT_CONFIG = new URL("../../playwright.config.ts", import.meta.url);

/** Extracts the single-line `command: \`...\`,` value out of the `webServer` block. */
function extractWebServerCommand(source: string): string {
	const webServerBlock = /webServer:\s*\{([\s\S]*?)\n\t\},\n\}\);/.exec(source)?.[1];
	expect(
		webServerBlock,
		"could not locate the webServer block in playwright.config.ts",
	).toBeTruthy();

	const command = /command:\s*`([^\n]*)`,/.exec(webServerBlock ?? "")?.[1];
	expect(command, "could not extract webServer.command from playwright.config.ts").toBeTruthy();

	return command ?? "";
}

describe("playwright.config.ts webServer.command", () => {
	test("does not route the Next server through a pnpm wrapper", async () => {
		const source = await readFile(PLAYWRIGHT_CONFIG, "utf8");
		const command = extractWebServerCommand(source);

		// Anti-false-green: the extraction itself must have found real content,
		// not an empty string that would vacuously pass every assertion below.
		expect(command.length).toBeGreaterThan(0);

		// `pnpm exec` / `pnpm --filter ... exec` / `pnpm run` all spawn the target
		// as a detached grandchild on pnpm 12 (see header comment) — none of them
		// belong in webServer.command regardless of which package is targeted.
		expect(command).not.toMatch(/\bpnpm\b/);
	});
});
