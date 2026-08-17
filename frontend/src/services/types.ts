import type * as ServiceModels from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/models";
import type * as StorageModels from "../../bindings/github.com/brxyxn/work-tools-local/internal/storage/models";

export interface WorkspacePort {
  load(): Promise<ServiceModels.WorkspaceLoadResult>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
  saveTextDiffDraft(draft: StorageModels.TextDiffDraft): Promise<void>;
}

export interface PayloadPort {
  list(): Promise<StorageModels.Payload[]>;
  createBatch(payloads: StorageModels.NewPayload[]): Promise<StorageModels.Payload[]>;
  update(update: StorageModels.PayloadUpdate): Promise<StorageModels.Payload>;
  delete(ids: string[]): Promise<StorageModels.Payload[]>;
  restore(payloads: StorageModels.Payload[]): Promise<void>;
  select(id: string | null): Promise<void>;
}

export interface AppServices {
  workspace: WorkspacePort;
  payloads: PayloadPort;
}

export type WorkspaceState = StorageModels.WorkspaceState;
export type RecoveryInfo = ServiceModels.RecoveryInfo;
