import { apiProvider } from "./api";
import { localProvider } from "./local";
import type { DataProvider } from "./types";

export function providerFor(mode: "api" | "local"): DataProvider {
	return mode === "api" ? apiProvider : localProvider;
}

/** Health check ringan; hanya untuk memilih sumber data saat aplikasi dibuka. */
export async function checkBackend(): Promise<boolean> {
	if (typeof window === "undefined") return true;
	try {
		const res = await fetch("/api/health", {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) return false;
		const body = (await res.json()) as { success?: boolean };
		return body.success === true;
	} catch {
		return false;
	}
}
