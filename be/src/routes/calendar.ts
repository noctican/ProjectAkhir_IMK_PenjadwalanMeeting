import { appRouter, requireAuth } from "../middlewares/auth";
import { busy, connect, disconnect, status, sync } from "../controllers/calendar";
import { getAvailability, saveAvailability } from "../controllers/availability";
import { respond } from "./helpers";

export const calendarRoutes = appRouter();

calendarRoutes.use("*", requireAuth);

calendarRoutes.get("/", (c) => respond(c, () => status(c)));

calendarRoutes.post("/connect", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => connect(c, body));
});

calendarRoutes.post("/disconnect", (c) => respond(c, () => disconnect(c)));

calendarRoutes.post("/sync", (c) => respond(c, () => sync(c)));

calendarRoutes.get("/busy", (c) => respond(c, () => busy(c)));

export const availabilityRoutes = appRouter();

availabilityRoutes.use("*", requireAuth);

availabilityRoutes.get("/", (c) => respond(c, () => getAvailability(c)));

availabilityRoutes.put("/", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => saveAvailability(c, body));
});
