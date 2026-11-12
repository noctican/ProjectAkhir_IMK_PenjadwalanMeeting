import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	RotateCcw,
	Sparkles,
	Trash2,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, ErrorBox } from "@/components/ui";
import { MonthCalendar, type DateMode } from "@/components/month-calendar";
import { AppShell, useCurrentUser } from "@/components/shell";
import {
	HourHeaderCells,
	SlotModePicker,
	useSlotDrag,
	type SlotMode,
} from "@/components/slot-input";
import { useAction, useQuery } from "@/data/use-query";
import { notify } from "@/data/ui-store";
import type { CandidateDate, EventInput } from "@/data/types";
import {
	addDays,
	fmtDateLong,
	fmtDateShort,
	fmtTimeRange,
	generateSlots,
	minutesToTime,
	SLOTS_PER_DAY,
	todayLocal,
} from "@/data/time";

export const Route = createFileRoute("/event/baru")({
	validateSearch: (search: Record<string, unknown>) =>
		typeof search.edit === "string" ? { edit: search.edit } : {},
	component: BuatEventRoute,
});

function BuatEventRoute() {
	return (
		<AppShell>
			<BuatEventPage />
		</AppShell>
	);
}

const STEPS = [
	{ title: "Informasi event", short: "Info" },
	{ title: "Tanggal kandidat", short: "Tanggal" },
	{ title: "Rentang jam", short: "Jam" },
	{ title: "Visibilitas rekap", short: "Rekap" },
	{ title: "Tinjau dan publikasi", short: "Tinjau" },
];

const DURATIONS = [30, 60, 90, 120, 150, 180, 240];
type WindowMode = "global" | "custom";

function emptyPicks(): number[] {
	return Array.from({ length: SLOTS_PER_DAY }, () => 0);
}

function picksFromWindow(startMinute: number, endMinute: number): number[] {
	const picks = emptyPicks();
	for (let index = startMinute / 30; index < endMinute / 30; index += 1) picks[index] = 1;
	return picks;
}

function picksToWindow(picks: number[]) {
	const on = picks.reduce<number[]>((acc, value, index) => {
		if (value === 1) acc.push(index);
		return acc;
	}, []);
	if (on.length === 0) return null;
	const first = on[0];
	const last = on[on.length - 1];
	for (let index = first; index <= last; index += 1) {
		if (picks[index] !== 1) return { ok: false as const };
	}
	return { ok: true as const, startMinute: first * 30, endMinute: (last + 1) * 30 };
}

function BuatEventPage() {
	const user = useCurrentUser();
	const { edit } = Route.useSearch();
	const navigate = useNavigate();
	const directory = useQuery((p) => p.listUsers());
	const existing = useQuery((p) => (edit ? p.getEvent(edit) : Promise.resolve(null)), [edit]);
	const { run, pending, error, setError } = useAction();
	const today = todayLocal();

	const [step, setStep] = useState(0);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [duration, setDuration] = useState(60);
	const [participantIds, setParticipantIds] = useState<string[]>([]);
	const [dateMode, setDateMode] = useState<DateMode>("range");
	const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
	const [rangeStart, setRangeStart] = useState("");
	const [rangeEnd, setRangeEnd] = useState("");
	const [dates, setDates] = useState<string[]>([]);
	const [windowMode, setWindowMode] = useState<WindowMode>("global");
	const [slotPicks, setSlotPicks] = useState<Record<string, number[]>>({});
	const [picksUndo, setPicksUndo] = useState<Record<string, number[]> | null>(null);
	const [showRecap, setShowRecap] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [loadedEdit, setLoadedEdit] = useState(false);

	useEffect(() => {
		const detail = existing.data;
		if (!detail || loadedEdit) return;
		setTitle(detail.title);
		setDescription(detail.description ?? "");
		setDuration(detail.durationMinutes);
		setParticipantIds(
			detail.participants
				.filter((person) => person.id !== user.id)
				.map((person) => person.id),
		);
		setShowRecap(detail.showRecap);
		setDateMode("custom");
		const picked = detail.dates.map((item) => ({
			date: item.date,
			picks: picksFromWindow(item.startMinute, item.endMinute),
		}));
		setDates(picked.map((item) => item.date));
		setSlotPicks(
			picked.reduce<Record<string, number[]>>((acc, item) => {
				acc[item.date] = item.picks;
				return acc;
			}, {}),
		);
		const same = new Set(picked.map((item) => item.picks.join(""))).size;
		setWindowMode(picked.length > 0 && same === 1 ? "global" : "custom");
		setLoadedEdit(true);
		setStep(0);
	}, [existing.data, loadedEdit, user.id]);

	function datesInRange(from: string, to: string): string[] {
		if (!from || !to || to < from) return [];
		const list: string[] = [];
		let cursor = from;
		while (cursor <= to && list.length < 31) {
			list.push(cursor);
			cursor = addDays(cursor, 1);
		}
		return list;
	}

	function dateGroups(values: string[]): string[][] {
		const sorted = [...values].sort();
		const groups: string[][] = [];
		for (const date of sorted) {
			const last = groups[groups.length - 1];
			if (last && addDays(last[last.length - 1], 1) === date) {
				last.push(date);
			} else {
				groups.push([date]);
			}
		}
		return groups;
	}

	function rangeClick(date: string) {
		setFormError(null);
		if (date < today) {
			setFormError("Tanggal yang sudah lewat tidak bisa dipilih.");
			return;
		}
		if (!rangeStart || rangeEnd || date < rangeStart) {
			setRangeStart(date);
			setRangeEnd("");
			setDates([date]);
			return;
		}
		const list = datesInRange(rangeStart, date);
		if (list.length > 31) {
			setFormError("Pilih paling banyak 31 tanggal kandidat.");
			return;
		}
		setRangeEnd(date);
		setDates(list);
	}

	function toggleCustomDate(date: string) {
		setFormError(null);
		if (date < today) {
			setFormError("Tanggal yang sudah lewat tidak bisa dipilih.");
			return;
		}
		if (dates.includes(date)) {
			setDates(dates.filter((item) => item !== date));
			return;
		}
		if (dates.length >= 31) {
			setFormError("Pilih paling banyak 31 tanggal kandidat.");
			return;
		}
		setDates([...dates, date].sort());
	}

	function removeDates(values: string[]) {
		const removed = new Set(values);
		setDates(dates.filter((item) => !removed.has(item)));
		setSlotPicks((current) => {
			const next = { ...current };
			for (const date of values) delete next[date];
			return next;
		});
		if (dates.every((date) => removed.has(date))) {
			setRangeStart("");
			setRangeEnd("");
		}
	}

	function picksFor(date: string): number[] {
		return slotPicks[date] ?? emptyPicks();
	}

	function setPicks(next: (current: Record<string, number[]>) => Record<string, number[]>) {
		setPicksUndo(slotPicks);
		setSlotPicks(next);
	}

	function paintPick(
		target: string,
		column: number,
		paintMode: SlotMode,
	) {
		setSlotPicks((current) => {
			if (dates.length === 0) return current;
			const paint = (value: number) =>
				paintMode === "toggle" ? (value === 1 ? 0 : 1) : paintMode === "available" ? 1 : 0;
			if (windowMode === "global") {
				const source = current[dates[0]] ?? emptyPicks();
				const copy = source.slice();
				copy[column] = paint(copy[column]);
				const updated = { ...current };
				for (const date of dates) updated[date] = copy.slice();
				return updated;
			}
			const base = current[target] ?? emptyPicks();
			const copy = base.slice();
			copy[column] = paint(copy[column]);
			return { ...current, [target]: copy };
		});
	}

	function bulkPick(value: 0 | 1) {
		const filled = Array.from({ length: SLOTS_PER_DAY }, () => value);
		setPicks((current) => {
			const updated = { ...current };
			for (const date of dates) updated[date] = filled.slice();
			return updated;
		});
	}

	function undoPicks() {
		setSlotPicks(picksUndo ?? slotPicks);
		setPicksUndo(null);
	}

	function validateStep(index: number): string | null {
		if (index === 0) {
			if (title.trim().length < 3) return "Judul event minimal 3 karakter.";
			if (participantIds.length === 0) return "Pilih minimal satu peserta.";
			return null;
		}
		if (index === 1) {
			if (dates.length === 0) return "Pilih minimal satu tanggal kandidat.";
			return null;
		}
		if (index === 2) {
			for (const date of dates) {
				const window = picksToWindow(picksFor(date));
				if (!window) {
					return `Tandai minimal satu jam untuk ${fmtDateLong(date)}.`;
				}
				if (!window.ok) {
					return `Tandai slot berurutan tanpa jeda untuk ${fmtDateLong(date)}.`;
				}
				if (window.endMinute - window.startMinute < duration) {
					return `Rentang jam ${fmtDateLong(date)} lebih pendek dari durasi event.`;
				}
			}
			return null;
		}
		return null;
	}

	function next() {
		const problem = validateStep(step);
		if (problem) {
			setFormError(problem);
			return;
		}
		setFormError(null);
		setStep((current) => Math.min(current + 1, STEPS.length - 1));
	}

	function candidateDates(): CandidateDate[] {
		const result: CandidateDate[] = [];
		for (const date of dates) {
			const window = picksToWindow(picksFor(date));
			if (window?.ok) {
				result.push({ date, startMinute: window.startMinute, endMinute: window.endMinute });
			}
		}
		return result;
	}

	function buildInput(publish: boolean): EventInput {
		return {
			title: title.trim(),
			description: description.trim() || undefined,
			durationMinutes: duration,
			timezone: "Asia/Jakarta",
			participantIds,
			dates: candidateDates(),
			showRecap,
			publish,
		};
	}

	async function submit(publish: boolean) {
		const problem = validateStep(0) ?? validateStep(1) ?? validateStep(2);
		if (problem) {
			setFormError(problem);
			return;
		}
		const input = buildInput(publish);
		const result = await run((provider) =>
			edit ? provider.updateEvent(edit, input) : provider.createEvent(input),
		);
		if (!result) return;
		notify(
			edit
				? "Perubahan event disimpan."
				: publish
					? "Event dipublikasikan. Peserta bisa merespons sekarang."
					: "Event disimpan sebagai draf.",
			{ tone: "success" },
		);
		navigate({ to: "/event/$id", params: { id: result.id } });
	}

	const participants = directory.data ?? [];
	const candidates = candidateDates();
	const totalSlots = candidates.reduce(
		(total, date) => total + generateSlots(duration, [date]).length,
		0,
	);
	const matrixRows =
		windowMode === "global"
			? [
					{
						key: "__global",
						label: "Semua tanggal",
						picks: dates.length > 0 ? picksFor(dates[0]) : emptyPicks(),
					},
				]
			: dates.map((date) => ({ key: date, label: fmtDateShort(date), picks: picksFor(date) }));

	const { mode, setMode, slotProps } = useSlotDrag({
		apply: (key, paintMode) => {
			const [target, column] = key.split("|");
			paintPick(target, Number(column), paintMode);
		},
		onStart: () => setPicksUndo(slotPicks),
	});

	if (edit && existing.loading) {
		return (
			<div className="page">
				<span className="skeleton block h-75" />
			</div>
		);
	}

	return (
		<div className="page">
			<header className="page-head">
				<div>
					<h1>{edit ? "Ubah event" : "Buat event"}</h1>
					<p className="page-sub">
						{edit
							? "Perbarui informasi event selama belum difinalisasi."
							: "Tentukan siapa yang diundang, tanggal, dan jam yang mungkin."}
					</p>
				</div>
				<div className="header-actions">
					<Link to="/" className="btn ghost small">
						Batal
					</Link>
				</div>
			</header>

			{existing.error ? <ErrorBox message={existing.error} /> : null}
			{error ? <ErrorBox message={error} onRetry={() => setError(null)} /> : null}

			<ol className="stepper" aria-label="Langkah pembuatan event">
				{STEPS.map((item, index) => (
					<li
						key={item.title}
						className={`step${index === step ? " active" : ""}${index < step ? " done" : ""}`}
					>
						<span className="step-num">
							{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}
						</span>
						<span className="step-label">{item.short}</span>
						<span className="sr-only">
							Langkah {index + 1}: {item.title}
						</span>
					</li>
				))}
			</ol>

			<section className="panel">
				<header className="panel-head">
					<div>
						<h2 className="panel-title">{STEPS[step].title}</h2>
						<p className="panel-sub">{stepHint(step)}</p>
					</div>
				</header>

				{step === 0 ? (
					<div className="form-grid">
						<label className="field full">
							<span>Judul event</span>
							<input
								className="input"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Contoh: Rapat koordinasi divisi acara"
								maxLength={120}
							/>
						</label>
						<label className="field full">
							<span>Deskripsi (opsional)</span>
							<textarea
								className="textarea"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Agenda singkat atau catatan untuk peserta"
								rows={3}
							/>
						</label>
						<label className="field">
							<span>Durasi pertemuan</span>
							<select
								className="select"
								value={duration}
								onChange={(event) => setDuration(Number(event.target.value))}
							>
								{DURATIONS.map((minutes) => (
									<option key={minutes} value={minutes}>
										{minutes} menit
									</option>
								))}
							</select>
							<span className="hint">Kelipatan 30 menit.</span>
						</label>

						<div className="field full">
							<span>Peserta</span>
							<p className="hint mt-0">
								Pembuat event otomatis ikut. Pilih anggota lain yang perlu hadir.
							</p>
							<div className="people-grid">
								{participants.map((person) => {
									const selected = participantIds.includes(person.id);
									return (
										<button
											key={person.id}
											type="button"
											className="person"
											aria-pressed={selected}
											onClick={() =>
												setParticipantIds((current) =>
													selected
														? current.filter((id) => id !== person.id)
														: [...current, person.id],
												)
											}
										>
											<Avatar name={person.name} />
											<span>
												<span className="person-name">{person.name}</span>
												<span className="person-role">{person.role}</span>
											</span>
											{selected ? (
												<Check className="person-check" size={16} aria-hidden="true" />
											) : null}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				) : null}

				{step === 1 ? (
					<div className="stack">
						{/* biome-ignore lint/a11y/useSemanticElements: kontrol tersegmentasi, bukan fieldset form */}
						<div className="segmented" role="group" aria-label="Cara memilih tanggal">
							<button
								type="button"
								aria-pressed={dateMode === "range"}
								onClick={() => setDateMode("range")}
							>
								Rentang tanggal
							</button>
							<button
								type="button"
								aria-pressed={dateMode === "custom"}
								onClick={() => setDateMode("custom")}
							>
								Tanggal tertentu
							</button>
						</div>

						<div className="stack two-col">
							<MonthCalendar
								month={calendarMonth}
								onMonthChange={setCalendarMonth}
								mode={dateMode}
								selected={dates}
								rangeStart={rangeStart}
								rangeEnd={rangeEnd}
								min={today}
								onRangeClick={rangeClick}
								onToggle={toggleCustomDate}
							/>

							<div className="stack">
								{dateMode === "range" ? (
									<p className="hint">
										Klik tanggal mulai, lalu tanggal akhir pada kalender. Rentang langsung
										digunakan sebagai kandidat.
									</p>
								) : (
									<p className="hint">Klik tanggal pada kalender untuk menambah atau menghapus.</p>
								)}
								<div className="matrix-actions">
									<button
										type="button"
										className="btn ghost small"
										onClick={() => {
											setDates([]);
											setRangeStart("");
											setRangeEnd("");
											setFormError(null);
										}}
									>
										Kosongkan tanggal
									</button>
								</div>

								<div>
									<h3 className="panel-title text-sm">
										Tanggal terpilih ({dates.length})
									</h3>
									{dates.length === 0 ? (
										<p className="hint">Belum ada tanggal kandidat.</p>
									) : (
										<div className="chip-row">
											{dateGroups(dates).map((group) =>
												group.length >= 3 ? (
													<span key={group[0]} className="chip">
														{fmtDateShort(group[0])} – {fmtDateShort(group[group.length - 1])}
														<button
															type="button"
															onClick={() => removeDates(group)}
															aria-label={`Hapus rentang ${fmtDateLong(group[0])} sampai ${fmtDateLong(
																group[group.length - 1],
															)}`}
														>
															<Trash2 size={13} aria-hidden="true" />
														</button>
													</span>
												) : (
													group.map((date) => (
														<span key={date} className="chip">
															{fmtDateLong(date)}
															<button
																type="button"
																onClick={() => removeDates([date])}
																aria-label={`Hapus ${fmtDateLong(date)}`}
															>
																<Trash2 size={13} aria-hidden="true" />
															</button>
														</span>
													))
												),
											)}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				) : null}

				{step === 2 ? (
					<div className="stack">
						{/* biome-ignore lint/a11y/useSemanticElements: kontrol tersegmentasi, bukan fieldset form */}
						<div className="segmented" role="group" aria-label="Cara menentukan rentang jam">
							<button
								type="button"
								aria-pressed={windowMode === "global"}
								onClick={() => setWindowMode("global")}
							>
								Satu rentang untuk semua
							</button>
							<button
								type="button"
								aria-pressed={windowMode === "custom"}
								onClick={() => setWindowMode("custom")}
							>
								Rentang per tanggal
							</button>
						</div>

						<div className="matrix-toolbar">
							<SlotModePicker mode={mode} onChange={setMode} />
							<div className="matrix-actions">
								<button
									type="button"
									className="btn ghost small"
									onClick={() => bulkPick(1)}
									disabled={dates.length === 0}
								>
									<Sparkles size={14} aria-hidden="true" />
									Tandai semua jam
								</button>
								<button
									type="button"
									className="btn ghost small"
									onClick={() => bulkPick(0)}
									disabled={dates.length === 0}
								>
									Kosongkan semua
								</button>
								{picksUndo ? (
									<button type="button" className="btn ghost small" onClick={undoPicks}>
										<RotateCcw size={14} aria-hidden="true" />
										Batalkan perubahan
									</button>
								) : null}
							</div>
						</div>

						{windowMode === "global" ? (
							<p className="hint">
								Satu baris untuk semua tanggal. Perubahan di bawah berlaku untuk setiap
								tanggal kandidat.
							</p>
						) : (
							<p className="hint">Atur rentang jam untuk setiap tanggal kandidat.</p>
						)}

						{dates.length === 0 ? (
							<p className="hint">Tentukan dulu tanggal kandidat pada langkah sebelumnya.</p>
						) : (
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
										{matrixRows.map((row) => (
											<tr key={row.key}>
												<td className="day">{row.label}</td>
												{row.picks.map((value, column) => (
													<td key={`${row.key}-${minutesToTime(column * 30)}`}>
														<button
															type="button"
															className="slot"
															data-state={value === 1 ? "1" : "0"}
															aria-pressed={value === 1}
															aria-label={`${row.label} ${minutesToTime(column * 30)}`}
															{...slotProps(`${row.key}|${column}`)}
														/>
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
								<p className="scroll-hint">Geser tabel ke samping untuk melihat jam lainnya.</p>
							</div>
						)}

						<div className="legend bottom">
							<span className="legend-item">
								<span className="legend-swatch focus" aria-hidden="true" />
								Dipakai untuk kandidat
							</span>
							<span className="legend-item">
								<span className="legend-swatch" aria-hidden="true" />
								Tidak dipakai
							</span>
						</div>

						<p className="hint">
							Kandidat dibuat setiap 30 menit selama seluruh durasi {duration} menit
							masih berada di dalam rentang. Perkiraan: {totalSlots} kandidat waktu.
						</p>
					</div>
				) : null}

				{step === 3 ? (
					<div className="stack">
						<label className="check-row">
							<input
								type="checkbox"
								checked={showRecap}
								onChange={(event) => setShowRecap(event.target.checked)}
							/>
							<span className="check-copy">
								<span className="font-medium">
									Tampilkan rekap kepada peserta lain
								</span>
								<span className="hint mt-0.5">
									Peserta bisa melihat jumlah bisa, tidak bisa, dan belum merespons
									pada tiap kandidat. Identitas dan alasan tidak ditampilkan.
								</span>
							</span>
						</label>
						<p className="hint">
							{showRecap
								? "Rekap agregat akan terlihat oleh semua peserta."
								: "Rekap hanya terlihat olehmu sebagai pembuat event. Ini pengaturan yang disarankan."}
						</p>
					</div>
				) : null}

				{step === 4 ? (
					<div className="stack">
						<dl className="summary">
							<dt>Judul</dt>
							<dd>{title}</dd>
							<dt>Deskripsi</dt>
							<dd>{description || "—"}</dd>
							<dt>Durasi</dt>
							<dd>{duration} menit</dd>
							<dt>Peserta</dt>
							<dd>
								{participants
									.filter((person) => participantIds.includes(person.id))
									.map((person) => person.name)
									.join(", ") || "Belum dipilih"}
							</dd>
							<dt>Tanggal kandidat</dt>
							<dd>
								<div className="date-rows">
									{candidates.map((date) => (
										<div className="date-row compact" key={date.date}>
											<span className="date-label">{fmtDateLong(date.date)}</span>
											<span className="muted">
												{fmtTimeRange(date.startMinute, date.endMinute)}
											</span>
										</div>
									))}
								</div>
							</dd>
							<dt>Rekap peserta</dt>
							<dd>{showRecap ? "Ditampilkan" : "Hanya pembuat event"}</dd>
							<dt>Kandidat waktu</dt>
							<dd>{totalSlots} slot</dd>
						</dl>
						<p className="hint">
							Setelah dipublikasikan, peserta bisa mengisi ketersediaan. Jadwal
							final tetap kamu tentukan sendiri.
						</p>
					</div>
				) : null}

				{formError ? (
					<p className="error-text" role="alert">
						{formError}
					</p>
				) : null}

				<div className="sticky-actions">
					<div>
						{step > 0 ? (
							<button
								type="button"
								className="btn ghost"
								onClick={() => {
									setFormError(null);
									setStep((current) => Math.max(0, current - 1));
								}}
							>
								<ChevronLeft size={16} aria-hidden="true" />
								Kembali
							</button>
						) : null}
					</div>
					<div className="actions-row">
						{step === STEPS.length - 1 ? (
							<>
								{!edit ? (
									<button
										type="button"
										className="btn ghost"
										onClick={() => submit(false)}
										disabled={pending}
									>
										Simpan sebagai draf
									</button>
								) : null}
								<button
									type="button"
									className="btn primary"
									onClick={() => submit(true)}
									disabled={pending}
								>
									{pending ? <span className="spinner" /> : null}
									{edit ? "Simpan perubahan" : "Publikasikan event"}
								</button>
							</>
						) : (
							<button type="button" className="btn primary" onClick={next}>
								Lanjut
								<ChevronRight size={16} aria-hidden="true" />
							</button>
						)}
					</div>
				</div>
			</section>

			<p className="hint flex items-center gap-1.5">
				<Users size={14} aria-hidden="true" />
				{participantIds.length} peserta dipilih
				<span className="dot-sep" />
				<CalendarDays size={14} aria-hidden="true" />
				{dates.length} tanggal kandidat
			</p>
		</div>
	);
}

function stepHint(step: number): string {
	switch (step) {
		case 0:
			return "Isi judul, durasi, dan pilih peserta yang perlu hadir.";
		case 1:
			return "Pilih tanggal yang mungkin untuk rapat, lewat rentang atau satu per satu.";
		case 2:
			return "Tandai slot jam yang boleh dipakai pada tanggal-tanggal tersebut.";
		case 3:
			return "Tentukan apakah peserta lain boleh melihat rekap ketersediaan.";
		default:
			return "Periksa sekali lagi sebelum event dipublikasikan.";
	}
}
