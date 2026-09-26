"use client";

import { useEffect, useRef } from "react";

/** How close (px) to the bottom still counts as "reading the latest message". */
const PINNED_THRESHOLD_PX = 80;

function isNearBottom(): boolean {
	const { scrollHeight } = document.documentElement;
	return window.innerHeight + window.scrollY >= scrollHeight - PINNED_THRESHOLD_PX;
}

/**
 * Keeps the page scrolled to the bottom as `content` changes — but only while
 * the reader is already there, so scrolling up to reread an earlier answer is
 * not undone by the next streamed chunk.
 *
 * "Pinned" is a ref, not state: it changes on every scroll event and is only
 * read inside the effect, so tracking it must not re-render. Programmatic
 * scrolls fire `scroll` too and simply re-confirm the pin.
 *
 * Returns `pin()` to force-follow again (e.g. when the user sends a message).
 */
export function useFollowBottom(content: unknown): () => void {
	const pinned = useRef(true);

	useEffect(() => {
		const onScroll = () => {
			pinned.current = isNearBottom();
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `content` is the re-run trigger, not read
	useEffect(() => {
		if (pinned.current) {
			window.scrollTo({ top: document.documentElement.scrollHeight });
		}
	}, [content]);

	return () => {
		pinned.current = true;
	};
}
