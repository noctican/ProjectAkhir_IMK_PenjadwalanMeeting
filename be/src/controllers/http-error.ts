/** Error dengan status HTTP; dilempar controller, ditangkap helper respond(). */
export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public data?: unknown,
	) {
		super(message);
		this.name = "HttpError";
	}
}
