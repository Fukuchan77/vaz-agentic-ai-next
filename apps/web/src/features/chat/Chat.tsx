"use client";

import { useChat } from "@ai-sdk/react";
import {
	Button,
	Column,
	Content,
	Grid,
	InlineLoading,
	InlineNotification,
	Theme,
} from "@carbon/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import styles from "./Chat.module.scss";
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

	return (
		<Theme theme="g10">
			<Content>
				<Grid>
					<Column lg={16} md={8} sm={4}>
						<h1 className={styles.heading}>vaz-agentic-ai-next</h1>
						<p className={styles.tagline}>
							Vercel AI SDK × Next.js App Router × Zod — streaming chat demo
						</p>
					</Column>

					{/* Messages and composer share one Column: the composer's sticky
					    positioning is bounded by its parent, so it needs the list above it. */}
					<Column lg={16} md={8} sm={4}>
						<div className={styles.messages} aria-live="polite">
							{messages.map((message) => (
								<MessageItem
									key={message.id}
									message={message}
									onRespondToApproval={addToolApprovalResponse}
								/>
							))}
							{status === "submitted" && <InlineLoading description="考え中…" />}
							{error && (
								<div className={styles.error}>
									<InlineNotification
										kind="error"
										title="エラー"
										subtitle={error.message}
										lowContrast
									/>
									<Button size="sm" kind="tertiary" onClick={() => regenerate()}>
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
					</Column>
				</Grid>
			</Content>
		</Theme>
	);
}
