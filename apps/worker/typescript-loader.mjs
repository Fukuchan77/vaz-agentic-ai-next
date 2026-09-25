import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

/**
 * Preserve the repository's extensionless relative imports. Node's native ESM
 * resolver requires an extension, while the TypeScript source and bundler-mode
 * type checking intentionally use imports such as `./audit`.
 */
export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context);
	} catch (error) {
		if (
			error?.code !== "ERR_MODULE_NOT_FOUND" ||
			(!specifier.startsWith("./") && !specifier.startsWith("../"))
		) {
			throw error;
		}

		return nextResolve(`${specifier}.ts`, context);
	}
}

/**
 * Load source-only workspace packages after `pnpm deploy` places them under
 * node_modules. Node's built-in TypeScript loader deliberately refuses to strip
 * files whose resolved path is inside node_modules, even when those files are
 * first-party `@vaz/*` workspace sources. Intercept every `.ts` module before
 * the default loader and apply Node's own transformer explicitly.
 */
export async function load(url, context, nextLoad) {
	if (!url.startsWith("file:") || !url.endsWith(".ts")) {
		return nextLoad(url, context);
	}

	const source = await readFile(new URL(url), "utf8");
	return {
		format: "module",
		shortCircuit: true,
		source: stripTypeScriptTypes(source, {
			mode: "transform",
			sourceMap: true,
			sourceUrl: url,
		}),
	};
}
