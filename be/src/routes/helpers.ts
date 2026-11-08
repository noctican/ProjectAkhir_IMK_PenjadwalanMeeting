import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpError } from "../controllers/http-error";

type ControllerResult = {
	status?: number;
	message?: string;
	data?: unknown;
};

/** Format respons JSON seragam: { success, message?, data? }. */
export async function respond(
	c: Context,
	fn: () => ControllerResult | Promise<ControllerResult>,
) {
	try {
		const result = await fn();
		return c.json(
			{
				success: true,
				...(result.message ? { message: result.message } : {}),
				...(result.data !== undefined ? { data: result.data } : {}),
			},
			(result.status ?? 200) as ContentfulStatusCode,
		);
	} catch (err) {
		if (err instanceof HttpError) {
			return c.json(
				{
					success: false,
					message: err.message,
					...(err.data !== undefined ? { data: err.data } : {}),
				},
				err.status as ContentfulStatusCode,
			);
		}
		console.error(err);
		return c.json({ success: false, message: "Terjadi kesalahan server" }, 500);
	}
}
