"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ApprovalCardLabels {
	/** Text for the approve action button. Defaults to "承認". */
	approve: string;
	/** Text for the deny action button. Defaults to "却下". */
	deny: string;
}

export interface ApprovalCardProps {
	/** The name of the tool awaiting approval. */
	toolName: string;
	/** Read-only display of arguments (e.g. JSON string). No editable textarea. */
	displayArguments?: string;
	/** Mutable JSON text for the editable arguments textarea. */
	editableArguments?: string;
	/** Called on every keystroke in the editable arguments textarea. */
	onEditableArgumentsChange?: (value: string) => void;
	/** Optional denial reason — when set, replaces the action buttons. */
	denialText?: string;
	/** Optional error message — when set, replaces the action buttons. */
	errorText?: string;
	/** When true, disables both action buttons. */
	pending?: boolean;
	/** Custom labels for the action buttons. */
	labels?: Partial<ApprovalCardLabels>;
	/** Called when the user clicks the approve button. */
	onApprove: () => void;
	/** Called when the user clicks the deny button. */
	onDeny: () => void;
	className?: string;
}

/**
 * ApprovalCard — pure presentation component (DES-1.2).
 *
 * Renders the neutral approval UI for both chat and jobs screens.
 * Owns: accessible labels, local button-disabled state, arguments display.
 * Does NOT own: fetch, addToolApprovalResponse, approval policy, audit, logging.
 */
export function ApprovalCard({
	toolName,
	displayArguments,
	editableArguments,
	onEditableArgumentsChange,
	denialText,
	errorText,
	pending = false,
	labels,
	onApprove,
	onDeny,
	className,
}: ApprovalCardProps) {
	const approveLabel = labels?.approve ?? "承認";
	const denyLabel = labels?.deny ?? "却下";

	const isTerminal = Boolean(denialText ?? errorText);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle>{toolName}</CardTitle>
			</CardHeader>

			{displayArguments !== undefined && (
				<CardContent>
					<pre data-arguments className="overflow-auto rounded bg-muted p-2 text-xs font-mono">
						{displayArguments}
					</pre>
				</CardContent>
			)}

			{editableArguments !== undefined && (
				<CardContent>
					<Textarea
						aria-label="引数"
						value={editableArguments}
						onChange={(e) => onEditableArgumentsChange?.(e.target.value)}
						className="font-mono text-xs"
					/>
				</CardContent>
			)}

			{denialText && (
				<CardContent>
					<Alert variant="destructive">
						<AlertDescription>{denialText}</AlertDescription>
					</Alert>
				</CardContent>
			)}

			{errorText && (
				<CardContent>
					<Alert variant="destructive">
						<AlertDescription>{errorText}</AlertDescription>
					</Alert>
				</CardContent>
			)}

			{!isTerminal && (
				<CardFooter className="gap-2">
					<Button onClick={onApprove} disabled={pending}>
						{approveLabel}
					</Button>
					<Button variant="outline" onClick={onDeny} disabled={pending}>
						{denyLabel}
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}
