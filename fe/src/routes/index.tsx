import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarCheck,
	CalendarPlus,
	CheckCircle2,
	Clock,
	Users,
} from "lucide-react";
import { AppShell, useCurrentUser } from "@/components/shell";
import { Avatar, EmptyState, ErrorBox, StatusBadge } from "@/components/ui";
import { useQuery } from "@/data/use-query";
import type { EventSummary } from "@/data/types";
import { fmtDateShort, fmtDateTimeRange } from "@/data/time";

export const Route = createFileRoute("/")({
	component: DashboardRoute,
});

function DashboardRoute() {
	return (
		<AppShell>
			<DashboardPage />
		</AppShell>
	);
}

function DashboardPage() {
	const user = useCurrentUser();
	const { data, loading, error, reload } = useQuery((p) => p.listEvents());
	const events = data ?? [];

	const needsResponse = events.filter(
		(event) =>
			event.role === "participant" &&
			event.status === "open" &&
			!event.myResponded,
	);
	const mine = events.filter(
		(event) => event.role === "organizer" && event.status !== "cancelled",
	);
	const finalized = events.filter((event) => event.status === "finalized");
	const open = events.filter((event) => event.status === "open");

	return (
		<div className="page">
			<header className="page-head">
				<div>
					<h1>Halo, {user.name.split(" ")[0]}.</h1>
					<p className="page-sub">
						Lihat event yang menunggu responsmu dan jadwal rapat terdekat.
					</p>
				</div>
				<div className="header-actions">
					<Link to="/event/baru" search={{}} className="btn primary">
						<CalendarPlus size={16} aria-hidden="true" />
						Buat event
					</Link>
				</div>
			</header>

			{error ? <ErrorBox message={error} onRetry={reload} /> : null}

			<section className="kpis" aria-label="Ringkasan">
				<div className="kpi">
					<span className="kpi-label">Menunggu responsmu</span>
					<span className="kpi-value">{needsResponse.length}</span>
					<span className="kpi-note">
						{needsResponse.length
							? "Isi ketersediaanmu agar jadwal bisa ditetapkan."
							: "Semua undangan sudah kamu respons."}
					</span>
				</div>
				<div className="kpi">
					<span className="kpi-label">Event yang kamu buat</span>
					<span className="kpi-value">{mine.length}</span>
					<span className="kpi-note">
						{open.length} masih terbuka untuk respons peserta.
					</span>
				</div>
				<div className="kpi">
					<span className="kpi-label">Jadwal final</span>
					<span className="kpi-value">{finalized.length}</span>
					<span className="kpi-note">Rapat dengan waktu yang sudah ditetapkan.</span>
				</div>
			</section>

			<div className="grid-2">
				<section className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">Perlu responsmu</h2>
							<p className="panel-sub">
								Undangan terbuka yang belum kamu isi ketersediaannya.
							</p>
						</div>
					</header>

					{loading && !data ? (
						<MatrixSkeleton />
					) : needsResponse.length === 0 ? (
						<EmptyState
							title="Tidak ada yang menunggu"
							description="Undangan baru akan muncul di sini saat kamu diundang ke sebuah event."
							action={
								<Link to="/jadwal" className="btn ghost small">
									Periksa jadwal saya
								</Link>
							}
						/>
					) : (
						<div className="event-list">
							{needsResponse.map((event) => (
								<Link
									key={event.id}
									to="/event/$id"
									params={{ id: event.id }}
									className="event-row"
								>
									<div className="event-main">
										<span className="event-title">{event.title}</span>
										<span className="event-meta">
											{event.firstDate
												? `Mulai ${fmtDateShort(event.firstDate)}`
												: "Belum ada tanggal"}
											<span className="dot-sep" />
											{event.durationMinutes} menit
											<span className="dot-sep" />
											{event.candidateDateCount} tanggal kandidat
										</span>
									</div>
									<span className="badge pending">Belum merespons</span>
									<ArrowRight className="chev" size={16} aria-hidden="true" />
								</Link>
							))}
						</div>
					)}
				</section>

				<section className="panel">
					<header className="panel-head">
						<div>
							<h2 className="panel-title">Jadwal final</h2>
							<p className="panel-sub">Rapat yang waktunya sudah dikunci.</p>
						</div>
					</header>

					{finalized.length === 0 ? (
						<EmptyState
							title="Belum ada jadwal final"
							description="Setelah pembuat event menetapkan waktu, jadwalnya muncul di sini."
						/>
					) : (
						<div className="event-list">
							{finalized
								.filter((event) => event.finalStartsAt)
								.sort((a, b) =>
									(a.finalStartsAt ?? "").localeCompare(b.finalStartsAt ?? ""),
								)
								.map((event) => (
									<Link
										key={event.id}
										to="/event/$id"
										params={{ id: event.id }}
										className="event-row"
									>
										<div className="event-main">
											<span className="event-title">{event.title}</span>
											<span className="event-meta">
												<CalendarCheck size={14} aria-hidden="true" />
												{event.finalStartsAt && event.finalEndsAt
													? fmtDateTimeRange(
															event.finalStartsAt,
															event.finalEndsAt,
														)
													: "Jadwal menyusul"}
											</span>
										</div>
										<ArrowRight className="chev" size={16} aria-hidden="true" />
									</Link>
								))}
						</div>
					)}
				</section>
			</div>

			<section className="panel">
				<header className="panel-head">
					<div>
						<h2 className="panel-title">Event kamu</h2>
						<p className="panel-sub">
							Semua event yang kamu buat dan ikuti, terbaru di atas.
						</p>
					</div>
					<Link to="/event/baru" search={{}} className="btn ghost small">
						<CalendarPlus size={15} aria-hidden="true" />
						Event baru
					</Link>
				</header>

				{loading && !data ? (
					<MatrixSkeleton />
				) : events.length === 0 ? (
					<EmptyState
						title="Belum ada event"
						description="Buat event pertamamu untuk mulai mencari waktu yang cocok."
						action={
							<Link to="/event/baru" search={{}} className="btn primary small">
								Buat event
							</Link>
						}
					/>
				) : (
					<div className="event-list">
						{events.map((event) => (
							<EventRow key={event.id} event={event} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

function EventRow({ event }: { event: EventSummary }) {
	return (
		<Link to="/event/$id" params={{ id: event.id }} className="event-row">
			<div className="event-main">
				<span className="event-title">{event.title}</span>
				<span className="event-meta">
					{event.role === "organizer" ? "Kamu pembuat event" : `Dari ${event.organizer}`}
					<span className="dot-sep" />
					<Clock size={14} aria-hidden="true" />
					{event.durationMinutes} menit
					<span className="dot-sep" />
					<Users size={14} aria-hidden="true" />
					{event.respondedCount}/{event.participantCount} merespons
					{event.finalStartsAt
						? ` · ${fmtDateShort(event.finalStartsAt.slice(0, 10))}`
						: event.firstDate
							? ` · mulai ${fmtDateShort(event.firstDate)}`
							: ""}
				</span>
			</div>
			<div className="event-side">
				<span className="people" aria-hidden="true">
					<Avatar name={event.organizer} />
				</span>
				<StatusBadge status={event.status} />
				{event.status === "finalized" ? (
					<CheckCircle2 size={16} aria-hidden="true" className="num-available" />
				) : null}
			</div>
			<ArrowRight className="chev" size={16} aria-hidden="true" />
		</Link>
	);
}

function MatrixSkeleton() {
	return (
		<div className="stack" aria-hidden="true">
			<span className="skeleton" style={{ height: 42 }} />
			<span className="skeleton" style={{ height: 42 }} />
			<span className="skeleton" style={{ height: 42 }} />
		</div>
	);
}
