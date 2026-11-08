-- TemuYuk — skema basis data (SQLite)
CREATE TABLE IF NOT EXISTS users (
	id            TEXT PRIMARY KEY,
	name          TEXT NOT NULL,
	email         TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role          TEXT NOT NULL DEFAULT 'anggota',
	created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_connections (
	user_id        TEXT PRIMARY KEY REFERENCES users(id),
	provider       TEXT NOT NULL DEFAULT 'google',
	status         TEXT NOT NULL DEFAULT 'terputus',
	calendar_name  TEXT,
	connected_at   TEXT,
	last_synced_at TEXT
);

-- Hanya waktu sibuk yang dibaca aplikasi; judul event pribadi tidak disimpan.
CREATE TABLE IF NOT EXISTS busy_events (
	id       TEXT PRIMARY KEY,
	user_id  TEXT NOT NULL REFERENCES users(id),
	starts_at TEXT NOT NULL,
	ends_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_busy_user ON busy_events(user_id, starts_at);

-- 336 slot (7 hari x 48 slot) disimpan sebagai JSON array 0/1.
CREATE TABLE IF NOT EXISTS weekly_availability (
	user_id    TEXT PRIMARY KEY REFERENCES users(id),
	slots      TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
	id              TEXT PRIMARY KEY,
	title           TEXT NOT NULL,
	description     TEXT,
	duration_minutes INTEGER NOT NULL,
	timezone        TEXT NOT NULL DEFAULT 'Asia/Jakarta',
	status          TEXT NOT NULL DEFAULT 'draft',
	show_recap      INTEGER NOT NULL DEFAULT 0,
	created_by      TEXT NOT NULL REFERENCES users(id),
	created_at      TEXT NOT NULL,
	updated_at      TEXT NOT NULL,
	final_slot_key  TEXT,
	final_starts_at TEXT,
	final_ends_at   TEXT,
	cancelled_at    TEXT
);

CREATE TABLE IF NOT EXISTS event_dates (
	id           TEXT PRIMARY KEY,
	event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
	candidate_date TEXT NOT NULL,
	start_minute INTEGER NOT NULL,
	end_minute   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_dates ON event_dates(event_id, candidate_date);

CREATE TABLE IF NOT EXISTS event_participants (
	event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
	user_id      TEXT NOT NULL REFERENCES users(id),
	role         TEXT NOT NULL DEFAULT 'peserta',
	invited_at   TEXT NOT NULL,
	responded_at TEXT,
	reminded_at  TEXT,
	PRIMARY KEY (event_id, user_id)
);

-- Respons per kandidat waktu. slot_key = "<YYYY-MM-DD>|<menit-mulai>".
CREATE TABLE IF NOT EXISTS event_responses (
	event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
	user_id   TEXT NOT NULL REFERENCES users(id),
	slot_key  TEXT NOT NULL,
	status    TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (event_id, user_id, slot_key)
);

CREATE TABLE IF NOT EXISTS calendar_insertions (
	event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
	user_id     TEXT NOT NULL REFERENCES users(id),
	inserted_at TEXT NOT NULL,
	PRIMARY KEY (event_id, user_id)
);
