import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";

export default defineConfig({
	testDir: "./apps/web/tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
	],
	webServer: {
		// Invoke Next directly instead of through `pnpm --filter ... exec`. pnpm 12
		// detaches the Next child into a separate process group, so Playwright kills
		// only the pnpm wrapper during teardown and waits forever while Next keeps
		// port 3000 open. Keeping Next in Playwright's process group makes teardown
		// deterministic and prevents a stale server from poisoning the next run.
		command: `node node_modules/next/dist/bin/next ${process.env.CI ? "start" : "dev"} --port ${PORT}`,
		cwd: "apps/web",
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		// Generous timeout to allow for Next.js's initial compilation.
		timeout: 120_000,
		env: {
			...process.env,
			// Fixed, non-secret value so hitl-approval.spec.ts's forged-approval case
			// is deterministic regardless of the developer's shell env (a real
			// deployment secret belongs in TOOL_APPROVAL_SECRET, never here) — see
			// packages/agents/src/chat-agent.ts's experimental_toolApprovalSecret wiring.
			TOOL_APPROVAL_SECRET: "e2e-fixed-test-secret-not-for-production-use",
		},
	},
});
