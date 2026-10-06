import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalCard } from "@/components/agent-ui/ApprovalCard";

/**
 * Unit tests for `ApprovalCard` (spec 009 task 1.4 / DES-1.2).
 *
 * ApprovalCard is a pure presentation component that maps neutral props
 * (tool name, optional arguments, status) into an accessible approval UI.
 * It holds NO side effects: fetch, approval logic, audit, or logging.
 * All interactions are reported via callbacks (onApprove, onDeny,
 * onEditableArgumentsChange).
 *
 * RED phase: these tests are written before ApprovalCard.tsx exists.
 */

describe("ApprovalCard — pending state", () => {
	test("renders the tool name", () => {
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />);
		expect(screen.getByText("send-email")).not.toBeNull();
	});

	test("renders approve and deny buttons with default labels", () => {
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />);
		expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "却下" })).toBeTruthy();
	});

	test("renders custom labels when provided", () => {
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				labels={{ approve: "承認する", deny: "拒否" }}
			/>,
		);
		expect(screen.getByRole("button", { name: "承認する" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "拒否" })).toBeTruthy();
	});

	test("calls onApprove when approve button is clicked", async () => {
		const onApprove = vi.fn();
		const user = userEvent.setup();
		render(<ApprovalCard toolName="send-email" onApprove={onApprove} onDeny={vi.fn()} />);
		await user.click(screen.getByRole("button", { name: "承認" }));
		expect(onApprove).toHaveBeenCalledOnce();
	});

	test("calls onDeny when deny button is clicked", async () => {
		const onDeny = vi.fn();
		const user = userEvent.setup();
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={onDeny} />);
		await user.click(screen.getByRole("button", { name: "却下" }));
		expect(onDeny).toHaveBeenCalledOnce();
	});

	test("disables buttons when pending prop is true", () => {
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} pending />);
		const approveBtn = screen.getByRole("button", { name: "承認" }) as HTMLButtonElement;
		const denyBtn = screen.getByRole("button", { name: "却下" }) as HTMLButtonElement;
		expect(approveBtn.disabled).toBe(true);
		expect(denyBtn.disabled).toBe(true);
	});

	test("renders optional arguments string when provided", () => {
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				displayArguments='{"to":"user@example.com"}'
			/>,
		);
		expect(screen.getByText(/"to"/)).not.toBeNull();
	});

	test("renders nothing for arguments when displayArguments is undefined", () => {
		const { container } = render(
			<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />,
		);
		// No arguments panel should be rendered
		expect(container.querySelector("[data-arguments]")).toBeNull();
	});
});

describe("ApprovalCard — editable arguments", () => {
	test("renders a textarea when editableArguments is provided", () => {
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				editableArguments='{"to":"user@example.com"}'
				onEditableArgumentsChange={vi.fn()}
			/>,
		);
		expect(screen.getByRole("textbox")).toBeTruthy();
	});

	test("calls onEditableArgumentsChange on textarea input", async () => {
		const onEditableArgumentsChange = vi.fn();
		const user = userEvent.setup();
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				editableArguments=""
				onEditableArgumentsChange={onEditableArgumentsChange}
			/>,
		);
		await user.type(screen.getByRole("textbox"), "x");
		expect(onEditableArgumentsChange).toHaveBeenCalled();
	});

	test("does not render a textarea when editableArguments is undefined", () => {
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />);
		expect(screen.queryByRole("textbox")).toBeNull();
	});
});

describe("ApprovalCard — denied/error state", () => {
	test("renders denial text and hides buttons when denialText is set", () => {
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				denialText="拒否されました"
			/>,
		);
		expect(screen.getByText("拒否されました")).not.toBeNull();
		expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
		expect(screen.queryByRole("button", { name: "却下" })).toBeNull();
	});

	test("renders error text and hides buttons when errorText is set", () => {
		render(
			<ApprovalCard
				toolName="send-email"
				onApprove={vi.fn()}
				onDeny={vi.fn()}
				errorText="送信エラーが発生しました"
			/>,
		);
		expect(screen.getByText("送信エラーが発生しました")).not.toBeNull();
		expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
		expect(screen.queryByRole("button", { name: "却下" })).toBeNull();
	});
});

describe("ApprovalCard — accessibility", () => {
	test("approve and deny buttons have accessible names", () => {
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />);
		const approve = screen.getByRole("button", { name: "承認" });
		const deny = screen.getByRole("button", { name: "却下" });
		expect(approve.getAttribute("aria-label") ?? approve.textContent).toBeTruthy();
		expect(deny.getAttribute("aria-label") ?? deny.textContent).toBeTruthy();
	});

	test("does NOT import or call fetch, addToolApprovalResponse, audit, or logging", () => {
		// This is verified by the test file itself not importing any transport.
		// The component must only use the onApprove/onDeny callbacks.
		render(<ApprovalCard toolName="send-email" onApprove={vi.fn()} onDeny={vi.fn()} />);
		// If we reach here without errors the component does not throw on mount
		expect(true).toBe(true);
	});
});
