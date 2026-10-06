import { render, screen } from "@testing-library/react";
import { StreamingStatus } from "@/components/agent-ui/StreamingStatus";

/**
 * Unit tests for `StreamingStatus` (spec 009 task 1.6 / DES-1.4).
 *
 * StreamingStatus renders the current streaming state and client-observable
 * finish reason in an aria-live region. Abort state takes priority over
 * finishReason. It does NOT infer server RunStopReason.
 *
 * States: submitted | streaming | completed | aborted | error
 * Client-observable finishReason: "stop" | "length" | "content-filter" | "tool-calls" | undefined
 *
 * RED phase: written before StreamingStatus.tsx exists.
 */

describe("StreamingStatus — submitted state", () => {
	test("renders a submitted indicator", () => {
		render(<StreamingStatus status="submitted" />);
		expect(screen.getByText(/考え中|送信済み/)).not.toBeNull();
	});

	test("has role='status' for live region announcements", () => {
		render(<StreamingStatus status="submitted" />);
		// aria-live="polite" or role="status"
		const el = document.querySelector("[role='status']");
		expect(el).not.toBeNull();
	});
});

describe("StreamingStatus — streaming state", () => {
	test("renders a streaming indicator", () => {
		render(<StreamingStatus status="streaming" />);
		expect(screen.getByText(/ストリーミング中|生成中/)).not.toBeNull();
	});
});

describe("StreamingStatus — completed state", () => {
	test("renders a completed indicator when status is completed and no reason", () => {
		render(<StreamingStatus status="completed" />);
		expect(screen.getByText(/完了/)).not.toBeNull();
	});

	test("renders a 'length limit' label when finishReason is 'length'", () => {
		render(<StreamingStatus status="completed" finishReason="length" />);
		expect(screen.getByText(/上限|文字数|length/i)).not.toBeNull();
	});

	test("renders a 'content filter' label when finishReason is 'content-filter'", () => {
		render(<StreamingStatus status="completed" finishReason="content-filter" />);
		expect(screen.getByText(/フィルタ|content.filter/i)).not.toBeNull();
	});

	test("renders a generic completed label when finishReason is undefined", () => {
		render(<StreamingStatus status="completed" finishReason={undefined} />);
		expect(screen.getByText(/完了/)).not.toBeNull();
	});
});

describe("StreamingStatus — aborted state (abort takes priority)", () => {
	test("renders abort label when isAbort is true, even if finishReason is set", () => {
		render(<StreamingStatus status="completed" finishReason="stop" isAbort />);
		// Abort should override the stop finish reason
		expect(screen.getByText(/中断|停止/)).not.toBeNull();
	});

	test("renders abort label for explicit aborted status", () => {
		render(<StreamingStatus status="aborted" isAbort />);
		expect(screen.getByText(/中断|停止/)).not.toBeNull();
	});
});

describe("StreamingStatus — error state", () => {
	test("renders error text when provided", () => {
		render(<StreamingStatus status="error" errorMessage="接続エラー" />);
		expect(screen.getByText("接続エラー")).not.toBeNull();
	});

	test("renders a generic error label when status is error but no message", () => {
		render(<StreamingStatus status="error" />);
		expect(screen.getByText(/エラー/)).not.toBeNull();
	});
});

describe("StreamingStatus — idle state", () => {
	test("renders nothing visible or an idle label when status is idle", () => {
		const { container } = render(<StreamingStatus status="idle" />);
		// Idle state can render empty or a placeholder — just must not throw
		expect(container).not.toBeNull();
	});
});

describe("StreamingStatus — server RunStopReason isolation", () => {
	test("does NOT infer server RunStopReason from finishReason 'stop'", () => {
		// finishReason 'stop' means the model stopped naturally — it is client-observable
		// and should render a generic "完了" label, not any server audit reason.
		render(<StreamingStatus status="completed" finishReason="stop" />);
		// Should show a completed indicator, not a server-specific label
		expect(screen.getByText(/完了/)).not.toBeNull();
	});
});
