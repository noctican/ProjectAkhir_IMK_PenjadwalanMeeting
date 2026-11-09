import { config } from "../config";

export type CandidateDate = {
	date: string; // YYYY-MM-DD
	startMinute: number; // menit dari tengah malam, kelipatan 30
	endMinute: number;
};

export type Slot = {
	key: string;
	date: string;
	startMinute: number;
	endMinute: number;
	startsAt: string;
	endsAt: string;
};

const STEP = config.slotStepMinutes;

export function slotKey(date: string, startMinute: number): string {
	return `${date}|${startMinute}`;
}

export function parseSlotKey(key: string): { date: string; startMinute: number } {
	const [date, minute] = key.split("|");
	return { date, startMinute: Number(minute) };
}

/** ISO untuk tanggal + menit lokal (WIB), supaya klien menerima waktu absolut. */
export function minuteToIso(date: string, minute: number): string {
	const hh = String(Math.floor(minute / 60)).padStart(2, "0");
	const mm = String(minute % 60).padStart(2, "0");
	return new Date(
		`${date}T${hh}:${mm}:00${config.timezoneOffset}`,
	).toISOString();
}

/**
 * Kandidat waktu dibuat tiap 30 menit, hanya bila seluruh durasi event
 * masih berada di dalam rentang jam yang ditetapkan organizer.
 */
export function generateSlots(
	durationMinutes: number,
	dates: CandidateDate[],
): Slot[] {
	const slots: Slot[] = [];
	const seen = new Set<string>();
	for (const item of dates) {
		for (
			let start = item.startMinute;
			start + durationMinutes <= item.endMinute;
			start += STEP
		) {
			const key = slotKey(item.date, start);
			if (seen.has(key)) continue;
			seen.add(key);
			slots.push({
				key,
				date: item.date,
				startMinute: start,
				endMinute: start + durationMinutes,
				startsAt: minuteToIso(item.date, start),
				endsAt: minuteToIso(item.date, start + durationMinutes),
			});
		}
	}
	slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
	return slots;
}

/** Tanggal lokal (WIB) hari ini, YYYY-MM-DD. */
export function todayLocal(): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
	return parts;
}

export function isValidDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Tambah hari pada tanggal kalender (YYYY-MM-DD) tanpa pergeseran zona waktu. */
export function addDaysLocal(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/**
 * Apakah satu slot 30 menit tersedia di jadwal rutin?
 * Indeks 0 = Senin; 7 hari x 48 slot.
 */
export function weeklySlotAvailable(
	slots: number[],
	date: string,
	minute: number,
): boolean {
	const day = new Date(`${date}T00:00:00${config.timezoneOffset}`).getDay();
	const index = (day + 6) % 7; // Senin = 0 ... Minggu = 6
	return slots[index * 48 + Math.floor(minute / 30)] === 1;
}

/** Semua segmen 30 menit dalam rentang harus tersedia. */
export function rangeAvailableWeekly(
	slots: number[],
	date: string,
	startMinute: number,
	endMinute: number,
): boolean {
	for (let m = startMinute; m < endMinute; m += STEP) {
		if (!weeklySlotAvailable(slots, date, m)) return false;
	}
	return true;
}

/** Apakah slot bertabrakan dengan salah satu waktu sibuk (ISO)? */
export function overlapsBusy(
	busy: { starts_at: string; ends_at: string }[],
	startsAt: string,
	endsAt: string,
): boolean {
	return busy.some((item) => item.starts_at < endsAt && item.ends_at > startsAt);
}
