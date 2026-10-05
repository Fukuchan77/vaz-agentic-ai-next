/**
 * Model-free UI message stream fixture for chat approval E2E tests (spec 009 task 3.3).
 *
 * Provides a self-contained text/event-stream body that simulates the AI SDK's
 * UI message stream format with a `tool-sendEmail` part in `state: "approval-requested"`.
 * No real model call, no API key required.
 *
 * Format: AI SDK v7 UI message stream (ui_stream chunks), terminated by a
 * `finish_message` and `finish_stream` chunk. The approval part matches the
 * structure that `@ai-sdk/react`'s `useChat()` surfaces as `approval-requested`.
 *
 * Usage: await page.route("**\/api/chat", route => route.fulfill({ body: APPROVAL_REQUESTED_STREAM }))
 */

/** The text/event-stream body simulating a model response with a pending approval request. */
export const APPROVAL_REQUESTED_STREAM = [
	// The UI message stream wraps assistant messages as incremental parts.
	// Each line is a data: chunk consumed by the AI SDK's useChat().
	`data: ${JSON.stringify({ type: "text", value: "sending email now" })}\n\n`,
	`data: ${JSON.stringify({
		type: "tool_call",
		value: {
			toolCallId: "test-approval-call-1",
			toolName: "sendEmail",
			args: JSON.stringify({ to: "user@example.com", subject: "Test", body: "Hello" }),
		},
	})}\n\n`,
	// approval-requested part — this is what triggers the HITL UI
	`data: ${JSON.stringify({
		type: "tool_approval_request",
		value: {
			id: "test-approval-id-1",
			toolCallId: "test-approval-call-1",
			toolName: "sendEmail",
			isAutomatic: false,
			requestReason: "外部宛のメール送信には承認が必要です",
		},
	})}\n\n`,
	`data: ${JSON.stringify({ type: "finish_message", value: { finishReason: "tool-calls", usage: {} } })}\n\n`,
	`data: ${JSON.stringify({ type: "finish_stream" })}\n\n`,
].join("");

/** Content-Type for text/event-stream responses. */
export const STREAM_CONTENT_TYPE = "text/event-stream; charset=utf-8";
