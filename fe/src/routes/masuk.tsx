import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ChevronRight, WifiOff } from "lucide-react";
import { useState } from "react";
import { CalendarCard } from "@/components/calendar-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppStore } from "@/data/store";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/data/seed";

export const Route = createFileRoute("/masuk")({
	component: MasukPage,
});

type Tab = "masuk" | "daftar";

function MasukPage() {
	const user = useAppStore((s) => s.user);
	const ready = useAppStore((s) => s.ready);
	const mode = useAppStore((s) => s.mode);
	const login = useAppStore((s) => s.login);
	const register = useAppStore((s) => s.register);
	const navigate = useNavigate();

	const [tab, setTab] = useState<Tab>("masuk");
	const [stage, setStage] = useState<"auth" | "calendar">("auth");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	if (!ready) {
		return (
			<div className="login relative">
				<div className="login-intro">
					<p className="muted">Memuat TemuYuk…</p>
				</div>
			</div>
		);
	}
	if (user && stage !== "calendar") return <Navigate to="/" />;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			if (tab === "masuk") {
				await login(email.trim(), password);
			} else {
				await register(name.trim(), email.trim(), password);
			}
			setStage("calendar");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal masuk. Coba lagi.");
		} finally {
			setPending(false);
		}
	}

	function fillDemo(demoEmail: string) {
		setTab("masuk");
		setEmail(demoEmail);
		setPassword(DEMO_PASSWORD);
		setError(null);
	}

	return (
		<div className="login relative">
			<div className="absolute right-5 top-5 z-10">
				<ThemeToggle />
			</div>
			<section className="login-intro">
				<Link to="/masuk" className="login-brand">
					<span className="brand-mark">T</span>
					<span className="brand-name">TemuYuk</span>
				</Link>

				<div className="login-hero">
					<h1>Cari waktu yang cocok untuk semua.</h1>
					<p className="page-sub">
						TemuYuk menyatukan jadwal rutin dan kalender anggota, lalu
						menunjukkan kandidat waktu rapat yang paling banyak bisa dihadiri.
					</p>
					<ol className="login-steps">
						<li>
							<span>Atur jadwal mingguan sekali, pakai berulang kali.</span>
						</li>
						<li>
							<span>Buat event dan tentukan kandidat tanggal.</span>
						</li>
						<li>
							<span>Lihat siapa yang bisa hadir sebelum menetapkan jadwal.</span>
						</li>
					</ol>
				</div>

				<p className="login-foot">
					{mode === "local" ? (
						<>
							<WifiOff size={14} aria-hidden="true" /> Mode lokal aktif — data
							disimpan di perangkat ini.
						</>
					) : (
						"TemuYuk · Cari waktu yang pas."
					)}
				</p>
			</section>

			<section className="login-panel">
				<div className="auth-card">
					{stage === "auth" ? (
						<>
							<h2 className="auth-title">
								{tab === "masuk" ? "Masuk ke akunmu" : "Buat akun baru"}
							</h2>
							<p className="auth-sub">
								{tab === "masuk"
									? "Lanjutkan pengaturan jadwal dan event organisasimu."
									: "Akun dipakai untuk menyimpan jadwal rutin mingguanmu."}
							</p>

							<div className="tabs" role="tablist" aria-label="Pilihan masuk atau daftar">
								<button
									type="button"
									role="tab"
									className="tab"
									aria-selected={tab === "masuk"}
									onClick={() => {
										setTab("masuk");
										setError(null);
									}}
								>
									Masuk
								</button>
								<button
									type="button"
									role="tab"
									className="tab"
									aria-selected={tab === "daftar"}
									onClick={() => {
										setTab("daftar");
										setError(null);
									}}
								>
									Daftar
								</button>
							</div>

							<form className="auth-form" onSubmit={handleSubmit}>
								{tab === "daftar" ? (
									<label className="field">
										<span>Nama lengkap</span>
										<input
											className="input"
											value={name}
											onChange={(e) => setName(e.target.value)}
											autoComplete="name"
											required
											placeholder="Nama kamu"
										/>
									</label>
								) : null}
								<label className="field">
									<span>Email</span>
									<input
										className="input"
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										autoComplete="email"
										required
										placeholder="nama@filkom.ub.ac.id"
									/>
								</label>
								<label className="field">
									<span>Kata sandi</span>
									<input
										className="input"
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										autoComplete={
											tab === "masuk" ? "current-password" : "new-password"
										}
										required
										minLength={tab === "daftar" ? 8 : undefined}
										placeholder={
											tab === "daftar" ? "Minimal 8 karakter" : "Kata sandi"
										}
									/>
									{tab === "daftar" ? (
										<span className="hint">Gunakan minimal 8 karakter.</span>
									) : null}
								</label>

								{error ? (
									<p className="error-text" role="alert">
										{error}
									</p>
								) : null}

								<button
									type="submit"
									className="btn primary w-full"
									disabled={pending}
								>
									{pending ? <span className="spinner" /> : null}
									{tab === "masuk" ? "Masuk" : "Buat akun"}
								</button>
							</form>

							<div className="demo-line">
								<span className="demo-label">Akun demo: </span>
								{DEMO_ACCOUNTS.map((account) => (
									<button
										key={account.email}
										type="button"
										className="demo-chip"
										onClick={() => fillDemo(account.email)}
									>
										{account.label}
									</button>
								))}
							</div>

							<p className="login-note">
								Hubungkan Google Calendar di Jadwal Saya agar jadwal sibuk ikut
								dipertimbangkan. Kamu tetap bisa mengatur jadwal secara manual.
							</p>
						</>
					) : (
						<>
							<h2 className="auth-title">Hubungkan kalender?</h2>
							<p className="auth-sub">
								Kalender membantu mengisi ketersediaanmu lebih cepat. Langkah ini
								opsional dan bisa dilakukan nanti di Jadwal Saya.
							</p>
							<CalendarCard />
							<div className="calendar-choice">
								<button
									type="button"
									className="btn primary"
									onClick={() => navigate({ to: "/" })}
								>
									Lanjut ke dasbor
									<ChevronRight size={16} aria-hidden="true" />
								</button>
								<button
									type="button"
									className="btn ghost"
									onClick={() => navigate({ to: "/" })}
								>
									Lewati dulu
								</button>
							</div>
						</>
					)}
				</div>
			</section>
		</div>
	);
}
