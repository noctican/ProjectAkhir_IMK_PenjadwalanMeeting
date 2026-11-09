import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
	id: string;
	message: string;
	tone: ToastTone;
	actionLabel?: string;
	onAction?: () => void;
};

type ToastState = {
	toasts: Toast[];
	push: (
		message: string,
		options?: {
			tone?: ToastTone;
			actionLabel?: string;
			onAction?: () => void;
			duration?: number;
		},
	) => void;
	dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
	toasts: [],
	push(message, options) {
		const id = crypto.randomUUID();
		const toast: Toast = {
			id,
			message,
			tone: options?.tone ?? "success",
			actionLabel: options?.actionLabel,
			onAction: options?.onAction,
		};
		set((state) => ({ toasts: [...state.toasts, toast].slice(-3) }));
		window.setTimeout(() => get().dismiss(id), options?.duration ?? 5000);
	},
	dismiss(id) {
		set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
	},
}));

export function notify(
	message: string,
	options?: Parameters<ToastState["push"]>[1],
) {
	useToastStore.getState().push(message, options);
}
