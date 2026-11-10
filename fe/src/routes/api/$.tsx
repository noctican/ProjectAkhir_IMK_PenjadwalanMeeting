import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

/**
 * BFF proxy: seluruh request /api/* diteruskan server SSR ke backend lokal
 * (BE_INTERNAL_URL). Browser hanya bicara dengan satu origin.
 */
const BE_INTERNAL_URL =
	(process.env.BE_INTERNAL_URL as string | undefined)?.replace(/\/$/, "") ||
	"http://127.0.0.1:8080";

async function proxy(request: Request) {
	const incoming = new URL(request.url);
	const target = `${BE_INTERNAL_URL}${incoming.pathname}${incoming.search}`;

	const headers = new Headers();
	for (const name of [
		"authorization",
		"content-type",
		"accept",
		"cookie",
		"x-forwarded-proto",
		"x-forwarded-for",
	]) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}

	const isBodyMethod = !["GET", "HEAD"].includes(request.method);

	try {
		const upstream = await fetch(target, {
			method: request.method,
			headers,
			body: isBodyMethod ? await request.arrayBuffer() : undefined,
			// @ts-expect-error duplex dibutuhkan saat mengirim body di Node/Bun
			duplex: "half",
		});

		const responseHeaders = new Headers();
		for (const [name, value] of upstream.headers.entries()) {
			if (
				!["connection", "transfer-encoding", "keep-alive"].includes(
					name.toLowerCase(),
				)
			) {
				responseHeaders.set(name, value);
			}
		}

		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders,
		});
	} catch (err) {
		console.error("[api-proxy] Gagal menghubungi backend:", err);
		return new Response(
			JSON.stringify({
				success: false,
				message: "Layanan backend sedang tidak tersedia. Silakan coba lagi.",
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			GET: ({ request }) => proxy(request),
			POST: ({ request }) => proxy(request),
			PUT: ({ request }) => proxy(request),
			PATCH: ({ request }) => proxy(request),
			DELETE: ({ request }) => proxy(request),
			OPTIONS: ({ request }) => proxy(request),
		},
	},
});
