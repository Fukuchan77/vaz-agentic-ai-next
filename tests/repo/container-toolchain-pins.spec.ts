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
 * (the version the image installs with npm, since Node 25+ images ship no corepack),
 * and Node to `mise.toml`'s `[tools]` major (what CI and every developer shell
 * provision). `apps/worker`'s `engines.node` follows the same major.
 */

const DOCKERFILE = new URL("../../apps/worker/Dockerfile", import.meta.url);
const PACKAGE_JSON = new URL("../../package.json", import.meta.url);
const MISE_TOML = new URL("../../mise.toml", import.meta.url);
const WORKER_PACKAGE_JSON = new URL("../../apps/worker/package.json", import.meta.url);

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

	test("the build stage re-declares PNPM_VERSION so the install is pinned", async () => {
		const dockerfile = await readFile(DOCKERFILE, "utf8");

		// An ARG declared before the first FROM is not visible inside a stage: without a bare
		// `ARG PNPM_VERSION` in the build stage, `pnpm@${PNPM_VERSION}` expands to `pnpm@` and
		// npm installs the latest pnpm, silently unpinning the image from `packageManager`.
		const stages = dockerfile.split(/^FROM /m).slice(1);
		const build = stages.find((stage) => /\bAS build\b/.test(stage.split("\n")[0] ?? ""));
		expect(build, "no `FROM ... AS build` stage found").toBeDefined();
		expect(build).toMatch(/^ARG PNPM_VERSION$/m);
		// The install must come after the re-declaration.
		const body = build ?? "";
		expect(body.indexOf("ARG PNPM_VERSION\n")).toBeLessThan(
			body.indexOf("npm install --global pnpm@"),
		);
		// The install line itself must reference the ARG, not a literal version or `latest`.
		expect(body).toMatch(/^RUN npm install --global pnpm@\$\{PNPM_VERSION\}$/m);
	});

	test("every FROM stage takes its Node image from the NODE_VERSION ARG", async () => {
		const dockerfile = await readFile(DOCKERFILE, "utf8");
		const froms = [...dockerfile.matchAll(/^FROM (\S+)/gm)].map((m) => m[1]);

		// Anti-false-green: a Dockerfile with no FROM lines would pass the loop below vacuously.
		expect(froms.length).toBeGreaterThan(0);
		const runtimeImage = "node:" + "$" + "{NODE_VERSION}-slim";
		expect(froms.filter((image) => image !== runtimeImage)).toEqual([]);
	});

	test("NODE_VERSION equals the mise.toml [tools] node major", async () => {
		const dockerfile = await readFile(DOCKERFILE, "utf8");
		const miseToml = await readFile(MISE_TOML, "utf8");

		const expected = /^node = "(\d+)"$/m.exec(miseToml)?.[1];
		expect(expected).toMatch(/^\d+$/);

		expect(readArg(dockerfile, "NODE_VERSION")).toBe(expected);
	});

	test("apps/worker engines.node is `>=` the mise.toml [tools] node major", async () => {
		const miseToml = await readFile(MISE_TOML, "utf8");
		const { engines } = JSON.parse(await readFile(WORKER_PACKAGE_JSON, "utf8")) as {
			engines?: { node?: string };
		};

		// Anti-false-green: both sides must parse, or the comparison is undefined === undefined.
		const expected = /^node = "(\d+)"$/m.exec(miseToml)?.[1];
		expect(expected).toMatch(/^\d+$/);
		const actual = /^>=(\d+)$/.exec(engines?.node ?? "")?.[1];
		expect(actual).toMatch(/^\d+$/);

		expect(actual).toBe(expected);
	});
});
