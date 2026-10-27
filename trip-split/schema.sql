PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    destination TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS members_trip ON members(trip_id, sort_order);
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0),
    spent_on TEXT NOT NULL,
    category TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    split_mode TEXT NOT NULL CHECK(split_mode IN ('equal', 'units', 'exact')),
    client_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(trip_id, client_id)
);
CREATE INDEX IF NOT EXISTS expenses_trip ON expenses(trip_id, spent_on DESC);
CREATE TABLE IF NOT EXISTS expense_payments (
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK(amount > 0),
    PRIMARY KEY(expense_id, member_id)
);
CREATE TABLE IF NOT EXISTS expense_shares (
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK(amount >= 0),
    weight INTEGER,
    PRIMARY KEY(expense_id, member_id)
);
CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    payer_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    payee_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK(amount > 0),
    paid_on TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    client_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK(payer_id <> payee_id),
    UNIQUE(trip_id, client_id)
);
CREATE INDEX IF NOT EXISTS settlements_trip ON settlements(trip_id, paid_on DESC);
PRAGMA user_version = 1;
