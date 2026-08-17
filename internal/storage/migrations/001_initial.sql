CREATE TABLE payloads (
    id TEXT PRIMARY KEY,
    name TEXT,
    json TEXT NOT NULL CHECK (json_valid(json)),
    created_at_unix_ms INTEGER NOT NULL,
    source_system TEXT,
    payload_type TEXT,
    queue_uri TEXT,
    payload_created_at TEXT
);

CREATE INDEX payloads_created_at_idx ON payloads(created_at_unix_ms DESC);

CREATE TABLE payload_tags (
    payload_id TEXT NOT NULL REFERENCES payloads(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    tag TEXT NOT NULL,
    PRIMARY KEY (payload_id, position)
);

CREATE TABLE text_diff_draft (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    original_text TEXT NOT NULL DEFAULT '',
    changed_text TEXT NOT NULL DEFAULT '',
    view_mode TEXT NOT NULL DEFAULT 'split' CHECK (view_mode IN ('split', 'unified')),
    updated_at_unix_ms INTEGER NOT NULL
);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL CHECK (json_valid(value_json))
);
