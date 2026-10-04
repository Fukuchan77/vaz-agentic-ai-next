import { expect, test } from "@playwright/test";

/**
 * UI-1 cascade layer contract (plan.md §Cascade layer contract):
 *
 * During the Carbon/Tailwind coexistence period, Carbon's unlayered reset
 * (`div`/`span`/`p` → padding:0, `button`/`input` → border-radius:0) must be
 * placed in the weakest `carbon` layer so Tailwind utilities in `@layer utilities`
 * can override them. Without the wrap, padding/border/border-radius collapse to 0
 * on migrated shadcn components.
 *
 * Structural assertion: Carbon rules live inside a `CSSLayerBlockRule` named
 * "carbon", and in the layer order declarations, "carbon" appears before "theme"
 * and before "utilities" (making it the weakest of these layers).
 *
 * Behaviour assertion (UI-1): shadcn Button / Card class strings injected into
 * `/` have non-zero computed padding, border-width and border-radius.
 */

test.describe("CSS cascade layer contract (UI-1)", () => {
	test("Carbon rules sit inside a 'carbon' CSSLayerBlockRule, carbon precedes theme in layer order", async ({
		page,
	}) => {
		await page.goto("/");

		const layerData = await page.evaluate(() => {
			const sheets = Array.from(document.styleSheets);

			// Find whether any CSSLayerBlockRule named "carbon" exists
			let hasCarbonLayer = false;
			let hasCarbonResetInsideLayer = false;
			// Track all layer names in declaration order across all @layer statements
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
					// CSSLayerBlockRule — the @layer carbon { … } block
					if (rule.constructor.name === "CSSLayerBlockRule") {
						const block = rule as unknown as { name: string; cssRules: CSSRuleList };
						if (block.name === "carbon") {
							hasCarbonLayer = true;
							// Check that at least one Carbon reset rule lives inside this block.
							// Carbon's reset emits a rule targeting `div` or `button` with padding:0 / border-radius:0.
							for (const inner of Array.from(block.cssRules)) {
								const style = inner as CSSStyleRule;
								if (
									style.selectorText &&
									(style.selectorText.includes("button") || style.selectorText.includes("div"))
								) {
									hasCarbonResetInsideLayer = true;
									break;
								}
							}
						}
					}
				}
			}

			const carbonIdx = layerOrder.indexOf("carbon");
			const themeIdx = layerOrder.indexOf("theme");
			const utilitiesIdx = layerOrder.indexOf("utilities");

			return {
				hasCarbonLayer,
				hasCarbonResetInsideLayer,
				layerOrder,
				carbonBeforeTheme: carbonIdx !== -1 && themeIdx !== -1 && carbonIdx < themeIdx,
				carbonBeforeUtilities: carbonIdx !== -1 && utilitiesIdx !== -1 && carbonIdx < utilitiesIdx,
			};
		});

		expect(layerData.hasCarbonLayer, "A @layer carbon { … } block must exist").toBe(true);
		expect(
			layerData.hasCarbonResetInsideLayer,
			"Carbon reset rules (targeting button/div) must be inside the carbon layer",
		).toBe(true);
		expect(
			layerData.carbonBeforeTheme,
			`'carbon' must be declared before 'theme' in the layer order; got: ${layerData.layerOrder.join(", ")}`,
		).toBe(true);
		expect(
			layerData.carbonBeforeUtilities,
			`'carbon' must be declared before 'utilities' in the layer order; got: ${layerData.layerOrder.join(", ")}`,
		).toBe(true);
	});
});

test.describe("CSS cascade layer contract (UI-1) — behaviour", () => {
	/**
	 * Non-vacuous behaviour assertion (plan.md §Cascade layer contract):
	 * shadcn primitives use Tailwind utility classes (p-*, border, rounded-*).
	 * These must produce non-zero computed values even with Carbon loaded,
	 * which proves the `@layer carbon` wrap is actually working.
	 *
	 * Non-vacuousness verification (task 1.7): temporarily removing the
	 * `@layer carbon` wrap makes this test fail (verified during task 1.7).
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
		// if it were not wrapped in the weakest `@layer carbon`.
		const parseValue = (v: string) => parseFloat(v);
		expect(
			parseValue(styles.paddingLeft),
			`padding-left must be > 0; got '${styles.paddingLeft}' — Carbon reset may be overriding Tailwind utilities`,
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
