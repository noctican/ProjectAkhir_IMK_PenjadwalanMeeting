import { CalendarCheck, CalendarPlus, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { useAction, useQuery } from "@/data/use-query";
import { notify } from "@/data/ui-store";
import { ErrorBox, ConfirmDialog } from "./ui";

export function CalendarCard({ onChanged }: { onChanged?: () => void }) {
	const calendar = useQuery((provider) => provider.getCalendar());
	const action = useAction();
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);

	const status = calendar.data;

	async function handleConnect() {
		const result = await action.run((provider) =>
			provider.connectCalendar("Kalender Kampus"),
		);
		if (result) {
			notify("Google Calendar terhubung.");
			calendar.reload();
			onChanged?.();
		}
	}

	async function handleSync() {
		const result = await action.run((provider) => provider.syncCalendar());
		if (result) {
			notify("Jadwal kalender diperbarui.");
			calendar.reload();
			onChanged?.();
		}
	}

	async function handleDisconnect() {
		setConfirmDisconnect(false);
		const result = await action.run((provider) =>
			provider.disconnectCalendar(),
		);
		if (result) {
			notify("Koneksi kalender diputus.", { tone: "info" });
			calendar.reload();
			onChanged?.();
		}
	}

	if (calendar.loading && !status) {
		return (
			<div className="panel">
				<div className="skeleton h-10 w-full" />
			</div>
		);
	}

	if (calendar.error) {
		return <ErrorBox message={calendar.error} onRetry={calendar.reload} />;
	}

	if (!status) return null;

	return (
		<>
			<div className="calendar-row">
				<div className="calendar-icon">
					{status.connected ? <CalendarCheck /> : <CalendarPlus />}
				</div>
				<div className="calendar-info">
					<div className="calendar-name">
						{status.connected
							? status.calendarName || "Google Calendar"
							: "Google Calendar belum terhubung"}
					</div>
					<div className="calendar-meta">
						{status.connected ? (
							<>
								{status.busyEventCount} blok sibuk terbaca · terakhir disinkronkan{" "}
								{status.lastSyncedAt
									? new Date(status.lastSyncedAt).toLocaleString("id-ID", {
											dateStyle: "medium",
											timeStyle: "short",
										})
									: "baru saja"}
							</>
						) : (
							"Hubungkan kalender agar jadwal sibuk terisi otomatis. Kamu tetap bisa mengisi manual."
						)}
					</div>
				</div>
				<div className="calendar-actions">
					{status.connected ? (
						<>
							<button
								type="button"
								className="btn small ghost"
								onClick={handleSync}
								disabled={action.pending}
							>
								<RefreshCw size={14} />
								Sinkronkan
							</button>
							<button
								type="button"
								className="btn small"
								onClick={() => setConfirmDisconnect(true)}
								disabled={action.pending}
							>
								<Unplug size={14} />
								Putuskan
							</button>
						</>
					) : (
						<button
							type="button"
							className="btn primary small"
							onClick={handleConnect}
							disabled={action.pending}
						>
							{action.pending ? <span className="spinner" /> : null}
							Hubungkan kalender
						</button>
					)}
				</div>
			</div>
			<p className="hint mt-3">
				TemuYuk memakai jadwal sibuk dari kalender yang terhubung untuk mengisi
				ketersediaan awal. Detail acara pribadi tidak ditampilkan.
			</p>
			{action.error ? (
				<p className="error-text mt-2" role="alert">
					{action.error}
				</p>
			) : null}
			<ConfirmDialog
				open={confirmDisconnect}
				title="Putuskan Google Calendar?"
				description="Jadwal rutin yang sudah kamu isi tetap tersimpan. Data sibuk dari kalender akan dihapus dari perangkat ini."
				confirmLabel="Putuskan kalender"
				tone="danger"
				pending={action.pending}
				onCancel={() => setConfirmDisconnect(false)}
				onConfirm={handleDisconnect}
			/>
		</>
	);
}
