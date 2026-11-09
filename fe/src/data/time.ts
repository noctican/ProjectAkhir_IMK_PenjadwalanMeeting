import type { CandidateDate, EventSlot } from "./types";

export const SLOT_STEP = 30;
export const SLOTS_PER_DAY = 48;

export const DAY_NAMES = [
	"Senin",
	"Selasa",
	"Rabu",
	"Kamis",
	"Jumat",
	"Sabtu",
	"Minggu",
];

export const MONTH_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

/** Senin = 0 ... Minggu = 6. */
export function dayIndex(date: string): number {
	const weekday = new Date(`${date}T00:00:00+07:00`).getDay();
	return (weekday + 6) % 7;
}

export function minutesToTime(minute: number): string {
	const hh = String(Math.floor(minute / 60)).padStart(2, "0");
	const mm = String(minute % 60).padStart(2, "0");
	return `${hh}:${mm}`;
}

export function timeToMinutes(value: string): number {
	const [hh, mm] = value.split(":").map(Number);
	return hh * 60 + mm;
}

export function fmtDateLong(date: string): string {
	const d = new Date(`${date}T00:00:00+07:00`);
	return `${DAY_NAMES[dayIndex(date)]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShort(date: string): string {
	const d = new Date(`${date}T00:00:00+07:00`);
	return `${DAY_NAMES[dayIndex(date)].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

export function fmtDateTimeRange(startsAt: string, endsAt: string): string {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	const date = `${DAY_NAMES[(start.getDay() + 6) % 7]}, ${start.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
	return `${date} · ${minutesToTime(start.getHours() * 60 + start.getMinutes())}–${minutesToTime(end.getHours() * 60 + end.getMinutes())} WIB`;
}

export function fmtTimeRange(startMinute: number, endMinute: number): string {
	return `${minutesToTime(startMinute)}–${minutesToTime(endMinute)}`;
}

export function isoFor(date: string, minute: number): string {
	const hh = String(Math.floor(minute / 60)).padStart(2, "0");
	const mm = String(minute % 60).padStart(2, "0");
	return new Date(`${date}T${hh}:${mm}:00+07:00`).toISOString();
}

export function todayLocal(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

export function generateSlots(
	durationMinutes: number,
	dates: CandidateDate[],
): EventSlot[] {
	const slots: EventSlot[] = [];
	const seen = new Set<string>();
	for (const item of dates) {
		for (
			let start = item.startMinute;
			start + durationMinutes <= item.endMinute;
			start += SLOT_STEP
		) {
			const key = `${item.date}|${start}`;
			if (seen.has(key)) continue;
			seen.add(key);
			slots.push({
				key,
				date: item.date,
				startMinute: start,
				endMinute: start + durationMinutes,
				startsAt: isoFor(item.date, start),
				endsAt: isoFor(item.date, start + durationMinutes),
				myStatus: null,
				suggestedStatus: "available",
			});
		}
	}
	return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Jadwal rutin: indeks 0 = Senin 00.00, 48 slot per hari. */
export function weeklyRangeAvailable(
	slots: number[],
	date: string,
	startMinute: number,
	endMinute: number,
): boolean {
	const day = dayIndex(date);
	for (let minute = startMinute; minute < endMinute; minute += SLOT_STEP) {
		if (slots[day * SLOTS_PER_DAY + minute / SLOT_STEP] !== 1) return false;
	}
	return true;
}
