import type { Context } from "hono";
import { db, nowIso, uid } from "../db";
import { HttpError } from "./http-error";
import type { AppUser } from "../middlewares/auth";
import {
	type CandidateDate,
	generateSlots,
	isValidDate,
	overlapsBusy,
	parseSlotKey,
	rangeAvailableWeekly,
	todayLocal,
} from "../services/scheduling";

type EventRow = {
	id: string;
	title: string;
	description: string | null;
	duration_minutes: number;
	timezone: string;
	status: string;
	show_recap: number;
	created_by: string;
	created_at: string;
	updated_at: string;
	final_slot_key: string | null;
	final_starts_at: string | null;
	final_ends_at: string | null;
	cancelled_at: string | null;
};

type DateRow = {
	candidate_date: string;
	start_minute: number;
	end_minute: number;
};

type ParticipantRow = {
	user_id: string;
	name: string;
	email: string;
	role: string;
	responded_at: string | null;
};

type ResponseRow = { slot_key: string; user_id: string; status: string };

const EVENT_STATUSES = new Set(["draft", "open", "finalized", "cancelled"]);

function loadEvent(id: string): EventRow {
	const row = db
		.query<EventRow, [string]>("SELECT * FROM events WHERE id = ?")
		.get(id);
	if (!row) throw new HttpError(404, "Event tidak ditemukan");
	return row;
}

function participantOf(eventId: string, userId: string): ParticipantRow | null {
	return (
		db
			.query<ParticipantRow, [string, string]>(
				`SELECT p.user_id, u.name, u.email, p.role, p.responded_at
				 FROM event_participants p JOIN users u ON u.id = p.user_id
				 WHERE p.event_id = ? AND p.user_id = ?`,
			)
			.get(eventId, userId) ?? null
	);
}

function requireParticipant(eventId: string, userId: string): ParticipantRow {
	const row = participantOf(eventId, userId);
	if (!row) throw new HttpError(403, "Kamu tidak terlibat dalam event ini");
	return row;
}

function requireOrganizer(eventId: string, userId: string): ParticipantRow {
	const row = requireParticipant(eventId, userId);
	if (row.role !== "organizer") {
		throw new HttpError(403, "Hanya pembuat event yang dapat melakukan aksi ini");
	}
	return row;
}

function datesOf(eventId: string): CandidateDate[] {
	return db
		.query<DateRow, [string]>(
			"SELECT candidate_date, start_minute, end_minute FROM event_dates WHERE event_id = ? ORDER BY candidate_date",
		)
		.all(eventId)
		.map((row) => ({
			date: row.candidate_date,
			startMinute: row.start_minute,
			endMinute: row.end_minute,
		}));
}

function participantsOf(eventId: string): ParticipantRow[] {
	return db
		.query<ParticipantRow, [string]>(
			`SELECT p.user_id, u.name, u.email, p.role, p.responded_at
			 FROM event_participants p JOIN users u ON u.id = p.user_id
			 WHERE p.event_id = ?
			 ORDER BY CASE p.role WHEN 'organizer' THEN 0 ELSE 1 END, u.name`,
		)
		.all(eventId);
}

function responsesOf(eventId: string): ResponseRow[] {
	return db
		.query<ResponseRow, [string]>(
			"SELECT slot_key, user_id, status FROM event_responses WHERE event_id = ?",
		)
		.all(eventId);
}

function summarize(event: EventRow, userId: string) {
	const participant = requireParticipant(event.id, userId);
	const participants = participantsOf(event.id);
	const dates = datesOf(event.id);
	const invited = participants.filter((p) => p.role === "peserta");
	return {
		id: event.id,
		title: event.title,
		description: event.description,
		durationMinutes: event.duration_minutes,
		timezone: event.timezone,
		status: event.status,
		showRecap: event.show_recap === 1,
		role: participant.role === "organizer" ? "organizer" : "participant",
		organizer: participants.find((p) => p.role === "organizer")?.name ?? "—",
		participantCount: invited.length,
		respondedCount: invited.filter((p) => p.responded_at).length,
		myResponded: Boolean(participant.responded_at),
		candidateDateCount: dates.length,
		firstDate: dates[0]?.date ?? null,
		finalStartsAt: event.final_starts_at,
		finalEndsAt: event.final_ends_at,
		createdAt: event.created_at,
	};
}

function validateInput(
	body: Record<string, unknown> | null,
): {
	title: string;
	description: string | null;
	durationMinutes: number;
	timezone: string;
	participantIds: string[];
	dates: CandidateDate[];
	showRecap: boolean;
} {
	const title = String(body?.title ?? "").trim();
	const description = String(body?.description ?? "").trim();
	const durationMinutes = Number(body?.durationMinutes ?? 0);
	const timezone = String(body?.timezone ?? "Asia/Jakarta").trim();
	const participantIds = Array.isArray(body?.participantIds)
		? [...new Set(body.participantIds.map((v) => String(v)))]
		: [];
	const showRecap = body?.showRecap === true;
	const rawDates = Array.isArray(body?.dates) ? body.dates : [];

	if (title.length < 3 || title.length > 120) {
		throw new HttpError(400, "Judul event harus 3–120 karakter");
	}
	if (
		!Number.isInteger(durationMinutes) ||
		durationMinutes < 30 ||
		durationMinutes > 480 ||
		durationMinutes % 30 !== 0
	) {
		throw new HttpError(400, "Durasi harus kelipatan 30 menit (30–480 menit)");
	}
	if (rawDates.length === 0 || rawDates.length > 31) {
		throw new HttpError(400, "Pilih 1–31 tanggal kandidat");
	}
	const today = todayLocal();
	const dates: CandidateDate[] = [];
	const seen = new Set<string>();
	for (const raw of rawDates as Record<string, unknown>[]) {
		const date = String(raw?.date ?? "");
		const startMinute = Number(raw?.startMinute ?? -1);
		const endMinute = Number(raw?.endMinute ?? -1);
		if (!isValidDate(date)) throw new HttpError(400, "Tanggal kandidat tidak valid");
		if (date < today) throw new HttpError(400, "Tanggal kandidat sudah lewat");
		if (
			!Number.isInteger(startMinute) ||
			!Number.isInteger(endMinute) ||
			startMinute < 0 ||
			endMinute > 1440 ||
			startMinute % 30 !== 0 ||
			endMinute % 30 !== 0
		) {
			throw new HttpError(400, "Rentang jam harus kelipatan 30 menit");
		}
		if (endMinute - startMinute < durationMinutes) {
			throw new HttpError(
				400,
				"Rentang jam terlalu pendek untuk durasi event",
			);
		}
		if (seen.has(date)) throw new HttpError(400, "Tanggal kandidat duplikat");
		seen.add(date);
		dates.push({ date, startMinute, endMinute });
	}
	dates.sort((a, b) => a.date.localeCompare(b.date));

	if (participantIds.length === 0) {
		throw new HttpError(400, "Pilih minimal satu peserta");
	}
	const placeholders = participantIds.map(() => "?").join(",");
	const found = db
		.query<{ id: string }, string[]>(
			`SELECT id FROM users WHERE id IN (${placeholders})`,
		)
		.all(...participantIds);
	if (found.length !== participantIds.length) {
		throw new HttpError(400, "Ada peserta yang tidak ditemukan");
	}

	return {
		title,
		description: description || null,
		durationMinutes,
		timezone,
		participantIds,
		dates,
		showRecap,
	};
}

function writeDates(eventId: string, dates: CandidateDate[]) {
	db.query("DELETE FROM event_dates WHERE event_id = ?").run(eventId);
	const insert = db.query(
		"INSERT INTO event_dates (id, event_id, candidate_date, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
	);
	for (const item of dates) {
		insert.run(uid(), eventId, item.date, item.startMinute, item.endMinute);
	}
}

/** Respons yang menunjuk slot yang tidak lagi ada setelah event diubah. */
function pruneResponses(eventId: string, validKeys: Set<string>) {
	const rows = db
		.query<{ slot_key: string }, [string]>(
			"SELECT DISTINCT slot_key FROM event_responses WHERE event_id = ?",
		)
		.all(eventId);
	for (const row of rows) {
		if (!validKeys.has(row.slot_key)) {
			db.query("DELETE FROM event_responses WHERE event_id = ? AND slot_key = ?").run(
				eventId,
				row.slot_key,
			);
		}
	}
}

export function listEvents(c: Context) {
	const user = c.get("user") as AppUser;
	const rows = db
		.query<EventRow, [string, string]>(
			`SELECT e.* FROM events e
			 JOIN event_participants p ON p.event_id = e.id
			 WHERE p.user_id = ?
			 ORDER BY CASE e.status WHEN 'open' THEN 0 WHEN 'finalized' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
			          e.created_at DESC`,
		)
		.all(user.id);
	return { data: { events: rows.map((row) => summarize(row, user.id)) } };
}

export function detailEvent(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	const event = loadEvent(id);
	const participant = requireParticipant(id, user.id);
	const dates = datesOf(id);
	const slots = generateSlots(event.duration_minutes, dates);
	const participants = participantsOf(id);
	const invited = participants.filter((p) => p.role === "peserta");
	const responses = responsesOf(id);
	const canSeeRecap =
		participant.role === "organizer" || event.show_recap === 1;

	const counts = new Map<string, { available: number; unavailable: number }>();
	for (const r of responses) {
		const slot = counts.get(r.slot_key) ?? { available: 0, unavailable: 0 };
		if (r.status === "available") slot.available += 1;
		else if (r.status === "unavailable") slot.unavailable += 1;
		counts.set(r.slot_key, slot);
	}
	const mine = new Map(
		responses
			.filter((r) => r.user_id === user.id)
			.map((r) => [r.slot_key, r.status]),
	);

	const availabilityRow = db
		.query<{ slots: string }, [string]>(
			"SELECT slots FROM weekly_availability WHERE user_id = ?",
		)
		.get(user.id);
	const weekly = availabilityRow
		? (JSON.parse(availabilityRow.slots) as number[])
		: Array(336).fill(1);
	const connection = db
		.query<{ status: string }, [string]>(
			"SELECT status FROM calendar_connections WHERE user_id = ?",
		)
		.get(user.id);
	const busy =
		connection?.status === "terhubung"
			? db
					.query<{ starts_at: string; ends_at: string }, [string]>(
						"SELECT starts_at, ends_at FROM busy_events WHERE user_id = ?",
					)
					.all(user.id)
			: [];

	const slotPayload = slots.map((slot) => {
		const c0 = counts.get(slot.key) ?? { available: 0, unavailable: 0 };
		const pending = invited.length - c0.available - c0.unavailable;
		const suggested =
			rangeAvailableWeekly(weekly, slot.date, slot.startMinute, slot.endMinute) &&
			!overlapsBusy(busy, slot.startsAt, slot.endsAt)
				? "available"
				: "unavailable";
		return {
			...slot,
			myStatus: mine.get(slot.key) ?? null,
			suggestedStatus: suggested,
			...(canSeeRecap
				? {
						counts: {
							available: c0.available,
							unavailable: c0.unavailable,
							pending: Math.max(0, pending),
							total: invited.length,
						},
					}
				: {}),
		};
	});

	const inserted = db
		.query<{ n: number }, [string, string]>(
			"SELECT COUNT(*) AS n FROM calendar_insertions WHERE event_id = ? AND user_id = ?",
		)
		.get(id, user.id);

	return {
		data: {
			...summarize(event, user.id),
			participants: participants.map((p) => ({
				id: p.user_id,
				name: p.name,
				email: p.email,
				role: p.role === "organizer" ? "organizer" : "participant",
				responded: Boolean(p.responded_at),
			})),
			dates,
			slots: slotPayload,
			finalSlotKey: event.final_slot_key,
			calendarConnected: connection?.status === "terhubung",
			calendarInserted: (inserted?.n ?? 0) > 0,
			canRespond: event.status === "open" && participant.role === "peserta",
		},
	};
}

export function createEvent(c: Context, body: Record<string, unknown> | null) {
	const user = c.get("user") as AppUser;
	const input = validateInput(body);
	const id = uid();
	const now = nowIso();
	const publish = body?.publish !== false;

	db.query(
		`INSERT INTO events (id, title, description, duration_minutes, timezone, status, show_recap, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		input.title,
		input.description,
		input.durationMinutes,
		input.timezone,
		publish ? "open" : "draft",
		input.showRecap ? 1 : 0,
		user.id,
		now,
		now,
	);
	db.query(
		"INSERT INTO event_participants (event_id, user_id, role, invited_at) VALUES (?, ?, 'organizer', ?)",
	).run(id, user.id, now);
	const insertParticipant = db.query(
		"INSERT INTO event_participants (event_id, user_id, role, invited_at) VALUES (?, ?, 'peserta', ?)",
	);
	for (const participantId of input.participantIds) {
		if (participantId !== user.id) insertParticipant.run(id, participantId, now);
	}
	writeDates(id, input.dates);

	return {
		status: 201,
		message: publish ? "Event dipublikasikan" : "Draft event disimpan",
		data: detailEvent(c, id).data,
	};
}

export function updateEvent(
	c: Context,
	id: string,
	body: Record<string, unknown> | null,
) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status === "finalized" || event.status === "cancelled") {
		throw new HttpError(400, "Event yang sudah final atau dibatalkan tidak dapat diubah");
	}
	const input = validateInput(body);
	const now = nowIso();
	db.query(
		`UPDATE events SET title = ?, description = ?, duration_minutes = ?, timezone = ?,
		 show_recap = ?, updated_at = ? WHERE id = ?`,
	).run(
		input.title,
		input.description,
		input.durationMinutes,
		input.timezone,
		input.showRecap ? 1 : 0,
		now,
		id,
	);
	writeDates(id, input.dates);
	db.query("DELETE FROM event_participants WHERE event_id = ? AND role = 'peserta'").run(id);
	const insert = db.query(
		"INSERT INTO event_participants (event_id, user_id, role, invited_at) VALUES (?, ?, 'peserta', ?)",
	);
	for (const participantId of input.participantIds) {
		if (participantId !== user.id) insert.run(id, participantId, now);
	}
	const valid = new Set(
		generateSlots(input.durationMinutes, input.dates).map((s) => s.key),
	);
	pruneResponses(id, valid);

	return { message: "Event diperbarui", data: detailEvent(c, id).data };
}

export function publishEvent(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status === "cancelled") {
		throw new HttpError(400, "Event sudah dibatalkan");
	}
	db.query("UPDATE events SET status = 'open', updated_at = ? WHERE id = ?").run(
		nowIso(),
		id,
	);
	return { message: "Event dipublikasikan", data: detailEvent(c, id).data };
}

export function respondEvent(
	c: Context,
	id: string,
	body: Record<string, unknown> | null,
) {
	const user = c.get("user") as AppUser;
	const event = loadEvent(id);
	const participant = requireParticipant(id, user.id);
	if (participant.role !== "peserta") {
		throw new HttpError(403, "Pembuat event tidak mengisi respons peserta");
	}
	if (event.status !== "open") {
		throw new HttpError(400, "Event tidak sedang menerima respons");
	}
	const valid = new Set(
		generateSlots(event.duration_minutes, datesOf(id)).map((s) => s.key),
	);
	const responses = Array.isArray(body?.responses) ? body.responses : [];
	if (responses.length === 0) {
		throw new HttpError(400, "Respons masih kosong");
	}
	const now = nowIso();
	const upsert = db.query(
		`INSERT INTO event_responses (event_id, user_id, slot_key, status, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(event_id, user_id, slot_key) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
	);
	let saved = 0;
	for (const raw of responses as Record<string, unknown>[]) {
		const key = String(raw?.slotKey ?? "");
		const value = String(raw?.status ?? "");
		if (!valid.has(key)) throw new HttpError(400, "Kandidat waktu tidak dikenal");
		if (value !== "available" && value !== "unavailable") {
			throw new HttpError(400, "Status respons harus available atau unavailable");
		}
		upsert.run(id, user.id, key, value, now);
		saved += 1;
	}
	db.query(
		"UPDATE event_participants SET responded_at = ? WHERE event_id = ? AND user_id = ?",
	).run(now, id, user.id);
	return {
		message: `Respons tersimpan (${saved} kandidat)`,
		data: detailEvent(c, id).data,
	};
}

export function finalizeEvent(
	c: Context,
	id: string,
	body: Record<string, unknown> | null,
) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status !== "open") {
		throw new HttpError(400, "Event belum menerima respons atau sudah final");
	}
	const key = String(body?.slotKey ?? "");
	const slot = generateSlots(event.duration_minutes, datesOf(id)).find(
		(s) => s.key === key,
	);
	if (!slot) throw new HttpError(400, "Kandidat waktu tidak ditemukan");
	db.query(
		"UPDATE events SET status = 'finalized', final_slot_key = ?, final_starts_at = ?, final_ends_at = ?, updated_at = ? WHERE id = ?",
	).run(slot.key, slot.startsAt, slot.endsAt, nowIso(), id);
	return { message: "Jadwal final ditetapkan", data: detailEvent(c, id).data };
}

export function reopenEvent(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status !== "finalized") {
		throw new HttpError(400, "Hanya event final yang dapat dibuka kembali");
	}
	db.query(
		"UPDATE events SET status = 'open', final_slot_key = NULL, final_starts_at = NULL, final_ends_at = NULL, updated_at = ? WHERE id = ?",
	).run(nowIso(), id);
	return { message: "Event dibuka kembali untuk respons", data: detailEvent(c, id).data };
}

export function cancelEvent(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status === "cancelled") {
		throw new HttpError(400, "Event sudah dibatalkan");
	}
	db.query(
		"UPDATE events SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
	).run(nowIso(), nowIso(), id);
	return { message: "Event dibatalkan", data: detailEvent(c, id).data };
}

export function remindEvent(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	requireOrganizer(id, user.id);
	const event = loadEvent(id);
	if (event.status !== "open") {
		throw new HttpError(400, "Pengingat hanya untuk event yang masih terbuka");
	}
	const pending = db
		.query<{ user_id: string }, [string]>(
			"SELECT user_id FROM event_participants WHERE event_id = ? AND role = 'peserta' AND responded_at IS NULL",
		)
		.all(id);
	const now = nowIso();
	const update = db.query(
		"UPDATE event_participants SET reminded_at = ? WHERE event_id = ? AND user_id = ?",
	);
	for (const row of pending) update.run(now, id, row.user_id);
	return {
		message: pending.length
			? `Pengingat dikirim ke ${pending.length} peserta (simulasi)`
			: "Semua peserta sudah merespons",
		data: { reminded: pending.length },
	};
}

export function addToCalendar(c: Context, id: string) {
	const user = c.get("user") as AppUser;
	const event = loadEvent(id);
	requireParticipant(id, user.id);
	if (event.status !== "finalized") {
		throw new HttpError(400, "Jadwal final belum ditetapkan");
	}
	const connection = db
		.query<{ status: string }, [string]>(
			"SELECT status FROM calendar_connections WHERE user_id = ?",
		)
		.get(user.id);
	if (!connection || connection.status !== "terhubung") {
		throw new HttpError(400, "Hubungkan Google Calendar terlebih dahulu");
	}
	const existing = db
		.query<{ n: number }, [string, string]>(
			"SELECT COUNT(*) AS n FROM calendar_insertions WHERE event_id = ? AND user_id = ?",
		)
		.get(id, user.id);
	if ((existing?.n ?? 0) > 0) {
		return {
			message: "Jadwal ini sudah ada di Google Calendar",
			data: { alreadyAdded: true },
		};
	}
	db.query(
		"INSERT INTO calendar_insertions (event_id, user_id, inserted_at) VALUES (?, ?, ?)",
	).run(id, user.id, nowIso());
	return {
		message: "Jadwal ditambahkan ke Google Calendar (simulasi demo)",
		data: { alreadyAdded: false },
	};
}

export function parseId(c: Context): string {
	const id = c.req.param("id");
	if (!id) throw new HttpError(400, "ID event tidak valid");
	return id;
}

export function isKnownStatus(value: string): boolean {
	return EVENT_STATUSES.has(value);
}
