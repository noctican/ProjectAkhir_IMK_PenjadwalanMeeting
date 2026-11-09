export type ApiResponse<T> = {
	success: boolean;
	message?: string;
	data?: T;
};

export type User = {
	id: string;
	name: string;
	email: string;
	role: string;
};

export type CalendarStatus = {
	connected: boolean;
	provider: string;
	demo: boolean;
	calendarName: string | null;
	lastSyncedAt: string | null;
	connectedAt: string | null;
	busyEventCount: number;
};

export type EventStatus = "draft" | "open" | "finalized" | "cancelled";
export type MyResponse = "available" | "unavailable" | null;
export type EventRole = "organizer" | "participant";

export type EventSummary = {
	id: string;
	title: string;
	description: string | null;
	durationMinutes: number;
	timezone: string;
	status: EventStatus;
	showRecap: boolean;
	role: EventRole;
	organizer: string;
	participantCount: number;
	respondedCount: number;
	myResponded: boolean;
	candidateDateCount: number;
	firstDate: string | null;
	finalStartsAt: string | null;
	finalEndsAt: string | null;
	createdAt: string;
};

export type EventParticipant = {
	id: string;
	name: string;
	email: string;
	role: EventRole;
	responded: boolean;
};

export type CandidateDate = {
	date: string;
	startMinute: number;
	endMinute: number;
};

export type SlotCounts = {
	available: number;
	unavailable: number;
	pending: number;
	total: number;
};

export type EventSlot = {
	key: string;
	date: string;
	startMinute: number;
	endMinute: number;
	startsAt: string;
	endsAt: string;
	myStatus: MyResponse;
	suggestedStatus: Exclude<MyResponse, null>;
	counts?: SlotCounts;
};

export type EventDetail = EventSummary & {
	participants: EventParticipant[];
	dates: CandidateDate[];
	slots: EventSlot[];
	finalSlotKey: string | null;
	calendarConnected: boolean;
	calendarInserted: boolean;
	canRespond: boolean;
};

export type EventInput = {
	title: string;
	description?: string;
	durationMinutes: number;
	timezone?: string;
	participantIds: string[];
	dates: CandidateDate[];
	showRecap: boolean;
	publish?: boolean;
};

export type BusyBlock = { startsAt: string; endsAt: string };

export type DataProvider = {
	mode: "api" | "local";
	getSession: () => Promise<User | null>;
	login: (email: string, password: string) => Promise<User>;
	register: (
		name: string,
		email: string,
		password: string,
	) => Promise<void>;
	logout: () => Promise<void>;
	getCalendar: () => Promise<CalendarStatus>;
	connectCalendar: (calendarName?: string) => Promise<CalendarStatus>;
	disconnectCalendar: () => Promise<CalendarStatus>;
	syncCalendar: () => Promise<CalendarStatus>;
	getBusy: (from: string, to: string) => Promise<BusyBlock[]>;
	getAvailability: () => Promise<{ slots: number[]; updatedAt: string | null }>;
	saveAvailability: (slots: number[]) => Promise<void>;
	listUsers: () => Promise<User[]>;
	listEvents: () => Promise<EventSummary[]>;
	getEvent: (id: string) => Promise<EventDetail>;
	createEvent: (input: EventInput) => Promise<EventDetail>;
	updateEvent: (id: string, input: EventInput) => Promise<EventDetail>;
	publishEvent: (id: string) => Promise<EventDetail>;
	respond: (
		id: string,
		responses: { slotKey: string; status: Exclude<MyResponse, null> }[],
	) => Promise<EventDetail>;
	finalize: (id: string, slotKey: string) => Promise<EventDetail>;
	reopen: (id: string) => Promise<EventDetail>;
	cancel: (id: string) => Promise<EventDetail>;
	remind: (id: string) => Promise<{ reminded: number }>;
	addToCalendar: (id: string) => Promise<{ alreadyAdded: boolean }>;
};
