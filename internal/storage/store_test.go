package storage_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/brxyxn/work-tools-local/internal/storage"
)

func openTestStore(t *testing.T) (*storage.Store, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "Work Tools", "work-tools.db")
	store, err := storage.Open(context.Background(), path)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store, path
}

func TestOpenCreatesSchemaAndConfiguresSQLite(t *testing.T) {
	store, path := openTestStore(t)

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("database was not created: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("database permissions = %o, want 600", got)
	}

	var version int
	if err := store.DB().QueryRow("SELECT MAX(version) FROM schema_migrations").Scan(&version); err != nil {
		t.Fatalf("read schema version: %v", err)
	}
	if version != 1 {
		t.Fatalf("schema version = %d, want 1", version)
	}

	for pragma, want := range map[string]string{
		"foreign_keys": "1",
		"journal_mode": "wal",
		"synchronous":  "1",
		"busy_timeout": "5000",
	} {
		var got string
		if err := store.DB().QueryRow("PRAGMA " + pragma).Scan(&got); err != nil {
			t.Fatalf("read PRAGMA %s: %v", pragma, err)
		}
		if got != want {
			t.Errorf("PRAGMA %s = %q, want %q", pragma, got, want)
		}
	}
}

func TestPayloadBatchPersistsAcrossReopen(t *testing.T) {
	ctx := context.Background()
	store, path := openTestStore(t)

	created, err := store.CreatePayloads(ctx, []storage.NewPayload{
		{
			Name: "quote request", JSON: `{"quote_request_id":"qr-1"}`, Tags: []string{"env:test", "kind:quote"},
			Metadata: storage.PayloadMetadata{SourceSystem: "test-suite", Type: "quote_request"},
		},
		{JSON: `[1,2,3]`},
	})
	if err != nil {
		t.Fatalf("create payloads: %v", err)
	}
	if len(created) != 2 || created[0].ID == "" || created[0].CreatedAtUnixMS == 0 {
		t.Fatalf("unexpected created payloads: %#v", created)
	}
	if err := store.Close(); err != nil {
		t.Fatalf("close store: %v", err)
	}

	reopened, err := storage.Open(ctx, path)
	if err != nil {
		t.Fatalf("reopen store: %v", err)
	}
	t.Cleanup(func() { _ = reopened.Close() })

	state, err := reopened.LoadWorkspace(ctx)
	if err != nil {
		t.Fatalf("load workspace: %v", err)
	}
	if len(state.Payloads) != 2 {
		t.Fatalf("payload count = %d, want 2", len(state.Payloads))
	}
	if state.SelectedPayloadID == nil || *state.SelectedPayloadID != created[0].ID {
		t.Fatalf("selected payload = %#v, want %q", state.SelectedPayloadID, created[0].ID)
	}
	if got := state.Payloads[0].Tags; len(got) != 2 || got[0] != "env:test" || got[1] != "kind:quote" {
		t.Fatalf("ordered tags = %#v", got)
	}
}

func TestPayloadBatchIsAtomicAndTagsCascade(t *testing.T) {
	ctx := context.Background()
	store, _ := openTestStore(t)

	if _, err := store.CreatePayloads(ctx, []storage.NewPayload{{JSON: `{}`}, {JSON: `{invalid`}}); err == nil {
		t.Fatal("invalid JSON batch unexpectedly succeeded")
	}
	var count int
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM payloads").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("payload count after failed batch = %d, want 0", count)
	}

	created, err := store.CreatePayloads(ctx, []storage.NewPayload{{JSON: `{}`, Tags: []string{"a:1", "b:2"}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.DeletePayloads(ctx, []string{created[0].ID}); err != nil {
		t.Fatal(err)
	}
	if err := store.DB().QueryRow("SELECT COUNT(*) FROM payload_tags").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("tag count after payload delete = %d, want 0", count)
	}
}

func TestDeletingSelectedPayloadSelectsFirstRemainingPayload(t *testing.T) {
	ctx := context.Background()
	store, _ := openTestStore(t)
	created, err := store.CreatePayloads(ctx, []storage.NewPayload{{JSON: `{"first":true}`}, {JSON: `{"second":true}`}})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SelectPayload(ctx, &created[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DeletePayloads(ctx, []string{created[0].ID}); err != nil {
		t.Fatal(err)
	}
	state, err := store.LoadWorkspace(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.SelectedPayloadID == nil || *state.SelectedPayloadID != created[1].ID {
		t.Fatalf("selected payload = %#v, want %q", state.SelectedPayloadID, created[1].ID)
	}
}

func TestDraftAndSettingsRoundTrip(t *testing.T) {
	ctx := context.Background()
	store, _ := openTestStore(t)
	draft := storage.TextDiffDraft{OriginalText: "before", ChangedText: "after", ViewMode: "unified"}
	if err := store.SaveTextDiffDraft(ctx, draft); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveSettings(ctx, map[string]any{"theme": "dark", "selected_tool": "json-visualizer"}); err != nil {
		t.Fatal(err)
	}

	state, err := store.LoadWorkspace(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.TextDiffDraft.OriginalText != "before" || state.TextDiffDraft.ViewMode != "unified" {
		t.Fatalf("draft = %#v", state.TextDiffDraft)
	}
	if state.Settings["theme"] != "dark" || state.Settings["selected_tool"] != "json-visualizer" {
		t.Fatalf("settings = %#v", state.Settings)
	}
}

func TestUpdateAndRestorePayloads(t *testing.T) {
	ctx := context.Background()
	store, _ := openTestStore(t)
	created, err := store.CreatePayloads(ctx, []storage.NewPayload{{
		Name: "before", JSON: `{"value":1}`, Tags: []string{"one:1"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	name := "after"
	jsonText := `{"value":2}`
	tags := []string{"two:2", "two:2", "three:3"}
	metadata := storage.PayloadMetadata{CreatedAt: "2026-08-17T00:00:00Z"}
	updated, err := store.UpdatePayload(ctx, storage.PayloadUpdate{
		ID: created[0].ID, Name: &name, JSON: &jsonText, Tags: &tags, Metadata: &metadata,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "after" || updated.JSON != jsonText || len(updated.Tags) != 2 {
		t.Fatalf("updated payload = %#v", updated)
	}

	removed, err := store.DeletePayloads(ctx, []string{updated.ID})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.RestorePayloads(ctx, removed); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.ListPayloads(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded) != 1 || loaded[0].ID != updated.ID || loaded[0].Metadata.CreatedAt != metadata.CreatedAt {
		t.Fatalf("restored payloads = %#v", loaded)
	}
}

func TestUpdateRejectsInvalidJSONWithoutChangingPayload(t *testing.T) {
	ctx := context.Background()
	store, _ := openTestStore(t)
	created, err := store.CreatePayloads(ctx, []storage.NewPayload{{JSON: `{"safe":true}`}})
	if err != nil {
		t.Fatal(err)
	}
	invalid := `{invalid`
	if _, err := store.UpdatePayload(ctx, storage.PayloadUpdate{ID: created[0].ID, JSON: &invalid}); err == nil {
		t.Fatal("invalid update unexpectedly succeeded")
	}
	loaded, err := store.ListPayloads(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0].JSON != `{"safe":true}` {
		t.Fatalf("payload JSON changed to %q", loaded[0].JSON)
	}
}

func TestCorruptDatabaseIsNotModified(t *testing.T) {
	path := filepath.Join(t.TempDir(), "work-tools.db")
	original := []byte("not a sqlite database")
	if err := os.WriteFile(path, original, 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := storage.Open(context.Background(), path); err == nil {
		t.Fatal("opening corrupt database unexpectedly succeeded")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(original) {
		t.Fatalf("corrupt database changed: got %q, want %q", after, original)
	}
}
