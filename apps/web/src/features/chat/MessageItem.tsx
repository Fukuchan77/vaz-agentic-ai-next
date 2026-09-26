"use client";

import { Button, Tag, Tile } from "@carbon/react";
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
import styles from "./Chat.module.scss";

/**
 * Renders a `needsApproval` tool call's approval-request state (HITL, R3.4)
 * with Approve/Deny buttons wired to `useChat()`'s `addToolApprovalResponse`
 * (X-9) — without this, `sendEmail` would suspend forever on every call,
 * since nothing in the UI could ever answer the pending approval.
 * `part.approval.isAutomatic` guards out the (currently unused) automatic-
 * approval/denial states per the AI SDK's own `useChat` example: only a
 * manual `'user-approval'` decision needs buttons.
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
	return (
		<span className={styles.tool}>
			<Tag type="magenta" size="sm">
				🔒 {toolName}: 承認待ち
			</Tag>
			{part.approval.requestReason && (
				<p className={styles.approvalReason}>{part.approval.requestReason}</p>
			)}
			<Button
				size="sm"
				kind="primary"
				onClick={() => onRespond({ id: part.approval.id, approved: true })}
			>
				承認
			</Button>
			<Button
				size="sm"
				kind="danger--tertiary"
				onClick={() => onRespond({ id: part.approval.id, approved: false })}
			>
				却下
			</Button>
		</span>
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
		return <span className={styles.text}>{part.text}</span>;
	}
	// Tool calls (static `tool-{name}` and MCP-style dynamic tools alike) are
	// surfaced as a tag showing execution state.
	if (isToolUIPart(part)) {
		const toolName = getToolName(part);
		if (part.state === "approval-requested") {
			return (
				<ToolApprovalRequest part={part} toolName={toolName} onRespond={onRespondToApproval} />
			);
		}
		const output = "output" in part && part.output != null ? JSON.stringify(part.output) : null;
		return (
			<span className={styles.tool}>
				<Tag type="teal" size="sm">
					🔧 {toolName}
				</Tag>
				{output && <code className={styles.toolOutput}>{output}</code>}
			</span>
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
 */
export function MessageItem({
	message,
	onRespondToApproval,
}: {
	message: UIMessage;
	onRespondToApproval: ChatAddToolApproveResponseFunction;
}) {
	return (
		<Tile className={styles.message}>
			<strong className={styles.role}>{message.role === "user" ? "You" : "AI"}</strong>
			{message.parts.map((part, index) => {
				// Parts are append-only within a message, so the index is a stable key.
				const key = `${message.id}-${index}`;
				return <MessagePart key={key} part={part} onRespondToApproval={onRespondToApproval} />;
			})}
		</Tile>
	);
}
