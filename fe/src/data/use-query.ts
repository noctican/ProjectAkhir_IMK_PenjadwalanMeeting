import { useCallback, useEffect, useState } from "react";
import { ConnectionError } from "@/lib/api";
import { providerFor } from "./provider";
import { useAppStore } from "./store";
import type { DataProvider } from "./types";
import { useDataVersion } from "./version";

export function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return "Terjadi kesalahan. Silakan coba lagi.";
}

export function useQuery<T>(
	fn: (provider: DataProvider) => Promise<T>,
	deps: unknown[] = [],
) {
	const mode = useAppStore((state) => state.mode);
	const version = useDataVersion((state) => state.version);
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [nonce, setNonce] = useState(0);
	const depKey = JSON.stringify(deps);

	const reload = useCallback(() => setNonce((value) => value + 1), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: query dijalankan ulang lewat kunci dependensi dan nonce
	useEffect(() => {
		if (mode === "checking") return;
		let alive = true;
		setLoading(true);
		setError(null);
		const provider = providerFor(mode === "api" ? "api" : "local");
		fn(provider)
			.then((result) => {
				if (alive) setData(result);
			})
			.catch((err: unknown) => {
				if (!alive) return;
				setError(errorMessage(err));
				if (err instanceof ConnectionError) {
					useAppStore.getState().markConnectionLost();
				}
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [mode, version, nonce, depKey]);

	return { data, error, loading, reload };
}

export function useAction() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run<T>(fn: (provider: DataProvider) => Promise<T>) {
		setPending(true);
		setError(null);
		try {
			return await fn(providerFor(useAppStore.getState().mode === "api" ? "api" : "local"));
		} catch (err) {
			setError(errorMessage(err));
			if (err instanceof ConnectionError) {
				useAppStore.getState().markConnectionLost();
			}
			return null;
		} finally {
			setPending(false);
		}
	}

	return { pending, error, setError, run };
}
