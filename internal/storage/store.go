package storage

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	sqlite "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type Store struct {
	db   *sql.DB
	path string
}

func DefaultPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve Application Support directory: %w", err)
	}
	return filepath.Join(base, "Work Tools", "work-tools.db"), nil
}

func Open(ctx context.Context, path string) (*Store, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("database path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	dsnURL := &url.URL{Scheme: "file", Path: path}
	query := dsnURL.Query()
	for _, pragma := range []string{
		"foreign_keys(1)",
		"journal_mode(WAL)",
		"synchronous(NORMAL)",
		"busy_timeout(5000)",
	} {
		query.Add("_pragma", pragma)
	}
	dsnURL.RawQuery = query.Encode()

	db, err := sql.Open("sqlite", dsnURL.String())
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	store := &Store{db: db, path: path}

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("connect database: %w", err)
	}
	var integrity string
	if err := db.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&integrity); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("check database integrity: %w", err)
	}
	if integrity != "ok" {
		_ = db.Close()
		return nil, fmt.Errorf("check database integrity: %s", integrity)
	}
	if err := store.migrate(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := os.Chmod(path, 0o600); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("secure database permissions: %w", err)
	}
	return store, nil
}

func (s *Store) Close() error { return s.db.Close() }
func (s *Store) DB() *sql.DB  { return s.db }
func (s *Store) Path() string { return s.path }

func (s *Store) migrate(ctx context.Context) error {
	_, err := migrateWithBackup(ctx, s.db, s.path, migrationFiles, time.Now().UTC())
	return err
}

func latestMigrationVersion(files fs.FS) (int, error) {
	entries, err := fs.ReadDir(files, "migrations")
	if err != nil {
		return 0, fmt.Errorf("read migrations: %w", err)
	}
	latest := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		prefix, _, ok := strings.Cut(entry.Name(), "_")
		if !ok {
			return 0, fmt.Errorf("invalid migration filename %q", entry.Name())
		}
		version, err := strconv.Atoi(prefix)
		if err != nil {
			return 0, fmt.Errorf("invalid migration version %q: %w", prefix, err)
		}
		if version > latest {
			latest = version
		}
	}
	return latest, nil
}

func appliedMigrationVersion(ctx context.Context, db *sql.DB) (int, error) {
	var tableExists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'schema_migrations'`).Scan(&tableExists); err != nil {
		return 0, fmt.Errorf("check migration table: %w", err)
	}
	if tableExists == 0 {
		return 0, nil
	}
	var applied int
	if err := db.QueryRowContext(ctx, "SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&applied); err != nil {
		return 0, fmt.Errorf("read applied migration: %w", err)
	}
	return applied, nil
}

type onlineBackuper interface {
	NewBackup(string) (*sqlite.Backup, error)
}

func createOnlineBackup(ctx context.Context, db *sql.DB, destination string) error {
	connection, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire backup connection: %w", err)
	}
	defer connection.Close()
	if err := connection.Raw(func(driverConnection any) error {
		backuper, ok := driverConnection.(onlineBackuper)
		if !ok {
			return errors.New("SQLite driver does not support online backup")
		}
		backup, err := backuper.NewBackup(destination)
		if err != nil {
			return fmt.Errorf("start database backup: %w", err)
		}
		if _, err := backup.Step(-1); err != nil {
			_ = backup.Finish()
			return fmt.Errorf("copy database backup: %w", err)
		}
		if err := backup.Finish(); err != nil {
			return fmt.Errorf("finish database backup: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}
	if err := os.Chmod(destination, 0o600); err != nil {
		return fmt.Errorf("secure database backup permissions: %w", err)
	}
	return nil
}

func migrateWithBackup(ctx context.Context, db *sql.DB, path string, files fs.FS, now time.Time) (string, error) {
	latest, err := latestMigrationVersion(files)
	if err != nil {
		return "", err
	}
	applied, err := appliedMigrationVersion(ctx, db)
	if err != nil {
		return "", err
	}
	backupPath := ""
	if applied > 0 && applied < latest {
		backupPath = path + "." + now.UTC().Format("20060102T150405Z") + ".bak"
		if err := createOnlineBackup(ctx, db, backupPath); err != nil {
			return "", fmt.Errorf("back up database before migration: %w", err)
		}
	}
	if err := migrateFS(ctx, db, files); err != nil {
		return backupPath, err
	}
	return backupPath, nil
}

func migrateFS(ctx context.Context, db *sql.DB, files fs.FS) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at_unix_ms INTEGER NOT NULL
    )`); err != nil {
		return fmt.Errorf("create migration table: %w", err)
	}

	entries, err := fs.ReadDir(files, "migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		prefix, _, ok := strings.Cut(entry.Name(), "_")
		if !ok {
			return fmt.Errorf("invalid migration filename %q", entry.Name())
		}
		version, err := strconv.Atoi(prefix)
		if err != nil {
			return fmt.Errorf("invalid migration version %q: %w", prefix, err)
		}
		var applied int
		err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&applied)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", version, err)
		}
		if applied != 0 {
			continue
		}
		script, err := fs.ReadFile(files, "migrations/"+entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %d: %w", version, err)
		}
		if _, err := tx.ExecContext(ctx, string(script)); err != nil {
			return fmt.Errorf("apply migration %d: %w", version, err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO schema_migrations(version, applied_at_unix_ms) VALUES (?, ?)", version, time.Now().UnixMilli()); err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}
	return nil
}

func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func uniqueTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		if _, exists := seen[tag]; exists {
			continue
		}
		seen[tag] = struct{}{}
		result = append(result, tag)
	}
	return result
}

func (s *Store) CreatePayloads(ctx context.Context, inputs []NewPayload) ([]Payload, error) {
	if len(inputs) == 0 {
		return nil, errors.New("at least one payload is required")
	}
	for i, input := range inputs {
		if !json.Valid([]byte(input.JSON)) {
			return nil, fmt.Errorf("payload %d contains invalid JSON", i+1)
		}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin payload batch: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	created := make([]Payload, 0, len(inputs))
	createdAt := time.Now().UnixMilli()
	for _, input := range inputs {
		payload := Payload{
			ID: uuid.NewString(), Name: input.Name, JSON: input.JSON,
			CreatedAtUnixMS: createdAt, Tags: uniqueTags(input.Tags), Metadata: input.Metadata,
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO payloads(
            id, name, json, created_at_unix_ms, source_system, payload_type, queue_uri, payload_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, payload.ID, nullable(payload.Name), payload.JSON,
			payload.CreatedAtUnixMS, nullable(payload.Metadata.SourceSystem), nullable(payload.Metadata.Type),
			nullable(payload.Metadata.QueueURI), nullable(payload.Metadata.CreatedAt))
		if err != nil {
			return nil, fmt.Errorf("insert payload: %w", err)
		}
		for position, tag := range payload.Tags {
			if _, err := tx.ExecContext(ctx, "INSERT INTO payload_tags(payload_id, position, tag) VALUES (?, ?, ?)", payload.ID, position, tag); err != nil {
				return nil, fmt.Errorf("insert payload tag: %w", err)
			}
		}
		created = append(created, payload)
	}
	selected, _ := json.Marshal(created[0].ID)
	if _, err := tx.ExecContext(ctx, `INSERT INTO app_settings(key, value_json)
        VALUES ('selected_payload_id', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
		string(selected)); err != nil {
		return nil, fmt.Errorf("select created payload: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit payload batch: %w", err)
	}
	return created, nil
}
