import {
	CalendarDays,
	CalendarClock,
	LayoutDashboard,
	LogOut,
	Plus,
	WifiOff,
} from "lucide-react";
import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/data/store";
import { notify } from "@/data/ui-store";
import { Avatar, Toasts } from "./ui";

function FullScreen({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				color: "var(--muted)",
				fontSize: 13,
			}}
		>
			{children}
		</div>
	);
}

const NAV = [
	{ to: "/", label: "Dasbor", icon: LayoutDashboard },
	{ to: "/jadwal", label: "Jadwal Saya", icon: CalendarClock },
	{ to: "/event/baru", label: "Buat Event", icon: Plus },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
	const user = useAppStore((state) => state.user);
	const ready = useAppStore((state) => state.ready);
	const mode = useAppStore((state) => state.mode);
	const connectionLost = useAppStore((state) => state.connectionLost);
	const logout = useAppStore((state) => state.logout);
	const retryBackend = useAppStore((state) => state.retryBackend);
	const switchToLocal = useAppStore((state) => state.switchToLocal);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const navigate = useNavigate();

	useEffect(() => {
		document.title = "TemuYuk — Cari waktu yang pas";
	}, []);

	if (!ready) return <FullScreen>Memuat TemuYuk…</FullScreen>;
	if (!user) return <Navigate to="/masuk" />;

	async function handleLogout() {
		await logout();
		navigate({ to: "/masuk" });
	}

	async function handleRetry() {
		const ok = await retryBackend();
		notify(
			ok ? "Terhubung kembali ke server." : "Server masih belum dapat dihubungi.",
			{ tone: ok ? "success" : "error" },
		);
	}

	async function handleLocal() {
		await switchToLocal();
		notify("Berpindah ke mode demo lokal.", { tone: "info" });
	}

	const banner =
		connectionLost && mode === "api" ? (
			<div className="banner error" role="alert">
				<WifiOff />
				<span>
					Koneksi ke server terputus. Data terakhir tetap ditampilkan, tetapi
					perubahan belum bisa disimpan ke server.
				</span>
				<div className="banner-actions">
					<button type="button" className="btn small ghost" onClick={handleRetry}>
						Coba lagi
					</button>
					<button type="button" className="btn small dark" onClick={handleLocal}>
						Pakai mode lokal
					</button>
				</div>
			</div>
		) : mode === "local" ? (
			<output className="banner">
				<WifiOff />
				<span>
					Mode Demo — perubahan disimpan di perangkat ini dan tidak dikirim ke
					server.
				</span>
				<div className="banner-actions">
					<button type="button" className="btn small ghost" onClick={handleRetry}>
						Coba sambungkan server
					</button>
				</div>
			</output>
		) : null;

	return (
		<div className="app">
			<aside className="sidebar">
				<Link to="/" className="brand" aria-label="TemuYuk, ke dasbor">
					<span className="brand-mark">T</span>
					<span>
						<span className="brand-name">TemuYuk</span>
						<span className="brand-tag">Cari waktu yang pas.</span>
					</span>
				</Link>

				<nav className="nav" aria-label="Navigasi utama">
					<span className="nav-label">Ruang kerja</span>
					{NAV.map((item) => {
						const active =
							item.to === "/"
								? pathname === "/"
								: pathname.startsWith(item.to);
						const Icon = item.icon;
						return (
							<Link
								key={item.to}
								to={item.to}
								className={`nav-link${active ? " active" : ""}`}
							>
								<Icon />
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="sidebar-foot">
					<div className="mode-chip" data-mode={mode}>
						<span className="mode-dot" />
						{mode === "local" ? "Mode demo lokal" : "Terhubung ke server"}
					</div>
					<div className="user-card">
						<Avatar name={user.name} />
						<div style={{ minWidth: 0 }}>
							<div className="user-name">{user.name}</div>
							<div className="user-role">{user.role}</div>
						</div>
						<button
							type="button"
							className="icon-btn"
							onClick={handleLogout}
							aria-label="Keluar"
							title="Keluar"
						>
							<LogOut size={16} />
						</button>
					</div>
				</div>
			</aside>

			<div className="main">
				<header className="mobile-bar">
					<Link to="/" className="brand" aria-label="TemuYuk, ke dasbor">
						<span className="brand-mark">T</span>
						<span className="brand-name">TemuYuk</span>
					</Link>
					<nav className="mobile-nav" aria-label="Navigasi">
						{NAV.map((item) => {
							const active =
								item.to === "/"
									? pathname === "/"
									: pathname.startsWith(item.to);
							const Icon = item.icon;
							return (
								<Link
									key={item.to}
									to={item.to}
									className={active ? "active" : ""}
									aria-label={item.label}
								>
									<Icon />
								</Link>
							);
						})}
						<button type="button" onClick={handleLogout} aria-label="Keluar">
							<LogOut size={16} />
						</button>
					</nav>
				</header>

				{banner ? <div className="banner-wrap">{banner}</div> : null}
				{children}
				<footer
					style={{
						padding: "0 32px 28px",
						fontSize: 12,
						color: "var(--muted)",
						display: "flex",
						gap: 8,
						alignItems: "center",
					}}
				>
					<CalendarDays size={14} />
					TemuYuk · Cari waktu yang pas untuk semua. Integrasi Google Calendar
					pada versi ini berupa simulasi.
				</footer>
			</div>
			<Toasts />
		</div>
	);
}

export function useCurrentUser() {
	const user = useAppStore((state) => state.user);
	if (!user) throw new Error("Pengguna belum masuk");
	return user;
}
