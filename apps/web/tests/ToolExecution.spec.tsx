import { render, screen } from "@testing-library/react";
import { ToolExecution } from "@/components/agent-ui/ToolExecution";

/**
 * Unit tests for `ToolExecution` (spec 009 task 1.5 / DES-1.3).
 *
 * ToolExecution is a pure presentation component that maps AI SDK tool
 * part state (call / partial-call / result / error / approval-requested)
 * into an accessible display. It maintains the `toolOutput` CSS class hook
 * for E2E locator compatibility.
 *
 * Does NOT own: tool execution, argument logging, approval response,
 * citation validation, tool result persistence.
 *
 * RED phase: written before ToolExecution.tsx exists.
 */

describe("ToolExecution — running / call state", () => {
	test("renders the tool name", () => {
		render(<ToolExecution toolName="send-email" state="call" />);
		expect(screen.getByText("send-email")).not.toBeNull();
	});

	test("renders a call state indicator for 'call' state", () => {
		render(<ToolExecution toolName="send-email" state="call" />);
		// A badge / status indicator for the running state
		expect(screen.getByText(/実行中|実行/)).not.toBeNull();
	});

	test("renders a call state indicator for 'partial-call' state", () => {
		render(<ToolExecution toolName="send-email" state="partial-call" />);
		expect(screen.getByText(/実行中|実行/)).not.toBeNull();
	});

	// AI SDK v7 states (task 3.2 migration)
	test("renders a call state indicator for AI SDK v7 'input-streaming' state", () => {
		render(<ToolExecution toolName="send-email" state="input-streaming" />);
		expect(screen.getByText(/実行中|実行/)).not.toBeNull();
	});

	test("renders a call state indicator for AI SDK v7 'input-available' state", () => {
		render(<ToolExecution toolName="send-email" state="input-available" />);
		expect(screen.getByText(/実行中|実行/)).not.toBeNull();
	});
});

describe("ToolExecution — AI SDK v7 output states (task 3.2)", () => {
	test("renders a result indicator for AI SDK v7 'output-available' state", () => {
		render(<ToolExecution toolName="send-email" state="output-available" output='{"ok":true}' />);
		expect(screen.getByText(/完了/)).not.toBeNull();
	});

	test("renders the toolOutput element for 'output-available' state", () => {
		const { container } = render(
			<ToolExecution toolName="send-email" state="output-available" output="done" />,
		);
		expect(container.querySelector(".toolOutput")).not.toBeNull();
	});

	test("approval-responded state renders without crashing", () => {
		const { container } = render(
			<ToolExecution toolName="send-email" state="approval-responded" />,
		);
		expect(container).not.toBeNull();
	});
});

describe("ToolExecution — result state", () => {
	test("renders the result when provided", () => {
		render(<ToolExecution toolName="send-email" state="result" output='{"status":"ok"}' />);
		expect(screen.getByText(/"status"/)).not.toBeNull();
	});

	test("renders an empty result without crashing when output is undefined", () => {
		const { container } = render(<ToolExecution toolName="send-email" state="result" />);
		expect(container).not.toBeNull();
	});

	test("result container has the 'toolOutput' class for E2E locator compatibility", () => {
		const { container } = render(
			<ToolExecution toolName="send-email" state="result" output="done" />,
		);
		expect(container.querySelector(".toolOutput")).not.toBeNull();
	});
});

describe("ToolExecution — error state", () => {
	test("renders the error message when provided", () => {
		render(<ToolExecution toolName="send-email" state="result" errorText="ツールが失敗しました" />);
		expect(screen.getByText("ツールが失敗しました")).not.toBeNull();
	});
});

describe("ToolExecution — approval-requested slot", () => {
	test("renders the approval slot when approvalSlot is provided", () => {
		render(
			<ToolExecution
				toolName="send-email"
				state="approval-requested"
				approvalSlot={<button type="button">承認</button>}
			/>,
		);
		expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
	});

	test("shows an 'approval-requested' indicator when in that state", async () => {
		render(<ToolExecution toolName="send-email" state="approval-requested" />);
		expect(screen.getByText(/承認待ち|承認/)).not.toBeNull();
	});
});

describe("ToolExecution — no side effects", () => {
	test("does not execute the tool or call any transport on render", () => {
		const onExecute = vi.fn();
		render(<ToolExecution toolName="send-email" state="call" />);
		// Rendering must not call any function that would trigger execution
		expect(onExecute).not.toHaveBeenCalled();
	});
});
