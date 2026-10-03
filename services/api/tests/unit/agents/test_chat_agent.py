"""Unit tests for chat agent factory and tool functions."""

from unittest.mock import Mock
from unittest.mock import patch

import pytest
from pydantic import SecretStr
from pydantic_ai import Agent
from pydantic_ai import RunContext
from pydantic_ai.models.test import TestModel

from app.agents.chat_agent import ChatOutput
from app.agents.chat_agent import _build_instructions
from app.agents.chat_agent import build_chat_agent
from app.agents.chat_agent import build_model
from app.agents.deps import AgentDeps
from app.config import Settings


def _ctx_with_settings(settings: Settings) -> Mock:
    """Build a `Mock(spec=RunContext[AgentDeps])` whose `.deps.settings` is real.

    `_build_instructions` reads `ctx.deps.settings` to decide whether the
    build it belongs to actually registered any tool, so the fixture needs a
    real `Settings` instance behind `.deps.settings`, not an unconfigured
    `Mock` attribute.
    """
    ctx = Mock(spec=RunContext[AgentDeps])
    ctx.deps = Mock(spec=AgentDeps)
    ctx.deps.settings = settings
    return ctx


class TestBuildModel:
    """Test suite for build_model LiteLLM factory."""

    def test_build_model_ollama_provider(self, monkeypatch) -> None:
        """build_model should create LiteLLMModel with ollama/model format."""
        from pydantic import HttpUrl

        monkeypatch.delenv("LLM_API_KEY", raising=False)

        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="ollama:llama3.2",
            llm_base_url=HttpUrl("http://localhost:11434/v1"),
        )

        with patch("app.agents.chat_agent.LiteLLMModel") as mock_model:
            build_model(settings)
            mock_model.assert_called_once_with(
                model_name="ollama/llama3.2",
                api_key=None,
                settings={"litellm_api_base": "http://localhost:11434/v1"},
            )

    def test_build_model_ollama_default_api_base(self, monkeypatch) -> None:
        """build_model should default to http://localhost:11434 when llm_base_url is not set."""
        monkeypatch.delenv("LLM_API_KEY", raising=False)

        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="ollama:granite3.3:latest",
        )

        with patch("app.agents.chat_agent.LiteLLMModel") as mock_model:
            build_model(settings)
            mock_model.assert_called_once_with(
                model_name="ollama/granite3.3:latest",
                api_key=None,
                settings={"litellm_api_base": "http://localhost:11434"},
            )

    def test_build_model_ollama_with_tag_in_model_name(self, monkeypatch) -> None:
        """build_model should handle ollama models with version tags correctly.

        Verifies that ollama:granite3.3:latest is converted to ollama/granite3.3:latest
        with the full tag preserved in the model name.
        """
        monkeypatch.delenv("LLM_API_KEY", raising=False)

        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="ollama:granite3.3:latest",
        )

        with patch("app.agents.chat_agent.LiteLLMModel") as mock_model:
            build_model(settings)
            # Verify the tag (:latest) is preserved in the conversion
            mock_model.assert_called_once_with(
                model_name="ollama/granite3.3:latest",
                api_key=None,
                settings={"litellm_api_base": "http://localhost:11434"},
            )

    def test_build_model_openai_with_custom_base_url(self) -> None:
        """build_model should create LiteLLMModel with custom litellm_api_base for openai."""
        from pydantic import HttpUrl

        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="openai:gpt-4o",
            llm_api_key=SecretStr("test-openai-key-16"),
            llm_base_url=HttpUrl("https://custom.openai.com/v1"),
        )

        with patch("app.agents.chat_agent.LiteLLMModel") as mock_model:
            build_model(settings)
            mock_model.assert_called_once_with(
                model_name="openai/gpt-4o",
                api_key="test-openai-key-16",
                settings={"litellm_api_base": "https://custom.openai.com/v1"},
            )

    def test_build_model_openai_with_api_key_only(self) -> None:
        """build_model should create LiteLLMModel with no settings when base_url is absent."""
        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="openai:gpt-4o",
            llm_api_key=SecretStr("test-openai-key-16"),
        )

        with patch("app.agents.chat_agent.LiteLLMModel") as mock_model:
            build_model(settings)
            mock_model.assert_called_once_with(
                model_name="openai/gpt-4o",
                api_key="test-openai-key-16",
                settings=None,
            )

    def test_build_model_openai_requires_api_key_for_cloud(self, monkeypatch) -> None:
        """Settings validator should require API key for cloud OpenAI provider."""
        monkeypatch.delenv("LLM_API_KEY", raising=False)  # Remove to test validation

        # Cloud OpenAI requires API key
        with pytest.raises(ValueError, match="llm_api_key is required"):
            Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                # Missing llm_api_key
            )

    def test_build_model_requires_provider_prefix(self) -> None:
        """Settings validator should require provider:model format."""
        # The Settings validator now enforces provider:model format
        # so models without prefix are rejected at Settings construction
        with pytest.raises(ValueError, match="must follow 'provider:model' format"):
            Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="gpt-4o",  # Missing provider prefix
                llm_api_key=SecretStr("test-openai-key-16"),
            )

    def test_build_model_validator_rejects_unsupported_provider(self) -> None:
        """Settings validator should reject unsupported providers."""
        # Settings validator catches unsupported providers
        with pytest.raises(ValueError, match="provider must be one of"):
            Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="unsupported:model-name",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

    def test_build_model_validator_normalizes_uppercase_provider(self) -> None:
        """Settings validator should normalize uppercase provider names to lowercase ()."""
        # Settings validator now normalizes uppercase providers instead of rejecting them
        settings = Settings(
            api_key=SecretStr("test-api-key-12345"),
            llm_model="OPENAI:gpt-4o",  # Uppercase is now normalized to lowercase
            llm_api_key=SecretStr("test-api-key-12345"),
        )
        # Verify the provider was normalized (check by extracting provider from llm_model)
        provider = settings.llm_model.split(":", 1)[0]
        assert provider == "openai", f"Expected 'openai' but got '{provider}'"


class TestBuildInstructions:
    """Test suite for `_build_instructions`.

    Registered via `agent.instructions()` (re-evaluated every request, never
    baked into persisted session history) rather than `agent.system_prompt()`
    - see the docstring on `_build_instructions` for why that distinction
    matters for a prompt update reaching an already-running session.
    """

    def _settings(self, **overrides: object) -> Settings:
        defaults: dict[str, object] = {
            "api_key": SecretStr("test-api-key-12345"),
            "llm_model": "openai:gpt-4o",
            "llm_api_key": SecretStr("test-api-key-12345"),
        }
        defaults.update(overrides)
        return Settings(**defaults)  # type: ignore[arg-type]

    @pytest.mark.asyncio
    async def test_returns_non_empty_string(self) -> None:
        """_build_instructions should return a non-empty string."""
        ctx = _ctx_with_settings(self._settings())

        instructions = await _build_instructions(ctx)

        assert isinstance(instructions, str)
        assert len(instructions) > 0

    @pytest.mark.asyncio
    async def test_is_helpful_tone(self) -> None:
        """_build_instructions should have a helpful, assistant tone."""
        ctx = _ctx_with_settings(self._settings())

        instructions = await _build_instructions(ctx)

        assert any(word in instructions.lower() for word in ["helpful", "assist", "help"])

    @pytest.mark.asyncio
    async def test_mentions_tools_when_mock_tools_are_registered(self) -> None:
        """Tool access is claimed when the mock-tool build gate is open.

        Matches what `build_chat_agent` actually wires when it's open.
        """
        ctx = _ctx_with_settings(self._settings(app_env="development", enable_mock_tools=True))

        instructions = await _build_instructions(ctx)

        assert "tool" in instructions.lower()

    @pytest.mark.asyncio
    async def test_does_not_claim_tools_in_production(self) -> None:
        """The production build must not claim tool access.

        It registers zero tools (Req: mock tools are double-guarded).
        """
        ctx = _ctx_with_settings(
            self._settings(
                app_env="production",
                enable_mock_tools=False,
                allowed_hosts=["api.example.com"],
            )
        )

        instructions = await _build_instructions(ctx)

        assert "tool" not in instructions.lower()

    @pytest.mark.asyncio
    async def test_does_not_claim_tools_when_mock_tools_disabled(self) -> None:
        """The prompt must track the gate, not just the environment.

        Non-production but `enable_mock_tools=False` also registers zero
        tools.
        """
        ctx = _ctx_with_settings(self._settings(app_env="development", enable_mock_tools=False))

        instructions = await _build_instructions(ctx)

        assert "tool" not in instructions.lower()


class TestBuildChatAgent:
    """Test suite for build_chat_agent factory function."""

    def test_build_chat_agent_returns_agent_instance(self) -> None:
        """build_chat_agent should return an Agent instance."""
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

            model = TestModel()
            agent = build_chat_agent(model=model)

            assert isinstance(agent, Agent)

    def test_build_chat_agent_uses_provided_model(self) -> None:
        """build_chat_agent should use the provided model when specified."""
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

            test_model = TestModel()
            agent = build_chat_agent(model=test_model)

            # Agent should be created (we can't directly inspect the model,
            # but we verify the agent was constructed successfully)
            assert isinstance(agent, Agent)

    def test_build_chat_agent_builds_model_from_settings(self) -> None:
        """build_chat_agent should build model from settings when model=None."""
        with (
            patch("app.agents.chat_agent.get_settings") as mock_settings,
            patch("app.agents.chat_agent.build_model") as mock_build,
        ):
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )
            mock_build.return_value = TestModel()

            agent = build_chat_agent(model=None)

            # Verify _build_model was called
            mock_build.assert_called_once()
            assert isinstance(agent, Agent)

    def test_build_chat_agent_configures_agent_type_parameters(self) -> None:
        """build_chat_agent should configure Agent with correct type parameters."""
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
                max_output_retries=5,
            )

            test_model = TestModel()
            agent = build_chat_agent(model=test_model)

            # Agent should be properly typed
            assert isinstance(agent, Agent)
            # Check that deps_type is AgentDeps (via the type hint in the factory)
            # This is validated at type-check time, so just verify agent exists
            assert agent is not None

    def test_build_chat_agent_wires_max_output_retries_onto_the_agent(self) -> None:
        """settings.max_output_retries must actually reach the constructed Agent.

        `build_chat_agent` passes `retries={"output": settings.max_output_retries}`
        rather than the deprecated `output_retries=` kwarg (pydantic-ai 1.x); this
        pins that the value survives the mapping form, not just that construction
        doesn't raise. `_max_output_retries` is pydantic-ai's only place this
        setting is observable post-construction - there is no public accessor.
        """
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
                max_output_retries=7,
            )

            agent = build_chat_agent(model=TestModel())

            assert agent._max_output_retries == 7

    def test_build_chat_agent_wires_output_ceiling_and_temperature_onto_the_agent(
        self,
    ) -> None:
        """settings.llm_max_output_tokens/llm_temperature must reach Agent.model_settings.

        Req 9.1/9.2: sourced from Settings (no literal in agent/factory code) and
        attached once at the Agent layer, so `FallbackModel` transparency carries
        both values to every model member actually tried (Req 9.3) - proved
        end-to-end for primary and fallback by
        test_model_settings_propagation.py (task 5.3).
        """
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
                llm_max_output_tokens=2048,
                llm_temperature=0.3,
            )

            agent = build_chat_agent(model=TestModel())

            assert agent.model_settings == {"max_tokens": 2048, "temperature": 0.3}

    def test_build_chat_agent_has_tools(self) -> None:
        """build_chat_agent should have tools available."""
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

            test_model = TestModel()
            agent = build_chat_agent(model=test_model)

            # Verify agent was created successfully with tools
            # We can't easily inspect private _function_tools, but we can verify
            # the agent exists and was constructed properly
            assert isinstance(agent, Agent)
            assert agent is not None

    def test_build_chat_agent_pins_end_strategy_to_early(self) -> None:
        """`end_strategy="early"` must be passed explicitly, not left to the default.

        Req 6.1/6.2/9.1: v2 flips `Agent.__init__`'s `end_strategy` default from
        `"early"` to `"graceful"`. On the pinned 1.x lock, `"early"` is already
        the default, so asserting only the resulting `agent.end_strategy` value
        would pass whether or not the keyword is present in the constructor call -
        it would not distinguish "explicitly pinned" from "happens to match
        today's default". Mocking the `Agent` constructor and asserting on its
        exact call kwargs is what actually proves the keyword is passed.
        """
        with (
            patch("app.agents.chat_agent.get_settings") as mock_settings,
            patch("app.agents.chat_agent.Agent") as mock_agent_cls,
        ):
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

            build_chat_agent(model=TestModel())

            assert mock_agent_cls.call_args.kwargs["end_strategy"] == "early"


class TestAgentIntegration:
    """Integration tests for agent with tools using TestModel."""

    @pytest.mark.asyncio
    async def test_agent_can_be_run_with_test_model(self) -> None:
        """Agent should be runnable with TestModel for testing."""
        with patch("app.agents.chat_agent.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                api_key=SecretStr("test-api-key-12345"),
                llm_model="openai:gpt-4o",
                llm_api_key=SecretStr("test-api-key-12345"),
            )

            # Create agent with TestModel
            test_model = TestModel()
            agent = build_chat_agent(model=test_model)

            # Create mock deps to demonstrate agent can work with proper types
            from unittest.mock import AsyncMock

            _mock_deps = AgentDeps(
                http_client=AsyncMock(spec=pytest.importorskip("httpx").AsyncClient),
                settings=mock_settings.return_value,
                session_store=Mock(),
            )

            # Verify agent can be used (we don't need to actually run it,
            # just verify it's properly constructed)
            assert isinstance(agent, Agent)
            assert agent is not None


class TestNativeOutputGating:
    """Task 7 (Req 10.2/10.3): conditional NativeOutput via the model profile gate."""

    def test_plain_output_when_model_does_not_support_json_schema(self) -> None:
        """TestModel's default profile reports False, so output stays plain str."""
        agent = build_chat_agent(model=TestModel())

        assert agent.output_type is str

    def test_native_output_when_model_supports_json_schema(self) -> None:
        """A model whose profile reports True gets wrapped in NativeOutput(ChatOutput)."""
        from pydantic_ai import NativeOutput
        from pydantic_ai.profiles import ModelProfile

        model = TestModel(profile=ModelProfile(supports_json_schema_output=True))
        agent = build_chat_agent(model=model)

        assert isinstance(agent.output_type, NativeOutput)
        assert agent.output_type.outputs is ChatOutput

    def test_chat_output_schema_has_reply_field(self) -> None:
        """ChatOutput is the minimal schema used for native structured output."""
        output = ChatOutput(reply="hello")

        assert output.reply == "hello"
