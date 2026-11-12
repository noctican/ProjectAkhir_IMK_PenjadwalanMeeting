import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	BellRing,
	CalendarPlus,
	CircleAlert,
	Clock,
	Pencil,
	RotateCcw,
	Sparkles,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import {
	SlotModePicker,
	useSlotDrag,
	type SlotMode,
} from "@/components/slot-input";
import {
	Avatar,
	ConfirmDialog,
	ErrorBox,
	StatusBadge,
} from "@/components/ui";
import { useAction, useQuery } from "@/data/use-query";
import { notify } from "@/data/ui-store";
import type { EventSlot, MyResponse, SlotCounts } from "@/data/types";
import {
	fmtDateLong,
	fmtDateShort,
	fmtDateTimeRange,
	fmtTimeRange,
	minutesToTime,
} from "@/data/time";

export const Route = createFileRoute("/event/$id")({
	component: EventDetailRoute,
});

function EventDetailRoute() {
	const { id } = Route.useParams();
	return (
		<AppShell>
			<EventDetailPage id={id} />
		</AppShell>
	);
}

type SlotTone = "good" | "warn" | "bad";

function slotTone(counts?: SlotCounts): SlotTone {
	if (!counts) return "warn";
	if (counts.unavailable === 0 && counts.pending === 0) return "good";
	if (counts.available === 0 || counts.unavailable > counts.available) return "bad";
	return "warn";
}

function EventDetailPage({ id }: { id: string }) {
	const { data, loading, error, reload } = useQuery((p) => p.getEvent(id), [id]);
	const { run, pending, error: actionError, setError } = useAction();

	const [draft, setDraft] = useState<Record<string, MyResponse>>({});
	const [responseUndo, setResponseUndo] = useState<Record<
		string,
		MyResponse
	> | null>(null);
	const [pendingFinal, setPendingFinal] = useState<EventSlot | null>(null);
	const [detailSlot, setDetailSlot] = useState<EventSlot | null>(null);
	const [showAllParticipants, setShowAllParticipants] = useState(false);
	const [showAllDates, setShowAllDates] = useState(false);
	const [confirmCancel, setConfirmCancel] = useState(false);
	const [confirmReopen, setConfirmReopen] = useState(false);

	useEffect(() => {
		if (!data) return;
		const next: Record<string, MyResponse> = {};
		for (const slot of data.slots) {
			next[slot.key] = slot.myStatus ?? slot.suggestedStatus;
		}
		setDraft(next);
	}, [data]);

	const isOrganizer = data?.role === "organizer";
	const canSeeRecap = Boolean(data && (isOrganizer || data.showRecap));

	const slots = useMemo(() => data?.slots ?? [], [data]);

	const grouped = useMemo(() => {
		const map = new Map<string, EventSlot[]>();
		for (const slot of slots) {
			const list = map.get(slot.date) ?? [];
			list.push(slot);
			map.set(slot.date, list);
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [slots]);

	const slotByKey = useMemo(
		() => new Map(slots.map((slot) => [slot.key, slot])),
		[slots],
	);

	const candidateTimes = useMemo(
		() => [...new Set(slots.map((slot) => slot.startMinute))].sort((a, b) => a - b),
		[slots],
	);

	useEffect(() => {
		if (!detailSlot) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setDetailSlot(null);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [detailSlot]);

	const { mode, setMode, slotProps } = useSlotDrag({
		apply: (key, paintMode) => paintResponse(key, paintMode),
		onStart: () => setResponseUndo(draft),
	});

	function paintResponse(key: string, paintMode: SlotMode) {
		setDraft((current) => {
			const selected = (current[key] ?? "available") === "available";
			const next =
				paintMode === "toggle"
					? selected
						? "unavailable"
						: "available"
					: paintMode === "available"
						? "available"
						: "unavailable";
			return { ...current, [key]: next };
		});
	}

	const unsent = slots.some((slot) => slot.myStatus === null);

	if (loading && !data) {
		return (
			<div className="page">
				<span className="skeleton block h-8 w-60" />
				<span className="skeleton mt-4 block h-50" />
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="page">
				<Link to="/" className="btn ghost small">
					<ArrowLeft size={15} aria-hidden="true" />
					Kembali ke dasbor
				</Link>
				<ErrorBox
					message={error ?? "Event tidak ditemukan."}
					onRetry={reload}
				/>
			</div>
		);
	}

	async function publish() {
		const result = await run((p) => p.publishEvent(id));
		if (!result) return;
		notify("Event dipublikasikan. Peserta bisa merespons.", { tone: "success" });
		reload();
	}

	async function submitResponse() {
		const responses: { slotKey: string; status: "available" | "unavailable" }[] =
			slots.map((slot) => ({
				slotKey: slot.key,
				status:
					draft[slot.key] === "unavailable" ? "unavailable" : "available",
			}));
		const result = await run((p) => p.respond(id, responses));
		if (!result) return;
		notify("Respons ketersediaanmu tersimpan.", { tone: "success" });
		reload();
	}

	function applyAllResponses(status: MyResponse) {
		const next: Record<string, MyResponse> = {};
		for (const slot of slots) next[slot.key] = status;
		setResponseUndo(draft);
		setDraft(next);
	}

	function undoResponses() {
		if (!responseUndo) return;
		setDraft(responseUndo);
		setResponseUndo(null);
	}

	function restoreSuggested() {
		const next: Record<string, MyResponse> = {};
		for (const slot of slots) next[slot.key] = slot.suggestedStatus ?? "available";
		setResponseUndo(draft);
		setDraft(next);
	}

	async function finalize() {
		if (!pendingFinal) return;
		const result = await run((p) => p.finalize(id, pendingFinal.key));
		if (!result) return;
		setPendingFinal(null);
		notify("Jadwal final sudah ditetapkan.", { tone: "success" });
		reload();
	}

	async function cancelEvent() {
		const result = await run((p) => p.cancel(id));
		if (!result) return;
		setConfirmCancel(false);
		notify("Event dibatalkan.", { tone: "info" });
		reload();
	}

	async function reopen() {
		const result = await run((p) => p.reopen(id));
		if (!result) return;
		setConfirmReopen(false);
		notify("Event dibuka kembali untuk respons dan perubahan jadwal.", {
			tone: "info",
		});
		reload();
	}

	async function remind() {
		const result = await run((p) => p.remind(id));
		if (!result) return;
		notify(
			result.reminded === 0
				? "Semua peserta sudah merespons."
				: `${result.reminded} peserta diingatkan untuk merespons.`,
			{ tone: "info" },
		);
	}

	async function addCalendar() {
		const result = await run((p) => p.addToCalendar(id));
		if (!result) return;
		notify(
			result.alreadyAdded
				? "Jadwal ini sudah ada di kalendermu."
				: "Jadwal ditambahkan ke Google Calendar.",
			{ tone: "success" },
		);
		reload();
	}

	const answered = data.participants.filter((person) => person.responded).length;

	return (
		<div className="page">
			<Link to="/" className="btn ghost small self-start">
				<ArrowLeft size={15} aria-hidden="true" />
				Dasbor
			</Link>

			<header className="detail-head">
				<div>
					<div className="actions-row mb-2">
						<StatusBadge status={data.status} />
						{data.role === "organizer" ? (
							<span className="badge plain">Kamu pembuat event</span>
						) : (
							<span className="badge plain">Kamu peserta</span>
						)}
					</div>
					<h1 className="detail-title">{data.title}</h1>
					<p className="detail-meta">
						<Clock size={14} aria-hidden="true" />
						{data.durationMinutes} menit
						<span className="dot-sep" />
						<Users size={14} aria-hidden="true" />
						{data.participantCount} peserta · {answered} sudah merespons
						<span className="dot-sep" />
						{data.candidateDateCount} tanggal kandidat
					</p>
					{data.description ? <p className="page-sub">{data.description}</p> : null}
				</div>

				<div className="header-actions">
					{isOrganizer && (data.status === "draft" || data.status === "open") ? (
						<>
							<Link
								to="/event/baru"
								search={{ edit: data.id }}
								className="btn ghost small"
							>
								<Pencil size={15} aria-hidden="true" />
								Ubah
							</Link>
							{data.status === "draft" ? (
								<button
									type="button"
									className="btn primary small"
									onClick={publish}
									disabled={pending}
								>
									Publikasikan
								</button>
							) : null}
						</>
					) : null}
					{isOrganizer && data.status === "open" ? (
						<button type="button" className="btn ghost small" onClick={remind}>
							<BellRing size={15} aria-hidden="true" />
							Ingatkan peserta
						</button>
					) : null}
					{isOrganizer && data.status === "finalized" ? (
						<button
							type="button"
							className="btn ghost small"
							onClick={() => setConfirmReopen(true)}
						>
							Buka kembali
						</button>
					) : null}
					{isOrganizer && data.status !== "cancelled" ? (
						<button
							type="button"
							className="btn ghost small"
							onClick={() => setConfirmCancel(true)}
						>
							Batalkan event
						</button>
					) : null}
				</div>
			</header>

			{actionError ? (
				<ErrorBox message={actionError} onRetry={() => setError(null)} />
			) : null}

			{data.status === "finalized" ? (
				<section className="final-card">
					<span className="final-label">Jadwal final sudah ditetapkan</span>
					<span className="final-time">
						{data.finalStartsAt && data.finalEndsAt
							? fmtDateTimeRange(data.finalStartsAt, data.finalEndsAt)
							: "Waktu belum tersedia"}
					</span>
					<span className="final-sub">
						{data.calendarInserted
							? "Sudah ditambahkan ke kalender."
							: data.calendarConnected
								? "Kamu bisa menambahkan jadwal ini ke Google Calendar."
								: "Hubungkan kalender di Jadwal Saya untuk menambahkan jadwal ini."}
					</span>
					<div className="actions-row">
						<button
							type="button"
							className="btn primary"
							onClick={addCalendar}
							disabled={pending || data.calendarInserted || !data.calendarConnected}
						>
							{pending ? <span className="spinner" /> : <CalendarPlus size={16} aria-hidden="true" />}
							{data.calendarInserted
								? "Sudah ditambahkan"
								: "Tambahkan ke Google Calendar"}
						</button>
						<span className="hint">
							Penambahan ke kalender bersifat opsional.
						</span>
					</div>
				</section>
			) : null}

			{data.status === "cancelled" ? (
				<output className="banner error">
					<CircleAlert />
					<span>Event ini dibatalkan dan tidak menerima respons baru.</span>
				</output>
			) : null}

			{data.canRespond && data.status === "open" ? (
				<section className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">Ketersediaanmu</h2>
							<p className="panel-sub">
								Tandai waktu yang kamu bisa hadiri. Status awal diambil dari
								jadwal rutin, event TemuYuk lain, dan kalender bila terhubung —
								kamu tetap bisa mengubahnya.
							</p>
						</div>
						{unsent ? (
							<span className="badge pending">Belum dikirim</span>
						) : (
							<span className="badge available">Sudah dikirim</span>
						)}
					</header>

					<div className="matrix-toolbar">
						<SlotModePicker mode={mode} onChange={setMode} />
					</div>

					<div className="matrix-scroll">
						<table className="matrix compact">
							<thead>
								<tr>
									<th className="day" scope="col">
										Tanggal
									</th>
									{candidateTimes.map((time) => (
										<th key={time} scope="col">
											{minutesToTime(time)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{grouped.map(([date]) => (
									<tr key={date}>
										<td className="day">{fmtDateShort(date)}</td>
										{candidateTimes.map((time) => {
											const slot = slotByKey.get(`${date}|${time}`);
											if (!slot) return <td key={time} className="matrix-empty" />;
											const value = draft[slot.key] ?? "available";
											const selected = value === "available";
											return (
												<td key={time}>
													<button
														type="button"
														className="slot"
														data-state={selected ? "1" : "0"}
														aria-pressed={selected}
														aria-label={`${fmtDateLong(date)} ${minutesToTime(time)} — ${
															selected ? "bisa hadir" : "tidak bisa hadir"
														}`}
														{...slotProps(slot.key)}
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
						Geser tabel ke samping bila jam kandidat belum terlihat.
					</p>

					<div className="matrix-actions">
						<button
							type="button"
							className="btn small ghost"
							onClick={() => applyAllResponses("available")}
						>
							Tandai semua bisa
						</button>
						<button
							type="button"
							className="btn small ghost"
							onClick={() => applyAllResponses("unavailable")}
						>
							Tandai semua tidak bisa
						</button>
						<button
							type="button"
							className="btn small ghost"
							onClick={restoreSuggested}
							disabled={pending}
						>
							<Sparkles size={15} aria-hidden="true" />
							Isi usulan awal
						</button>
						{responseUndo ? (
							<button
								type="button"
								className="btn small ghost"
								onClick={undoResponses}
							>
								<RotateCcw size={15} aria-hidden="true" />
								Batalkan perubahan
							</button>
						) : null}
					</div>

					<div className="legend bottom">
						<span className="legend-item">
							<span className="legend-swatch focus" aria-hidden="true" />
							Bisa
						</span>
						<span className="legend-item">
							<span className="legend-swatch busy" aria-hidden="true" />
							Tidak bisa
						</span>
					</div>

					<div className="sticky-actions">
						<span className="dirty-note">
							{unsent
								? "Respons belum dikirim. Kirim agar pembuat event melihat ketersediaanmu."
								: "Responsmu sudah dikirim dan masih bisa diperbarui selama event terbuka."}
						</span>
						<button
							type="button"
							className="btn primary"
							onClick={submitResponse}
							disabled={pending}
						>
							{pending ? <span className="spinner" /> : null}
							{unsent ? "Kirim respons" : "Perbarui respons"}
						</button>
					</div>
				</section>
			) : null}

			{data.status === "open" && data.role === "participant" && !canSeeRecap ? (
				<p className="hint">
					Rekap peserta disembunyikan oleh pembuat event. Kamu hanya melihat
					ketersediaanmu sendiri.
				</p>
			) : null}

			{canSeeRecap && slots.length > 0 && data.status !== "draft" ? (
				<section className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">
								{isOrganizer ? "Rekap kandidat waktu" : "Rekap peserta"}
							</h2>
							<p className="panel-sub">
								{isOrganizer
									? "Warna menunjukkan peluang kehadiran. Klik slot untuk melihat siapa saja yang bisa dan tidak bisa, lalu tetapkan jadwal."
									: "Warna menunjukkan peluang kehadiran. Klik slot untuk melihat siapa saja yang bisa dan tidak bisa."}
							</p>
						</div>
					</header>

					<div className="matrix-scroll">
						<table className="matrix compact">
							<thead>
								<tr>
									<th className="day" scope="col">
										Tanggal
									</th>
									{candidateTimes.map((time) => (
										<th key={time} scope="col">
											{minutesToTime(time)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{grouped.map(([date]) => (
									<tr key={date}>
										<td className="day">{fmtDateShort(date)}</td>
										{candidateTimes.map((time) => {
											const slot = slotByKey.get(`${date}|${time}`);
											if (!slot) return <td key={time} className="matrix-empty" />;
											const tone = slotTone(slot.counts);
											return (
												<td key={time}>
													<button
														type="button"
														className={`slot recap ${tone}`}
														onClick={() => setDetailSlot(slot)}
														aria-label={`${fmtDateLong(date)} ${minutesToTime(
															time,
														)} — ${slot.counts?.available ?? 0} bisa, ${
															slot.counts?.unavailable ?? 0
														} tidak bisa, ${slot.counts?.pending ?? 0} belum merespons. Lihat detail.`}
													>
														{slot.counts?.available ?? 0}
													</button>
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="scroll-hint">
						Geser tabel ke samping bila jam kandidat belum terlihat.
					</p>

					<div className="legend bottom">
						<span className="legend-item">
							<span className="legend-swatch good" aria-hidden="true" />
							Direkomendasikan
						</span>
						<span className="legend-item">
							<span className="legend-swatch warn" aria-hidden="true" />
							Pertimbangkan
						</span>
						<span className="legend-item">
							<span className="legend-swatch bad" aria-hidden="true" />
							Tidak disarankan
						</span>
					</div>
				</section>
			) : null}

			<section className="two-col">
				<div className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">Peserta</h2>
							<p className="panel-sub">
								{answered} dari {data.participantCount} peserta sudah merespons.
							</p>
						</div>
					</header>
					<div className="event-list">
						{(showAllParticipants
							? data.participants
							: data.participants.slice(0, 5)
						).map((person) => (
							<div key={person.id} className="event-row cursor-default">
								<div className="event-main flex-row gap-2.5">
									<Avatar name={person.name} />
									<span>
										<span className="event-title">{person.name}</span>
										<span className="event-meta">
											{person.role === "organizer"
												? "Pembuat event"
												: person.responded
													? "Sudah merespons"
													: "Belum merespons"}
										</span>
									</span>
								</div>
								{person.role === "organizer" ? (
									<span className="badge plain">Pembuat</span>
								) : person.responded ? (
									<span className="badge available">Sudah</span>
								) : (
									<span className="badge pending">Belum</span>
								)}
							</div>
						))}
					</div>
					{data.participants.length > 5 ? (
						<button
							type="button"
							className="btn ghost small load-more"
							onClick={() => setShowAllParticipants((current) => !current)}
						>
							{showAllParticipants
								? "Tampilkan lebih sedikit"
								: `Tampilkan semua (${data.participants.length})`}
						</button>
					) : null}
				</div>

				<div className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">Rentang kandidat</h2>
							<p className="panel-sub">
								Rentang jam yang ditetapkan pembuat event.
							</p>
						</div>
					</header>
					<div className="date-rows">
						{(showAllDates ? data.dates : data.dates.slice(0, 5)).map((item) => (
							<div className="date-row compact" key={item.date}>
								<span className="date-label">{fmtDateLong(item.date)}</span>
								<span className="muted">
									{fmtTimeRange(item.startMinute, item.endMinute)} WIB
								</span>
							</div>
						))}
					</div>
					{data.dates.length > 5 ? (
						<button
							type="button"
							className="btn ghost small load-more"
							onClick={() => setShowAllDates((current) => !current)}
						>
							{showAllDates
								? "Tampilkan lebih sedikit"
								: `Tampilkan semua (${data.dates.length})`}
						</button>
					) : null}
				</div>
			</section>

			{detailSlot ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: klik latar menutup dialog, Escape juga tersedia
				<div
					className="dialog-backdrop"
					role="presentation"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setDetailSlot(null);
					}}
				>
					<div
						className="dialog wide"
						role="dialog"
						aria-modal="true"
						aria-labelledby="slot-detail-title"
					>
						<h2 id="slot-detail-title">{fmtDateLong(detailSlot.date)}</h2>
						<p>
							{fmtTimeRange(detailSlot.startMinute, detailSlot.endMinute)} WIB ·{" "}
							{detailSlot.counts?.available ?? 0} bisa,{" "}
							{detailSlot.counts?.unavailable ?? 0} tidak bisa,{" "}
							{detailSlot.counts?.pending ?? 0} belum merespons.
						</p>
						<div className="slot-detail">
							<section>
								<h3>Bisa hadir</h3>
								<p>
									{detailSlot.availableUsers?.join(", ") || "Belum ada peserta."}
								</p>
							</section>
							<section>
								<h3>Tidak bisa</h3>
								<p>
									{detailSlot.unavailableUsers?.join(", ") ||
										"Belum ada peserta."}
								</p>
							</section>
							<section>
								<h3>Belum merespons</h3>
								<p>
									{detailSlot.pendingUsers?.join(", ") || "Semua sudah merespons."}
								</p>
							</section>
						</div>
						<div className="dialog-actions">
							{isOrganizer && data.status === "open" ? (
								<button
									type="button"
									className="btn primary"
									onClick={() => {
										setPendingFinal(detailSlot);
										setDetailSlot(null);
									}}
								>
									Tetapkan jadwal
								</button>
							) : null}
							<button
								type="button"
								className="btn ghost"
								onClick={() => setDetailSlot(null)}
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			) : null}

			<ConfirmDialog
				open={pendingFinal !== null}
				title="Tetapkan jadwal final?"
				description={
					pendingFinal
						? `${fmtDateLong(pendingFinal.date)}, ${fmtTimeRange(
								pendingFinal.startMinute,
								pendingFinal.endMinute,
							)} WIB. ${pendingFinal.counts?.available ?? 0} bisa hadir, ${
								pendingFinal.counts?.unavailable ?? 0
							} tidak bisa, ${pendingFinal.counts?.pending ?? 0} belum merespons.`
						: ""
				}
				confirmLabel="Tetapkan jadwal"
				pending={pending}
				onConfirm={finalize}
				onCancel={() => setPendingFinal(null)}
			/>

			<ConfirmDialog
				open={confirmCancel}
				title="Batalkan event ini?"
				description="Peserta akan melihat event sebagai dibatalkan. Tindakan ini tidak menghapus data respons."
				confirmLabel="Batalkan event"
				tone="danger"
				pending={pending}
				onConfirm={cancelEvent}
				onCancel={() => setConfirmCancel(false)}
			/>

			<ConfirmDialog
				open={confirmReopen}
				title="Buka kembali event?"
				description="Jadwal final akan dilepas dan peserta bisa mengubah respons lagi. Waktu final perlu ditetapkan ulang."
				confirmLabel="Buka kembali"
				pending={pending}
				onConfirm={reopen}
				onCancel={() => setConfirmReopen(false)}
			/>
		</div>
	);
}
