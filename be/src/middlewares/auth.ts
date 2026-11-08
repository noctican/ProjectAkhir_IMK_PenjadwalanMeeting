import { Hono } from "hono";
import type { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { config } from "../config";
import { db } from "../db";

export type AppUser = {
	id: string;
	name: string;
	email: string;
	role: string;
};

export type AppVariables = { user: AppUser };

export const appRouter = () => new Hono<{ Variables: AppVariables }>();

export async function createToken(user: AppUser): Promise<string> {
	return sign(
		{ id: user.id, role: user.role, name: user.name },
		config.jwtSecret,
		"HS256",
	);
}

export async function verifyToken(token: string) {
	try {
		return await verify(token, config.jwtSecret, "HS256");
	} catch {
		return null;
	}
}

function isSecureRequest(c: Context): boolean {
	const proto = c.req.header("x-forwarded-proto");
	if (proto) return proto.split(",")[0].trim() === "https";
	return c.req.secure;
}

export function setAuthCookie(c: Context, token: string) {
	c.header(
		"Set-Cookie",
		[
			`${config.cookieName}=${token}`,
			"HttpOnly",
			isSecureRequest(c) ? "Secure" : "",
			"SameSite=Lax",
			"Path=/",
			`Max-Age=${60 * 60 * 24 * 7}`,
		]
			.filter(Boolean)
			.join("; "),
	);
}

export function clearAuthCookie(c: Context) {
	c.header(
		"Set-Cookie",
		[
			`${config.cookieName}=`,
			"HttpOnly",
			isSecureRequest(c) ? "Secure" : "",
			"SameSite=Lax",
			"Path=/",
			"Max-Age=0",
		]
			.filter(Boolean)
			.join("; "),
	);
}

export function getAuthToken(c: Context): string {
	const cookieHeader = c.req.header("Cookie") || "";
	const match = cookieHeader
		.split(";")
		.map((p) => p.trim())
		.find((p) => p.startsWith(`${config.cookieName}=`));
	if (match) return decodeURIComponent(match.slice(config.cookieName.length + 1));
	const header = c.req.header("Authorization") || "";
	return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function requireAuth(c: Context, next: any) {
	const token = getAuthToken(c);
	if (!token) {
		return c.json({ success: false, message: "Silakan masuk terlebih dahulu" }, 401);
	}
	const payload = await verifyToken(token);
	if (!payload) {
		return c.json({ success: false, message: "Sesi berakhir, silakan masuk lagi" }, 401);
	}
	const row = db
		.query<{ id: string; name: string; email: string; role: string }, [string]>(
			"SELECT id, name, email, role FROM users WHERE id = ?",
		)
		.get(payload.id as string);
	if (!row) {
		return c.json({ success: false, message: "Akun tidak ditemukan" }, 401);
	}
	c.set("user", row);
	await next();
}
