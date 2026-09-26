"use client";

import { Button, Form, TextArea } from "@carbon/react";
import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import styles from "./Chat.module.scss";

/**
 * Chat input. Owns the draft text so a keystroke re-renders only this
 * component, not the message list.
 *
 * Enter sends and Shift+Enter inserts a newline. An Enter that confirms an
 * IME composition (Japanese input) must not send: Chromium/Firefox flag it
 * with `isComposing`, while Safari fires `compositionend` first and reports
 * the key as `keyCode` 229 instead, so both are checked.
 *
 * While a response is in flight the draft stays editable (the next question
 * can be typed ahead) but sending is blocked; a separate Stop button is shown
 * beside Send, rather than swapping Send for Stop, so a double-click on Send
 * cannot land on Stop.
 */
export function ChatComposer({
	isBusy,
	onSend,
	onStop,
}: {
	isBusy: boolean;
	onSend: (text: string) => void;
	onStop: () => void;
}) {
	const [input, setInput] = useState("");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const canSend = !isBusy && input.trim() !== "";

	function submit() {
		const text = input.trim();
		if (!text || isBusy) {
			return;
		}
		onSend(text);
		setInput("");
		// A click on Send moves focus to the button; bring it back so the next
		// message can be typed without reaching for the mouse.
		inputRef.current?.focus();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey) {
			return;
		}
		if (event.nativeEvent.isComposing || event.keyCode === 229) {
			return;
		}
		event.preventDefault();
		submit();
	}

	return (
		<Form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<div className={styles.composerInput}>
				<TextArea
					ref={inputRef}
					id="chat-input"
					labelText="メッセージ"
					hideLabel
					helperText="Enter で送信 / Shift+Enter で改行"
					placeholder="メッセージを入力…(例: 東京の現在時刻は?)"
					rows={2}
					value={input}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleKeyDown}
					autoFocus
				/>
			</div>
			<Button type="submit" disabled={!canSend}>
				送信
			</Button>
			{isBusy && (
				<Button type="button" kind="secondary" onClick={onStop}>
					停止
				</Button>
			)}
		</Form>
	);
}
