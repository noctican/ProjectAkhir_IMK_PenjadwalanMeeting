import { appRouter, requireAuth } from "../middlewares/auth";
import {
	addToCalendar,
	cancelEvent,
	createEvent,
	detailEvent,
	finalizeEvent,
	listEvents,
	parseId,
	publishEvent,
	reopenEvent,
	remindEvent,
	respondEvent,
	updateEvent,
} from "../controllers/events";
import { respond } from "./helpers";

export const eventRoutes = appRouter();

eventRoutes.use("*", requireAuth);

eventRoutes.get("/", (c) => respond(c, () => listEvents(c)));

eventRoutes.post("/", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => createEvent(c, body));
});

eventRoutes.get("/:id", (c) => respond(c, () => detailEvent(c, parseId(c))));

eventRoutes.patch("/:id", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => updateEvent(c, parseId(c), body));
});

eventRoutes.post("/:id/publish", (c) =>
	respond(c, () => publishEvent(c, parseId(c))),
);

eventRoutes.post("/:id/respond", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => respondEvent(c, parseId(c), body));
});

eventRoutes.post("/:id/finalize", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => finalizeEvent(c, parseId(c), body));
});

eventRoutes.post("/:id/reopen", (c) =>
	respond(c, () => reopenEvent(c, parseId(c))),
);

eventRoutes.post("/:id/cancel", (c) =>
	respond(c, () => cancelEvent(c, parseId(c))),
);

eventRoutes.post("/:id/remind", (c) =>
	respond(c, () => remindEvent(c, parseId(c))),
);

eventRoutes.post("/:id/calendar", (c) =>
	respond(c, () => addToCalendar(c, parseId(c))),
);
