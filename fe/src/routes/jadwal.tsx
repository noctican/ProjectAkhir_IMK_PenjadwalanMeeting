import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck2, RotateCcw, Save, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CalendarCard } from "@/components/calendar-card";
import { AppShell } from "@/components/shell";
import {
	HourHeaderCells,
	SlotModePicker,
	useSlotDrag,
} from "@/components/slot-input";
import { ErrorBox } from "@/components/ui";
import { DAY_NAMES, SLOTS_PER_DAY, isoFor, minutesToTime } from "@/data/time";
import { useAction, useQuery } from "@/data/use-query";
import { notify } from "@/data/ui-store";
import { useAppStore } from "@/data/store";

export const Route = createFileRoute("/jadwal")({
	component: JadwalRoute,
});

function JadwalRoute() {
	return (
		<AppShell>
			<JadwalPage />
		</AppShell>
	);
}

const TOTAL_SLOTS = 7 * SLOTS_PER_DAY;

function slotLabel(day: number, index: number): string {
	const minute = index * 30;
	const end = minute + 30;
	return `${DAY_NAMES[day]} ${minutesToTime(minute)}–${minutesToTime(end)}`;
}

function JadwalPage() {
	const storeMode = useAppStore((s) => s.mode);
	const availability = useQuery((p) => p.getAvailability());
	const calendar = useQuery((p) => p.getCalendar());
	const { run, pending, error, setError } = useAction();

	const [draft, setDraft] = useState<number[] | null>(null);
	const [undoStack, setUndoStack] = useState<number[] | null>(null);
	const [sessionOnly, setSessionOnly] = useState(false);

	const saved = availability.data?.slots ?? null;
	const slots = draft ?? saved;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset draf hanya saat jadwal tersimpan berubah
	useEffect(() => {
		// Jadwal baru dari server menggantikan draf yang belum disimpan.
		setDraft(null);
		setUndoStack(null);
		setSessionOnly(false);
	}, [saved]);

	const { mode, setMode, slotProps } = useSlotDrag({
		apply: (key, paintMode) => {
			const [day, column] = key.split(":");
			paintSlot(Number(day), Number(column), paintMode);
		},
		onStart: () => {
			const base = draft ?? saved;
			if (base) setUndoStack(base.slice());
			setSessionOnly(false);
		},
	});

	if (availability.error) {
		return (
			<div className="page">
				<header className="page-head">
					<h1>Jadwal Saya</h1>
				</header>
				<ErrorBox message={availability.error} onRetry={availability.reload} />
			</div>
		);
	}

	if (!slots) {
		return (
			<div className="page">
				<header className="page-head">
					<div>
						<h1>Jadwal Saya</h1>
						<p className="page-sub">Memuat jadwal mingguan…</p>
					</div>
				</header>
				<div className="panel">
					<span className="skeleton block h-65 w-full" />
				</div>
			</div>
		);
	}

	const dirty = draft !== null && saved !== null && !sameSlots(draft, saved);

	function paintSlot(
		day: number,
		column: number,
		paintMode: "toggle" | "available" | "unavailable",
	) {
		const index = day * SLOTS_PER_DAY + column;
		setDraft((current) => {
			const base = current ?? saved;
			if (!base) return current;
			const next = base.slice();
			next[index] =
				paintMode === "toggle" ? (next[index] === 1 ? 0 : 1) : paintMode === "available" ? 1 : 0;
			return next;
		});
	}

	function applyAll(value: 0 | 1) {
		const base = draft ?? saved;
		if (!base) return;
		setUndoStack(base.slice());
		setSessionOnly(false);
		setDraft(Array.from({ length: TOTAL_SLOTS }, () => value));
	}

	function undo() {
		if (!undoStack) return;
		setDraft(undoStack);
		setUndoStack(null);
	}

	async function saveToAccount() {
		if (!slots) return;
		const result = await run((p) => p.saveAvailability(slots));
		if (result === null) return;
		setDraft(null);
		notify(
			storeMode === "api"
				? "Jadwal mingguan disimpan ke akunmu."
				: "Jadwal disimpan di perangkat ini.",
			{ tone: "success" },
		);
		availability.reload();
	}

	function useOnce() {
		setSessionOnly(true);
		notify(
			"Jadwal dipakai untuk sesi ini saja dan tidak disimpan ke akun.",
			{ tone: "info" },
		);
	}

	async function prefillFromCalendar() {
		const blocks = await run((p) => p.getBusy(isoFor(todayString(), 0), isoFor(addDaysString(28), 0)));
		if (!blocks) return;
		const next = (draft ?? saved ?? Array(TOTAL_SLOTS).fill(1)).slice();
		for (const block of blocks) {
			const start = jakartaParts(block.startsAt);
			const end = jakartaParts(block.endsAt);
			const day = jakartaDay(block.startsAt);
			const first = start.hour * 2 + (start.minute >= 30 ? 1 : 0);
			const last =
				end.hour * 2 + (end.minute > 0 ? 1 : 0) - 1;
			for (let column = Math.max(0, first); column <= Math.min(47, last); column += 1) {
				next[day * SLOTS_PER_DAY + column] = 0;
			}
		}
		setUndoStack((draft ?? saved ?? []).slice());
		setDraft(next);
		setSessionOnly(false);
		notify("Slot yang bertabrakan dengan jadwal sibuk ditandai tidak tersedia.", {
			tone: "info",
		});
	}

	const marked = slots.reduce((total, value) => total + value, 0);

	return (
		<div className="page">
			<header className="page-head">
				<div>
					<h1>Jadwal Saya</h1>
					<p className="page-sub">
						Tandai slot 30 menit saat kamu tersedia. Klik atau geser untuk
						mengisi banyak slot sekaligus.
					</p>
				</div>
				<div className="header-actions">
					<Link to="/event/baru" search={{}} className="btn ghost small">
						Buat event
					</Link>
				</div>
			</header>

			{error ? <ErrorBox message={error} onRetry={() => setError(null)} /> : null}

			<CalendarCard />

			<section className="panel">
				<header className="panel-head">
					<div>
						<h2 className="panel-title">Ketersediaan mingguan</h2>
						<p className="panel-sub">
							{marked} dari {TOTAL_SLOTS} slot ditandai tersedia. Klik, tahan,
							lalu geser untuk mengisi beberapa slot.
						</p>
					</div>
				</header>

				<div className="matrix-toolbar">
					<SlotModePicker mode={mode} onChange={setMode} />
				</div>

				<div className="matrix-scroll">
					<table className="matrix">
						<thead>
							<tr>
								<th className="day" scope="col">
									Hari
								</th>
								<HourHeaderCells />
							</tr>
						</thead>
						<tbody>
							{DAY_NAMES.map((dayName, day) => (
								<tr key={dayName}>
									<td className="day">{dayName}</td>
									{Array.from({ length: SLOTS_PER_DAY }).map((_, column) => {
										const index = day * SLOTS_PER_DAY + column;
										const value = slots[index] ?? 1;
										return (
											<td key={minutesToTime(column * 30)}>
												<button
													type="button"
													className="slot"
													data-state={value}
													aria-pressed={value === 1}
													aria-label={`${slotLabel(day, column)} — ${
														value === 1 ? "tersedia" : "tidak tersedia"
													}`}
													{...slotProps(`${day}:${column}`)}
												/>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="scroll-hint">
					Geser tabel ke samping untuk melihat jam lainnya.
				</p>

				<div className="matrix-actions">
					<button
						type="button"
						className="btn small ghost"
						onClick={() => applyAll(1)}
					>
						Tandai semua tersedia
					</button>
					<button
						type="button"
						className="btn small ghost"
						onClick={() => applyAll(0)}
					>
						Tandai semua tidak tersedia
					</button>
					{calendar.data?.connected ? (
						<button
							type="button"
							className="btn small ghost"
							onClick={prefillFromCalendar}
							disabled={pending}
						>
							<Sparkles size={15} aria-hidden="true" />
							Isi dari kalender
						</button>
					) : null}
					{undoStack ? (
						<button type="button" className="btn small ghost" onClick={undo}>
							<Undo2 size={15} aria-hidden="true" />
							Batalkan perubahan
						</button>
					) : null}
				</div>

				<div className="legend bottom">
					<span className="legend-item">
						<span className="legend-swatch focus" aria-hidden="true" />
						Tersedia
					</span>
					<span className="legend-item">
						<span className="legend-swatch busy" aria-hidden="true" />
						Tidak tersedia
					</span>
				</div>

				<div className="sticky-actions">
					<div>
						{dirty ? (
							<span className="dirty-note">
								Ada perubahan yang belum disimpan.
							</span>
						) : sessionOnly ? (
							<span className="dirty-note">
								Dipakai untuk sesi ini saja — belum tersimpan.
							</span>
						) : (
							<span className="dirty-note muted">
								Jadwal ini dipakai sebagai isian awal saat kamu merespons event.
							</span>
						)}
					</div>
					<div className="actions-row">
						<button
							type="button"
							className="btn ghost"
							onClick={useOnce}
							disabled={!dirty}
						>
							<RotateCcw size={15} aria-hidden="true" />
							Gunakan sekali ini saja
						</button>
						<button
							type="button"
							className="btn primary"
							onClick={saveToAccount}
							disabled={!dirty || pending}
						>
							{pending ? <span className="spinner" /> : <Save size={15} aria-hidden="true" />}
							{storeMode === "api" ? "Simpan ke akun" : "Simpan di perangkat ini"}
						</button>
					</div>
				</div>
			</section>

			<p className="hint flex items-center gap-1.5">
				<CalendarCheck2 size={14} aria-hidden="true" />
				Jadwal rutin tidak berubah saat kamu merespons sebuah event. Respons event
				disimpan terpisah.
			</p>
		</div>
	);
}

function sameSlots(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function todayString(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function addDaysString(days: number): string {
	const date = new Date(`${todayString()}T00:00:00+07:00`);
	date.setDate(date.getDate() + days);
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function jakartaParts(iso: string): { hour: number; minute: number } {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Jakarta",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date(iso));
	const get = (type: string) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);
	return { hour: get("hour") % 24, minute: get("minute") };
}

function jakartaDay(iso: string): number {
	const date = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(iso));
	return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}
