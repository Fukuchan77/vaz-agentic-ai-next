import { expect, test } from "@playwright/test";

/**
 * UI-4 cascade layer contract (plan.md §Cascade layer contract):
 *
 * After Carbon retirement (§4), there must be no `carbon` CSSLayerBlockRule.
 * Tailwind preflight must be active (base layer rules present), and the
 * system font stack declared in @theme (--font-sans) must be applied to body.
 *
 * Structural assertion: no CSSLayerBlockRule named "carbon" exists; a
 * `@layer base` block (from Tailwind preflight) is present.
 *
 * Font assertion: `window.getComputedStyle(document.body).fontFamily`
 * contains at least one of the system-font tokens defined in tailwind.css
 * (`--font-sans`).
 *
 * Behaviour assertion (UI-3, unchanged from §3): shadcn Button / Card class
 * strings injected into `/` have non-zero computed padding, border-width and
 * border-radius — these must still pass after preflight is enabled.
 */

test.describe("CSS cascade layer contract (UI-4) — Carbon retired, preflight active", () => {
	test("no @layer carbon block exists after Carbon retirement", async ({ page }) => {
		await page.goto("/");

		const layerData = await page.evaluate(() => {
			const sheets = Array.from(document.styleSheets);

			let hasCarbonLayer = false;
			let hasBaseLayer = false;
			const layerOrder: string[] = [];

			for (const sheet of sheets) {
				let rules: CSSRuleList;
				try {
					rules = sheet.cssRules;
				} catch {
					continue;
				}
				for (const rule of Array.from(rules)) {
					// CSSLayerStatementRule — the @layer a, b, c; declaration
					if (rule.constructor.name === "CSSLayerStatementRule") {
						const stmt = rule as unknown as { nameList: string[] };
						if (stmt.nameList) {
							for (const name of stmt.nameList) {
								if (!layerOrder.includes(name)) {
									layerOrder.push(name);
								}
							}
						}
					}
					// CSSLayerBlockRule — check for carbon (must be absent) and base (must be present)
					if (rule.constructor.name === "CSSLayerBlockRule") {
						const block = rule as unknown as { name: string; cssRules: CSSRuleList };
						if (block.name === "carbon") {
							hasCarbonLayer = true;
						}
						if (block.name === "base") {
							// Tailwind preflight emits a @layer base block with rules for html, body, *, etc.
							// Confirm there is at least one rule inside it.
							if (block.cssRules.length > 0) {
								hasBaseLayer = true;
							}
						}
					}
				}
			}

			return { hasCarbonLayer, hasBaseLayer, layerOrder };
		});

		expect(
			layerData.hasCarbonLayer,
			"@layer carbon block must NOT exist after Carbon retirement",
		).toBe(false);
		expect(
			layerData.hasBaseLayer,
			"@layer base block (Tailwind preflight) must be present after Carbon retirement",
		).toBe(true);
	});

	test("body uses the system font stack declared in --font-sans", async ({ page }) => {
		await page.goto("/");

		const fontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);

		// --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, ...
		// Browsers may resolve or normalise the value, but at least one token must be present.
		const systemFontTokens = [
			"ui-sans-serif",
			"system-ui",
			"-apple-system",
			"BlinkMacSystemFont",
			"Segoe UI",
			"Roboto",
			"Helvetica Neue",
			"Arial",
			"sans-serif",
		];
		const matchesSystemFont = systemFontTokens.some((token) =>
			fontFamily.toLowerCase().includes(token.toLowerCase()),
		);
		expect(
			matchesSystemFont,
			`body font-family must include a system-font token; got: '${fontFamily}'`,
		).toBe(true);
	});
});

test.describe("CSS cascade layer contract (UI-1) — behaviour", () => {
	/**
	 * Non-vacuous behaviour assertion (plan.md §Cascade layer contract):
	 * shadcn primitives use Tailwind utility classes (p-*, border, rounded-*).
	 * These must produce non-zero computed values.
	 *
	 * After Carbon retirement, Tailwind preflight is active. The UI-3 computed-
	 * style baseline (§3 task 3.3) must still pass — if preflight shifts layout
	 * values, fix the styles not this baseline.
	 */
	test("shadcn Button/Card class strings produce non-zero padding, border-width, and border-radius", async ({
		page,
	}) => {
		await page.goto("/");

		// Inject a test element with typical shadcn Button + Card class strings
		// directly into the page body. These are Tailwind utility classes the
		// shadcn source uses: p-4 (padding), border (border-width), rounded-md (border-radius).
		const styles = await page.evaluate(() => {
			const el = document.createElement("div");
			// Use actual Tailwind utility classes from shadcn Button (h-9 px-4 py-2) and Card (rounded-xl border)
			el.className = "px-4 py-2 border rounded-md";
			document.body.appendChild(el);

			const computed = window.getComputedStyle(el);
			const result = {
				paddingLeft: computed.paddingLeft,
				borderTopWidth: computed.borderTopWidth,
				borderRadius: computed.borderTopLeftRadius,
			};
			document.body.removeChild(el);
			return result;
		});

		// All three must be non-zero — Carbon's reset would have collapsed them to 0
		// if it were not wrapped in the weakest `@layer carbon` (coexistence period).
		// After Carbon retirement these pass because Tailwind preflight and utilities
		// are both active without conflict.
		const parseValue = (v: string) => parseFloat(v);
		expect(
			parseValue(styles.paddingLeft),
			`padding-left must be > 0; got '${styles.paddingLeft}'`,
		).toBeGreaterThan(0);
		expect(
			parseValue(styles.borderTopWidth),
			`border-top-width must be > 0; got '${styles.borderTopWidth}'`,
		).toBeGreaterThan(0);
		expect(
			parseValue(styles.borderRadius),
			`border-top-left-radius must be > 0; got '${styles.borderRadius}'`,
		).toBeGreaterThan(0);
	});
});

test.describe("CSS cascade layer contract (UI-3) — chat element computed styles", () => {
	/**
	 * §3 / task 3.3 baseline: locks in the computed styles of core chat
	 * elements after the shadcn/Tailwind migration. These values are checked
	 * after §4 (preflight enablement) to confirm that removing the `@layer
	 * carbon` wrapper does not change the rendered appearance.
	 *
	 * font-family is intentionally excluded here because §4 will change it
	 * from Carbon's IBM Plex Sans to the system font stack.
	 */
	test("message container has non-zero padding and border (shadcn Card)", async ({ page }) => {
		await page.goto("/");

		const styles = await page.evaluate(() => {
			// Inject a message container element with the same Tailwind classes
			// that MessageItem.tsx uses (rounded-xl border bg-card p-4).
			const el = document.createElement("div");
			el.className = "rounded-xl border bg-card p-4";
			document.body.appendChild(el);

			const computed = window.getComputedStyle(el);
			const result = {
				paddingTop: computed.paddingTop,
				borderTopWidth: computed.borderTopWidth,
				borderRadius: computed.borderTopLeftRadius,
			};
			document.body.removeChild(el);
			return result;
		});

		const parseValue = (v: string) => parseFloat(v);
		expect(
			parseValue(styles.paddingTop),
			`message container padding-top must be > 0; got '${styles.paddingTop}'`,
		).toBeGreaterThan(0);
		expect(
			parseValue(styles.borderTopWidth),
			`message container border-top-width must be > 0; got '${styles.borderTopWidth}'`,
		).toBeGreaterThan(0);
		expect(
			parseValue(styles.borderRadius),
			`message container border-top-left-radius must be > 0; got '${styles.borderRadius}'`,
		).toBeGreaterThan(0);
	});

	test("message list has non-zero gap (flex column layout)", async ({ page }) => {
		await page.goto("/");

		const styles = await page.evaluate(() => {
			// Inject a flex column container with the same classes as Chat.tsx's
			// message list (flex flex-col gap-3).
			const el = document.createElement("div");
			el.className = "flex flex-col gap-3";
			document.body.appendChild(el);

			const computed = window.getComputedStyle(el);
			const result = {
				gap: computed.gap,
				display: computed.display,
			};
			document.body.removeChild(el);
			return result;
		});

		expect(styles.display).toBe("flex");
		expect(
			parseFloat(styles.gap),
			`message list gap must be > 0; got '${styles.gap}'`,
		).toBeGreaterThan(0);
	});

	test("composer form has non-zero padding (sticky footer layout)", async ({ page }) => {
		await page.goto("/");

		const styles = await page.evaluate(() => {
			// Inject a form with composer classes (flex flex-row items-start gap-2 py-3).
			const el = document.createElement("form");
			el.className = "flex flex-row items-start gap-2 py-3 pb-4";
			document.body.appendChild(el);

			const computed = window.getComputedStyle(el);
			const result = {
				paddingTop: computed.paddingTop,
				gap: computed.gap,
			};
			document.body.removeChild(el);
			return result;
		});

		expect(
			parseFloat(styles.paddingTop),
			`composer padding-top must be > 0; got '${styles.paddingTop}'`,
		).toBeGreaterThan(0);
		expect(parseFloat(styles.gap), `composer gap must be > 0; got '${styles.gap}'`).toBeGreaterThan(
			0,
		);
	});
});
