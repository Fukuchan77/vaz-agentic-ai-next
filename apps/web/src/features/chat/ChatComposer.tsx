"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
		<form
			className="sticky bottom-0 flex flex-row items-start gap-2 py-3 pb-4 bg-background"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<div className="flex-1 min-w-0">
				<label htmlFor="chat-input" className="sr-only">
					メッセージ
				</label>
				<Textarea
					ref={inputRef}
					id="chat-input"
					placeholder="メッセージを入力…(例: 東京の現在時刻は?)"
					rows={2}
					value={input}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleKeyDown}
					autoFocus
					className="field-sizing-content min-h-12 max-h-48 resize-none"
				/>
			</div>
			<Button type="submit" disabled={!canSend}>
				送信
			</Button>
			{isBusy && (
				<Button type="button" variant="secondary" onClick={onStop}>
					停止
				</Button>
			)}
		</form>
	);
}
