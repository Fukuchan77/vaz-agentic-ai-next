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
 *
 * §3 additions (task 3.1): shadcn/Tailwind migration tests for Chat/ChatComposer.
 * These verify StreamingStatus integration and Carbon-free composer.
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

// ResizeObserver is used by some UI primitives in jsdom; provide a no-op stub.
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

// ─── §3 Task 3.1: StreamingStatus integration tests (RED before migration) ───

describe("Chat — StreamingStatus integration (shadcn migration)", () => {
	test("renders a live-region status element while submitted", () => {
		useChatState.status = "submitted";
		render(<Chat />);

		// StreamingStatus renders role="status" aria-live="polite"
		const statusRegion = document.querySelector("[role='status']");
		expect(
			statusRegion,
			"role='status' live region must exist during submitted state",
		).not.toBeNull();
		expect(statusRegion?.textContent).toMatch(/考え中/);
	});

	test("renders a live-region status element while streaming", () => {
		useChatState.status = "streaming";
		render(<Chat />);

		const statusRegion = document.querySelector("[role='status']");
		expect(
			statusRegion,
			"role='status' live region must exist during streaming state",
		).not.toBeNull();
		expect(statusRegion?.textContent).toMatch(/生成中/);
	});

	test("renders error state via live region when useChat returns an error", () => {
		useChatState.status = "error";
		useChatState.error = new Error("network failure");
		render(<Chat />);

		// The error message must appear (via StreamingStatus errorMessage prop)
		expect(screen.queryByText(/network failure/)).not.toBeNull();
		// A retry button must still be available
		expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
	});

	test("renders no status region when idle (status=ready)", () => {
		useChatState.status = "ready";
		render(<Chat />);

		// StreamingStatus renders nothing for idle/ready status
		const statusRegion = document.querySelector("[role='status']");
		expect(statusRegion, "no live region should be visible when idle").toBeNull();
	});

	test("does not render a Carbon InlineLoading component while submitted", () => {
		useChatState.status = "submitted";
		render(<Chat />);

		// Carbon InlineLoading renders an element with data-inline-loading or cds--inline-loading class
		// After migration it must be gone
		const carbonLoading = document.querySelector(
			"[data-inline-loading], .cds--inline-loading, [class*='cds--inline-loading']",
		);
		expect(carbonLoading, "Carbon InlineLoading must not be present after migration").toBeNull();
	});

	test("does not render a Carbon InlineNotification for error state", () => {
		useChatState.status = "error";
		useChatState.error = new Error("test error");
		render(<Chat />);

		// Carbon InlineNotification renders with cds--inline-notification class
		const carbonNotification = document.querySelector(
			"[class*='cds--inline-notification'], [data-notification]",
		);
		expect(
			carbonNotification,
			"Carbon InlineNotification must not be present after migration",
		).toBeNull();
	});
});

describe("Chat — composer shadcn migration", () => {
	test("composer textarea has an accessible label without Carbon LabelText wrapper", () => {
		render(<Chat />);

		// After migration: a native textarea is associated with its label
		// via aria-label or a <label> element (shadcn Textarea pattern)
		const textarea = screen.getByPlaceholderText(/メッセージを入力/) as HTMLTextAreaElement;
		expect(textarea.tagName).toBe("TEXTAREA");
		// Must have an accessible name (via aria-label or label element)
		const ariaLabel = textarea.getAttribute("aria-label");
		const labelId = textarea.getAttribute("aria-labelledby");
		const id = textarea.getAttribute("id");
		const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
		expect(
			ariaLabel ?? labelId ?? labelEl?.textContent,
			"textarea must have an accessible name",
		).not.toBeNull();
	});

	test("composer does not use Carbon Form or Carbon TextArea components", () => {
		render(<Chat />);

		// Carbon Form renders with cds--form class, Carbon TextArea with cds--text-area
		const carbonForm = document.querySelector("[class*='cds--form']");
		const carbonTextArea = document.querySelector("[class*='cds--text-area']");
		expect(carbonForm, "Carbon Form class must not be present after migration").toBeNull();
		expect(carbonTextArea, "Carbon TextArea class must not be present after migration").toBeNull();
	});

	test("send button is a native button without Carbon Button classes", () => {
		render(<Chat />);

		const sendBtn = screen.getByRole("button", { name: "送信" });
		expect(sendBtn.tagName).toBe("BUTTON");
		// Carbon Button adds cds--btn class
		const hasCarbonClass = sendBtn.className.includes("cds--btn");
		expect(hasCarbonClass, "send button must not have Carbon cds--btn class").toBe(false);
	});
});

// ─── §3 Task 3.2: MessageItem → ApprovalCard + ToolExecution mapping ───

function toolCallMessage(toolType: string, state: string, extra: Record<string, unknown> = {}) {
	return {
		id: "assistant-tool-1",
		role: "assistant",
		parts: [
			{
				type: toolType,
				toolCallId: "tool-call-1",
				state,
				input: { to: "user@example.com", subject: "Hi" },
				...extra,
			},
		],
	} as unknown as UIMessage;
}

describe("Chat — MessageItem tool rendering (shadcn migration)", () => {
	test("tool result output preserves the toolOutput class for E2E locator compatibility", () => {
		useChatState.messages = [
			toolCallMessage("tool-sendEmail", "result", { output: { status: "sent" } }),
		];
		render(<Chat />);

		// The E2E specs (locator-citation.spec.ts) rely on [class*="toolOutput"]
		const toolOutputEl = document.querySelector('[class*="toolOutput"]');
		expect(
			toolOutputEl,
			".toolOutput element must exist for E2E locator compatibility",
		).not.toBeNull();
	});

	test("tool call state shows the tool name", () => {
		useChatState.messages = [toolCallMessage("tool-sendEmail", "call")];
		render(<Chat />);

		expect(screen.queryByText(/sendEmail/)).not.toBeNull();
	});

	test("approval-requested does not render Carbon Tag component", () => {
		useChatState.messages = [approvalRequestedMessage()];
		render(<Chat />);

		// Carbon Tag renders with cds--tag class
		const carbonTag = document.querySelector("[class*='cds--tag']");
		expect(carbonTag, "Carbon Tag must not be present after MessageItem migration").toBeNull();
	});

	test("message container does not use Carbon Tile", () => {
		useChatState.messages = [textMessage("u1", "user", "hello")];
		render(<Chat />);

		// Carbon Tile renders with cds--tile class
		const carbonTile = document.querySelector("[class*='cds--tile']");
		expect(carbonTile, "Carbon Tile must not be present after MessageItem migration").toBeNull();
	});

	test("message role label shows 'You' for user and 'AI' for assistant", () => {
		useChatState.messages = [
			textMessage("u1", "user", "hello"),
			textMessage("a1", "assistant", "world"),
		];
		render(<Chat />);

		expect(screen.queryByText("You", { exact: true })).not.toBeNull();
		expect(screen.queryByText("AI", { exact: true })).not.toBeNull();
	});

	test("approval-requested shows request reason from the tool part", () => {
		useChatState.messages = [
			approvalRequestedMessage({ requestReason: "このツールは外部メールを送信します" }),
		];
		render(<Chat />);

		expect(screen.queryByText("このツールは外部メールを送信します")).not.toBeNull();
	});
});
