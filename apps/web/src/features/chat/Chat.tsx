"use client";

import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { StreamingStatus } from "@/components/agent-ui/StreamingStatus";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "./ChatComposer";
import { MessageItem } from "./MessageItem";
import { useFollowBottom } from "./useFollowBottom";

/** Batch streamed-chunk re-renders (ms) so a fast stream cannot starve typing. */
const STREAM_THROTTLE_MS = 50;

export function Chat() {
	const { messages, sendMessage, stop, regenerate, status, error, addToolApprovalResponse } =
		useChat({
			throttle: STREAM_THROTTLE_MS,
			// Once a pending approval part turns into an 'approved'/'denied' response,
			// automatically re-send so the run resumes without a second manual send
			// (matches the AI SDK's own useChat + toolApproval example).
			sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
		});
	const pinToBottom = useFollowBottom(messages);

	const isBusy = status === "submitted" || status === "streaming";

	// Map useChat status to StreamingStatus display state.
	// useChat status type: "streaming" | "submitted" | "error" | "ready"
	// (no "idle" variant in AI SDK v7 — "ready" is the idle equivalent)
	const displayStatus =
		status === "submitted"
			? "submitted"
			: status === "streaming"
				? "streaming"
				: status === "error"
					? "error"
					: "idle"; // "ready" and any future unknown states → idle (no indicator)

	return (
		<div className="mx-auto max-w-3xl px-4 py-6">
			<h1 className="mb-2 text-xl font-semibold">vaz-agentic-ai-next</h1>
			<p className="mb-6 text-sm text-muted-foreground">
				Vercel AI SDK × Next.js App Router × Zod — streaming chat demo
			</p>

			<div className="flex flex-col gap-3 mb-6 min-h-48" aria-live="polite">
				{messages.map((message) => (
					<MessageItem
						key={message.id}
						message={message}
						onRespondToApproval={addToolApprovalResponse}
					/>
				))}

				<StreamingStatus
					status={displayStatus}
					errorMessage={error?.message}
					isError={status === "error"}
				/>

				{status === "error" && (
					<div className="flex flex-col items-start gap-2">
						<Button size="sm" variant="outline" onClick={() => regenerate()}>
							再試行
						</Button>
					</div>
				)}
			</div>

			<ChatComposer
				isBusy={isBusy}
				onSend={(text) => {
					pinToBottom();
					sendMessage({ text });
				}}
				onStop={() => stop()}
			/>
		</div>
	);
}
