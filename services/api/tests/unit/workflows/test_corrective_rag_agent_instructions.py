"""Unit tests for role separation and output-token bounds on the RAG agents.

`rag_prompts.py`'s module-level security note names role separation (system
vs. user message) as the real prompt-injection boundary - `html.escape()`
around `<query>`/`<context>` is defense-in-depth only, since LLMs decode
entities. Before this change, `CorrectiveRAGWorkflow._eval_agent`/
`_synth_agent` (`app/workflows/corrective_rag.py`) had no `instructions=` at
all, so that boundary was never actually implemented - both agents put
*everything*, task instruction included, into a single user-role prompt.
These tests exercise the real agents (via `FunctionModel`) to confirm the
system-level instructions text is now sent as `ModelRequest.instructions`,
separate from the untrusted `<query>`/`<context>` user content, and that
both agents carry the same output-token ceiling `build_chat_agent` applies
to the main chat agent.
"""

from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr
from pydantic_ai.messages import ModelMessage
from pydantic_ai.messages import ModelRequest
from pydantic_ai.messages import ModelResponse
from pydantic_ai.messages import TextPart
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.models.function import AgentInfo
from pydantic_ai.models.function import FunctionModel

from app.config import Settings
from app.models.rag import RetrievedHit
from app.workflows.corrective_rag import _EVAL_INSTRUCTIONS
from app.workflows.corrective_rag import _SYNTH_INSTRUCTIONS
from app.workflows.corrective_rag import CorrectiveRAGWorkflow


def _settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "api_key": SecretStr("test-api-key-12345678"),
        "llm_model": "openai:gpt-4o",
        "rag_cache_ttl": 0,
    }
    defaults.update(overrides)
    return Settings(**defaults)  # type: ignore[arg-type]


class TestRoleSeparation:
    """Verify agent task instructions arrive separate from the user prompt.

    They arrive as `ModelRequest.instructions`, separate from the untrusted
    user prompt.
    """

    @pytest.mark.asyncio
    async def test_eval_agent_sends_instructions_separately_from_user_prompt(self) -> None:
        """`_eval_agent`'s task instructions are sent as `ModelRequest.instructions`."""
        captured: dict[str, list[ModelMessage]] = {}

        def fn(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
            captured["messages"] = messages
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        tool_name="final_result",
                        args={"sufficient": True, "rationale": "matches"},
                    )
                ]
            )

        workflow = CorrectiveRAGWorkflow(
            vector_store=AsyncMock(),
            llm_settings=_settings(),
            llm_model=FunctionModel(fn),
        )

        result = await workflow._evaluate_relevance(["a chunk"], "a query")

        assert result.sufficient is True
        sent = captured["messages"][0]
        assert isinstance(sent, ModelRequest)
        assert sent.instructions == _EVAL_INSTRUCTIONS
        # The task instruction text lives in the system-level instructions,
        # not duplicated as the *first* thing in the user prompt.
        user_prompt_text = "".join(
            part.content
            for part in sent.parts
            if hasattr(part, "content") and isinstance(part.content, str)
        )
        assert "<query>" in user_prompt_text
        assert "<context>" in user_prompt_text

    @pytest.mark.asyncio
    async def test_synth_agent_sends_instructions_separately_from_user_prompt(self) -> None:
        """`_synth_agent`'s task instructions are sent as `ModelRequest.instructions`."""
        captured: dict[str, list[ModelMessage]] = {}

        def fn(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
            captured["messages"] = messages
            return ModelResponse(parts=[TextPart(content="the answer")])

        workflow = CorrectiveRAGWorkflow(
            vector_store=AsyncMock(),
            llm_settings=_settings(),
            llm_model=FunctionModel(fn),
        )

        answer = await workflow._synthesize_answer(
            [RetrievedHit(chunk_id="c1", text="some source text", score=0.9)],
            "a query",
        )

        assert answer == "the answer"
        sent = captured["messages"][0]
        assert isinstance(sent, ModelRequest)
        assert sent.instructions == _SYNTH_INSTRUCTIONS


class TestOutputTokenBound:
    """Both RAG agents carry the same output-token ceiling as the chat agent."""

    def test_eval_and_synth_agents_share_model_settings(self) -> None:
        """Both agents' `model_settings` reflect `llm_max_output_tokens`/`llm_temperature`."""
        settings = _settings(llm_max_output_tokens=777)
        workflow = CorrectiveRAGWorkflow(
            vector_store=AsyncMock(),
            llm_settings=settings,
            llm_model=FunctionModel(lambda messages, info: ModelResponse(parts=[TextPart("x")])),
        )

        assert workflow._eval_agent.model_settings == {
            "max_tokens": 777,
            "temperature": settings.llm_temperature,
        }
        assert workflow._synth_agent.model_settings == {
            "max_tokens": 777,
            "temperature": settings.llm_temperature,
        }
