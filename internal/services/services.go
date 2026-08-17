package services

import (
	"context"
	"errors"

	"github.com/brxyxn/work-tools-local/internal/storage"
)

var errStorageUnavailable = errors.New("local storage is unavailable")

type RecoveryInfo struct {
	Message      string `json:"message"`
	DatabasePath string `json:"databasePath"`
	LogPath      string `json:"logPath"`
}

type WorkspaceLoadResult struct {
	State    *storage.WorkspaceState `json:"state,omitempty"`
	Recovery *RecoveryInfo           `json:"recovery,omitempty"`
}

type PayloadService struct {
	store *storage.Store
}

func NewPayloadService(store *storage.Store) *PayloadService {
	return &PayloadService{store: store}
}

func (s *PayloadService) List() ([]storage.Payload, error) {
	if s.store == nil {
		return nil, errStorageUnavailable
	}
	return s.store.ListPayloads(context.Background())
}

func (s *PayloadService) CreateBatch(payloads []storage.NewPayload) ([]storage.Payload, error) {
	if s.store == nil {
		return nil, errStorageUnavailable
	}
	return s.store.CreatePayloads(context.Background(), payloads)
}

func (s *PayloadService) Update(update storage.PayloadUpdate) (storage.Payload, error) {
	if s.store == nil {
		return storage.Payload{}, errStorageUnavailable
	}
	return s.store.UpdatePayload(context.Background(), update)
}

func (s *PayloadService) Delete(ids []string) ([]storage.Payload, error) {
	if s.store == nil {
		return nil, errStorageUnavailable
	}
	return s.store.DeletePayloads(context.Background(), ids)
}

func (s *PayloadService) Restore(payloads []storage.Payload) error {
	if s.store == nil {
		return errStorageUnavailable
	}
	return s.store.RestorePayloads(context.Background(), payloads)
}

func (s *PayloadService) Select(id *string) error {
	if s.store == nil {
		return errStorageUnavailable
	}
	return s.store.SelectPayload(context.Background(), id)
}

type WorkspaceService struct {
	store    *storage.Store
	recovery *RecoveryInfo
}

func NewWorkspaceService(store *storage.Store, recovery *RecoveryInfo) *WorkspaceService {
	return &WorkspaceService{store: store, recovery: recovery}
}

func (s *WorkspaceService) Load() (WorkspaceLoadResult, error) {
	if s.recovery != nil {
		return WorkspaceLoadResult{Recovery: s.recovery}, nil
	}
	if s.store == nil {
		return WorkspaceLoadResult{}, errStorageUnavailable
	}
	state, err := s.store.LoadWorkspace(context.Background())
	if err != nil {
		return WorkspaceLoadResult{}, err
	}
	return WorkspaceLoadResult{State: &state}, nil
}

func (s *WorkspaceService) SaveTextDiffDraft(draft storage.TextDiffDraft) error {
	if s.store == nil {
		return errStorageUnavailable
	}
	return s.store.SaveTextDiffDraft(context.Background(), draft)
}

func (s *WorkspaceService) SaveSettings(settings map[string]any) error {
	if s.store == nil {
		return errStorageUnavailable
	}
	return s.store.SaveSettings(context.Background(), settings)
}
