import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { minutesToTime } from "@/data/time";

export type SlotMode = "toggle" | "available" | "unavailable";

type SlotDragOptions = {
	apply: (key: string, mode: SlotMode) => void;
	onStart?: () => void;
};

/** Klik, tahan, lalu geser untuk mengisi beberapa slot dalam satu tarikan. */
export function useSlotDrag({ apply, onStart }: SlotDragOptions) {
	const [mode, setMode] = useState<SlotMode>("toggle");
	const applyRef = useRef(apply);
	const startRef = useRef(onStart);
	applyRef.current = apply;
	startRef.current = onStart;

	const stroke = useRef<{ mode: SlotMode; visited: Set<string> } | null>(null);

	useEffect(() => {
		function move(event: globalThis.PointerEvent) {
			const current = stroke.current;
			if (!current) return;
			const target = document
				.elementFromPoint(event.clientX, event.clientY)
				?.closest<HTMLElement>("[data-slot-key]");
			const key = target?.dataset.slotKey;
			if (!key || current.visited.has(key)) return;
			current.visited.add(key);
			applyRef.current(key, current.mode);
		}
		function stop() {
			stroke.current = null;
		}
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", stop);
		window.addEventListener("pointercancel", stop);
		return () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", stop);
			window.removeEventListener("pointercancel", stop);
		};
	}, []);

	function begin(key: string) {
		if (stroke.current) return;
		startRef.current?.();
		stroke.current = { mode, visited: new Set([key]) };
		applyRef.current(key, mode);
	}

	function slotProps(key: string) {
		return {
			"data-slot-key": key,
			onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
				event.preventDefault();
				begin(key);
			},
			onClick: (event: MouseEvent<HTMLButtonElement>) => {
				if (event.detail === 0) applyRef.current(key, mode);
			},
		};
	}

	return { mode, setMode, slotProps };
}

const MODES: { value: SlotMode; label: string; hint: string }[] = [
	{ value: "toggle", label: "Balik nilai", hint: "Balik isi tiap slot yang dilewati" },
	{ value: "available", label: "Bisa", hint: "Tandai semua slot yang dilewati bisa" },
	{
		value: "unavailable",
		label: "Tidak bisa",
		hint: "Tandai semua slot yang dilewati tidak bisa",
	},
];

export function SlotModePicker({
	mode,
	onChange,
}: {
	mode: SlotMode;
	onChange: (mode: SlotMode) => void;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: kontrol tersegmentasi, bukan fieldset form
		<div className="segmented slot-mode" role="group" aria-label="Mode pengisian slot">
			{MODES.map((item) => (
				<button
					key={item.value}
					type="button"
					aria-pressed={mode === item.value}
					title={item.hint}
					onClick={() => onChange(item.value)}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}

/** Header jam penuh, tiap label berada tepat di tengah dua kolom 30 menit. */
export function HourHeaderCells() {
	return (
		<>
			{Array.from({ length: 24 }, (_, hour) => (
				<th key={minutesToTime(hour * 60)} colSpan={2} scope="col">
					{minutesToTime(hour * 60)}
				</th>
			))}
		</>
	);
}
