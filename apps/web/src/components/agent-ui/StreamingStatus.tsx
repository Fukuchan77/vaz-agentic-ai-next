"use client";

import * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type StreamDisplayState =
	| "idle"
	| "submitted"
	| "streaming"
	| "completed"
	| "aborted"
	| "error";

/** Client-observable finish reasons from the AI SDK (not server RunStopReason). */
export type FinishReason = "stop" | "length" | "content-filter" | "tool-calls" | string;

export interface StreamingStatusProps {
	/** Current display state derived from useChat status + client flags. */
	status: StreamDisplayState;
	/** Client-observable finish reason (from useChat onFinish callback). */
	finishReason?: FinishReason;
	/** When true, abort label takes priority over finishReason. */
	isAbort?: boolean;
	/** When true, stream disconnect occurred (informational). */
	isDisconnect?: boolean;
	/** When true, stream error occurred. */
	isError?: boolean;
	/** Optional error message to display. */
	errorMessage?: string;
	className?: string;
}

/**
 * StreamingStatus — pure presentation component (DES-1.4).
 *
 * Renders submitted/streaming/completed/aborted/error states and client-
 * observable finish reason in an aria-live region.
 *
 * Abort state (isAbort) takes precedence over finishReason.
 * Does NOT infer server RunStopReason from any observable value.
 *
 * Owns: aria-live / role="status", human-readable label, loading indicator.
 * Does NOT own: server RunStopReason, telemetry, retry policy, cancellation.
 */
export function StreamingStatus({
	status,
	finishReason,
	isAbort = false,
	isError = false,
	errorMessage,
	className,
}: StreamingStatusProps) {
	// Abort takes priority over everything else
	const isAborted = isAbort || status === "aborted";

	const label = React.useMemo(() => {
		if (status === "idle") return null;

		if (isAborted) return "中断";

		if (status === "error" || isError) {
			return errorMessage ?? "エラー";
		}

		if (status === "submitted") return "考え中…";
		if (status === "streaming") return "生成中…";

		if (status === "completed") {
			if (finishReason === "length") return "文字数上限に達しました";
			if (finishReason === "content-filter") return "コンテンツフィルタにより停止しました";
			return "完了";
		}

		return null;
	}, [status, finishReason, isAborted, isError, errorMessage]);

	if (label === null) return null;

	const isErrorState = status === "error" || isError;

	return (
		<div role="status" aria-live="polite" className={cn("text-sm", className)}>
			{isErrorState && !isAborted ? (
				<Alert variant="destructive">
					<AlertDescription>{label}</AlertDescription>
				</Alert>
			) : (
				<span>{label}</span>
			)}
		</div>
	);
}
