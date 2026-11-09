import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { runMigrations } from "./db";
import { appRouter, requireAuth } from "./middlewares/auth";
import { authRoutes } from "./routes/auth";
import { availabilityRoutes, calendarRoutes } from "./routes/calendar";
import { eventRoutes } from "./routes/events";
import { userRoutes } from "./routes/users";
import { respond } from "./routes/helpers";

runMigrations();

const app = new Hono();

app.use(
	"*",
	cors({
		origin: config.corsOrigin,
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.get("/", (c) =>
	c.json({ success: true, message: "TemuYuk API", version: "2.0.0" }),
);

const api = appRouter();

api.get("/health", (c) => respond(c, () => ({ message: "ok" })));

api.route("/auth", authRoutes);
api.route("/calendar", calendarRoutes);
api.route("/availability", availabilityRoutes);
api.route("/events", eventRoutes);
api.route("/users", userRoutes);

app.route("/api", api);

app.notFound((c) =>
	c.json({ success: false, message: "Endpoint tidak ditemukan" }, 404),
);

export default {
	port: config.port,
	hostname: config.host,
	fetch: app.fetch,
};

console.log(
	`🚀 TemuYuk API berjalan di http://${config.host}:${config.port}/api`,
);
console.log(`📁 Basis data: ${config.dbFile}`);
