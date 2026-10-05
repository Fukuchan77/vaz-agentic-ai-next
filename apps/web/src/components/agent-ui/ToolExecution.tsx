"use client";

import type * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Tool execution states supported by ToolExecution.
 *
 * Includes both legacy AI SDK v5/v6 states ("call", "partial-call", "result") and
 * AI SDK v7 states ("input-streaming", "input-available", "output-available",
 * "output-error", "output-denied", "approval-responded") for forwards compatibility
 * with the MessageItem adapter (task 3.2 / DES-1.6).
 */
export type ToolExecutionState =
	| "call"
	| "partial-call"
	| "result"
	| "approval-requested"
	| "input-streaming"
	| "input-available"
	| "approval-responded"
	| "output-available"
	| "output-error"
	| "output-denied";

export interface ToolExecutionProps {
	/** The name of the tool being executed. */
	toolName: string;
	/** Current execution state from the AI SDK tool part. */
	state: ToolExecutionState;
	/** Stringified output (result). Rendered inside a `.toolOutput` element
	 * for E2E locator compatibility (plan.md Agent UI component contract). */
	output?: string;
	/** Error message to display. */
	errorText?: string;
	/** Optional slot for the approval UI (e.g. an ApprovalCard).
	 * Rendered when state is "approval-requested". */
	approvalSlot?: React.ReactNode;
	className?: string;
}

/**
 * ToolExecution — pure presentation component (DES-1.3).
 *
 * Renders AI SDK tool call/result/error/approval states without executing tools
 * or performing any transport. Maintains the `toolOutput` CSS class hook for E2E
 * locator compatibility (plan.md §Agent UI component contract).
 *
 * Owns: tool state badge, result container, toolOutput compatibility hook,
 *       safe empty/error states.
 * Does NOT own: tool execution, argument logging, approval response,
 *               citation validation, tool result persistence.
 */
export function ToolExecution({
	toolName,
	state,
	output,
	errorText,
	approvalSlot,
	className,
}: ToolExecutionProps) {
	const isRunning =
		state === "call" ||
		state === "partial-call" ||
		state === "input-streaming" ||
		state === "input-available" ||
		state === "approval-responded";
	const isApproval = state === "approval-requested";
	const hasResult =
		state === "result" ||
		state === "output-available" ||
		state === "output-error" ||
		state === "output-denied";

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<div className="flex items-center gap-2">
				<span className="font-mono text-sm">{toolName}</span>
				{isRunning && (
					<Badge variant="secondary" className="text-xs">
						実行中
					</Badge>
				)}
				{isApproval && (
					<Badge variant="outline" className="text-xs">
						承認待ち
					</Badge>
				)}
				{hasResult && !errorText && (
					<Badge variant="default" className="text-xs">
						完了
					</Badge>
				)}
			</div>

			{errorText && (
				<Alert variant="destructive">
					<AlertDescription>{errorText}</AlertDescription>
				</Alert>
			)}

			{output !== undefined && !errorText && (
				<code className="toolOutput overflow-auto rounded bg-muted p-1 text-xs font-mono">
					{output}
				</code>
			)}

			{isApproval && approvalSlot && <div className="mt-2">{approvalSlot}</div>}
		</div>
	);
}
