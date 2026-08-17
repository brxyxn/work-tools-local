package storage

type PayloadMetadata struct {
	SourceSystem string `json:"source_system,omitempty"`
	Type         string `json:"type,omitempty"`
	QueueURI     string `json:"queue_uri,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
}

type Payload struct {
	ID              string          `json:"id"`
	Name            string          `json:"name,omitempty"`
	JSON            string          `json:"json"`
	CreatedAtUnixMS int64           `json:"createdAt"`
	Tags            []string        `json:"tags"`
	Metadata        PayloadMetadata `json:"metadata,omitempty"`
}

type NewPayload struct {
	Name     string          `json:"name,omitempty"`
	JSON     string          `json:"json"`
	Tags     []string        `json:"tags,omitempty"`
	Metadata PayloadMetadata `json:"metadata,omitempty"`
}

type PayloadUpdate struct {
	ID       string           `json:"id"`
	Name     *string          `json:"name,omitempty"`
	JSON     *string          `json:"json,omitempty"`
	Tags     *[]string        `json:"tags,omitempty"`
	Metadata *PayloadMetadata `json:"metadata,omitempty"`
}

type TextDiffDraft struct {
	OriginalText string `json:"originalText"`
	ChangedText  string `json:"changedText"`
	ViewMode     string `json:"viewMode"`
	UpdatedAt    int64  `json:"updatedAt"`
}

type WorkspaceState struct {
	Payloads          []Payload      `json:"payloads"`
	SelectedPayloadID *string        `json:"selectedPayloadId"`
	TextDiffDraft     TextDiffDraft  `json:"textDiffDraft"`
	Settings          map[string]any `json:"settings"`
}
