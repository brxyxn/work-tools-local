package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *Store) ListPayloads(ctx context.Context) ([]Payload, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, COALESCE(name, ''), json, created_at_unix_ms,
        COALESCE(source_system, ''), COALESCE(payload_type, ''), COALESCE(queue_uri, ''),
        COALESCE(payload_created_at, '') FROM payloads ORDER BY created_at_unix_ms DESC, rowid ASC`)
	if err != nil {
		return nil, fmt.Errorf("list payloads: %w", err)
	}
	payloads := make([]Payload, 0)
	for rows.Next() {
		var payload Payload
		if err := rows.Scan(&payload.ID, &payload.Name, &payload.JSON, &payload.CreatedAtUnixMS,
			&payload.Metadata.SourceSystem, &payload.Metadata.Type, &payload.Metadata.QueueURI,
			&payload.Metadata.CreatedAt); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scan payload: %w", err)
		}
		payload.Tags = []string{}
		payloads = append(payloads, payload)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close payload rows: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate payloads: %w", err)
	}

	index := make(map[string]int, len(payloads))
	for i := range payloads {
		index[payloads[i].ID] = i
	}
	tagRows, err := s.db.QueryContext(ctx, "SELECT payload_id, tag FROM payload_tags ORDER BY payload_id, position")
	if err != nil {
		return nil, fmt.Errorf("list payload tags: %w", err)
	}
	defer tagRows.Close()
	for tagRows.Next() {
		var id, tag string
		if err := tagRows.Scan(&id, &tag); err != nil {
			return nil, fmt.Errorf("scan payload tag: %w", err)
		}
		if i, ok := index[id]; ok {
			payloads[i].Tags = append(payloads[i].Tags, tag)
		}
	}
	if err := tagRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate payload tags: %w", err)
	}
	return payloads, nil
}

func (s *Store) DeletePayloads(ctx context.Context, ids []string) ([]Payload, error) {
	if len(ids) == 0 {
		return []Payload{}, nil
	}
	all, err := s.ListPayloads(ctx)
	if err != nil {
		return nil, err
	}
	remove := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		remove[id] = struct{}{}
	}
	removed := make([]Payload, 0, len(ids))
	for _, payload := range all {
		if _, ok := remove[payload.ID]; ok {
			removed = append(removed, payload)
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin delete payloads: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx, "DELETE FROM payloads WHERE id = ?", id); err != nil {
			return nil, fmt.Errorf("delete payload %q: %w", id, err)
		}
	}
	var selectedJSON string
	err = tx.QueryRowContext(ctx, "SELECT value_json FROM app_settings WHERE key = 'selected_payload_id'").Scan(&selectedJSON)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("read selected payload: %w", err)
	}
	var selected string
	if json.Unmarshal([]byte(selectedJSON), &selected) == nil {
		if _, deleted := remove[selected]; deleted {
			var replacement string
			err := tx.QueryRowContext(ctx, `SELECT id FROM payloads
                ORDER BY created_at_unix_ms DESC, rowid ASC LIMIT 1`).Scan(&replacement)
			if errors.Is(err, sql.ErrNoRows) {
				if _, err := tx.ExecContext(ctx, "DELETE FROM app_settings WHERE key = 'selected_payload_id'"); err != nil {
					return nil, fmt.Errorf("clear selected payload: %w", err)
				}
			} else if err != nil {
				return nil, fmt.Errorf("choose replacement payload: %w", err)
			} else {
				value, _ := json.Marshal(replacement)
				if _, err := tx.ExecContext(ctx, `UPDATE app_settings SET value_json = ?
                    WHERE key = 'selected_payload_id'`, string(value)); err != nil {
					return nil, fmt.Errorf("replace selected payload: %w", err)
				}
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit payload deletion: %w", err)
	}
	return removed, nil
}

func (s *Store) SelectPayload(ctx context.Context, id *string) error {
	if id == nil {
		_, err := s.db.ExecContext(ctx, "DELETE FROM app_settings WHERE key = 'selected_payload_id'")
		return err
	}
	var exists int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM payloads WHERE id = ?", *id).Scan(&exists); err != nil {
		return fmt.Errorf("check selected payload: %w", err)
	}
	if exists == 0 {
		return fmt.Errorf("payload %q does not exist", *id)
	}
	value, _ := json.Marshal(*id)
	_, err := s.db.ExecContext(ctx, `INSERT INTO app_settings(key, value_json) VALUES ('selected_payload_id', ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`, string(value))
	return err
}

func (s *Store) SaveTextDiffDraft(ctx context.Context, draft TextDiffDraft) error {
	if draft.ViewMode != "split" && draft.ViewMode != "unified" {
		return fmt.Errorf("invalid Text Diff view mode %q", draft.ViewMode)
	}
	draft.UpdatedAt = time.Now().UnixMilli()
	_, err := s.db.ExecContext(ctx, `INSERT INTO text_diff_draft(id, original_text, changed_text, view_mode, updated_at_unix_ms)
        VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET original_text = excluded.original_text,
        changed_text = excluded.changed_text, view_mode = excluded.view_mode, updated_at_unix_ms = excluded.updated_at_unix_ms`,
		draft.OriginalText, draft.ChangedText, draft.ViewMode, draft.UpdatedAt)
	if err != nil {
		return fmt.Errorf("save Text Diff draft: %w", err)
	}
	return nil
}

func (s *Store) SaveSettings(ctx context.Context, settings map[string]any) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin settings update: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	for key, value := range settings {
		if strings.TrimSpace(key) == "" || key == "selected_payload_id" {
			return fmt.Errorf("invalid setting key %q", key)
		}
		encoded, err := json.Marshal(value)
		if err != nil {
			return fmt.Errorf("encode setting %q: %w", key, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO app_settings(key, value_json) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`, key, string(encoded)); err != nil {
			return fmt.Errorf("save setting %q: %w", key, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit settings: %w", err)
	}
	return nil
}

func (s *Store) LoadWorkspace(ctx context.Context) (WorkspaceState, error) {
	payloads, err := s.ListPayloads(ctx)
	if err != nil {
		return WorkspaceState{}, err
	}
	state := WorkspaceState{
		Payloads:      payloads,
		TextDiffDraft: TextDiffDraft{ViewMode: "split"},
		Settings:      make(map[string]any),
	}
	err = s.db.QueryRowContext(ctx, `SELECT original_text, changed_text, view_mode, updated_at_unix_ms
        FROM text_diff_draft WHERE id = 1`).Scan(&state.TextDiffDraft.OriginalText,
		&state.TextDiffDraft.ChangedText, &state.TextDiffDraft.ViewMode, &state.TextDiffDraft.UpdatedAt)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return WorkspaceState{}, fmt.Errorf("load Text Diff draft: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, "SELECT key, value_json FROM app_settings ORDER BY key")
	if err != nil {
		return WorkspaceState{}, fmt.Errorf("load settings: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var key, encoded string
		if err := rows.Scan(&key, &encoded); err != nil {
			return WorkspaceState{}, fmt.Errorf("scan setting: %w", err)
		}
		if key == "selected_payload_id" {
			var id string
			if err := json.Unmarshal([]byte(encoded), &id); err != nil {
				return WorkspaceState{}, fmt.Errorf("decode selected payload: %w", err)
			}
			state.SelectedPayloadID = &id
			continue
		}
		var value any
		if err := json.Unmarshal([]byte(encoded), &value); err != nil {
			return WorkspaceState{}, fmt.Errorf("decode setting %q: %w", key, err)
		}
		state.Settings[key] = value
	}
	if err := rows.Err(); err != nil {
		return WorkspaceState{}, fmt.Errorf("iterate settings: %w", err)
	}
	return state, nil
}
