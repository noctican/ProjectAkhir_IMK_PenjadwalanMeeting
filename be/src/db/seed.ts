import { db, nowIso, runMigrations, uid } from "./index";
import { ensureMockBusy } from "../controllers/calendar";
import { generateSlots, minuteToIso, addDaysLocal, todayLocal } from "../services/scheduling";

runMigrations();

const PASSWORD = "temuyuk123";

const USERS = [
	{ id: "usr-candra", name: "Candra Andika Putra", email: "candra@filkom.ub.ac.id" },
	{ id: "usr-naufal", name: "Naufal Fadhil Arkani", email: "naufal@filkom.ub.ac.id" },
	{ id: "usr-bagas", name: "Bagas Zakaria", email: "bagas@filkom.ub.ac.id" },
	{ id: "usr-salsa", name: "Salsabila Putri", email: "salsa@filkom.ub.ac.id" },
	{ id: "usr-raka", name: "Raka Pratama", email: "raka@filkom.ub.ac.id" },
	{ id: "usr-dinda", name: "Dinda Ayu Kirana", email: "dinda@filkom.ub.ac.id" },
];

/** Blok sibuk rutin per pengguna: [hari 1=Senin..7=Minggu, jamMulai, jamSelesai]. */
const WEEKLY_BUSY: Record<string, [number, number, number][]> = {
	"usr-candra": [
		[1, 8, 12],
		[3, 13, 17],
		[5, 8, 10],
	],
	"usr-naufal": [
		[2, 7, 15],
		[4, 8, 12],
	],
	"usr-bagas": [
		[1, 7, 9],
		[2, 13, 17],
		[4, 13, 16],
		[5, 8, 11],
	],
	"usr-salsa": [
		[1, 10, 14],
		[3, 8, 12],
	],
	"usr-raka": [
		[2, 8, 11],
		[4, 15, 18],
	],
	"usr-dinda": [
		[1, 13, 16],
		[5, 9, 12],
	],
};

function weeklySlots(busy: [number, number, number][]): number[] {
	const slots = Array(336).fill(1);
	for (const [day, fromHour, toHour] of busy) {
		for (let minute = fromHour * 60; minute < toHour * 60; minute += 30) {
			slots[(day - 1) * 48 + minute / 30] = 0;
		}
	}
	return slots;
}

function dateOffset(days: number): string {
	return addDaysLocal(todayLocal(), days);
}

function clearAll() {
	for (const table of [
		"calendar_insertions",
		"event_responses",
		"event_participants",
		"event_dates",
		"events",
		"weekly_availability",
		"busy_events",
		"calendar_connections",
		"users",
	]) {
		db.query(`DELETE FROM ${table}`).run();
	}
}

const hash = await Bun.password.hash(PASSWORD, { algorithm: "argon2id" });

clearAll();

const insertUser = db.query(
	"INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'anggota', ?)",
);
const insertWeekly = db.query(
	"INSERT INTO weekly_availability (user_id, slots, updated_at) VALUES (?, ?, ?)",
);
const insertConnection = db.query(
	`INSERT INTO calendar_connections (user_id, provider, status, calendar_name, connected_at, last_synced_at)
	 VALUES (?, 'google', ?, ?, ?, ?)`,
);

const now = nowIso();
for (const user of USERS) {
	insertUser.run(user.id, user.name, user.email, hash, now);
	insertWeekly.run(user.id, JSON.stringify(weeklySlots(WEEKLY_BUSY[user.id] ?? [])), now);
	const connected = user.id === "usr-candra" || user.id === "usr-naufal";
	insertConnection.run(
		user.id,
		connected ? "terhubung" : "terputus",
		connected ? `Kalender ${user.name.split(" ")[0]}` : null,
		connected ? now : null,
		connected ? now : null,
	);
}

for (const user of USERS) ensureMockBusy(user.id);

type SeedEvent = {
	id: string;
	title: string;
	description: string;
	organizer: string;
	participants: string[];
	duration: number;
	showRecap: boolean;
	status: "draft" | "open" | "finalized" | "cancelled";
	dates: { date: string; startMinute: number; endMinute: number }[];
	responses: Record<string, (slotKey: string, order: number) => "available" | "unavailable">;
	finalKey?: string;
};

const EVENTS: SeedEvent[] = [
	{
		id: "evt-rapat-rutin",
		title: "Rapat Rutin BEM",
		description: "Koordinasi agenda bulanan pengurus dan evaluasi program kerja berjalan.",
		organizer: "usr-candra",
		participants: ["usr-naufal", "usr-bagas", "usr-salsa", "usr-raka"],
		duration: 90,
		showRecap: false,
		status: "open",
		dates: [
			{ date: dateOffset(2), startMinute: 9 * 60, endMinute: 12 * 60 },
			{ date: dateOffset(3), startMinute: 13 * 60, endMinute: 16 * 60 },
			{ date: dateOffset(4), startMinute: 9 * 60, endMinute: 11 * 60 },
		],
		responses: {
			"usr-naufal": (_key, order) => (order % 4 === 0 ? "unavailable" : "available"),
			"usr-bagas": (_key, order) => (order % 3 === 0 ? "unavailable" : "available"),
		},
	},
	{
		id: "evt-evaluasi-proker",
		title: "Evaluasi Program Kerja Semester",
		description: "Membahas capaian proker, kendala, dan rencana perbaikan semester berikutnya.",
		organizer: "usr-naufal",
		participants: ["usr-candra", "usr-bagas", "usr-dinda"],
		duration: 60,
		showRecap: true,
		status: "open",
		dates: [
			{ date: dateOffset(5), startMinute: 15 * 60, endMinute: 17 * 60 },
			{ date: dateOffset(6), startMinute: 10 * 60, endMinute: 12 * 60 },
		],
		responses: {
			"usr-candra": (_key, order) => (order === 2 ? "unavailable" : "available"),
			"usr-dinda": (_key, order) => (order % 3 === 0 ? "unavailable" : "available"),
		},
	},
	{
		id: "evt-koordinasi-divisi",
		title: "Rapat Koordinasi Divisi",
		description: "Sinkronisasi agenda divisi acara dan media sebelum masa persiapan.",
		organizer: "usr-bagas",
		participants: ["usr-candra", "usr-naufal"],
		duration: 120,
		showRecap: true,
		status: "finalized",
		dates: [
			{ date: dateOffset(3), startMinute: 13 * 60, endMinute: 16 * 60 },
			{ date: dateOffset(7), startMinute: 9 * 60, endMinute: 12 * 60 },
		],
		responses: {
			"usr-candra": () => "available",
			"usr-naufal": (_key, order) => (order === 0 ? "unavailable" : "available"),
		},
		finalKey: `${dateOffset(3)}|${13 * 60}`,
	},
	{
		id: "evt-open-recruitment",
		title: "Sosialisasi Open Recruitment",
		description: "Persiapan materi sosialisasi, jadwal kunjungan kelas, dan pembagian tugas.",
		organizer: "usr-candra",
		participants: ["usr-naufal", "usr-bagas", "usr-salsa", "usr-dinda"],
		duration: 90,
		showRecap: true,
		status: "open",
		dates: [
			{ date: dateOffset(9), startMinute: 10 * 60, endMinute: 12 * 60 },
			{ date: dateOffset(10), startMinute: 13 * 60, endMinute: 15 * 60 },
		],
		responses: {
			"usr-bagas": () => "available",
		},
	},
	{
		id: "evt-pleno-akhir-tahun",
		title: "Rapat Pleno Akhir Tahun",
		description: "Draft agenda pleno: laporan pertanggungjawaban dan pemilihan pengurus baru.",
		organizer: "usr-candra",
		participants: ["usr-naufal", "usr-bagas"],
		duration: 120,
		showRecap: false,
		status: "draft",
		dates: [
			{ date: dateOffset(14), startMinute: 9 * 60, endMinute: 12 * 60 },
			{ date: dateOffset(15), startMinute: 13 * 60, endMinute: 16 * 60 },
		],
		responses: {},
	},
];

const insertEvent = db.query(
	`INSERT INTO events (id, title, description, duration_minutes, timezone, status, show_recap, created_by,
	 created_at, updated_at, final_slot_key, final_starts_at, final_ends_at)
	 VALUES (?, ?, ?, ?, 'Asia/Jakarta', ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertDate = db.query(
	"INSERT INTO event_dates (id, event_id, candidate_date, start_minute, end_minute) VALUES (?, ?, ?, ?, ?)",
);
const insertParticipant = db.query(
	"INSERT INTO event_participants (event_id, user_id, role, invited_at, responded_at) VALUES (?, ?, ?, ?, ?)",
);
const insertResponse = db.query(
	"INSERT INTO event_responses (event_id, user_id, slot_key, status, updated_at) VALUES (?, ?, ?, ?, ?)",
);
const insertInsertion = db.query(
	"INSERT INTO calendar_insertions (event_id, user_id, inserted_at) VALUES (?, ?, ?)",
);

for (const event of EVENTS) {
	const slots = generateSlots(event.duration, event.dates);
	const finalSlot = event.finalKey
		? slots.find((slot) => slot.key === event.finalKey)
		: undefined;
	insertEvent.run(
		event.id,
		event.title,
		event.description,
		event.duration,
		event.status,
		event.showRecap ? 1 : 0,
		event.organizer,
		now,
		now,
		finalSlot?.key ?? null,
		finalSlot?.startsAt ?? null,
		finalSlot?.endsAt ?? null,
	);
	for (const item of event.dates) {
		insertDate.run(uid(), event.id, item.date, item.startMinute, item.endMinute);
	}
	insertParticipant.run(event.id, event.organizer, "organizer", now, null);
	for (const participantId of event.participants) {
		const responder = event.responses[participantId];
		insertParticipant.run(
			event.id,
			participantId,
			"peserta",
			now,
			responder ? now : null,
		);
		if (!responder) continue;
		slots.forEach((slot, order) => {
			insertResponse.run(
				event.id,
				participantId,
				slot.key,
				responder(slot.key, order),
				now,
			);
		});
	}
	if (event.status === "finalized" && event.organizer === "usr-candra") {
		insertInsertion.run(event.id, "usr-candra", now);
	}
}

console.log("Seed TemuYuk selesai.");
console.log(`Akun demo (kata sandi: ${PASSWORD}):`);
for (const user of USERS.slice(0, 3)) {
	console.log(`  - ${user.email} (${user.name})`);
}
console.log(`Event demo: ${EVENTS.length}`);
console.log(`Slot pertama: ${minuteToIso(dateOffset(2), 9 * 60)}`);
