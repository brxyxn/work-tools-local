import type { AppServices, RecoveryInfo, WorkspaceState } from "./types";

interface MemoryOptions {
  state?: WorkspaceState;
  recovery?: RecoveryInfo;
}

const emptyState: WorkspaceState = {
  payloads: [],
  selectedPayloadId: null,
  textDiffDraft: { originalText: "", changedText: "", viewMode: "split", updatedAt: 0 },
  settings: {},
};

export function createMemoryServices(options: MemoryOptions = {}): AppServices {
  const state = structuredClone(options.state ?? emptyState);
  state.payloads ??= [];
  return {
    workspace: {
      load: async () => options.recovery ? { recovery: options.recovery } : { state },
      saveSettings: async (settings) => {
        state.settings = { ...(state.settings ?? {}), ...settings };
      },
      saveTextDiffDraft: async (draft) => {
        state.textDiffDraft = draft;
      },
    },
    payloads: {
      list: async () => state.payloads ?? [],
      createBatch: async (inputs) => {
        if (inputs.length === 0) throw new Error("at least one payload is required");
        const createdAt = Date.now();
        const created = inputs.map((input) => {
          JSON.parse(input.json);
          return {
            id: crypto.randomUUID(),
            name: input.name,
            json: input.json,
            createdAt,
            tags: [...new Set(input.tags ?? [])],
            metadata: input.metadata,
          };
        });
        state.payloads = [...created, ...(state.payloads ?? [])];
        state.selectedPayloadId = created[0].id;
        return structuredClone(created);
      },
      update: async (update) => {
        const index = (state.payloads ?? []).findIndex((payload) => payload.id === update.id);
        if (index < 0) throw new Error(`payload ${update.id} does not exist`);
        if (update.json !== undefined && update.json !== null) JSON.parse(update.json);
        const current = state.payloads![index];
        const updated = {
          ...current,
          ...(update.name !== undefined && update.name !== null ? { name: update.name } : {}),
          ...(update.json !== undefined && update.json !== null ? { json: update.json } : {}),
          ...(update.tags !== undefined && update.tags !== null ? { tags: [...new Set(update.tags)] } : {}),
          ...(update.metadata !== undefined && update.metadata !== null ? { metadata: update.metadata } : {}),
        };
        state.payloads![index] = updated;
        return structuredClone(updated);
      },
      delete: async (ids) => {
        const remove = new Set(ids);
        const removed = (state.payloads ?? []).filter((payload) => remove.has(payload.id));
        state.payloads = (state.payloads ?? []).filter((payload) => !remove.has(payload.id));
        if (state.selectedPayloadId && remove.has(state.selectedPayloadId)) {
          state.selectedPayloadId = state.payloads[0]?.id ?? null;
        }
        return structuredClone(removed);
      },
      restore: async (payloads) => {
        const existing = new Set((state.payloads ?? []).map((payload) => payload.id));
        state.payloads = [
          ...structuredClone(payloads.filter((payload) => !existing.has(payload.id))),
          ...(state.payloads ?? []),
        ];
      },
      select: async (id) => {
        if (id !== null && !(state.payloads ?? []).some((payload) => payload.id === id)) {
          throw new Error(`payload ${id} does not exist`);
        }
        state.selectedPayloadId = id;
      },
    },
    files: {
      openBase64TextFile: async () => ({ cancelled: true }),
      saveDecodedPDF: async () => ({ cancelled: true }),
    },
  };
}
