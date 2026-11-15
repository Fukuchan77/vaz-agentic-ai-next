import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

/**
 * Preserve the repository's extensionless relative imports. Node's native ESM
 * resolver requires an extension, while the TypeScript source and bundler-mode
 * type checking intentionally use imports such as `./audit`.
 *
 * Both hooks are synchronous: they are installed with `module.registerHooks()`
 * (see register-typescript-loader.mjs), which runs them in-thread.
 */
export function resolve(specifier, context, nextResolve) {
	try {
		return nextResolve(specifier, context);
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
 *
 * `mode: "strip"` is the only mode Node 26 accepts (`"transform"` was removed
 * with `--experimental-transform-types` and now throws ERR_INVALID_ARG_VALUE).
 * Strip mode erases types in place, so line/column positions already match the
 * source and no source map is needed; it rejects non-erasable syntax (enums,
 * namespaces, parameter properties), which `erasableSyntaxOnly` in
 * packages/config/tsconfig.base.json already forbids at typecheck time.
 */
export function load(url, context, nextLoad) {
	if (!url.startsWith("file:") || !url.endsWith(".ts")) {
		return nextLoad(url, context);
	}

	const source = readFileSync(new URL(url), "utf8");
	return {
		format: "module",
		shortCircuit: true,
		source: stripTypeScriptTypes(source, {
			mode: "strip",
			sourceUrl: url,
		}),
	};
}
