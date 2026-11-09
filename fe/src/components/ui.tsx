import { Check, CircleAlert } from "lucide-react";
import { useEffect } from "react";
import type { EventStatus } from "@/data/types";
import { useToastStore } from "@/data/ui-store";

const STATUS_LABEL: Record<EventStatus, string> = {
	draft: "Draf",
	open: "Menunggu respons",
	finalized: "Jadwal final",
	cancelled: "Dibatalkan",
};

export function StatusBadge({ status }: { status: EventStatus }) {
	return (
		<span className={`badge ${status}`}>
			{STATUS_LABEL[status]}
		</span>
	);
}

export function initials(name: string): string {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function Avatar({ name }: { name: string }) {
	return (
		<span className="avatar" aria-hidden="true">
			{initials(name)}
		</span>
	);
}

export function ErrorBox({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	return (
		<div className="banner error" role="alert">
			<CircleAlert />
			<span>{message}</span>
			{onRetry ? (
				<div className="banner-actions">
					<button type="button" className="btn small ghost" onClick={onRetry}>
						Coba lagi
					</button>
				</div>
			) : null}
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="empty">
			<strong>{title}</strong>
			{description}
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	tone = "primary",
	pending = false,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	tone?: "primary" | "danger" | "dark";
	pending?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	useEffect(() => {
		if (!open) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onCancel]);

	if (!open) return null;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: klik latar menutup dialog, Escape juga tersedia
		<div
			className="dialog-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<div
				className="dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="dialog-title"
			>
				<h2 id="dialog-title">{title}</h2>
				<p>{description}</p>
				<div className="dialog-actions">
					<button type="button" className="btn ghost" onClick={onCancel}>
						Batal
					</button>
					<button
						type="button"
						className={`btn ${tone}`}
						onClick={onConfirm}
						disabled={pending}
					>
						{pending ? <span className="spinner" /> : null}
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

export function Toasts() {
	const toasts = useToastStore((state) => state.toasts);
	const dismiss = useToastStore((state) => state.dismiss);
	return (
		<div className="toasts" aria-live="polite">
			{toasts.map((toast) => (
				<div key={toast.id} className={`toast ${toast.tone}`}>
					{toast.tone === "success" ? <Check /> : <CircleAlert />}
					<span>{toast.message}</span>
					{toast.actionLabel && toast.onAction ? (
						<button
							type="button"
							onClick={() => {
								toast.onAction?.();
								dismiss(toast.id);
							}}
						>
							{toast.actionLabel}
						</button>
					) : null}
				</div>
			))}
		</div>
	);
}
