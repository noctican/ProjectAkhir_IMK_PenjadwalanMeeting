import type {
	BusyBlock,
	CandidateDate,
	EventRole,
	EventSlot,
	EventStatus,
	User,
} from "./types";
import { SLOTS_PER_DAY, addDays, generateSlots, isoFor, todayLocal } from "./time";

export type LocalUser = User & { password: string };

export type LocalCalendar = {
	connected: boolean;
	calendarName: string | null;
	lastSyncedAt: string | null;
	connectedAt: string | null;
};

export type LocalParticipant = {
	userId: string;
	role: EventRole;
	respondedAt: string | null;
};

export type LocalResponse = {
	userId: string;
	slotKey: string;
	status: "available" | "unavailable";
};

export type LocalEvent = {
	id: string;
	title: string;
	description: string | null;
	durationMinutes: number;
	timezone: string;
	status: EventStatus;
	showRecap: boolean;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	finalSlotKey: string | null;
	finalStartsAt: string | null;
	finalEndsAt: string | null;
	dates: CandidateDate[];
	participants: LocalParticipant[];
	responses: LocalResponse[];
	insertions: string[];
};

export type LocalState = {
	version: 1;
	users: LocalUser[];
	calendars: Record<string, LocalCalendar>;
	weekly: Record<string, number[]>;
	busy: Record<string, BusyBlock[]>;
	events: LocalEvent[];
	availabilityUpdatedAt: Record<string, string>;
};

export const DEMO_PASSWORD = "temuyuk123";

export const DEMO_ACCOUNTS = [
	{ email: "candra@filkom.ub.ac.id", label: "Candra" },
	{ email: "naufal@filkom.ub.ac.id", label: "Naufal" },
	{ email: "bagas@filkom.ub.ac.id", label: "Bagas" },
];

const USERS: LocalUser[] = [
	{
		id: "usr-candra",
		name: "Candra Andika Putra",
		email: "candra@filkom.ub.ac.id",
		role: "Ketua Umum",
		password: DEMO_PASSWORD,
	},
	{
		id: "usr-naufal",
		name: "Naufal Fadhil Arkani",
		email: "naufal@filkom.ub.ac.id",
		role: "Sekretaris",
		password: DEMO_PASSWORD,
	},
	{
		id: "usr-bagas",
		name: "Bagas Zakaria",
		email: "bagas@filkom.ub.ac.id",
		role: "Koordinator Acara",
		password: DEMO_PASSWORD,
	},
	{
		id: "usr-salsabila",
		name: "Salsabila Putri",
		email: "salsabila@filkom.ub.ac.id",
		role: "Bendahara",
		password: DEMO_PASSWORD,
	},
	{
		id: "usr-raka",
		name: "Raka Pratama",
		email: "raka@filkom.ub.ac.id",
		role: "Anggota Divisi Acara",
		password: DEMO_PASSWORD,
	},
	{
		id: "usr-dinda",
		name: "Dinda Ayu Kirana",
		email: "dinda@filkom.ub.ac.id",
		role: "Anggota Divisi Media",
		password: DEMO_PASSWORD,
	},
];

/** Jam sibuk per hari (0 = Senin) yang dipakai untuk membentuk jadwal rutin. */
const BUSY_HOURS: Record<string, Record<number, [number, number][]>> = {
	"usr-candra": {
		0: [[8, 10], [13, 15]],
		1: [[8, 9.5], [13, 15]],
		2: [[8, 10]],
		3: [[8, 9.5], [15, 17]],
		4: [[8, 11]],
		5: [[9, 11]],
	},
	"usr-naufal": {
		0: [[7, 9], [14, 16]],
		1: [[8, 10]],
		2: [[8, 9.5], [13, 16]],
		3: [[8, 10]],
		4: [[8, 9], [13, 15]],
		6: [[10, 12]],
	},
	"usr-bagas": {
		0: [[9, 12]],
		1: [[8, 10], [15, 17]],
		2: [[8, 11]],
		3: [[13, 15]],
		4: [[8, 10]],
		5: [[8, 10]],
	},
	"usr-salsabila": {
		0: [[10, 12]],
		1: [[8, 9.5], [13, 15]],
		2: [[7, 9]],
		3: [[8, 10], [16, 18]],
		4: [[9, 11]],
	},
	"usr-raka": {
		0: [[8, 10], [16, 18]],
		1: [[8, 11]],
		2: [[9, 11], [14, 16]],
		3: [[8, 9.5]],
		4: [[13, 15]],
		5: [[9, 12]],
	},
	"usr-dinda": {
		0: [[7, 9]],
		1: [[8, 10], [15, 17]],
		2: [[8, 9.5]],
		3: [[8, 11]],
		4: [[9, 10], [13, 16]],
		6: [[8, 10]],
	},
};

function weeklyFromBusy(plan: Record<number, [number, number][]>): number[] {
	const slots = new Array<number>(7 * SLOTS_PER_DAY).fill(1);
	for (const [day, ranges] of Object.entries(plan)) {
		for (const [fromHour, toHour] of ranges) {
			const from = Math.round(fromHour * 2);
			const to = Math.round(toHour * 2);
			for (let slot = from; slot < to; slot++) {
				slots[Number(day) * SLOTS_PER_DAY + slot] = 0;
			}
		}
	}
	return slots;
}

export function busyFromWeekly(slots: number[], startDate: string): BusyBlock[] {
	const blocks: BusyBlock[] = [];
	for (let offset = 0; offset < 35; offset++) {
		const date = addDays(startDate, offset);
		const weekday = new Date(`${date}T00:00:00+07:00`).getDay();
		const day = (weekday + 6) % 7;
		let blockStart: number | null = null;
		for (let minute = 0; minute <= 24 * 60; minute += 30) {
			const unavailable =
				minute < 24 * 60 &&
				slots[day * SLOTS_PER_DAY + minute / 30] === 0;
			if (unavailable && blockStart === null) blockStart = minute;
			if (!unavailable && blockStart !== null) {
				blocks.push({
					startsAt: isoFor(date, blockStart),
					endsAt: isoFor(date, minute),
				});
				blockStart = null;
			}
		}
	}
	return blocks;
}

function slotsFor(
	durationMinutes: number,
	dates: CandidateDate[],
): (EventSlot & { index: number })[] {
	return generateSlots(durationMinutes, dates).map((slot, index) => ({
		...slot,
		index,
	}));
}

function responsesFor(
	event: string,
	participant: string,
	slots: { key: string; index: number }[],
	unavailableIndexes: number[] = [],
	limit = Number.POSITIVE_INFINITY,
): LocalResponse[] {
	return slots
		.filter((slot) => slot.index < limit)
		.map((slot) => ({
			event,
			userId: participant,
			slotKey: slot.key,
			status: unavailableIndexes.includes(slot.index)
				? ("unavailable" as const)
				: ("available" as const),
		}));
}

export function buildSeed(): LocalState {
	const today = todayLocal();
	const now = new Date().toISOString();

	const weekly: Record<string, number[]> = {};
	const busy: Record<string, BusyBlock[]> = {};
	for (const user of USERS) {
		weekly[user.id] = weeklyFromBusy(BUSY_HOURS[user.id] ?? {});
	}

	const calendars: Record<string, LocalCalendar> = {};
	for (const user of USERS) {
		calendars[user.id] = {
			connected: false,
			calendarName: null,
			lastSyncedAt: null,
			connectedAt: null,
		};
	}
	for (const id of ["usr-candra", "usr-naufal"]) {
		calendars[id] = {
			connected: true,
			calendarName: "Kalender Kampus (simulasi)",
			lastSyncedAt: now,
			connectedAt: now,
		};
		busy[id] = busyFromWeekly(weekly[id], today);
	}

	const event1Dates: CandidateDate[] = [
		{ date: addDays(today, 2), startMinute: 16 * 60, endMinute: 20 * 60 },
		{ date: addDays(today, 3), startMinute: 16 * 60, endMinute: 20 * 60 },
		{ date: addDays(today, 4), startMinute: 16 * 60, endMinute: 20 * 60 },
	];
	const event1Slots = slotsFor(90, event1Dates);

	const event2Dates: CandidateDate[] = [
		{ date: addDays(today, 5), startMinute: 18 * 60, endMinute: 21 * 60 },
		{ date: addDays(today, 6), startMinute: 18 * 60, endMinute: 21 * 60 },
	];
	const event2Slots = slotsFor(60, event2Dates);

	const event3Dates: CandidateDate[] = [
		{ date: addDays(today, 3), startMinute: 12 * 60, endMinute: 17 * 60 },
	];
	const event3Slots = slotsFor(120, event3Dates);
	const event3Final = event3Slots.find((slot) => slot.index === 2);

	const event4Dates: CandidateDate[] = [
		{ date: addDays(today, 9), startMinute: 9 * 60, endMinute: 12 * 60 },
		{ date: addDays(today, 10), startMinute: 9 * 60, endMinute: 12 * 60 },
	];
	const event4Slots = slotsFor(90, event4Dates);

	const event5Dates: CandidateDate[] = [
		{ date: addDays(today, 14), startMinute: 15 * 60, endMinute: 18 * 60 },
		{ date: addDays(today, 15), startMinute: 15 * 60, endMinute: 18 * 60 },
	];

	const events: LocalEvent[] = [
		{
			id: "evt-rapat-rutin",
			title: "Rapat Rutin BEM",
			description:
				"Agenda mingguan: evaluasi program kerja, laporan divisi, dan rencana kegiatan berikutnya.",
			durationMinutes: 90,
			timezone: "Asia/Jakarta",
			status: "open",
			showRecap: false,
			createdBy: "usr-candra",
			createdAt: now,
			updatedAt: now,
			finalSlotKey: null,
			finalStartsAt: null,
			finalEndsAt: null,
			dates: event1Dates,
			participants: [
				{ userId: "usr-candra", role: "organizer", respondedAt: null },
				{ userId: "usr-naufal", role: "participant", respondedAt: now },
				{ userId: "usr-bagas", role: "participant", respondedAt: now },
				{ userId: "usr-salsabila", role: "participant", respondedAt: null },
			],
			responses: [
				...responsesFor("evt-rapat-rutin", "usr-naufal", event1Slots, [2, 3]),
				...responsesFor("evt-rapat-rutin", "usr-bagas", event1Slots, [], 5),
			],
			insertions: [],
		},
		{
			id: "evt-evaluasi-proker",
			title: "Evaluasi Program Kerja Semester",
			description:
				"Meninjau capaian program kerja semester ini dan menyusun prioritas semester berikutnya.",
			durationMinutes: 60,
			timezone: "Asia/Jakarta",
			status: "open",
			showRecap: true,
			createdBy: "usr-naufal",
			createdAt: now,
			updatedAt: now,
			finalSlotKey: null,
			finalStartsAt: null,
			finalEndsAt: null,
			dates: event2Dates,
			participants: [
				{ userId: "usr-naufal", role: "organizer", respondedAt: null },
				{ userId: "usr-candra", role: "participant", respondedAt: now },
				{ userId: "usr-bagas", role: "participant", respondedAt: now },
				{ userId: "usr-dinda", role: "participant", respondedAt: null },
			],
			responses: [
				...responsesFor("evt-evaluasi-proker", "usr-candra", event2Slots, [1, 4]),
				...responsesFor("evt-evaluasi-proker", "usr-bagas", event2Slots, [], 4),
			],
			insertions: [],
		},
		{
			id: "evt-koordinasi-divisi",
			title: "Rapat Koordinasi Divisi",
			description:
				"Pembagian tugas dan penyusunan rundown acara pembukaan semester.",
			durationMinutes: 120,
			timezone: "Asia/Jakarta",
			status: "finalized",
			showRecap: true,
			createdBy: "usr-bagas",
			createdAt: now,
			updatedAt: now,
			finalSlotKey: event3Final?.key ?? null,
			finalStartsAt: event3Final?.startsAt ?? null,
			finalEndsAt: event3Final?.endsAt ?? null,
			dates: event3Dates,
			participants: [
				{ userId: "usr-bagas", role: "organizer", respondedAt: null },
				{ userId: "usr-candra", role: "participant", respondedAt: now },
				{ userId: "usr-naufal", role: "participant", respondedAt: now },
				{ userId: "usr-raka", role: "participant", respondedAt: now },
				{ userId: "usr-salsabila", role: "participant", respondedAt: null },
			],
			responses: [
				...responsesFor("evt-koordinasi-divisi", "usr-candra", event3Slots, [0]),
				...responsesFor("evt-koordinasi-divisi", "usr-naufal", event3Slots, []),
				...responsesFor("evt-koordinasi-divisi", "usr-raka", event3Slots, [5]),
			],
			insertions: [],
		},
		{
			id: "evt-open-recruitment",
			title: "Sosialisasi Open Recruitment",
			description:
				"Persiapan seleksi terbuka: penyusunan kriteria, jadwal wawancara, dan publikasi.",
			durationMinutes: 90,
			timezone: "Asia/Jakarta",
			status: "open",
			showRecap: true,
			createdBy: "usr-candra",
			createdAt: now,
			updatedAt: now,
			finalSlotKey: null,
			finalStartsAt: null,
			finalEndsAt: null,
			dates: event4Dates,
			participants: [
				{ userId: "usr-candra", role: "organizer", respondedAt: null },
				{ userId: "usr-naufal", role: "participant", respondedAt: now },
				{ userId: "usr-bagas", role: "participant", respondedAt: null },
				{ userId: "usr-dinda", role: "participant", respondedAt: now },
			],
			responses: [
				...responsesFor("evt-open-recruitment", "usr-naufal", event4Slots, [
					2, 3, 4,
				]),
				...responsesFor("evt-open-recruitment", "usr-dinda", event4Slots, [], 4),
			],
			insertions: [],
		},
		{
			id: "evt-pleno-akhir-tahun",
			title: "Rapat Pleno Akhir Tahun",
			description:
				"Laporan pertanggungjawaban pengurus dan pemilihan pengurus periode berikutnya.",
			durationMinutes: 120,
			timezone: "Asia/Jakarta",
			status: "draft",
			showRecap: false,
			createdBy: "usr-candra",
			createdAt: now,
			updatedAt: now,
			finalSlotKey: null,
			finalStartsAt: null,
			finalEndsAt: null,
			dates: event5Dates,
			participants: [
				{ userId: "usr-candra", role: "organizer", respondedAt: null },
				{ userId: "usr-naufal", role: "participant", respondedAt: null },
				{ userId: "usr-bagas", role: "participant", respondedAt: null },
				{ userId: "usr-salsabila", role: "participant", respondedAt: null },
				{ userId: "usr-raka", role: "participant", respondedAt: null },
				{ userId: "usr-dinda", role: "participant", respondedAt: null },
			],
			responses: [],
			insertions: [],
		},
	];

	return {
		version: 1,
		users: USERS,
		calendars,
		weekly,
		busy,
		events,
		availabilityUpdatedAt: Object.fromEntries(
			USERS.map((user) => [user.id, now]),
		),
	};
}
