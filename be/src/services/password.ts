/** Hash password dengan Argon2id (Bun native). */
export function hashPassword(password: string): string {
	return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return Bun.password.verify(password, hash);
}
