import { bumpDataVersion } from "./version";
import {
	DEMO_PASSWORD,
	buildSeed,
	busyFromWeekly,
	type LocalEvent,
	type LocalState,
	type LocalUser,
} from "./seed";
import {
	SLOT_STEP,
	generateSlots,
	isoFor,
	todayLocal,
	weeklyRangeAvailable,
} from "./time";
import type {
	CalendarStatus,
	CandidateDate,
	DataProvider,
	EventDetail,
	EventInput,
	EventSlot,
	EventSummary,
	SlotCounts,
	User,
} from "./types";

const STORAGE_KEY = "temuyuk:demo:v1";
const SESSION_KEY = "temuyuk:session:v1";

let memoryState: LocalState | null = null;

function hasStorage(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const probe = "__temuyuk_probe__";
		window.localStorage.setItem(probe, "1");
		window.localStorage.removeItem(probe);
		return true;
	} catch {
		return false;
	}
}

function readState(): LocalState {
	if (typeof window === "undefined") return buildSeed();
	if (!hasStorage()) {
		memoryState ??= buildSeed();
		return memoryState;
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			const seed = buildSeed();
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
			return seed;
		}
		const parsed = JSON.parse(raw) as LocalState;
		if (
			!parsed ||
			parsed.version !== 1 ||
			!Array.isArray(parsed.users) ||
			!Array.isArray(parsed.events)
		) {
			const seed = buildSeed();
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
			return seed;
		}
		return parsed;
	} catch {
		const seed = buildSeed();
		memoryState = seed;
		return seed;
	}
}

function writeState(state: LocalState): void {
	memoryState = state;
	if (hasStorage()) {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// Kuota penuh / storage diblokir: data tetap hidup di memori sesi.
		}
	}
	bumpDataVersion();
}

function readSessionId(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(SESSION_KEY);
	} catch {
		return null;
	}
}

function writeSessionId(userId: string | null): void {
	if (typeof window === "undefined") return;
	try {
		if (userId) window.localStorage.setItem(SESSION_KEY, userId);
		else window.localStorage.removeItem(SESSION_KEY);
	} catch {
		// Abaikan; sesi hanya berlaku selama tab hidup.
	}
}

function publicUser(user: LocalUser): User {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};
}

function currentUser(state: LocalState): LocalUser {
	const id = readSessionId();
	const user = id ? state.users.find((item) => item.id === id) : null;
	if (!user) throw new Error("Sesi berakhir. Silakan masuk kembali.");
	return user;
}

function findEvent(state: LocalState, id: string): LocalEvent {
	const event = state.events.find((item) => item.id === id);
	if (!event) throw new Error("Event tidak ditemukan.");
	return event;
}

function roleOf(event: LocalEvent, userId: string) {
	const member = event.participants.find((item) => item.userId === userId);
	return member?.role ?? null;
}

function countsFor(
	event: LocalEvent,
	slotKey: string,
): SlotCounts {
	const participants = event.participants.filter(
		(item) => item.role === "participant",
	);
	let available = 0;
	let unavailable = 0;
	for (const participant of participants) {
		const response = event.responses.find(
			(item) => item.userId === participant.userId && item.slotKey === slotKey,
		);
		if (response?.status === "available") available++;
		else if (response?.status === "unavailable") unavailable++;
	}
	return {
		available,
		unavailable,
		pending: participants.length - available - unavailable,
		total: participants.length,
	};
}

function suggestedStatusFor(
	state: LocalState,
	userId: string,
	date: string,
	startMinute: number,
	endMinute: number,
): "available" | "unavailable" {
	const weekly = state.weekly[userId] ?? [];
	if (!weeklyRangeAvailable(weekly, date, startMinute, endMinute)) {
		return "unavailable";
	}
	const calendar = state.calendars[userId];
	if (!calendar?.connected) return "available";
	const start = new Date(isoFor(date, startMinute)).getTime();
	const end = new Date(isoFor(date, endMinute)).getTime();
	const clash = (state.busy[userId] ?? []).some((block) => {
		const busyStart = new Date(block.startsAt).getTime();
		const busyEnd = new Date(block.endsAt).getTime();
		return start < busyEnd && end > busyStart;
	});
	return clash ? "unavailable" : "available";
}

function firstDateOf(event: LocalEvent): string | null {
	return event.dates.length
		? event.dates.map((item) => item.date).sort()[0]
		: null;
}

function toSummary(state: LocalState, event: LocalEvent, userId: string): EventSummary {
	const organizer = state.users.find((item) => item.id === event.createdBy);
	const participants = event.participants.filter(
		(item) => item.role === "participant",
	);
	const role = roleOf(event, userId) ?? "participant";
	return {
		id: event.id,
		title: event.title,
		description: event.description,
		durationMinutes: event.durationMinutes,
		timezone: event.timezone,
		status: event.status,
		showRecap: event.showRecap,
		role: role === "organizer" ? "organizer" : "participant",
		organizer: organizer?.name ?? "Pengguna",
		participantCount: participants.length,
		respondedCount: participants.filter((item) => item.respondedAt).length,
		myResponded: Boolean(
			event.participants.find((item) => item.userId === userId)?.respondedAt,
		),
		candidateDateCount: event.dates.length,
		firstDate: firstDateOf(event),
		finalStartsAt: event.finalStartsAt,
		finalEndsAt: event.finalEndsAt,
		createdAt: event.createdAt,
	};
}

function toDetail(state: LocalState, event: LocalEvent, userId: string): EventDetail {
	const summary = toSummary(state, event, userId);
	const role = roleOf(event, userId);
	const isOrganizer = role === "organizer";
	const canSeeCounts = isOrganizer || event.showRecap;
	const calendar = state.calendars[userId];

	const slots: EventSlot[] = generateSlots(
		event.durationMinutes,
		event.dates,
	).map((slot) => {
		const response = event.responses.find(
			(item) => item.userId === userId && item.slotKey === slot.key,
		);
		return {
			...slot,
			myStatus: response?.status ?? null,
			suggestedStatus: suggestedStatusFor(
				state,
				userId,
				slot.date,
				slot.startMinute,
				slot.endMinute,
			),
			...(canSeeCounts ? { counts: countsFor(event, slot.key) } : {}),
		};
	});

	return {
		...summary,
		participants: event.participants.map((member) => {
			const user = state.users.find((item) => item.id === member.userId);
			return {
				id: member.userId,
				name: user?.name ?? "Pengguna",
				email: user?.email ?? "",
				role: member.role,
				responded: Boolean(member.respondedAt),
			};
		}),
		dates: event.dates,
		slots,
		finalSlotKey: event.finalSlotKey,
		calendarConnected: Boolean(calendar?.connected),
		calendarInserted: event.insertions.includes(userId),
		canRespond: role === "participant" && event.status === "open",
	};
}

function calendarStatus(state: LocalState, userId: string): CalendarStatus {
	const calendar = state.calendars[userId];
	const busy = state.busy[userId] ?? [];
	return {
		connected: Boolean(calendar?.connected),
		provider: "google",
		demo: true,
		calendarName: calendar?.calendarName ?? null,
		lastSyncedAt: calendar?.lastSyncedAt ?? null,
		connectedAt: calendar?.connectedAt ?? null,
		busyEventCount: calendar?.connected ? busy.length : 0,
	};
}

function validateInput(input: EventInput): void {
	if (!input.title.trim()) throw new Error("Judul event wajib diisi.");
	if (input.durationMinutes < 30 || input.durationMinutes % SLOT_STEP !== 0) {
		throw new Error("Durasi event harus kelipatan 30 menit.");
	}
	if (input.participantIds.length === 0) {
		throw new Error("Pilih minimal satu peserta.");
	}
	if (input.dates.length === 0) {
		throw new Error("Pilih minimal satu tanggal kandidat.");
	}
	for (const date of input.dates) {
		if (date.endMinute - date.startMinute < input.durationMinutes) {
			throw new Error(
				"Rentang jam harus lebih panjang dari durasi event.",
			);
		}
	}
}

function normalizeDates(dates: CandidateDate[]): CandidateDate[] {
	const seen = new Set<string>();
	return [...dates]
		.filter((item) => {
			if (seen.has(item.date)) return false;
			seen.add(item.date);
			return true;
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

function makeEvent(
	input: EventInput,
	user: LocalUser,
	status: "draft" | "open",
): LocalEvent {
	const now = new Date().toISOString();
	return {
		id: `evt-${crypto.randomUUID()}`,
		title: input.title.trim(),
		description: input.description?.trim() || null,
		durationMinutes: input.durationMinutes,
		timezone: input.timezone ?? "Asia/Jakarta",
		status,
		showRecap: input.showRecap,
		createdBy: user.id,
		createdAt: now,
		updatedAt: now,
		finalSlotKey: null,
		finalStartsAt: null,
		finalEndsAt: null,
		dates: normalizeDates(input.dates),
		participants: [
			{ userId: user.id, role: "organizer", respondedAt: null },
			...input.participantIds
				.filter((id) => id !== user.id)
				.map((id) => ({
					userId: id,
					role: "participant" as const,
					respondedAt: null,
				})),
		],
		responses: [],
		insertions: [],
	};
}

export const localProvider: DataProvider = {
	mode: "local",

	async getSession() {
		const state = readState();
		const id = readSessionId();
		const user = id ? state.users.find((item) => item.id === id) : null;
		return user ? publicUser(user) : null;
	},

	async login(email, password) {
		const state = readState();
		const user = state.users.find(
			(item) => item.email.toLowerCase() === email.trim().toLowerCase(),
		);
		if (!user || password !== user.password) {
			throw new Error(
				"Email atau kata sandi tidak cocok. Kata sandi demo: temuyuk123.",
			);
		}
		writeSessionId(user.id);
		return publicUser(user);
	},

	async register(name, email, password) {
		const state = readState();
		const normalized = email.trim().toLowerCase();
		if (!name.trim()) throw new Error("Nama wajib diisi.");
		if (!normalized.includes("@")) throw new Error("Email tidak valid.");
		if (password.length < 6) {
			throw new Error("Kata sandi minimal 6 karakter.");
		}
		if (state.users.some((item) => item.email.toLowerCase() === normalized)) {
			throw new Error("Email sudah terdaftar.");
		}
		const user: LocalUser = {
			id: `usr-${crypto.randomUUID()}`,
			name: name.trim(),
			email: normalized,
			role: "Anggota",
			password,
		};
		state.users.push(user);
		state.weekly[user.id] = new Array(7 * 48).fill(1);
		state.calendars[user.id] = {
			connected: false,
			calendarName: null,
			lastSyncedAt: null,
			connectedAt: null,
		};
		state.busy[user.id] = [];
		state.availabilityUpdatedAt[user.id] = new Date().toISOString();
		writeState(state);
		writeSessionId(user.id);
	},

	async logout() {
		writeSessionId(null);
	},

	async getCalendar() {
		return calendarStatus(readState(), currentUser(readState()).id);
	},

	async connectCalendar(calendarName) {
		const state = readState();
		const user = currentUser(state);
		const now = new Date().toISOString();
		state.calendars[user.id] = {
			connected: true,
			calendarName: calendarName?.trim() || "Kalender Kampus (simulasi)",
			lastSyncedAt: now,
			connectedAt: now,
		};
		state.busy[user.id] = busyFromWeekly(
			state.weekly[user.id] ?? [],
			todayLocal(),
		);
		writeState(state);
		return calendarStatus(state, user.id);
	},

	async disconnectCalendar() {
		const state = readState();
		const user = currentUser(state);
		state.calendars[user.id] = {
			connected: false,
			calendarName: null,
			lastSyncedAt: null,
			connectedAt: null,
		};
		state.busy[user.id] = [];
		writeState(state);
		return calendarStatus(state, user.id);
	},

	async syncCalendar() {
		const state = readState();
		const user = currentUser(state);
		const calendar = state.calendars[user.id];
		if (!calendar?.connected) throw new Error("Kalender belum terhubung.");
		calendar.lastSyncedAt = new Date().toISOString();
		state.busy[user.id] = busyFromWeekly(
			state.weekly[user.id] ?? [],
			todayLocal(),
		);
		writeState(state);
		return calendarStatus(state, user.id);
	},

	async getBusy(from, to) {
		const state = readState();
		const user = currentUser(state);
		if (!state.calendars[user.id]?.connected) return [];
		const fromTime = new Date(from).getTime();
		const toTime = new Date(to).getTime();
		return (state.busy[user.id] ?? []).filter((block) => {
			const start = new Date(block.startsAt).getTime();
			const end = new Date(block.endsAt).getTime();
			return start < toTime && end > fromTime;
		});
	},

	async getAvailability() {
		const state = readState();
		const user = currentUser(state);
		return {
			slots: [...(state.weekly[user.id] ?? new Array(7 * 48).fill(1))],
			updatedAt: state.availabilityUpdatedAt[user.id] ?? null,
		};
	},

	async saveAvailability(slots) {
		const state = readState();
		const user = currentUser(state);
		if (slots.length !== 7 * 48) {
			throw new Error("Jadwal harus berisi 336 slot.");
		}
		state.weekly[user.id] = slots.map((slot) => (slot === 1 ? 1 : 0));
		state.availabilityUpdatedAt[user.id] = new Date().toISOString();
		writeState(state);
	},

	async listUsers() {
		const state = readState();
		const user = currentUser(state);
		return state.users
			.filter((item) => item.id !== user.id)
			.map(publicUser)
			.sort((a, b) => a.name.localeCompare(b.name));
	},

	async listEvents() {
		const state = readState();
		const user = currentUser(state);
		const order: Record<string, number> = {
			open: 0,
			finalized: 1,
			draft: 2,
			cancelled: 3,
		};
		return state.events
			.filter((event) => roleOf(event, user.id) !== null)
			.map((event) => toSummary(state, event, user.id))
			.sort((a, b) => {
				const byStatus = (order[a.status] ?? 9) - (order[b.status] ?? 9);
				if (byStatus !== 0) return byStatus;
				return (a.firstDate ?? "").localeCompare(b.firstDate ?? "");
			});
	},

	async getEvent(id) {
		const state = readState();
		const user = currentUser(state);
		return toDetail(state, findEvent(state, id), user.id);
	},

	async createEvent(input) {
		const state = readState();
		const user = currentUser(state);
		validateInput(input);
		const event = makeEvent(input, user, input.publish === false ? "draft" : "open");
		state.events.unshift(event);
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async updateEvent(id, input) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat mengubahnya.");
		}
		if (!["draft", "open"].includes(event.status)) {
			throw new Error("Event yang sudah final tidak dapat diubah.");
		}
		validateInput(input);
		event.title = input.title.trim();
		event.description = input.description?.trim() || null;
		event.durationMinutes = input.durationMinutes;
		event.showRecap = input.showRecap;
		event.dates = normalizeDates(input.dates);
		event.participants = [
			{ userId: user.id, role: "organizer", respondedAt: null },
			...input.participantIds
				.filter((pid) => pid !== user.id)
				.map((pid) => {
					const previous = event.participants.find(
						(item) => item.userId === pid,
					);
					return {
						userId: pid,
						role: "participant" as const,
						respondedAt: previous?.respondedAt ?? null,
					};
				}),
		];
		const validKeys = new Set(
			generateSlots(event.durationMinutes, event.dates).map(
				(slot) => slot.key,
			),
		);
		event.responses = event.responses.filter((item) =>
			validKeys.has(item.slotKey),
		);
		event.updatedAt = new Date().toISOString();
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async publishEvent(id) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat mempublikasikan.");
		}
		event.status = "open";
		event.updatedAt = new Date().toISOString();
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async respond(id, responses) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.status !== "open") throw new Error("Event tidak menerima respons.");
		const member = event.participants.find(
			(item) => item.userId === user.id && item.role === "participant",
		);
		if (!member) throw new Error("Hanya peserta yang dapat merespons.");
		const validKeys = new Set(
			generateSlots(event.durationMinutes, event.dates).map(
				(slot) => slot.key,
			),
		);
		for (const response of responses) {
			if (!validKeys.has(response.slotKey)) {
				throw new Error("Ada kandidat waktu yang tidak dikenal.");
			}
		}
		for (const response of responses) {
			const existing = event.responses.find(
				(item) =>
					item.userId === user.id && item.slotKey === response.slotKey,
			);
			if (existing) existing.status = response.status;
			else
				event.responses.push({
					userId: user.id,
					slotKey: response.slotKey,
					status: response.status,
				});
		}
		member.respondedAt = new Date().toISOString();
		event.updatedAt = member.respondedAt;
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async finalize(id, slotKey) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat menetapkan jadwal.");
		}
		if (event.status !== "open") {
			throw new Error("Event ini tidak dapat difinalisasi.");
		}
		const slot = generateSlots(event.durationMinutes, event.dates).find(
			(item) => item.key === slotKey,
		);
		if (!slot) throw new Error("Kandidat waktu tidak ditemukan.");
		event.status = "finalized";
		event.finalSlotKey = slot.key;
		event.finalStartsAt = slot.startsAt;
		event.finalEndsAt = slot.endsAt;
		event.updatedAt = new Date().toISOString();
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async reopen(id) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat membuka ulang.");
		}
		event.status = "open";
		event.finalSlotKey = null;
		event.finalStartsAt = null;
		event.finalEndsAt = null;
		event.updatedAt = new Date().toISOString();
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async cancel(id) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat membatalkan.");
		}
		event.status = "cancelled";
		event.updatedAt = new Date().toISOString();
		writeState(state);
		return toDetail(state, event, user.id);
	},

	async remind(id) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.createdBy !== user.id) {
			throw new Error("Hanya pembuat event yang dapat mengingatkan.");
		}
		if (event.status !== "open") throw new Error("Event tidak sedang berjalan.");
		const pending = event.participants.filter(
			(item) => item.role === "participant" && !item.respondedAt,
		);
		return { reminded: pending.length };
	},

	async addToCalendar(id) {
		const state = readState();
		const user = currentUser(state);
		const event = findEvent(state, id);
		if (event.status !== "finalized") {
			throw new Error("Jadwal final belum ditetapkan.");
		}
		if (!state.calendars[user.id]?.connected) {
			throw new Error("Hubungkan Google Calendar terlebih dahulu.");
		}
		if (event.insertions.includes(user.id)) {
			return { alreadyAdded: true };
		}
		event.insertions.push(user.id);
		writeState(state);
		return { alreadyAdded: false };
	},
};

export function resetDemoData(): void {
	if (hasStorage()) {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignora
		}
	}
	memoryState = null;
	writeState(buildSeed());
}

export function localDemoPassword(): string {
	return DEMO_PASSWORD;
}
