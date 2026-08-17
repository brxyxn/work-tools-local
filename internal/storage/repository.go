package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

func (s *Store) payloadByID(ctx context.Context, id string) (Payload, error) {
	payloads, err := s.ListPayloads(ctx)
	if err != nil {
		return Payload{}, err
	}
	for _, payload := range payloads {
		if payload.ID == id {
			return payload, nil
		}
	}
	return Payload{}, fmt.Errorf("payload %q does not exist", id)
}

func (s *Store) UpdatePayload(ctx context.Context, update PayloadUpdate) (Payload, error) {
	if update.ID == "" {
		return Payload{}, errors.New("payload ID is required")
	}
	current, err := s.payloadByID(ctx, update.ID)
	if err != nil {
		return Payload{}, err
	}
	if update.Name != nil {
		current.Name = *update.Name
	}
	if update.JSON != nil {
		if !json.Valid([]byte(*update.JSON)) {
			return Payload{}, errors.New("payload contains invalid JSON")
		}
		current.JSON = *update.JSON
	}
	if update.Tags != nil {
		current.Tags = uniqueTags(*update.Tags)
	}
	if update.Metadata != nil {
		current.Metadata = *update.Metadata
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Payload{}, fmt.Errorf("begin payload update: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx, `UPDATE payloads SET name = ?, json = ?, source_system = ?,
        payload_type = ?, queue_uri = ?, payload_created_at = ? WHERE id = ?`, nullable(current.Name),
		current.JSON, nullable(current.Metadata.SourceSystem), nullable(current.Metadata.Type),
		nullable(current.Metadata.QueueURI), nullable(current.Metadata.CreatedAt), current.ID)
	if err != nil {
		return Payload{}, fmt.Errorf("update payload: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return Payload{}, fmt.Errorf("read payload update result: %w", err)
	}
	if rows != 1 {
		return Payload{}, fmt.Errorf("payload %q does not exist", current.ID)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM payload_tags WHERE payload_id = ?", current.ID); err != nil {
		return Payload{}, fmt.Errorf("replace payload tags: %w", err)
	}
	for position, tag := range current.Tags {
		if _, err := tx.ExecContext(ctx, "INSERT INTO payload_tags(payload_id, position, tag) VALUES (?, ?, ?)", current.ID, position, tag); err != nil {
			return Payload{}, fmt.Errorf("insert payload tag: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return Payload{}, fmt.Errorf("commit payload update: %w", err)
	}
	return current, nil
}

func (s *Store) RestorePayloads(ctx context.Context, payloads []Payload) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin payload restore: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	for _, payload := range payloads {
		if payload.ID == "" || !json.Valid([]byte(payload.JSON)) {
			return fmt.Errorf("payload %q is invalid", payload.ID)
		}
		var exists int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM payloads WHERE id = ?", payload.ID).Scan(&exists); err != nil {
			return fmt.Errorf("check restored payload: %w", err)
		}
		if exists != 0 {
			continue
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO payloads(
            id, name, json, created_at_unix_ms, source_system, payload_type, queue_uri, payload_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, payload.ID, nullable(payload.Name), payload.JSON,
			payload.CreatedAtUnixMS, nullable(payload.Metadata.SourceSystem), nullable(payload.Metadata.Type),
			nullable(payload.Metadata.QueueURI), nullable(payload.Metadata.CreatedAt))
		if err != nil {
			return fmt.Errorf("restore payload: %w", err)
		}
		for position, tag := range uniqueTags(payload.Tags) {
			if _, err := tx.ExecContext(ctx, "INSERT INTO payload_tags(payload_id, position, tag) VALUES (?, ?, ?)", payload.ID, position, tag); err != nil {
				return fmt.Errorf("restore payload tag: %w", err)
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit payload restore: %w", err)
	}
	return nil
}
