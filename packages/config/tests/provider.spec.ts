import { resolveModel } from "@vaz/config/provider";
import type { LanguageModel } from "ai";

/**
 * `resolveModel()` maps `AI_PROVIDER` to a provider instance. Construction is
 * pure (no request is made until the model is called), so these stay hermetic.
 */
function describeModel(model: LanguageModel): { provider: string; modelId: string } {
	if (typeof model === "string") throw new Error("expected a model instance");
	return { provider: model.provider, modelId: model.modelId };
}

describe("resolveModel", () => {
	test("defaults to Anthropic", () => {
		expect(describeModel(resolveModel({}))).toMatchObject({ provider: "anthropic.messages" });
	});

	test("AI_PROVIDER=openai resolves OPENAI_MODEL through @ai-sdk/openai", () => {
		const model = describeModel(
			resolveModel({ AI_PROVIDER: "openai", OPENAI_MODEL: "test-openai-model" }),
		);

		expect(model.provider).toMatch(/^openai\./);
		expect(model.modelId).toBe("test-openai-model");
	});

	test("AI_PROVIDER=ollama resolves through the OpenAI-compatible provider", () => {
		const model = describeModel(
			resolveModel({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "test-ollama-model" }),
		);

		expect(model.provider).toMatch(/^ollama\./);
		expect(model.modelId).toBe("test-ollama-model");
	});

	test("rejects an unknown provider", () => {
		expect(() => resolveModel({ AI_PROVIDER: "unknown" })).toThrow();
	});
});
