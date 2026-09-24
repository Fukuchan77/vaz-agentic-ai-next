import { readFile } from "node:fs/promises";

/**
 * Container toolchain drift guard.
 *
 * `apps/worker/Dockerfile` pins its toolchain in build ARGs, and nothing in
 * `mise run check` builds that image — so when the repo moved pnpm 11 -> 12 on
 * 2026-09-22, `ARG PNPM_VERSION=11.10.0` was left behind and every gate stayed green.
 * A pnpm whose major disagrees with the committed `pnpm-lock.yaml` either refuses
 * `pnpm install --frozen-lockfile` or silently re-resolves it, so the drift turns a
 * reproducible image into a broken or non-reproducible one, and only a deploy finds out.
 *
 * These tests pin each ARG to the value that already has a single source of truth
 * elsewhere in the repo: pnpm to the root `package.json`'s `packageManager` field
 * (what corepack activates everywhere else), and Node to `mise.toml`'s `[tools]` major
 * (what CI and every developer shell provision).
 */

const DOCKERFILE = new URL("../../apps/worker/Dockerfile", import.meta.url);
const PACKAGE_JSON = new URL("../../package.json", import.meta.url);
const MISE_TOML = new URL("../../mise.toml", import.meta.url);

/** `ARG NAME=value` — the last occurrence wins, matching Docker's own semantics. */
function readArg(dockerfile: string, name: string): string | undefined {
	const matches = [...dockerfile.matchAll(new RegExp(`^ARG ${name}=(.+)$`, "gm"))];
	return matches.at(-1)?.[1].trim();
}

describe("apps/worker/Dockerfile toolchain pins", () => {
	test("PNPM_VERSION equals the root packageManager version", async () => {
		const dockerfile = await readFile(DOCKERFILE, "utf8");
		const { packageManager } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as {
			packageManager?: string;
		};

		// Anti-false-green: if either side stops being parseable the comparison below
		// would compare undefined to undefined and pass.
		const expected = /^pnpm@(\d+\.\d+\.\d+)\+sha512\./.exec(packageManager ?? "")?.[1];
		expect(expected).toMatch(/^\d+\.\d+\.\d+$/);

		expect(readArg(dockerfile, "PNPM_VERSION")).toBe(expected);
	});

	test("NODE_VERSION equals the mise.toml [tools] node major", async () => {
		const dockerfile = await readFile(DOCKERFILE, "utf8");
		const miseToml = await readFile(MISE_TOML, "utf8");

		const expected = /^node = "(\d+)"$/m.exec(miseToml)?.[1];
		expect(expected).toMatch(/^\d+$/);

		expect(readArg(dockerfile, "NODE_VERSION")).toBe(expected);
	});
});
