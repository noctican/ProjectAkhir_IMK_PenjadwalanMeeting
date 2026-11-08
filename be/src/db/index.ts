import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import schema from "./schema.sql" with { type: "text" };
import { config } from "../config";

const dbPath = join(process.cwd(), config.dbFile);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath, { create: true });
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");

/** Skema dieksekusi sinkron saat start (CREATE TABLE IF NOT EXISTS, aman diulang). */
export function runMigrations() {
	db.exec(schema);
}

export function uid(): string {
	return crypto.randomUUID();
}

export function nowIso(): string {
	return new Date().toISOString();
}
