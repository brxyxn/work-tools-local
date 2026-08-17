package storage

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
	"time"
)

func TestMigrationSetRollsBackAsAUnit(t *testing.T) {
	db, err := sql.Open("sqlite", "file:migration-rollback?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	migrations := fstest.MapFS{
		"migrations/001_create.sql": {Data: []byte("CREATE TABLE first_table (id INTEGER PRIMARY KEY);")},
		"migrations/002_fail.sql":   {Data: []byte("CREATE TABL broken syntax;")},
	}
	if err := migrateFS(context.Background(), db, migrations); err == nil {
		t.Fatal("broken migration set unexpectedly succeeded")
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('first_table', 'schema_migrations')").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("migration left %d tables behind, want 0", count)
	}
}

func TestExistingSchemaIsBackedUpBeforeUpgrade(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "work-tools.db")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	v1 := fstest.MapFS{
		"migrations/001_create.sql": {Data: []byte("CREATE TABLE payload_data (value TEXT); INSERT INTO payload_data VALUES ('preserved');")},
	}
	if err := migrateFS(ctx, db, v1); err != nil {
		t.Fatal(err)
	}
	v2 := fstest.MapFS{
		"migrations/001_create.sql": {Data: v1["migrations/001_create.sql"].Data},
		"migrations/002_more.sql":   {Data: []byte("CREATE TABLE second_table (id INTEGER PRIMARY KEY);")},
	}
	now := time.Date(2026, 8, 17, 6, 7, 8, 0, time.UTC)
	backupPath, err := migrateWithBackup(ctx, db, path, v2, now)
	if err != nil {
		t.Fatal(err)
	}
	wantPath := path + ".20260817T060708Z.bak"
	if backupPath != wantPath {
		t.Fatalf("backup path = %q, want %q", backupPath, wantPath)
	}
	info, err := os.Stat(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("backup permissions = %o, want 600", got)
	}

	backup, err := sql.Open("sqlite", backupPath)
	if err != nil {
		t.Fatal(err)
	}
	defer backup.Close()
	var value string
	if err := backup.QueryRow("SELECT value FROM payload_data").Scan(&value); err != nil {
		t.Fatal(err)
	}
	if value != "preserved" {
		t.Fatalf("backup value = %q", value)
	}
}
