import type { ApiResponse } from "@/data/types";

export class ConnectionError extends Error {
	constructor(message = "Koneksi ke server terputus.") {
		super(message);
		this.name = "ConnectionError";
	}
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

/**
 * Klien API: semua request ke origin frontend (`/api/...`) lalu diproxy
 * server SSR ke backend lokal (routes/api/$.tsx). Auth memakai cookie
 * HttpOnly yang otomatis terkirim.
 */
async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<ApiResponse<T>> {
	let res: Response;
	try {
		res = await fetch(`/api${path}`, {
			credentials: "same-origin",
			headers: {
				Accept: "application/json",
				...(init?.body ? { "Content-Type": "application/json" } : {}),
				...init?.headers,
			},
			...init,
		});
	} catch {
		throw new ConnectionError();
	}
	let payload: ApiResponse<T> = {
		success: false,
		message: "Respons tidak valid",
	};
	try {
		payload = (await res.json()) as ApiResponse<T>;
	} catch {
		payload = {
			success: false,
			message: `Permintaan gagal (${res.status})`,
		};
	}
	if (res.status === 502) {
		throw new ConnectionError(
			payload.message || "Layanan backend sedang tidak tersedia.",
		);
	}
	if (!res.ok || !payload.success) {
		throw new ApiError(
			res.status,
			payload.message || `Permintaan gagal (${res.status})`,
		);
	}
	return payload;
}

export const api = {
	get: <T,>(path: string) => request<T>(path),
	post: <T,>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "POST",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	patch: <T,>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PATCH",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	put: <T,>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PUT",
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
};

export function qs(params: Record<string, string | number | undefined>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	const str = search.toString();
	return str ? `?${str}` : "";
}
