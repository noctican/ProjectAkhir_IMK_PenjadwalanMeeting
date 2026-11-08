import { login, me, register } from "../controllers/auth";
import {
	appRouter,
	clearAuthCookie,
	createToken,
	requireAuth,
	setAuthCookie,
} from "../middlewares/auth";
import { respond } from "./helpers";

export const authRoutes = appRouter();

authRoutes.post("/register", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, () => register(body));
});

authRoutes.post("/login", async (c) => {
	const body = await c.req.json().catch(() => null);
	return respond(c, async () => {
		const result = await login(body);
		const user = (result.data as { user: { id: string; role: string } }).user;
		setAuthCookie(c, await createToken(user));
		return { message: result.message, data: { user } };
	});
});

authRoutes.post("/logout", requireAuth, (c) => {
	clearAuthCookie(c);
	return respond(c, () => ({ message: "Berhasil keluar" }));
});

authRoutes.get("/me", requireAuth, (c) => respond(c, () => me(c)));
