"use client";

import type { JobEvent, SpecialistKind } from "@vaz/schemas/workflows";
import { useState } from "react";
import { ApprovalCard } from "@/components/agent-ui/ApprovalCard";
import { useJobStream } from "./useJobStream";

/**
 * Client-side mirror of the worker's `requiresApproval(stepId)` predicate
 * (`apps/worker/src/main.ts`), extended with the specialist `kind` carried on
 * the `step-start` event: the approval UI decides "which step is destructive"
 * from the step-start event (`kind`) plus the `requiresApproval` predicate.
 * The worker's own gate is wired but not yet activated for any kind, so the
 * default here is likewise inert (`() => false`) — a caller opts specific kinds
 * in once the server side activates them, rather than this panel guessing.
 */
export type RequiresApprovalPredicate = (step: { stepId: string; kind: SpecialistKind }) => boolean;

export interface ApprovalPanelProps {
	jobId: string;
	requiresApproval?: RequiresApprovalPredicate;
}

type StepStartEvent = JobEvent & { type: "step-start" };
type ErrorEvent = JobEvent & { type: "error" };

/** Approval-denial reasons the worker's `ApprovalDeniedError` may surface as
 * the `error` event's structured `code` (`apps/worker/src/main.ts`'s
 * `ApprovalDeniedReason`) — read the typed field rather than parsing the
 * human-readable `message` string. */
const APPROVAL_DENIAL_REASONS = new Set(["rejected", "expired", "misconfigured"]);

/**
 * The most recent `step-start` event that (a) satisfies `requiresApproval` and
 * (b) has no later `completion`/`error` for the same `stepId` yet. The
 * supervisor dispatches steps strictly one at a time (`packages/agents/src/
 * supervisor.ts`), so at most one step is ever actually unresolved — this
 * scans defensively rather than assuming that invariant.
 */
function findPendingStep(
	events: JobEvent[],
	requiresApproval: RequiresApprovalPredicate,
): StepStartEvent | null {
	const resolvedStepIds = new Set(
		events
			.filter((event) => event.type === "completion" || event.type === "error")
			.map((event) => (event as { stepId?: string }).stepId)
			.filter((id): id is string => id !== undefined),
	);

	let pending: StepStartEvent | null = null;
	for (const event of events) {
		if (event.type !== "step-start") continue;
		if (resolvedStepIds.has(event.stepId)) continue;
		if (!requiresApproval({ stepId: event.stepId, kind: event.kind })) continue;
		pending = event;
	}
	return pending;
}

function findLatestError(events: JobEvent[]): ErrorEvent | null {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type === "error") return event;
	}
	return null;
}

/** Reads an approval-denial reason off the error event's structured `code` + `stepId`. */
function parseDenial(error: ErrorEvent): { stepId: string; reason: string } | null {
	if (!error.stepId || !error.code || !APPROVAL_DENIAL_REASONS.has(error.code)) return null;
	return { stepId: error.stepId, reason: error.code };
}

/**
 * The decision form for one pending step. Keyed by `step.stepId` from the
 * parent so a *new* pending step remounts this component fresh — the
 * idiomatic React reset-on-identity-change, in place of a `useEffect` that
 * would otherwise reset local state without ever reading `step` in its body.
 */
function ApprovalDecisionForm({ jobId, step }: { jobId: string; step: StepStartEvent }) {
	const [argsText, setArgsText] = useState("");
	const [argsError, setArgsError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [decided, setDecided] = useState(false);

	async function submitDecision(decision: "approve" | "reject") {
		let args: unknown;
		if (decision === "approve" && argsText.trim() !== "") {
			try {
				args = JSON.parse(argsText);
			} catch {
				setArgsError("引数は有効な JSON で入力してください");
				return;
			}
		}
		setArgsError(null);
		setSubmitting(true);
		setSubmitError(null);
		try {
			const response = await fetch(`/api/jobs/${jobId}/approve`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					toolCallId: step.stepId,
					decision,
					...(args !== undefined ? { args } : {}),
				}),
			});
			if (!response.ok) {
				throw new Error(`Approval request failed with status ${response.status}`);
			}
			setDecided(true);
		} catch (caught) {
			setSubmitError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSubmitting(false);
		}
	}

	// Surface inline errors (args validation and submit errors) below the card
	const inlineError = argsError ?? submitError;
	const inlineErrorPrefix = argsError ? "" : submitError ? "送信エラー: " : "";

	return (
		<>
			<ApprovalCard
				toolName={`${step.kind} ステップ (${step.stepId}) が承認待ちです。`}
				editableArguments={argsText}
				onEditableArgumentsChange={(value) => {
					setArgsText(value);
					setArgsError(null);
				}}
				pending={submitting || decided}
				labels={{ approve: "承認", deny: "拒否" }}
				onApprove={() => submitDecision("approve")}
				onDeny={() => submitDecision("reject")}
			/>
			{inlineError && (
				<p>
					{inlineErrorPrefix}
					{inlineError}
				</p>
			)}
			{decided && !submitError && <p>決定を送信しました。結果を待っています…</p>}
		</>
	);
}

export function ApprovalPanel({ jobId, requiresApproval = () => false }: ApprovalPanelProps) {
	const { events, status, error: streamError } = useJobStream(jobId);

	const pendingStep = findPendingStep(events, requiresApproval);
	const latestError = findLatestError(events);
	const denial = latestError ? parseDenial(latestError) : null;

	return (
		<div>
			<h2>承認</h2>
			{pendingStep ? (
				<ApprovalDecisionForm key={pendingStep.stepId} jobId={jobId} step={pendingStep} />
			) : denial ? (
				<ApprovalCard
					toolName="承認が完了しませんでした"
					denialText={`ステップ ${denial.stepId}: ${denial.reason}`}
					onApprove={() => {}}
					onDeny={() => {}}
				/>
			) : latestError ? (
				<ApprovalCard
					toolName="エラー"
					errorText={latestError.message}
					onApprove={() => {}}
					onDeny={() => {}}
				/>
			) : status === "error" && streamError ? (
				<ApprovalCard
					toolName="接続エラー"
					errorText={streamError.message}
					onApprove={() => {}}
					onDeny={() => {}}
				/>
			) : (
				<p>承認待ちのステップはありません。</p>
			)}
		</div>
	);
}
