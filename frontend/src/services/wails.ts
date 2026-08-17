import * as PayloadService from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/payloadservice";
import * as WorkspaceService from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/workspaceservice";

import type { AppServices } from "./types";

export const wailsServices: AppServices = {
  workspace: {
    load: () => WorkspaceService.Load(),
    saveSettings: (settings) => WorkspaceService.SaveSettings(settings),
    saveTextDiffDraft: (draft) => WorkspaceService.SaveTextDiffDraft(draft),
  },
  payloads: {
    list: async () => (await PayloadService.List()) ?? [],
    createBatch: async (payloads) => (await PayloadService.CreateBatch(payloads)) ?? [],
    update: (update) => PayloadService.Update(update),
    delete: async (ids) => (await PayloadService.Delete(ids)) ?? [],
    restore: (payloads) => PayloadService.Restore(payloads),
    select: (id) => PayloadService.Select(id),
  },
};
