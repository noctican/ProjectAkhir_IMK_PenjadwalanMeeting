export const config = {
	port: Number(process.env.PORT || 8080),
	// Bind ke loopback: backend hanya dijangkau lewat proxy SSR frontend (BFF).
	host: process.env.HOST || "127.0.0.1",
	jwtSecret: process.env.JWT_SECRET || "temuyuk-dev-secret",
	cookieName: "temuyuk_token",
	corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
	dbFile: process.env.DB_FILE || "data/temuyuk.db",
	// Presisi slot aplikasi: 30 menit, 48 slot per hari.
	slotStepMinutes: 30,
	slotsPerDay: 48,
	// Zona waktu yang dipakai untuk membentuk waktu kandidat.
	timezoneOffset: process.env.TIMEZONE_OFFSET || "+07:00",
};
