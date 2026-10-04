"use client";

import type {
	ChatAddToolApproveResponseFunction,
	DynamicToolUIPart,
	ToolUIPart,
	UIDataTypes,
	UIMessage,
	UIMessagePart,
	UITools,
} from "ai";
import { getToolName, isToolUIPart } from "ai";
import { ApprovalCard } from "@/components/agent-ui/ApprovalCard";
import { ToolExecution } from "@/components/agent-ui/ToolExecution";

/**
 * Renders a `needsApproval` tool call's approval-request state (HITL, R3.4)
 * with Approve/Deny buttons wired to `useChat()`'s `addToolApprovalResponse`
 * (X-9) — without this, `sendEmail` would suspend forever on every call,
 * since nothing in the UI could ever answer the pending approval.
 * `part.approval.isAutomatic` guards out the (currently unused) automatic-
 * approval/denial states per the AI SDK's own `useChat` example: only a
 * manual `'user-approval'` decision needs buttons.
 *
 * Uses ApprovalCard (shadcn/Tailwind) — see plan.md DES-1.2/DES-1.6.
 */
function ToolApprovalRequest({
	part,
	toolName,
	onRespond,
}: {
	part: Extract<ToolUIPart | DynamicToolUIPart, { state: "approval-requested" }>;
	toolName: string;
	onRespond: ChatAddToolApproveResponseFunction;
}) {
	if (part.approval.isAutomatic) {
		return null;
	}
	// Use ApprovalCard directly (without ToolExecution wrapper) so the tool name
	// appears exactly once — the existing tests (R3.2) rely on queryByText(/sendEmail/)
	// returning a single match.
	return (
		<ApprovalCard
			toolName={toolName}
			displayArguments={part.approval.requestReason ?? undefined}
			onApprove={() => onRespond({ id: part.approval.id, approved: true })}
			onDeny={() => onRespond({ id: part.approval.id, approved: false })}
			labels={{ approve: "承認", deny: "却下" }}
			className="my-2"
		/>
	);
}

function MessagePart({
	part,
	onRespondToApproval,
}: {
	part: UIMessagePart<UIDataTypes, UITools>;
	onRespondToApproval: ChatAddToolApproveResponseFunction;
}) {
	if (part.type === "text") {
		return <span className="block whitespace-pre-wrap overflow-wrap-anywhere">{part.text}</span>;
	}
	// Tool calls (static `tool-{name}` and MCP-style dynamic tools alike) are
	// surfaced via ToolExecution showing execution state.
	if (isToolUIPart(part)) {
		const toolName = getToolName(part);
		if (part.state === "approval-requested") {
			return (
				<ToolApprovalRequest part={part} toolName={toolName} onRespond={onRespondToApproval} />
			);
		}
		const output =
			"output" in part && part.output != null ? JSON.stringify(part.output) : undefined;
		return (
			<ToolExecution toolName={toolName} state={part.state} output={output} className="my-1" />
		);
	}
	return null;
}

/**
 * One chat message. Its own component (rather than inline in `Chat`'s
 * `messages.map`) so React Compiler memoizes per message: while streaming,
 * `useChat` replaces only the last message object, so every earlier message
 * keeps its identity and skips re-rendering (incl. the tool-output
 * `JSON.stringify`) on each streamed chunk.
 *
 * Uses shadcn/Tailwind layout — Carbon Tile removed (plan.md DES-1.6).
 */
export function MessageItem({
	message,
	onRespondToApproval,
}: {
	message: UIMessage;
	onRespondToApproval: ChatAddToolApproveResponseFunction;
}) {
	return (
		<div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm whitespace-pre-wrap overflow-wrap-anywhere">
			<strong className="block mb-1">{message.role === "user" ? "You" : "AI"}</strong>
			{message.parts.map((part, index) => {
				// Parts are append-only within a message, so the index is a stable key.
				const key = `${message.id}-${index}`;
				return <MessagePart key={key} part={part} onRespondToApproval={onRespondToApproval} />;
			})}
		</div>
	);
}
