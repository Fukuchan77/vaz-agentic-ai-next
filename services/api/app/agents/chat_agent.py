"""Chat agent factory and tool registration."""

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic_ai import Agent
from pydantic_ai import NativeOutput
from pydantic_ai import RunContext
from pydantic_ai.models import Model
from pydantic_ai.models import infer_model
from pydantic_ai.settings import ModelSettings
from pydantic_ai_litellm import LiteLLMModel
from pydantic_ai_litellm import LiteLLMModelSettings

from app.agents.deps import AgentDeps
from app.config import Settings
from app.config import get_settings
from app.llm.factory import supports_native_output


# REQ-031 (spec 009 task 6.2): this class is the NativeOutput schema sent to
# the model; its docstring is the model-facing description and must contain only
# production prose. Implementation note: used when the active model profile
# reports `supports_json_schema_output` (Req 10.2 internal reference).
class ChatOutput(BaseModel):
    """Structured chat reply from the AI assistant."""

    model_config = ConfigDict(extra="forbid")

    reply: str


def build_model(settings: Settings) -> Model:
    """Build a LiteLLMModel instance from settings.

    Converts the internal "provider:model" format to LiteLLM's "provider/model"
    format (e.g. "openai:gpt-4o" → "openai/gpt-4o", "ollama:granite4.1:8b" →
    "ollama/granite4.1:8b") and delegates all provider routing to LiteLLM.

    API key handling:
        - Cloud providers (openai, anthropic, groq): llm_api_key is required
        - Local providers (ollama): llm_api_key is optional; LiteLLM omits it
          automatically

    Args:
        settings: Settings instance with LLM configuration.

    Returns:
        Configured LiteLLMModel instance ready for use with Pydantic AI Agent.

    Example:
        >>> from app.config import get_settings
        >>> model = build_model(get_settings())
    """
    llm_model = settings.llm_model
    if ":" in llm_model:
        provider_name, model_name = llm_model.split(":", 1)
        provider_name = provider_name.lower()  # Normalize to lowercase ()
    else:
        provider_name, model_name = "openai", llm_model

    # LiteLLM uses "provider/model" format
    litellm_model_name = f"{provider_name}/{model_name}"

    api_key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else None

    # Build optional settings dict (litellm_api_base for custom / Ollama endpoints).
    # Typed as LiteLLMModelSettings (not a bare dict) because `litellm_api_base`
    # is a LiteLLM-specific key absent from pydantic-ai's own `ModelSettings`.
    model_settings: LiteLLMModelSettings = {}
    if settings.llm_base_url:
        model_settings["litellm_api_base"] = str(settings.llm_base_url)
    elif provider_name == "ollama":
        # Ollama base URL does NOT include /v1 suffix because LiteLLM
        # automatically appends /v1 when making requests to Ollama endpoints.
        # This differs from OllamaEmbeddingVectorStore which calls the Ollama API
        # directly (not through LiteLLM) and therefore needs the full URL with /v1.
        # See: https://docs.litellm.ai/docs/providers/ollama
        model_settings["litellm_api_base"] = "http://localhost:11434"

    return LiteLLMModel(
        model_name=litellm_model_name,
        api_key=api_key,
        settings=model_settings if model_settings else None,
    )


def _has_registered_tools(settings: Settings) -> bool:
    """Report whether `build_chat_agent(settings=settings)` registers any tools.

    Mirrors the exact gate `build_chat_agent` uses to decide whether to call
    `register_mock_tools` (Req: mock tools double-guarded by `app_env` and
    `enable_mock_tools`). A production build, or one with mock tools
    disabled, registers zero tools - `_build_instructions` must not claim
    otherwise.
    """
    return settings.app_env != "production" and settings.enable_mock_tools


async def _build_instructions(ctx: RunContext[AgentDeps]) -> str:
    """Build dynamic agent instructions, accurate to whether any tool is registered.

    Registered via `agent.instructions()`, not `agent.system_prompt()`:
    `system_prompt` is invoked once per conversation and its output is
    persisted as part of `message_history` (`messages[0]`'s
    `SystemPromptPart`) - once a session has history, pydantic-ai replays
    that persisted text instead of calling the builder again, so an updated
    prompt never reaches an existing session until it expires.
    `instructions` is re-evaluated on every request regardless of history
    and is never itself written into persisted messages, so a prompt change
    (or, here, a per-build tool-availability fact) takes effect on a
    session's very next turn.

    Args:
        ctx: RunContext with AgentDeps providing access to settings.

    Returns:
        Instructions string. Only claims tool access when
        `_has_registered_tools` says a tool was actually registered on this
        build - the production build (no mock tools) gets a tool-free
        prompt instead of an inaccurate one.
    """
    if _has_registered_tools(ctx.deps.settings):
        return (
            "You are a helpful AI assistant with access to tools. "
            "Use the available tools when needed to answer user questions accurately. "
            "Be concise and informative in your responses."
        )
    return (
        "You are a helpful AI assistant. "
        "Answer user questions accurately and concisely from your own knowledge."
    )


def build_chat_agent(
    model: Model | str | None = None,
    settings: Settings | None = None,
) -> Agent[AgentDeps, str | ChatOutput]:
    """Build a Pydantic AI chat agent with tool-calling capabilities.

    This factory creates an Agent instance configured with:
    - AgentDeps for dependency injection into tools
    - str output when the model's profile doesn't support JSON-schema output,
      or NativeOutput(ChatOutput) when it does (Req 10.2/10.3)
    - Configurable output retries for validation failures
    - Dynamic instructions builder, re-evaluated every request (not baked
      into persisted session history) and accurate to whether any tool is
      actually registered on this build
    - Registered mock tools (when enabled in non-production environments)

    The agent is instrumented with Logfire for observability, automatically
    tracking all agent runs, tool calls, and token usage.

    Args:
        model: Optional model to use. If None, builds from Settings.
            Accepts Model instance or string identifier.
        settings: Optional settings to use. If None, loads from environment.

    Returns:
        Configured Agent[AgentDeps, str | ChatOutput] instance ready for use.

    Example:
        >>> # Build with default settings
        >>> agent = build_chat_agent()
        >>> # Run the agent
        >>> from app.agents.deps import AgentDeps
        >>> deps = AgentDeps(...)
        >>> result = await agent.run("Hello!", deps=deps)
        >>> print(result.output)
        "Hello! How can I help you today?"
    """
    settings = settings or get_settings()
    resolved_model = model if model is not None else build_model(settings)
    output_type: type[str] | NativeOutput[ChatOutput] = (
        NativeOutput[ChatOutput](ChatOutput)
        if supports_native_output(infer_model(resolved_model))
        else str
    )

    # Agent-level model_settings is the only attachment point transparent to
    # FallbackModel: member settings survive selection, but an agent-level value
    # overrides them per key, and this applies uniformly to every model member
    # actually tried (Req 9.1, 9.3). Do NOT move this to the guardrails install
    # idiom (`agent.override(...)`) - overriding model_settings there replaces
    # the agent layer *and* nulls the run layer, silently dropping these values.
    model_settings: ModelSettings = {
        "max_tokens": settings.llm_max_output_tokens,
        "temperature": settings.llm_temperature,
    }

    agent: Agent[AgentDeps, str | ChatOutput] = Agent(
        model=resolved_model,
        deps_type=AgentDeps,
        output_type=output_type,
        model_settings=model_settings,
        # `output_retries=` was deprecated in pydantic-ai 1.x and removed from the
        # typed overloads (it survives only via **_deprecated_kwargs), so the
        # mapping form is both the supported spelling and the type-checkable one.
        retries={"output": settings.max_output_retries},
        # pydantic-ai v2 flips this default from "early" to "graceful"; pinning it
        # explicitly defends guardrail tool-call counts, audit-trail contents, and
        # token-budget accounting across that bump. The RAG agents (rag_llm.py)
        # deliberately do NOT carry this - they register no function tools, so
        # end_strategy is inert there and the omission is not an oversight.
        end_strategy="early",
    )

    # Register dynamic instructions builder. `_has_registered_tools` below
    # uses the exact same gate as the tool registration a few lines down, so
    # the two can never drift out of sync with each other.
    agent.instructions(_build_instructions)

    # Register mock tools only in non-production environments
    # CRITICAL: Mock tools are separated into tools_mock.py and only imported
    # when app_env is NOT production. This prevents accidental mock tool usage
    # in production even if enable_mock_tools is misconfigured.
    if _has_registered_tools(settings):
        from app.agents.tools_mock import register_mock_tools

        register_mock_tools(agent)

    # TODO: Implement real web search integration
    # Example for SerpAPI:
    # if hasattr(settings, 'serpapi_key') and settings.serpapi_key:
    #     @agent.tool
    #     async def web_search(ctx: RunContext[AgentDeps], query: str) -> str:
    #         """Search the web using SerpAPI."""
    #         async with ctx.deps.http_client.get(
    #             "https://serpapi.com/search",
    #             params={"q": query, "api_key": settings.serpapi_key}
    #         ) as response:
    #             data = await response.json()
    #             # Process and return formatted results
    #             ...

    return agent
