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
	Avatar,
	ConfirmDialog,
	EmptyState,
	ErrorBox,
	StatusBadge,
} from "@/components/ui";
import { useAction, useQuery } from "@/data/use-query";
import { notify } from "@/data/ui-store";
import type { EventSlot, MyResponse } from "@/data/types";
import {
	fmtDateLong,
	fmtDateShort,
	fmtDateTimeRange,
	fmtTimeRange,
	minutesToTime,
	SLOTS_PER_DAY,
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

type Filter = "all" | "complete" | "partial" | "conflict";

const FILTERS: { id: Filter; label: string }[] = [
	{ id: "all", label: "Semua kandidat" },
	{ id: "complete", label: "Semua sudah merespons" },
	{ id: "partial", label: "Respons belum lengkap" },
	{ id: "conflict", label: "Ada yang tidak bisa" },
];

function EventDetailPage({ id }: { id: string }) {
	const { data, loading, error, reload } = useQuery((p) => p.getEvent(id), [id]);
	const { run, pending, error: actionError, setError } = useAction();

	const [draft, setDraft] = useState<Record<string, MyResponse>>({});
	const [responseUndo, setResponseUndo] = useState<Record<
		string,
		MyResponse
	> | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [pendingFinal, setPendingFinal] = useState<EventSlot | null>(null);
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

	const filtered = useMemo(() => {
		const list = slots.filter((slot) => {
			const counts = slot.counts;
			if (!counts || filter === "all") return true;
			if (filter === "complete") return counts.pending === 0;
			if (filter === "partial") return counts.pending > 0;
			return counts.unavailable > 0;
		});
		return list.slice().sort((a, b) => {
			const left = a.counts;
			const right = b.counts;
			if (!left || !right) return a.key.localeCompare(b.key);
			if (right.available !== left.available) return right.available - left.available;
			if (left.unavailable !== right.unavailable) {
				return left.unavailable - right.unavailable;
			}
			return a.key.localeCompare(b.key);
		});
	}, [slots, filter]);

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

	const unsent = slots.some((slot) => slot.myStatus === null);

	if (loading && !data) {
		return (
			<div className="page">
				<span className="skeleton" style={{ height: 32, width: 240 }} />
				<span className="skeleton" style={{ height: 200, marginTop: 16 }} />
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
				: "Jadwal ditambahkan ke Google Calendar (simulasi demo).",
			{ tone: "success" },
		);
		reload();
	}

	const answered = data.participants.filter((person) => person.responded).length;

	return (
		<div className="page">
			<Link to="/" className="btn ghost small" style={{ alignSelf: "flex-start" }}>
				<ArrowLeft size={15} aria-hidden="true" />
				Dasbor
			</Link>

			<header className="detail-head">
				<div>
					<div className="actions-row" style={{ marginBottom: 8 }}>
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
							? "Sudah ditambahkan ke kalender (simulasi)."
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
							Penambahan bersifat opsional dan memakai simulasi, bukan Google
							Calendar sungguhan.
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
								jadwal rutin dan kalender bila terhubung — kamu tetap bisa
								mengubahnya.
							</p>
						</div>
						{unsent ? (
							<span className="badge pending">Belum dikirim</span>
						) : (
							<span className="badge available">Sudah dikirim</span>
						)}
					</header>

					<div className="legend">
						<span className="sr-only">Legenda status kandidat</span>
						<span className="legend-item">
							<span className="legend-swatch focus" aria-hidden="true" />
							Bisa
						</span>
						<span className="legend-item">
							<span className="legend-swatch busy" aria-hidden="true" />
							Tidak bisa
						</span>
						<span className="legend-item">
							<span className="legend-swatch off" aria-hidden="true" />
							Bukan kandidat
						</span>
					</div>

					<div className="matrix-scroll">
						<table className="matrix">
							<thead>
								<tr>
									<th className="day" scope="col">
										Tanggal
									</th>
									{Array.from({ length: SLOTS_PER_DAY }).map((_, column) => (
										<th key={minutesToTime(column * 30)} scope="col">
											{column % 4 === 0 ? minutesToTime(column * 30) : ""}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{grouped.map(([date]) => (
									<tr key={date}>
										<td className="day">{fmtDateShort(date)}</td>
										{Array.from({ length: SLOTS_PER_DAY }).map((_, column) => {
											const key = `${date}|${column * 30}`;
											const slot = slotByKey.get(key);
											if (!slot) {
												return (
													<td key={key}>
														<span className="slot off" />
													</td>
												);
											}
											const value = draft[slot.key] ?? "available";
											const selected = value === "available";
											const time = minutesToTime(column * 30);
											return (
												<td key={key}>
													<button
														type="button"
														className="slot"
														data-state={selected ? "1" : "0"}
														aria-pressed={selected}
														aria-label={`${fmtDateLong(date)} ${time} — ${
															selected ? "bisa hadir" : "tidak bisa hadir"
														}`}
														onClick={() =>
															setDraft((current) => ({
																...current,
																[slot.key]: selected ? "unavailable" : "available",
															}))
														}
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
						Geser tabel ke samping untuk melihat jam lainnya. Sel abu-abu bukan
						kandidat waktu.
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
								Batalkan aksi massal
							</button>
						) : null}
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
									? "Kandidat diurutkan dari yang paling banyak bisa hadir. Kamu yang menentukan jadwal final."
									: "Jumlah peserta yang bisa, tidak bisa, dan belum merespons."}
							</p>
						</div>
						{/* biome-ignore lint/a11y/useSemanticElements: kelompok tombol filter, bukan fieldset form */}
						<div className="filters" role="group" aria-label="Saring kandidat">
							{FILTERS.map((item) => (
								<button
									key={item.id}
									type="button"
									className="chip"
									aria-pressed={filter === item.id}
									onClick={() => setFilter(item.id)}
								>
									{item.label}
								</button>
							))}
						</div>
					</header>

					{filtered.length === 0 ? (
						<EmptyState
							title="Tidak ada kandidat pada filter ini"
							description="Coba pilih filter lain atau lihat semua kandidat."
							action={
								<button
									type="button"
									className="btn ghost small"
									onClick={() => setFilter("all")}
								>
									Lihat semua
								</button>
							}
						/>
					) : (
						<div className="table-scroll">
							<table className="recap">
								<thead>
									<tr>
										<th scope="col">Kandidat waktu</th>
										<th scope="col" className="num">
											Bisa
										</th>
										<th scope="col" className="num">
											Tidak bisa
										</th>
										<th scope="col" className="num">
											Belum merespons
										</th>
										<th scope="col" className="num">
											Total
										</th>
										{isOrganizer && data.status === "open" ? (
											<th scope="col">Aksi</th>
										) : null}
									</tr>
								</thead>
								<tbody>
									{filtered.map((slot, index) => {
										const counts = slot.counts;
										const best =
											index === 0 &&
											counts !== undefined &&
											counts.available ===
												Math.max(...filtered.map((item) => item.counts?.available ?? 0));
										return (
											<tr key={slot.key} className={best ? "best" : undefined}>
												<td>
													<span className="slot-key">
														{fmtDateLong(slot.date)}
													</span>
													<span className="slot-sub">
														{fmtTimeRange(slot.startMinute, slot.endMinute)} WIB
														{best ? <span className="best-tag">Paling memungkinkan</span> : null}
													</span>
												</td>
												<td className="num num-available">{counts?.available ?? "—"}</td>
												<td className="num num-unavailable">
													{counts?.unavailable ?? "—"}
												</td>
												<td className="num num-pending">{counts?.pending ?? "—"}</td>
												<td className="num">{counts?.total ?? "—"}</td>
												{isOrganizer && data.status === "open" ? (
													<td>
														<button
															type="button"
															className="btn ghost small"
															onClick={() => setPendingFinal(slot)}
														>
															Pilih
														</button>
													</td>
												) : null}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
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
						{data.participants.map((person) => (
							<div key={person.id} className="event-row" style={{ cursor: "default" }}>
								<div className="event-main" style={{ flexDirection: "row", gap: 10 }}>
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
						{data.dates.map((item) => (
							<div className="date-row compact" key={item.date}>
								<span className="date-label">{fmtDateLong(item.date)}</span>
								<span className="muted">
									{fmtTimeRange(item.startMinute, item.endMinute)} WIB
								</span>
							</div>
						))}
					</div>
				</div>
			</section>

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
