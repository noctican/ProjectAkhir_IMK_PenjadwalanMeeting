import type { Context } from "hono";
import { db, nowIso } from "../db";
import { HttpError } from "./http-error";
import type { AppUser } from "../middlewares/auth";

type Row = { slots: string; updated_at: string };

export function getAvailability(c: Context) {
	const user = c.get("user") as AppUser;
	const row = db
		.query<Row, [string]>(
			"SELECT slots, updated_at FROM weekly_availability WHERE user_id = ?",
		)
		.get(user.id);
	const slots = row ? (JSON.parse(row.slots) as number[]) : Array(336).fill(1);
	return {
		data: {
			slots: Array.isArray(slots) && slots.length === 336 ? slots : Array(336).fill(1),
			updatedAt: row?.updated_at ?? null,
		},
	};
}

export function saveAvailability(
	c: Context,
	body: Record<string, unknown> | null,
) {
	const user = c.get("user") as AppUser;
	const slots = body?.slots;
	if (
		!Array.isArray(slots) ||
		slots.length !== 336 ||
		slots.some((v) => v !== 0 && v !== 1)
	) {
		throw new HttpError(400, "Jadwal harus berisi 336 slot bernilai 0 atau 1");
	}
	const now = nowIso();
	db.query(
		`INSERT INTO weekly_availability (user_id, slots, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET slots = excluded.slots, updated_at = excluded.updated_at`,
	).run(user.id, JSON.stringify(slots), now);
	return { message: "Jadwal rutin disimpan ke akun", data: { updatedAt: now } };
}
