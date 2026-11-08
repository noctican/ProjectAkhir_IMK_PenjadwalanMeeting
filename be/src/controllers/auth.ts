import type { Context } from "hono";
import { db, nowIso, uid } from "../db";
import { HttpError } from "./http-error";
import { hashPassword, verifyPassword } from "../services/password";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserRow = {
	id: string;
	name: string;
	email: string;
	password_hash: string;
	role: string;
	created_at: string;
};

const ALL_AVAILABLE = JSON.stringify(Array(336).fill(1));

export async function register(body: Record<string, unknown> | null) {
	const name = String(body?.name ?? "").trim();
	const email = String(body?.email ?? "").trim().toLowerCase();
	const password = String(body?.password ?? "");

	if (!name || !email || !password) {
		throw new HttpError(400, "Nama, email, dan kata sandi wajib diisi");
	}
	if (!emailRegex.test(email)) {
		throw new HttpError(400, "Format email tidak valid");
	}
	if (password.length < 8) {
		throw new HttpError(400, "Kata sandi minimal 8 karakter");
	}

	const existing = db
		.query<{ id: string }, [string]>("SELECT id FROM users WHERE email = ?")
		.get(email);
	if (existing) throw new HttpError(400, "Email sudah terdaftar");

	const id = uid();
	db.query(
		"INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	).run(id, name, email, await hashPassword(password), "anggota", nowIso());

	db.query(
		"INSERT INTO weekly_availability (user_id, slots, updated_at) VALUES (?, ?, ?)",
	).run(id, ALL_AVAILABLE, nowIso());

	return {
		status: 201,
		message: "Registrasi berhasil, silakan masuk",
		data: { id, name, email },
	};
}

export async function login(body: Record<string, unknown> | null) {
	const email = String(body?.email ?? "").trim().toLowerCase();
	const password = String(body?.password ?? "");
	if (!email || !password) {
		throw new HttpError(400, "Email dan kata sandi wajib diisi");
	}
	const row = db
		.query<UserRow, [string]>("SELECT * FROM users WHERE email = ?")
		.get(email);
	if (!row || !(await verifyPassword(password, row.password_hash))) {
		throw new HttpError(401, "Email atau kata sandi salah");
	}
	return {
		message: "Berhasil masuk",
		data: {
			user: {
				id: row.id,
				name: row.name,
				email: row.email,
				role: row.role,
			},
		},
	};
}

export function me(c: Context) {
	return { data: c.get("user") };
}
