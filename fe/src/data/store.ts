import { create } from "zustand";
import { checkBackend, providerFor } from "./provider";
import type { User } from "./types";
import { bumpDataVersion } from "./version";

export type AppMode = "checking" | "api" | "local";

type AppState = {
	mode: AppMode;
	user: User | null;
	ready: boolean;
	connectionLost: boolean;
	bootstrap: () => Promise<void>;
	login: (email: string, password: string) => Promise<User>;
	register: (
		name: string,
		email: string,
		password: string,
	) => Promise<void>;
	logout: () => Promise<void>;
	switchToLocal: () => Promise<void>;
	retryBackend: () => Promise<boolean>;
	markConnectionLost: () => void;
};

let bootStarted = false;

export const useAppStore = create<AppState>((set, get) => ({
	mode: "checking",
	user: null,
	ready: false,
	connectionLost: false,

	async bootstrap() {
		if (bootStarted) return;
		bootStarted = true;
		const resolved: "api" | "local" = (await checkBackend()) ? "api" : "local";
		set({ mode: resolved });
		try {
			const user = await providerFor(resolved).getSession();
			set({ user, ready: true });
		} catch {
			if (resolved === "api") {
				const user = await providerFor("local").getSession().catch(() => null);
				set({ mode: "local", user, ready: true, connectionLost: true });
			} else {
				set({ user: null, ready: true });
			}
		}
	},

	async login(email, password) {
		const user = await providerFor(get().mode === "api" ? "api" : "local").login(email, password);
		set({ user });
		return user;
	},

	async register(name, email, password) {
		const provider = providerFor(get().mode === "api" ? "api" : "local");
		await provider.register(name, email, password);
		const user = await provider.getSession();
		set({ user });
	},

	async logout() {
		await providerFor(get().mode === "api" ? "api" : "local").logout();
		set({ user: null });
	},

	async switchToLocal() {
		const user = await providerFor("local").getSession().catch(() => null);
		set({ mode: "local", user, ready: true, connectionLost: false });
	},

	async retryBackend() {
		const ok = await checkBackend();
		if (!ok) {
			set({ connectionLost: true });
			return false;
		}
		set({ mode: "api" });
		try {
			const user = await providerFor("api").getSession();
			set({ user, ready: true, connectionLost: false });
		} catch {
			set({ user: null, ready: true, connectionLost: false });
		}
		bumpDataVersion();
		return true;
	},

	markConnectionLost() {
		set({ connectionLost: true });
	},
}));

export function useMode(): AppMode {
	return useAppStore((state) => state.mode);
}
