"""Inspection tests: structured output schema as the model would see it.

REQ-031 (spec 009 task 6.2): tools and structured-output schemas that
Pydantic AI sends to the model must contain only model-facing descriptions.
Developer-facing commentary (requirement IDs, test names, warning/stub
text, spec-section references) belongs in code comments, never in docstrings
or field descriptions that become part of the model-facing schema.

These tests dump the schema exactly as the model would receive it and assert
that no developer commentary appears in the text.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pydantic_ai import Agent
from pydantic_ai import NativeOutput
from pydantic_ai.messages import ModelResponse
from pydantic_ai.messages import TextPart
from pydantic_ai.models.function import AgentInfo
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.profiles import ModelProfile

from app.agents.chat_agent import ChatOutput
from app.agents.deps import AgentDeps


# Developer-facing patterns that must never appear in any model-facing schema text.
# These are (pattern, description) pairs. Use word-boundary-aware strings where
# needed to avoid false positives on unrelated words (e.g. "Req" matching "required").
# Extend if new categories of commentary are introduced (see REQ-031).
_BANNED_DEVELOPER_PATTERNS: tuple[tuple[str, str], ...] = (
    ("Req ", "requirement ID reference (e.g. 'Req 10.2')"),
    ("test_", "test function name reference"),
    ("TODO", "deferred work marker"),
    ("FIXME", "bug marker"),
    ("HACK", "hack marker"),
    ("⚠️", "warning emoji"),
)


class TestChatOutputSchemaDescription:
    """REQ-031: ChatOutput schema text is clean model-facing prose.

    `ChatOutput` is the NativeOutput type; pydantic-ai builds a JSON Schema from
    it and sends its `description` (the class docstring) to the model as part of
    the output-tool definition. Field docstrings / `description=` metadata also
    reach the model. Both must contain only model-facing prose.
    """

    @pytest.mark.asyncio
    async def test_chat_output_schema_has_no_developer_commentary(self) -> None:
        """ChatOutput's model-facing schema contains no developer-facing terms.

        Uses a FunctionModel that captures the model request parameters so we can
        inspect the output-tool schema exactly as the model would see it.
        """
        captured_params: list[AgentInfo] = []

        def _capture_and_reply(
            messages: list[object],
            info: AgentInfo,
        ) -> ModelResponse:
            # Capture AgentInfo for post-run schema inspection.
            captured_params.append(info)
            # Return valid ChatOutput JSON so the agent completes successfully.
            return ModelResponse(parts=[TextPart(content='{"reply": "hi"}')])

        # FunctionModel with supports_json_schema_output=True triggers NativeOutput path.
        model = FunctionModel(
            _capture_and_reply,
            profile=ModelProfile(supports_json_schema_output=True),
        )
        agent: Agent[AgentDeps, ChatOutput] = Agent(
            model=model,
            deps_type=AgentDeps,
            output_type=NativeOutput[ChatOutput](ChatOutput),
        )

        await agent.run("say hello", deps=MagicMock(spec=AgentDeps))

        assert captured_params, "FunctionModel was never called"
        info = captured_params[-1]

        # For NativeOutput mode, pydantic-ai sends the schema via
        # model_request_parameters.output_object rather than output_tools.
        output_obj = info.model_request_parameters.output_object
        assert output_obj is not None, (
            "Expected output_object in model_request_parameters for NativeOutput agent"
        )

        # Collect all schema-related text the model would see.
        schema_texts = [
            output_obj.description or "",
            str(output_obj.json_schema),
        ]
        combined = "\n".join(schema_texts)

        for pattern, label in _BANNED_DEVELOPER_PATTERNS:
            assert pattern.lower() not in combined.lower(), (
                f"Developer-facing {label} ({pattern!r}) found in model-facing "
                f"ChatOutput schema:\n{combined}"
            )

    def test_chat_output_class_docstring_is_clean(self) -> None:
        """ChatOutput's class docstring contains no banned developer commentary.

        This is a static check on the source docstring itself, independent of
        the TestModel plumbing, so it runs faster and catches issues at import
        time rather than after a model round-trip.
        """
        doc = ChatOutput.__doc__ or ""
        for pattern, label in _BANNED_DEVELOPER_PATTERNS:
            assert pattern.lower() not in doc.lower(), (
                f"Developer-facing {label} ({pattern!r}) found in ChatOutput docstring: {doc!r}"
            )

    def test_chat_output_reply_field_description_is_clean(self) -> None:
        """ChatOutput.reply's field description contains no banned developer commentary."""
        field_info = ChatOutput.model_fields.get("reply")
        assert field_info is not None, "ChatOutput must have a 'reply' field"
        description = field_info.description or ""
        for pattern, label in _BANNED_DEVELOPER_PATTERNS:
            assert pattern.lower() not in description.lower(), (
                f"Developer-facing {label} ({pattern!r}) found in ChatOutput.reply "
                f"description: {description!r}"
            )
