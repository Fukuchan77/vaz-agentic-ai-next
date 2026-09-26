import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";
import { Chat } from "@/features/chat/Chat";

/**
 * Unit coverage for `Chat`'s HITL approval UI (X-9): `sendEmail` is the only
 * `needsApproval: true` tool (`@vaz/tools`), so a real chat turn that calls it
 * renders a `tool-sendEmail` part in `state: "approval-requested"`. Before
 * this wiring, nothing in the UI could ever answer that request — the run
 * would suspend forever. `@ai-sdk/react`'s `useChat` is mocked so this
 * exercises only `Chat`'s own part→UI derivation and its calls into
 * `addToolApprovalResponse` — no real model, no real stream, no network.
 */

const addToolApprovalResponse = vi.fn();
const sendMessage = vi.fn();
const stop = vi.fn();
const regenerate = vi.fn();
const useChatOptions = vi.fn();
const useChatState: { messages: UIMessage[]; status: string; error: Error | null } = {
	messages: [],
	status: "ready",
	error: null,
};

vi.mock("@ai-sdk/react", () => ({
	useChat: (options: unknown) => {
		useChatOptions(options);
		return {
			messages: useChatState.messages,
			sendMessage,
			stop,
			regenerate,
			status: useChatState.status,
			error: useChatState.error,
			addToolApprovalResponse,
		};
	},
}));

// Carbon's TextArea measures itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as unknown as typeof ResizeObserver;

function textMessage(id: string, role: "user" | "assistant", text: string) {
	return { id, role, parts: [{ type: "text", text }] } as UIMessage;
}

function composer() {
	return screen.getByPlaceholderText(/メッセージを入力/) as HTMLTextAreaElement;
}

function approvalRequestedMessage(
	overrides: { isAutomatic?: boolean; requestReason?: string } = {},
) {
	return {
		id: "assistant-1",
		role: "assistant",
		parts: [
			{
				type: "tool-sendEmail",
				toolCallId: "call-1",
				state: "approval-requested",
				input: { to: "user@example.com", subject: "Hi", body: "Hello" },
				approval: {
					id: "approval-1",
					isAutomatic: overrides.isAutomatic ?? false,
					requestReason: overrides.requestReason,
				},
			},
		],
	} as unknown as UIMessage;
}

beforeEach(() => {
	useChatState.messages = [];
	useChatState.status = "ready";
	useChatState.error = null;
	addToolApprovalResponse.mockReset();
	sendMessage.mockReset();
	stop.mockReset();
	regenerate.mockReset();
	useChatOptions.mockReset();
	// jsdom does not implement window scrolling; the auto-scroll calls it.
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

describe("Chat — HITL tool approval (X-9)", () => {
	test("renders approve/deny buttons for a manual approval request", () => {
		useChatState.messages = [approvalRequestedMessage()];
		render(<Chat />);

		expect(screen.queryByText(/sendEmail/)).not.toBeNull();
		expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "却下" })).toBeTruthy();
	});

	test("approve calls addToolApprovalResponse with approved: true", async () => {
		useChatState.messages = [approvalRequestedMessage()];
		const user = userEvent.setup();
		render(<Chat />);

		await user.click(screen.getByRole("button", { name: "承認" }));

		expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "approval-1", approved: true });
	});

	test("deny calls addToolApprovalResponse with approved: false", async () => {
		useChatState.messages = [approvalRequestedMessage()];
		const user = userEvent.setup();
		render(<Chat />);

		await user.click(screen.getByRole("button", { name: "却下" }));

		expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "approval-1", approved: false });
	});

	test("renders no approve/deny buttons for an automatic approval decision", () => {
		useChatState.messages = [approvalRequestedMessage({ isAutomatic: true })];
		render(<Chat />);

		expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
		expect(screen.queryByRole("button", { name: "却下" })).toBeNull();
	});

	test("shows the request reason when the policy supplies one", () => {
		useChatState.messages = [
			approvalRequestedMessage({ requestReason: "外部宛の送信は承認が必要です" }),
		];
		render(<Chat />);

		expect(screen.queryByText("外部宛の送信は承認が必要です")).not.toBeNull();
	});
});

describe("Chat — composer", () => {
	test("is a multi-line textarea that is focused on mount", () => {
		render(<Chat />);

		expect(composer().tagName).toBe("TEXTAREA");
		expect(document.activeElement).toBe(composer());
	});

	test("Enter sends the trimmed text, clears the input, and keeps focus", async () => {
		const user = userEvent.setup();
		render(<Chat />);

		await user.type(composer(), "  こんにちは  {Enter}");

		expect(sendMessage).toHaveBeenCalledWith({ text: "こんにちは" });
		expect(composer().value).toBe("");
		expect(document.activeElement).toBe(composer());
	});

	test("Shift+Enter inserts a newline instead of sending", async () => {
		const user = userEvent.setup();
		render(<Chat />);

		await user.type(composer(), "1行目{Shift>}{Enter}{/Shift}2行目");

		expect(sendMessage).not.toHaveBeenCalled();
		expect(composer().value).toBe("1行目\n2行目");
	});

	test("Enter that confirms an IME composition does not send", () => {
		render(<Chat />);
		fireEvent.change(composer(), { target: { value: "とうきょう" } });

		fireEvent.keyDown(composer(), { key: "Enter", isComposing: true });
		// Safari reports the confirming Enter as keyCode 229 with isComposing false.
		fireEvent.keyDown(composer(), { key: "Enter", keyCode: 229 });

		expect(sendMessage).not.toHaveBeenCalled();
		expect(composer().value).toBe("とうきょう");
	});

	test("clicking send returns focus to the input", async () => {
		const user = userEvent.setup();
		render(<Chat />);

		await user.type(composer(), "hello");
		await user.click(screen.getByRole("button", { name: "送信" }));

		expect(sendMessage).toHaveBeenCalledWith({ text: "hello" });
		expect(document.activeElement).toBe(composer());
	});

	test("while busy, send is disabled, the draft is kept, and stop is offered", async () => {
		useChatState.status = "streaming";
		const user = userEvent.setup();
		render(<Chat />);

		await user.type(composer(), "next question{Enter}");

		expect(sendMessage).not.toHaveBeenCalled();
		expect(composer().value).toBe("next question");
		expect(screen.getByRole("button", { name: "送信" })).toHaveProperty("disabled", true);
		await user.click(screen.getByRole("button", { name: "停止" }));
		expect(stop).toHaveBeenCalledOnce();
	});

	test("offers no stop button when idle", () => {
		render(<Chat />);

		expect(screen.queryByRole("button", { name: "停止" })).toBeNull();
	});

	test("an error offers a retry that regenerates the last response", async () => {
		useChatState.status = "error";
		useChatState.error = new Error("boom");
		const user = userEvent.setup();
		render(<Chat />);

		await user.click(screen.getByRole("button", { name: "再試行" }));

		expect(regenerate).toHaveBeenCalledOnce();
	});
});

describe("Chat — streaming", () => {
	test("throttles message updates so streaming does not starve input", () => {
		render(<Chat />);

		expect(useChatOptions).toHaveBeenCalledWith(
			expect.objectContaining({ throttle: expect.any(Number) }),
		);
	});

	test("follows new messages to the bottom while the reader is pinned there", () => {
		useChatState.messages = [textMessage("u1", "user", "hi")];
		const { rerender } = render(<Chat />);
		vi.mocked(window.scrollTo).mockClear();

		useChatState.messages = [...useChatState.messages, textMessage("a1", "assistant", "hello")];
		rerender(<Chat />);

		expect(window.scrollTo).toHaveBeenCalled();
	});

	test("does not yank the reader back down after they scroll up", () => {
		useChatState.messages = [textMessage("u1", "user", "hi")];
		const { rerender } = render(<Chat />);
		// Simulate a reader scrolled well above the bottom of a long page.
		Object.defineProperty(document.documentElement, "scrollHeight", {
			configurable: true,
			value: 5000,
		});
		window.scrollY = 0;
		fireEvent.scroll(window);
		vi.mocked(window.scrollTo).mockClear();

		useChatState.messages = [...useChatState.messages, textMessage("a1", "assistant", "hello")];
		rerender(<Chat />);

		expect(window.scrollTo).not.toHaveBeenCalled();
		Reflect.deleteProperty(document.documentElement, "scrollHeight");
	});
});
