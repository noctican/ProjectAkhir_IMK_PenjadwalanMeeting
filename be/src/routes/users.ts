import { appRouter, requireAuth } from "../middlewares/auth";
import { db } from "../db";
import type { AppUser } from "../middlewares/auth";
import { respond } from "./helpers";

export const userRoutes = appRouter();

userRoutes.use("*", requireAuth);

/** Direktori pengguna untuk memilih peserta event. */
userRoutes.get("/directory", (c) =>
	respond(c, () => {
		const user = c.get("user") as AppUser;
		const rows = db
			.query<{ id: string; name: string; email: string }, [string]>(
				"SELECT id, name, email FROM users WHERE id != ? ORDER BY name",
			)
			.all(user.id);
		return { data: { users: rows } };
	}),
);
