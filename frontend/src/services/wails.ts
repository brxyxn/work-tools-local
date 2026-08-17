import * as FileService from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/fileservice";
import * as PayloadService from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/payloadservice";
import * as WorkspaceService from "../../bindings/github.com/brxyxn/work-tools-local/internal/services/workspaceservice";

import type { AppServices } from "./types";

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

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
  files: {
    openBase64TextFile: () => FileService.OpenBase64TextFile(),
    saveDecodedPDF: (defaultName, bytes) => FileService.SaveDecodedPDF(defaultName, bytesToBase64(bytes)),
  },
};
