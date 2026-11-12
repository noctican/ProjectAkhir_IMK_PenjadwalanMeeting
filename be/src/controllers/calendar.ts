import type { Context } from "hono";
import { db, nowIso, uid } from "../db";
import { HttpError } from "./http-error";
import { addDaysLocal, todayLocal } from "../services/scheduling";
import type { AppUser } from "../middlewares/auth";

type ConnectionRow = {
	user_id: string;
	status: string;
	calendar_name: string | null;
	connected_at: string | null;
	last_synced_at: string | null;
};

/** Pola sibuk simulasi (kuliah/lab/organisasi) untuk 5 minggu ke depan. */
const BUSY_PATTERN: { day: number; startMinute: number; endMinute: number }[] = [
	{ day: 1, startMinute: 8 * 60, endMinute: 10 * 60 },
	{ day: 1, startMinute: 13 * 60, endMinute: 15 * 60 },
	{ day: 2, startMinute: 9 * 60 + 30, endMinute: 12 * 60 },
	{ day: 3, startMinute: 8 * 60, endMinute: 10 * 60 },
	{ day: 3, startMinute: 16 * 60, endMinute: 18 * 60 },
	{ day: 4, startMinute: 10 * 60, endMinute: 12 * 60 },
	{ day: 4, startMinute: 13 * 60, endMinute: 15 * 60 },
	{ day: 5, startMinute: 15 * 60, endMinute: 17 * 60 },
];

function datePlus(days: number): string {
	return addDaysLocal(todayLocal(), days);
}

function isoFor(date: string, minute: number): string {
	const hh = String(Math.floor(minute / 60)).padStart(2, "0");
	const mm = String(minute % 60).padStart(2, "0");
	return new Date(`${date}T${hh}:${mm}:00+07:00`).toISOString();
}

/**
 * Mengisi waktu sibuk simulasi. Hanya waktu mulai/selesai yang disimpan,
 * sehingga detail event pribadi tidak pernah tersedia bagi pengguna lain.
 */
export function ensureMockBusy(userId: string) {
	const count = db
		.query<{ n: number }, [string]>(
			"SELECT COUNT(*) AS n FROM busy_events WHERE user_id = ? AND starts_at > ?",
		)
		.get(userId, new Date().toISOString());
	if (count && count.n > 0) return;

	const seedOffset = userId.charCodeAt(0) % 3;
	const rows: { starts: string; ends: string }[] = [];
	for (let dayOffset = 0; dayOffset < 35; dayOffset++) {
		const date = datePlus(dayOffset);
		const weekday = new Date(`${date}T00:00:00+07:00`).getDay();
		const day = weekday === 0 ? 7 : weekday; // 1 = Senin ... 7 = Minggu
		for (const pattern of BUSY_PATTERN) {
			if (pattern.day !== day) continue;
			const shift = pattern.day === 2 ? seedOffset * 30 : 0;
			rows.push({
				starts: isoFor(date, pattern.startMinute + shift),
				ends: isoFor(date, pattern.endMinute + shift),
			});
		}
	}
	if (rows.length === 0) return;
	const insert = db.query(
		"INSERT INTO busy_events (id, user_id, starts_at, ends_at) VALUES (?, ?, ?, ?)",
	);
	for (const row of rows) insert.run(uid(), userId, row.starts, row.ends);
}

function connection(userId: string): ConnectionRow | null {
	return (
		db
			.query<ConnectionRow, [string]>(
				"SELECT * FROM calendar_connections WHERE user_id = ?",
			)
			.get(userId) ?? null
	);
}

export function status(c: Context) {
	const user = c.get("user") as AppUser;
	const row = connection(user.id);
	const busyCount = row?.status === "terhubung"
		? db
				.query<{ n: number }, [string]>(
					"SELECT COUNT(*) AS n FROM busy_events WHERE user_id = ? AND ends_at > ?",
				)
				.get(user.id, new Date().toISOString())?.n ?? 0
		: 0;
	return {
		data: {
			connected: row?.status === "terhubung",
			provider: "google",
			demo: true,
			calendarName: row?.calendar_name ?? null,
			lastSyncedAt: row?.last_synced_at ?? null,
			connectedAt: row?.connected_at ?? null,
			busyEventCount: busyCount,
		},
	};
}

export function connect(c: Context, body: Record<string, unknown> | null) {
	const user = c.get("user") as AppUser;
	const name =
		String(body?.calendarName ?? "").trim() || `Kalender ${user.name}`;
	const now = nowIso();
	db.query(
		`INSERT INTO calendar_connections (user_id, provider, status, calendar_name, connected_at, last_synced_at)
		 VALUES (?, 'google', 'terhubung', ?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET status = 'terhubung', calendar_name = excluded.calendar_name,
		   connected_at = excluded.connected_at, last_synced_at = excluded.last_synced_at`,
	).run(user.id, name, now, now);
	ensureMockBusy(user.id);
	return { message: "Google Calendar terhubung", data: status(c).data };
}

export function disconnect(c: Context) {
	const user = c.get("user") as AppUser;
	db.query(
		`INSERT INTO calendar_connections (user_id, provider, status)
		 VALUES (?, 'google', 'terputus')
		 ON CONFLICT(user_id) DO UPDATE SET status = 'terputus'`,
	).run(user.id);
	db.query("DELETE FROM busy_events WHERE user_id = ?").run(user.id);
	return { message: "Koneksi kalender diputus", data: status(c).data };
}

export function sync(c: Context) {
	const user = c.get("user") as AppUser;
	const row = connection(user.id);
	if (!row || row.status !== "terhubung") {
		throw new HttpError(400, "Hubungkan Google Calendar terlebih dahulu");
	}
	const now = new Date().toISOString();
	db.query("DELETE FROM busy_events WHERE user_id = ? AND ends_at > ?").run(
		user.id,
		now,
	);
	ensureMockBusy(user.id);
	db.query(
		"UPDATE calendar_connections SET last_synced_at = ? WHERE user_id = ?",
	).run(nowIso(), user.id);
	return { message: "Jadwal kalender diperbarui", data: status(c).data };
}

export function busy(c: Context) {
	const user = c.get("user") as AppUser;
	const row = connection(user.id);
	if (!row || row.status !== "terhubung") {
		return { data: { events: [] } };
	}
	const from = c.req.query("from");
	const to = c.req.query("to");
	if (!from || !to) throw new HttpError(400, "Rentang from dan to wajib diisi");
	const events = db
		.query<{ starts_at: string; ends_at: string }, [string, string, string]>(
			`SELECT starts_at, ends_at FROM busy_events
			 WHERE user_id = ? AND starts_at < ? AND ends_at > ?
			 ORDER BY starts_at`,
		)
		.all(user.id, to, from);
	return { data: { events: events.map((e) => ({ startsAt: e.starts_at, endsAt: e.ends_at })) } };
}
