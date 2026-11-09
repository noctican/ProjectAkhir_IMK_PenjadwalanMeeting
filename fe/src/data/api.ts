import { ApiError, api, qs } from "@/lib/api";
import type {
	ApiResponse,
	BusyBlock,
	CalendarStatus,
	DataProvider,
	EventDetail,
	EventInput,
	EventSummary,
	User,
} from "./types";

function payload<T>(res: ApiResponse<T>): T {
	if (res.data === undefined) {
		throw new ApiError(500, res.message || "Data tidak tersedia.");
	}
	return res.data;
}

export const apiProvider: DataProvider = {
	mode: "api",

	async getSession() {
		try {
			const res = await api.get<{ id: string; name: string; email: string; role: string }>(
				"/auth/me",
			);
			return (res.data as User) ?? null;
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) return null;
			throw error;
		}
	},

	async login(email, password) {
		const res = await api.post<{ user: User }>("/auth/login", {
			email,
			password,
		});
		return payload(res).user;
	},

	async register(name, email, password) {
		await api.post("/auth/register", { name, email, password });
	},

	async logout() {
		await api.post("/auth/logout");
	},

	async getCalendar() {
		const res = await api.get<CalendarStatus>("/calendar");
		return payload(res);
	},

	async connectCalendar(calendarName) {
		const res = await api.post<CalendarStatus>("/calendar/connect", {
			calendarName,
		});
		return payload(res);
	},

	async disconnectCalendar() {
		const res = await api.post<CalendarStatus>("/calendar/disconnect");
		return payload(res);
	},

	async syncCalendar() {
		const res = await api.post<CalendarStatus>("/calendar/sync");
		return payload(res);
	},

	async getBusy(from, to) {
		const res = await api.get<{ events: BusyBlock[] }>(
			`/calendar/busy${qs({ from, to })}`,
		);
		return res.data?.events ?? [];
	},

	async getAvailability() {
		const res = await api.get<{ slots: number[]; updatedAt: string | null }>(
			"/availability",
		);
		return payload(res);
	},

	async saveAvailability(slots) {
		await api.put("/availability", { slots });
	},

	async listUsers() {
		const res = await api.get<{ users: User[] }>("/users/directory");
		return res.data?.users ?? [];
	},

	async listEvents() {
		const res = await api.get<{ events: EventSummary[] }>("/events");
		return res.data?.events ?? [];
	},

	async getEvent(id) {
		const res = await api.get<EventDetail>(`/events/${id}`);
		return payload(res);
	},

	async createEvent(input: EventInput) {
		const res = await api.post<EventDetail>("/events", input);
		return payload(res);
	},

	async updateEvent(id, input) {
		const res = await api.patch<EventDetail>(`/events/${id}`, input);
		return payload(res);
	},

	async publishEvent(id) {
		const res = await api.post<EventDetail>(`/events/${id}/publish`);
		return payload(res);
	},

	async respond(id, responses) {
		const res = await api.post<EventDetail>(`/events/${id}/respond`, {
			responses,
		});
		return payload(res);
	},

	async finalize(id, slotKey) {
		const res = await api.post<EventDetail>(`/events/${id}/finalize`, {
			slotKey,
		});
		return payload(res);
	},

	async reopen(id) {
		const res = await api.post<EventDetail>(`/events/${id}/reopen`);
		return payload(res);
	},

	async cancel(id) {
		const res = await api.post<EventDetail>(`/events/${id}/cancel`);
		return payload(res);
	},

	async remind(id) {
		const res = await api.post<{ reminded: number }>(`/events/${id}/remind`);
		return res.data ?? { reminded: 0 };
	},

	async addToCalendar(id) {
		const res = await api.post<{ alreadyAdded: boolean }>(
			`/events/${id}/calendar`,
		);
		return res.data ?? { alreadyAdded: false };
	},
};
